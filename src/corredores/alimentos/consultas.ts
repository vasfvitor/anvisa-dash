// SQL das tabelas derivadas dos alimentos, sem dependências: a ilha cria a tabela no DuckDB-WASM e o build
// (páginas de empresa) no DuckDB do Node, com a mesma definição de produto.
import { TS } from "../../lib/consultas";

/**
 * Tabela principal da busca: uma linha por produto (co_seq_produto), derivada no repo `anvisa` de alimentos e
 * alimentos_resultado, com o resumo de alergênicos. A tabela crua (uma linha por apresentação) e a de
 * detalhe só entram na página do produto, para as apresentações.
 */
export const TABELA = "alimentos_por_produto";
export const TABELA_CRUA = "alimentos";
export const TABELA_DETALHE = "alimentos_resultado";

/**
 * produtos: a tabela principal com os nomes de coluna que o cartão e a página leem (os da origem da ANVISA,
 * de quando a ilha agrupava `alimentos` aqui; test/derivadas-live.test.ts confere que dá no mesmo), as listas
 * de alergênicos em texto com "|" (o Arrow devolve coluna de lista como vetor, não como array), as colunas de
 * busca já normalizadas e `grupo` = categoria.
 */
export const SQL_PRODUTOS = `CREATE OR REPLACE TABLE produtos AS
    SELECT id::INTEGER AS co_seq_produto,
      nome AS no_produto,
      marcas,
      empresa AS no_razao_social_empresa,
      cnpj AS nu_cnpj_empresa,
      processo AS nu_processo,
      registro AS nu_registro_notificacao_produto,
      categoria AS ds_categoria_produto,
      categoria AS grupo,
      tipo AS tipo_regularizacao,
      CASE WHEN ativo THEN 'Ativo' ELSE 'Inativo' END AS situacao_registro,
      situacao_assunto AS ds_situacao_assunto_doc,
      alegacao AS ds_alegacao_funcional,
      strftime(desde, '%Y-%m-%d') AS dt_regularizacao,
      ${TS("publicacao", "dt_publicacao")},
      ${TS("situacao_em", "dt_situacao")},
      ${TS("inicio_analise", "dt_inicio_analise")},
      strftime(vencimento, '%Y-%m-%d') AS dt_vencimento_registro,
      apresentacoes AS n_apresentacoes,
      gluten, lactose,
      array_to_string(contem, '|') AS contem,
      array_to_string(pode_conter, '|') AS pode_conter,
      array_to_string(nao_contem, '|') AS nao_contem,
      alergia_varia,
      -- só para busca e ordenação
      desde AS ordem_data,
      registros,
      lower(strip_accents(concat_ws(' ', nome, marcas, empresa))) AS busca,
      lower(strip_accents(nome)) AS busca_nome,
      -- ";marca a;marca b;": casa marca inteira com ';x;' e começo de marca com ';x'
      ';' || array_to_string(list_transform(string_split(coalesce(marcas, ''), ';'),
        x -> lower(strip_accents(trim(x)))), ';') || ';' AS busca_marcas
    FROM "${TABELA}"`;
