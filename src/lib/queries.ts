// SQL da busca. Valores do usuário entram só como parâmetros; o WHERE é montado com fragmentos fixos.
// Nos dados, nome, marcas, empresa, processo e situação são iguais em todas as apresentações de um
// produto, então a busca agrupa por co_seq_produto e devolve o produto pronto numa consulta só.
import { TABELA, TABELA_DETALHE } from "./config";
import type { Consulta } from "./detect";
import { consultar, emMemoria, type Valor } from "./db";

export const POR_PAGINA = 50;

export interface Filtros {
  categoria: string;
  tipo: string;
  inativos: boolean;
}

export interface Produto {
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
  dt_vencimento_registro: string | null;
  n_apresentacoes: number;
  ap_min: number;
  ap_max: number;
  total: number;
}

export interface Apresentacao {
  co_seq_apresentacao_produto: number;
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
}

// datas saem como texto sem fuso: o tipo temporal do Arrow muda de unidade conforme a versão
const TS = (c: string) => `strftime(any_value(${c}), '%Y-%m-%dT%H:%M:%S') AS ${c}`;

function onde(q: Consulta, f: Filtros): { sql: string; params: Valor[] } {
  const partes: string[] = [];
  const params: Valor[] = [];
  if (q.modo === "cnpj") {
    // o arquivo é ordenado por CNPJ e processo: igualdade aqui lê um row group só
    partes.push("nu_cnpj_empresa = ?");
    params.push(q.valor);
  } else if (q.modo === "numero") {
    // processo (6 a 17 dígitos), registro do produto (9) ou da apresentação (13). Processo é a 2ª chave
    // de ordenação: não poda row groups, mas lê só estas três colunas.
    partes.push("(nu_processo = ? OR nu_registro_notificacao_produto = ? OR nu_registro = ?)");
    params.push(q.valor, q.valor, q.valor);
  } else {
    // contains() em vez de ILIKE: sem curingas, então % e _ digitados não precisam de escape
    partes.push(
      "contains(lower(strip_accents(concat_ws(' ', no_produto, marcas, no_razao_social_empresa))), lower(strip_accents(?)))",
    );
    params.push(q.valor);
  }
  if (!f.inativos) partes.push("situacao_registro = 'Ativo'");
  if (f.categoria) {
    partes.push("ds_categoria_produto = ?");
    params.push(f.categoria);
  }
  if (f.tipo) {
    partes.push("tipo_regularizacao = ?");
    params.push(f.tipo);
  }
  return { sql: partes.join(" AND "), params };
}

export async function buscarProdutos(q: Consulta, f: Filtros, pagina = 0): Promise<Produto[]> {
  // texto varre o arquivo todo: espera a cópia em memória. CNPJ e número seguem por Range.
  if (q.modo === "texto") await emMemoria(TABELA);
  const w = onde(q, f);
  const sql = `
    SELECT co_seq_produto,
      any_value(no_produto) AS no_produto,
      any_value(marcas) AS marcas,
      any_value(no_razao_social_empresa) AS no_razao_social_empresa,
      any_value(nu_cnpj_empresa) AS nu_cnpj_empresa,
      any_value(nu_processo) AS nu_processo,
      any_value(nu_registro_notificacao_produto) AS nu_registro_notificacao_produto,
      any_value(ds_categoria_produto) AS ds_categoria_produto,
      any_value(tipo_regularizacao) AS tipo_regularizacao,
      any_value(situacao_registro) AS situacao_registro,
      any_value(ds_situacao_assunto_doc) AS ds_situacao_assunto_doc,
      any_value(ds_alegacao_funcional) AS ds_alegacao_funcional,
      ${TS("dt_regularizacao")},
      strftime(any_value(dt_vencimento_registro), '%Y-%m-%d') AS dt_vencimento_registro,
      count(*)::INTEGER AS n_apresentacoes,
      min(co_seq_apresentacao_produto) AS ap_min,
      max(co_seq_apresentacao_produto) AS ap_max,
      (count(*) OVER ())::INTEGER AS total
    FROM "${TABELA}"
    WHERE ${w.sql}
    GROUP BY co_seq_produto
    ORDER BY any_value(situacao_registro), any_value(dt_regularizacao) DESC NULLS LAST, co_seq_produto
    LIMIT ${POR_PAGINA} OFFSET ?`;
  return (await consultar(sql, [...w.params, pagina * POR_PAGINA])) as unknown as Produto[];
}

/**
 * Apresentações de um produto com o detalhe. O arquivo de detalhe é ordenado pelo id da apresentação
 * e os ids de um produto são próximos: o BETWEEN deixa o DuckDB pular row groups pelas estatísticas
 * do Parquet, e co_produto filtra o exato.
 */
export async function buscarApresentacoes(p: Produto): Promise<Apresentacao[]> {
  // Exceção à regra dos parâmetros: com ? neste BETWEEN o duckdb-wasm não poda row groups e lê o
  // arquivo inteiro (1,5 MB); com literais lê ~1/3. Os ids vêm do nosso próprio resultado, não do
  // usuário, e só entram depois de validados como inteiros.
  const ids = [p.ap_min, p.ap_max, p.co_seq_produto];
  if (!ids.every(Number.isSafeInteger)) throw new Error("ids de apresentação inválidos");
  const [min, max, produto] = ids;
  const sql = `
    SELECT * EXCLUDE (dt_carga_etl, co_produto, nu_registro)
    FROM "${TABELA_DETALHE}"
    WHERE co_seq_apresentacao_produto BETWEEN ${min} AND ${max} AND co_produto = ${produto}
    ORDER BY TRY_CAST(nu_apresentacao_produto AS INTEGER) NULLS LAST, co_seq_apresentacao_produto`;
  return (await consultar(sql)) as unknown as Apresentacao[];
}

export interface Categoria {
  nome: string;
  ativos: number;
  total: number;
}

/** Para o filtro: produtos (não linhas) por categoria, ativos e no total. Varre o arquivo: roda sobre a cópia em memória. */
export async function categorias(): Promise<Categoria[]> {
  await emMemoria(TABELA); // varre todos os row groups, como a busca por texto
  const sql = `
    SELECT ds_categoria_produto AS nome,
      (count(DISTINCT co_seq_produto) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos,
      count(DISTINCT co_seq_produto)::INTEGER AS total
    FROM "${TABELA}"
    WHERE ds_categoria_produto IS NOT NULL
    GROUP BY 1
    ORDER BY ativos DESC, total DESC, nome`;
  return (await consultar(sql)) as unknown as Categoria[];
}
