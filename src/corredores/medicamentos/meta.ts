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
    "Veja se um remédio tem registro na ANVISA, de qual empresa e até quando, com o preço máximo da CMED: genérico, similar, de marca. Busque pelo nome, princípio ativo ou CNPJ.",
  lead: "Genéricos, similares e de marca, com o preço máximo da CMED.",
  placeholder: "Remédio, princípio ativo ou CNPJ",
  rotuloTexto: "nome, princípio ativo ou empresa",
  rotuloNumero: "nº do registro (o da caixa) ou do processo",
  exemplos: [
    { valor: "dipirona", texto: "dipirona" },
    { valor: "losartana", texto: "losartana" },
    { valor: "novalgina", texto: "novalgina" },
    { valor: "02685377000157", texto: "02.685.377/0001-57", dica: "CNPJ" },
    { valor: "186200018", texto: "1.8620.0018", dica: "registro" },
  ],
  grupo: "Classe terapêutica",
  rotuloTipo: "Categoria",
  // a categoria regulatória, como a ANVISA escreve (grafias variam; notaTipo compara sem caixa nem acento)
  tipos: {
    Novo: "o remédio de referência, o primeiro com a substância, aprovado com estudos próprios",
    Genérico: "mesmo princípio ativo do de referência, com equivalência provada; vendido pelo nome da substância",
    Similar: "equivalente ao de referência, vendido com marca",
    Específico: "soros, vitaminas, minerais e outros com regras próprias de registro",
    Biológico: "produzido a partir de organismos vivos (vacina, insulina, anticorpo)",
    Fitoterápico: "feito de plantas medicinais",
    Dinamizado: "homeopático e semelhantes",
    Radiofármaco: "com material radioativo, para diagnóstico ou tratamento",
    "Produto de terapia avançada": "terapia gênica ou celular",
    "Gases medicinais": "oxigênio e outros gases de uso médico",
    "Baixo risco": "notificado por risco baixo, sem registro",
    "Sem categoria": "a ANVISA não publicou a categoria",
  },
  item: ["remédio", "remédios"],
  dica: "O número da caixa (MS 1.xxxx.xxxx.xxx-x) tem 13 dígitos: os 9 primeiros são o remédio.",
  tipoProduto: 1,
};
