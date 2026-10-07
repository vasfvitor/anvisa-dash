// Corredor 2, saneantes (desinfetantes, detergentes, alvejantes, inseticidas…). Uma linha por processo,
// sem apresentações, marcas, categoria ou alergênicos. Medido em 2026-10-07: 144.384 linhas e 144.378
// expedientes distintos (6 registros repetidos: a tabela derivada fica com um por expediente). Situação
// e validade são independentes: há saneantes ativos com vencimento já passado e inativos com data futura.
import { carregar, consultar } from "../db";
import type { Consulta } from "../detect";
import {
  contarFacetas,
  contarNumeros,
  derivar,
  gruposAtivos,
  onde,
  POR_PAGINA,
  sugerirEm,
  termo,
  type Facetas,
  type Filtros,
  type Fonte,
  type Trecho,
} from "./comum";

const TABELA = "saneantes";

export interface Saneante {
  /** nu_expediente: o id na URL (?p=) */
  id: string;
  no_produto: string;
  nu_processo: string;
  nu_cnpj_empresa: string;
  no_razao_social_empresa: string;
  nu_registro_produto: string | null;
  nu_expediente: string;
  situacao_registro: "Ativo" | "Inativo";
  tipo_regularizacao: "Registrado" | "Notificado";
  /** AAAA-MM-DD, como publicado (há anos até 3033) */
  dt_vencimento: string | null;
  /** Em dia, Vencida ou Sem data (a validade da liberação) */
  grupo: string;
  total: number;
}

function tabela(): Promise<void> {
  return derivar(
    "san",
    () => carregar(TABELA),
    `CREATE OR REPLACE TABLE san AS
    SELECT nu_expediente AS id, no_produto, nu_processo, nu_cnpj_empresa, no_razao_social_empresa,
      nu_registro_produto, nu_expediente,
      CASE WHEN st_produto_ativo THEN 'Ativo' ELSE 'Inativo' END AS situacao_registro,
      CASE WHEN is_registrado THEN 'Registrado' ELSE 'Notificado' END AS tipo_regularizacao,
      strftime(dt_vencimento_produto, '%Y-%m-%d') AS dt_vencimento,
      CASE WHEN dt_vencimento_produto IS NULL THEN 'Sem data'
        WHEN dt_vencimento_produto < current_date THEN 'Vencida' ELSE 'Em dia' END AS grupo,
      -- só para busca e ordenação; vencimento depois de 2100 (há até 3033) não sobe para o topo
      CASE WHEN year(dt_vencimento_produto) <= 2100 THEN dt_vencimento_produto END AS ordem_data,
      lower(strip_accents(concat_ws(' ', no_produto, no_razao_social_empresa))) AS busca,
      lower(strip_accents(no_produto)) AS busca_nome
    FROM "${TABELA}"
    QUALIFY row_number() OVER (PARTITION BY nu_expediente ORDER BY dt_vencimento_produto DESC NULLS LAST) = 1`,
  );
}

function sugestoes(): Promise<void> {
  return derivar(
    "san_sugestoes",
    tabela,
    `CREATE OR REPLACE TABLE san_sugestoes AS
    SELECT 'empresa' AS tipo, any_value(no_razao_social_empresa) AS rotulo,
      lower(strip_accents(any_value(no_razao_social_empresa))) AS chave, nu_cnpj_empresa,
      count(*)::INTEGER AS n, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
    FROM san GROUP BY nu_cnpj_empresa`,
  );
}

function predicado(q: Consulta): Trecho {
  switch (q.modo) {
    case "cnpj":
      return { sql: "(nu_cnpj_empresa = ? OR nu_processo = ?)", params: [q.valor, q.valor] };
    case "numero":
      // processo, registro (9 dígitos) ou expediente (9 ou 10, com zeros à esquerda que nem sempre se digita)
      return {
        sql: "(nu_processo = ? OR nu_registro_produto = ? OR ltrim(nu_expediente, '0') = ltrim(?, '0'))",
        params: [q.valor, q.valor, q.valor],
      };
    case "marca":
    case "texto":
      return { sql: "contains(busca, ?)", params: [termo(q)] };
    case "todos":
      return { sql: "true", params: [] };
  }
}

const COLUNAS = `id, no_produto, nu_processo, nu_cnpj_empresa, no_razao_social_empresa, nu_registro_produto,
  nu_expediente, situacao_registro, tipo_regularizacao, dt_vencimento, grupo`;

async function buscar(q: Consulta, f: Filtros, pagina = 0): Promise<Saneante[]> {
  await tabela();
  const w = onde(predicado(q), f);
  const params = [...w.params];
  // texto: nome que começa com o termo, depois nome que contém, depois o resto (empresa)
  let relevancia = "0";
  if (q.modo === "texto" || q.modo === "marca") {
    const t = termo(q);
    relevancia = "CASE WHEN starts_with(busca_nome, ?) THEN 0 WHEN contains(busca_nome, ?) THEN 1 ELSE 2 END";
    params.unshift(t, t);
  }
  const sql = `
    SELECT ${COLUNAS}, (count(*) OVER ())::INTEGER AS total
    FROM (SELECT *, ${relevancia} AS relevancia FROM san) s
    WHERE ${w.sql}
    ORDER BY relevancia, situacao_registro, ordem_data DESC NULLS LAST, id
    LIMIT ${POR_PAGINA} OFFSET ?`;
  return (await consultar([], sql, [...params, pagina * POR_PAGINA])) as unknown as Saneante[];
}

async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
  await tabela();
  return contarFacetas("san", predicado(q), f);
}

async function porId(id: string): Promise<Saneante | null> {
  await tabela();
  const [s] = (await consultar([], `SELECT ${COLUNAS}, 1 AS total FROM san WHERE id = ?`, [id])) as unknown as Saneante[];
  return s ?? null;
}

export const saneantes: Fonte<Saneante> = {
  preparar: tabela,
  buscar,
  facetas,
  async sugerir(texto) {
    await sugestoes();
    return sugerirEm("san_sugestoes", texto);
  },
  porId,
  async numeros() {
    await tabela();
    return contarNumeros("san");
  },
  async grupos() {
    await tabela();
    return gruposAtivos("san");
  },
  idDe: (s) => s.id,
};
