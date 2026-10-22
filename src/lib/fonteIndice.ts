// A fonte de um corredor cuja tabela não cabe no navegador e vem publicada em pedaços com um índice (a chave
// `busca` da tabela no manifest; SPEC.md do repo `anvisa`, formato 1; hoje os cosméticos, 1,2 M linhas). Cada
// busca baixa só os pedaços que precisa (indice.ts) e monta com eles uma tabela pequena, sobre a qual valem o
// mesmo SQL de filtros, facetas e relevância das tabelas inteiras (sql.ts). O nome da empresa não entra nos
// pedaços por palavra; a empresa se acha pela sugestão (que leva ao CNPJ).
//
// A regra do texto é a de todo corredor (cada palavra, em qualquer ordem, por começo de palavra), com a
// diferença de que a palavra mais rara escolhe os arquivos e precisa de `palavraMinima` letras.
import { baixarArquivo, baixarJson, buildAtual, consultar, iniciar, type Valor } from "./db";
import type { Consulta } from "./detect";
import { POR_PAGINA, type Facetas, type Filtros, type Fonte, type Item } from "./fonte";
import { arquivosDa, lerIndice, linhasDa, rota, type Indice, type Linha, type Rota } from "./indice";
import { palavrasDaBusca } from "./palavras";
import { contarFacetas, onde, relevanciaPalavras, sugerirEm } from "./sql";

export interface ConfigIndice<P extends Item> {
  /** a tabela do manifest, com a chave `busca` */
  tabela: string;
  /** o prefixo das tabelas no DuckDB: `<derivada>_empresas` e `<derivada>_q<n>`, uma por busca */
  derivada: string;
  /** as colunas de uma linha nos arquivos e a do nome do produto */
  linha: Linha;
  /** o SELECT que faz de `origem` (as linhas da rota, com no_razao_social_empresa) a tabela da busca */
  sql: (origem: string) => string;
  /** a lista do SELECT que o cartão e a página leem */
  colunas: string;
  /** o id na URL (?p=): a coluna e o formato válido; o produto por id lê os arquivos de números */
  id: { coluna: string; valida: RegExp };
  /** letras que uma palavra da busca precisa ter: a palavra escolhe o arquivo a baixar */
  palavraMinima: number;
  /** o fim do ORDER BY depois da relevância e da situação */
  ordem: string;
  cnpjDe: (p: P) => string | null;
  registroDe?: (p: P) => string | null;
}

const SEM_FACETAS: Facetas = { situacao: [], tipo: [], grupo: [] };

interface Base {
  build: string;
  /** pasta do indice.json, relativa ao manifest, com a barra no fim */
  pasta: string;
  ix: Indice;
}

