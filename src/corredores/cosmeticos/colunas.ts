// Descrição da tabela dos cosméticos para o dicionário de dados (as colunas aparecem com tipo e nome de
// origem). Medido em 2026-10-09; ver fonte.ts e consultas.ts.
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  cosmeticos: {
    titulo: "Cosméticos, perfumes e produtos de higiene regularizados na ANVISA",
    descricao:
      "Uma linha por processo de cosmético, perfume ou produto de higiene pessoal registrado, notificado ou isento de registro na ANVISA, com situação, número de registro e vencimento. Processos com registro aparecem duas vezes, uma por st_registrado.",
    palavras: ["cosméticos", "perfumes", "higiene pessoal", "notificação", "registro"],
  },
};

export const COLUNA_DESCRICAO: Record<string, Record<string, string>> = {
  cosmeticos: {
    st_registrado: "Verdadeiro na linha do registro; um processo pode ter as duas linhas.",
    ds_tipo_peticao:
      "Tipo da regularização: REGISTRO, Notificado, ISENTO DE REGISTRO ou DESCARTAVEL; vazio nas linhas de registro.",
  },
};
