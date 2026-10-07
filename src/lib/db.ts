// DuckDB-WASM num Web Worker, uma instância por aba. Só os bundles mvp/eh: o coi (com threads) exige
// COOP/COEP, que o GitHub Pages não envia.
//
// O worker não faz HTTP. Cada tabela é baixada inteira com fetch() na página, registrada como
// buffer e exposta como VIEW. Por quê, medido em 2026-10-06 com duckdb-wasm 1.33.1-dev57.0:
// - o HTTP do worker é XHR síncrono, e o comportamento muda por navegador e por servidor. Contra o
//   GitHub Pages, o Firefox falha no GET com Range ("NetworkError: A network error occurred"),
//   enquanto o Chrome funciona. O padrão desta versão ainda baixa o arquivo inteiro, e o Pages
//   responde HEAD com Range usando 200, o que derruba o modo "reliableHeadRequests";
// - por Range, uma busca por texto relê pedaços e passou do tamanho do arquivo (5,3 MB para 3,25 MB);
// - os arquivos são pequenos (3,25 e 1,5 MB), o caminho de cada build é imutável e o fetch()
//   entra no cache HTTP (o Pages manda max-age=600 e ETag). Depois de baixado, toda consulta é local.
import * as duckdb from "@duckdb/duckdb-wasm";
import { MANIFEST_URL } from "./config";
import { fetchManifest, tabelaUrl, type Manifest } from "./manifest";

export type Valor = string | number | boolean | null;
export type Linha = Record<string, unknown>;

interface Banco {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  manifest: Manifest;
}

let banco: Promise<Banco> | null = null;

async function abrir(): Promise<Banco> {
  const todos = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle({ mvp: todos.mvp, eh: todos.eh });
  // worker de outra origem (jsDelivr) só sobe via um Blob da nossa origem que o importa
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(bundle.mainWorker)});`], { type: "text/javascript" }),
  );
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(workerUrl));
  try {
    // manifest e motor em paralelo: os dois são a espera da primeira visita
    const [manifest] = await Promise.all([fetchManifest(MANIFEST_URL), db.instantiate(bundle.mainModule)]);
    const conn = await db.connect();
    return { db, conn, manifest };
  } catch (e) {
    await db.terminate();
    throw e;
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
}

/** Sobe o motor uma vez; chamadas seguintes recebem a mesma promessa. Falhou, a próxima tenta de novo. */
export async function iniciar(): Promise<Manifest> {
  banco ??= abrir().catch((e) => {
    banco = null;
    throw e;
  });
  return (await banco).manifest;
}

// tabelas já carregadas, por build; um build novo carrega de novo
let carregadas = new Map<string, Promise<void>>();

async function obter(u: string, cache: RequestCache): Promise<Uint8Array> {
  const res = await fetch(u, { cache });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} em ${u}`), { status: res.status });
  return new Uint8Array(await res.arrayBuffer());
}

/** Tamanho do manifest e "PAR1" no fim: um Parquet truncado não passa. */
function inteiro(buf: Uint8Array, bytes: number | undefined): boolean {
  const fim = buf.subarray(buf.length - 4);
  return (!bytes || buf.length === bytes) && fim.length === 4 && String.fromCharCode(...fim) === "PAR1";
}

async function baixar(b: Banco, nome: string): Promise<void> {
  const u = tabelaUrl(MANIFEST_URL, b.manifest, nome);
  const bytes = b.manifest.tables[nome]?.bytes;
  let buf = await obter(u, "default");
  // Uma resposta parcial em cache (de uma visita à versão que lia por Range) faz o Chrome devolver
  // 200 com só aqueles bytes: o Pages manda gzip na resposta inteira e identidade na parcial, e o
  // cache mistura as duas (reproduzido em 2026-10-06: Range bytes=0-0, depois fetch → 200 com 1 byte).
  // Nesse caso baixa de novo ignorando o cache, o que também conserta a entrada.
  if (!inteiro(buf, bytes)) buf = await obter(u, "reload");
  if (!inteiro(buf, bytes)) throw new Error(`arquivo incompleto: ${buf.length} de ${bytes} bytes em ${u}`);
  // nome do buffer com o build: um build novo não sobrescreve o que consultas em andamento leem
  const arquivo = `${b.manifest.build_id}_${nome}.parquet`;
  await b.db.registerFileBuffer(arquivo, buf);
  // nome validado em parseManifest (identificador SQL não pode ser parâmetro)
  await b.conn.query(`CREATE OR REPLACE VIEW "${nome}" AS SELECT * FROM read_parquet('${arquivo}')`);
}

/**
 * Garante a VIEW `nome` sobre a tabela em memória, baixando-a na primeira vez. Um 404 quer dizer que
 * houve deploy no meio da sessão e o build anterior sumiu: relê o manifest sem cache e, se o build
 * mudou, tenta uma vez com o caminho novo. Falhou, a próxima chamada tenta de novo.
 */
export async function carregar(nome: string): Promise<void> {
  if (!banco) await iniciar();
  const b = await banco!;
  const chave = `${b.manifest.build_id}/${nome}`;
  let p = carregadas.get(chave);
  if (!p) {
    p = baixar(b, nome).catch(async (e) => {
      if ((e as { status?: number }).status !== 404) throw e;
      const novo = await fetchManifest(MANIFEST_URL, { fresh: true });
      if (novo.build_id === b.manifest.build_id) throw e;
      b.manifest = novo;
      carregadas = new Map();
      return carregar(nome);
    });
    p.catch(() => carregadas.delete(chave));
    carregadas.set(chave, p);
  }
  return p;
}

/** Consulta preparada sobre tabelas já carregadas; valores do usuário sempre como parâmetros. */
export async function consultar(tabelas: string[], sql: string, params: Valor[] = []): Promise<Linha[]> {
  await Promise.all(tabelas.map(carregar));
  const { conn } = await banco!;
  const stmt = await conn.prepare(sql);
  try {
    const res = await stmt.query(...params);
    return res.toArray().map((r) => r.toJSON() as Linha);
  } finally {
    await stmt.close();
  }
}
