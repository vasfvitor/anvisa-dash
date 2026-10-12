// SQL da tabela derivada dos saneantes, sem dependências: a ilha cria a tabela no DuckDB-WASM e o build
// (páginas de empresa) no DuckDB do Node, com a mesma deduplicação e os mesmos rótulos.
import { sqlGrupoValidade } from "../../lib/consultas";

export const TABELA = "saneantes";

/**
 * san: uma linha por expediente, com situação, tipo e validade já em texto. 6 expedientes vêm em par
 * (2026-10-11), uma linha is_registrado e outra não, com o mesmo registro de 9 dígitos: fica a registrada,
 * porque o registro existe (a mesma regra de derivar.py no repo `anvisa`), e no empate a de vencimento maior.
 */
export const SQL_SAN = `CREATE OR REPLACE TABLE san AS
    SELECT nu_expediente AS id, no_produto, nu_processo, nu_cnpj_empresa, no_razao_social_empresa,
      nu_registro_produto, nu_expediente,
      CASE WHEN st_produto_ativo THEN 'Ativo' ELSE 'Inativo' END AS situacao_registro,
      CASE WHEN is_registrado THEN 'Registrado' ELSE 'Notificado' END AS tipo_regularizacao,
      strftime(dt_vencimento_produto, '%Y-%m-%d') AS dt_vencimento,
      ${sqlGrupoValidade("dt_vencimento_produto")} AS grupo,
      -- só para busca e ordenação; vencimento depois de 2100 (há até 3033) conta como 2100, sem passar à frente.
      -- Não least(): ele ignora NULL, e o "sem data" virava 2100 e ia para o topo
      if(dt_vencimento_produto > TIMESTAMP '2100-12-31', TIMESTAMP '2100-12-31', dt_vencimento_produto) AS ordem_data,
      lower(strip_accents(concat_ws(' ', no_produto, no_razao_social_empresa))) AS busca,
      lower(strip_accents(no_produto)) AS busca_nome
    FROM "${TABELA}"
    QUALIFY row_number() OVER (PARTITION BY nu_expediente ORDER BY is_registrado DESC, dt_vencimento_produto DESC NULLS LAST) = 1`;
