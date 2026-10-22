import { describe, expect, it } from "vitest";
import { CORREDORES } from "../src/corredores";
import { apresentacoesAlimento, CONSULTAS, consultaProduto, PLACEHOLDER } from "../src/lib/semjs";

const URL = "https://x.test/data/20261006T231312Z/t.parquet";

describe("sem JavaScript: a consulta de um produto", () => {
  it("existe para todo corredor, lê o Parquet do build e tem o id uma vez", () => {
    for (const c of CORREDORES) {
      const sql = consultaProduto(c.id, URL);
      expect(sql).toContain(`read_parquet('${URL}')`);
      expect(sql.split(PLACEHOLDER).length - 1).toBe(1);
      expect(sql.trimEnd().endsWith(";")).toBe(true);
      expect(CONSULTAS[c.id].oQueE).toMatch(/^pel/);
    }
  });
  it("usa a coluna do id de cada corredor, como fonte.ts", () => {
    expect(consultaProduto("alimentos", URL)).toContain(`WHERE id = ${PLACEHOLDER};`);
    expect(consultaProduto("saneantes", URL)).toContain(`WHERE nu_expediente = '${PLACEHOLDER}'`);
    expect(consultaProduto("cosmeticos", URL)).toContain(`WHERE nu_processo = '${PLACEHOLDER}'`);
    expect(consultaProduto("medicamentos", URL)).toContain(`WHERE id = '${PLACEHOLDER}'`);
    expect(consultaProduto("produtos_saude", URL)).toContain(`WHERE id = '${PLACEHOLDER}'`);
  });
  it("desduplica saneantes e cosméticos como a ilha", () => {
    expect(consultaProduto("saneantes", URL)).toContain("QUALIFY row_number() OVER (PARTITION BY nu_expediente");
    expect(consultaProduto("cosmeticos", URL)).toContain("PARTITION BY nu_processo ORDER BY st_registrado) = 1");
  });
  it("sem a tabela no manifest, indica o caminho em vez de inventar um", () => {
    expect(consultaProduto("medicamentos", null)).toContain(
      "read_parquet('<caminho de medicamentos_por_produto no manifest>')",
    );
  });
  it("as apresentações de um alimento juntam as duas tabelas", () => {
    const sql = apresentacoesAlimento(URL, `${URL}2`);
    expect(sql).toContain("USING (co_seq_apresentacao_produto)");
    expect(sql).toContain(`WHERE a.co_seq_produto = ${PLACEHOLDER};`);
  });
});
