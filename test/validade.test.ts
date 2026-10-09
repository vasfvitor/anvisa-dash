import { describe, expect, it } from "vitest";
import { validade } from "../src/lib/validade";

describe("validade de um saneante", () => {
  it("em dia", () => {
    const v = validade("Em dia", "2030-06-15");
    expect(v.classe).toBe("ok");
    expect(v.curto).toBe("Liberado até 06/2030");
    expect(v.estranha).toBe(false);
  });

  it("vencida: o grupo vem do SQL, calculado com a data do dia", () => {
    const v = validade("Vencida", "2020-01-10");
    expect(v.classe).toBe("perigo");
    expect(v.curto).toBe("Liberação venceu em 01/2020");
  });

  it("sem data", () => {
    const v = validade("Sem data", null);
    expect(v.classe).toBe("neutro");
    expect(v.estranha).toBe(false);
  });

  it("ano fora do comum, como a ANVISA publica", () => {
    expect(validade("Em dia", "3033-01-01").estranha).toBe(true);
    expect(validade("Em dia", "2100-12-31").estranha).toBe(false);
  });
});
