import { describe, expect, it } from "vitest";
import { consenso, empresas, vazio } from "../src/lib/apresentacoes";

describe("consenso", () => {
  it("separa comum de variável e ignora placeholders", () => {
    const aps = [
      { validade: "24 Meses", forma: "PÓ", emb: "pote" },
      { validade: "24 Meses", forma: "*******", emb: "sachê" },
    ];
    expect(consenso(aps, ["validade", "forma", "emb"])).toEqual({
      comum: { validade: "24 Meses", forma: "PÓ" },
      variam: ["emb"],
    });
    expect(vazio("NAO POSSUI FORMA FISICA NO SIVS")).toBe(true);
  });
});

describe("empresas", () => {
  it("lê nacionais e estrangeiras, sem repetição", () => {
    const s =
      "VIDA FORTE LTDA - ARAÇOIABA DA SERRA - BRASIL ; 07455576000192 | VIDA FORTE LTDA - ARAÇOIABA DA SERRA - BRASIL ; 07455576000192 | DUTCH AMERICAN FOODS, INC. - ESTADOS UNIDOS DA AMÉRICA ; D000190";
    expect(empresas(s)).toEqual([
      { nome: "VIDA FORTE LTDA", local: "ARAÇOIABA DA SERRA, BRASIL", codigo: "07.455.576/0001-92" },
      { nome: "DUTCH AMERICAN FOODS, INC.", local: "ESTADOS UNIDOS DA AMÉRICA", codigo: "D000190" },
    ]);
  });
});
