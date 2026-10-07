// DuckDB-WASM num Web Worker, uma instância por aba. Só os bundles mvp/eh: o coi (com threads) exige
// COOP/COEP, que o GitHub Pages não envia. Cada tabela do manifest vira uma VIEW sobre o Parquet
// remoto, lido por HTTP Range; o DuckDB reaproveita rodapé e conexão entre consultas.
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
    // Três opções, todas explícitas porque o padrão desta versão (1.33.1-dev57.0) baixa o arquivo inteiro:
    // - forceFullHTTPReads: false: sem isso o worker nem tenta Range.
    // - reliableHeadRequests: false: o GitHub Pages responde HEAD com Range usando 200, não 206; com
    //   true o worker exige 206 no HEAD e falha. Com false ele testa Range com GET bytes=0-0 (o Pages
    //   responde 206) e usa o HEAD só para saber o tamanho.
    // - allowFullHTTPReads: true: é o que habilita esse teste por GET (e, se um servidor não fizer
    //   Range, cai para leitura completa em vez de falhar).
    // Resultado: lê só rodapé e row groups necessários (~650 KB numa busca por CNPJ, contra 3,25 MB).
    await db.open({
      filesystem: { reliableHeadRequests: false, allowFullHTTPReads: true, forceFullHTTPReads: false },
    });
    const conn = await db.connect();
    // guarda metadados e blocos do Parquet entre consultas: a 2ª busca no mesmo trecho não baixa nada
    await conn.query("SET enable_object_cache = true");
    await criarViews(conn, manifest);
    return { db, conn, manifest };
  } catch (e) {
    await db.terminate();
    throw e;
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
}

async function criarViews(conn: duckdb.AsyncDuckDBConnection, m: Manifest): Promise<void> {
  for (const nome of Object.keys(m.tables)) {
    // nome validado em parseManifest; a URL vem do manifest e entra como literal SQL escapado
    const u = tabelaUrl(MANIFEST_URL, m, nome).replaceAll("'", "''");
    await conn.query(`CREATE OR REPLACE VIEW "${nome}" AS SELECT * FROM read_parquet('${u}')`);
  }
}

// tabelas já baixadas inteiras, por build (um build novo volta a ler remoto)
let memoria = new Map<string, Promise<void>>();

/**
 * Baixa a tabela inteira para a memória do DuckDB e troca a view para essa cópia. Vale para buscas que
 * varrem todos os row groups (texto): por Range elas releem pedaços e passam do tamanho do arquivo
 * (5,3 MB medidos para um arquivo de 3,25 MB); um fetch inteiro baixa uma vez e entra no cache HTTP,
 * o que é seguro porque o caminho de cada build é imutável. Buscas por CNPJ continuam por Range.
 * Falhou, a view continua remota e a próxima chamada tenta de novo.
 */
export async function emMemoria(nome: string): Promise<void> {
  const b = await (banco ?? Promise.reject(new Error("motor não iniciado")));
  const chave = `${b.manifest.build_id}/${nome}`;
  let p = memoria.get(chave);
  if (!p) {
    p = (async () => {
      const u = tabelaUrl(MANIFEST_URL, b.manifest, nome);
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${u}`);
      const arquivo = `${b.manifest.build_id}_${nome}.parquet`;
      await b.db.registerFileBuffer(arquivo, new Uint8Array(await res.arrayBuffer()));
      await b.conn.query(`CREATE OR REPLACE VIEW "${nome}" AS SELECT * FROM read_parquet('${arquivo}')`);
    })();
    p.catch(() => memoria.delete(chave));
    memoria.set(chave, p);
  }
  return p;
}

/** Sobe o motor uma vez; chamadas seguintes recebem a mesma promessa. Falhou, a próxima tenta de novo. */
export async function iniciar(): Promise<Manifest> {
  banco ??= abrir().catch((e) => {
    banco = null;
    throw e;
  });
  return (await banco).manifest;
}

async function executar(conn: duckdb.AsyncDuckDBConnection, sql: string, params: Valor[]): Promise<Linha[]> {
  const stmt = await conn.prepare(sql);
  try {
    const res = await stmt.query(...params);
    return res.toArray().map((r) => r.toJSON() as Linha);
  } finally {
    await stmt.close();
  }
}

/**
 * Consulta preparada (valores sempre como parâmetros). Se falhar por E/S, pode ser que um deploy
 * novo tenha apagado os arquivos do build anterior no meio da sessão: relê o manifest sem cache e,
 * se o build mudou, recria as views e tenta uma vez mais.
 */
export async function consultar(sql: string, params: Valor[] = []): Promise<Linha[]> {
  if (!banco) await iniciar();
  const b = await banco!;
  try {
    return await executar(b.conn, sql, params);
  } catch (e) {
    if (!/HTTP|404|IO Error/i.test(String(e))) throw e;
    const novo = await fetchManifest(MANIFEST_URL, { fresh: true });
    if (novo.build_id === b.manifest.build_id) throw e;
    await criarViews(b.conn, novo);
    b.manifest = novo;
    memoria = new Map();
    return executar(b.conn, sql, params);
  }
}
