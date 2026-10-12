// A tabela dos cosméticos no dicionário de dados: título, o que é uma linha e palavras do Dataset (schema.org).
// As descrições das colunas vêm do manifest. Medido em 2026-10-09; ver fonte.ts e consultas.ts.
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  cosmeticos: {
    titulo: "Cosméticos, perfumes e produtos de higiene regularizados na ANVISA",
    descricao:
      "Uma linha por processo de cosmético, perfume ou produto de higiene pessoal registrado, notificado ou isento de registro na ANVISA, com situação, número de registro e vencimento. Processos com registro aparecem duas vezes, uma por st_registrado.",
    palavras: ["cosméticos", "perfumes", "higiene pessoal", "notificação", "registro"],
  },
};
