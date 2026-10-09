// Contrato com o pipeline do repo `anvisa` (manifest schema_version 1). Os caminhos das tabelas são
// imutáveis e relativos ao manifest: nunca fixe um caminho de dados no código, sempre passe por aqui.

export interface Coluna {
  name: string;
  type: string;
  source?: string;
}

/** De onde a ANVISA publica a tabela (o arquivo aberto de origem). */
export interface Origem {
  name: string;
  url: string;
  loaded_at?: string;
  last_modified?: string;
  bytes?: number;
}

export interface Tabela {
  path: string;
  rows: number;
  bytes: number;
  sha256?: string;
  sort?: string[];
  columns: Coluna[];
  source: Origem;
  nulls_added?: Record<string, number>;
}

export interface Manifest {
  schema_version: number;
  build_id: string;
  built_at: string;
  tables: Record<string, Tabela>;
}

const NOME_TABELA = /^[a-z_][a-z0-9_]*$/;

/** Valida o que o app usa; um schema_version novo pede revisão do código, então falha alto. */
export function parseManifest(raw: unknown): Manifest {
  const m = raw as Partial<Manifest> | null;
  if (!m || typeof m !== "object") throw new Error("manifest inválido: não é um objeto");
  if (m.schema_version !== 1) throw new Error(`manifest com schema_version ${m.schema_version} (esperado 1)`);
  if (!m.tables || typeof m.tables !== "object") throw new Error("manifest inválido: sem tables");
  // o JSON ainda não foi validado: cada tabela pode vir sem campos ou nula
  const tabelas: Record<string, Partial<Tabela> | null> = m.tables;
  for (const [nome, t] of Object.entries(tabelas)) {
    // o nome vira identificador SQL (CREATE VIEW), que não pode ser parâmetro: só aceita o seguro
    if (!NOME_TABELA.test(nome)) throw new Error(`manifest: nome de tabela inválido ${JSON.stringify(nome)}`);
    if (typeof t?.path !== "string") throw new Error(`manifest: tabela ${nome} sem path`);
  }
  return m as Manifest;
}

/** URL absoluta do Parquet de uma tabela, resolvida a partir da URL do manifest. */
export function tabelaUrl(manifestUrl: string, m: Manifest, nome: string): string {
  const t = m.tables[nome];
  if (!t) throw new Error(`manifest sem a tabela ${nome}`);
  return new URL(t.path, manifestUrl).href;
}

/** `fresh` fura o cache de 600 s do Pages (usado depois de um 404 em dados). */
export async function fetchManifest(manifestUrl: string, { fresh = false } = {}): Promise<Manifest> {
  const u = new URL(manifestUrl);
  if (fresh) u.searchParams.set("t", String(Date.now()));
  const res = await fetch(u, { cache: fresh ? "no-store" : "default" });
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status} em ${manifestUrl}`);
  return parseManifest(await res.json());
}

let doBuild: Promise<Manifest> | undefined;
/** Para páginas Astro em tempo de build: uma busca só por build, compartilhada entre as páginas. */
export function manifestDoBuild(manifestUrl: string): Promise<Manifest> {
  return (doBuild ??= fetchManifest(manifestUrl));
}
