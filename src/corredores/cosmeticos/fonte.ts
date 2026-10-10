// Corredor 3, cosméticos (higiene pessoal, cosméticos e perfumes). Medido em 2026-10-09: 1.204.980 linhas,
// 1.193.836 processos e 5.246 CNPJs, 24 MB de Parquet: grande demais para baixar inteiro como os outros
// corredores. Cada busca baixa só os pedaços que precisa (indice.ts) e monta uma tabela pequena com eles, sobre
// a qual valem o mesmo SQL de filtros e facetas dos outros corredores (lib/sql.ts).
//
// O texto procura por começo de palavra do nome do produto: "sham" acha SHAMPOO, "poo" não. O nome da
// empresa não entra nos pedaços por palavra; a empresa se acha pela sugestão (que leva ao CNPJ).
import { baixarArquivo, baixarJson, buildAtual, consultar, iniciar, type Valor } from "../../lib/db";
import type { Consulta } from "../../lib/detect";
import { ID_PRODUTO, POR_PAGINA, type Facetas, type Filtros, type Fonte } from "../../lib/fonte";
import { palavrasDaBusca } from "../../lib/palavras";
import { contarFacetas, onde, sugerirEm } from "../../lib/sql";
import { sqlCos, TABELA } from "./consultas";
import { arquivosDa, lerIndice, linhasDa, rota, type Indice, type Rota } from "./indice";
import { meta } from "./meta";

export interface Cosmetico {
  /** nu_processo: o id na URL (?p=) */
  id: string;
  no_produto: string;
  nu_processo: string;
  nu_cnpj_empresa: string;
  no_razao_social_empresa: string | null;
  nu_registro: string | null;
  situacao_registro: "Ativo" | "Inativo";
  /** Registrado, Notificado, Isento de registro ou Descartável */
  tipo_regularizacao: string;
  /** AAAA-MM-DD, como publicado */
  dt_vencimento: string | null;
  /** Em dia, Vencida ou Sem data (a validade da liberação) */
  grupo: string;
  total: number;
}

const MINIMO = meta.palavraMinima ?? 3;
const SEM_FACETAS: Facetas = { situacao: [], tipo: [], grupo: [] };

interface Base {
  build: string;
  /** pasta do indice.json, relativa ao manifest, com a barra no fim */
  pasta: string;
  ix: Indice;
}

let base: Promise<Base> | null = null;

/** O índice e a tabela das empresas (cos_empresas), uma vez por build: menos de 250 KB. */
async function preparar(): Promise<Base> {
  const build = await buildAtual();
  if (base) {
    const b = await base.catch(() => null);
    if (b?.build === build) return b;
  }
  base = (async () => {
    const busca = (await iniciar()).tables[TABELA]?.busca;
    if (busca?.versao !== 1) throw new Error("os arquivos de busca dos cosméticos ainda não foram publicados");
    const pasta = busca.indice.slice(0, busca.indice.lastIndexOf("/") + 1);
    const ix = lerIndice(await baixarJson(busca.indice, busca.bytes, busca.sha256));
    const empresas = await baixarArquivo(`${pasta}empresas.parquet`, ix.empresas_parquet);
    // sem contagem por empresa (só a tabela inteira teria): a sugestão mostra só o nome
    await consultar(
      [],
      `CREATE OR REPLACE TABLE cos_empresas AS
       SELECT nu_cnpj_empresa, no_razao_social_empresa, 'empresa' AS tipo, no_razao_social_empresa AS rotulo,
         lower(strip_accents(no_razao_social_empresa)) AS chave, 0 AS n, 0 AS ativos
       FROM read_parquet('${empresas}')`,
    );
    return { build, pasta, ix };
  })();
  base.catch(() => (base = null));
  return base;
}

/** As linhas da rota, com o nome da empresa, como relação para sqlCos; null quando não há o que ler. */
async function origem(b: Base, r: Rota): Promise<{ sql: string; params: Valor[] } | null> {
  const nomes = new Map<string, string>();
  await Promise.all(
    arquivosDa(r).map(async (a) => nomes.set(a.caminho, await baixarArquivo(b.pasta + a.caminho, a.bytes))),
  );
  // os nomes registrados só têm [a-z0-9_.-] (db.ts confere o caminho)
  const l = linhasDa(r, (as) => `[${as.map((a) => `'${nomes.get(a.caminho)!}'`).join(", ")}]`);
  if (!l) return null;
  return {
    sql: `(SELECT l.*, e.no_razao_social_empresa FROM (${l.sql}) l LEFT JOIN cos_empresas e USING (nu_cnpj_empresa))`,
    params: l.params,
  };
}

