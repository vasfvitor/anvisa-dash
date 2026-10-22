// SQL da tabela derivada dos medicamentos, sem dependências: a ilha cria a tabela no DuckDB-WASM e o build
// (páginas de empresa) no DuckDB do Node, com os mesmos rótulos.

/** Uma linha por medicamento (registro de 9 dígitos), derivada no repo `anvisa` de `medicamentos`. */
export const TABELA = "medicamentos_por_produto";
/** A lista de preços da CMED, uma linha por apresentação; junta pelo registro de 9 dígitos. */
export const TABELA_CMED = "cmed";

/**
 * med: a tabela principal com as colunas que o cartão e a página leem. `tipo_regularizacao` é a categoria
 * regulatória (Genérico, Similar, Novo…), `grupo` a classe terapêutica: as duas facetas além da situação. As
 * datas saem como texto AAAA-MM-DD (o tipo temporal do Arrow muda de unidade conforme a versão).
 */
export const SQL_MED = `CREATE OR REPLACE TABLE med AS
    SELECT id, registro_produto, processo, nome, cnpj, empresa,
      categoria_regulatoria, classe_terapeutica, principio_ativo, processos, linhas,
      CASE WHEN ativo THEN 'Ativo' ELSE 'Inativo' END AS situacao_registro,
      coalesce(categoria_regulatoria, 'Sem categoria') AS tipo_regularizacao,
      classe_terapeutica AS grupo,
      strftime(desde, '%Y-%m-%d') AS desde,
      strftime(vencimento, '%Y-%m-%d') AS dt_vencimento,
      -- só para ordenação: sem data por último
      vencimento AS ordem_data,
      lower(strip_accents(concat_ws(' ', nome, principio_ativo, empresa))) AS busca,
      lower(strip_accents(nome)) AS busca_nome,
      lower(strip_accents(coalesce(principio_ativo, ''))) AS busca_principio
    FROM "${TABELA}"`;

/** Os preços de um medicamento na CMED, uma linha por apresentação; `cmed` entra na view só quando há. */
export const SQL_PRECOS = `SELECT ggrem, apresentacao, ean_1, regime_preco, tipo_produto, restricao_hospitalar,
      pf_0, pf_18, pmc_0, pmc_18, pmc_asterisco, comercializacao, comercializacao_periodo,
      strftime(publicado_em, '%Y-%m-%d') AS publicado_em
    FROM "${TABELA_CMED}" WHERE registro_produto = ? ORDER BY apresentacao, ggrem`;
