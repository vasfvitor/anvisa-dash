// As tabelas derivadas do repo `anvisa` (produtos, empresas, medidas) contra o SQL da ilha, sobre os dados
// reais. Só roda com DADOS_LIVE apontando para uma pasta com alimentos, saneantes, cosmeticos,
// produtos_irregulares, produtos, empresas e medidas em .parquet (baixados do manifest ao vivo); sem ela,
// fica de fora (não há rede no CI).
// Primeira rodada em 2026-10-11 contra o build 20261012T000746Z; o que deve bater está no handoff
// ~/SharedFiles/agent/dados-produto/PROMPT.md.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SQL_PRODUTOS } from "../src/corredores/alimentos/consultas";
import { sqlCos } from "../src/corredores/cosmeticos/consultas";
import { SQL_SAN } from "../src/corredores/saneantes/consultas";
import { MEDIDAS_BUSCA, SQL_MEDIDAS, sqlNumeros } from "../src/lib/consultas";
import {
  sqlAlimentosDe,
  sqlCosmeticosDe,
  sqlCosmeticosTotaisDe,
  sqlNumerosCosmeticos,
  sqlSaneantesDe,
} from "../src/lib/estatico/dados";
import { COSMETICOS_POR_EMPRESA } from "../src/lib/estatico/empresas";
import type { Numeros } from "../src/lib/fonte";
import { deJson, resumirAlergia, type Sinal } from "../src/corredores/alimentos/alergia";

const pasta = process.env.DADOS_LIVE;
const TABELAS = [
  "alimentos",
  "alimentos_resultado",
  "saneantes",
  "cosmeticos",
  "produtos_irregulares",
  "produtos",
  "empresas",
  "medidas",
  "cosmeticos_por_empresa",
];

// o resumo de alergênicos como a ilha o monta (corredores/alimentos/fonte.ts): a referência das colunas novas
const SQL_RESUMO = `CREATE TABLE resumo AS
    SELECT co_produto AS co_seq_produto,
      to_json(list(DISTINCT alergenicos) FILTER (WHERE alergenicos <> ''))::VARCHAR AS alergenicos_json,
      to_json(list(DISTINCT intolerancias) FILTER (WHERE intolerancias <> ''))::VARCHAR AS intolerancias_json
    FROM "alimentos_resultado" GROUP BY co_produto`;

// o que a ilha e o build derivavam de produtos_irregulares até 2026-10-11 (lib/consultas.ts): a referência
const SQL_MEDIDAS_ANTIGO = `CREATE TABLE medidas_antigo AS
    SELECT co_tipo_produto AS tipo, co_seq_dossie_investig_med AS dossie, prod AS produto,
      any_value(no_empresa_investigada) AS empresa,
      any_value(nu_cnpj_empresa_investigada) FILTER (WHERE regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{14}') AND nu_cnpj_empresa_investigada <> '00000000000000') AS cnpj,
      coalesce(bool_or(regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{11}')), false) AS pessoa,
      any_value(nullif(regexp_replace(registro, '[^0-9]', '', 'g'), '')) AS registro,
      any_value(nu_processo) AS processo, any_value(ds_risco_produto) AS risco,
      array_to_string(list_sort(list(DISTINCT ds_acao_fiscalizacao) FILTER (WHERE ds_acao_fiscalizacao IS NOT NULL)), '|') AS acoes,
      array_to_string(list_sort(list(DISTINCT ds_atividade_fiscalizacao) FILTER (WHERE ds_atividade_fiscalizacao IS NOT NULL)), '|') AS atividades,
      strftime(min(dt_publicacao), '%Y-%m-%d') AS dt_primeira, strftime(max(dt_publicacao), '%Y-%m-%d') AS dt_ultima
    FROM (SELECT *, trim(produto) AS prod FROM "produtos_irregulares") WHERE coalesce(prod, '') <> ''
    GROUP BY co_tipo_produto, co_seq_dossie_investig_med, prod`;
const pronta = !!pasta && TABELAS.every((t) => existsSync(join(pasta, `${t}.parquet`)));

