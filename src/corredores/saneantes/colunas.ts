// Descrição da tabela dos saneantes para o dicionário de dados (as colunas aparecem com tipo e nome de
// origem). Medido em 2026-10-07; ver fonte.ts.
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  saneantes: {
    titulo: "Produtos de limpeza (saneantes) regularizados na ANVISA",
    descricao:
      "Uma linha por processo de produto saneante (limpeza, desinfecção, controle de pragas) registrado ou notificado na ANVISA, com situação, número de registro, expediente e vencimento da liberação.",
    palavras: ["saneantes", "produtos de limpeza", "desinfetantes", "registro"],
  },
};

export const COLUNA_DESCRICAO: Record<string, Record<string, string>> = {};
