import { afterEach, describe, expect, it, vi } from "vitest";
import { lerUrl, montarUrl } from "../src/components/composables/useUrlState";
import { CORREDORES, corredorDaUrl, rotaDo } from "../src/lib/corredores";

/** Separa caminho e query de uma URL montada, para relê-la com lerUrl. */
function partes(u: string): { caminho: string; search: string } {
  const i = u.indexOf("?");
  return i < 0 ? { caminho: u, search: "" } : { caminho: u.slice(0, i), search: u.slice(i) };
}

describe("estado na URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ida e volta em cada corredor", () => {
    const estado = {
      q: "whey",
      marca: "",
      grupo: "Vencida",
      tipo: "Notificado",
      situacao: "todos",
      produto: null,
    } as const;
    for (const c of CORREDORES) {
      const { caminho, search } = partes(montarUrl(estado, rotaDo(c)));
      expect(corredorDaUrl(caminho).id).toBe(c.id);
      expect(lerUrl(search)).toEqual(estado);
    }
  });

  it("o padrão não aparece na URL", () => {
    expect(montarUrl({ q: "  whey ", grupo: "", tipo: "", situacao: "ativo", produto: null }, "/")).toBe("/?q=whey");
    expect(montarUrl({ q: "", situacao: "ativo" }, "/limpeza/")).toBe("/limpeza/");
  });

  it("marca escolhida vence o texto digitado", () => {
    expect(montarUrl({ q: "liquid", marca: "LIQUID I.V." }, "/")).toBe("/?marca=LIQUID+I.V.");
  });

  it("valores inválidos caem no padrão", () => {
    expect(lerUrl("?sit=qualquer").situacao).toBe("ativo");
    expect(lerUrl("?p=12a").produto).toBeNull();
    expect(lerUrl("?p=000123").produto).toBe("000123");
  });

  it("com o base path do GitHub Pages", () => {
    vi.stubEnv("BASE_URL", "/anvisa-dash/");
    for (const c of CORREDORES) {
      expect(rotaDo(c).startsWith("/anvisa-dash/")).toBe(true);
      expect(corredorDaUrl(rotaDo(c)).id).toBe(c.id);
    }
    expect(corredorDaUrl("/anvisa-dash/").id).toBe("alimentos");
    expect(corredorDaUrl("/anvisa-dash/limpeza/").id).toBe("saneantes");
  });
});
