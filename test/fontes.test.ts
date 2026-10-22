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
const { fonte: medicamentos, predicado: predicadoMedicamentos } = await import("../src/corredores/medicamentos/fonte");
const { fonte: produtosSaude, predicado: predicadoProdutosSaude } =
  await import("../src/corredores/produtos_saude/fonte");
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

  it("texto: cada palavra por começo de palavra, em qualquer ordem; relevância antes do filtro", async () => {
    await saneantes.buscar(texto("Ypê detergente"), filtros(), 1);
    const sql = ultima();
    expect(sql).toContain(
      "CASE WHEN starts_with(busca_nome, ' ' || 'ype') AND contains(busca_nome, ' ' || 'ype') AND contains(busca_nome, ' ' || 'detergente') THEN 0",
    );
    expect(sql).toContain(
      "WHEN contains(busca_nome, ' ' || 'ype') AND contains(busca_nome, ' ' || 'detergente') THEN 1 ELSE 3 END",
    );
    expect(sql).toContain(
      "WHERE (contains(busca, ' ' || 'ype') AND contains(busca, ' ' || 'detergente')) AND situacao_registro = 'Ativo'",
    );
    expect(sql).toMatch(/LIMIT 30 OFFSET 30$/);
  });

  it("hífen e apóstrofo não atrapalham: o composto entra junto e separado", () => {
    expect(comValores(predicadoSaneantes(texto("L'Oréal anti-queda")))).toBe(
      "(contains(busca, ' ' || 'loreal') AND contains(busca, ' ' || 'anti') AND contains(busca, ' ' || 'queda') AND contains(busca, ' ' || 'antiqueda'))",
    );
    // só palavras vazias ou de uma letra: nada casa
    expect(comValores(predicadoSaneantes(texto("a de")))).toBe("false");
  });

  it("facetas: as três dimensões com os filtros certos", async () => {
    await saneantes.facetas(texto("cloro"), filtros({ grupo: "Vencida" }));
    const partes = ultima().split(" UNION ALL ");
    expect(partes).toHaveLength(3);
    for (const parte of partes) expect(parte).toContain("contains(busca, ' ' || 'cloro')");
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

  it("texto: nome, depois as marcas, antes do filtro; a marca também por palavra", async () => {
    await alimentos.buscar(texto("Whey"), filtros({ situacao: "todos" }), 0);
    const sql = ultima();
    expect(sql).toContain(
      "CASE WHEN starts_with(busca_nome, ' ' || 'whey') AND contains(busca_nome, ' ' || 'whey') THEN 0 WHEN contains(busca_nome, ' ' || 'whey') THEN 1 WHEN contains(busca_marcas_palavras, ' ' || 'whey') THEN 2 ELSE 3 END",
    );
    expect(sql).toContain("WHERE (contains(busca, ' ' || 'whey')) ORDER BY");
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
    expect(cria).toContain("WHERE starts_with(palavra, 'solar') AND contains(' ' || array_to_string(");
    expect(cria).toContain(", ' ') || ' ', ' ' || 'shampoo')");
    // um produto por processo, a linha sem registro primeiro
    expect(cria).toContain("QUALIFY row_number() OVER (PARTITION BY nu_processo ORDER BY st_registrado) = 1");
    expect(ultima()).toMatch(
      /CASE WHEN starts_with\(busca_nome, ' ' \|\| 'shampoo'\) AND contains\(busca_nome, ' ' \|\| 'shampoo'\) AND contains\(busca_nome, ' ' \|\| 'solar'\) THEN 0 .* situacao_registro = 'Ativo'/,
    );
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

describe("medicamentos", () => {
  it("número procura em processo, no registro de 9 dígitos e nos 9 primeiros do número da caixa", () => {
    const w = comValores(predicadoMedicamentos(numero("1862000180015")));
    expect(w).toContain("processo = '1862000180015'");
    expect(w).toContain("registro_produto = '1862000180015'");
    expect(w).toContain("registro_produto = substr('1862000180015', 1, 9)");
    expect(w).toContain("list_contains(eans, '1862000180015')");
  });

  it("texto: nome, depois princípio ativo, cada palavra por começo", async () => {
    await medicamentos.buscar(texto("Dipirona 500"), filtros(), 0);
    const sql = ultima();
    expect(sql).toContain(
      "CASE WHEN starts_with(busca_nome, ' ' || 'dipirona') AND contains(busca_nome, ' ' || 'dipirona') AND contains(busca_nome, ' ' || '500') THEN 0",
    );
    expect(sql).toContain(
      "WHEN contains(busca_principio, ' ' || 'dipirona') AND contains(busca_principio, ' ' || '500') THEN 2",
    );
    expect(sql).toContain(
      "FROM med) s WHERE (contains(busca, ' ' || 'dipirona') AND contains(busca, ' ' || '500')) AND situacao_registro = 'Ativo'",
    );
  });

  it("id é o registro de 9 dígitos ou o id de quem não tem registro", async () => {
    await medicamentos.porId("186200018");
    expect(ultima()).toMatch(/WHERE id = '186200018'$/);
    await medicamentos.porId("sem-registro-078f9930c52e");
    expect(ultima()).toMatch(/WHERE id = 'sem-registro-078f9930c52e'$/);
  });

  it("facetas: categoria regulatória e classe terapêutica além da situação", async () => {
    await medicamentos.facetas(texto("losartana"), filtros({ tipo: "Genérico" }));
    const partes = ultima().split(" UNION ALL ");
    expect(partes).toHaveLength(3);
    expect(partes.filter((x) => x.includes("tipo_regularizacao = 'Genérico'"))).toHaveLength(2);
  });
});

describe("você quis dizer", () => {
  it("cada palavra sem começo de palavra no corredor procura a mais próxima; sem parecida, não corrige", async () => {
    // o banco falso não acha nada: toda palavra falta e nenhuma tem parecida
    expect(await saneantes.corrigir!("Água sanitarea")).toBeNull();
    const sqls = chamadas.map(comValores);
    expect(sqls[0]).toContain("CREATE OR REPLACE TABLE san_palavras AS");
    expect(sqls[1]).toBe("SELECT 1 AS x FROM san_palavras WHERE starts_with(palavra, 'agua') LIMIT 1");
    expect(sqls[2]).toContain("WHERE abs(length(palavra) - 4) <= 1 AND damerau_levenshtein(palavra, 'agua') <= 1");
    expect(sqls[2]).toMatch(/ORDER BY damerau_levenshtein\(palavra, 'agua'\), n DESC, palavra LIMIT 1$/);
    expect(sqls).toHaveLength(3); // "agua" sem parecida já decide
  });

  it("os cosméticos só corrigem com o palavras.parquet no índice", async () => {
    expect(await cosmeticos.corrigir!("shampo")).toBeNull();
    expect(chamadas.some((c) => c.sql.includes("cos_palavras"))).toBe(false);
  });
});

describe("produtos para saúde", () => {
  it("número procura em processo e no registro, sem zeros à esquerda", () => {
    const w = comValores(predicadoProdutosSaude(numero("08003400137")));
    expect(w).toContain("processo = '08003400137'");
    expect(w).toContain("ltrim(registro, '0') = ltrim('08003400137', '0')");
  });

  it("texto: nome, depois nome técnico", async () => {
    await produtosSaude.buscar(texto("Sonda"), filtros({ grupo: "Classe II" }), 0);
    const sql = ultima();
    expect(sql).toContain("WHEN contains(busca_tecnico, ' ' || 'sonda') THEN 2");
    expect(sql).toContain(
      "WHERE (contains(busca, ' ' || 'sonda')) AND situacao_registro = 'Ativo' AND grupo = 'Classe II'",
    );
  });
});

describe("id inválido", () => {
  it("não existe em nenhum corredor e não consulta nada", async () => {
    expect(await alimentos.porId("abc")).toBeNull();
    expect(await saneantes.porId("12a")).toBeNull();
    expect(await cosmeticos.porId("x1")).toBeNull();
    expect(await medicamentos.porId("sem-registro-xyz")).toBeNull();
    expect(await produtosSaude.porId("10163770014x")).toBeNull();
    expect(chamadas).toHaveLength(0);
  });
});
