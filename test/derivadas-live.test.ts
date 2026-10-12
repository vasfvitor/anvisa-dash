// As tabelas derivadas do repo `anvisa` (produtos, empresas) contra o SQL da ilha, sobre os dados reais.
// Só roda com DADOS_LIVE apontando para uma pasta com alimentos, saneantes, cosmeticos, produtos_irregulares,
// produtos e empresas em .parquet (baixados do manifest ao vivo); sem ela, fica de fora (não há rede no CI).
// Primeira rodada em 2026-10-11 contra o build 20261012T000746Z; o que deve bater está no handoff
// ~/SharedFiles/agent/dados-produto/PROMPT.md.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SQL_PRODUTOS } from "../src/corredores/alimentos/consultas";
import { sqlCos } from "../src/corredores/cosmeticos/consultas";
import { SQL_SAN } from "../src/corredores/saneantes/consultas";
import { SQL_MEDIDAS, sqlNumeros } from "../src/lib/consultas";
import { SQL_ALIMENTOS_DE_PRODUTOS, SQL_SANEANTES_DE_PRODUTOS } from "../src/lib/estatico/dados";

const pasta = process.env.DADOS_LIVE;
const TABELAS = ["alimentos", "saneantes", "cosmeticos", "produtos_irregulares", "produtos", "empresas"];
const pronta = !!pasta && TABELAS.every((t) => existsSync(join(pasta, `${t}.parquet`)));

describe.skipIf(!pronta)("derivadas do repo anvisa contra o SQL da ilha (DADOS_LIVE)", () => {
  let instancia: DuckDBInstance;
  let con: DuckDBConnection;
  const linhas = async <T>(sql: string) => (await con.runAndReadAll(sql)).getRowObjectsJson() as T[];
  const uma = async <T>(sql: string) => (await linhas<T>(sql))[0]!;

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
    await con.run(`CREATE TABLE cos AS ${sqlCos('"cosmeticos"')}`);
  }, 120_000);
  afterAll(() => {
    con.closeSync();
    instancia.closeSync();
  });

  const numeros = (area: string) =>
    uma<{ produtos: number; ativos: number; empresas: number }>(
      `SELECT count(*)::INTEGER AS produtos, (count(*) FILTER (WHERE ativo))::INTEGER AS ativos,
        count(DISTINCT cnpj)::INTEGER AS empresas FROM produtos_pub WHERE area = '${area}'`,
    );

  // 2026-10-11: saneantes dá 144.413 em produtos e 144.407 na ilha (6 expedientes em par, ver SQL_SAN); o
  // SELECT do build deduplica, e é ele que tem de bater
  it("produtos por área bate com sqlNumeros das derivadas da ilha", async () => {
    expect(await numeros("alimentos")).toEqual(await uma(sqlNumeros("produtos")));
    const san = await uma(
      `SELECT count(*)::INTEGER AS produtos, (count(*) FILTER (WHERE ativo))::INTEGER AS ativos,
        count(DISTINCT cnpj)::INTEGER AS empresas FROM (${SQL_SANEANTES_DE_PRODUTOS.replaceAll('"produtos"', "produtos_pub")})`,
    );
    expect(san).toEqual(await uma(sqlNumeros("san")));
    const { pares } = await uma<{ pares: number }>(
      `SELECT count(*)::INTEGER AS pares FROM (SELECT id FROM produtos_pub WHERE area = 'saneantes' GROUP BY id HAVING count(*) > 1)`,
    );
    console.log("expedientes em par em produtos:", pares, "(a tabela promete id único por area)");
  });

  it("cosméticos em empresas: processos distintos, ativos pela regra de sqlCos", async () => {
    const e = await uma<{ cosmeticos: number; ativos: number; empresas: number }>(
      `SELECT sum(cosmeticos)::INTEGER AS cosmeticos, sum(cosmeticos_ativos)::INTEGER AS ativos,
        (count(*) FILTER (WHERE cosmeticos > 0))::INTEGER AS empresas FROM empresas`,
    );
    const { n } = await uma<{ n: number }>(`SELECT count(DISTINCT nu_processo)::INTEGER AS n FROM cosmeticos`);
    expect(e.cosmeticos).toBe(n);
    const c = await uma<{ produtos: number; ativos: number; empresas: number }>(sqlNumeros("cos"));
    expect(e.cosmeticos).toBe(c.produtos);
    expect(e.ativos).toBe(c.ativos);
    expect(e.empresas).toBe(c.empresas);
  });

  it("registros nunca é nulo", async () => {
    const { n } = await uma<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM produtos_pub WHERE registros IS NULL`);
    expect(n).toBe(0);
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
    const novoAlimentos = SQL_ALIMENTOS_DE_PRODUTOS.replaceAll('"produtos"', "produtos_pub");
    const novoSaneantes = SQL_SANEANTES_DE_PRODUTOS.replaceAll('"produtos"', "produtos_pub");
    const diferentes = async (a: string, b: string) =>
      uma<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ((${a}) EXCEPT ALL (${b}))`);
    expect(await diferentes(antigoAlimentos, novoAlimentos)).toEqual({ n: 0 });
    expect(await diferentes(novoAlimentos, antigoAlimentos)).toEqual({ n: 0 });
    expect(await diferentes(antigoSaneantes, novoSaneantes)).toEqual({ n: 0 });
    expect(await diferentes(novoSaneantes, antigoSaneantes)).toEqual({ n: 0 });
  });

  // onde empresas e o site divergem por definição, para quem for avaliar trocar a agregação do build
  it("relata empresas contra a agregação do site", async () => {
    const r = await uma<Record<string, number>>(
      `WITH site AS (
         SELECT cnpj FROM produtos_pub
         UNION SELECT nu_cnpj_empresa FROM cos
         UNION SELECT cnpj FROM medidas WHERE cnpj IS NOT NULL AND tipo IN (6, 3, 2)
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
