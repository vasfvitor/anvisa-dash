import { describe, expect, it } from "vitest";
import { arquivosDaTabela, dataDosArquivos, porData, separador } from "../src/lib/arquivos";
import type { Origem, Tabela } from "../src/lib/manifest";

const DERIVAR = { name: "derivada", url: "https://github.com/vasfvitor/anvisa-api/blob/x/derivar.py" };
const tab = (source: Origem, fontes?: string[]): Tabela => ({
  path: "x.parquet",
  rows: 1,
  bytes: 1,
  columns: [],
  source,
  ...(fontes ? { fontes } : {}),
});

// shaped like the live manifest of 2026-11-21
const TABELAS: Record<string, Tabela> = {
  alimentos: tab({ name: "TA_CONSULTA_ALIMENTOS.CSV", url: "https://a/ALI.CSV", loaded_at: "2026-11-20T00:00:00" }),
  alimentos_resultado: tab({ name: "RES.CSV", url: "https://a/RES.CSV", loaded_at: "2026-11-20T01:08:15" }),
  // no loaded_at: falls back to ANVISA's Last-Modified, read on Brasília's day
  medicamentos: tab({ name: "MED.csv", url: "https://a/MED.csv", last_modified: "Fri, 20 Nov 2026 09:33:36 GMT" }),
  cmed: tab({
    name: "TA_PRECO_MEDICAMENTO.csv, TA_PRECO_MEDICAMENTO_GOV.csv",
    url: "https://a/PMC.csv",
    loaded_at: "2026-10-09T12:43:03",
    files: [
      { name: "TA_PRECO_MEDICAMENTO.csv", url: "https://a/PMC.csv", last_modified: "Fri, 09 Oct 2026 15:43:03 GMT" },
      {
        name: "TA_PRECO_MEDICAMENTO_GOV.csv",
        url: "https://a/PMVG.csv",
        last_modified: "Fri, 09 Oct 2026 15:43:26 GMT",
      },
    ],
  }),
  sem_data: tab({ name: "X.CSV", url: "https://a/X.CSV" }),
  // two files, one without its own Last-Modified, under a source that has a date
  parte_sem_data: tab({
    name: "A.csv, B.csv",
    url: "https://a/A.csv",
    loaded_at: "2026-10-09T12:43:03",
    last_modified: "Fri, 09 Oct 2026 15:43:03 GMT",
    files: [
      { name: "A.csv", url: "https://a/A.csv", last_modified: "Fri, 09 Oct 2026 15:43:03 GMT" },
      { name: "B.csv", url: "https://a/B.csv" },
    ],
  }),
  alimentos_por_produto: tab({ ...DERIVAR, loaded_at: "2026-11-20T01:08:15" }, ["alimentos", "alimentos_resultado"]),
  medicamentos_por_produto: tab(DERIVAR, ["medicamentos", "cmed"]),
  // a derived table built from another derived one, and a source missing from the manifest
  dupla: tab(DERIVAR, ["alimentos_por_produto", "alimentos", "sumiu"]),
  ciclo: tab(DERIVAR, ["ciclo", "alimentos"]),
  so_sumiu: tab(DERIVAR, ["sumiu"]),
};

describe("arquivosDaTabela", () => {
  it("a raw table is its own source, with loaded_at as ANVISA's date", () => {
    expect(arquivosDaTabela(TABELAS, "alimentos")).toEqual([
      { name: "TA_CONSULTA_ALIMENTOS.CSV", url: "https://a/ALI.CSV", data: "20/11/2026", tipo: "gerado" },
    ]);
  });

  it("a derived table resolves to ANVISA's files, never to derivar.py", () => {
    const a = arquivosDaTabela(TABELAS, "alimentos_por_produto");
    expect(a.map((x) => x.name)).toEqual(["TA_CONSULTA_ALIMENTOS.CSV", "RES.CSV"]);
    expect(a.some((x) => x.url.includes("derivar.py"))).toBe(false);
  });

  it("splits a multi-file source and keeps each file's date; Last-Modified when loaded_at is missing", () => {
    expect(arquivosDaTabela(TABELAS, "medicamentos_por_produto")).toEqual([
      { name: "MED.csv", url: "https://a/MED.csv", data: "20/11/2026", tipo: "publicado" },
      { name: "TA_PRECO_MEDICAMENTO.csv", url: "https://a/PMC.csv", data: "09/10/2026", tipo: "publicado" },
      { name: "TA_PRECO_MEDICAMENTO_GOV.csv", url: "https://a/PMVG.csv", data: "09/10/2026", tipo: "publicado" },
    ]);
  });

  it("a file of a multi-file source without its own Last-Modified has no date, never another file's", () => {
    expect(arquivosDaTabela(TABELAS, "parte_sem_data").map(({ data, tipo }) => ({ data, tipo }))).toEqual([
      { data: "09/10/2026", tipo: "publicado" },
      { data: "", tipo: null },
    ]);
  });

  it("a derived table whose only source left the manifest has no files", () => {
    expect(arquivosDaTabela(TABELAS, "so_sumiu")).toEqual([]);
  });

  it("recursive, without repeats, ignoring missing tables and cycles", () => {
    expect(arquivosDaTabela(TABELAS, "dupla").map((x) => x.name)).toEqual(["TA_CONSULTA_ALIMENTOS.CSV", "RES.CSV"]);
    expect(arquivosDaTabela(TABELAS, "ciclo").map((x) => x.name)).toEqual(["TA_CONSULTA_ALIMENTOS.CSV"]);
    expect(arquivosDaTabela(TABELAS, "nao_existe")).toEqual([]);
  });

  it("no date in the manifest: empty date, said as no date", () => {
    const [a] = arquivosDaTabela(TABELAS, "sem_data");
    expect(a).toMatchObject({ data: "", tipo: null });
    expect(dataDosArquivos(1, a!)).toBe("arquivo sem data");
    expect(dataDosArquivos(2, a!)).toBe("arquivos sem data");
  });
});

describe("text helpers", () => {
  it("groups consecutive files with the same date", () => {
    const g = porData(arquivosDaTabela(TABELAS, "medicamentos_por_produto"));
    expect(g.map((x) => [x.data, x.arquivos.length])).toEqual([
      ["20/11/2026", 1],
      ["09/10/2026", 2],
    ]);
    // the same day from loaded_at and from Last-Modified are different dates
    const misto = porData([
      { name: "A", url: "a", data: "20/11/2026", tipo: "gerado" },
      { name: "B", url: "b", data: "20/11/2026", tipo: "publicado" },
    ]);
    expect(misto).toHaveLength(2);
  });

  it("labels the date as ANVISA's, saying which date it is", () => {
    expect(dataDosArquivos(1, { data: "20/11/2026", tipo: "gerado" })).toBe("arquivo gerado pela ANVISA em 20/11/2026");
    expect(dataDosArquivos(2, { data: "09/10/2026", tipo: "gerado" })).toBe(
      "arquivos gerados pela ANVISA em 09/10/2026",
    );
    expect(dataDosArquivos(1, { data: "20/11/2026", tipo: "publicado" })).toBe(
      "arquivo publicado pela ANVISA em 20/11/2026",
    );
    expect(dataDosArquivos(2, { data: "09/10/2026", tipo: "publicado" })).toBe(
      "arquivos publicados pela ANVISA em 09/10/2026",
    );
  });

  it("Portuguese list separators", () => {
    expect([0, 1, 2].map((i) => separador(i, 3))).toEqual(["", ", ", " e "]);
    expect([0, 1].map((i) => separador(i, 2))).toEqual(["", " e "]);
  });
});
