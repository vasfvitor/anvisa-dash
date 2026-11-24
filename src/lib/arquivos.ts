// ANVISA's files behind a manifest table. A raw table's `source` is ANVISA's open-data file; a derived one's
// (derivar.py, in the `anvisa` repo) is the recipe, and the files sit behind the tables in `fontes`, which may
// be derived too. Public text names the files, never the recipe.
import { fmtData, fmtDataLocal } from "./format";
import type { Origem, Tabela } from "./manifest";

/** A file ANVISA publishes, with ANVISA's date for it (DD/MM/AAAA; "" when the manifest has none). */
export interface ArquivoAnvisa {
  name: string;
  url: string;
  data: string;
}

/**
 * The files of a raw source. The date is `loaded_at` (the Brasília clock ANVISA writes in the file,
 * max(DT_CARGA_ETL)), else the Last-Modified of ANVISA's server. A source made of several files lists each
 * with its own Last-Modified.
 */
function daOrigem(o: Origem): ArquivoAnvisa[] {
  const data = o.loaded_at ? fmtData(o.loaded_at) : o.last_modified ? fmtDataLocal(o.last_modified) : "";
  const partes = (o.files ?? []).filter((f) => f.name && f.url);
  if (partes.length > 1)
    return partes.map((f) => ({
      name: f.name,
      url: f.url,
      data: f.last_modified ? fmtDataLocal(f.last_modified) : data,
    }));
  return [{ name: o.name, url: o.url, data }];
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

/** Consecutive files with the same date, grouped, so the date is said once per group. */
export function porData(arquivos: ArquivoAnvisa[]): { data: string; arquivos: ArquivoAnvisa[] }[] {
  const grupos: { data: string; arquivos: ArquivoAnvisa[] }[] = [];
  for (const a of arquivos) {
    const ultimo = grupos.at(-1);
    if (ultimo?.data === a.data) ultimo.arquivos.push(a);
    else grupos.push({ data: a.data, arquivos: [a] });
  }
  return grupos;
}

/** "arquivo gerado pela ANVISA em DD/MM/AAAA" (plural for more than one); "" without a date. */
export function geradoEm(n: number, data: string): string {
  if (!data) return "";
  return n > 1 ? `arquivos gerados pela ANVISA em ${data}` : `arquivo gerado pela ANVISA em ${data}`;
}

/** What goes before item `i` of `n` in a Portuguese list: "", ", " or " e " ("X, Y e Z"). */
export function separador(i: number, n: number): string {
  return i === 0 ? "" : i === n - 1 ? " e " : ", ";
}
