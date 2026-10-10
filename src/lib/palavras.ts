// As palavras de um nome de produto, pela regra que o repo `anvisa` usa ao gravar os arquivos de busca dos
// cosméticos (SPEC.md, formato 1). A busca só acha o que esta regra e a de lá concordam: os casos de
// test/fixtures/tokens.json (cópia do tokens.json da SPEC) são os mesmos dos dois lados.
//
// 1. tira apóstrofos ("L'ORÉAL" vira loreal); 2. NFKD, sem marcas (categoria M), minúsculas; 3. corta em
// tudo que não é [a-z0-9]; fica o que tem 2 ou mais caracteres e não é palavra vazia; 4. cada composto com
// hífen entra também junto ("ANTI-QUEDA" dá anti, queda, antiqueda); 5. cada palavra uma vez, na ordem.

const APOSTROFOS = /['\u2019\u2018`\u00b4]/g;
const SEPARADOR = /[^a-z0-9]+/;
const COMPOSTO = /[a-z0-9]+(?:-[a-z0-9]+)+/g;
export const VAZIAS = ["de", "da", "do", "das", "dos", "para", "com", "em", "e", "a", "o"];
const VAZIA = new Set(VAZIAS);

/** O texto como as palavras são tiradas dele: sem apóstrofos, sem marcas (NFKD), minúsculo. */
export function normalizarPalavras(texto: string): string {
  return texto.replace(APOSTROFOS, "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/** As palavras distintas de um texto, na ordem em que aparecem. */
export function palavras(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const n = normalizarPalavras(texto);
  const compostos = Array.from(n.matchAll(COMPOSTO), (m) => m[0].replaceAll("-", ""));
  return [...new Set([...n.split(SEPARADOR), ...compostos].filter((p) => p.length >= 2 && !VAZIA.has(p)))];
}

/** As palavras de uma busca que dá para procurar (as curtas casariam com metade da tabela). */
export function palavrasDaBusca(texto: string, minimo: number): string[] {
  return palavras(texto).filter((p) => p.length >= minimo);
}

// O mesmo no SQL do DuckDB, para conferir as outras palavras de uma busca sem trazer os nomes para o JS
// (a API assíncrona do DuckDB-WASM não aceita função JS no SQL). O strip_accents não faz a decomposição de
// compatibilidade do NFKD; os 5 caracteres abaixo são os que aparecem nos nomes (medido em 2026-10-09 nos
// 1.082.152 nomes distintos dos cosméticos: mesmas palavras em todos). Ligaduras e letras de largura
// cheia ainda divergem (test/palavras.test.ts). Só ASCII aqui: chr() no lugar dos caracteres.
const COMPATIVEIS: [number, string][] = [
  [0xba, "o"], // º
  [0xaa, "a"], // ª
  [0x2122, "tm"], // ™
  [0xb2, "2"], // ²
  [0xb3, "3"], // ³
];

/** Expressão SQL com a lista das palavras de `expr` (repetidas, se houver; a ordem não importa). */
export function palavrasSql(expr: string): string {
  let s = `regexp_replace(${expr}, '[''\\x{2019}\\x{2018}\\x{60}\\x{B4}]', '', 'g')`;
  for (const [cod, por] of COMPATIVEIS) s = `replace(${s}, chr(${cod}), '${por}')`;
  s = `lower(strip_accents(${s}))`;
  const vazias = VAZIAS.map((p) => `'${p}'`).join(", ");
  return `list_filter(list_concat(regexp_split_to_array(${s}, '[^a-z0-9]+'),
      list_transform(regexp_extract_all(${s}, '[a-z0-9]+(?:-[a-z0-9]+)+'), lambda c: replace(c, '-', ''))),
    lambda w: length(w) >= 2 AND NOT list_contains([${vazias}], w))`;
}
