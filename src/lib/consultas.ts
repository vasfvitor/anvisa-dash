// SQL sem dependências, para a ilha (DuckDB-WASM) e o build (DuckDB do Node) usarem a mesma definição.

// datas saem como texto sem fuso: o tipo temporal do Arrow muda de unidade conforme a versão
export const TS = (expr: string, nome: string) => `strftime(${expr}, '%Y-%m-%dT%H:%M:%S') AS ${nome}`;

export const TABELA_MEDIDAS = "produtos_irregulares";

/** medidas: uma linha por tipo de produto × dossiê × produto (a origem tem uma por ação e atividade). */
export const SQL_MEDIDAS = `CREATE OR REPLACE TABLE medidas AS
    SELECT co_tipo_produto AS tipo, co_seq_dossie_investig_med AS dossie, prod AS produto,
      any_value(no_empresa_investigada) AS empresa,
      -- 00000000000000 aparece como CNPJ de preenchimento: não é empresa nenhuma
      any_value(nu_cnpj_empresa_investigada) FILTER (WHERE regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{14}') AND nu_cnpj_empresa_investigada <> '00000000000000') AS cnpj,
      coalesce(bool_or(regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{11}')), false) AS pessoa,
      any_value(nullif(regexp_replace(registro, '[^0-9]', '', 'g'), '')) AS registro,
      any_value(nu_processo) AS processo, any_value(ds_risco_produto) AS risco,
      -- listas viram texto: o Arrow devolve coluna de lista como vetor, não como array
      array_to_string(list_sort(list(DISTINCT ds_acao_fiscalizacao) FILTER (WHERE ds_acao_fiscalizacao IS NOT NULL)), '|') AS acoes,
      array_to_string(list_sort(list(DISTINCT ds_atividade_fiscalizacao) FILTER (WHERE ds_atividade_fiscalizacao IS NOT NULL)), '|') AS atividades,
      strftime(min(dt_publicacao), '%Y-%m-%d') AS dt_primeira, strftime(max(dt_publicacao), '%Y-%m-%d') AS dt_ultima,
      lower(strip_accents(concat_ws(' ', prod, any_value(no_empresa_investigada)))) AS busca
    FROM (SELECT *, trim(produto) AS prod FROM "${TABELA_MEDIDAS}") WHERE coalesce(prod, '') <> ''
    GROUP BY co_tipo_produto, co_seq_dossie_investig_med, prod`;

/** Totais de uma tabela derivada (com situacao_registro e nu_cnpj_empresa), para a abertura de cada corredor. */
export const sqlNumeros = (tabela: string) =>
  `SELECT count(*)::INTEGER AS produtos, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos,
    count(DISTINCT nu_cnpj_empresa)::INTEGER AS empresas FROM ${tabela}`;
