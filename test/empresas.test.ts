import { describe, expect, it } from "vitest";
import { agrupar, resumo, type Entrada } from "../src/lib/estatico/empresas";

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

const vazio: Entrada = { alimentos: [], saneantes: [], medidas: [] };

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

  it("medidas entram só em empresa com página, da mais recente para a mais antiga", () => {
    const medida = (produto: string, data: string, cnpj = CNPJ_A) => ({
      corredor: "alimentos" as const,
      produto,
      acoes: ["Proibição"],
      data,
      cnpj,
      empresa: "EMPRESA A LTDA",
    });
    const m = agrupar({
      ...vazio,
      alimentos: [alimento(1, "WHEY", true)],
      medidas: [medida("VELHA", "2024-01-01"), medida("NOVA", "2026-10-05"), medida("OUTRA", "2026-01-01", CNPJ_B)],
    });
    expect(m.get(CNPJ_A)!.medidas.map((x) => x.produto)).toEqual(["NOVA", "VELHA"]);
    expect(m.has(CNPJ_B)).toBe(false);
  });
});

describe("resumo", () => {
  it("conta produtos e liberados por corredor", () => {
    const emp = agrupar({
      ...vazio,
      alimentos: [alimento(1, "A", true), alimento(2, "B", false)],
      saneantes: [saneante("1", "C", true)],
    }).get(CNPJ_A)!;
    expect(resumo(emp)).toEqual({ alimentos: 2, alimentosAtivos: 1, saneantes: 1, saneantesAtivos: 1, medidas: 0 });
  });
});
