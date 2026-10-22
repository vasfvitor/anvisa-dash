// Corredor 4: remédios, que a ANVISA chama de medicamentos.
import type { Corredor } from "../tipos";

export const meta: Corredor = {
  id: "medicamentos",
  numero: 4,
  nome: "Remédios",
  curto: "Remédios",
  tecnico: "medicamentos",
  slug: "remedios",
  tabela: "medicamentos_por_produto",
  icone: "comprimido",
  deco: ["comprimido", "capsula", "gota", "documento", "certo", "brilho", "etiqueta", "comprimido", "gota"],
  titulo: "Remédios registrados na ANVISA",
  descricao:
    "Veja se um remédio tem registro na ANVISA, de qual laboratório, com qual princípio ativo e até quando vale: genérico, similar, novo, biológico. Busque pelo nome, pelo princípio ativo, pela empresa ou pelo CNPJ.",
  lead: "Registrados na ANVISA, com preço máximo da CMED.",
  placeholder: "Remédio, princípio ativo ou CNPJ",
  rotuloTexto: "Nome, princípio ativo ou empresa",
  rotuloNumero: "Nº do registro (9 ou 13 dígitos) ou do processo",
  exemplos: [
    { valor: "dipirona", texto: "dipirona" },
    { valor: "losartana", texto: "losartana" },
    { valor: "novalgina", texto: "novalgina" },
    { valor: "02685377000157", texto: "02.685.377/0001-57", dica: "CNPJ" },
    { valor: "186200018", texto: "1.8620.0018", dica: "registro" },
  ],
  grupo: "Classe terapêutica",
  item: ["remédio", "remédios"],
  dica: "O número da caixa (MS 1.xxxx.xxxx.xxx-x) tem 13 dígitos: os 9 primeiros são o remédio.",
  tipoProduto: 1,
};
