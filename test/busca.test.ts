// useBusca contra uma fonte de mentira em que o teste decide quando e com o quê cada busca responde.
import { afterEach, describe, expect, it } from "vitest";
import { effectScope, shallowRef } from "vue";
import { useBusca } from "../src/components/composables/useBusca";
import type { Consulta } from "../src/lib/detect";
import { POR_PAGINA, type Fonte, type Item } from "../src/lib/fonte";

interface Linha extends Item {
  id: string;
}

interface Pedido {
  q: Consulta;
  pagina: number;
  responder: (linhas: Linha[]) => void;
  falhar: (e: Error) => void;
}

function fonteFalsa() {
  const pedidos: Pedido[] = [];
  let facetas = 0;
  const fonte: Fonte<Linha> = {
    preparar: () => Promise.resolve(),
    buscar: (q, _f, pagina) =>
      new Promise((responder, falhar) => {
        pedidos.push({ q, pagina, responder, falhar });
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

describe("useBusca", () => {
  it("resposta atrasada de uma busca antiga é descartada", async () => {
    const { b, pedidos } = montar();
    b.entrada.value = "whey";
    const primeira = b.buscar();
    b.entrada.value = "creatina";
    const segunda = b.buscar();
    pedidos[1]!.responder(linhas(1, 1, 100));
    pedidos[0]!.responder(linhas(2, 2));
    await Promise.all([primeira, segunda]);
    expect(b.produtos.value).toEqual(linhas(1, 1, 100));
    expect(b.buscada.value).toEqual({ modo: "texto", valor: "creatina" });
  });

  it("mais acrescenta a página seguinte e não reconta as facetas", async () => {
    const { b, pedidos, facetas } = montar();
    b.entrada.value = "whey";
    const p1 = b.buscar();
    pedidos[0]!.responder(linhas(POR_PAGINA, 45));
    await p1;
    expect(b.temMais.value).toBe(true);
    const p2 = b.buscar(true);
    expect(pedidos[1]!.pagina).toBe(1);
    pedidos[1]!.responder(linhas(15, 45, POR_PAGINA));
    await p2;
    expect(b.produtos.value).toHaveLength(45);
    expect(b.temMais.value).toBe(false);
    expect(facetas()).toBe(1);
  });

  it("a mesma busca não repete, a não ser forçada ou depois de um erro", async () => {
    const { b, pedidos } = montar();
    b.entrada.value = "whey";
    const p1 = b.buscar();
    pedidos[0]!.falhar(new Error("sem rede"));
    await p1;
    expect(b.erro.value).toBe("sem rede");
    const p2 = b.buscar();
    expect(pedidos).toHaveLength(2);
    pedidos[1]!.responder(linhas(1, 1));
    await p2;
    expect(b.erro.value).toBe("");
    await b.buscar();
    expect(pedidos).toHaveLength(2);
    void b.buscar(false, true);
    expect(pedidos).toHaveLength(3);
  });

  it("limpar descarta o que ainda está a caminho", async () => {
    const { b, pedidos } = montar();
    b.entrada.value = "whey";
    const p = b.buscar();
    b.limpar();
    pedidos[0]!.responder(linhas(3, 3));
    await p;
    expect(b.produtos.value).toEqual([]);
    expect(b.buscada.value).toBeNull();
    expect(b.carregando.value).toBe(false);
  });
});
