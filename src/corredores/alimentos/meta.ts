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
  titulo: "Alimentos e suplementos liberados pela ANVISA",
  descricao:
    "Consulte alimentos e suplementos regularizados na ANVISA pela marca, nome, empresa, CNPJ ou nº do processo: situação, glúten, lactose, alergênicos e ingredientes.",
  hero: {
    linha1: { antes: "Está ", destaque: "liberado", depois: "?" },
    linha2: { antes: "O que ele ", destaque: "contém", depois: "?" },
    lead: "Alimentos e suplementos registrados ou notificados na ANVISA.",
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
  dica: "Arroz, pão e outros alimentos comuns não passam pela ANVISA.",
  tipoProduto: 6,
};
