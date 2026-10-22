// Corredor 1: alimentos e suplementos (o padrão, na raiz do site).
import type { Corredor } from "../tipos";

export const meta: Corredor = {
  id: "alimentos",
  numero: 1,
  nome: "Alimentos e suplementos",
  curto: "Alimentos",
  slug: "alimentos",
  tabela: "alimentos_por_produto",
  icone: "capsula",
  deco: ["capsula", "folha", "pote", "trigo", "colher", "leite", "gota", "brilho", "etiqueta"],
  titulo: "Alimentos e suplementos liberados pela ANVISA",
  descricao:
    "Veja se um suplemento ou alimento está liberado pela ANVISA, com glúten, lactose e alergênicos: whey, creatina, fórmula infantil. Busque pela marca, nome, empresa ou CNPJ.",
  lead: "Suplementos, fórmulas infantis e dietas enterais.",
  placeholder: "Marca, produto ou CNPJ",
  exemplos: [
    { valor: "whey", texto: "whey" },
    { valor: "colágeno", texto: "colágeno" },
    { valor: "creatina", texto: "creatina" },
    { valor: "01615814000101", texto: "01.615.814/0001-01", dica: "CNPJ" },
    { valor: "25351.453332/2024-10", texto: "25351.453332/2024-10", dica: "processo" },
  ],
  grupo: "Categoria",
  tipos: {
    Registrado: "a ANVISA analisou o produto antes de liberar",
    Notificado:
      "a empresa comunicou o produto à ANVISA e responde pelo que declarou; a categoria dispensa análise prévia",
  },
  item: ["produto", "produtos"],
  dica: "Arroz, pão e outros alimentos comuns não passam pela ANVISA.",
  tipoProduto: 6,
};
