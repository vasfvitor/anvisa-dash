// SQL das tabelas derivadas dos alimentos, sem dependências: a ilha cria a tabela no DuckDB-WASM e o build
// (páginas de empresa) no DuckDB do Node, com a mesma definição de produto.
import { TS } from "../../lib/consultas";

/** Tabela principal da busca e a de detalhe por apresentação, no manifest. */
export const TABELA = "alimentos";
export const TABELA_DETALHE = "alimentos_resultado";

/**
 * produtos: uma linha por co_seq_produto (nome, marcas, empresa, processo e situação são iguais em todas
 * as apresentações), com colunas de busca já normalizadas e `grupo` = categoria.
 */
export const SQL_PRODUTOS = `CREATE OR REPLACE TABLE produtos AS
    SELECT co_seq_produto,
      any_value(no_produto) AS no_produto,
      any_value(marcas) AS marcas,
      any_value(no_razao_social_empresa) AS no_razao_social_empresa,
      any_value(nu_cnpj_empresa) AS nu_cnpj_empresa,
      any_value(nu_processo) AS nu_processo,
      any_value(nu_registro_notificacao_produto) AS nu_registro_notificacao_produto,
      any_value(ds_categoria_produto) AS ds_categoria_produto,
      any_value(ds_categoria_produto) AS grupo,
      any_value(tipo_regularizacao) AS tipo_regularizacao,
      any_value(situacao_registro) AS situacao_registro,
      any_value(ds_situacao_assunto_doc) AS ds_situacao_assunto_doc,
      any_value(ds_alegacao_funcional) AS ds_alegacao_funcional,
      ${TS("min(dt_regularizacao)", "dt_regularizacao")},
      ${TS("max(dt_publicacao)", "dt_publicacao")},
      ${TS("max(dt_situacao)", "dt_situacao")},
      ${TS("min(dt_inicio_analise)", "dt_inicio_analise")},
      strftime(any_value(dt_vencimento_registro), '%Y-%m-%d') AS dt_vencimento_registro,
      count(*)::INTEGER AS n_apresentacoes,
      -- só para busca e ordenação
      min(dt_regularizacao) AS ordem_data,
      list(nu_registro) FILTER (WHERE nu_registro IS NOT NULL) AS registros,
      lower(strip_accents(concat_ws(' ', any_value(no_produto), any_value(marcas), any_value(no_razao_social_empresa)))) AS busca,
      lower(strip_accents(any_value(no_produto))) AS busca_nome,
      -- ";marca a;marca b;": casa marca inteira com ';x;' e começo de marca com ';x'
      ';' || array_to_string(list_transform(string_split(coalesce(any_value(marcas), ''), ';'),
        x -> lower(strip_accents(trim(x)))), ';') || ';' AS busca_marcas
    FROM "${TABELA}"
    GROUP BY co_seq_produto`;
