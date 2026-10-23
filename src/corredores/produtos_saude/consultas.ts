// SQL da tabela derivada dos produtos para saúde, sem dependências: a ilha cria a tabela no DuckDB-WASM e o
// build (páginas de empresa) no DuckDB do Node, com os mesmos rótulos.
import { sqlGrupoValidade } from "../../lib/consultas";
import { sqlPalavras } from "../../lib/palavras";

/** Uma linha por registro ou cadastro, derivada no repo `anvisa` de `produtos_saude` (uma por fabricante). */
export const TABELA = "produtos_saude_por_produto";

/**
 * Quem fabrica os dispositivos de cada empresa: uma linha por detentora, chave do nome do fabricante (lib/chave.ts)
 * e país, derivada no repo `anvisa` de `produtos_saude`. O build lê inteira (páginas de fabricante e "Fabricado
 * por"); a ilha, só as linhas das chaves de um produto, para saber quais fabricantes têm página.
 */
export const TABELA_FABRICACAO_PS = "produtos_saude_fabricacao";

/** As linhas de produtos_saude_fabricacao como estatico/fabricantes.ts as lê, de `de`. */
export const sqlFabricacaoPsDe = (de = `"${TABELA_FABRICACAO_PS}"`) =>
  `SELECT cnpj, empresa, chave, fabricante, pais, vinculo, registros, registros_ativos AS registrosAtivos, linhas
  FROM ${de}`;

// uma lista alinhada a `fabricantes` vira texto com "|" sem perder posição: array_to_string pula os nulos
const alinhada = (coluna: string) => `array_to_string(list_transform(${coluna}, lambda x: coalesce(x, '')), '|')`;

/**
 * ps: a tabela principal com as colunas que o cartão e a página leem. `tipo_regularizacao` é Registrado ou
 * Cadastrado, `grupo` a classe de risco (Classe I a IV): as duas facetas além da situação. A validade da
 * liberação (Em dia, Vencida, Sem data) vai à parte, para o selo, com a data do dia; os cadastros não têm
 * prazo. A lista de fabricantes vira texto com "|" (o Arrow devolve coluna de lista como vetor), e as chaves e
 * os países deles também, na mesma ordem; `comChaves` falso (manifest de antes do build de dados que as
 * publica) deixa as duas vazias.
 */
export const sqlPs = (comChaves: boolean) => `CREATE OR REPLACE TABLE ps AS
    SELECT id, registro, processo, nome, nome_tecnico, classe_risco, cnpj, empresa, linhas,
      CASE WHEN ativo THEN 'Ativo' ELSE 'Inativo' END AS situacao_registro,
      tipo AS tipo_regularizacao,
      'Classe ' || classe_risco AS grupo,
      strftime(publicacao, '%Y-%m-%d') AS publicacao,
      strftime(vencimento, '%Y-%m-%d') AS dt_vencimento,
      ${sqlGrupoValidade("vencimento")} AS validade,
      array_to_string(fabricantes, '|') AS fabricantes,
      ${comChaves ? alinhada("fabricantes_chaves") : "''"} AS fabricantes_chaves,
      ${comChaves ? alinhada("fabricantes_paises") : "''"} AS fabricantes_paises,
      -- só para ordenação: sem data (os cadastros) por último
      vencimento AS ordem_data,
      ${sqlPalavras("concat_ws(' ', nome, nome_tecnico, empresa)")} AS busca,
      ${sqlPalavras("nome")} AS busca_nome,
      ${sqlPalavras("coalesce(nome_tecnico, '')")} AS busca_tecnico
    FROM "${TABELA}"`;

/** O SQL da ilha com todas as colunas (o teste ao vivo e quem lê o manifest atual). */
export const SQL_PS = sqlPs(true);
