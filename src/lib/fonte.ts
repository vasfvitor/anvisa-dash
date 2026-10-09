// O contrato de uma fonte de dados (corredor) com o app: tipos e constantes da busca, sem dependências.
// Componentes e composables importam daqui sem carregar o DuckDB; o SQL compartilhado está em sql.ts.
import type { Consulta } from "./detect";

export const POR_PAGINA = 30;

export type Situacao = "ativo" | "inativo" | "todos";

export interface Filtros {
  /** terceira faceta: categoria nos alimentos, validade nos saneantes */
  grupo: string;
  tipo: string;
  situacao: Situacao;
}

/** Filtros de uma busca nova: só os liberados. Congelado: espalhe (`{ ...FILTROS_PADRAO }`) antes de mudar. */
export const FILTROS_PADRAO: Readonly<Filtros> = Object.freeze({ grupo: "", tipo: "", situacao: "ativo" });

export type Dimensao = "situacao" | "tipo" | "grupo";

export interface ValorFaceta {
  valor: string;
  n: number;
}
export type Facetas = Record<Dimensao, ValorFaceta[]>;

export interface Sugestao {
  tipo: "marca" | "empresa";
  rotulo: string;
  nu_cnpj_empresa: string | null;
  n: number;
  ativos: number;
}

export interface Numeros {
  produtos: number;
  ativos: number;
  empresas: number;
}

/** Item de uma lista de resultados: `total` é o total da busca (window count) em toda linha. */
export interface Item {
  total: number;
}

/** O contrato de um corredor com o app. */
export interface Fonte<P extends Item = Item> {
  /** baixa a tabela principal e monta o necessário para a primeira busca */
  preparar(): Promise<void>;
  buscar(q: Consulta, f: Filtros, pagina: number): Promise<P[]>;
  facetas(q: Consulta, f: Filtros): Promise<Facetas>;
  sugerir(texto: string): Promise<Sugestao[]>;
  porId(id: string): Promise<P | null>;
  numeros(): Promise<Numeros>;
  /** valores da terceira faceta com produtos ativos, para explorar sem digitar */
  grupos(): Promise<ValorFaceta[]>;
  idDe(p: P): string;
  /** informação que chega depois da lista (o resumo de alergênicos nos alimentos) */
  complementar?(ids: string[]): Promise<Map<string, unknown>>;
}
