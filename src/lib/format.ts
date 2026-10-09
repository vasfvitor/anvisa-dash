// Helpers puros (sem DuckDB, sem Vue): rotas, formatação e o fatiamento dos campos multivalorados
// da ANVISA. Importáveis por páginas Astro, componentes e testes.

// rotas do site (único lugar onde o base path aparece)
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** 00000000055417 → 00.000.000/0554-17; qualquer outra coisa volta como veio. */
export function fmtCnpj(d: string | null | undefined): string {
  if (!d) return "";
  return /^\d{14}$/.test(d) ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d;
}

/** 25351161029202655 → 25351.161029/2026-55 (formato do processo SEI/Datavisa). */
export function fmtProcesso(d: string | null | undefined): string {
  if (!d) return "";
  return /^\d{17}$/.test(d) ? d.replace(/^(\d{5})(\d{6})(\d{4})(\d{2})$/, "$1.$2/$3-$4") : d;
}

/**
 * DATE/TIMESTAMP chegam do duckdb-wasm (via Arrow) como ms, bigint, Date ou texto conforme a
 * versão; normaliza num lugar só. Os timestamps da ANVISA são horário de Brasília sem fuso, e o
 * Arrow os entrega como se fossem UTC: por isso toda formatação abaixo usa timeZone UTC, que
 * mostra o relógio gravado sem deslocar (senão meia-noite vira o dia anterior no Brasil).
 */
export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "bigint") return new Date(Number(v));
  if (typeof v === "number") return Number.isFinite(v) ? new Date(v) : null;
  if (typeof v === "string") {
    // texto sem fuso (do manifest, ex. 2026-10-05T00:00:00) também é relógio de Brasília: lê como UTC
    const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v.length === 10 ? `${v}T00:00:00` : v}Z`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const MES_ANO = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "2-digit", year: "numeric" });
const DATA_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** DD/MM/AAAA, ou "" sem data. */
export function fmtData(v: unknown): string {
  const d = toDate(v);
  return d ? DATA.format(d) : "";
}

/** DD/MM/AAAA de um instante de verdade (com Z, como o built_at do manifest), no dia de Brasília. */
export function fmtDataLocal(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : DATA_BRASILIA.format(d);
}

/** MM/AAAA: o vencimento tem precisão de mês (gravado como dia 1). */
export function fmtMesAno(v: unknown): string {
  const d = toDate(v);
  return d ? MES_ANO.format(d) : "";
}

export function fmtInt(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;
  return `${(n / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;
}

/** Fatia um campo multivalorado, apara e descarta vazios (a ANVISA às vezes termina com o separador). */
export function fatiar(s: string | null | undefined, sep: string): string[] {
  if (!s) return [];
  return s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** `marcas` e `ds_alegacao_funcional`: separados por ";". */
export const marcas = (s: string | null | undefined) => fatiar(s, ";");

/** "1 produto", "2 produtos"; `varios` padrão é `um` + "s". */
export function plural(n: number, um: string, varios = `${um}s`): string {
  return `${fmtInt(n)} ${n === 1 ? um : varios}`;
}
