import { describe, expect, it } from "vitest";
import {
  fmtBytesRedondo,
  fmtCnpj,
  fmtData,
  fmtMesAno,
  fmtProcesso,
  fmtRegistro,
  marcas,
  plural,
  toDate,
} from "../src/lib/format";

describe("documentos", () => {
  it("formata CNPJ e processo", () => {
    expect(fmtCnpj("00000000055417")).toBe("00.000.000/0554-17");
    expect(fmtProcesso("25351161029202655")).toBe("25351.161029/2026-55");
    expect(fmtCnpj("123")).toBe("123");
    expect(fmtCnpj(null)).toBe("");
  });
  it("formata o nº de registro como a embalagem; dispositivos (10 ou 11 dígitos) ficam crus", () => {
    expect(fmtRegistro("186200018")).toBe("1.8620.0018");
    expect(fmtRegistro("1862000180015")).toBe("1.8620.0018.001-5");
    expect(fmtRegistro("80145901455")).toBe("80145901455");
    expect(fmtRegistro(null)).toBe("");
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

describe("tamanhos", () => {
  it("redondo para estimativas: bytes, KB e MB inteiros, sem 1.024 KB", () => {
    expect(fmtBytesRedondo(300)).toBe("300 B");
    expect(fmtBytesRedondo(500_000)).toBe("488 KB");
    expect(fmtBytesRedondo(1_048_400)).toBe("1 MB");
    expect(fmtBytesRedondo(11_000_000)).toBe("10 MB");
  });
});
