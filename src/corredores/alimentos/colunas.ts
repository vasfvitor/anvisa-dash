// As tabelas dos alimentos no dicionário de dados: título, o que é uma linha e palavras do Dataset (schema.org).
// As descrições das colunas vêm do manifest (escritas no repo `anvisa`; as daqui foram a semente).
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  alimentos: {
    titulo: "Alimentos e suplementos regularizados na ANVISA",
    descricao:
      "Uma linha por apresentação de produto alimentício regularizado na ANVISA (registrado ou notificado), incluindo suplementos alimentares.",
    palavras: ["alimentos", "suplementos alimentares", "registro", "notificação"],
  },
  alimentos_resultado: {
    titulo: "Apresentações de alimentos: embalagens, ingredientes e alergênicos",
    descricao:
      "Detalhe de cada apresentação: validade, forma física, embalagens, ingredientes, intolerâncias e alergênicos.",
    palavras: ["alergênicos", "ingredientes", "embalagens", "validade"],
  },
  alimentos_fabricacao: {
    titulo: "Quem fabrica os alimentos de cada empresa: envasadoras e fabricantes no exterior",
    descricao:
      "Uma linha por empresa detentora e fabricante dos seus alimentos e suplementos: a envasadora brasileira (CNPJ, cidade) ou o fabricante no exterior (código ANVISA), o vínculo entre elas e quantos produtos cada uma faz.",
    palavras: ["envasadora", "fabricante", "terceirização", "marca própria", "alimentos"],
  },
  // CICLO_ANALISE_PETICOES_ALIMENTO e …_ANDAMENTO_ALIMENTO; só o primeiro tem data_primeira_finalizacao
  peticoes_alimento: {
    titulo: "Ciclo de análise das petições de alimentos na ANVISA",
    descricao:
      "Etapas do ciclo de análise das petições de alimentos na ANVISA: uma linha por petição e grupo de etapas, com assunto, situação atual, fila de análise e as datas de início e fim de cada etapa.",
    palavras: ["petições", "análise", "alimentos", "fila"],
  },
  peticoes_alimento_andamento: {
    titulo: "Petições de alimentos em análise na ANVISA",
    descricao: "As mesmas etapas do ciclo de análise, só para as petições de alimentos ainda em andamento na ANVISA.",
    palavras: ["petições", "análise", "alimentos", "fila"],
  },
};
