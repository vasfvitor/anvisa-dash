import { describe, expect, it } from "vitest";
import { CORREDORES, corredorDaUrl, corredorPorId, rotaDo } from "../src/lib/corredores";

describe("corredores", () => {
  it("o caminho escolhe o corredor; desconhecido cai no padrão", () => {
    expect(corredorDaUrl("/").id).toBe("alimentos");
    expect(corredorDaUrl("/limpeza/").id).toBe("saneantes");
    expect(corredorDaUrl("/limpeza").id).toBe("saneantes");
    expect(corredorDaUrl("/dicionario/").id).toBe("alimentos");
  });
  it("rota e id de cada corredor batem com o caminho", () => {
    for (const c of CORREDORES) {
      expect(corredorDaUrl(rotaDo(c)).id).toBe(c.id);
      expect(corredorPorId(c.id)).toBe(c);
    }
  });
  it("números e slugs únicos", () => {
    expect(new Set(CORREDORES.map((c) => c.numero)).size).toBe(CORREDORES.length);
    expect(new Set(CORREDORES.map((c) => c.slug)).size).toBe(CORREDORES.length);
  });
});
