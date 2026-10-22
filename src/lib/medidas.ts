// Medidas de fiscalização da ANVISA (suspensão, proibição, recolhimento, interdição, apreensão,
// inutilização), da tabela `medidas` do manifest: uma linha por dossiê × produto, derivada no repo `anvisa`
// de produtos_irregulares (que tem uma por dossiê × produto × ação × atividade). A tabela cobre todas as
// áreas; cada corredor vê só as do seu tipoProduto (area_codigo), e toda consulta começa por ele. Cuidados
// da origem: a empresa investigada nem sempre tem CNPJ (CPF é pessoa, e o nome não aparece); `registros`
// só vem nos saneantes e cosméticos; `processo` é o da medida, não o de um produto.
import { MEDIDAS_BUSCA, SQL_MEDIDAS, TABELA_MEDIDAS } from "./consultas";
import { carregar, consultar, iniciar } from "./db";
import type { Consulta } from "./detect";
import { fatiar } from "./format";
import { derivar, palavrasDe, predicadoPalavras, type Trecho } from "./sql";

const TABELA = TABELA_MEDIDAS;
export const MEDIDAS_POR_PAGINA = 20;
/** O que o cartão e a página lembram ao lado do número de medidas da empresa. */
export const SOBRE_A_EMPRESA = "Medidas contra a empresa, não necessariamente sobre este produto.";

export interface Medida {
  /** dossiê e produto: a chave de um cartão */
  id: string;
  dossie: number;
  produto: string;
  /** null quando a medida é contra uma pessoa (CPF) */
  empresa: string | null;
  cnpj: string | null;
  /** registros de produto citados pela medida (só dígitos); vazio nos alimentos */
  registros: string[];
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
  return derivar(MEDIDAS_BUSCA, () => carregar(TABELA), SQL_MEDIDAS);
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
export function predicado(q: Consulta, registros: string[] = []): Trecho | null {
  switch (q.modo) {
    case "cnpj":
      return { sql: "cnpj = ?", params: [q.valor] };
    case "numero": {
      // o processo da medida ou um registro citado (saneantes e cosméticos), e os registros dos produtos que o
      // número achou (um processo ou expediente leva às medidas que citam o registro daquele produto)
      const outros = [...new Set(registros)].filter((r) => r !== q.valor);
      const lista = outros.length ? ` OR list_has_any(registros, [${outros.map(() => "?").join(", ")}])` : "";
      return {
        sql: `(processo = ? OR list_contains(registros, ?)${lista})`,
        params: [q.valor, q.valor, ...outros],
      };
    }
    case "marca":
    case "texto":
      return predicadoPalavras(palavrasDe(q));
    case "todos":
      return null;
  }
}

// a tabela já traz empresa nula quando o alvo é uma pessoa (test/derivadas-live.test.ts confere);
// registros vira texto com "|" como as outras listas (o Arrow devolve vetor, não array)
const COLUNAS = `dossie || ':' || produto AS id, dossie, produto, empresa, cnpj,
  array_to_string(registros, '|') AS registros, processo, risco, acoes, atividades, dt_primeira, dt_ultima`;

type Bruta = Omit<Medida, "acoes" | "atividades" | "registros"> & {
  acoes: string | null;
  atividades: string | null;
  registros: string | null;
};

function medidas(linhas: Bruta[]): Medida[] {
  return linhas.map((l) => ({
    ...l,
    acoes: fatiar(l.acoes, "|"),
    atividades: fatiar(l.atividades, "|"),
    registros: fatiar(l.registros, "|"),
  }));
}

/** Medidas do corredor que citam a consulta, das mais recentes para as mais antigas. */
export async function buscarMedidas(
  tipo: number,
  q: Consulta,
  pagina = 0,
  registros: string[] = [],
): Promise<Medida[]> {
  const p = predicado(q, registros);
  if (!p || !(await disponivel())) return [];
  await tabela();
  const sql = `SELECT ${COLUNAS}, (count(*) OVER ())::INTEGER AS total FROM ${MEDIDAS_BUSCA}
    WHERE tipo = ? AND ${p.sql}
    ORDER BY dt_ultima DESC, dossie, produto LIMIT ${MEDIDAS_POR_PAGINA} OFFSET ?`;
  return medidas(await consultar<Bruta>([], sql, [tipo, ...p.params, pagina * MEDIDAS_POR_PAGINA]));
}

/** As últimas medidas do corredor, para a abertura. */
export async function recentes(tipo: number, n = 6): Promise<Medida[]> {
  if (!(await disponivel())) return [];
  await tabela();
  const sql = `SELECT ${COLUNAS}, 0 AS total FROM ${MEDIDAS_BUSCA} WHERE tipo = ?
    ORDER BY dt_ultima DESC, dossie, produto LIMIT ${Math.trunc(n)}`;
  return medidas(await consultar<Bruta>([], sql, [tipo]));
}

/** Medidas que citam este produto pelo número de registro (saneantes e cosméticos trazem; os alimentos, não). */
export async function porRegistro(tipo: number, registro: string): Promise<Medida[]> {
  if (!/^\d+$/.test(registro) || !(await disponivel())) return [];
  await tabela();
  const sql = `SELECT ${COLUNAS}, 0 AS total FROM ${MEDIDAS_BUSCA} WHERE tipo = ? AND list_contains(registros, ?)
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
    `SELECT cnpj, count(*)::INTEGER AS n FROM ${MEDIDAS_BUSCA}
     WHERE tipo = ? AND cnpj IN (${validos.map((c) => `'${c}'`).join(",")}) GROUP BY cnpj`,
    [tipo],
  );
  return new Map(linhas.map((l) => [l.cnpj, l.n]));
}
