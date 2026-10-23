import { describe, expect, it } from "vitest";
import {
  agrupar,
  indexavel,
  LETRAS,
  letraDe,
  porLetra,
  PRODUTOS_PARA_INDEXAR,
  resumo,
  totalProdutos,
  type Entrada,
} from "../src/lib/estatico/empresas";

const CNPJ_A = "11111111000111";
const CNPJ_B = "22222222000122";

const alimento = (id: number, nome: string, ativo: boolean, cnpj = CNPJ_A, empresa = "EMPRESA A LTDA") => ({
  id,
  nome,
  marcas: null,
  categoria: "Suplementos alimentares",
  ativo,
  tipo: "Notificado",
  processo: `2535100000000000${id}`,
  registro: null,
  desde: "2026-09-04",
  apresentacoes: 1,
  cnpj,
  empresa,
});

const saneante = (id: string, nome: string, ativo: boolean, cnpj = CNPJ_A, empresa = "EMPRESA A LTDA") => ({
  id,
  nome,
  ativo,
  tipo: "Registrado",
  processo: "25351000000000000",
  registro: "300000000",
  vencimento: "2030-01-01",
  grupo: "Em dia",
  cnpj,
  empresa,
});

const medida = (produto: string, data: string, cnpj = CNPJ_A, empresa = "EMPRESA A LTDA") => ({
  corredor: "alimentos" as const,
  produto,
  acoes: ["Proibição"],
  data,
  cnpj,
  empresa,
});

const fabricacao = (
  cnpj: string,
  empresa: string,
  vinculo: "propria" | "grupo" | "terceira" | "exterior",
  fabricante: string,
  fabricanteCnpj: string | null,
  produtos = 1,
  outros: { codigo?: string | null; cidade?: string | null; pais?: string | null; ativos?: number } = {},
) => ({
  cnpj,
  empresa,
  fabricanteCnpj,
  fabricanteCodigo: outros.codigo ?? null,
  fabricante,
  cidade: outros.cidade === undefined ? (vinculo === "exterior" ? null : "SÃO PAULO") : outros.cidade,
  pais: outros.pais === undefined ? (vinculo === "exterior" ? "CHILE" : "BRASIL") : outros.pais,
  vinculo,
  produtos,
  produtosAtivos: outros.ativos ?? produtos,
  apresentacoes: produtos,
});

const vazio: Entrada = { alimentos: [], saneantes: [], cosmeticos: [], cosmeticosTotais: [], medidas: [] };

describe("agrupar", () => {
  it("uma empresa por CNPJ, com os produtos dos dois corredores", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true), alimento(2, "CREATINA", true, CNPJ_B, "EMPRESA B")],
      saneantes: [saneante("0001", "DETERGENTE", true)],
    });
    expect([...m.keys()].sort()).toEqual([CNPJ_A, CNPJ_B]);
    expect(m.get(CNPJ_A)!.alimentos.map((p) => p.id)).toEqual([1]);
    expect(m.get(CNPJ_A)!.saneantes.map((p) => p.id)).toEqual(["0001"]);
    // a linha guardada não carrega o CNPJ nem o nome da empresa de novo
    expect(m.get(CNPJ_A)!.alimentos[0]).not.toHaveProperty("cnpj");
  });

  it("liberados primeiro, depois por nome", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "ÔMEGA", true), alimento(2, "ALFA", false), alimento(3, "BETA", true)],
    });
    expect(m.get(CNPJ_A)!.alimentos.map((p) => p.nome)).toEqual(["BETA", "ÔMEGA", "ALFA"]);
  });

  it("o nome da empresa é o mais frequente, com desempate alfabético", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "A", true, CNPJ_A, "Empresa A Ltda"), alimento(2, "B", true, CNPJ_A, "EMPRESA A LTDA")],
      saneantes: [saneante("1", "C", true, CNPJ_A, "EMPRESA A LTDA")],
    });
    expect(m.get(CNPJ_A)!.nome).toBe("EMPRESA A LTDA");
    const empate = agrupar({
      ...vazio,
      alimentos: [alimento(1, "A", true, CNPJ_A, "Zeta"), alimento(2, "B", true, CNPJ_A, "Alfa")],
    });
    expect(empate.get(CNPJ_A)!.nome).toBe("Alfa");
  });

  it("CNPJ inválido fica de fora", () => {
    const m = agrupar({ ...vazio, alimentos: [alimento(1, "X", true, "123"), alimento(2, "Y", true, "")] });
    expect(m.size).toBe(0);
  });

  it("medidas da mais recente para a mais antiga", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true)],
      medidas: [medida("VELHA", "2024-01-01"), medida("NOVA", "2026-10-05")],
    });
    expect(m.get(CNPJ_A)!.medidas.map((x) => x.produto)).toEqual(["NOVA", "VELHA"]);
  });

  it("empresa só com medidas também tem página, com o nome das medidas", () => {
    const m = agrupar({
      ...vazio,
      medidas: [
        medida("X", "2026-01-01", CNPJ_B, "Empresa B Ltda"),
        medida("Y", "2026-02-01", CNPJ_B, "EMPRESA B LTDA"),
        medida("Z", "2026-03-01", CNPJ_B, "EMPRESA B LTDA"),
      ],
    });
    const b = m.get(CNPJ_B)!;
    expect(b.nome).toBe("EMPRESA B LTDA");
    expect(b.alimentos).toEqual([]);
    expect(b.medidas).toHaveLength(3);
  });

  it("com produto, o nome vem dos produtos, não das medidas", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true, CNPJ_A, "Nome Do Produto Ltda")],
      medidas: [medida("X", "2026-01-01", CNPJ_A, "OUTRO NOME"), medida("Y", "2026-01-02", CNPJ_A, "OUTRO NOME")],
    });
    expect(m.get(CNPJ_A)!.nome).toBe("Nome Do Produto Ltda");
  });

  it("medida sem nome de empresa não vira nome vazio quando há outro", () => {
    const m = agrupar({
      ...vazio,
      medidas: [medida("X", "2026-01-01", CNPJ_B, ""), medida("Y", "2026-01-02", CNPJ_B)],
    });
    expect(m.get(CNPJ_B)!.nome).toBe("EMPRESA A LTDA");
  });
});

