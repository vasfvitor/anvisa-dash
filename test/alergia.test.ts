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
  it("only an explicit Não is reassuring; any other value is not informed", () => {
    const r = resumirAlergia([null], ["Contém Glúten - Não informado | Contém Lactose - NÃO"]);
    expect(r.gluten).toBe("naoInformado");
    expect(r.lactose).toBe("nao");
    expect(r.temDados).toBe(true);
    // one presentation says Não and another an unknown value: not "sem glúten"
    expect(resumirAlergia([null, null], ["Contém Glúten - Não", "Contém Glúten - ?"]).gluten).toBe("naoInformado");
    // a Sim still warns
    expect(resumirAlergia([null, null], ["Contém Glúten - Sim", "Contém Glúten - Talvez"]).gluten).toBe("sim");
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

  it("a column value other than Sim, Não or Varia is not informed, never Não", () => {
    const r = resumoDe({
      gluten: "Não informado",
      lactose: "Não ",
      contem: null,
      pode_conter: null,
      nao_contem: null,
      alergia_varia: null,
    });
    expect(r.gluten).toBe("naoInformado");
    expect(r.lactose).toBe("nao");
    expect(r.temDados).toBe(true);
  });

  it("reads back each value anvisa-api's derivar.py writes for what resumirAlergia computes", () => {
    // derivar.py: Sim with Não is Varia, then Sim, then Não informado (any other value), then Não
    const casos: [string[], string][] = [
      [["Contém Glúten - Sim", "Contém Glúten - Não"], "Varia"],
      [["Contém Glúten - Sim", "Contém Glúten - ?"], "Sim"],
      [["Contém Glúten - Não", "Contém Glúten - ?"], "Não informado"],
      [["Contém Glúten - Não"], "Não"],
    ];
    for (const [intol, coluna] of casos) {
      const esperado = resumirAlergia([], intol).gluten;
      const colunas = { lactose: null, contem: null, pode_conter: null, nao_contem: null, alergia_varia: null };
      expect(resumoDe({ ...colunas, gluten: coluna }).gluten).toBe(esperado);
      expect(resumoDe({ ...colunas, gluten: coluna.toUpperCase() }).gluten).toBe(esperado);
    }
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
