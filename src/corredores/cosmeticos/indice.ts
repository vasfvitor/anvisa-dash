// Que arquivos de busca dos cosméticos uma consulta precisa (SPEC.md do repo `anvisa`, formato 1). Puro: a
// fonte baixa o que sair daqui; os testes usam um índice falso.
//
// O repo `anvisa` publica, além do Parquet inteiro (24 MB, grande demais para baixar), os mesmos dados em
// pedaços: por palavra do nome, por CNPJ e pelos 3 últimos dígitos de processo e registro, com um índice.
// Uma busca baixa um ou dois pedaços (45 a 850 KB no comum; 2,5 MB para "shampoo").
import type { Consulta } from "../../lib/detect";
import { palavrasDaBusca, palavrasSql } from "../../lib/palavras";
import { COLUNAS_LINHA } from "./consultas";

/** [primeira chave, linhas, caminho relativo à pasta do índice, bytes] */
export type Faixa = [string, number, string, number];

export interface Indice {
  versao: 1;
  /** em ordem de bytes da primeira palavra; cada arquivo vai da sua primeira à primeira do seguinte */
  palavras: Faixa[];
  /** idem, por CNPJ */
  empresas: Faixa[];
  /** bytes de numeros/<DDD>.parquet, pelos 3 últimos dígitos */
  numeros: Record<string, number>;
  empresas_parquet: number;
}

export interface Arquivo {
  caminho: string;
  bytes: number;
}

export type Rota =
  /** CNPJ: o arquivo da empresa e o de números (há processo de 14 dígitos, como nos saneantes) */
  | { modo: "cnpj"; valor: string; empresas: Arquivo[]; numeros: Arquivo[] }
  | { modo: "numero"; valor: string; numeros: Arquivo[] }
  /** a palavra com menos linhas decide os arquivos; as outras filtram pelo nome */
  | { modo: "texto"; palavra: string; outras: string[]; palavras: Arquivo[] }
  | { modo: "nada" };

const FAIXA = (x: unknown): x is Faixa =>
  Array.isArray(x) &&
  x.length === 4 &&
  typeof x[0] === "string" &&
  typeof x[1] === "number" &&
  typeof x[2] === "string" &&
  typeof x[3] === "number";

/** Valida o indice.json; versão nova pede revisão do código, então falha alto. */
export function lerIndice(raw: unknown): Indice {
  const i = raw as Partial<Indice> | null;
  if (!i || typeof i !== "object" || i.versao !== 1) throw new Error("índice dos cosméticos numa versão desconhecida");
  if (!Array.isArray(i.palavras) || !i.palavras.every(FAIXA) || !Array.isArray(i.empresas) || !i.empresas.every(FAIXA))
    throw new Error("índice dos cosméticos inválido");
  if (!i.numeros || typeof i.numeros !== "object" || typeof i.empresas_parquet !== "number")
    throw new Error("índice dos cosméticos inválido");
  return i as Indice;
}

// acima de qualquer palavra: elas só têm [a-z0-9], e aí a ordem de bytes e a do JS coincidem
const ALTO = "\uffff";

const arquivo = (f: Faixa): Arquivo => ({ caminho: f[2], bytes: f[3] });

/** Os arquivos cuja faixa [primeira, primeira do seguinte) cruza [p, p + ALTO): os de palavras que começam com p. */
export function faixasDe(lista: Faixa[], p: string): Faixa[] {
  return lista.filter((f, i) => f[0] < p + ALTO && (lista[i + 1]?.[0] ?? ALTO) > p);
}

function numeros(ix: Indice, valor: string): Arquivo[] {
  const ddd = valor.slice(-3);
  const bytes = valor.length >= 3 ? ix.numeros[ddd] : undefined;
  return bytes === undefined ? [] : [{ caminho: `numeros/${ddd}.parquet`, bytes }];
}

/** A rota de uma consulta; `minimo` é o tamanho de palavra que vale (as menores casariam com metade da tabela). */
export function rota(ix: Indice, q: Consulta, minimo: number): Rota {
  switch (q.modo) {
    case "cnpj": {
      const dona = ix.empresas.filter((f) => f[0] <= q.valor).at(-1);
      return { modo: "cnpj", valor: q.valor, empresas: dona ? [arquivo(dona)] : [], numeros: numeros(ix, q.valor) };
    }
    case "numero":
      return { modo: "numero", valor: q.valor, numeros: numeros(ix, q.valor) };
    case "texto":
    case "marca": {
      const ps = palavrasDaBusca(q.valor, minimo);
      if (!ps.length) return { modo: "nada" };
      // a palavra cujos arquivos somam menos linhas: no empate, a que vem antes na busca
      const linhas = (p: string) => faixasDe(ix.palavras, p).reduce((n, f) => n + f[1], 0);
      const palavra = ps.reduce((a, b) => (linhas(b) < linhas(a) ? b : a));
      return {
        modo: "texto",
        palavra,
        outras: ps.filter((p) => p !== palavra),
        palavras: faixasDe(ix.palavras, palavra).map(arquivo),
      };
    }
    case "todos":
      return { modo: "nada" };
  }
}

/** Todos os arquivos que a rota lê. */
export function arquivosDa(r: Rota): Arquivo[] {
  switch (r.modo) {
    case "cnpj":
      return [...r.empresas, ...r.numeros];
    case "numero":
      return r.numeros;
    case "texto":
      return r.palavras;
    case "nada":
      return [];
  }
}

/**
 * As linhas da rota (COLUNAS_LINHA, antes de deduplicar), com `lista` dando o argumento de read_parquet para
 * cada grupo de arquivos; null quando não há o que ler. Valores da busca só como parâmetros.
 */
export function linhasDa(r: Rota, lista: (a: Arquivo[]) => string): { sql: string; params: string[] } | null {
  const de = (a: Arquivo[], onde: string) => `SELECT ${COLUNAS_LINHA} FROM read_parquet(${lista(a)}) WHERE ${onde}`;
  switch (r.modo) {
    case "cnpj": {
      const partes: [string, string][] = [];
      if (r.empresas.length) partes.push([de(r.empresas, "nu_cnpj_empresa = ?"), r.valor]);
      if (r.numeros.length) partes.push([de(r.numeros, "num = ?"), r.valor]);
      if (!partes.length) return null;
      return { sql: partes.map((p) => p[0]).join(" UNION ALL "), params: partes.map((p) => p[1]) };
    }
    case "numero":
      return r.numeros.length ? { sql: de(r.numeros, "num = ?"), params: [r.valor] } : null;
    case "texto": {
      if (!r.palavras.length) return null;
      // cada outra palavra da busca começa alguma palavra do nome, pela mesma regra dos arquivos
      const outras = r.outras.map(
        () => ` AND len(list_filter(${palavrasSql("no_produto")}, lambda w: starts_with(w, ?))) > 0`,
      );
      return { sql: de(r.palavras, `starts_with(palavra, ?)${outras.join("")}`), params: [r.palavra, ...r.outras] };
    }
    case "nada":
      return null;
  }
}
