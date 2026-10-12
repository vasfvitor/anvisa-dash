import { describe, expect, it } from "vitest";
import { alergenicos, intolerancias, nomeCurto, resumirAlergia, resumoDe } from "../src/corredores/alimentos/alergia";

const A1 =
  "Contém derivado de - Leites de todas as espécies de animais mamíferos#Soja | Não contém - Amendoim#Ovos#Trigo |";
const A2 = "Pode conter - Ovos | Não contém - Amendoim#Trigo |";

describe("resumirAlergia", () => {
  it("uma apresentação", () => {
    const r = resumirAlergia([A1], ["Contém Glúten - Não | Contém Lactose - Sim"]);
    expect(r).toMatchObject({
      gluten: "nao",
      lactose: "sim",
      contem: ["Leites de todas as espécies de animais mamíferos", "Soja"],
      podeConter: [],
      naoContem: ["Amendoim", "Ovos", "Trigo"],
      varia: false,
      temDados: true,
    });
  });
  it("apresentações divergentes: junta e marca varia", () => {
    const r = resumirAlergia(
      [A1, A2],
      ["Contém Glúten - Não | Contém Lactose - Não", "Contém Glúten - Não | Contém Lactose - Sim"],
    );
    expect(r.lactose).toBe("varia");
    expect(r.gluten).toBe("nao");
    expect(r.podeConter).toEqual(["Ovos"]);
    // ovos sai de "não contém" porque uma apresentação pode conter
    expect(r.naoContem).toEqual(["Amendoim", "Trigo"]);
    expect(r.varia).toBe(true);
  });
  it("sem dados", () => {
    expect(resumirAlergia([null], [null]).temDados).toBe(false);
  });
});

describe("parsers", () => {
  it("alergênicos com separador final", () => {
    expect(alergenicos("Contém derivado de - Leite#Soja | Não contém - Amendoim#Ovos |")).toEqual([
      { rotulo: "Contém derivado de", itens: ["Leite", "Soja"] },
      { rotulo: "Não contém", itens: ["Amendoim", "Ovos"] },
    ]);
  });
  it("intolerâncias", () => {
    expect(intolerancias("Contém Glúten - Não | Contém Lactose - Sim")).toEqual([
      { rotulo: "Contém Glúten", valor: "Não" },
      { rotulo: "Contém Lactose", valor: "Sim" },
    ]);
  });
  it("nome curto só para os nomes legais longos", () => {
    expect(nomeCurto("Leites de todas as espécies de animais mamíferos")).toBe("Leite");
    expect(nomeCurto("Soja")).toBe("Soja");
  });
});

describe("resumoDe", () => {
  it("lê as colunas de alimentos_por_produto como o resumo", () => {
    const r = resumoDe({
      gluten: "Não",
      lactose: "Varia",
      contem: "Leites de todas as espécies de animais mamíferos|Soja",
      pode_conter: null,
      nao_contem: "Amendoim",
      alergia_varia: true,
    });
    expect(r).toEqual({
      gluten: "nao",
      lactose: "varia",
      contem: ["Leites de todas as espécies de animais mamíferos", "Soja"],
      podeConter: [],
      naoContem: ["Amendoim"],
      varia: true,
      temDados: true,
    });
  });

  it("sem declaração (as seis colunas nulas) não tem dados", () => {
    const r = resumoDe({
      gluten: null,
      lactose: null,
      contem: null,
      pode_conter: null,
      nao_contem: null,
      alergia_varia: null,
    });
    expect(r.temDados).toBe(false);
    expect(r.varia).toBe(false);
  });
});
