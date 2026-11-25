// O SQL das medidas sem DuckDB (como em fontes.test.ts): o banco só anota cada consulta, e o teste a
// confere com os parâmetros no lugar dos `?`. O manifest de mentira diz se a tabela foi publicada.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { faltaMedidas } from "../src/lib/consultas";
import type { Medida } from "../src/lib/medidas";

interface Chamada {
  sql: string;
  params: unknown[];
}

const estado = vi.hoisted(() => ({ chamadas: [] as Chamada[], publicada: true }));

vi.mock("../src/lib/db", () => ({
  carregar: () => Promise.resolve(),
  buildAtual: () => Promise.resolve("teste"),
  iniciar: () => Promise.resolve({ built_at: "2026-11-21T01:52:19Z", tables: estado.publicada ? { medidas: {} } : {} }),
  consultar: (_tabelas: string[], sql: string, params: unknown[] = []) => {
    estado.chamadas.push({ sql, params });
    return Promise.resolve([]);
  },
}));

const {
  ausencia,
  avisoDoProduto,
  blocoDaBusca,
  buscarMedidas,
  ERRO_EMPRESA,
  ERRO_MARCAS,
  ERRO_MEDIDAS,
  ERRO_PRODUTO,
  medidasPorEmpresa,
  porRegistro,
  predicado,
  recentes,
} = await import("../src/lib/medidas");

function comValores({ sql, params }: Chamada): string {
  let i = 0;
  const texto = sql.replace(/\?/g, () => {
    const v = params[i++];
    return typeof v === "string" ? `'${v}'` : String(v);
  });
  expect(i, "um parâmetro para cada ?").toBe(params.length);
  return texto.replace(/\s+/g, " ");
}

/** As consultas desta chamada, sem a criação da tabela derivada. */
const consultas = () => estado.chamadas.filter((c) => !c.sql.includes("CREATE")).map(comValores);

beforeEach(() => {
  estado.chamadas.length = 0;
  estado.publicada = true;
});

describe("medidas", () => {
  it("cada modo de consulta procura no lugar certo; navegar por grupo não procura", () => {
    const sql = (q: Parameters<typeof predicado>[0]) => {
      const p = predicado(q);
      return p && comValores(p);
    };
    expect(sql({ modo: "cnpj", valor: "43694232000108" })).toBe("cnpj = '43694232000108'");
    expect(sql({ modo: "numero", valor: "341750056" })).toBe(
      "(processo = '341750056' OR list_contains(registros, '341750056'))",
    );
    expect(sql({ modo: "texto", valor: "Água Sanitária" })).toBe(
      "(contains(busca, ' ' || 'agua') AND contains(busca, ' ' || 'sanitaria'))",
    );
    expect(sql({ modo: "todos", valor: "" })).toBeNull();
  });

  it("por número, também os registros dos produtos achados (sem repetir o próprio número)", async () => {
    const q = { modo: "numero", valor: "1208030256" } as const;
    expect(comValores(predicado(q, ["341750056", "341750056", "1208030256", "300000001"])!)).toBe(
      "(processo = '1208030256' OR list_contains(registros, '1208030256') OR list_has_any(registros, ['341750056', '300000001']))",
    );
    await buscarMedidas(3, q, 0, ["341750056"]);
    expect(consultas()[0]).toContain(
      "WHERE tipo = 3 AND (processo = '1208030256' OR list_contains(registros, '1208030256') OR list_has_any(registros, ['341750056']))",
    );
  });

  it("toda consulta começa pelo tipo do corredor", async () => {
    await buscarMedidas(3, { modo: "texto", valor: "biojet" }, 1);
    await recentes(6);
    await porRegistro(3, "341750056");
    await medidasPorEmpresa(6, ["29822523000103"]);
    const qs = consultas();
    expect(qs).toHaveLength(4);
    expect(qs[0]).toContain("WHERE tipo = 3 AND (contains(busca, ' ' || 'biojet'))");
    expect(qs[0]).toMatch(/LIMIT 20 OFFSET 20$/);
    expect(qs[1]).toContain("WHERE tipo = 6 ORDER BY");
    expect(qs[2]).toContain("WHERE tipo = 3 AND list_contains(registros, '341750056')");
    expect(qs[3]).toContain("WHERE tipo = 6 AND cnpj IN ('29822523000103')");
  });

  it("o registro do produto não casa com o processo da medida", async () => {
    await porRegistro(3, "341750056");
    const onde = consultas()[0]!.split(" WHERE ")[1];
    expect(onde).toContain("list_contains(registros, '341750056')");
    expect(onde).not.toContain("processo");
  });

  it("CNPJ inválido nem entra na consulta; sem nenhum válido, não consulta", async () => {
    await medidasPorEmpresa(3, ["abc'; DROP", "123"]);
    expect(estado.chamadas).toHaveLength(0);
    await medidasPorEmpresa(3, ["43461789000190", "x", "43461789000190"]);
    expect(consultas()[0]).toContain("cnpj IN ('43461789000190')");
  });

  it("sem a tabela no manifest, nada é consultado e tudo volta vazio", async () => {
    estado.publicada = false;
    expect(await buscarMedidas(3, { modo: "texto", valor: "biojet" })).toEqual([]);
    expect(await recentes(3)).toEqual([]);
    expect(await porRegistro(3, "341750056")).toEqual([]);
    expect(await medidasPorEmpresa(3, ["43461789000190"])).toEqual(new Map());
    expect(estado.chamadas).toHaveLength(0);
  });

  it("without the table, says so with the date of the build's files; with it, nothing", async () => {
    // 01:52 UTC on the 21st is still the 20th in Brasília, the day the about page gives for the same build
    const falta =
      "As medidas de fiscalização da ANVISA não estão nos arquivos convertidos para Parquet em 20/11/2026, então o site não tem como mostrá-las.";
    estado.publicada = false;
    expect(await ausencia()).toBe(falta);
    expect(faltaMedidas({ built_at: "2026-11-21T01:52:19Z", tables: {} })).toBe(falta);
    estado.publicada = true;
    expect(await ausencia()).toBe("");
  });
});

