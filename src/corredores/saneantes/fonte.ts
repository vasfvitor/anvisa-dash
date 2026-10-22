// Corredor 2, saneantes (desinfetantes, detergentes, alvejantes, inseticidas…). Uma linha por processo,
// sem apresentações, marcas, categoria ou alergênicos. Medido em 2026-10-07: 144.384 linhas e 144.378
// expedientes distintos (6 registros repetidos: a tabela derivada fica com um por expediente). Situação
// e validade são independentes: há saneantes ativos com vencimento já passado e inativos com data futura.
import { SQL_SAN, TABELA } from "./consultas";
import type { Consulta } from "../../lib/detect";
import { ID_PRODUTO, type Fonte } from "../../lib/fonte";
import { fonteTabela, predicadoDe, type ConfigTabela } from "../../lib/fonteTabela";
import type { Trecho } from "../../lib/sql";

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

const config: ConfigTabela<Saneante> = {
  tabela: TABELA,
  derivada: "san",
  sql: SQL_SAN,
  colunas: `id, no_produto, nu_processo, nu_cnpj_empresa, no_razao_social_empresa, nu_registro_produto,
  nu_expediente, situacao_registro, tipo_regularizacao, dt_vencimento, grupo`,
  id: { coluna: "id", valida: ID_PRODUTO },
  // 400 processos antigos também têm 14 dígitos
  cnpj: (v) => ({ sql: "(nu_cnpj_empresa = ? OR nu_processo = ?)", params: [v, v] }),
  // processo, registro (9 dígitos) ou expediente (9 ou 10, com zeros à esquerda que nem sempre se digita)
  numero: (v) => ({
    sql: "(nu_processo = ? OR nu_registro_produto = ? OR ltrim(nu_expediente, '0') = ltrim(?, '0'))",
    params: [v, v, v],
  }),
  // texto: nome, depois o resto (empresa)
  ordem: "ordem_data DESC NULLS LAST, id",
  sugestoes: `CREATE OR REPLACE TABLE san_sugestoes AS
    SELECT 'empresa' AS tipo, any_value(no_razao_social_empresa) AS rotulo,
      lower(strip_accents(any_value(no_razao_social_empresa))) AS chave, nu_cnpj_empresa,
      count(*)::INTEGER AS n, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
    FROM san GROUP BY nu_cnpj_empresa`,
  cnpjDe: (s) => s.nu_cnpj_empresa,
  registroDe: (s) => s.nu_registro_produto,
};

/** Condição da busca para cada modo de consulta (exportada para os testes). */
export const predicado = (q: Consulta): Trecho => predicadoDe(config, q);

export const fonte: Fonte<Saneante> = fonteTabela(config);
