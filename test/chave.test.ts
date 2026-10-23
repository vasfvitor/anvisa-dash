// A chave dos nomes sem identificador (o fabricante de dispositivo) contra os casos que o repo `anvisa` também
// testa (test/fixtures/chaves.json, cópia do fixtures/dados/chaves.json de lá), em JS e no SQL do DuckDB, e o
// slug das páginas de fabricante.
import { readFileSync } from "node:fs";
import { DuckDBInstance, LIST, listValue, VARCHAR } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { chave, slug, slugFabricante } from "../src/lib/chave";
import { chaveSql } from "../src/lib/palavras";

const { casos } = JSON.parse(readFileSync(new URL("fixtures/chaves.json", import.meta.url), "utf-8")) as {
  casos: { entrada: string; chave: string }[];
};

describe("chave", () => {
  it.each(casos)("$entrada", ({ entrada, chave: esperada }) => {
    expect(chave(entrada)).toBe(esperada);
  });

  it("nulo e vazio dão chave vazia", () => {
    expect(chave(null)).toBe("");
    expect(chave(undefined)).toBe("");
  });

  it("o SQL dá a mesma chave em todos os casos", async () => {
    const db = await DuckDBInstance.create(":memory:");
    const con = await db.connect();
    try {
      const linhas = (
        await con.runAndReadAll(
          `SELECT e, ${chaveSql("e")} AS c FROM (SELECT unnest($1) AS e)`,
          [listValue(casos.map((c) => c.entrada))],
          [LIST(VARCHAR)],
        )
      ).getRowObjectsJson() as { e: string; c: string }[];
      const doSql = new Map(linhas.map((l) => [l.e, l.c]));
      for (const c of casos) expect(doSql.get(c.entrada), c.entrada).toBe(c.chave);
    } finally {
      con.closeSync();
      db.closeSync();
    }
  });

  it("a chave é o slug sem os hífens", () => {
    for (const c of casos) expect(slug(c.entrada).replaceAll("-", ""), c.entrada).toBe(c.chave);
  });
});

describe("slug e slugFabricante", () => {
  it("o país vira palavras com hífen, sem acento", () => {
    expect(slug("INGLATERRA (REINO UNIDO)")).toBe("inglaterra-reino-unido");
    expect(slug("  ESTADOS UNIDOS DA AMÉRICA ")).toBe("estados-unidos-da-america");
    expect(slug("CHINA, REPÚBLICA POPULAR")).toBe("china-republica-popular");
    expect(slug(null)).toBe("");
  });

  it("chave, hífen e país; sem país (ou país sem letra), só a chave", () => {
    expect(slugFabricante("corin", "REINO UNIDO")).toBe("corin-reino-unido");
    expect(slugFabricante("corin", "Reino Unido")).toBe("corin-reino-unido");
    expect(slugFabricante("corin", null)).toBe("corin");
    expect(slugFabricante("corin", "???")).toBe("corin");
  });

  it("só [a-z0-9] e hífens entre palavras: cabe numa URL sem escapar", () => {
    for (const c of casos.filter((x) => x.chave)) {
      expect(slugFabricante(c.chave, "ESTADOS UNIDOS DA AMÉRICA")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
