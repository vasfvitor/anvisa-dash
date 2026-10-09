// Glúten, lactose e alergênicos: o formato da ANVISA (alimentos_resultado) e o resumo por produto.
//   intolerancias: "Contém Glúten - Não | Contém Lactose - Sim"
//   alergenicos:   "Contém derivado de - Leite#Soja | Pode conter - Ovos | Não contém - Amendoim#Nozes |"
// Rótulos encontrados nos dados de 2026-10-06: Não contém, Pode conter, Contém derivado de, Contém.
// Em 2,5% dos produtos ativos as apresentações divergem; aí o resumo junta tudo e marca `varia`.
import { fatiar } from "./format";
import { normalizar } from "./texto";

export interface Grupo {
  rotulo: string;
  itens: string[];
}

/** `alergenicos`: grupos separados por " | ", cada um "Rótulo - item#item#item". */
export function alergenicos(s: string | null | undefined): Grupo[] {
  return fatiar(s, "|").map((g) => {
    const i = g.indexOf(" - ");
    if (i < 0) return { rotulo: "", itens: fatiar(g, "#") };
    return { rotulo: g.slice(0, i).trim(), itens: fatiar(g.slice(i + 3), "#") };
  });
}

/** `intolerancias`: "Contém Glúten - Não | Contém Lactose - Sim" → pares rótulo/valor. */
export function intolerancias(s: string | null | undefined): { rotulo: string; valor: string }[] {
  return fatiar(s, "|").map((p) => {
    const i = p.lastIndexOf(" - ");
    return i < 0 ? { rotulo: p, valor: "" } : { rotulo: p.slice(0, i).trim(), valor: p.slice(i + 3).trim() };
  });
}

// nomes legais longos da lista de alergênicos, encurtados onde o espaço é pouco (selos do cartão)
const CURTOS: Record<string, string> = {
  "Leites de todas as espécies de animais mamíferos": "Leite",
  "Castanha-do-brasil ou castanha-do-pará": "Castanha-do-pará",
};
export const nomeCurto = (item: string): string => CURTOS[item] ?? item;

export type Sinal = "sim" | "nao" | "varia" | null;

export interface ResumoAlergia {
  gluten: Sinal;
  lactose: Sinal;
  /** "Contém" e "Contém derivado de", juntos: é o que importa para quem tem alergia */
  contem: string[];
  podeConter: string[];
  /** só itens que nenhuma apresentação declara conter */
  naoContem: string[];
  varia: boolean;
  temDados: boolean;
}

function sinal(valores: Set<string>): Sinal {
  if (valores.has("sim") && valores.has("nao")) return "varia";
  if (valores.has("sim")) return "sim";
  if (valores.has("nao")) return "nao";
  return null;
}

/** Junta as declarações de todas as apresentações de um produto. */
export function resumirAlergia(
  listaAlergenicos: (string | null)[],
  listaIntolerancias: (string | null)[],
): ResumoAlergia {
  const gluten = new Set<string>();
  const lactose = new Set<string>();
  for (const s of new Set(listaIntolerancias)) {
    for (const { rotulo, valor } of intolerancias(s)) {
      if (!valor) continue;
      const r = normalizar(rotulo);
      const v = normalizar(valor) === "sim" ? "sim" : "nao";
      if (r.includes("gluten")) gluten.add(v);
      else if (r.includes("lactose")) lactose.add(v);
    }
  }

  const contem = new Set<string>();
  const podeConter = new Set<string>();
  const naoContem = new Set<string>();
  for (const s of new Set(listaAlergenicos)) {
    for (const { rotulo, itens } of alergenicos(s)) {
      if (!rotulo) continue;
      const r = normalizar(rotulo);
      const alvo = r.startsWith("nao contem") ? naoContem : r.startsWith("pode conter") ? podeConter : contem;
      for (const x of itens) alvo.add(x);
    }
  }
  // um item que alguma apresentação contém (ou pode conter) não entra em "não contém"
  for (const x of [...contem, ...podeConter]) naoContem.delete(x);
  for (const x of contem) podeConter.delete(x);

  const distintos = (xs: (string | null)[]) => new Set(xs.filter((x) => x && x.trim())).size;
  const ordenar = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    gluten: sinal(gluten),
    lactose: sinal(lactose),
    contem: ordenar(contem),
    podeConter: ordenar(podeConter),
    naoContem: ordenar(naoContem),
    varia: distintos(listaAlergenicos) > 1 || distintos(listaIntolerancias) > 1,
    temDados: gluten.size + lactose.size + contem.size + podeConter.size + naoContem.size > 0,
  };
}

/** Lê as listas JSON que a tabela `resumo` guarda; vazio ou inválido vira lista vazia. */
export function deJson(s: string | null | undefined): (string | null)[] {
  if (!s) return [];
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : null)) : [];
  } catch {
    return [];
  }
}
