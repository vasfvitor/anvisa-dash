import { describe, expect, it } from "vitest";
import { TABELAS } from "../src/corredores";
import { conjuntoDados } from "../src/lib/dataset";
import type { Tabela } from "../src/lib/manifest";

const tabela: Tabela = {
  path: "data/x/saneantes.parquet",
  rows: 3,
  bytes: 100,
  columns: [
    { name: "no_produto", type: "VARCHAR" },
    { name: "nu_processo", type: "VARCHAR" },
  ],
  source: { name: "TA_CONSULTA_SANEANTES.CSV", url: "https://dados.anvisa.gov.br/x.csv" },
};
const info = { titulo: "Produtos de limpeza", descricao: "Uma linha por processo.", palavras: ["saneantes"] };
const montar = () =>
  conjuntoDados(
    "saneantes",
    tabela,
    info,
    { nu_processo: "Nº do processo." },
    {
      pagina: "https://contem.abelhaninja.de/dicionario/",
      parquet: "https://exemplo.org/saneantes.parquet",
      atualizado: "2026-10-06T00:00:00",
    },
  );

describe("conjuntoDados", () => {
  it("@id e url são a âncora da seção", () => {
    const d = montar();
    expect(d["@id"]).toBe("https://contem.abelhaninja.de/dicionario/#saneantes");
    expect(d.url).toBe(d["@id"]);
    expect(d.alternateName).toBe("saneantes");
  });

  it("uma variável por coluna, na ordem do manifest, com descrição só quando se sabe", () => {
    expect(montar().variableMeasured).toEqual([
      { "@type": "PropertyValue", name: "no_produto" },
      { "@type": "PropertyValue", name: "nu_processo", description: "Nº do processo." },
    ]);
  });

  it("palavras do corredor mais as comuns; nunca uma licença inventada", () => {
    const d = montar();
    expect(d.keywords).toEqual(["saneantes", "ANVISA", "dados abertos", "Parquet"]);
    expect(d).not.toHaveProperty("license");
  });
});

describe("TABELAS", () => {
  it("toda tabela descrita tem título, descrição com o mínimo do Google e palavras", () => {
    for (const [nome, t] of Object.entries(TABELAS)) {
      expect(t.titulo, nome).not.toBe("");
      expect(t.descricao.length, nome).toBeGreaterThanOrEqual(50);
      expect(t.palavras.length, nome).toBeGreaterThan(0);
    }
  });
});
