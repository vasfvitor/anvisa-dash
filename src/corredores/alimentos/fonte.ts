// Corredor 1, alimentos e suplementos. A lista lê só alimentos_por_produto (uma linha por produto, com o
// resumo de alergênicos, 2,8 MB); dela saem duas tabelas derivadas por build:
// - produtos: a mesma tabela com os nomes de coluna que o cartão e a página leem, as colunas de busca já
//   normalizadas e `grupo` = categoria;
// - sugestoes: marcas e empresas com a contagem de produtos, para sugerir enquanto a pessoa digita.
// As apresentações de um produto (página do produto) leem as tabelas crua e de detalhe, baixadas na primeira vez.
import type { ColunasAlergia } from "./alergia";
import { SQL_PRODUTOS, TABELA, TABELA_CRUA, TABELA_DETALHE } from "./consultas";
import { consultar } from "../../lib/db";
import type { Consulta } from "../../lib/detect";
import { ID_PRODUTO, type Fonte } from "../../lib/fonte";
import { fonteTabela, predicadoDe, type ConfigTabela } from "../../lib/fonteTabela";
import type { Trecho } from "../../lib/sql";

export interface Produto extends ColunasAlergia {
  co_seq_produto: number;
  no_produto: string;
  marcas: string | null;
  no_razao_social_empresa: string;
  nu_cnpj_empresa: string;
  nu_processo: string;
  nu_registro_notificacao_produto: string | null;
  ds_categoria_produto: string | null;
  tipo_regularizacao: string;
  situacao_registro: string;
  ds_situacao_assunto_doc: string | null;
  ds_alegacao_funcional: string | null;
  dt_regularizacao: string | null;
  dt_publicacao: string | null;
  dt_situacao: string | null;
  dt_inicio_analise: string | null;
  dt_vencimento_registro: string | null;
  n_apresentacoes: number;
  total: number;
}

export interface Apresentacao {
  co_seq_apresentacao_produto: number;
  nu_registro: string | null;
  nu_apresentacao_produto: string | null;
  validade: string | null;
  ds_forma_fisica: string | null;
  situacao_apresentacao: string | null;
  material_embalagens: string | null;
  tipo_embalagens: string | null;
  empresas_envasadoras: string | null;
  empresas_internacionais: string | null;
  grupos_populacionais: string | null;
  vias_administracao: string | null;
  tabela_nutricional: string | null;
  intolerancias: string | null;
  alergenicos: string | null;
  /** false para as poucas apresentações que a ANVISA ainda não publicou no arquivo de detalhes */
  tem_detalhe: boolean;
}

const config: ConfigTabela<Produto> = {
  tabela: TABELA,
  derivada: "produtos",
  sql: SQL_PRODUTOS,
  colunas: `co_seq_produto, no_produto, marcas, no_razao_social_empresa, nu_cnpj_empresa, nu_processo,
  nu_registro_notificacao_produto, ds_categoria_produto, tipo_regularizacao, situacao_registro,
  ds_situacao_assunto_doc, ds_alegacao_funcional, dt_regularizacao, dt_publicacao, dt_situacao,
  dt_inicio_analise, dt_vencimento_registro, n_apresentacoes,
  gluten, lactose, contem, pode_conter, nao_contem, alergia_varia`,
  id: { coluna: "co_seq_produto", valida: ID_PRODUTO, numerico: true },
  // 400 processos antigos também têm 14 dígitos
  cnpj: (v) => ({ sql: "(nu_cnpj_empresa = ? OR nu_processo = ?)", params: [v, v] }),
  // processo (6 a 17 dígitos), registro do produto (9) ou da apresentação (13)
  numero: (v) => ({
    sql: "(nu_processo = ? OR nu_registro_notificacao_produto = ? OR list_contains(registros, ?))",
    params: [v, v, v],
  }),
  // a marca escolhida numa sugestão casa inteira
  marca: (t) => ({ sql: "contains(busca_marcas, ';' || ? || ';')", params: [t] }),
  // texto: nome, depois as marcas, depois o resto (empresa)
  secundaria: "busca_marcas_palavras",
  ordem: "ordem_data DESC NULLS LAST, co_seq_produto",
  sugestoes: `CREATE OR REPLACE TABLE produtos_sugestoes AS
    WITH m AS (
      SELECT trim(unnest(string_split(marcas, ';'))) AS rotulo, situacao_registro, co_seq_produto
      FROM produtos WHERE marcas IS NOT NULL
    )
    SELECT 'marca' AS tipo, mode(rotulo) AS rotulo, lower(strip_accents(rotulo)) AS chave,
      NULL::VARCHAR AS nu_cnpj_empresa,
      count(DISTINCT co_seq_produto)::INTEGER AS n,
      (count(DISTINCT co_seq_produto) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
    FROM m WHERE rotulo <> '' GROUP BY chave
    UNION ALL
    SELECT 'empresa', any_value(no_razao_social_empresa), lower(strip_accents(any_value(no_razao_social_empresa))),
      nu_cnpj_empresa, count(*)::INTEGER, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER
    FROM produtos GROUP BY nu_cnpj_empresa`,
  cnpjDe: (p) => p.nu_cnpj_empresa,
};

/** Condição da busca para cada modo de consulta (exportada para os testes). */
export const predicado = (q: Consulta): Trecho => predicadoDe(config, q);

export const fonte: Fonte<Produto> = fonteTabela(config);

/**
 * Apresentações de um produto com o detalhe (co_produto do detalhe é o co_seq_produto). As duas tabelas (uma
 * linha por apresentação, 3,3 MB, e o detalhe, 1,7 MB) só baixam aqui, na primeira página de produto aberta.
 */
export async function buscarApresentacoes(id: number): Promise<Apresentacao[]> {
  const sql = `
    SELECT a.co_seq_apresentacao_produto, a.nu_registro, r.nu_apresentacao_produto, r.validade,
      r.ds_forma_fisica, r.situacao_apresentacao, r.material_embalagens, r.tipo_embalagens,
      r.empresas_envasadoras, r.empresas_internacionais, r.grupos_populacionais, r.vias_administracao,
      r.tabela_nutricional, r.intolerancias, r.alergenicos, r.co_seq_apresentacao_produto IS NOT NULL AS tem_detalhe
    FROM "${TABELA_CRUA}" a LEFT JOIN "${TABELA_DETALHE}" r USING (co_seq_apresentacao_produto)
    WHERE a.co_seq_produto = ?
    ORDER BY TRY_CAST(r.nu_apresentacao_produto AS INTEGER) NULLS LAST, a.co_seq_apresentacao_produto`;
  return consultar<Apresentacao>([TABELA_CRUA, TABELA_DETALHE], sql, [id]);
}
