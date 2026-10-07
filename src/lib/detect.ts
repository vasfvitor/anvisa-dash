// Uma caixa de busca só: o que a pessoa digitou decide o modo. Funciona porque o pipeline guarda
// CNPJ, processo e registro como texto com zeros à esquerda; aqui também nunca viram número.
//
// Processos não têm todos 17 dígitos: 44% das linhas têm 13 (processos antigos), 400 têm 14 (mesmo
// tamanho de um CNPJ) e há de 6 a 16. Números de registro têm 9. Por isso só 14 dígitos são CNPJ;
// qualquer outro número só de dígitos procura em processo e registro, e um CNPJ sem resultado é
// tentado de novo como processo (ver useBusca).

// marca: escolhida numa sugestão (casa a marca inteira); todos: sem termo, só filtros (navegar por categoria)
export type Modo = "cnpj" | "numero" | "texto" | "marca" | "todos";

export interface Consulta {
  modo: Modo;
  /** só dígitos para cnpj/numero; texto aparado para o resto */
  valor: string;
}

export const MODO_ROTULO: Record<Modo, string> = {
  cnpj: "CNPJ",
  numero: "Nº do processo ou registro",
  texto: "Nome, marca ou empresa",
  marca: "Marca",
  todos: "Todos os produtos",
};

export function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export function detectar(entrada: string): Consulta | null {
  const t = entrada.trim();
  if (!t) return null;
  // só pontuação de documento (. / - espaço) em volta dos dígitos: "Whey 100" continua texto
  if (/^[\d.\/\-\s]+$/.test(t)) {
    const d = soDigitos(t);
    if (d.length === 14) return { modo: "cnpj", valor: d };
    if (d.length >= 6 && d.length <= 17) return { modo: "numero", valor: d };
  }
  return t.length >= 2 ? { modo: "texto", valor: t } : null;
}
