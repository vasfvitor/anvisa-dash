// Corredor 3, cosméticos (higiene pessoal, cosméticos e perfumes). Medido em 2026-10-09: 1.204.980 linhas,
// 1.193.836 processos e 5.246 CNPJs, 24 MB de Parquet: grande demais para baixar inteiro como os outros
// corredores. Cada busca baixa só os pedaços que precisa (lib/fonteIndice.ts e lib/indice.ts) e monta uma
// tabela pequena com eles, sobre a qual valem o mesmo SQL de filtros, facetas e relevância dos outros corredores.
import { COLUNAS_LINHA, sqlCos, TABELA } from "./consultas";
import { meta } from "./meta";
import { ID_PRODUTO, type Fonte } from "../../lib/fonte";
import { fonteIndice } from "../../lib/fonteIndice";

export interface Cosmetico {
  /** nu_processo: o id na URL (?p=) */
  id: string;
  no_produto: string;
  nu_processo: string;
  nu_cnpj_empresa: string;
  no_razao_social_empresa: string | null;
  nu_registro: string | null;
  situacao_registro: "Ativo" | "Inativo";
  /** Registrado, Notificado, Isento de registro ou Descartável */
  tipo_regularizacao: string;
  /** AAAA-MM-DD, como publicado */
  dt_vencimento: string | null;
  /** Em dia, Vencida ou Sem data (a validade da liberação) */
  grupo: string;
  total: number;
}

export const fonte: Fonte<Cosmetico> = fonteIndice<Cosmetico>({
  tabela: TABELA,
  derivada: "cos",
  linha: { colunas: COLUNAS_LINHA, nome: "no_produto" },
  sql: sqlCos,
  colunas: `id, no_produto, nu_processo, nu_cnpj_empresa, no_razao_social_empresa, nu_registro, situacao_registro,
  tipo_regularizacao, dt_vencimento, grupo`,
  id: { coluna: "id", valida: ID_PRODUTO },
  palavraMinima: meta.palavraMinima ?? 3,
  ordem: "ordem_data DESC NULLS LAST, id",
  cnpjDe: (c) => c.nu_cnpj_empresa,
  registroDe: (c) => c.nu_registro,
});
