// SQL dos cosméticos sem dependências: a ilha aplica sobre os pedaços baixados para cada busca (fonte.ts) e o
// build (páginas de empresa) sobre a tabela inteira no DuckDB do Node, com a mesma deduplicação e os mesmos
// rótulos.

export const TABELA = "cosmeticos";

/** As colunas de uma linha nos arquivos de busca (SPEC.md do repo `anvisa`), iguais às do Parquet inteiro. */
export const COLUNAS_LINHA = `nu_processo, no_produto, nu_cnpj_empresa, dt_vencimento, st_situacao_produto,
  nu_registro, ds_tipo_peticao, st_registrado`;

/**
 * Os produtos, um por processo, a partir de `origem`: uma relação com COLUNAS_LINHA e
 * no_razao_social_empresa. Medido em 2026-10-09: 11.144 processos aparecem duas vezes, uma por
 * st_registrado, com o mesmo nome e o mesmo registro; fica a linha com st_registrado falso, que é a que
 * traz o tipo da petição e, nos pares em que só uma tem vencimento, a data futura. Regra provisória até
 * conferir na consulta da ANVISA (fora do ar quando isto foi escrito).
 */
export function sqlCos(origem: string): string {
  return `SELECT nu_processo AS id, no_produto, nu_processo, nu_cnpj_empresa, no_razao_social_empresa, nu_registro,
      CASE WHEN st_situacao_produto THEN 'Ativo' ELSE 'Inativo' END AS situacao_registro,
      CASE WHEN st_registrado OR ds_tipo_peticao = 'REGISTRO' THEN 'Registrado'
        WHEN ds_tipo_peticao = 'Notificado' THEN 'Notificado'
        WHEN ds_tipo_peticao = 'ISENTO DE REGISTRO' THEN 'Isento de registro'
        WHEN ds_tipo_peticao = 'DESCARTAVEL' THEN 'Descartável'
        ELSE ds_tipo_peticao END AS tipo_regularizacao,
      strftime(dt_vencimento, '%Y-%m-%d') AS dt_vencimento,
      CASE WHEN dt_vencimento IS NULL THEN 'Sem data'
        WHEN dt_vencimento < current_date THEN 'Vencida' ELSE 'Em dia' END AS grupo,
      -- só para ordenar; vencimento depois de 2100 conta como 2100, sem passar à frente (sem data fica NULL:
      -- least() ignoraria o NULL e o poria no topo)
      if(dt_vencimento > TIMESTAMP '2100-12-31', TIMESTAMP '2100-12-31', dt_vencimento) AS ordem_data,
      lower(strip_accents(no_produto)) AS busca_nome
    FROM ${origem}
    QUALIFY row_number() OVER (PARTITION BY nu_processo ORDER BY st_registrado) = 1`;
}
