// DuckDB-WASM num Web Worker, uma instância por aba. Só os bundles mvp/eh: o coi (com threads) exige
// COOP/COEP, que o GitHub Pages não envia.
//
// O worker não faz HTTP. Cada arquivo é baixado inteiro com fetch() na página, registrado como buffer
// e lido com read_parquet. Por quê, medido em 2026-10-06 e 2026-10-09 com duckdb-wasm 1.33.1-dev57.0:
// - o GitHub Pages comprime application/octet-stream quando o cliente aceita gzip e aplica o Range aos
//   bytes comprimidos. O Chrome pede Accept-Encoding: identity num Range; o Firefox antes do 148 não
//   (bug 1983387) e recebe pedaços que não consegue ler ("NetworkError: A network error occurred");
// - o Pages responde HEAD com Range usando 200, o que derruba o modo "reliableHeadRequests", e por Range
//   uma busca por texto relia pedaços e passava do tamanho do arquivo (5,3 MB para 3,25 MB);
// - os arquivos são pequenos (3,25 e 1,5 MB; os cosméticos vêm em pedaços de até 2,5 MB, ver
//   corredores/cosmeticos), o caminho de cada build é imutável e o fetch() entra no cache HTTP (o Pages
//   manda max-age=600 e ETag). Depois de baixado, toda consulta é local.
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

export interface Progresso {
  tabela: string;
  recebidos: number;
  total: number;
}
const ouvintes = new Set<(p: Progresso) => void>();

/** Avisa o andamento dos downloads (para a barra de carregamento). Devolve a função que desinscreve. */
export function aoProgresso(fn: (p: Progresso) => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

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
  banco ??= abrir().catch((e: unknown) => {
    banco = null;
    throw e;
  });
  return (await banco).manifest;
}

// tabelas já carregadas, por build; um build novo carrega de novo
let carregadas = new Map<string, Promise<void>>();
// arquivos avulsos (os pedaços da busca dos cosméticos), por caminho; o caminho já traz o build
let avulsos = new Map<string, Promise<string>>();

async function obter(u: string, tabela: string, total: number): Promise<Uint8Array> {
  const res = await fetch(u);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} em ${u}`), { status: res.status });
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  // lê em pedaços para informar o progresso; o total vem do manifest porque o Content-Length é o
  // do corpo comprimido (o Pages manda gzip) e o stream entrega os bytes já descomprimidos
  const buf = new Uint8Array(total);
  let recebidos = 0;
  const leitor = res.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (recebidos + value.length > total) {
      // maior que o manifest diz: para aqui; o buffer vazio falha na validação e baixa de novo
      await leitor.cancel();
      return new Uint8Array(0);
    }
    buf.set(value, recebidos);
    recebidos += value.length;
    for (const fn of ouvintes) fn({ tabela, recebidos, total });
  }
  return recebidos === total ? buf : buf.slice(0, recebidos);
}

/** Tamanho do manifest e "PAR1" no fim: um Parquet truncado não passa. */
function inteiro(buf: Uint8Array, bytes: number | undefined): boolean {
  const fim = buf.subarray(buf.length - 4);
  return (!bytes || buf.length === bytes) && fim.length === 4 && String.fromCharCode(...fim) === "PAR1";
}

/** Relê o manifest sem cache depois de um 404 (houve deploy no meio da sessão): true se o build mudou. */
async function releuManifest(b: Banco): Promise<boolean> {
  const novo = await fetchManifest(MANIFEST_URL, { fresh: true });
  if (novo.build_id === b.manifest.build_id) return false;
  b.manifest = novo;
  carregadas = new Map();
  avulsos = new Map();
  return true;
}

async function baixar(b: Banco, nome: string): Promise<void> {
  const u = tabelaUrl(MANIFEST_URL, b.manifest, nome);
  const bytes = b.manifest.tables[nome]?.bytes;
  const buf = await obter(u, nome, bytes ?? 0);
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
    p = baixar(b, nome).catch(async (e: unknown) => {
      if ((e as { status?: number }).status !== 404 || !(await releuManifest(b))) throw e;
      return carregar(nome);
    });
    p.catch(() => carregadas.delete(chave));
    carregadas.set(chave, p);
  }
  return p;
}

/** Caminho relativo ao manifest, sem nada que escape da pasta de dados nem da string SQL. */
const CAMINHO = /^[a-z0-9_]+(\/[a-z0-9_.-]+)*$/i;

async function bytesDe(b: Banco, caminho: string): Promise<{ u: string; res: Response }> {
  if (!CAMINHO.test(caminho) || caminho.includes("..")) throw new Error(`caminho de dados inválido: ${caminho}`);
  const u = new URL(caminho, MANIFEST_URL).href;
  const res = await fetch(u);
  if (res.status === 404 && (await releuManifest(b))) {
    // o build sumiu: quem pediu monta os caminhos de novo a partir do manifest novo
    throw Object.assign(new Error(`os dados foram atualizados: ${caminho}`), { status: 404, buildMudou: true });
  }
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} em ${u}`), { status: res.status });
  return { u, res };
}