describe("resumo", () => {
  it("conta produtos e liberados por corredor", () => {
    const emp = agrupar({
      ...vazio,
      alimentos: [alimento(1, "A", true), alimento(2, "B", false)],
      saneantes: [saneante("1", "C", true)],
    }).get(CNPJ_A)!;
    expect(resumo(emp)).toEqual({
      alimentos: 2,
      alimentosAtivos: 1,
      saneantes: 1,
      saneantesAtivos: 1,
      cosmeticos: 0,
      cosmeticosAtivos: 0,
      medicamentos: 0,
      medicamentosAtivos: 0,
      produtosSaude: 0,
      produtosSaudeAtivos: 0,
      medidas: 0,
      envasaPara: 0,
      envasadoPor: 0,
      exterior: 0,
    });
  });

  it("remédios e dispositivos médicos contam como as outras áreas e entram na indexação", () => {
    const m = agrupar({
      ...vazio,
      medicamentos: [saneante("186200018", "NOVALGINA", true), saneante("101810583", "NORFLOXACINO", false)],
      produtosSaude: [saneante("10163770014", "PRESERV EXTRA", true, CNPJ_B, "EMPRESA B LTDA")],
    });
    const a = m.get(CNPJ_A)!;
    expect(a.medicamentos.map((p) => p.nome)).toEqual(["NOVALGINA", "NORFLOXACINO"]); // liberados antes
    expect(resumo(a)).toMatchObject({ medicamentos: 2, medicamentosAtivos: 1, produtosSaude: 0 });
    expect(totalProdutos(a)).toBe(2);
    expect(indexavel(a)).toBe(true); // dois produtos: o mínimo (PRODUTOS_PARA_INDEXAR)
    const b = m.get(CNPJ_B)!;
    expect(resumo(b)).toMatchObject({ produtosSaude: 1, produtosSaudeAtivos: 1, medicamentos: 0 });
    expect(b.nome).toBe("EMPRESA B LTDA");
  });

  it("entrada sem as áreas novas (build de dados anterior) continua valendo", () => {
    const antiga: Entrada = { ...vazio, alimentos: [alimento(1, "A", true)] };
    delete antiga.medicamentos;
    delete antiga.produtosSaude;
    const emp = agrupar(antiga).get(CNPJ_A)!;
    expect(emp.medicamentos).toEqual([]);
    expect(emp.produtosSaude).toEqual([]);
  });

  it("cosméticos contam pelos totais, não pela lista cortada", () => {
    const emp = agrupar({
      ...vazio,
      cosmeticos: [
        saneante("25351000000000001", "SHAMPOO", true),
        saneante("25351000000000002", "CONDICIONADOR", false),
      ],
      cosmeticosTotais: [{ cnpj: CNPJ_A, produtos: 1200, ativos: 900 }],
    }).get(CNPJ_A)!;
    expect(emp.cosmeticos.map((p) => p.nome)).toEqual(["SHAMPOO", "CONDICIONADOR"]);
    expect(resumo(emp)).toMatchObject({ cosmeticos: 1200, cosmeticosAtivos: 900 });
  });

  it("totais de CNPJ sem linha não criam empresa", () => {
    const m = agrupar({ ...vazio, cosmeticosTotais: [{ cnpj: CNPJ_B, produtos: 3, ativos: 1 }] });
    expect(m.size).toBe(0);
  });
});

