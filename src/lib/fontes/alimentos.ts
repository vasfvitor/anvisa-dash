// Corredor 1, alimentos e suplementos. Depois do download, três tabelas derivadas por build:
// - produtos: uma linha por co_seq_produto (nome, marcas, empresa, processo e situação são iguais em
//   todas as apresentações), com colunas de busca já normalizadas e `grupo` = categoria;
// - resumo: alergênicos e intolerâncias de cada produto, da tabela de detalhes (chega depois: a busca
//   não espera por ela; os cartões pedem o resumo dos produtos listados com resumosDe);
// - sugestoes: marcas e empresas com a contagem de produtos, para sugerir enquanto a pessoa digita.
import { deJson, resumirAlergia, type ResumoAlergia } from "../alergia";
import { TABELA, TABELA_DETALHE } from "../config";
import { carregar, consultar } from "../db";
import type { Consulta } from "../detect";
import {
  contarFacetas,
  contarNumeros,
  derivar,
  gruposAtivos,
  onde,
  POR_PAGINA,
  sugerirEm,
  termo,
  TS,
  type Facetas,
  type Filtros,
  type Fonte,
  type Trecho,
} from "./comum";

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

// ---------------------------------------------------------------------------------------------
// tabelas derivadas

function produtos(): Promise<void> {
  return derivar(
    "produtos",
    () => carregar(TABELA),
    `CREATE OR REPLACE TABLE produtos AS
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
    GROUP BY co_seq_produto`,
  );
}

function resumo(): Promise<void> {
  return derivar(
    "resumo",
    () => carregar(TABELA_DETALHE),
    `CREATE OR REPLACE TABLE resumo AS
    SELECT co_produto AS co_seq_produto,
      to_json(list(DISTINCT alergenicos) FILTER (WHERE alergenicos <> ''))::VARCHAR AS alergenicos_json,
      to_json(list(DISTINCT intolerancias) FILTER (WHERE intolerancias <> ''))::VARCHAR AS intolerancias_json
    FROM "${TABELA_DETALHE}"
    GROUP BY co_produto`,
  );
}