describe("blocoDaBusca", () => {
  const medida = { id: "1" } as Medida;

  it("an earlier search's measures never show under new results, even when the cards' count failed", () => {
    expect(blocoDaBusca(false, [medida], false, "algumas")).toEqual({ itens: [], erros: [ERRO_MARCAS.algumas] });
    expect(blocoDaBusca(false, [medida], true, null)).toEqual({ itens: [], erros: [] });
  });

  it("the same search shows its measures and says each failure in its own words", () => {
    expect(blocoDaBusca(true, [medida], false, null)).toEqual({ itens: [medida], erros: [] });
    expect(blocoDaBusca(true, [], true, "todas")).toEqual({ itens: [], erros: [ERRO_MEDIDAS, ERRO_MARCAS.todas] });
  });

  it("a manifest without the table is said in the block, for any search, in place of everything else", () => {
    expect(blocoDaBusca(false, [], false, null, "sem tabela")).toEqual({ itens: [], erros: ["sem tabela"] });
    expect(blocoDaBusca(true, [], true, "todas", "sem tabela")).toEqual({ itens: [], erros: ["sem tabela"] });
  });
});

describe("avisoDoProduto", () => {
  const medida = { id: "1" } as Medida;
  const ok = <T>(value: T): PromiseSettledResult<T> => ({ status: "fulfilled", value });
  const falhou: PromiseSettledResult<never> = { status: "rejected", reason: new Error("rede") };
  const cnpj = "11111111000111";

  it("a failed company count never hides the product's own measures", () => {
    expect(avisoDoProduto(ok([medida]), falhou, cnpj)).toEqual({ doProduto: [medida], daEmpresa: 0, erro: "" });
  });

  it("names the lookup that failed, and keeps the one that loaded", () => {
    expect(avisoDoProduto(falhou, ok(new Map([[cnpj, 3]])), cnpj)).toEqual({
      doProduto: [],
      daEmpresa: 3,
      erro: ERRO_PRODUTO,
    });
    expect(avisoDoProduto(ok([]), falhou, cnpj)).toEqual({ doProduto: [], daEmpresa: 0, erro: ERRO_EMPRESA });
    expect(avisoDoProduto(falhou, falhou, cnpj).erro).toBe(ERRO_MEDIDAS);
    expect(avisoDoProduto(ok([]), ok(new Map()), cnpj)).toEqual({ doProduto: [], daEmpresa: 0, erro: "" });
  });

  it("a manifest without the table is said, never left looking like a product with no measures", () => {
    expect(avisoDoProduto(ok([]), ok(new Map()), cnpj, "sem tabela")).toEqual({
      doProduto: [],
      daEmpresa: 0,
      erro: "sem tabela",
    });
  });
});
