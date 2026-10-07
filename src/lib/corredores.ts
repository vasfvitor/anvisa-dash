// Os "corredores" do site: cada fonte de dados é um corredor de supermercado, com placa numerada,
// cores e fundo próprios (CSS em [data-corredor]), textos e exemplos. Um corredor novo (por exemplo,
// produtos irregulares) é uma entrada nova aqui, um módulo em lib/fontes/ e um cartão e uma página
// em components/corredores.ts.
import { url } from "./format";

export type IdCorredor = "alimentos" | "saneantes";

interface Frase {
  /** texto antes do destaque */
  antes: string;
  destaque: string;
  depois: string;
}

export interface Corredor {
  id: IdCorredor;
  numero: number;
  nome: string;
  /** nome curto para a placa no celular */
  curto: string;
  /** segmento da URL; vazio é a raiz do site */
  slug: string;
  /** tabela principal no manifest (a do download com barra de progresso) */
  tabela: string;
  icone: string;
  /** ícones que flutuam em volta do título */
  deco: string[];
  titulo: string;
  descricao: string;
  hero: { selo: string; linha1: Frase; linha2: Frase; lead: string; carimbo: string };
  placeholder: string;
  exemplos: { valor: string; texto: string; dica?: string }[];
  /** terceira faceta (além de situação e tipo): categoria nos alimentos, validade nos saneantes */
  grupo: string;
  /** como chamar um item da lista: [singular, plural] */
  item: [string, string];
  oQue: { icone: string; titulo: string; texto: string }[];
}

export const CORREDORES: Corredor[] = [
  {
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
      linha1: { antes: "Este produto é ", destaque: "regular", depois: "?" },
      linha2: { antes: "O que ele ", destaque: "contém", depois: "?" },
      lead: "Alimentos e suplementos regularizados na ANVISA. Busque pela marca, pelo nome, pela empresa, pelo CNPJ ou pelo número do processo.",
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
      { icone: "certo", titulo: "Se está regular", texto: "Ativo ou inativo na ANVISA, registrado ou notificado, e desde quando." },
      { icone: "trigo", titulo: "Se serve para você", texto: "Glúten, lactose, alergênicos que contém ou pode conter, ingredientes e público indicado." },
      { icone: "fabrica", titulo: "Quem fabrica", texto: "A empresa responsável, quem envasa e os fabricantes no exterior." },
      { icone: "documento", titulo: "Os números oficiais", texto: "Processo, registro ou notificação, para conferir na consulta da ANVISA." },
    ],
  },
  {
    id: "saneantes",
    numero: 2,
    nome: "Saneantes",
    curto: "Saneantes",
    slug: "saneantes",
    tabela: "saneantes",
    icone: "borrifador",
    deco: ["borrifador", "bolhas", "gota", "certo", "bolhas", "documento", "gota", "brilho", "etiqueta"],
    titulo: "Saneantes: regular e na validade?",
    descricao:
      "Consulte saneantes (desinfetantes, detergentes, alvejantes, inseticidas…) notificados ou registrados na ANVISA pelo nome, empresa, CNPJ ou nº do processo: situação e validade.",
    hero: {
      selo: "confira antes de usar em casa",
      linha1: { antes: "Este saneante é ", destaque: "regular", depois: "?" },
      linha2: { antes: "Ainda está ", destaque: "válido", depois: "?" },
      lead: "Desinfetantes, detergentes, alvejantes, inseticidas e outros produtos de limpeza notificados ou registrados na ANVISA. Busque pelo nome, pela empresa, pelo CNPJ ou pelo número do processo.",
      carimbo: "dados abertos · confira a validade ·",
    },
    placeholder: "Produto, empresa ou CNPJ",
    exemplos: [
      { valor: "água sanitária", texto: "água sanitária" },
      { valor: "desinfetante", texto: "desinfetante" },
      { valor: "raid", texto: "raid" },
      { valor: "33122466000704", texto: "33.122.466/0007-04", dica: "CNPJ" },
      { valor: "25351.128477/2011-95", texto: "25351.128477/2011-95", dica: "processo" },
    ],
    grupo: "Validade",
    item: ["saneante", "saneantes"],
    oQue: [
      { icone: "certo", titulo: "Se está regular", texto: "Ativo ou inativo na ANVISA, registrado ou notificado." },
      { icone: "gota", titulo: "Se ainda vale", texto: "A data de vencimento da regularização e se ela já passou." },
      { icone: "fabrica", titulo: "Quem responde por ele", texto: "A empresa detentora, com CNPJ, e os outros saneantes dela." },
      { icone: "documento", titulo: "Os números oficiais", texto: "Processo, registro e expediente, para conferir na ANVISA." },
    ],
  },
];

export const CORREDOR_PADRAO = CORREDORES[0]!;

/** Caminho do corredor no site, com o base path. */
export function rotaDo(c: Corredor): string {
  return url(c.slug ? `/${c.slug}/` : "/");
}

/** Corredor pelo primeiro segmento do caminho depois do base path; desconhecido cai no padrão. */
export function corredorDaUrl(pathname: string): Corredor {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const resto = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const slug = resto.split("/").filter(Boolean)[0] ?? "";
  return CORREDORES.find((c) => c.slug === slug) ?? CORREDOR_PADRAO;
}

export function corredorPorId(id: string): Corredor {
  return CORREDORES.find((c) => c.id === id) ?? CORREDOR_PADRAO;
}
