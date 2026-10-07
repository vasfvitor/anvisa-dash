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
  /** como a ANVISA chama o corredor, quando o nome do dia a dia é outro (aparece no hover da placa) */
  tecnico?: string;
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
  /** o que a busca por texto procura, quando não é o padrão (nome, marca ou empresa) */
  rotuloTexto?: string;
  exemplos: { valor: string; texto: string; dica?: string }[];
  /** buscas prontas para explorar sem digitar; sem elas, a abertura oferece os valores da terceira faceta */
  atalhos?: string[];
  /** terceira faceta (além de situação e tipo): categoria nos alimentos, validade nos saneantes */
  grupo: string;
  /** como chamar um item da lista: [singular, plural] */
  item: [string, string];
  oQue: { icone: string; titulo: string; texto: string }[];
  /** dica quando a busca não acha nada */
  dica: string;
  /** o que enche no carregamento ("o pote", "o balde") */
  recipiente: string;
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
      { icone: "certo", titulo: "Se está liberado", texto: "Se a ANVISA conhece o produto, se a liberação continua valendo e desde quando." },
      { icone: "trigo", titulo: "Se serve para você", texto: "Glúten, lactose, alergênicos que contém ou pode conter, ingredientes e público indicado." },
      { icone: "fabrica", titulo: "Quem fabrica", texto: "A empresa responsável, quem envasa e os fabricantes no exterior." },
      { icone: "documento", titulo: "Os números do rótulo", texto: "Processo, registro ou notificação, para conferir na consulta da ANVISA." },
    ],
    dica: "Nem todo alimento passa pela ANVISA: arroz, pão e biscoito comum, por exemplo, não precisam de registro. Tente a marca, a empresa ou o número do rótulo.",
    recipiente: "o pote",
  },
  {
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
      "água sanitária", "detergente", "desinfetante", "amaciante", "sabão", "lava roupa",
      "alvejante", "multiuso", "limpa vidro", "tira manchas", "inseticida", "cloro",
    ],
    grupo: "Validade",
    item: ["produto de limpeza", "produtos de limpeza"],
    oQue: [
      { icone: "certo", titulo: "Se está liberado", texto: "Se a ANVISA conhece o produto e se a liberação continua valendo." },
      { icone: "gota", titulo: "Até quando vale", texto: "A data em que a liberação vence, e se ela já passou." },
      { icone: "fabrica", titulo: "Quem responde por ele", texto: "A empresa, com CNPJ, e os outros produtos de limpeza dela." },
      { icone: "documento", titulo: "Os números do rótulo", texto: "Processo, registro e expediente, para conferir na ANVISA." },
    ],
    dica: "Todo produto de limpeza vendido no Brasil precisa estar registrado ou notificado na ANVISA, e o rótulo diz qual. Tente o nome da empresa ou o número do rótulo; se não achar de jeito nenhum, desconfie.",
    recipiente: "o balde",
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
