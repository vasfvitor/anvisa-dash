import { describe, expect, it } from "vitest";
import { CORREDORES, corredorDaUrl, corredorPorId, rotaDo } from "../src/corredores";

describe("corredores", () => {
  it("o caminho escolhe o corredor; desconhecido cai no padrão", () => {
    expect(corredorDaUrl("/alimentos/").id).toBe("alimentos");
    // a raiz é a página inicial: as cores dela são as do corredor padrão
    expect(corredorDaUrl("/").id).toBe("alimentos");
    expect(corredorDaUrl("/limpeza/").id).toBe("saneantes");
    expect(corredorDaUrl("/limpeza").id).toBe("saneantes");
    expect(corredorDaUrl("/remedios/").id).toBe("medicamentos");
    expect(corredorDaUrl("/dispositivos/").id).toBe("produtos_saude");
    expect(corredorDaUrl("/dicionario/").id).toBe("alimentos");
  });
  it("rota e id de cada corredor batem com o caminho", () => {
    for (const c of CORREDORES) {
      expect(corredorDaUrl(rotaDo(c)).id).toBe(c.id);
      expect(corredorPorId(c.id)).toBe(c);
    }
  });
  it("cada corredor explica os seus tipos numa oração curta, sem ponto final", () => {
    for (const c of CORREDORES) {
      const valores = Object.entries(c.tipos);
      expect(valores.length, c.id).toBeGreaterThan(0);
      for (const [valor, oracao] of valores) {
        expect(valor, c.id).toMatch(/^\S/);
        expect(oracao.length, `${c.id}: ${valor}`).toBeLessThan(120);
        expect(oracao, `${c.id}: ${valor}`).not.toMatch(/\.$/);
      }
    }
  });
  it("a copy de cada corredor cabe no buscador e lê em frases curtas", () => {
    const frases = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const c of CORREDORES) {
      expect(c.descricao.length, c.id).toBeLessThanOrEqual(175);
      for (const f of frases(c.descricao)) expect(f.split(/\s+/).length, `${c.id}: ${f}`).toBeLessThanOrEqual(25);
      expect(c.lead, c.id).toMatch(/\.$/);
      // rótulos entram no meio de frase: começam em minúscula
      for (const r of [c.rotuloTexto, c.rotuloNumero]) if (r) expect(r, c.id).toMatch(/^[a-zº]/);
    }
  });
  it("números e slugs únicos", () => {
    expect(new Set(CORREDORES.map((c) => c.numero)).size).toBe(CORREDORES.length);
    expect(new Set(CORREDORES.map((c) => c.slug)).size).toBe(CORREDORES.length);
  });
});
