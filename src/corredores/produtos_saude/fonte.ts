// Corredor 5, produtos para saúde (dispositivos médicos): uma linha por registro ou cadastro, com os
// fabricantes juntos. Medido em 2026-10-22 no arquivo de 2026-10-13: 100.681 produtos (77.178 cadastros, sem
// prazo, e 23.503 registros com validade). A origem não tem situação: liberado é cadastro vigente ou registro
// com validade não vencida na data do arquivo (derivar.py no repo `anvisa`).
import { carregar, consultar } from "../../lib/db";
import { SQL_PS, TABELA } from "./consultas";
import type { Consulta } from "../../lib/detect";
import { ID_PRODUTO, POR_PAGINA, type Facetas, type Filtros, type Fonte } from "../../lib/fonte";
import { contarFacetas, derivar, gruposAtivos, onde, sugerirEm, termo, type Trecho } from "../../lib/sql";

export interface ProdutoSaude {
  /** o registro ou cadastro (10 ou 11 dígitos): o id na URL (?p=) */
  id: string;
  registro: string;
  processo: string | null;
  nome: string;
  nome_tecnico: string | null;
  classe_risco: string | null;
  cnpj: string;
  empresa: string;
  /** quantas linhas a origem traz (uma por fabricante) */
  linhas: number;
  situacao_registro: "Ativo" | "Inativo";
  /** Registrado ou Cadastrado */
  tipo_regularizacao: string;
  /** Classe I a IV */
  grupo: string | null;
  /** AAAA-MM-DD da publicação */
  publicacao: string | null;
  /** AAAA-MM-DD da validade do registro; nulo nos cadastros */
  dt_vencimento: string | null;
  /** Em dia, Vencida ou Sem data */
  validade: string;
  /** "nome (país)" separados por "|" */
  fabricantes: string;
  total: number;
}

function tabela(): Promise<void> {
  return derivar("ps", () => carregar(TABELA), SQL_PS);
}

function sugestoes(): Promise<void> {
  return derivar(
    "ps_sugestoes",
    tabela,
    `CREATE OR REPLACE TABLE ps_sugestoes AS
    SELECT 'empresa' AS tipo, any_value(empresa) AS rotulo,
      lower(strip_accents(any_value(empresa))) AS chave, cnpj AS nu_cnpj_empresa,
      count(*)::INTEGER AS n, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
    FROM ps GROUP BY cnpj`,
  );
}

/** Condição da busca para cada modo de consulta (exportada para os testes). */
export function predicado(q: Consulta): Trecho {
  switch (q.modo) {
    case "cnpj":
      return { sql: "(cnpj = ? OR processo = ?)", params: [q.valor, q.valor] };
    case "numero":
      // processo, ou registro de 10 ou 11 dígitos (com os zeros à esquerda que nem sempre se digita)
      return {
        sql: "(processo = ? OR ltrim(registro, '0') = ltrim(?, '0'))",
        params: [q.valor, q.valor],
      };
    case "marca":
    case "texto":
      return { sql: "contains(busca, ?)", params: [termo(q)] };
    case "todos":
      return { sql: "true", params: [] };
  }
}

const COLUNAS = `id, registro, processo, nome, nome_tecnico, classe_risco, cnpj, empresa, linhas,
  situacao_registro, tipo_regularizacao, grupo, publicacao, dt_vencimento, validade, fabricantes`;

async function buscar(q: Consulta, f: Filtros, pagina = 0): Promise<ProdutoSaude[]> {
  await tabela();
  const w = onde(predicado(q), f);
  const params = [...w.params];
  // texto: nome que começa com o termo, depois nome que contém, depois o nome técnico, depois a empresa
  let relevancia = "0";
  if (q.modo === "texto" || q.modo === "marca") {
    const t = termo(q);
    relevancia =
      "CASE WHEN starts_with(busca_nome, ?) THEN 0 WHEN contains(busca_nome, ?) THEN 1 " +
      "WHEN contains(busca_tecnico, ?) THEN 2 ELSE 3 END";
    params.unshift(t, t, t);
  }
  const sql = `
    SELECT ${COLUNAS}, (count(*) OVER ())::INTEGER AS total
    FROM (SELECT *, ${relevancia} AS relevancia FROM ps) s
    WHERE ${w.sql}
    ORDER BY relevancia, situacao_registro, nome, id
    LIMIT ${POR_PAGINA} OFFSET ?`;
  return consultar<ProdutoSaude>([], sql, [...params, pagina * POR_PAGINA]);
}

async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
  await tabela();
  return contarFacetas("ps", predicado(q), f);
}

async function porId(id: string): Promise<ProdutoSaude | null> {
  if (!ID_PRODUTO.test(id)) return null;
  await tabela();
  const [x] = await consultar<ProdutoSaude>([], `SELECT ${COLUNAS}, 1 AS total FROM ps WHERE id = ?`, [id]);
  return x ?? null;
}

export const fonte: Fonte<ProdutoSaude> = {
  preparar: tabela,
  buscar,
  facetas,
  async sugerir(texto) {
    await sugestoes();
    return sugerirEm("ps_sugestoes", texto);
  },
  porId,
  async grupos() {
    await tabela();
    return gruposAtivos("ps");
  },
  idDe: (x) => x.id,
  cnpjDe: (x) => x.cnpj,
  registroDe: (x) => x.registro,
};
