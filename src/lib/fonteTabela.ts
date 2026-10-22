// A fonte de um corredor cuja tabela cabe inteira no navegador (alimentos, limpeza, remédios, dispositivos):
// baixa a tabela do manifest, deriva dela uma tabela com as colunas que o cartão e a página leem mais as de
// busca (`busca`, `busca_nome` e a secundária no formato de sqlPalavras; `situacao_registro`,
// `tipo_regularizacao`, `grupo`, `ordem_data`), e responde busca, facetas, sugestões e produto por id com o
// SQL compartilhado de sql.ts. O que muda de corredor para corredor é a configuração abaixo; a regra de casar
// texto (cada palavra, em qualquer ordem, por começo de palavra) é uma só.
import { carregar, consultar, iniciar } from "./db";
import type { Consulta } from "./detect";
import { PALAVRA_MINIMA, POR_PAGINA, type Facetas, type Filtros, type Fonte, type Item } from "./fonte";
import {
  contarFacetas,
  corrigirEm,
  derivar,
  gruposAtivos,
  onde,
  palavrasDe,
  predicadoPalavras,
  relevanciaPalavras,
  sqlPalavrasDistintas,
  sugerirEm,
  type Trecho,
} from "./sql";
import { normalizar } from "./texto";

export interface ConfigTabela<P extends Item> {
  /** a tabela do manifest */
  tabela: string;
  /** o nome da tabela derivada no DuckDB (`<derivada>_sugestoes` é a das sugestões) */
  derivada: string;
  /**
   * CREATE OR REPLACE TABLE <derivada> AS … (o mesmo SQL que o build usa nas páginas de empresa); como função,
   * recebe os nomes das colunas que o manifest publica para a tabela (uma coluna nova entra quando existe)
   */
  sql: string | ((colunas: string[]) => string);
  /** a lista do SELECT que o cartão e a página leem */
  colunas: string;
  /** o id na URL (?p=): a coluna, o formato válido e se a coluna é numérica */
  id: { coluna: string; valida: RegExp; numerico?: boolean };
  /** os 14 dígitos: o CNPJ e, nos corredores com processos antigos de 14 dígitos, o processo */
  cnpj: (valor: string) => Trecho;
  /** só dígitos: processo, registro, expediente… */
  numero: (valor: string) => Trecho;
  /** a marca escolhida numa sugestão (termo normalizado); sem ela, a marca busca como texto */
  marca?: (termo: string) => Trecho;
  /** a coluna de busca da relevância 2 (busca_marcas, busca_principio, busca_tecnico) */
  secundaria?: string;
  /** o fim do ORDER BY depois da relevância e da situação */
  ordem: string;
  /** CREATE OR REPLACE TABLE <derivada>_sugestoes AS … (tipo, rotulo, chave, nu_cnpj_empresa, n, ativos) */
  sugestoes: string;
  cnpjDe: (p: P) => string | null;
  registroDe?: (p: P) => string | null;
}

/** Condição da busca para cada modo de consulta (exportada pelas fontes para os testes). */
export function predicadoDe<P extends Item>(c: ConfigTabela<P>, q: Consulta): Trecho {
  switch (q.modo) {
    case "cnpj":
      return c.cnpj(q.valor);
    case "numero":
      return c.numero(q.valor);
    case "marca":
      return c.marca ? c.marca(normalizar(q.valor.trim())) : predicadoPalavras(palavrasDe(q));
    case "texto":
      return predicadoPalavras(palavrasDe(q));
    case "todos":
      return { sql: "true", params: [] };
  }
}

export function fonteTabela<P extends Item>(c: ConfigTabela<P>): Fonte<P> {
  const sql = c.sql;
  const tabela = (): Promise<void> =>
    derivar(
      c.derivada,
      () => carregar(c.tabela),
      async () =>
        typeof sql === "string" ? sql : sql((await iniciar()).tables[c.tabela]?.columns.map((x) => x.name) ?? []),
    );
  const sugestoes = (): Promise<void> => derivar(`${c.derivada}_sugestoes`, tabela, c.sugestoes);
  const palavras = (): Promise<void> =>
    derivar(`${c.derivada}_palavras`, tabela, sqlPalavrasDistintas(`${c.derivada}_palavras`, c.derivada));

  async function buscar(q: Consulta, f: Filtros, pagina = 0): Promise<P[]> {
    await tabela();
    const w = onde(predicadoDe(c, q), f);
    const r = relevanciaPalavras(palavrasDe(q), "busca_nome", c.secundaria);
    const sql = `
    SELECT ${c.colunas}, (count(*) OVER ())::INTEGER AS total
    FROM (SELECT *, ${r.sql} AS relevancia FROM ${c.derivada}) s
    WHERE ${w.sql}
    ORDER BY relevancia, situacao_registro, ${c.ordem}
    LIMIT ${POR_PAGINA} OFFSET ?`;
    return consultar<P>([], sql, [...r.params, ...w.params, pagina * POR_PAGINA]);
  }

  async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
    await tabela();
    return contarFacetas(c.derivada, predicadoDe(c, q), f);
  }

  async function porId(id: string): Promise<P | null> {
    if (!c.id.valida.test(id)) return null;
    await tabela();
    const sql = `SELECT ${c.colunas}, 1 AS total FROM ${c.derivada} WHERE ${c.id.coluna} = ?`;
    const [p] = await consultar<P>([], sql, [c.id.numerico ? Number(id) : id]);
    return p ?? null;
  }

  return {
    // as sugestões são montadas no primeiro uso, para não disputar o worker com a primeira busca de um link
    preparar: tabela,
    buscar,
    facetas,
    async sugerir(texto) {
      await sugestoes();
      return sugerirEm(`${c.derivada}_sugestoes`, texto);
    },
    porId,
    async grupos() {
      await tabela();
      return gruposAtivos(c.derivada);
    },
    idDe: (p) => String(p[c.id.coluna as keyof P]),
    cnpjDe: c.cnpjDe,
    ...(c.registroDe && { registroDe: c.registroDe }),
    // a lista de palavras do corredor é montada no primeiro zero resultado
    async corrigir(texto) {
      await palavras();
      return corrigirEm(`${c.derivada}_palavras`, texto, PALAVRA_MINIMA);
    },
  };
}
