// SQL sem dependências, para a ilha (DuckDB-WASM) e o build (DuckDB do Node) usarem a mesma definição.
import { sqlPalavras } from "./palavras";

// datas saem como texto sem fuso: o tipo temporal do Arrow muda de unidade conforme a versão
export const TS = (expr: string, nome: string) => `strftime(${expr}, '%Y-%m-%dT%H:%M:%S') AS ${nome}`;

/**
 * Os certificados de boas práticas de fabricação e de distribuição (CBPF e CBPDA) de todas as áreas, um por linha,
 * derivados no repo `anvisa` de cbpf e cbpf_medicamentos; só o build das páginas de empresa lê.
 */
export const TABELA_CERTIFICADOS = "certificados";

/** A tabela de medidas de fiscalização do manifest: derivada de produtos_irregulares no repo `anvisa`. */
export const TABELA_MEDIDAS = "medidas";
/** A view sobre ela que a busca lê (SQL_MEDIDAS). */
export const MEDIDAS_BUSCA = "medidas_busca";

// o dia de hoje em Brasília, AAAA-MM-DD (o formato do en-CA)
const HOJE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/**
 * O grupo da validade da liberação (Em dia, Vencida, Sem data) de uma coluna de data, com a data do dia. A data vai
 * como literal: o current_date do DuckDB fica na extensão icu, que a ilha não baixa (db.ts, carregarExtensoes).
 */
export const sqlGrupoValidade = (coluna: string) =>
  `CASE WHEN ${coluna} IS NULL THEN 'Sem data' WHEN ${coluna} < DATE '${HOJE.format(new Date())}' THEN 'Vencida' ELSE 'Em dia' END`;

/**
 * medidas_busca: a tabela `medidas` (uma linha por dossiê × produto, de todas as áreas) como a busca lê:
 * `tipo` é o co_tipo_produto da área, as listas viram texto com "|" (o Arrow devolve coluna de lista como
 * vetor, não como array), as datas texto AAAA-MM-DD, e `busca` o nome do produto e da empresa normalizados.
 * `registros` fica lista: a busca por número usa list_contains.
 */
export const SQL_MEDIDAS = `CREATE OR REPLACE VIEW ${MEDIDAS_BUSCA} AS
    SELECT area_codigo AS tipo, dossie, produto, empresa, cnpj, pessoa, registros, processo, risco,
      array_to_string(acoes, '|') AS acoes, array_to_string(atividades, '|') AS atividades,
      strftime(primeira, '%Y-%m-%d') AS dt_primeira, strftime(ultima, '%Y-%m-%d') AS dt_ultima,
      ${sqlPalavras("concat_ws(' ', produto, empresa)")} AS busca
    FROM "${TABELA_MEDIDAS}"`;

/**
 * Totais (produtos, liberados, empresas) de uma relação, para a abertura de cada corredor. Por padrão as
 * colunas das derivadas da ilha (situacao_registro, nu_cnpj_empresa); `produtos` do manifest passa as suas.
 */
export const sqlNumeros = (de: string, { ativo = "situacao_registro = 'Ativo'", cnpj = "nu_cnpj_empresa" } = {}) =>
  `SELECT count(*)::INTEGER AS produtos, (count(*) FILTER (WHERE ${ativo}))::INTEGER AS ativos,
    count(DISTINCT ${cnpj})::INTEGER AS empresas FROM ${de}`;
