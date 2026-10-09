// useBusca contra uma fonte de mentira em que o teste decide quando e com o quê cada busca responde.
import { afterEach, describe, expect, it } from "vitest";
import { effectScope, shallowRef } from "vue";
import { useBusca } from "../src/components/composables/useBusca";
import type { Consulta } from "../src/lib/detect";
import { FILTROS_PADRAO, POR_PAGINA, type Filtros, type Fonte, type Item } from "../src/lib/fonte";

interface Linha extends Item {
  id: string;
}

interface Pedido {
  q: Consulta;
  filtros: Filtros;
  pagina: number;
  responder: (linhas: Linha[]) => void;
  falhar: (e: Error) => void;
}

function fonteFalsa() {
  const pedidos: Pedido[] = [];
  let facetas = 0;
  const fonte: Fonte<Linha> = {
    preparar: () => Promise.resolve(),
    buscar: (q, filtros, pagina) =>
      new Promise((responder, falhar) => {
        pedidos.push({ q, filtros, pagina, responder, falhar });
      }),
    facetas: () => {
      facetas++;
      return Promise.resolve({ situacao: [], tipo: [], grupo: [] });
    },
    sugerir: () => Promise.resolve([]),
    porId: () => Promise.resolve(null),
    numeros: () => Promise.resolve({ produtos: 0, ativos: 0, empresas: 0 }),
    grupos: () => Promise.resolve([]),
    idDe: (l) => l.id,
    cnpjDe: () => null,
  };
  return { fonte, pedidos, facetas: () => facetas };
}

/** `n` linhas com ids a partir de `de`, todas com o total da busca. */
const linhas = (n: number, total: number, de = 0): Linha[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(de + i), total }));

// um escopo por teste: um escopo parado não roda mais nada
let escopo = effectScope();
afterEach(() => {
  escopo.stop();
  escopo = effectScope();
});

function montar() {
  const falsa = fonteFalsa();
  const b = escopo.run(() => useBusca(shallowRef<Fonte>(falsa.fonte)))!;
  return { ...falsa, b };
}

const texto = (valor: string): Consulta => ({ modo: "texto", valor });
const filtros = { ...FILTROS_PADRAO };

describe("useBusca", () => {
  it("resposta atrasada de uma busca antiga é descartada", async () => {
    const { b, pedidos } = montar();
    const primeira = b.buscar(texto("whey"), filtros);
    const segunda = b.buscar(texto("creatina"), filtros);
    pedidos[1]!.responder(linhas(1, 1, 100));
    pedidos[0]!.responder(linhas(2, 2));
    await Promise.all([primeira, segunda]);
    expect(b.produtos.value).toEqual(linhas(1, 1, 100));
    expect(b.buscada.value).toEqual(texto("creatina"));
  });

  it("mais acrescenta a página seguinte, com os filtros da lista, e não reconta as facetas", async () => {
    const { b, pedidos, facetas } = montar();
    const comTodos = { ...filtros, situacao: "todos" as const };
    const p1 = b.buscar(texto("whey"), comTodos);
    pedidos[0]!.responder(linhas(POR_PAGINA, 45));
    await p1;
    expect(b.temMais.value).toBe(true);
    const p2 = b.mais();
    expect(pedidos[1]!.pagina).toBe(1);
    expect(pedidos[1]!.filtros).toEqual(comTodos);
    pedidos[1]!.responder(linhas(15, 45, POR_PAGINA));
    await p2;
    expect(b.produtos.value).toHaveLength(45);
    expect(b.temMais.value).toBe(false);
    expect(facetas()).toBe(1);
  });

  it("a mesma busca não repete, a não ser forçada ou depois de um erro", async () => {
    const { b, pedidos } = montar();
    const p1 = b.buscar(texto("whey"), filtros);
    pedidos[0]!.falhar(new Error("sem rede"));
    await p1;
    expect(b.erro.value).toBe("sem rede");
    const p2 = b.buscar(texto("whey"), filtros);
    expect(pedidos).toHaveLength(2);
    pedidos[1]!.responder(linhas(1, 1));
    await p2;
    expect(b.erro.value).toBe("");
    await b.buscar(texto("whey"), filtros);
    expect(pedidos).toHaveLength(2);
    void b.buscar(texto("whey"), filtros, true);
    expect(pedidos).toHaveLength(3);
  });

  it("sem consulta, ou ao limpar, descarta o que ainda está a caminho", async () => {
    for (const descartar of ["limpar", "sem consulta"] as const) {
      const { b, pedidos } = montar();
      const p = b.buscar(texto("whey"), filtros);
      if (descartar === "limpar") b.limpar();
      else await b.buscar(null, filtros);
      pedidos[0]!.responder(linhas(3, 3));
      await p;
      expect(b.produtos.value).toEqual([]);
      expect(b.buscada.value).toBeNull();
      expect(b.carregando.value).toBe(false);
    }
  });
});