// a tabela de cada busca, pela rota (filtros e "mostrar mais" reusam); só as últimas ficam no banco
const MANTIDAS = 4;
const tabelas = new Map<string, Promise<string | null>>();
let sequencia = 0;

function esquecerAntigas(): void {
  while (tabelas.size > MANTIDAS) {
    const [chave, p] = tabelas.entries().next().value!;
    tabelas.delete(chave);
    p.then(
      async (nome) => {
        if (nome) await consultar([], `DROP TABLE IF EXISTS ${nome}`);
      },
      () => undefined,
    ).catch(() => undefined); // tabela que sobrou só ocupa memória
  }
}

async function montar(q: Consulta): Promise<string | null> {
  const b = await preparar();
  const r = rota(b.ix, q, MINIMO);
  const chave = `${b.build}|${JSON.stringify(r)}`;
  let p = tabelas.get(chave);
  if (!p) {
    p = (async () => {
      const o = await origem(b, r);
      if (!o) return null;
      const nome = `cos_q${++sequencia}`;
      await consultar([], `CREATE OR REPLACE TABLE ${nome} AS ${sqlCos(o.sql)}`, o.params);
      return nome;
    })();
    p.catch(() => tabelas.delete(chave));
    tabelas.set(chave, p);
    esquecerAntigas();
  }
  return p;
}

/** A tabela da busca; se o build mudou no meio (deploy durante a sessão), monta de novo com os caminhos novos. */
async function tabelaDa(q: Consulta): Promise<string | null> {
  try {
    return await montar(q);
  } catch (e) {
    if (!(e as { buildMudou?: boolean }).buildMudou) throw e;
    return montar(q);
  }
}

const COLUNAS = `id, no_produto, nu_processo, nu_cnpj_empresa, no_razao_social_empresa, nu_registro, situacao_registro,
  tipo_regularizacao, dt_vencimento, grupo`;
const TUDO = { sql: "true", params: [] };

async function buscar(q: Consulta, f: Filtros, pagina = 0): Promise<Cosmetico[]> {
  const t = await tabelaDa(q);
  if (!t) return [];
  const w = onde(TUDO, f);
  // texto: o nome que começa com a primeira palavra da busca vem antes
  const primeira = q.modo === "texto" || q.modo === "marca" ? palavrasDaBusca(q.valor, MINIMO)[0] : undefined;
  const relevancia = primeira ? "CASE WHEN starts_with(busca_nome, ?) THEN 0 ELSE 1 END" : "0";
  const sql = `
    SELECT ${COLUNAS}, (count(*) OVER ())::INTEGER AS total
    FROM (SELECT *, ${relevancia} AS relevancia FROM ${t}) s
    WHERE ${w.sql}
    ORDER BY relevancia, situacao_registro, ordem_data DESC NULLS LAST, id
    LIMIT ${POR_PAGINA} OFFSET ?`;
  return consultar<Cosmetico>([], sql, [...(primeira ? [primeira] : []), ...w.params, pagina * POR_PAGINA]);
}

async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
  const t = await tabelaDa(q);
  return t ? contarFacetas(t, TUDO, f) : SEM_FACETAS;
}

async function porId(id: string): Promise<Cosmetico | null> {
  if (!ID_PRODUTO.test(id)) return null;
  const b = await preparar();
  const r = rota(b.ix, { modo: "numero", valor: id }, MINIMO);
  const o = r.modo === "numero" ? await origem(b, r) : null;
  if (!o) return null;
  const [c] = await consultar<Cosmetico>([], `SELECT ${COLUNAS}, 1 AS total FROM (${sqlCos(o.sql)}) WHERE id = ?`, [
    ...o.params,
    id,
  ]);
  return c ?? null;
}

export const fonte: Fonte<Cosmetico> = {
  async preparar() {
    await preparar();
  },
  buscar,
  facetas,
  async sugerir(texto) {
    await preparar();
    return sugerirEm("cos_empresas", texto);
  },
  porId,
  // liberados e processos só se contam com a tabela inteira, que a ilha não baixa
  numeros: () => Promise.resolve(null),
  // a abertura usa os atalhos do meta
  grupos: () => Promise.resolve([]),
  idDe: (c) => c.id,
  cnpjDe: (c) => c.nu_cnpj_empresa,
  registroDe: (c) => c.nu_registro,
};
