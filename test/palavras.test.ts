// A regra das palavras contra os casos que o repo `anvisa` também testa (test/fixtures/tokens.json, cópia do
// tokens.json da SPEC dos cosméticos), em JS e no SQL do DuckDB.
import { readFileSync } from "node:fs";
import { DuckDBInstance, LIST, listValue, VARCHAR } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { palavras, palavrasDaBusca, palavrasSql } from "../src/lib/palavras";

const { casos } = JSON.parse(readFileSync(new URL("fixtures/tokens.json", import.meta.url), "utf-8")) as {
  casos: { entrada: string; palavras: string[] }[];
};

// o strip_accents do DuckDB não faz a decomposição de compatibilidade: ligadura e largura cheia
// (nenhum nome dos cosméticos tem; ver lib/palavras.ts)
const SO_NO_JS = new Set(["ﬁNO", "ＳＨＡＭＰＯＯ"]);

describe("palavras", () => {
  it.each(casos)("$entrada", ({ entrada, palavras: esperadas }) => {
    expect(palavras(entrada)).toEqual(esperadas);
  });

  it("a busca ignora palavras curtas", () => {
    expect(palavrasDaBusca("2 em 1", 3)).toEqual([]);
    expect(palavrasDaBusca("SH protetor FPS 50", 3)).toEqual(["protetor", "fps"]);
  });

  it("o SQL dá as mesmas palavras, fora ligadura e largura cheia", async () => {
    const db = await DuckDBInstance.create(":memory:");
    const con = await db.connect();
    try {
      const linhas = (
        await con.runAndReadAll(
          `SELECT e, ${palavrasSql("e")} AS p FROM (SELECT unnest($1) AS e)`,
          [listValue(casos.map((c) => c.entrada))],
          [LIST(VARCHAR)],
        )
      ).getRowObjectsJson() as { e: string; p: string[] }[];
      const doSql = new Map(linhas.map((l) => [l.e, [...new Set(l.p)].sort()]));
      for (const c of casos) {
        if (SO_NO_JS.has(c.entrada)) expect(doSql.get(c.entrada), c.entrada).not.toEqual([...c.palavras].sort());
        else expect(doSql.get(c.entrada), c.entrada).toEqual([...c.palavras].sort());
      }
    } finally {
      con.closeSync();
      db.closeSync();
    }
  });
});