function sugestoes(): Promise<void> {
  return derivar(
    "sugestoes",
    produtos,
    `CREATE OR REPLACE TABLE sugestoes AS
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
  );
}

// ---------------------------------------------------------------------------------------------
// busca

function predicado(q: Consulta): Trecho {
  switch (q.modo) {
    case "cnpj":
      // 400 processos antigos também têm 14 dígitos
      return { sql: "(nu_cnpj_empresa = ? OR nu_processo = ?)", params: [q.valor, q.valor] };
    case "numero":
      // processo (6 a 17 dígitos), registro do produto (9) ou da apresentação (13)
      return {
        sql: "(nu_processo = ? OR nu_registro_notificacao_produto = ? OR list_contains(registros, ?))",
        params: [q.valor, q.valor, q.valor],
      };
    case "marca":
      return { sql: "contains(busca_marcas, ';' || ? || ';')", params: [termo(q)] };
    case "texto":
      // contains() em vez de ILIKE: sem curingas, então % e _ digitados não precisam de escape
      return { sql: "contains(busca, ?)", params: [termo(q)] };
    case "todos":
      return { sql: "true", params: [] };
  }
}

const COLUNAS = `co_seq_produto, no_produto, marcas, no_razao_social_empresa, nu_cnpj_empresa, nu_processo,
  nu_registro_notificacao_produto, ds_categoria_produto, tipo_regularizacao, situacao_registro,
  ds_situacao_assunto_doc, ds_alegacao_funcional, dt_regularizacao, dt_publicacao, dt_situacao,
  dt_inicio_analise, dt_vencimento_registro, n_apresentacoes`;

async function buscar(q: Consulta, f: Filtros, pagina = 0): Promise<Produto[]> {
  await produtos();
  const w = onde(predicado(q), f);
  const params = [...w.params];
  // texto: marca exata, depois marca que começa com o termo, depois nome, depois o resto (empresa)
  let relevancia = "0";
  if (q.modo === "texto") {
    const t = termo(q);
    relevancia = `CASE WHEN contains(busca_marcas, ';' || ? || ';') THEN 0
      WHEN contains(busca_marcas, ';' || ?) THEN 1 WHEN contains(busca_nome, ?) THEN 2 ELSE 3 END`;
    params.unshift(t, t, t);
  }
  const sql = `
    SELECT ${COLUNAS}, (count(*) OVER ())::INTEGER AS total
    FROM (SELECT *, ${relevancia} AS relevancia FROM produtos) p
    WHERE ${w.sql}
    ORDER BY relevancia, situacao_registro, ordem_data DESC NULLS LAST, co_seq_produto
    LIMIT ${POR_PAGINA} OFFSET ?`;
  return (await consultar([], sql, [...params, pagina * POR_PAGINA])) as unknown as Produto[];
}

async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
  await produtos();
  return contarFacetas("produtos", predicado(q), f);
}

async function porId(id: string): Promise<Produto | null> {
  await produtos();
  const sql = `SELECT ${COLUNAS}, 1 AS total FROM produtos WHERE co_seq_produto = ?`;
  const [p] = (await consultar([], sql, [Number(id)])) as unknown as Produto[];
  return p ?? null;
}

/**
 * Resumo de alergênicos dos produtos pedidos. Espera a tabela de detalhes (baixada em segundo plano
 * desde o início) e só consulta os ids da tela, em vez de juntar o resumo em toda busca.
 */
async function resumosDe(ids: string[]): Promise<Map<string, ResumoAlergia>> {
  // ids vêm dos resultados do próprio app, não do usuário: entram como literais depois de validados
  const validos = ids.map(Number).filter(Number.isSafeInteger);
  if (!validos.length) return new Map();
  await resumo();
  const linhas = (await consultar(
    [],
    `SELECT co_seq_produto, alergenicos_json, intolerancias_json FROM resumo WHERE co_seq_produto IN (${validos.join(",")})`,
  )) as { co_seq_produto: number; alergenicos_json: string | null; intolerancias_json: string | null }[];
  return new Map(
    linhas.map((l) => [String(l.co_seq_produto), resumirAlergia(deJson(l.alergenicos_json), deJson(l.intolerancias_json))]),
  );
}

/** Apresentações de um produto com o detalhe (co_produto do detalhe é o co_seq_produto). */
export async function buscarApresentacoes(id: number): Promise<Apresentacao[]> {
  const sql = `
    SELECT a.co_seq_apresentacao_produto, a.nu_registro, r.nu_apresentacao_produto, r.validade,
      r.ds_forma_fisica, r.situacao_apresentacao, r.material_embalagens, r.tipo_embalagens,
      r.empresas_envasadoras, r.empresas_internacionais, r.grupos_populacionais, r.vias_administracao,
      r.tabela_nutricional, r.intolerancias, r.alergenicos, r.co_seq_apresentacao_produto IS NOT NULL AS tem_detalhe
    FROM "${TABELA}" a LEFT JOIN "${TABELA_DETALHE}" r USING (co_seq_apresentacao_produto)
    WHERE a.co_seq_produto = ?
    ORDER BY TRY_CAST(r.nu_apresentacao_produto AS INTEGER) NULLS LAST, a.co_seq_apresentacao_produto`;
  return (await consultar([TABELA, TABELA_DETALHE], sql, [id])) as unknown as Apresentacao[];
}

export const alimentos: Fonte<Produto> = {
  /**
   * Prepara o necessário para buscar e já começa, sem esperar, a baixar a tabela de detalhes do
   * resumo de alergênicos. As sugestões são montadas no primeiro uso, para não disputar o worker com
   * a primeira busca de um link compartilhado.
   */
  async preparar() {
    await produtos();
    void resumo().catch(() => {});
  },
  buscar,
  facetas,
  async sugerir(texto) {
    await sugestoes();
    return sugerirEm("sugestoes", texto);
  },
  porId,
  async numeros() {
    await produtos();
    return contarNumeros("produtos");
  },
  async grupos() {
    await produtos();
    return gruposAtivos("produtos");
  },
  idDe: (p) => String(p.co_seq_produto),
  complementar: resumosDe,
};