/**
 * Baixa um Parquet pelo caminho (relativo ao manifest) e o registra; devolve o nome para read_parquet().
 * Uma vez por caminho; falhou, a próxima chamada tenta de novo. `bytes` é o tamanho que o índice informa.
 */
export async function baixarArquivo(caminho: string, bytes: number): Promise<string> {
  if (!banco) await iniciar();
  const b = await banco!;
  let p = avulsos.get(caminho);
  if (!p) {
    p = (async () => {
      const { u, res } = await bytesDe(b, caminho);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (!inteiro(buf, bytes)) throw new Error(`arquivo incompleto: ${buf.length} de ${bytes} bytes em ${u}`);
      const arquivo = caminho.replaceAll("/", "_");
      await b.db.registerFileBuffer(arquivo, buf);
      return arquivo;
    })();
    p.catch(() => avulsos.delete(caminho));
    avulsos.set(caminho, p);
  }
  return p;
}

/** Baixa um JSON pelo caminho (relativo ao manifest), conferindo tamanho e sha256 como o manifest informa. */
export async function baixarJson(caminho: string, bytes: number, sha256: string): Promise<unknown> {
  if (!banco) await iniciar();
  const { u, res } = await bytesDe(await banco!, caminho);
  // o Pages manda JSON com gzip; o arrayBuffer já vem descomprimido, do tamanho do arquivo
  const buf = new Uint8Array(await res.arrayBuffer());
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buf)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  if (buf.length !== bytes || hash !== sha256) throw new Error(`arquivo diferente do manifest em ${u}`);
  return JSON.parse(new TextDecoder().decode(buf)) as unknown;
}

/** Build dos dados em uso agora (muda se um deploy acontecer no meio da sessão). */
export async function buildAtual(): Promise<string> {
  if (!banco) await iniciar();
  return (await banco!).manifest.build_id;
}

/**
 * Consulta preparada sobre tabelas já carregadas; valores do usuário sempre como parâmetros. `T` é a forma
 * das linhas segundo o SQL de quem chama: é a única afirmação de tipo sobre o que vem do banco.
 */
export async function consultar<T = Linha>(tabelas: string[], sql: string, params: Valor[] = []): Promise<T[]> {
  await Promise.all(tabelas.map(carregar));
  const { conn } = await banco!;
  const stmt = await conn.prepare(sql);
  try {
    const res = await stmt.query(...params);
    // sem o esquema das colunas, o Arrow tipa cada linha como any; daqui só se usa o toJSON()
    const linhas: Iterable<{ toJSON(): T }> = res;
    return Array.from(linhas, (r) => r.toJSON());
  } finally {
    await stmt.close();
  }
}
