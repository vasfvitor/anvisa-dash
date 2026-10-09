// Medidas de fiscalização da ANVISA (suspensão, proibição, recolhimento, interdição, apreensão,
// inutilização), de produtos_irregulares. A tabela cobre todas as áreas; cada corredor vê só as do seu
// tipoProduto (co_tipo_produto), e toda consulta começa por ele. Medido em 2026-10-08: 80.218 linhas,
// uma por dossiê × produto × ação × atividade (cerca de 12 por dossiê); aqui viram uma por dossiê ×
// produto. Cuidados da origem: a empresa investigada nem sempre tem CNPJ (11 dígitos é pessoa, e o nome
// não aparece); `registro` só vem nos saneantes; nu_processo é o processo da medida, não do produto.
import { carregar, consultar, iniciar } from "./db";
import type { Consulta } from "./detect";
import { derivar, termo, type Trecho } from "./sql";

const TABELA = "produtos_irregulares";
export const MEDIDAS_POR_PAGINA = 20;

export interface Medida {
  /** dossiê e produto: a chave de um cartão */
  id: string;
  dossie: number;
  produto: string;
  /** null quando a medida é contra uma pessoa (CPF) */
  empresa: string | null;
  cnpj: string | null;
  registro: string | null;
  processo: string | null;
  risco: string | null;
  acoes: string[];
  atividades: string[];
  /** AAAA-MM-DD */
  dt_primeira: string;
  dt_ultima: string;
  /** total da busca (window count) */
  total: number;
}

function tabela(): Promise<void> {
  return derivar(
    "medidas",
    () => carregar(TABELA),
    `CREATE OR REPLACE TABLE medidas AS
    SELECT co_tipo_produto AS tipo, co_seq_dossie_investig_med AS dossie, prod AS produto,
      any_value(no_empresa_investigada) AS empresa,
      -- 00000000000000 aparece como CNPJ de preenchimento: não é empresa nenhuma
      any_value(nu_cnpj_empresa_investigada) FILTER (WHERE regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{14}') AND nu_cnpj_empresa_investigada <> '00000000000000') AS cnpj,
      coalesce(bool_or(regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{11}')), false) AS pessoa,
      any_value(nullif(regexp_replace(registro, '[^0-9]', '', 'g'), '')) AS registro,
      any_value(nu_processo) AS processo, any_value(ds_risco_produto) AS risco,
      -- listas viram texto: o Arrow devolve coluna de lista como vetor, não como array
      array_to_string(list_sort(list(DISTINCT ds_acao_fiscalizacao) FILTER (WHERE ds_acao_fiscalizacao IS NOT NULL)), '|') AS acoes,
      array_to_string(list_sort(list(DISTINCT ds_atividade_fiscalizacao) FILTER (WHERE ds_atividade_fiscalizacao IS NOT NULL)), '|') AS atividades,
      strftime(min(dt_publicacao), '%Y-%m-%d') AS dt_primeira, strftime(max(dt_publicacao), '%Y-%m-%d') AS dt_ultima,
      lower(strip_accents(concat_ws(' ', prod, any_value(no_empresa_investigada)))) AS busca
    FROM (SELECT *, trim(produto) AS prod FROM "${TABELA}") WHERE coalesce(prod, '') <> ''
    GROUP BY co_tipo_produto, co_seq_dossie_investig_med, prod`,
  );
}

/** Se o build atual publicou a tabela; sem ela o site segue sem medidas, sem tentar de novo a cada busca. */
async function disponivel(): Promise<boolean> {
  return TABELA in (await iniciar()).tables;
}

/** Baixa e monta em segundo plano, depois que o corredor fica pronto (a primeira busca não espera o download). */
export async function prepararMedidas(): Promise<void> {
  if (await disponivel()) await tabela();
}

/** Condição para cada modo de consulta; null quando o modo não procura medidas (navegar por grupo). */
export function predicado(q: Consulta): Trecho | null {
  switch (q.modo) {
    case "cnpj":
      return { sql: "cnpj = ?", params: [q.valor] };
    case "numero":
      // o processo da medida ou o registro do produto (só nos saneantes)
      return { sql: "(processo = ? OR registro = ?)", params: [q.valor, q.valor] };
    case "marca":
    case "texto":
      return { sql: "contains(busca, ?)", params: [termo(q)] };
    case "todos":
      return null;
  }
}

const COLUNAS = `dossie || ':' || produto AS id, dossie, produto, CASE WHEN pessoa THEN NULL ELSE empresa END AS empresa,
  cnpj, registro, processo, risco, acoes, atividades, dt_primeira, dt_ultima`;

type Bruta = Omit<Medida, "acoes" | "atividades"> & { acoes: string | null; atividades: string | null };

function medidas(linhas: Bruta[]): Medida[] {
  const lista = (s: string | null) => (s ? s.split("|") : []);
  return linhas.map((l) => ({ ...l, acoes: lista(l.acoes), atividades: lista(l.atividades) }));
}

/** Medidas do corredor que citam a consulta, das mais recentes para as mais antigas. */
export async function buscarMedidas(tipo: number, q: Consulta, pagina = 0): Promise<Medida[]> {
  const p = predicado(q);
  if (!p || !(await disponivel())) return [];
  await tabela();
  const sql = `SELECT ${COLUNAS}, (count(*) OVER ())::INTEGER AS total FROM medidas
    WHERE tipo = ? AND ${p.sql}
    ORDER BY dt_ultima DESC, dossie, produto LIMIT ${MEDIDAS_POR_PAGINA} OFFSET ?`;
  return medidas(await consultar<Bruta>([], sql, [tipo, ...p.params, pagina * MEDIDAS_POR_PAGINA]));
}

/** As últimas medidas do corredor, para a abertura. */
export async function recentes(tipo: number, n = 6): Promise<Medida[]> {
  if (!(await disponivel())) return [];
  await tabela();
  const sql = `SELECT ${COLUNAS}, 0 AS total FROM medidas WHERE tipo = ?
    ORDER BY dt_ultima DESC, dossie, produto LIMIT ${Math.trunc(n)}`;
  return medidas(await consultar<Bruta>([], sql, [tipo]));
}

/** Medidas que citam este produto pelo número de registro (os saneantes trazem; os alimentos, não). */
export async function porRegistro(tipo: number, registro: string): Promise<Medida[]> {
  if (!/^\d+$/.test(registro) || !(await disponivel())) return [];
  await tabela();
  const sql = `SELECT ${COLUNAS}, 0 AS total FROM medidas WHERE tipo = ? AND registro = ?
    ORDER BY dt_ultima DESC, dossie, produto`;
  return medidas(await consultar<Bruta>([], sql, [tipo, registro]));
}

/** Quantas medidas (dossiê × produto, a mesma unidade da lista) cada empresa tem no corredor (só as que têm). */
export async function medidasPorEmpresa(tipo: number, cnpjs: string[]): Promise<Map<string, number>> {
  // CNPJs vêm dos resultados do próprio app; entram como literais depois de validados
  const validos = [...new Set(cnpjs)].filter((c) => /^\d{14}$/.test(c));
  if (!validos.length || !(await disponivel())) return new Map();
  await tabela();
  const linhas = await consultar<{ cnpj: string; n: number }>(
    [],
    `SELECT cnpj, count(*)::INTEGER AS n FROM medidas
     WHERE tipo = ? AND cnpj IN (${validos.map((c) => `'${c}'`).join(",")}) GROUP BY cnpj`,
    [tipo],
  );
  return new Map(linhas.map((l) => [l.cnpj, l.n]));
}