export function fonteIndice<P extends Item>(c: ConfigIndice<P>): Fonte<P> {
  const empresas = `${c.derivada}_empresas`;
  let base: Promise<Base> | null = null;

  /** O índice e a tabela das empresas, uma vez por build: menos de 250 KB. */
  async function preparar(): Promise<Base> {
    const build = await buildAtual();
    if (base) {
      const b = await base.catch(() => null);
      if (b?.build === build) return b;
    }
    base = (async () => {
      const busca = (await iniciar()).tables[c.tabela]?.busca;
      if (busca?.versao !== 1) throw new Error(`os arquivos de busca de ${c.tabela} ainda não foram publicados`);
      const pasta = busca.indice.slice(0, busca.indice.lastIndexOf("/") + 1);
      const ix = lerIndice(await baixarJson(busca.indice, busca.bytes, busca.sha256));
      const arquivo = await baixarArquivo(`${pasta}empresas.parquet`, ix.empresas_parquet);
      // sem contagem por empresa (só a tabela inteira teria): a sugestão mostra só o nome
      await consultar(
        [],
        `CREATE OR REPLACE TABLE ${empresas} AS
         SELECT nu_cnpj_empresa, no_razao_social_empresa, 'empresa' AS tipo, no_razao_social_empresa AS rotulo,
           lower(strip_accents(no_razao_social_empresa)) AS chave, 0 AS n, 0 AS ativos
         FROM read_parquet('${arquivo}')`,
      );
      return { build, pasta, ix };
    })();
    base.catch(() => (base = null));
    return base;
  }

  /** As linhas da rota, com o nome da empresa, como relação para `c.sql`; null quando não há o que ler. */
  async function origem(b: Base, r: Rota): Promise<{ sql: string; params: Valor[] } | null> {
    const nomes = new Map<string, string>();
    await Promise.all(
      arquivosDa(r).map(async (a) => nomes.set(a.caminho, await baixarArquivo(b.pasta + a.caminho, a.bytes))),
    );
    // os nomes registrados só têm [a-z0-9_.-] (db.ts confere o caminho)
    const l = linhasDa(r, (as) => `[${as.map((a) => `'${nomes.get(a.caminho)!}'`).join(", ")}]`, c.linha);
    if (!l) return null;
    return {
      sql: `(SELECT l.*, e.no_razao_social_empresa FROM (${l.sql}) l LEFT JOIN ${empresas} e USING (nu_cnpj_empresa))`,
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
    const r = rota(b.ix, q, c.palavraMinima);
    const chave = `${b.build}|${JSON.stringify(r)}`;
    let p = tabelas.get(chave);
    if (!p) {
      p = (async () => {
        const o = await origem(b, r);
        if (!o) return null;
        const nome = `${c.derivada}_q${++sequencia}`;
        await consultar([], `CREATE OR REPLACE TABLE ${nome} AS ${c.sql(o.sql)}`, o.params);
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

  const TUDO = { sql: "true", params: [] };

  async function buscar(q: Consulta, f: Filtros, pagina = 0): Promise<P[]> {
    const t = await tabelaDa(q);
    if (!t) return [];
    const w = onde(TUDO, f);
    const ps = q.modo === "texto" || q.modo === "marca" ? palavrasDaBusca(q.valor, c.palavraMinima) : [];
    const r = relevanciaPalavras(ps, "busca_nome");
    const sql = `
    SELECT ${c.colunas}, (count(*) OVER ())::INTEGER AS total
    FROM (SELECT *, ${r.sql} AS relevancia FROM ${t}) s
    WHERE ${w.sql}
    ORDER BY relevancia, situacao_registro, ${c.ordem}
    LIMIT ${POR_PAGINA} OFFSET ?`;
    return consultar<P>([], sql, [...r.params, ...w.params, pagina * POR_PAGINA]);
  }

  async function facetas(q: Consulta, f: Filtros): Promise<Facetas> {
    const t = await tabelaDa(q);
    return t ? contarFacetas(t, TUDO, f) : SEM_FACETAS;
  }

  async function porId(id: string): Promise<P | null> {
    if (!c.id.valida.test(id)) return null;
    const b = await preparar();
    const r = rota(b.ix, { modo: "numero", valor: id }, c.palavraMinima);
    const o = r.modo === "numero" ? await origem(b, r) : null;
    if (!o) return null;
    const sql = `SELECT ${c.colunas}, 1 AS total FROM (${c.sql(o.sql)}) WHERE ${c.id.coluna} = ?`;
    const [p] = await consultar<P>([], sql, [...o.params, id]);
    return p ?? null;
  }

  return {
    async preparar() {
      await preparar();
    },
    buscar,
    facetas,
    async sugerir(texto) {
      await preparar();
      return sugerirEm(empresas, texto);
    },
    porId,
    // a abertura usa os atalhos do meta
    grupos: () => Promise.resolve([]),
    idDe: (p) => String(p[c.id.coluna as keyof P]),
    cnpjDe: c.cnpjDe,
    ...(c.registroDe && { registroDe: c.registroDe }),
  };
}
