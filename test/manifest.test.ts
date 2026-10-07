import { describe, expect, it } from "vitest";
import { parseManifest, tabelaUrl } from "../src/lib/manifest";

const base = {
  schema_version: 1,
  build_id: "20261006T231312Z",
  built_at: "2026-10-06T23:13:12Z",
  tables: {
    alimentos: { path: "data/20261006T231312Z/alimentos.parquet", rows: 1, bytes: 1, columns: [], source: { name: "x", url: "y" } },
  },
};

describe("manifest", () => {
  it("resolve o caminho relativo à URL do manifest", () => {
    const m = parseManifest(base);
    expect(tabelaUrl("https://vasfvitor.github.io/anvisa-api/manifest.json", m, "alimentos")).toBe(
      "https://vasfvitor.github.io/anvisa-api/data/20261006T231312Z/alimentos.parquet",
    );
  });
  it("recusa schema_version desconhecido", () => {
    expect(() => parseManifest({ ...base, schema_version: 2 })).toThrow(/schema_version 2/);
  });
  it("recusa nome de tabela que não é identificador seguro", () => {
    const tables = { 'x"; DROP': base.tables.alimentos };
    expect(() => parseManifest({ ...base, tables })).toThrow(/nome de tabela inválido/);
  });
  it("tabela ausente", () => {
    expect(() => tabelaUrl("https://x/manifest.json", parseManifest(base), "nao_existe")).toThrow();
  });
});
