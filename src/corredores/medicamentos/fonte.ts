// Corredor 4, medicamentos: uma linha por registro de 9 dígitos (o produto; as apresentações de 13 dígitos
// estão na CMED). Medido em 2026-10-22 no arquivo de 2026-10-13: 36.427 produtos, 12.450 com registro ativo,
// 3.627 sem número de registro na origem (id começa com "sem-registro-"). Situação e vencimento são
// independentes: há registros ativos com vencimento passado.
import { carregar, consultar } from "../../lib/db";
import { SQL_MED, SQL_PRECOS, TABELA, TABELA_CMED } from "./consultas";
import type { Consulta } from "../../lib/detect";
import type { Fonte } from "../../lib/fonte";
import { fonteTabela, predicadoDe, type ConfigTabela } from "../../lib/fonteTabela";
import type { Trecho } from "../../lib/sql";

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

const config: ConfigTabela<Medicamento> = {
  tabela: TABELA,
  derivada: "med",
  sql: SQL_MED,
  colunas: `id, registro_produto, processo, nome, cnpj, empresa, categoria_regulatoria, classe_terapeutica,
  principio_ativo, processos, linhas, situacao_registro, tipo_regularizacao, desde, dt_vencimento, grupo`,
  id: { coluna: "id", valida: ID_MEDICAMENTO },
  cnpj: (v) => ({ sql: "(cnpj = ? OR processo = ?)", params: [v, v] }),
  // processo, registro de 9 dígitos, ou o número da caixa (13 dígitos: os 9 primeiros são o produto)
  numero: (v) => ({
    sql: "(processo = ? OR registro_produto = ? OR registro_produto = substr(?, 1, 9))",
    params: [v, v, v],
  }),
  // texto: nome, depois o princípio ativo, depois o resto (empresa)
  secundaria: "busca_principio",
  ordem: "nome, id",
  sugestoes: `CREATE OR REPLACE TABLE med_sugestoes AS
    SELECT 'empresa' AS tipo, any_value(empresa) AS rotulo,
      lower(strip_accents(any_value(empresa))) AS chave, cnpj AS nu_cnpj_empresa,
      count(*)::INTEGER AS n, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
    FROM med GROUP BY cnpj`,
  cnpjDe: (m) => m.cnpj,
  // as medidas citam o registro de 9 dígitos, como a origem dos medicamentos
  registroDe: (m) => m.registro_produto,
};

/** Condição da busca para cada modo de consulta (exportada para os testes). */
export const predicado = (q: Consulta): Trecho => predicadoDe(config, q);

export const fonte: Fonte<Medicamento> = fonteTabela(config);

/** As apresentações do produto na lista da CMED, com preço; sem a tabela no manifest, nenhuma. */
export async function precos(registroProduto: string): Promise<Preco[]> {
  await carregar(TABELA_CMED);
  return consultar<Preco>([], SQL_PRECOS, [registroProduto]);
}
