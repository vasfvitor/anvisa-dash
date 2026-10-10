// O SQL das fontes sem DuckDB: o banco é trocado por um que só anota cada consulta, e o teste confere a
// consulta com os parâmetros no lugar dos `?`. Assim um parâmetro na posição errada aparece no texto.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Consulta } from "../src/lib/detect";
import { FILTROS_PADRAO, type Filtros } from "../src/lib/fonte";

interface Chamada {
  sql: string;
  params: unknown[];
}

const { chamadas } = vi.hoisted(() => ({ chamadas: [] as Chamada[] }));

// os cosméticos leem um índice e baixam pedaços: aqui um índice mínimo e nomes de arquivo previsíveis
const INDICE = {
  versao: 1,
  palavras: [
    ["aaa", 10, "palavras/0000.parquet", 100],
    ["shampoo", 4000, "palavras/0001.parquet", 2000],
    ["solar", 30, "palavras/0002.parquet", 300],
  ],
  empresas: [["00000000000191", 3000, "empresas/000.parquet", 900]],
  numeros: { "844": 45 },
  empresas_parquet: 1000,
};

vi.mock("../src/lib/db", () => ({
  carregar: () => Promise.resolve(),
  buildAtual: () => Promise.resolve("teste"),
  iniciar: () =>
    Promise.resolve({
      tables: { cosmeticos: { busca: { versao: 1, indice: "data/b/cosmeticos/indice.json", bytes: 1, sha256: "x" } } },
    }),
  baixarJson: () => Promise.resolve(INDICE),
  baixarArquivo: (caminho: string) => Promise.resolve(caminho.replaceAll("/", "_")),
  consultar: (_tabelas: string[], sql: string, params: unknown[] = []) => {
    chamadas.push({ sql, params });
    return Promise.resolve([]);
  },
}));

const { fonte: alimentos, predicado: predicadoAlimentos } = await import("../src/corredores/alimentos/fonte");
const { fonte: saneantes, predicado: predicadoSaneantes } = await import("../src/corredores/saneantes/fonte");
const { fonte: cosmeticos } = await import("../src/corredores/cosmeticos/fonte");
const { onde } = await import("../src/lib/sql");

/** SQL com cada `?` trocado pelo valor (texto entre aspas), em uma linha. */
function comValores({ sql, params }: Chamada): string {
  let i = 0;
  // `?` dentro de string SQL (o regex das palavras tem "(?:") não é parâmetro
  const texto = sql.replace(/'(?:[^']|'')*'|\?/g, (m) => {
    if (m !== "?") return m;
    const v = params[i++];
    return typeof v === "string" ? `'${v}'` : String(v);
  });
  expect(i, "um parâmetro para cada ?").toBe(params.length);
  return texto.replace(/\s+/g, " ");
}

function ultima(): string {
  const c = chamadas.at(-1);
  if (!c) throw new Error("nenhuma consulta");
  return comValores(c);
}

const filtros = (f: Partial<Filtros> = {}): Filtros => ({ ...FILTROS_PADRAO, ...f });
const texto = (valor: string): Consulta => ({ modo: "texto", valor });
const numero = (valor: string): Consulta => ({ modo: "numero", valor });

beforeEach(() => {
  chamadas.length = 0;
});

describe("onde", () => {
  const p = { sql: "contains(busca, ?)", params: ["whey"] };

  it("situação ativo e inativo viram os valores publicados; todos não filtra", () => {
    expect(comValores(onde(p, filtros()))).toBe("contains(busca, 'whey') AND situacao_registro = 'Ativo'");
    expect(comValores(onde(p, filtros({ situacao: "inativo" })))).toContain("situacao_registro = 'Inativo'");
    expect(comValores(onde(p, filtros({ situacao: "todos" })))).toBe("contains(busca, 'whey')");
  });

  it("cada faceta conta sem o próprio filtro", () => {
    const f = filtros({ grupo: "Vencida", tipo: "Notificado" });
    expect(comValores(onde(p, f, "grupo"))).not.toContain("grupo =");
    expect(comValores(onde(p, f, "grupo"))).toContain("tipo_regularizacao = 'Notificado'");
    expect(comValores(onde(p, f, "tipo"))).not.toContain("tipo_regularizacao");
    expect(comValores(onde(p, f, "situacao"))).not.toContain("situacao_registro");
  });
});

