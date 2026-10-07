// SQL do app. Valores do usuário entram só como parâmetros; o WHERE é montado com fragmentos fixos.
//
// Depois do download, três tabelas derivadas são criadas uma vez por build, em memória:
// - produtos: uma linha por co_seq_produto (nome, marcas, empresa, processo e situação são iguais em
//   todas as apresentações), com colunas de busca já normalizadas;
// - resumo: alergênicos e intolerâncias de cada produto, da tabela de detalhes (chega depois: a busca
//   não espera por ela; os cartões pedem o resumo dos produtos listados com resumosDe);
// - sugestoes: marcas e empresas com a contagem de produtos, para sugerir enquanto a pessoa digita.
import { TABELA, TABELA_DETALHE } from "./config";
import type { Consulta } from "./detect";
import { deJson, resumirAlergia, type ResumoAlergia } from "./alergia";
import { buildAtual, carregar, consultar, type Valor } from "./db";
import { normalizar } from "./texto";

export const POR_PAGINA = 30;

export type Situacao = "ativo" | "inativo" | "todos";

export interface Filtros {
  categoria: string;
  tipo: string;
  situacao: Situacao;
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

// datas saem como texto sem fuso: o tipo temporal do Arrow muda de unidade conforme a versão
const TS = (expr: string, nome: string) => `strftime(${expr}, '%Y-%m-%dT%H:%M:%S') AS ${nome}`;

// ---------------------------------------------------------------------------------------------
// tabelas derivadas

const derivadas = new Map<string, Promise<void>>();

async function derivar(nome: string, deps: () => Promise<void>, sql: string): Promise<void> {
  const chave = `${await buildAtual()}/${nome}`;
  let p = derivadas.get(chave);
  if (!p) {
    p = (async () => {
      await deps();
      await consultar([], sql);
    })();
    p.catch(() => derivadas.delete(chave));
    derivadas.set(chave, p);
  }
  return p;
}

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

/**
 * Prepara o necessário para buscar e já começa, sem esperar, a baixar a tabela de detalhes do resumo
 * de alergênicos. As sugestões são montadas no primeiro uso, para não disputar o worker com a
 * primeira busca de um link compartilhado.
 */
export async function preparar(): Promise<void> {
  await produtos();
  void resumo().catch(() => {});
}

// ---------------------------------------------------------------------------------------------
// busca

/** Termo como a coluna de busca guarda: sem acento, minúsculo. */
function termo(q: Consulta): string {
  return normalizar(q.valor.trim());
}

function predicado(q: Consulta): { sql: string; params: Valor[] } {
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

type Dimensao = "situacao" | "tipo" | "categoria";

/** WHERE com o termo e os filtros, menos o de `sem` (cada faceta conta ignorando o próprio filtro). */
function onde(q: Consulta, f: Filtros, sem?: Dimensao): { sql: string; params: Valor[] } {
  const p = predicado(q);
  const partes = [p.sql];
  const params = [...p.params];
  if (sem !== "situacao" && f.situacao !== "todos") {
    partes.push("situacao_registro = ?");
    params.push(f.situacao === "ativo" ? "Ativo" : "Inativo");
  }
  if (sem !== "categoria" && f.categoria) {
    partes.push("ds_categoria_produto = ?");
    params.push(f.categoria);
  }
  if (sem !== "tipo" && f.tipo) {
    partes.push("tipo_regularizacao = ?");
    params.push(f.tipo);
  }
  return { sql: partes.join(" AND "), params };
}

const COLUNAS = `co_seq_produto, no_produto, marcas, no_razao_social_empresa, nu_cnpj_empresa, nu_processo,
  nu_registro_notificacao_produto, ds_categoria_produto, tipo_regularizacao, situacao_registro,
  ds_situacao_assunto_doc, ds_alegacao_funcional, dt_regularizacao, dt_publicacao, dt_situacao,
  dt_inicio_analise, dt_vencimento_registro, n_apresentacoes`;

export async function buscarProdutos(q: Consulta, f: Filtros, pagina = 0): Promise<Produto[]> {
  await produtos();
  const w = onde(q, f);
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

export interface ValorFaceta {
  valor: string;
  n: number;
}
export type Facetas = Record<Dimensao, ValorFaceta[]>;

/** Contagem de produtos por situação, tipo e categoria no resultado atual. */
export async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
  await produtos();
  const partes: string[] = [];
  const params: Valor[] = [];
  const colunas: Record<Dimensao, string> = {
    situacao: "situacao_registro",
    tipo: "tipo_regularizacao",
    categoria: "ds_categoria_produto",
  };
  for (const [dim, col] of Object.entries(colunas) as [Dimensao, string][]) {
    const w = onde(q, f, dim);
    partes.push(
      `SELECT '${dim}' AS dim, ${col} AS valor, count(*)::INTEGER AS n FROM produtos WHERE ${w.sql} AND ${col} IS NOT NULL GROUP BY ${col}`,
    );
    params.push(...w.params);
  }
  const linhas = (await consultar([], `${partes.join(" UNION ALL ")} ORDER BY n DESC, valor`, params)) as {
    dim: Dimensao;
    valor: string;
    n: number;
  }[];
  const r: Facetas = { situacao: [], tipo: [], categoria: [] };
  for (const l of linhas) r[l.dim].push({ valor: l.valor, n: l.n });
  return r;
}

// ---------------------------------------------------------------------------------------------
// sugestões, produto, números gerais

export interface Sugestao {
  tipo: "marca" | "empresa";
  rotulo: string;
  nu_cnpj_empresa: string | null;
  n: number;
  ativos: number;
}

/** Marcas e empresas que contêm o termo; as que começam com ele e as com produtos ativos primeiro. */
export async function sugerir(texto: string, limite = 8): Promise<Sugestao[]> {
  const t = normalizar(texto.trim());
  if (t.length < 2) return [];
  await sugestoes();
  const sql = `
    SELECT tipo, rotulo, nu_cnpj_empresa, n, ativos FROM sugestoes
    WHERE contains(chave, ?)
    ORDER BY NOT starts_with(chave, ?), ativos DESC, n DESC, length(rotulo), rotulo
    LIMIT ${Math.trunc(limite)}`;
  return (await consultar([], sql, [t, t])) as unknown as Sugestao[];
}

export async function produtoPorId(id: number): Promise<Produto | null> {
  await produtos();
  const sql = `SELECT ${COLUNAS}, 1 AS total FROM produtos WHERE co_seq_produto = ?`;
  const [p] = (await consultar([], sql, [id])) as unknown as Produto[];
  return p ?? null;
}

/**
 * Resumo de alergênicos dos produtos pedidos. Espera a tabela de detalhes (baixada em segundo plano
 * desde o início) e só consulta os ids da tela, em vez de juntar o resumo em toda busca.
 */
export async function resumosDe(ids: number[]): Promise<Map<number, ResumoAlergia>> {
  // ids vêm dos resultados do próprio app, não do usuário: entram como literais depois de validados
  const validos = ids.filter(Number.isSafeInteger);
  if (!validos.length) return new Map();
  await resumo();
  const linhas = (await consultar(
    [],
    `SELECT co_seq_produto, alergenicos_json, intolerancias_json FROM resumo WHERE co_seq_produto IN (${validos.join(",")})`,
  )) as { co_seq_produto: number; alergenicos_json: string | null; intolerancias_json: string | null }[];
  return new Map(
    linhas.map((l) => [l.co_seq_produto, resumirAlergia(deJson(l.alergenicos_json), deJson(l.intolerancias_json))]),
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

export interface Numeros {
  produtos: number;
  ativos: number;
  empresas: number;
}

export async function numeros(): Promise<Numeros> {
  await produtos();
  const [n] = (await consultar(
    [],
    `SELECT count(*)::INTEGER AS produtos, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos,
      count(DISTINCT nu_cnpj_empresa)::INTEGER AS empresas FROM produtos`,
  )) as unknown as Numeros[];
  return n!;
}

/** Categorias com produtos ativos, para explorar sem digitar nada. */
export async function categoriasAtivas(): Promise<ValorFaceta[]> {
  await produtos();
  return (await consultar(
    [],
    `SELECT ds_categoria_produto AS valor, count(*)::INTEGER AS n FROM produtos
     WHERE situacao_registro = 'Ativo' AND ds_categoria_produto IS NOT NULL GROUP BY 1 ORDER BY n DESC, valor`,
  )) as unknown as ValorFaceta[];
}
