// Corredor 4, medicamentos: uma linha por registro de 9 dígitos (o produto; as apresentações de 13 dígitos
// estão na CMED). Medido em 2026-10-22 no arquivo de 2026-10-13: 36.427 produtos, 12.450 com registro ativo,
// 3.627 sem número de registro na origem (id começa com "sem-registro-"). Situação e vencimento são
// independentes: há registros ativos com vencimento passado.
import { carregar, consultar } from "../../lib/db";
import { SQL_MED, SQL_PRECOS, TABELA, TABELA_CMED } from "./consultas";
import type { Consulta } from "../../lib/detect";
import { POR_PAGINA, type Facetas, type Filtros, type Fonte } from "../../lib/fonte";
import { contarFacetas, derivar, gruposAtivos, onde, sugerirEm, termo, type Trecho } from "../../lib/sql";

export interface Medicamento {
  /** registro de 9 dígitos, ou sem-registro-<hash>: o id na URL (?p=) */
  id: string;
  registro_produto: string | null;
  processo: string | null;
  nome: string;
  cnpj: string;
  empresa: string;
  categoria_regulatoria: string | null;
  classe_terapeutica: string | null;
  principio_ativo: string | null;
  /** quantos processos e linhas a origem traz para o produto */
  processos: number;
  linhas: number;
  situacao_registro: "Ativo" | "Inativo";
  /** a categoria regulatória, ou "Sem categoria" */
  tipo_regularizacao: string;
  /** AAAA-MM-DD da concessão mais antiga */
  desde: string | null;
  /** AAAA-MM-DD do vencimento (precisão de mês) */
  dt_vencimento: string | null;
  grupo: string | null;
  total: number;
}

/** Uma apresentação na lista da CMED; preços em centavos. */
export interface Preco {
  ggrem: string;
  apresentacao: string | null;
  ean_1: string | null;
  regime_preco: string | null;
  tipo_produto: string | null;
  restricao_hospitalar: boolean | null;
  pf_0: number | null;
  pf_18: number | null;
  pmc_0: number | null;
  pmc_18: number | null;
  pmc_asterisco: boolean | null;
  comercializacao: boolean | null;
  comercializacao_periodo: string | null;
  publicado_em: string | null;
}

/** Ids de medicamento: o registro de 9 dígitos, ou o id estável de quem não tem registro. */
export const ID_MEDICAMENTO = /^(\d{1,11}|sem-registro-[0-9a-f]{12})$/;

function tabela(): Promise<void> {
  return derivar("med", () => carregar(TABELA), SQL_MED);
}

function sugestoes(): Promise<void> {
  return derivar(
    "med_sugestoes",
    tabela,
    `CREATE OR REPLACE TABLE med_sugestoes AS
    SELECT 'empresa' AS tipo, any_value(empresa) AS rotulo,
      lower(strip_accents(any_value(empresa))) AS chave, cnpj AS nu_cnpj_empresa,
      count(*)::INTEGER AS n, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
    FROM med GROUP BY cnpj`,
  );
}

/** Condição da busca para cada modo de consulta (exportada para os testes). */
export function predicado(q: Consulta): Trecho {
  switch (q.modo) {
    case "cnpj":
      return { sql: "(cnpj = ? OR processo = ?)", params: [q.valor, q.valor] };
    case "numero":
      // processo, registro de 9 dígitos, ou o número da caixa (13 dígitos: os 9 primeiros são o produto)
      return {
        sql: "(processo = ? OR registro_produto = ? OR registro_produto = substr(?, 1, 9))",
        params: [q.valor, q.valor, q.valor],
      };
    case "marca":
    case "texto":
      return { sql: "contains(busca, ?)", params: [termo(q)] };
    case "todos":
      return { sql: "true", params: [] };
  }
}

const COLUNAS = `id, registro_produto, processo, nome, cnpj, empresa, categoria_regulatoria, classe_terapeutica,
  principio_ativo, processos, linhas, situacao_registro, tipo_regularizacao, desde, dt_vencimento, grupo`;

async function buscar(q: Consulta, f: Filtros, pagina = 0): Promise<Medicamento[]> {
  await tabela();
  const w = onde(predicado(q), f);
  const params = [...w.params];
  // texto: nome que começa com o termo, depois nome que contém, depois o princípio ativo, depois a empresa
  let relevancia = "0";
  if (q.modo === "texto" || q.modo === "marca") {
    const t = termo(q);
    relevancia =
      "CASE WHEN starts_with(busca_nome, ?) THEN 0 WHEN contains(busca_nome, ?) THEN 1 " +
      "WHEN contains(busca_principio, ?) THEN 2 ELSE 3 END";
    params.unshift(t, t, t);
  }
  const sql = `
    SELECT ${COLUNAS}, (count(*) OVER ())::INTEGER AS total
    FROM (SELECT *, ${relevancia} AS relevancia FROM med) s
    WHERE ${w.sql}
    ORDER BY relevancia, situacao_registro, nome, id
    LIMIT ${POR_PAGINA} OFFSET ?`;
  return consultar<Medicamento>([], sql, [...params, pagina * POR_PAGINA]);
}

async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
  await tabela();
  return contarFacetas("med", predicado(q), f);
}

async function porId(id: string): Promise<Medicamento | null> {
  if (!ID_MEDICAMENTO.test(id)) return null;
  await tabela();
  const [m] = await consultar<Medicamento>([], `SELECT ${COLUNAS}, 1 AS total FROM med WHERE id = ?`, [id]);
  return m ?? null;
}

/** As apresentações do produto na lista da CMED, com preço; sem a tabela no manifest, nenhuma. */
export async function precos(registroProduto: string): Promise<Preco[]> {
  await carregar(TABELA_CMED);
  return consultar<Preco>([], SQL_PRECOS, [registroProduto]);
}

export const fonte: Fonte<Medicamento> = {
  preparar: tabela,
  buscar,
  facetas,
  async sugerir(texto) {
    await sugestoes();
    return sugerirEm("med_sugestoes", texto);
  },
  porId,
  async grupos() {
    await tabela();
    return gruposAtivos("med");
  },
  idDe: (m) => m.id,
  cnpjDe: (m) => m.cnpj,
  // as medidas citam o registro de 9 dígitos, como a origem dos medicamentos
  registroDe: (m) => m.registro_produto,
};
