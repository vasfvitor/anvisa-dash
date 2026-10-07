import { describe, expect, it } from "vitest";
import { destacar, legivel } from "../src/lib/texto";

describe("legivel", () => {
  it("frase: baixa a caixa e mantém siglas e tokens com dígito", () => {
    expect(legivel("SUPLEMENTO ALIMENTAR DE CREATINA, COLÁGENO E COENZIMA Q10 EM PÓ")).toBe(
      "Suplemento alimentar de creatina, colágeno e coenzima Q10 em pó",
    );
    expect(legivel("SUPLEMENTO DE VITAMINA C E DHA")).toBe("Suplemento de vitamina C e DHA");
  });
  it("nome: capitaliza palavras, não as ligações, e mantém LTDA", () => {
    expect(legivel("UNILEVER BRASIL INDUSTRIAL LTDA", "nome")).toBe("Unilever Brasil Industrial LTDA");
    expect(legivel("IND E COM DE PRODS ALIMS BISCOLAR LTDA", "nome")).toBe("Ind e Com de Prods Alims Biscolar LTDA");
  });
  it("texto com minúsculas fica como veio", () => {
    expect(legivel("Suplemento alimentar líquido")).toBe("Suplemento alimentar líquido");
    expect(legivel("LIQUID I.V.", "nome")).toBe("Liquid I.V.");
  });
  it("junta quebras de linha", () => {
    expect(legivel("Água, Maltodextrina\nda tapioca")).toBe("Água, Maltodextrina da tapioca");
  });
});

describe("destacar", () => {
  it("acha sem acento e sem caixa, preservando o original", () => {
    expect(destacar("Colágeno Hidrolisado", "colageno")).toEqual([
      { texto: "Colágeno", achado: true },
      { texto: " Hidrolisado", achado: false },
    ]);
  });
  it("várias ocorrências e termo vazio", () => {
    expect(destacar("a whey e WHEY", "whey").filter((t) => t.achado).map((t) => t.texto)).toEqual(["whey", "WHEY"]);
    expect(destacar("abc", "")).toEqual([{ texto: "abc", achado: false }]);
  });
});
