// SQL da tabela derivada dos produtos para saúde, sem dependências: a ilha cria a tabela no DuckDB-WASM e o
// build (páginas de empresa) no DuckDB do Node, com os mesmos rótulos.
import { sqlGrupoValidade } from "../../lib/consultas";

/** Uma linha por registro ou cadastro, derivada no repo `anvisa` de `produtos_saude` (uma por fabricante). */
export const TABELA = "produtos_saude_por_produto";

/**
 * ps: a tabela principal com as colunas que o cartão e a página leem. `tipo_regularizacao` é Registrado ou
 * Cadastrado, `grupo` a classe de risco (Classe I a IV): as duas facetas além da situação. A validade da
 * liberação (Em dia, Vencida, Sem data) vai à parte, para o selo, com a data do dia; os cadastros não têm
 * prazo. A lista de fabricantes vira texto com "|" (o Arrow devolve coluna de lista como vetor).
 */
export const SQL_PS = `CREATE OR REPLACE TABLE ps AS
    SELECT id, registro, processo, nome, nome_tecnico, classe_risco, cnpj, empresa, linhas,
      CASE WHEN ativo THEN 'Ativo' ELSE 'Inativo' END AS situacao_registro,
      tipo AS tipo_regularizacao,
      'Classe ' || classe_risco AS grupo,
      strftime(publicacao, '%Y-%m-%d') AS publicacao,
      strftime(vencimento, '%Y-%m-%d') AS dt_vencimento,
      ${sqlGrupoValidade("vencimento")} AS validade,
      array_to_string(fabricantes, '|') AS fabricantes,
      -- só para ordenação: sem data (os cadastros) por último
      vencimento AS ordem_data,
      lower(strip_accents(concat_ws(' ', nome, nome_tecnico, empresa))) AS busca,
      lower(strip_accents(nome)) AS busca_nome,
      lower(strip_accents(nome_tecnico)) AS busca_tecnico
    FROM "${TABELA}"`;
