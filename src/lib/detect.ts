// Uma caixa de busca só: o que a pessoa digitou decide o modo. Funciona porque o pipeline guarda
// CNPJ, processo e registro como texto com zeros à esquerda; aqui também nunca viram número.
//
// Processos não têm todos 17 dígitos: 44% das linhas têm 13 (processos antigos), 400 têm 14 (mesmo
// tamanho de um CNPJ) e há de 6 a 16. Números de registro têm 9. Por isso só 14 dígitos são CNPJ (que
// também casa com processo, ver predicado() em fontes/); qualquer outro número só de dígitos
// procura em processo e registro.

// marca: escolhida numa sugestão (casa a marca inteira); todos: sem termo, só filtros (navegar por categoria)
export type Modo = "cnpj" | "numero" | "texto" | "marca" | "todos";

export interface Consulta {
  modo: Modo;
  /** só dígitos para cnpj/numero; texto aparado para o resto */
  valor: string;
  /** texto que a pessoa quer como está, mesmo sem resultado: sem "você quis dizer" */
  semCorrecao?: boolean;
}

export const MODO_ROTULO: Record<Modo, string> = {
  cnpj: "CNPJ",
  // numero e texto entram no meio de frase ("Buscando por: “whey” em nome, marca ou empresa"); todos é título
  numero: "nº do processo ou do registro",
  texto: "nome, marca ou empresa",
  marca: "Marca",
  todos: "Todos os produtos",
};

export function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

// o que vem antes do número no rótulo ou na caixa ("MS 1.0068.1234", "Reg. 123456789", "Processo nº 25351…")
const PREFIXO = /^(?:(?:ms|registro|reg\.?|processo|proc\.?|n[ºo°]?\.?|cnpj)[\s:.]*)*/i;

export function detectar(entrada: string): Consulta | null {
  const t = entrada.trim();
  if (!t) return null;
  // só pontuação de documento (. / - espaço) em volta dos dígitos, com ou sem o prefixo do rótulo: "Whey 100"
  // continua texto
  if (/^[\d./\-\s]+$/.test(t.replace(PREFIXO, ""))) {
    const d = soDigitos(t);
    if (d.length === 14) return { modo: "cnpj", valor: d };
    if (d.length >= 6 && d.length <= 17) return { modo: "numero", valor: d };
  }
  return t.length >= 2 ? { modo: "texto", valor: t } : null;
}