describe.skipIf(!pronta)("derivadas do repo anvisa contra o SQL da ilha (DADOS_LIVE)", () => {
  let instancia: DuckDBInstance;
  let con: DuckDBConnection;
  const linhas = async <T>(sql: string) => (await con.runAndReadAll(sql)).getRowObjectsJson() as T[];
  const uma = async <T>(sql: string) => (await linhas<T>(sql))[0]!;
  const contar = async (sql: string) => (await uma<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM (${sql})`)).n;
  /** quantas linhas de `a` não estão em `b` */
  const diferentes = (a: string, b: string) => contar(`(${a}) EXCEPT ALL (${b})`);
  // o que o build lê de produtos (o Parquet do manifest fica como `produtos_pub`: a ilha chama sua derivada de `produtos`)
  const DE_PRODUTOS = { ativo: "ativo", cnpj: "cnpj" };
  const novoAlimentos = sqlAlimentosDe("produtos_pub");
  const novoSaneantes = sqlSaneantesDe("produtos_pub");

  beforeAll(async () => {
    instancia = await DuckDBInstance.create(":memory:");
    con = await instancia.connect();
    for (const t of TABELAS) {
      const arquivo = join(pasta!, `${t}.parquet`).replaceAll("'", "''");
      // o Parquet "produtos" do manifest fica como `produtos_pub`: a ilha chama sua derivada de `produtos`
      const nome = t === "produtos" ? "produtos_pub" : t;
      await con.run(`CREATE VIEW "${nome}" AS SELECT * FROM read_parquet('${arquivo}')`);
    }
    await con.run(SQL_PRODUTOS);
    await con.run(SQL_SAN);
    await con.run(SQL_MEDIDAS);
    await con.run(SQL_MEDIDAS_ANTIGO);
    await con.run(`CREATE TABLE cos AS ${sqlCos('"cosmeticos"')}`);
  }, 120_000);
  afterAll(() => {
    con.closeSync();
    instancia.closeSync();
  });

  it("totais do build (de produtos) batem com sqlNumeros das derivadas da ilha", async () => {
    const totais = (de: string) => uma<Numeros>(sqlNumeros(`(${de})`, DE_PRODUTOS));
    expect(await totais(novoAlimentos)).toEqual(await uma(sqlNumeros("produtos")));
    expect(await totais(novoSaneantes)).toEqual(await uma(sqlNumeros("san")));
    // (area, id) única: os 6 expedientes em par da origem ficam com a linha registrada, como em SQL_SAN
    expect(await contar("SELECT area, id FROM produtos_pub GROUP BY ALL HAVING count(*) > 1")).toBe(0);
  });

  // as colunas de alergênicos de produtos são o resumirAlergia da ilha, produto a produto
  it("alergênicos em produtos batem com resumirAlergia sobre alimentos_resultado", async () => {
    await con.run(SQL_RESUMO);
    interface Linha {
      id: string;
      gluten: string | null;
      lactose: string | null;
      contem: string[] | null;
      pode_conter: string[] | null;
      nao_contem: string[] | null;
      alergia_varia: boolean | null;
      alergenicos_json: string | null;
      intolerancias_json: string | null;
    }
    const todas = await linhas<Linha>(
      `SELECT p.id, p.gluten, p.lactose, p.contem, p.pode_conter, p.nao_contem, p.alergia_varia,
         r.alergenicos_json, r.intolerancias_json
       FROM produtos_pub p LEFT JOIN resumo r ON r.co_seq_produto = p.id::INTEGER WHERE p.area = 'alimentos'`,
    );
    const SINAL: Record<string, Sinal> = { Sim: "sim", Não: "nao", Varia: "varia" };
    const erros: string[] = [];
    let comDados = 0;
    for (const l of todas) {
      const r = resumirAlergia(deJson(l.alergenicos_json), deJson(l.intolerancias_json));
      const esperado = r.temDados
        ? {
            gluten: r.gluten,
            lactose: r.lactose,
            contem: r.contem,
            podeConter: r.podeConter,
            naoContem: r.naoContem,
            varia: r.varia,
          }
        : { gluten: null, lactose: null, contem: null, podeConter: null, naoContem: null, varia: null };
      const lista = (xs: string[] | null) => xs && [...xs].sort((a, b) => a.localeCompare(b, "pt-BR"));
      const visto = {
        gluten: l.gluten && SINAL[l.gluten],
        lactose: l.lactose && SINAL[l.lactose],
        contem: lista(l.contem),
        podeConter: lista(l.pode_conter),
        naoContem: lista(l.nao_contem),
        varia: l.alergia_varia,
      };
      if (r.temDados) comDados++;
      if (JSON.stringify(visto) !== JSON.stringify(esperado))
        erros.push(`${l.id}: ${JSON.stringify({ visto, esperado })}`);
    }
    expect(erros.slice(0, 3)).toEqual([]);
    expect(await contar("SELECT 1 FROM produtos_pub WHERE contem IS NOT NULL")).toBe(comDados);
    console.log("alimentos com dados de alergênicos:", comDados, "de", todas.length);
  });

  it("cosméticos em empresas: processos distintos, ativos pela regra de sqlCos", async () => {
    const e = await uma<Numeros>(sqlNumerosCosmeticos("empresas"));
    const { n } = await uma<{ n: number }>(`SELECT count(DISTINCT nu_processo)::INTEGER AS n FROM cosmeticos`);
    expect(e.produtos).toBe(n);
    expect(e).toEqual(await uma(sqlNumeros("cos")));
  });

  // cosmeticos_por_empresa: o que o build listava da tabela inteira (dados.ts até 2026-10-12), já cortado
  it("cosmeticos_por_empresa são os primeiros de cada CNPJ pela regra do build, com ordem 1..n", async () => {
    const cpe = "cosmeticos_por_empresa";
    // ordem contígua a partir de 1, sem repetir
    expect(
      await contar(
        `SELECT cnpj FROM ${cpe} GROUP BY cnpj
         HAVING min(ordem) <> 1 OR max(ordem) <> count(*) OR count(DISTINCT ordem) <> count(*)`,
      ),
    ).toBe(0);
    // liberados antes: nenhum ativo depois de um inativo
    expect(
      await contar(
        `SELECT 1 FROM ${cpe} a JOIN ${cpe} b USING (cnpj) WHERE a.ordem < b.ordem AND NOT a.ativo AND b.ativo`,
      ),
    ).toBe(0);
    // cada empresa com cosmético está, com min(total, teto) linhas; nenhuma a mais
    expect(
      await contar(
        `SELECT 1 FROM (SELECT cnpj, count(*) AS n FROM ${cpe} GROUP BY cnpj) c
         FULL JOIN (SELECT cnpj, cosmeticos FROM empresas WHERE cosmeticos > 0) e USING (cnpj)
         WHERE n IS DISTINCT FROM least(cosmeticos, ${COSMETICOS_POR_EMPRESA})`,
      ),
    ).toBe(0);
    // as linhas e os totais são os que o build tirava de cos (sqlCos sobre a tabela inteira)
    const antigo = `SELECT id, no_produto AS nome, situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo,
        nu_processo AS processo, nu_registro AS registro, dt_vencimento AS vencimento, grupo,
        nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
      FROM cos
      QUALIFY row_number() OVER (PARTITION BY nu_cnpj_empresa ORDER BY situacao_registro, no_produto, id)
        <= ${COSMETICOS_POR_EMPRESA}`;
    const novo = sqlCosmeticosDe(cpe);
    expect(await diferentes(antigo, novo)).toBe(0);
    expect(await diferentes(novo, antigo)).toBe(0);
    const totaisAntigos = `SELECT nu_cnpj_empresa AS cnpj, count(*)::INTEGER AS produtos,
        (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos FROM cos GROUP BY 1`;
    expect(await diferentes(totaisAntigos, sqlCosmeticosTotaisDe("empresas"))).toBe(0);
    expect(await diferentes(sqlCosmeticosTotaisDe("empresas"), totaisAntigos)).toBe(0);
  });

  it("registros nunca é nulo", async () => {
    expect(await contar("SELECT 1 FROM produtos_pub WHERE registros IS NULL")).toBe(0);
  });

  // o que o build lia das derivadas da ilha (dados.ts até 2026-10-11) é o que lê de produtos: nenhuma linha difere
  it("as linhas das páginas de empresa saem iguais de produtos e do SQL da ilha", async () => {
    const antigoAlimentos = `SELECT co_seq_produto::INTEGER AS id, no_produto AS nome, marcas, ds_categoria_produto AS categoria,
        situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo, nu_processo AS processo,
        nu_registro_notificacao_produto AS registro, left(dt_regularizacao, 10) AS desde,
        n_apresentacoes AS apresentacoes, nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
      FROM produtos`;
    const antigoSaneantes = `SELECT id, no_produto AS nome, situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo,
        nu_processo AS processo, nu_registro_produto AS registro, dt_vencimento AS vencimento, grupo,
        nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
      FROM san`;
    expect(await diferentes(antigoAlimentos, novoAlimentos)).toBe(0);
    expect(await diferentes(novoAlimentos, antigoAlimentos)).toBe(0);
    expect(await diferentes(antigoSaneantes, novoSaneantes)).toBe(0);
    expect(await diferentes(novoSaneantes, antigoSaneantes)).toBe(0);
  });

  // a tabela medidas do manifest, lida por medidas_busca, dá as mesmas linhas que a derivação antiga
  it("medidas do manifest batem com a derivação antiga de produtos_irregulares", async () => {
    // atividades: sem nenhuma, a derivação antiga dava NULL e a lista vazia dá ''; a ilha lê os dois como []
    const colunas =
      "tipo, dossie, produto, cnpj, pessoa, processo, risco, acoes, coalesce(atividades, '') AS atividades, dt_primeira, dt_ultima";
    const nova = `SELECT ${colunas} FROM ${MEDIDAS_BUSCA}`;
    const antiga = `SELECT ${colunas} FROM medidas_antigo`;
    expect(await diferentes(nova, antiga)).toBe(0);
    expect(await diferentes(antiga, nova)).toBe(0);
    // a empresa: igual fora as pessoas, e nula nelas (medidas.ts confia nisso e não repete a regra)
    expect(
      await contar(
        `SELECT 1 FROM ${MEDIDAS_BUSCA} n JOIN medidas_antigo a USING (tipo, dossie, produto)
         WHERE NOT n.pessoa AND n.empresa IS DISTINCT FROM a.empresa`,
      ),
    ).toBe(0);
    expect(await contar(`SELECT 1 FROM ${MEDIDAS_BUSCA} WHERE pessoa AND empresa IS NOT NULL`)).toBe(0);
    // o registro antigo (um por linha) está na lista nova; a lista traz mais em alguns pares
    const r = await uma<{ faltando: number; com_mais: number }>(
      `SELECT (count(*) FILTER (WHERE a.registro IS NOT NULL AND NOT list_contains(n.registros, a.registro)))::INTEGER AS faltando,
         (count(*) FILTER (WHERE len(n.registros) > 1))::INTEGER AS com_mais
       FROM ${MEDIDAS_BUSCA} n JOIN medidas_antigo a USING (tipo, dossie, produto)`,
    );
    expect(r.faltando).toBe(0);
    console.log("medidas com mais de um registro citado:", r.com_mais);
  });

  // onde empresas e o site divergem por definição, para quem for avaliar trocar a agregação do build
  it("relata empresas contra a agregação do site", async () => {
    const r = await uma<Record<string, number>>(
      `WITH site AS (
         SELECT cnpj FROM produtos_pub
         UNION SELECT nu_cnpj_empresa FROM cos
         UNION SELECT cnpj FROM ${MEDIDAS_BUSCA} WHERE cnpj IS NOT NULL AND tipo IN (6, 3, 2)
       )
       SELECT (SELECT count(*) FROM empresas)::INTEGER AS empresas,
         (SELECT count(*) FROM site)::INTEGER AS site,
         (SELECT count(*) FROM empresas WHERE cnpj NOT IN (SELECT cnpj FROM site))::INTEGER AS so_em_empresas,
         (SELECT count(*) FROM site WHERE cnpj NOT IN (SELECT cnpj FROM empresas))::INTEGER AS so_no_site,
         (SELECT count(*) FROM empresas WHERE produtos = 0)::INTEGER AS so_medidas`,
    );
    console.log("empresas × site:", r);
    expect(r.so_no_site).toBe(0);
  });
});
