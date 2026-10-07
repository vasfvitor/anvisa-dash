// Resumo de glúten, lactose e alergênicos de um produto a partir das suas apresentações.
// Formatos da ANVISA (alimentos_resultado):
//   intolerancias: "Contém Glúten - Não | Contém Lactose - Sim"
//   alergenicos:   "Contém derivado de - Leite#Soja | Pode conter - Ovos | Não contém - Amendoim#Nozes |"
// Rótulos encontrados nos dados de 2026-10-06: Não contém, Pode conter, Contém derivado de, Contém.
// Em 2,5% dos produtos ativos as apresentações divergem; aí o resumo junta tudo e marca `varia`.
import { fatiar } from "./format";

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

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function resumirAlergia(alergenicos: (string | null)[], intolerancias: (string | null)[]): ResumoAlergia {
  const gluten = new Set<string>();
  const lactose = new Set<string>();
  for (const s of new Set(intolerancias)) {
    for (const par of fatiar(s, "|")) {
      const i = par.lastIndexOf(" - ");
      if (i < 0) continue;
      const rotulo = semAcento(par.slice(0, i));
      const v = semAcento(par.slice(i + 3).trim()) === "sim" ? "sim" : "nao";
      if (rotulo.includes("gluten")) gluten.add(v);
      else if (rotulo.includes("lactose")) lactose.add(v);
    }
  }

  const contem = new Set<string>();
  const podeConter = new Set<string>();
  const naoContem = new Set<string>();
  for (const s of new Set(alergenicos)) {
    for (const g of fatiar(s, "|")) {
      const i = g.indexOf(" - ");
      if (i < 0) continue;
      const rotulo = semAcento(g.slice(0, i));
      const itens = fatiar(g.slice(i + 3), "#");
      const alvo = rotulo.startsWith("nao contem") ? naoContem : rotulo.startsWith("pode conter") ? podeConter : contem;
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
    varia: distintos(alergenicos) > 1 || distintos(intolerancias) > 1,
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
