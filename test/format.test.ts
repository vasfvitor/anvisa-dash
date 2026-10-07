import { describe, expect, it } from "vitest";
import { alergenicos, fmtCnpj, fmtData, fmtMesAno, fmtProcesso, intolerancias, marcas, toDate } from "../src/lib/format";

describe("documentos", () => {
  it("formata CNPJ e processo", () => {
    expect(fmtCnpj("00000000055417")).toBe("00.000.000/0554-17");
    expect(fmtProcesso("25351161029202655")).toBe("25351.161029/2026-55");
    expect(fmtCnpj("123")).toBe("123");
    expect(fmtCnpj(null)).toBe("");
  });
});

describe("datas", () => {
  it("aceita ms, bigint, Date e texto", () => {
    const ms = Date.UTC(2024, 11, 9, 0, 0, 0);
    for (const v of [ms, BigInt(ms), new Date(ms), "2024-12-09T00:00:00", "2024-12-09"]) {
      expect(toDate(v)?.getTime()).toBe(ms);
    }
    expect(toDate(null)).toBeNull();
    expect(toDate("lixo")).toBeNull();
  });
  it("meia-noite de Brasília não volta um dia", () => {
    expect(fmtData(Date.UTC(2024, 11, 9, 0, 0, 0))).toBe("09/12/2024");
  });
  it("vencimento em MM/AAAA", () => {
    expect(fmtMesAno(Date.UTC(2029, 11, 1))).toBe("12/2029");
  });
});

describe("campos multivalorados", () => {
  it("marcas", () => {
    expect(marcas(" A ; B;;C ")).toEqual(["A", "B", "C"]);
    expect(marcas(null)).toEqual([]);
  });
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
});
