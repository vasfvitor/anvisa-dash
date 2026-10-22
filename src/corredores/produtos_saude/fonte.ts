// Corredor 5, produtos para saúde (dispositivos médicos): uma linha por registro ou cadastro, com os
// fabricantes juntos. Medido em 2026-10-22 no arquivo de 2026-10-13: 100.681 produtos (77.178 cadastros, sem
// prazo, e 23.503 registros com validade). A origem não tem situação: liberado é cadastro vigente ou registro
// com validade não vencida na data do arquivo (derivar.py no repo `anvisa`).
import { SQL_PS, TABELA } from "./consultas";
import type { Consulta } from "../../lib/detect";
import { ID_PRODUTO, type Fonte } from "../../lib/fonte";
import { fonteTabela, predicadoDe, type ConfigTabela } from "../../lib/fonteTabela";
import type { Trecho } from "../../lib/sql";

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

const config: ConfigTabela<ProdutoSaude> = {
  tabela: TABELA,
  derivada: "ps",
  sql: SQL_PS,
  colunas: `id, registro, processo, nome, nome_tecnico, classe_risco, cnpj, empresa, linhas,
  situacao_registro, tipo_regularizacao, grupo, publicacao, dt_vencimento, validade, fabricantes`,
  id: { coluna: "id", valida: ID_PRODUTO },
  cnpj: (v) => ({ sql: "(cnpj = ? OR processo = ?)", params: [v, v] }),
  // processo, ou registro de 10 ou 11 dígitos (com os zeros à esquerda que nem sempre se digita)
  numero: (v) => ({ sql: "(processo = ? OR ltrim(registro, '0') = ltrim(?, '0'))", params: [v, v] }),
  // texto: nome, depois o nome técnico, depois o resto (empresa)
  secundaria: "busca_tecnico",
  ordem: "nome, id",
  sugestoes: `CREATE OR REPLACE TABLE ps_sugestoes AS
    SELECT 'empresa' AS tipo, any_value(empresa) AS rotulo,
      lower(strip_accents(any_value(empresa))) AS chave, cnpj AS nu_cnpj_empresa,
      count(*)::INTEGER AS n, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
    FROM ps GROUP BY cnpj`,
  cnpjDe: (x) => x.cnpj,
  registroDe: (x) => x.registro,
};

/** Condição da busca para cada modo de consulta (exportada para os testes). */
export const predicado = (q: Consulta): Trecho => predicadoDe(config, q);

export const fonte: Fonte<ProdutoSaude> = fonteTabela(config);
