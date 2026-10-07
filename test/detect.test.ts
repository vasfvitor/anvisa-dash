import { describe, expect, it } from "vitest";
import { detectar } from "../src/lib/detect";

describe("detectar", () => {
  it("CNPJ mantém os zeros à esquerda", () => {
    expect(detectar("00000000055417")).toEqual({ modo: "cnpj", valor: "00000000055417" });
    expect(detectar(" 00.000.000/0554-17 ")).toEqual({ modo: "cnpj", valor: "00000000055417" });
  });
  it("processo ou registro com ou sem pontuação", () => {
    expect(detectar("25351.161029/2026-55")).toEqual({ modo: "numero", valor: "25351161029202655" });
    expect(detectar("25351161029202655")).toEqual({ modo: "numero", valor: "25351161029202655" });
    // processo antigo (13), registro do produto (9) e da apresentação (13)
    expect(detectar("2500400401691")).toEqual({ modo: "numero", valor: "2500400401691" });
    expect(detectar("441280003")).toEqual({ modo: "numero", valor: "441280003" });
  });
  it("o resto é texto", () => {
    expect(detectar("colageno")).toEqual({ modo: "texto", valor: "colageno" });
    expect(detectar("Whey 100")).toEqual({ modo: "texto", valor: "Whey 100" });
    // números curtos demais para processo/registro buscam como texto
    expect(detectar("12345")?.modo).toBe("texto");
  });
  it("entrada vazia ou curta demais não busca", () => {
    expect(detectar("   ")).toBeNull();
    expect(detectar("a")).toBeNull();
  });
});