describe("indexavel", () => {
  it("só com medidas, ou com um produto só, a página fica fora do índice e do sitemap", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "A", false)],
      medidas: [medida("X", "2026-01-01"), medida("Y", "2026-02-01", CNPJ_B, "EMPRESA B")],
    });
    expect(indexavel(m.get(CNPJ_A)!)).toBe(false);
    expect(indexavel(m.get(CNPJ_B)!)).toBe(false);
  });

  it("os produtos somam entre corredores, e os cosméticos contam pelos totais", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "A", true)],
      saneantes: [saneante("1", "C", false)],
      cosmeticos: [saneante("25351000000000001", "SHAMPOO", true, CNPJ_B, "EMPRESA B")],
      cosmeticosTotais: [{ cnpj: CNPJ_B, produtos: PRODUTOS_PARA_INDEXAR, ativos: 1 }],
    });
    expect(indexavel(m.get(CNPJ_A)!)).toBe(true);
    expect(indexavel(m.get(CNPJ_B)!)).toBe(true);
  });
});

describe("fabricação", () => {
  const CNPJ_C = "33333333000133";
  const CNPJ_D = "44444444000144";

  it("envase por terceira liga os dois lados e dá página à envasadora sem produto, com o nome da apresentação", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true)],
      fabricacao: [fabricacao(CNPJ_A, "EMPRESA A LTDA", "terceira", "ENVASA BEM LTDA", CNPJ_C, 3, { ativos: 2 })],
    });
    const a = m.get(CNPJ_A)!;
    const c = m.get(CNPJ_C)!;
    expect(c.nome).toBe("ENVASA BEM LTDA");
    expect(totalProdutos(c)).toBe(0);
    expect(a.envasadoPor).toEqual([
      {
        cnpj: CNPJ_C,
        nome: "ENVASA BEM LTDA",
        cidade: "SÃO PAULO",
        pais: "BRASIL",
        vinculo: "terceira",
        produtos: 3,
        produtosAtivos: 2,
      },
    ]);
    expect(c.envasaPara).toEqual([
      {
        cnpj: CNPJ_A,
        nome: "EMPRESA A LTDA",
        cidade: null,
        pais: null,
        vinculo: "terceira",
        produtos: 3,
        produtosAtivos: 2,
      },
    ]);
    expect(a.envasaPara).toEqual([]);
    expect(c.envasadoPor).toEqual([]);
  });

  it("a empresa que envasa o que é dela não cria nada", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true)],
      fabricacao: [fabricacao(CNPJ_A, "EMPRESA A LTDA", "propria", "EMPRESA A LTDA", CNPJ_A)],
    });
    expect([...m.keys()]).toEqual([CNPJ_A]);
    expect(m.get(CNPJ_A)!).toMatchObject({ envasaPara: [], envasadoPor: [], exterior: [] });
  });

  it("outra filial do grupo fica marcada como grupo dos dois lados", () => {
    const filial = "11111111000292";
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true)],
      fabricacao: [fabricacao(CNPJ_A, "EMPRESA A LTDA", "grupo", "EMPRESA A LTDA", filial)],
    });
    expect(m.get(CNPJ_A)!.envasadoPor.map((x) => [x.cnpj, x.vinculo])).toEqual([[filial, "grupo"]]);
    expect(m.get(filial)!.envasaPara.map((x) => [x.cnpj, x.vinculo])).toEqual([[CNPJ_A, "grupo"]]);
  });

  it("fabricante no exterior: um por nome e país, com os códigos juntos, sem somar produtos e sem página", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true)],
      fabricacao: [
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "exterior", "NESTLÉ MÉXICO", null, 4, {
          codigo: "D000001",
          pais: "MÉXICO",
        }),
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "exterior", "NESTLÉ MÉXICO", null, 2, {
          codigo: "D000002",
          pais: "MÉXICO",
        }),
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "exterior", "NESTLÉ MÉXICO", null, 1, {
          codigo: "D000003",
          pais: "CHILE",
        }),
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "exterior", "ALFA FOODS", null, 1, { pais: null }),
      ],
    });
    expect([...m.keys()]).toEqual([CNPJ_A]);
    expect(m.get(CNPJ_A)!.exterior).toEqual([
      { nome: "ALFA FOODS", pais: null, codigos: [] },
      { nome: "NESTLÉ MÉXICO", pais: "CHILE", codigos: ["D000003"] },
      { nome: "NESTLÉ MÉXICO", pais: "MÉXICO", codigos: ["D000001", "D000002"] },
    ]);
  });

  it("os dois lados mostram o nome que a empresa tem nos produtos, e a lista vai de mais a menos produtos", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [
        alimento(1, "WHEY", true),
        alimento(2, "CREATINA", true, CNPJ_B, "EMPRESA B LTDA"),
        alimento(3, "PROTEÍNA", true, CNPJ_C, "ENVASADORA C S.A."),
      ],
      fabricacao: [
        fabricacao(CNPJ_A, "EMPRESA A", "terceira", "ENVASADORA C SA - EPP", CNPJ_C, 1),
        fabricacao(CNPJ_B, "EMPRESA B", "terceira", "ENVASADORA C", CNPJ_C, 5),
      ],
    });
    const c = m.get(CNPJ_C)!;
    expect(c.nome).toBe("ENVASADORA C S.A.");
    expect(c.envasaPara.map((x) => [x.nome, x.produtos])).toEqual([
      ["EMPRESA B LTDA", 5],
      ["EMPRESA A LTDA", 1],
    ]);
    expect(m.get(CNPJ_A)!.envasadoPor.map((x) => x.nome)).toEqual(["ENVASADORA C S.A."]);
  });

  it("a envasadora sem produto entra no índice com duas clientes de fora do grupo, não com uma", () => {
    const filial = "33333333000214";
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true), alimento(2, "CREATINA", true, CNPJ_B, "EMPRESA B LTDA")],
      fabricacao: [
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "terceira", "ENVASA BEM LTDA", CNPJ_C),
        fabricacao(CNPJ_B, "EMPRESA B LTDA", "terceira", "ENVASA BEM LTDA", CNPJ_C),
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "terceira", "SÓ UMA LTDA", CNPJ_D),
        fabricacao("33333333000300", "OUTRA FILIAL", "grupo", "SÓ UMA LTDA", filial),
        fabricacao(CNPJ_B, "EMPRESA B LTDA", "terceira", "SÓ UMA LTDA", filial),
      ],
    });
    expect(indexavel(m.get(CNPJ_C)!)).toBe(true);
    expect(indexavel(m.get(CNPJ_D)!)).toBe(false);
    // uma cliente do grupo e uma de fora: a do grupo não conta
    expect(indexavel(m.get(filial)!)).toBe(false);
  });

  it("o resumo conta os envases e os fabricantes no exterior", () => {
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true)],
      fabricacao: [
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "terceira", "ENVASA BEM LTDA", CNPJ_C),
        fabricacao(CNPJ_A, "EMPRESA A LTDA", "exterior", "ALFA FOODS", null, 1, { codigo: "A000001" }),
      ],
    });
    expect(resumo(m.get(CNPJ_A)!)).toMatchObject({ envasaPara: 0, envasadoPor: 1, exterior: 1 });
    expect(resumo(m.get(CNPJ_C)!)).toMatchObject({ alimentos: 0, envasaPara: 1, envasadoPor: 0, exterior: 0 });
  });

  it("entrada sem fabricação (build de dados sem a tabela) deixa as listas vazias", () => {
    const emp = agrupar({ ...vazio, alimentos: [alimento(1, "A", true)] }).get(CNPJ_A)!;
    expect(emp).toMatchObject({ envasaPara: [], envasadoPor: [], exterior: [] });
  });
});

describe("letraDe e porLetra", () => {
  it("a letra ignora acento, caixa e símbolos no começo", () => {
    expect(letraDe("Ótica Brasil")).toBe("o");
    expect(letraDe('  "aurora" ltda')).toBe("a");
    expect(letraDe("3M do Brasil")).toBe("0-9");
    expect(letraDe("")).toBe("0-9");
  });

  it("toda letra aparece, cada uma em ordem de nome", () => {
    const l = porLetra([
      { nome: "Beta", cnpj: "2" },
      { nome: "álamo", cnpj: "3" },
      { nome: "Alfa", cnpj: "1" },
      { nome: "123 Ltda", cnpj: "4" },
    ]);
    expect([...l.keys()]).toEqual(LETRAS);
    expect(l.get("a")!.map((e) => e.nome)).toEqual(["álamo", "Alfa"]);
    expect(l.get("b")!.map((e) => e.cnpj)).toEqual(["2"]);
    expect(l.get("0-9")!.map((e) => e.cnpj)).toEqual(["4"]);
    expect(l.get("z")).toEqual([]);
  });
});
