// As tabelas dos medicamentos no dicionário de dados: título, o que é uma linha e palavras do Dataset
// (schema.org). As descrições das colunas vêm do manifest.
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  medicamentos: {
    titulo: "Medicamentos registrados na ANVISA",
    descricao:
      "Uma linha por medicamento e processo, como a ANVISA publica (com repetições): nome, princípio ativo, classe terapêutica, categoria regulatória, empresa detentora, situação e vencimento do registro.",
    palavras: ["medicamentos", "remédios", "registro", "princípio ativo", "genéricos"],
  },
  medicamentos_por_produto: {
    titulo: "Medicamentos: uma linha por registro",
    descricao:
      "Uma linha por medicamento registrado na ANVISA (registro de 9 dígitos), com princípio ativo, classe terapêutica, categoria regulatória, empresa, situação e vencimento; derivada da tabela medicamentos.",
    palavras: ["medicamentos", "remédios", "registro", "princípio ativo", "classe terapêutica"],
  },
  cmed: {
    titulo: "Preços máximos de medicamentos (CMED)",
    descricao:
      "Uma linha por apresentação de medicamento na lista mensal da CMED, com o preço fábrica, o preço máximo ao consumidor e o preço máximo de venda ao governo por alíquota de ICMS, em centavos.",
    palavras: ["CMED", "preço máximo", "medicamentos", "PMC", "PMVG"],
  },
};
