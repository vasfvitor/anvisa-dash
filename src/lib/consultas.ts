// SQL sem dependências, para a ilha (DuckDB-WASM) e o build (DuckDB do Node) usarem a mesma definição.

// datas saem como texto sem fuso: o tipo temporal do Arrow muda de unidade conforme a versão
export const TS = (expr: string, nome: string) => `strftime(${expr}, '%Y-%m-%dT%H:%M:%S') AS ${nome}`;

/** A tabela de medidas de fiscalização do manifest: derivada de produtos_irregulares no repo `anvisa`. */
export const TABELA_MEDIDAS = "medidas";

/** O grupo da validade da liberação (Em dia, Vencida, Sem data) de uma coluna de data, com a data do dia. */
export const sqlGrupoValidade = (coluna: string) =>
  `CASE WHEN ${coluna} IS NULL THEN 'Sem data' WHEN ${coluna} < current_date THEN 'Vencida' ELSE 'Em dia' END`;

/**
 * medidas_busca: a tabela `medidas` (uma linha por dossiê × produto, de todas as áreas) como a busca lê:
 * `tipo` é o co_tipo_produto da área, as listas viram texto com "|" (o Arrow devolve coluna de lista como
 * vetor, não como array), as datas texto AAAA-MM-DD, e `busca` o nome do produto e da empresa normalizados.
 * `registros` fica lista: a busca por número usa list_contains. Até 2026-10-11 a ilha e o build derivavam
 * isto de produtos_irregulares (80 mil linhas); test/derivadas-live.test.ts confere que a tabela do manifest
 * dá as mesmas linhas.
 */
export const SQL_MEDIDAS = `CREATE OR REPLACE VIEW medidas_busca AS
    SELECT area_codigo AS tipo, dossie, produto, empresa, cnpj, pessoa, registros, processo, risco,
      array_to_string(acoes, '|') AS acoes, array_to_string(atividades, '|') AS atividades,
      strftime(primeira, '%Y-%m-%d') AS dt_primeira, strftime(ultima, '%Y-%m-%d') AS dt_ultima,
      lower(strip_accents(concat_ws(' ', produto, empresa))) AS busca
    FROM "${TABELA_MEDIDAS}"`;

/** Totais de uma tabela derivada (com situacao_registro e nu_cnpj_empresa), para a abertura de cada corredor. */
export const sqlNumeros = (tabela: string) =>
  `SELECT count(*)::INTEGER AS produtos, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos,
    count(DISTINCT nu_cnpj_empresa)::INTEGER AS empresas FROM ${tabela}`;
