// SQL que toda fonte de dados compartilha: tabelas derivadas memoizadas por build, filtros e contagem de
// facetas. Valores do usuário entram só como parâmetros; o WHERE é montado com fragmentos fixos.
import { buildAtual, consultar, type Valor } from "./db";
import type { Consulta } from "./detect";
import type { Dimensao, Facetas, Filtros, Numeros, Sugestao, ValorFaceta } from "./fonte";
import { normalizar } from "./texto";

const derivadas = new Map<string, Promise<void>>();

/** Cria a tabela derivada `nome` uma vez por build, depois de `deps`. Falhou, a próxima tenta de novo. */
export async function derivar(nome: string, deps: () => Promise<void>, sql: string): Promise<void> {
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

// datas saem como texto sem fuso: o tipo temporal do Arrow muda de unidade conforme a versão
export const TS = (expr: string, nome: string) => `strftime(${expr}, '%Y-%m-%dT%H:%M:%S') AS ${nome}`;

/** Termo como as colunas de busca guardam: sem acento, minúsculo. */
export function termo(q: Consulta): string {
  return normalizar(q.valor.trim());
}

export interface Trecho {
  sql: string;
  params: Valor[];
}

/** Colunas que cada fonte expõe com os mesmos nomes na tabela derivada. */
const COL: Record<Dimensao, string> = { situacao: "situacao_registro", tipo: "tipo_regularizacao", grupo: "grupo" };

/** WHERE com o predicado e os filtros, menos o de `sem` (cada faceta conta ignorando o próprio filtro). */
export function onde(predicado: Trecho, f: Filtros, sem?: Dimensao): Trecho {
  const partes = [predicado.sql];
  const params = [...predicado.params];
  if (sem !== "situacao" && f.situacao !== "todos") {
    partes.push(`${COL.situacao} = ?`);
    params.push(f.situacao === "ativo" ? "Ativo" : "Inativo");
  }
  if (sem !== "grupo" && f.grupo) {
    partes.push(`${COL.grupo} = ?`);
    params.push(f.grupo);
  }
  if (sem !== "tipo" && f.tipo) {
    partes.push(`${COL.tipo} = ?`);
    params.push(f.tipo);
  }
  return { sql: partes.join(" AND "), params };
}

/** Contagem por situação, tipo e grupo numa tabela derivada que tenha as colunas de COL. */
export async function contarFacetas(tabela: string, predicado: Trecho, f: Filtros): Promise<Facetas> {
  const partes: string[] = [];
  const params: Valor[] = [];
  for (const [dim, col] of Object.entries(COL) as [Dimensao, string][]) {
    const w = onde(predicado, f, dim);
    partes.push(`SELECT '${dim}' AS dim, ${col} AS valor, count(*)::INTEGER AS n FROM ${tabela}
      WHERE ${w.sql} AND ${col} IS NOT NULL GROUP BY ${col}`);
    params.push(...w.params);
  }
  const linhas = await consultar<{ dim: Dimensao; valor: string; n: number }>(
    [],
    `${partes.join(" UNION ALL ")} ORDER BY n DESC, valor`,
    params,
  );
  const r: Facetas = { situacao: [], tipo: [], grupo: [] };
  for (const l of linhas) r[l.dim].push({ valor: l.valor, n: l.n });
  return r;
}

/** Totais de uma tabela derivada (com situacao_registro e nu_cnpj_empresa). */
export async function contarNumeros(tabela: string): Promise<Numeros> {
  const [n] = await consultar<Numeros>(
    [],
    `SELECT count(*)::INTEGER AS produtos, (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos,
      count(DISTINCT nu_cnpj_empresa)::INTEGER AS empresas FROM ${tabela}`,
  );
  return n!;
}

/** Valores da terceira faceta com produtos ativos. */
export async function gruposAtivos(tabela: string): Promise<ValorFaceta[]> {
  return consultar<ValorFaceta>(
    [],
    `SELECT grupo AS valor, count(*)::INTEGER AS n FROM ${tabela}
     WHERE situacao_registro = 'Ativo' AND grupo IS NOT NULL GROUP BY 1 ORDER BY n DESC, valor`,
  );
}

/** Sugestões que contêm o termo; as que começam com ele e as com produtos ativos primeiro. */
export async function sugerirEm(tabela: string, texto: string, limite = 8): Promise<Sugestao[]> {
  const t = normalizar(texto.trim());
  if (t.length < 2) return [];
  return consultar<Sugestao>(
    [],
    `SELECT tipo, rotulo, nu_cnpj_empresa, n, ativos FROM ${tabela}
     WHERE contains(chave, ?)
     ORDER BY NOT starts_with(chave, ?), ativos DESC, n DESC, length(rotulo), rotulo
     LIMIT ${Math.trunc(limite)}`,
    [t, t],
  );
}
