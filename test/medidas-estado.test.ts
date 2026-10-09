// useMedidas com buscarMedidas de mentira: o teste decide quando e com o quê cada pedido responde.
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import type { Consulta } from "../src/lib/detect";
import type { Medida } from "../src/lib/medidas";

interface Pedido {
  tipo: number;
  q: Consulta;
  pagina: number;
  registros: string[];
  responder: (m: Medida[]) => void;
}

const { pedidos, contagens } = vi.hoisted(() => ({
  pedidos: [] as Pedido[],
  contagens: [] as { tipo: number; cnpjs: string[]; responder: (n: Map<string, number>) => void }[],
}));

vi.mock("../src/lib/medidas", () => ({
  MEDIDAS_POR_PAGINA: 20,
  buscarMedidas: (tipo: number, q: Consulta, pagina: number, registros: string[] = []) =>
    new Promise<Medida[]>((responder) => {
      pedidos.push({ tipo, q, pagina, registros, responder });
    }),
  medidasPorEmpresa: (tipo: number, cnpjs: string[]) =>
    new Promise<Map<string, number>>((responder) => {
      contagens.push({ tipo, cnpjs, responder });
    }),
}));

const { useMedidas } = await import("../src/components/composables/useMedidas");

/** `n` medidas a partir de `de`, todas com o total da busca. */
const medidas = (n: number, total: number, de = 0): Medida[] =>
  Array.from({ length: n }, (_, i) => ({
    id: String(de + i),
    dossie: de + i,
    produto: "x",
    empresa: null,
    cnpj: null,
    registro: null,
    processo: null,
    risco: null,
    acoes: [],
    atividades: [],
    dt_primeira: "2026-01-01",
    dt_ultima: "2026-01-01",
    total,
  }));

const texto = (valor: string): Consulta => ({ modo: "texto", valor });

let escopo = effectScope();
afterEach(() => {
  escopo.stop();
  escopo = effectScope();
  pedidos.length = 0;
  contagens.length = 0;
});
const montar = () => escopo.run(() => useMedidas())!;

describe("useMedidas", () => {
  it("a mesma consulta no mesmo corredor não pede de novo (filtros não mudam as medidas)", async () => {
    const m = montar();
    const p = m.buscar(3, texto("biojet"));
    pedidos[0]!.responder(medidas(2, 2));
    await p;
    await m.buscar(3, texto("biojet"));
    expect(pedidos).toHaveLength(1);
    void m.buscar(6, texto("biojet"));
    expect(pedidos).toHaveLength(2);
    expect(pedidos[1]!.tipo).toBe(6);
  });

  it("sem tipo, sem consulta ou navegando por grupo: limpa e não pede", async () => {
    const m = montar();
    const p = m.buscar(3, texto("biojet"));
    pedidos[0]!.responder(medidas(2, 2));
    await p;
    await m.buscar(undefined, texto("biojet"));
    expect(m.itens.value).toEqual([]);
    await m.buscar(3, { modo: "todos", valor: "" });
    await m.buscar(3, null);
    expect(pedidos).toHaveLength(1);
  });

  it("limpar descarta o que ainda está a caminho (troca de corredor)", async () => {
    const m = montar();
    const p = m.buscar(6, texto("whey"));
    m.limpar();
    pedidos[0]!.responder(medidas(3, 3));
    await p;
    expect(m.itens.value).toEqual([]);
    expect(m.buscada.value).toBeNull();
    expect(m.carregando.value).toBe(false);
  });

  it("resposta atrasada de uma consulta antiga é descartada", async () => {
    const m = montar();
    const a = m.buscar(3, texto("cloro"));
    const b = m.buscar(3, texto("biojet"));
    pedidos[1]!.responder(medidas(1, 1, 100));
    pedidos[0]!.responder(medidas(5, 5));
    await Promise.all([a, b]);
    expect(m.itens.value).toEqual(medidas(1, 1, 100));
    expect(m.buscada.value).toEqual(texto("biojet"));
  });

  it("mais traz a página seguinte da mesma consulta", async () => {
    const m = montar();
    const p1 = m.buscar(6, texto("suplemento"));
    pedidos[0]!.responder(medidas(20, 25));
    await p1;
    expect(m.temMais.value).toBe(true);
    const p2 = m.mais();
    expect(pedidos[1]).toMatchObject({ tipo: 6, pagina: 1, q: texto("suplemento") });
    pedidos[1]!.responder(medidas(5, 25, 20));
    await p2;
    expect(m.itens.value).toHaveLength(25);
    expect(m.temMais.value).toBe(false);
  });

  it("marcas dos cartões: cada página só pergunta pelas empresas novas, e tudo some na troca de corredor", async () => {
    const m = montar();
    const a = "11111111000111";
    const b = "22222222000122";
    const p1 = m.marcar(3, [a, a, null]);
    expect(contagens[0]!.cnpjs).toEqual([a]);
    contagens[0]!.responder(new Map([[a, 2]]));
    await p1;
    const p2 = m.marcar(3, [a, b]);
    expect(contagens[1]!.cnpjs).toEqual([b]);
    contagens[1]!.responder(new Map());
    await p2;
    expect([...m.porEmpresa.value]).toEqual([[a, 2]]);
    await m.marcar(3, [a, b]);
    expect(contagens).toHaveLength(2);

    const atrasada = m.marcar(3, ["33333333000133"]);
    m.limparMarcas();
    contagens[2]!.responder(new Map([["33333333000133", 5]]));
    await atrasada;
    expect(m.porEmpresa.value.size).toBe(0);
    void m.marcar(6, [a]);
    expect(contagens[3]).toMatchObject({ tipo: 6, cnpjs: [a] });
  });

  it("por número, os registros achados fazem parte da consulta e seguem no mostrar mais", async () => {
    const m = montar();
    const q: Consulta = { modo: "numero", valor: "1208030256" };
    const p1 = m.buscar(3, q, ["341750056", "341750056"]);
    expect(pedidos[0]!.registros).toEqual(["341750056"]);
    pedidos[0]!.responder(medidas(20, 21));
    await p1;
    await m.buscar(3, q, ["341750056"]);
    expect(pedidos).toHaveLength(1);
    const p2 = m.mais();
    expect(pedidos[1]).toMatchObject({ pagina: 1, registros: ["341750056"] });
    pedidos[1]!.responder(medidas(1, 21, 20));
    await p2;
    void m.buscar(3, q, []);
    expect(pedidos).toHaveLength(3);
  });

  it("sem tipo no corredor, não marca", async () => {
    const m = montar();
    await m.marcar(undefined, ["11111111000111"]);
    expect(contagens).toHaveLength(0);
  });
});
