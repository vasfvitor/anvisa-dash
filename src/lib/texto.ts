// Legibilidade de texto da ANVISA, que chega quase sempre em MAIÚSCULAS, e destaque do termo buscado.
// Só muda a caixa de texto que veio todo em maiúsculas; texto com minúsculas fica como o autor escreveu.
import { normalizarPalavras } from "./palavras";

// siglas que continuam em maiúsculas depois de baixar a caixa (tokens com dígito já ficam: B12, Q10)
const SIGLAS = new Set([
  "DHA",
  "EPA",
  "MCT",
  "TCM",
  "BCAA",
  "HMB",
  "ZMA",
  "CLA",
  "GABA",
  "NAC",
  "MSM",
  "ALA",
  "ARA",
  "FOS",
  "GOS",
  "PVC",
  "PET",
  "PP",
  "PS",
  "PE",
  "PEAD",
  "PEBD",
  "BOPP",
  "UHT",
  "INS",
  "C",
  "D",
  "K",
  "LTDA",
  "EPP",
  "ME",
  "EIRELI",
  "S.A.",
  "S.A",
  "S/A",
  "SA",
  "CIA",
  "INC.",
  "INC",
  "LLC",
  "GMBH",
  "LTD",
  "LTD.",
  "CO.",
]);
// "com" fica de fora: em razão social é quase sempre "comércio" ("IND E COM")
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "a", "o", "ou", "na", "no"]);

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}./'&-]*/gu;

function temMinuscula(s: string): boolean {
  return /\p{Ll}/u.test(s);
}

/**
 * `frase`: "SUPLEMENTO ALIMENTAR DE VITAMINA C" → "Suplemento alimentar de vitamina C".
 * `nome`: "UNILEVER BRASIL INDUSTRIAL LTDA" → "Unilever Brasil Industrial LTDA".
 */
export function legivel(s: string | null | undefined, modo: "frase" | "nome" = "frase"): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  if (temMinuscula(t)) return t;
  let primeiro = true;
  return t.replace(TOKEN, (tok) => {
    const inicio = primeiro;
    primeiro = false;
    // dígito (B12, Q10), sigla conhecida ou abreviação com pontos (I.V., S.A.) ficam como estão
    if (/\d/.test(tok) || SIGLAS.has(tok) || /^(\p{L}\.){2,}$/u.test(tok)) return tok;
    const baixo = tok.toLocaleLowerCase("pt-BR");
    if (modo === "nome" ? !(LIGACOES.has(baixo) && !inicio) : inicio) {
      return baixo.charAt(0).toLocaleUpperCase("pt-BR") + baixo.slice(1);
    }
    return baixo;
  });
}

/** Remove acentos e baixa a caixa, como o strip_accents + lower da busca SQL. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

export interface Trecho {
  texto: string;
  achado: boolean;
}

/**
 * Fatia `texto` marcando onde `termo` aparece, sem diferenciar acento nem caixa. Com uma lista de palavras (a
 * busca por começo de palavra dos cosméticos), marca cada uma onde começa uma palavra do texto.
 */
export function destacar(texto: string, termo: string | readonly string[] | null | undefined): Trecho[] {
  if (Array.isArray(termo)) return destacarPalavras(texto, termo);
  const alvo = typeof termo === "string" ? normalizar(termo.trim()) : "";
  if (!alvo || !texto) return [{ texto, achado: false }];
  // normaliza caractere a caractere para saber onde cada um cai no texto original; por ponto de código
  // de propósito: um acento combinado ("e" + U+0301) some na normalização e o "e" fica com a posição
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const chars = [...texto];
  let norm = "";
  const origem: number[] = [];
  chars.forEach((c, i) => {
    for (const n of normalizar(c)) {
      norm += n;
      origem.push(i);
    }
  });
  const trechos: Trecho[] = [];
  let ini = 0;
  let pos = norm.indexOf(alvo);
  while (pos >= 0) {
    const de = origem[pos]!;
    const ate = origem[pos + alvo.length - 1]! + 1;
    if (de > ini) trechos.push({ texto: chars.slice(ini, de).join(""), achado: false });
    trechos.push({ texto: chars.slice(de, ate).join(""), achado: true });
    ini = ate;
    pos = norm.indexOf(alvo, pos + alvo.length);
  }
  if (ini < chars.length) trechos.push({ texto: chars.slice(ini).join(""), achado: false });
  return trechos;
}

/** Cada palavra marcada onde começa uma palavra do texto, pela regra das palavras (sem apóstrofo: "l'oréal"). */
function destacarPalavras(texto: string, palavras: readonly string[]): Trecho[] {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const chars = [...texto];
  let norm = "";
  const origem: number[] = [];
  chars.forEach((c, i) => {
    for (const n of normalizarPalavras(c)) {
      norm += n;
      origem.push(i);
    }
  });
  const marcado = new Array<boolean>(chars.length).fill(false);
  for (const p of palavras) {
    if (!p) continue;
    for (let pos = norm.indexOf(p); pos >= 0; pos = norm.indexOf(p, pos + 1)) {
      if (pos > 0 && /[a-z0-9]/.test(norm[pos - 1]!)) continue;
      for (let k = origem[pos]!; k <= origem[pos + p.length - 1]!; k++) marcado[k] = true;
    }
  }
  const trechos: Trecho[] = [];
  chars.forEach((c, i) => {
    const ultimo = trechos.at(-1);
    if (ultimo && ultimo.achado === marcado[i]) ultimo.texto += c;
    else trechos.push({ texto: c, achado: marcado[i]! });
  });
  return trechos.length ? trechos : [{ texto, achado: false }];
}
