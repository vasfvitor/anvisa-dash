// ANVISA's files behind a manifest table. A raw table's `source` is ANVISA's open-data file; a derived one's
// (derivar.py, in the `anvisa` repo) is the recipe, and the files sit behind the tables in `fontes`, which may
// be derived too. Public text names the files, never the recipe.
import { fmtData, fmtDataLocal } from "./format";
import type { Origem, Tabela } from "./manifest";

/**
 * Which date of the file `data` is: "gerado" is the date ANVISA writes in the file (`loaded_at`,
 * max(DT_CARGA_ETL)), "publicado" the Last-Modified of ANVISA's server; null when the manifest has neither.
 */
export type TipoData = "gerado" | "publicado" | null;

/** A file ANVISA publishes, with ANVISA's date for it (DD/MM/AAAA; "" when the manifest has none). */
export interface ArquivoAnvisa {
  name: string;
  url: string;
  data: string;
  tipo: TipoData;
}

const publicado = (lastModified: string | undefined): Pick<ArquivoAnvisa, "data" | "tipo"> =>
  lastModified ? { data: fmtDataLocal(lastModified), tipo: "publicado" } : { data: "", tipo: null };

/**
 * The files of a raw source. The date is `loaded_at` (the Brasília clock ANVISA writes in the file,
 * max(DT_CARGA_ETL)), else the Last-Modified of ANVISA's server. A source made of several files lists each
 * with its own Last-Modified, and a file without one has no date: it never borrows another file's.
 */
function daOrigem(o: Origem): ArquivoAnvisa[] {
  const partes = (o.files ?? []).filter((f) => f.name && f.url);
  if (partes.length > 1) return partes.map((f) => ({ name: f.name, url: f.url, ...publicado(f.last_modified) }));
  const data = o.loaded_at ? { data: fmtData(o.loaded_at), tipo: "gerado" as const } : publicado(o.last_modified);
  return [{ name: o.name, url: o.url, ...data }];
}

/**
 * ANVISA's files that table `nome` comes from, resolving `fontes` recursively, without repeats, in `fontes`
 * order. A table missing from the manifest (or a source that left it) adds nothing.
 */
export function arquivosDaTabela(tabelas: Record<string, Tabela>, nome: string): ArquivoAnvisa[] {
  const vistos = new Set<string>();
  const out: ArquivoAnvisa[] = [];
  const visitar = (n: string) => {
    if (vistos.has(n)) return;
    vistos.add(n);
    const t = tabelas[n];
    if (!t) return;
    if (t.fontes?.length) {
      for (const f of t.fontes) visitar(f);
      return;
    }
    for (const a of daOrigem(t.source)) if (!out.some((x) => x.url === a.url)) out.push(a);
  };
  visitar(nome);
  return out;
}

interface Grupo {
  data: string;
  tipo: TipoData;
  arquivos: ArquivoAnvisa[];
}

/** Consecutive files with the same date of the same kind, grouped, so the date is said once per group. */
export function porData(arquivos: ArquivoAnvisa[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const a of arquivos) {
    const ultimo = grupos.at(-1);
    if (ultimo?.data === a.data && ultimo.tipo === a.tipo) ultimo.arquivos.push(a);
    else grupos.push({ data: a.data, tipo: a.tipo, arquivos: [a] });
  }
  return grupos;
}

/**
 * The date of `n` files, saying whose it is: "arquivo gerado pela ANVISA em DD/MM/AAAA" (the date in the
 * file), "arquivo publicado pela ANVISA em DD/MM/AAAA" (the server's Last-Modified), or "arquivo sem data";
 * plural for more than one.
 */
export function dataDosArquivos(n: number, { data, tipo }: Pick<ArquivoAnvisa, "data" | "tipo">): string {
  const arquivo = n > 1 ? "arquivos" : "arquivo";
  if (!data || !tipo) return `${arquivo} sem data`;
  return `${arquivo} ${tipo}${n > 1 ? "s" : ""} pela ANVISA em ${data}`;
}

/** What goes before item `i` of `n` in a Portuguese list: "", ", " or " e " ("X, Y e Z"). */
export function separador(i: number, n: number): string {
  return i === 0 ? "" : i === n - 1 ? " e " : ", ";
}