describe("saneantes", () => {
  it("número procura em processo, registro e expediente (sem zeros à esquerda)", () => {
    const w = comValores(predicadoSaneantes(numero("0012345678")));
    expect(w).toContain("nu_processo = '0012345678'");
    expect(w).toContain("nu_registro_produto = '0012345678'");
    expect(w).toContain("ltrim(nu_expediente, '0') = ltrim('0012345678', '0')");
  });

  it("CNPJ também casa com processo de 14 dígitos", () => {
    expect(comValores(predicadoSaneantes({ modo: "cnpj", valor: "33122466000704" }))).toBe(
      "(nu_cnpj_empresa = '33122466000704' OR nu_processo = '33122466000704')",
    );
  });

  it("texto: relevância e filtro com o termo normalizado, na ordem certa", async () => {
    await saneantes.buscar(texto("Ypê"), filtros(), 1);
    const sql = ultima();
    expect(sql).toContain("CASE WHEN starts_with(busca_nome, 'ype') THEN 0 WHEN contains(busca_nome, 'ype') THEN 1");
    expect(sql).toContain("WHERE contains(busca, 'ype') AND situacao_registro = 'Ativo'");
    expect(sql).toMatch(/LIMIT 30 OFFSET 30$/);
  });

  it("facetas: as três dimensões com os filtros certos", async () => {
    await saneantes.facetas(texto("cloro"), filtros({ grupo: "Vencida" }));
    const partes = ultima().split(" UNION ALL ");
    expect(partes).toHaveLength(3);
    for (const parte of partes) expect(parte).toContain("contains(busca, 'cloro')");
    const grupo = partes.find((x) => x.includes("'grupo' AS dim"));
    expect(grupo).not.toContain("grupo = 'Vencida'");
    expect(partes.filter((x) => x.includes("grupo = 'Vencida'"))).toHaveLength(2);
  });
});

describe("alimentos", () => {
  it("número procura em processo e nos registros", () => {
    const w = comValores(predicadoAlimentos(numero("25351453332202410")));
    expect(w).toContain("nu_processo = '25351453332202410'");
    expect(w).toContain("list_contains(registros, '25351453332202410')");
  });

  it("marca escolhida casa a marca inteira", () => {
    expect(comValores(predicadoAlimentos({ modo: "marca", valor: "Max Titanium" }))).toBe(
      "contains(busca_marcas, ';' || 'max titanium' || ';')",
    );
  });

  it("texto: relevância por marca e nome antes do filtro", async () => {
    await alimentos.buscar(texto("Whey"), filtros({ situacao: "todos" }), 0);
    const sql = ultima();
    expect(sql).toContain(
      "CASE WHEN contains(busca_marcas, ';' || 'whey' || ';') THEN 0 WHEN contains(busca_marcas, ';' || 'whey') THEN 1 WHEN contains(busca_nome, 'whey') THEN 2",
    );
    expect(sql).toContain("WHERE contains(busca, 'whey') ORDER BY");
    expect(sql).toMatch(/OFFSET 0$/);
  });

  it("produto por id é número", async () => {
    await alimentos.porId("4000581");
    expect(ultima()).toMatch(/WHERE co_seq_produto = 4000581$/);
  });
});

describe("cosméticos", () => {
  it("texto: uma tabela da busca com a palavra mais rara e as outras como parâmetro", async () => {
    await cosmeticos.buscar(texto("Shampoo Solar"), filtros(), 0);
    const cria = chamadas.map(comValores).find((s) => s.startsWith("CREATE OR REPLACE TABLE cos_q"))!;
    expect(cria).toContain("read_parquet(['data_b_cosmeticos_palavras_0002.parquet'])");
    expect(cria).toContain("WHERE starts_with(palavra, 'solar') AND len(list_filter(");
    expect(cria).toContain("lambda w: starts_with(w, 'shampoo'))) > 0");
    // um produto por processo, a linha sem registro primeiro
    expect(cria).toContain("QUALIFY row_number() OVER (PARTITION BY nu_processo ORDER BY st_registrado) = 1");
    expect(ultima()).toMatch(/CASE WHEN starts_with\(busca_nome, 'shampoo'\) THEN 0 .* situacao_registro = 'Ativo'/);
    expect(ultima()).toMatch(/OFFSET 0$/);
  });

  it("filtro novo na mesma busca reusa a tabela", async () => {
    await cosmeticos.buscar(texto("solar"), filtros(), 0);
    const antes = chamadas.filter((c) => c.sql.startsWith("CREATE OR REPLACE TABLE cos_q")).length;
    await cosmeticos.facetas(texto("solar"), filtros({ grupo: "Vencida" }));
    expect(chamadas.filter((c) => c.sql.startsWith("CREATE OR REPLACE TABLE cos_q")).length).toBe(antes);
  });

  it("número lê numeros/<3 últimos> por num", async () => {
    await cosmeticos.buscar(numero("25351892332200844"), filtros(), 0);
    const cria = chamadas.map(comValores).find((s) => s.startsWith("CREATE OR REPLACE TABLE cos_q"))!;
    expect(cria).toContain("read_parquet(['data_b_cosmeticos_numeros_844.parquet']) WHERE num = '25351892332200844'");
  });

  it("sem palavra de 3 letras não consulta nada", async () => {
    expect(await cosmeticos.buscar(texto("2 em 1"), filtros(), 0)).toEqual([]);
    expect(chamadas.some((c) => c.sql.includes("cos_q"))).toBe(false);
  });
});

describe("id inválido", () => {
  it("não existe em nenhum corredor e não consulta nada", async () => {
    expect(await alimentos.porId("abc")).toBeNull();
    expect(await saneantes.porId("12a")).toBeNull();
    expect(await cosmeticos.porId("x1")).toBeNull();
    expect(chamadas).toHaveLength(0);
  });
});
