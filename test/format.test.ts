import { describe, expect, it } from "vitest";
import { fmtCnpj, fmtData, fmtMesAno, fmtProcesso, marcas, plural, toDate } from "../src/lib/format";

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
  it("plural", () => {
    expect(plural(1, "produto")).toBe("1 produto");
    expect(plural(1200, "apresentação", "apresentações")).toBe("1.200 apresentações");
  });
});

describe("validade de saneante", async () => {
  const { validade } = await import("../src/lib/validade");
  it("vigente, vencido, sem data e data estranha", () => {
    expect(validade("Em dia", "2036-04-04")).toMatchObject({ classe: "ok", curto: "Liberado até 04/2036", estranha: false });
    expect(validade("Vencida", "2019-10-22")).toMatchObject({ classe: "perigo", curto: "Liberação venceu em 10/2019" });
    expect(validade("Sem data", null)).toMatchObject({ classe: "neutro", curto: "Sem data de vencimento" });
    expect(validade("Em dia", "3033-04-30").estranha).toBe(true);
  });
});
