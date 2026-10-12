// A tabela dos saneantes no dicionário de dados: título, o que é uma linha e palavras do Dataset (schema.org).
// As descrições das colunas vêm do manifest. Medido em 2026-10-07; ver fonte.ts.
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  saneantes: {
    titulo: "Produtos de limpeza (saneantes) regularizados na ANVISA",
    descricao:
      "Uma linha por processo de produto saneante (limpeza, desinfecção, controle de pragas) registrado ou notificado na ANVISA, com situação, número de registro, expediente e vencimento da liberação.",
    palavras: ["saneantes", "produtos de limpeza", "desinfetantes", "registro"],
  },
};
