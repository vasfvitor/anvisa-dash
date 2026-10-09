// Corredor 1: alimentos e suplementos (o padrão, na raiz do site).
import type { Corredor } from "../tipos";

export const meta: Corredor = {
  id: "alimentos",
  numero: 1,
  nome: "Alimentos e suplementos",
  curto: "Alimentos",
  slug: "",
  tabela: "alimentos",
  icone: "capsula",
  deco: ["capsula", "folha", "pote", "trigo", "colher", "leite", "gota", "brilho", "etiqueta"],
  titulo: "O que tem no que você consome",
  descricao:
    "Consulte alimentos e suplementos regularizados na ANVISA pela marca, nome, empresa, CNPJ ou nº do processo: situação, glúten, lactose, alergênicos e ingredientes.",
  hero: {
    selo: "leia o rótulo antes de levar",
    linha1: { antes: "Está ", destaque: "liberado", depois: "?" },
    linha2: { antes: "O que ele ", destaque: "contém", depois: "?" },
    lead: "Suplementos e alimentos que passam pela ANVISA. Busque pela marca, pelo nome, pela empresa ou pelo número que vem no rótulo.",
    carimbo: "dados abertos · leia o rótulo ·",
  },
  placeholder: "Marca, produto ou CNPJ",
  exemplos: [
    { valor: "whey", texto: "whey" },
    { valor: "colágeno", texto: "colágeno" },
    { valor: "creatina", texto: "creatina" },
    { valor: "01615814000101", texto: "01.615.814/0001-01", dica: "CNPJ" },
    { valor: "25351.453332/2024-10", texto: "25351.453332/2024-10", dica: "processo" },
  ],
  grupo: "Categoria",
  item: ["produto", "produtos"],
  oQue: [
    {
      icone: "certo",
      titulo: "Se está liberado",
      texto: "Se a ANVISA conhece o produto, se a liberação continua valendo e desde quando.",
    },
    {
      icone: "trigo",
      titulo: "Se serve para você",
      texto: "Glúten, lactose, alergênicos que contém ou pode conter, ingredientes e público indicado.",
    },
    {
      icone: "fabrica",
      titulo: "Quem fabrica",
      texto: "A empresa responsável, quem envasa e os fabricantes no exterior.",
    },
    {
      icone: "documento",
      titulo: "Os números do rótulo",
      texto: "Processo, registro ou notificação, para conferir na consulta da ANVISA.",
    },
  ],
  dica: "Nem todo alimento passa pela ANVISA: arroz, pão e biscoito comum, por exemplo, não precisam de registro. Tente a marca, a empresa ou o número do rótulo.",
  recipiente: "o pote",
};
