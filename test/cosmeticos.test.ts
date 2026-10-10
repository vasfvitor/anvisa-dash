// A rota de cada busca nos arquivos dos cosméticos (indice.ts), num índice falso. Com COSMETICOS_BUSCA
// apontando para uma pasta de busca de verdade (a do build 20261010T000506Z ou a de referência da SPEC), roda
// também o SQL da ilha no DuckDB do Node e confere as contagens do verificar.py.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { detectar } from "../src/lib/detect";
import { sqlCos } from "../src/corredores/cosmeticos/consultas";
import { faixasDe, lerIndice, linhasDa, rota, type Indice } from "../src/corredores/cosmeticos/indice";

const ix: Indice = lerIndice({
  versao: 1,
  palavras: [
    ["aaa", 10, "palavras/0000.parquet", 100],
    ["sabonete", 50, "palavras/0001.parquet", 500],
    ["shampoo", 4000, "palavras/0002.parquet", 2000],
    ["shampoos", 20, "palavras/0003.parquet", 200],
    ["solar", 30, "palavras/0004.parquet", 300],
  ],
  empresas: [
    ["00000000000191", 3000, "empresas/000.parquet", 900],
    ["33306929000100", 2900, "empresas/001.parquet", 800],
  ],
  numeros: { "100": 40, "844": 45 },
  empresas_parquet: 1000,
});

const q = (texto: string) => detectar(texto)!;

describe("rota", () => {
  it("prefixo pega todos os arquivos cuja faixa o cruza", () => {
    // a faixa de "sabonete" vai até "shampoo": uma palavra como "sham" mesma estaria nela
    expect(faixasDe(ix.palavras, "sham").map((f) => f[2])).toEqual([
      "palavras/0001.parquet",
      "palavras/0002.parquet",
      "palavras/0003.parquet",
    ]);
    // e a de "aaa" vai até "sabonete": "sab", "saba"… estão nela
    expect(faixasDe(ix.palavras, "sab").map((f) => f[2])).toEqual(["palavras/0000.parquet", "palavras/0001.parquet"]);
    expect(faixasDe(ix.palavras, "solar").map((f) => f[2])).toEqual(["palavras/0004.parquet"]);
  });

  it("texto lê a palavra com menos linhas e filtra pelas outras", () => {
    expect(rota(ix, q("Shampoo Solar"), 3)).toEqual({
      modo: "texto",
      palavra: "solar",
      outras: ["shampoo"],
      palavras: [{ caminho: "palavras/0004.parquet", bytes: 300 }],
    });
  });

  it("sem palavra de 3 letras não há o que ler", () => {
    expect(rota(ix, q("2 em 1"), 3)).toEqual({ modo: "nada" });
    expect(rota(ix, { modo: "todos", valor: "" }, 3)).toEqual({ modo: "nada" });
  });

  it("CNPJ lê o arquivo da empresa e o de números (há processo de 14 dígitos)", () => {
    expect(rota(ix, q("33.306.929/0001-00"), 3)).toEqual({
      modo: "cnpj",
      valor: "33306929000100",
      empresas: [{ caminho: "empresas/001.parquet", bytes: 800 }],
      numeros: [{ caminho: "numeros/100.parquet", bytes: 40 }],
    });
  });

  it("número lê numeros/<3 últimos dígitos>, se existir", () => {
    expect(rota(ix, q("25351.892332/2008-44"), 3)).toEqual({
      modo: "numero",
      valor: "25351892332200844",
      numeros: [{ caminho: "numeros/844.parquet", bytes: 45 }],
    });
    expect(rota(ix, q("999999999"), 3)).toEqual({ modo: "numero", valor: "999999999", numeros: [] });
  });

  it("valores da busca só como parâmetros", () => {
    // "loreal" cai na faixa de "aaa" (10 linhas): é ela que se lê; "shampoo" filtra pelo nome
    const l = linhasDa(rota(ix, q("shampoo l'oréal"), 3), (as) => `[${as.map((a) => `'${a.caminho}'`).join(", ")}]`)!;
    expect(l.params).toEqual(["loreal", "shampoo"]);
    expect(l.sql).not.toMatch(/shampoo|loreal/);
    // fora das strings (o regex das palavras tem "(?:")
    expect(l.sql.replace(/'(?:[^']|'')*'/g, "").split("?").length - 1).toBe(l.params.length);
  });

  it("índice de versão desconhecida falha alto", () => {
    expect(() => lerIndice({ ...ix, versao: 2 })).toThrow(/versão/);
  });
});

const PASTA = process.env.COSMETICOS_BUSCA;

describe.skipIf(!PASTA || !existsSync(join(PASTA, "indice.json")))("contra os arquivos de verdade", () => {
  it("cada busca acha as mesmas linhas que o verificar.py", async () => {
    const { contagens } = JSON.parse(
      readFileSync(new URL("fixtures/consultas-cosmeticos.json", import.meta.url), "utf-8"),
    ) as { contagens: Record<string, number> };
    const real = lerIndice(JSON.parse(readFileSync(join(PASTA!, "indice.json"), "utf-8")));
    const db = await DuckDBInstance.create(":memory:");
    const con = await db.connect();
    try {
      for (const [texto, esperado] of Object.entries(contagens)) {
        // CNPJ: o verificar só olha a empresa; a ilha também lê processo de 14 dígitos (nenhum casa aqui)
        const l = linhasDa(
          rota(real, q(texto), 3),
          (as) => `[${as.map((a) => `'${join(PASTA!, a.caminho)}'`).join(", ")}]`,
        );
        const n = l
          ? Number(
              (
                await con.runAndReadAll(
                  `SELECT count(*)::INTEGER AS n FROM (SELECT DISTINCT nu_processo, st_registrado FROM (${l.sql}))`,
                  l.params,
                )
              ).getRowObjectsJson()[0]!.n,
            )
          : 0;
        expect(n, texto).toBe(esperado);
      }
      // a tabela da busca como a ilha cria (CREATE TABLE AS com parâmetros): um produto por processo
      const l = linhasDa(
        rota(real, q("protetor solar"), 3),
        (as) => `[${as.map((a) => `'${join(PASTA!, a.caminho)}'`).join(", ")}]`,
      )!;
      await con.run(
        `CREATE TABLE t AS ${sqlCos(`(SELECT *, NULL::VARCHAR AS no_razao_social_empresa FROM (${l.sql}))`)}`,
        l.params,
      );
      const [r] = (
        await con.runAndReadAll("SELECT count(*)::INTEGER AS n, count(DISTINCT id)::INTEGER AS ids FROM t")
      ).getRowObjectsJson() as { n: number; ids: number }[];
      expect(r!.n).toBe(r!.ids);
      // 3.989 linhas, 3.678 processos (conferido com o words() do Python sobre a tabela inteira)
      expect(r!.n).toBe(3678);
    } finally {
      con.closeSync();
      db.closeSync();
    }
  }, 60_000);
});
