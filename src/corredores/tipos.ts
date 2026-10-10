// O que cada corredor declara sobre si: textos, exemplos, ícones e a tabela principal. Só dados, para as
// páginas Astro gerarem tudo no build sem carregar o DuckDB.
export type IdCorredor = "alimentos" | "saneantes" | "cosmeticos";

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
  /** o <title> da página do corredor (o que aparece no resultado de busca e na aba): descritivo, não o slogan */
  titulo: string;
  descricao: string;
  /** frase sob o título (o h1 é o nome do corredor) */
  lead: string;
  placeholder: string;
  /** o que a busca por texto procura, quando não é o padrão (nome, marca ou empresa) */
  rotuloTexto?: string;
  /** o que a busca por número procura, quando não é o padrão (processo ou registro) */
  rotuloNumero?: string;
  exemplos: { valor: string; texto: string; dica?: string }[];
  /** buscas prontas para explorar sem digitar; sem elas, a abertura oferece os valores da terceira faceta */
  atalhos?: string[];
  /** terceira faceta (além de situação e tipo): categoria nos alimentos, validade nos saneantes */
  grupo: string;
  /** como chamar um item da lista: [singular, plural] */
  item: [string, string];
  /** dica quando a busca não acha nada */
  dica: string;
  /**
   * co_tipo_produto destes produtos em produtos_irregulares (medidas de fiscalização da ANVISA: 6 é
   * Alimento, 3 Saneantes, 2 Cosmético…); sem ele, o corredor não mostra medidas
   */
  tipoProduto?: number;
  /**
   * letras que uma palavra da busca precisa ter para valer (os cosméticos procuram por começo de palavra
   * em arquivos por palavra; ver corredores/cosmeticos); sem ele, qualquer termo de 2 letras busca
   */
  palavraMinima?: number;
}

// a tabela no dicionário de dados é declarada aqui, mas o formato é do Dataset (lib/dataset.ts)
export type { InfoTabela } from "../lib/dataset";
