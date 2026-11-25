// What the build computes for the public text instead of typing it: the supplement count in the food corridor's
// text, and llms.txt from a manifest without the measures table (it says so, dates the files, and never fails).
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it, vi } from "vitest";
import type { Manifest, Tabela } from "../src/lib/manifest";

const { manifest } = vi.hoisted(() => ({ manifest: { atual: null as unknown as Manifest } }));

vi.mock("../src/lib/manifest", async (original) => ({
  ...(await original<typeof import("../src/lib/manifest")>()),
  manifestDoBuild: () => Promise.resolve(manifest.atual),
}));

const { sqlSuplementos } = await import("../src/lib/estatico/dados");
const { GET } = await import("../src/pages/llms.txt");

describe("sqlSuplementos", () => {
  it("counts liberated foods in a supplement category, the same rows as the corridor's liberated total", async () => {
    const db = await DuckDBInstance.create(":memory:");
    const con = await db.connect();
    await con.run(`CREATE TABLE produtos AS SELECT * FROM (VALUES
      ('alimentos', 'Suplementos alimentares', true),
      ('alimentos', 'Suplementos Alimentares Contendo Probióticos e/ou Enzimas', true),
      ('alimentos', 'Suplementos alimentares', false),
      ('alimentos', 'ALIMENTOS INFANTIS', true),
      ('alimentos', NULL, true),
      ('saneantes', 'Suplementos alimentares', true)
    ) AS t(area, categoria, ativo)`);
    const linhas = (await con.runAndReadAll(sqlSuplementos("produtos"))).getRowObjectsJson();
    expect(linhas).toEqual([{ n: 2 }]);
    con.closeSync();
    db.closeSync();
  });
});

describe("llms.txt", () => {
  const tabela = (nome: string): Tabela => ({
    path: `data/b/${nome}.parquet`,
    rows: 10,
    bytes: 100,
    columns: [],
    source: { name: `${nome}.csv`, url: `https://dados.anvisa.gov.br/${nome}.csv`, loaded_at: "2026-11-20T08:00:00" },
  });
  const comTabelas = (nomes: string[]): Manifest => ({
    schema_version: 1,
    build_id: "20261121T015219Z",
    built_at: "2026-11-21T01:52:19Z",
    tables: Object.fromEntries(nomes.map((n) => [n, tabela(n)])),
  });
  const ler = async (m: Manifest) => {
    manifest.atual = m;
    const res = await GET({ site: new URL("https://contem.example/") } as Parameters<typeof GET>[0]);
    return res.text();
  };
  const BASE = ["alimentos_por_produto", "saneantes", "produtos_saude_por_produto"];

  it("dates the files of the build, never calling them current", async () => {
    const texto = await ler(comTabelas([...BASE, "medidas"]));
    expect(texto).toContain("Arquivos Parquet do build 20261121T015219Z, convertidos em 20/11/2026");
    expect(texto).not.toMatch(/\batua(l|is)\b/i);
    expect(texto).toContain("Medidas contra uma empresa:");
  });

  it("without the measures table, says so instead of describing or querying a missing file", async () => {
    const texto = await ler(comTabelas(BASE));
    expect(texto).toContain(
      "As medidas de fiscalização da ANVISA não estão nos arquivos convertidos para Parquet em 20/11/2026",
    );
    expect(texto).not.toContain("Medidas contra uma empresa:");
    expect(texto).not.toContain("medidas.parquet");
    expect(texto).not.toContain("e as medidas de fiscalização da ANVISA contra a empresa");
  });
});
