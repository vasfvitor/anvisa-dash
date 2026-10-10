import { describe, expect, it } from "vitest";
import { validade } from "../src/lib/validade";

describe("validade da liberação", () => {
  it("em dia", () => {
    const v = validade("Em dia", "2030-06-15", true);
    expect(v.classe).toBe("ok");
    expect(v.curto).toBe("Liberado até 15/06/2030");
    expect(v.estranha).toBe(false);
  });

  it("vencida: o grupo vem do SQL, calculado com a data do dia", () => {
    const v = validade("Vencida", "2020-01-10", false);
    expect(v.classe).toBe("perigo");
    expect(v.curto).toBe("Liberação venceu em 10/01/2020");
    expect(v.antiga).toBe(false);
  });

  it("liberado com data passada: data antiga, sem dizer que venceu", () => {
    const v = validade("Vencida", "2009-08-03", true);
    expect(v.classe).toBe("neutro");
    expect(v.curto).toBe("Data antiga: 03/08/2009");
    expect(v.antiga).toBe(true);
    expect(v.dica).toMatch(/ainda lista o produto como liberado/);
  });

  it("sem data", () => {
    const v = validade("Sem data", null, true);
    expect(v.classe).toBe("neutro");
    expect(v.curto).toBe("Sem data de vencimento");
    expect(v.estranha).toBe(false);
  });

  it("ano fora do comum, como a ANVISA publica", () => {
    expect(validade("Em dia", "3033-01-01", true).estranha).toBe(true);
    expect(validade("Em dia", "2100-12-31", true).estranha).toBe(false);
  });
});
