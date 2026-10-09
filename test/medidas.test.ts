// O SQL das medidas sem DuckDB (como em fontes.test.ts): o banco só anota cada consulta, e o teste a
// confere com os parâmetros no lugar dos `?`. O manifest de mentira diz se a tabela foi publicada.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Chamada {
  sql: string;
  params: unknown[];
}

const estado = vi.hoisted(() => ({ chamadas: [] as Chamada[], publicada: true }));

vi.mock("../src/lib/db", () => ({
  carregar: () => Promise.resolve(),
  buildAtual: () => Promise.resolve("teste"),
  iniciar: () => Promise.resolve({ tables: estado.publicada ? { produtos_irregulares: {} } : {} }),
  consultar: (_tabelas: string[], sql: string, params: unknown[] = []) => {
    estado.chamadas.push({ sql, params });
    return Promise.resolve([]);
  },
}));

const { buscarMedidas, medidasPorEmpresa, porRegistro, predicado, recentes } = await import("../src/lib/medidas");

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
    expect(sql({ modo: "numero", valor: "341750056" })).toBe("(processo = '341750056' OR registro = '341750056')");
    expect(sql({ modo: "texto", valor: "Água Sanitária" })).toBe("contains(busca, 'agua sanitaria')");
    expect(sql({ modo: "todos", valor: "" })).toBeNull();
  });

  it("toda consulta começa pelo tipo do corredor", async () => {
    await buscarMedidas(3, { modo: "texto", valor: "biojet" }, 1);
    await recentes(6);
    await porRegistro(3, "341750056");
    await medidasPorEmpresa(6, ["29822523000103"]);
    const qs = consultas();
    expect(qs).toHaveLength(4);
    expect(qs[0]).toContain("WHERE tipo = 3 AND contains(busca, 'biojet')");
    expect(qs[0]).toMatch(/LIMIT 20 OFFSET 20$/);
    expect(qs[1]).toContain("WHERE tipo = 6 ORDER BY");
    expect(qs[2]).toContain("WHERE tipo = 3 AND registro = '341750056'");
    expect(qs[3]).toContain("WHERE tipo = 6 AND cnpj IN ('29822523000103')");
  });

  it("o registro do produto não casa com o processo da medida", async () => {
    await porRegistro(3, "341750056");
    const onde = consultas()[0]!.split(" WHERE ")[1];
    expect(onde).toContain("registro = '341750056'");
    expect(onde).not.toContain("processo");
  });

  it("CNPJ inválido nem entra na consulta; sem nenhum válido, não consulta", async () => {
    await medidasPorEmpresa(3, ["abc'; DROP", "123"]);
    expect(estado.chamadas).toHaveLength(0);
    await medidasPorEmpresa(3, ["43461789000190", "x", "43461789000190"]);
    expect(consultas()[0]).toContain("cnpj IN ('43461789000190')");
  });

  it("pessoa nunca aparece pelo nome", async () => {
    await recentes(3);
    expect(consultas()[0]).toContain("CASE WHEN pessoa THEN NULL ELSE empresa END AS empresa");
  });

  it("sem a tabela no manifest, nada é consultado e tudo volta vazio", async () => {
    estado.publicada = false;
    expect(await buscarMedidas(3, { modo: "texto", valor: "biojet" })).toEqual([]);
    expect(await recentes(3)).toEqual([]);
    expect(await porRegistro(3, "341750056")).toEqual([]);
    expect(await medidasPorEmpresa(3, ["43461789000190"])).toEqual(new Map());
    expect(estado.chamadas).toHaveLength(0);
  });
});
