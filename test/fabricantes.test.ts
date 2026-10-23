import { describe, expect, it } from "vitest";
import {
  comNomesDe,
  DETENTORES_PARA_PAGINA,
  indexarFabricantes,
  indexavelFabricante,
  type LinhaFabricacaoDispositivo,
  type VinculoDispositivo,
} from "../src/lib/estatico/fabricantes";

const linha = (
  cnpj: string,
  chave: string,
  vinculo: VinculoDispositivo,
  registros = 1,
  outros: { fabricante?: string; pais?: string | null; empresa?: string; ativos?: number } = {},
): LinhaFabricacaoDispositivo => ({
  cnpj,
  empresa: outros.empresa ?? `EMPRESA ${cnpj.slice(0, 2)}`,
  chave,
  fabricante: outros.fabricante ?? chave.toUpperCase(),
  pais: outros.pais === undefined ? "CHINA" : outros.pais,
  vinculo,
  registros,
  registrosAtivos: outros.ativos ?? registros,
  linhas: registros,
});

const A = "11111111000111";
const B = "22222222000122";
const C = "33333333000133";

describe("indexarFabricantes", () => {
  it(`página com ${DETENTORES_PARA_PAGINA} detentoras fora a própria; com uma, ou a própria e uma, não`, () => {
    const m = indexarFabricantes([
      linha(A, "dois", "exterior"),
      linha(B, "dois", "exterior"),
      linha(A, "um", "exterior"),
      linha(A, "propriaeum", "propria", 5, { pais: "BRASIL" }),
      linha(B, "propriaeum", "terceira", 1, { pais: "BRASIL" }),
    ]);
    expect([...m.keys()]).toEqual(["dois-china"]);
    expect(m.get("dois-china")!.empresas).toBe(2);
  });

  it("a própria é listada primeiro e fica fora da contagem de empresas; depois de mais a menos registros", () => {
    const f = indexarFabricantes([
      linha(A, "acme", "terceira", 1, { pais: "BRASIL" }),
      linha(B, "acme", "terceira", 7, { pais: "BRASIL" }),
      linha(C, "acme", "propria", 3, { pais: "BRASIL" }),
    ]).get("acme-brasil")!;
    expect(f.detentores.map((d) => [d.cnpj, d.propria])).toEqual([
      [C, true],
      [B, false],
      [A, false],
    ]);
    expect(f).toMatchObject({ empresas: 2, registros: 11, registrosAtivos: 11 });
    expect(indexavelFabricante(f)).toBe(true);
  });

  it("o nome é a grafia de mais registros; no empate, a primeira em ordem alfabética", () => {
    const m = indexarFabricantes([
      linha(A, "acme", "exterior", 1, { fabricante: "Acme Co." }),
      linha(B, "acme", "exterior", 3, { fabricante: "ACME CO" }),
      linha(A, "beta", "exterior", 2, { fabricante: "Zeta" }),
      linha(B, "beta", "exterior", 2, { fabricante: "Beta" }),
    ]);
    expect(m.get("acme-china")!.nome).toBe("ACME CO");
    expect(m.get("beta-china")!.nome).toBe("Beta");
  });

  it("o mesmo nome em dois países são dois fabricantes; o mesmo país escrito de dois jeitos, um", () => {
    const m = indexarFabricantes([
      linha(A, "acme", "exterior", 1, { pais: "CHINA" }),
      linha(B, "acme", "exterior", 1, { pais: "CHINA" }),
      linha(A, "acme", "exterior", 1, { pais: "ÍNDIA" }),
      linha(C, "acme", "exterior", 1, { pais: "ÍNDIA" }),
      linha(A, "corin", "exterior", 1, { pais: "Reino Unido" }),
      linha(B, "corin", "exterior", 1, { pais: "REINO UNIDO" }),
      linha(C, "corin", "exterior", 5, { pais: "REINO UNIDO" }),
      // a mesma detentora nas duas grafias soma, sem contar duas vezes
      linha(B, "corin", "exterior", 2, { pais: "Reino Unido" }),
    ]);
    expect([...m.keys()]).toEqual(["acme-china", "acme-india", "corin-reino-unido"]);
    const corin = m.get("corin-reino-unido")!;
    expect(corin.pais).toBe("REINO UNIDO");
    expect(corin.empresas).toBe(3);
    expect(corin.detentores.map((d) => [d.cnpj, d.registros])).toEqual([
      [C, 5],
      [B, 3],
      [A, 1],
    ]);
  });

  it("linha sem chave fica de fora; o mapa sai em ordem de slug", () => {
    const m = indexarFabricantes([
      linha(A, "zeta", "exterior"),
      linha(B, "zeta", "exterior"),
      linha(A, "", "exterior"),
      linha(B, "", "exterior"),
      linha(A, "alfa", "exterior"),
      linha(B, "alfa", "exterior"),
    ]);
    expect([...m.keys()]).toEqual(["alfa-china", "zeta-china"]);
  });

  it("os liberados somam os de cada detentora", () => {
    const f = indexarFabricantes([linha(A, "acme", "exterior", 4, { ativos: 1 }), linha(B, "acme", "exterior", 2)]).get(
      "acme-china",
    )!;
    expect(f).toMatchObject({ registros: 6, registrosAtivos: 3 });
  });
});

describe("comNomesDe", () => {
  it("troca o nome da detentora pelo da página dela, quando existe", () => {
    const m = indexarFabricantes([
      linha(A, "acme", "exterior", 1, { empresa: "A LTDA ME" }),
      linha(B, "acme", "exterior", 1, { empresa: "B SA" }),
    ]);
    comNomesDe(m, new Map([[A, { nome: "EMPRESA A LTDA" }]]));
    expect(
      m
        .get("acme-china")!
        .detentores.map((d) => d.nome)
        .sort(),
    ).toEqual(["B SA", "EMPRESA A LTDA"]);
  });
});
