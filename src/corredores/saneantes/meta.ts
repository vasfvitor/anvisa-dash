// Corredor 2: produtos de limpeza, que a ANVISA chama de saneantes.
import type { Corredor } from "../tipos";

export const meta: Corredor = {
  id: "saneantes",
  numero: 2,
  nome: "Produtos de limpeza",
  curto: "Limpeza",
  tecnico: "saneantes",
  slug: "limpeza",
  tabela: "saneantes",
  icone: "borrifador",
  deco: ["borrifador", "bolhas", "gota", "certo", "bolhas", "documento", "gota", "brilho", "etiqueta"],
  titulo: "Seu produto de limpeza é liberado?",
  descricao:
    "Confira se um produto de limpeza (água sanitária, desinfetante, detergente, inseticida…) está liberado pela ANVISA e até quando a liberação vale. Busque pelo nome, pela empresa, pelo CNPJ ou pelo número do rótulo.",
  hero: {
    selo: "antes de usar em casa",
    linha1: { antes: "Liberado ou ", destaque: "clandestino", depois: "?" },
    linha2: { antes: "Ainda está ", destaque: "valendo", depois: "?" },
    lead: "Água sanitária, detergente, desinfetante, inseticida: produto de limpeza também precisa passar pela ANVISA. Busque pelo nome, pela empresa ou pelo número que vem no rótulo.",
    carimbo: "fora do alcance das crianças ·",
  },
  placeholder: "Produto, empresa ou CNPJ",
  rotuloTexto: "Nome do produto ou empresa",
  exemplos: [
    { valor: "ypê", texto: "ypê" },
    { valor: "bombril", texto: "bombril" },
    { valor: "raid", texto: "raid" },
    { valor: "33122466000704", texto: "33.122.466/0007-04", dica: "CNPJ" },
    { valor: "25351.128477/2011-95", texto: "25351.128477/2011-95", dica: "processo" },
  ],
  atalhos: [
    "água sanitária",
    "detergente",
    "desinfetante",
    "amaciante",
    "sabão",
    "lava roupa",
    "alvejante",
    "multiuso",
    "limpa vidro",
    "tira manchas",
    "inseticida",
    "cloro",
  ],
  grupo: "Validade",
  item: ["produto de limpeza", "produtos de limpeza"],
  oQue: [
    {
      icone: "certo",
      titulo: "Se está liberado",
      texto: "Se a ANVISA conhece o produto e se a liberação continua valendo.",
    },
    { icone: "gota", titulo: "Até quando vale", texto: "A data em que a liberação vence, e se ela já passou." },
    {
      icone: "fabrica",
      titulo: "Quem responde por ele",
      texto: "A empresa, com CNPJ, e os outros produtos de limpeza dela.",
    },
    {
      icone: "documento",
      titulo: "Os números do rótulo",
      texto: "Processo, registro e expediente, para conferir na ANVISA.",
    },
  ],
  dica: "Todo produto de limpeza vendido no Brasil precisa estar registrado ou notificado na ANVISA, e o rótulo diz qual. Tente o nome da empresa ou o número do rótulo; se não achar de jeito nenhum, desconfie.",
  recipiente: "o balde",
};
