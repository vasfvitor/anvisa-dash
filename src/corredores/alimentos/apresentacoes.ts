// O que é comum e o que varia entre as apresentações de um produto, e leitura das listas de empresas.
// Medido em 2026-10-06 (produtos ativos com mais de uma apresentação): ingredientes variam em ~13%,
// alergênicos em 2,5%; o resto quase sempre é igual. Mostrar o comum uma vez e só a diferença por
// apresentação poupa a pessoa de comparar blocos repetidos.
import { fmtCnpj, fatiar } from "../../lib/format";

// valores que a ANVISA usa no lugar de "sem informação"
const VAZIOS = new Set(["", "*******", "NAO POSSUI FORMA FISICA NO SIVS"]);

export function vazio(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && VAZIOS.has(v.trim()));
}

export interface Consenso<T> {
  /** campo → valor, quando todas as apresentações com valor concordam */
  comum: Partial<T>;
  /** campos com valores diferentes entre apresentações */
  variam: (keyof T)[];
}

export function consenso<T extends object>(lista: T[], campos: (keyof T)[]): Consenso<T> {
  const comum: Partial<T> = {};
  const variam: (keyof T)[] = [];
  for (const c of campos) {
    const valores = new Set(
      lista
        .map((x) => x[c])
        .filter((v) => !vazio(v))
        .map((v) => String(v).trim()),
    );
    if (valores.size === 1) {
      const v = lista.find((x) => !vazio(x[c]))![c];
      comum[c] = v;
    } else if (valores.size > 1) variam.push(c);
  }
  return { comum, variam };
}

export interface Empresa {
  nome: string;
  local: string;
  /** CNPJ formatado, ou o código da ANVISA para fabricante estrangeiro */
  codigo: string;
}

/**
 * "VIDA FORTE LTDA - ARAÇOIABA DA SERRA - BRASIL ; 07455576000192 | …" → empresas sem repetição.
 * Estrangeiras vêm sem cidade: "DUTCH AMERICAN FOODS, INC. - ESTADOS UNIDOS DA AMÉRICA ; D000190".
 */
export function empresas(s: string | null | undefined): Empresa[] {
  const vistas = new Map<string, Empresa>();
  for (const item of fatiar(s, "|")) {
    const [esq = "", cod = ""] = item.split(" ; ").map((x) => x.trim());
    const partes = esq.split(" - ").map((x) => x.trim());
    let nome = esq;
    let local = "";
    if (partes.length >= 3) {
      nome = partes.slice(0, -2).join(" - ");
      local = `${partes.at(-2)}, ${partes.at(-1)}`;
    } else if (partes.length === 2) {
      [nome, local] = partes as [string, string];
    }
    const codigo = fmtCnpj(cod); // CNPJ formatado; código estrangeiro passa como veio
    const chave = `${nome}|${local}|${codigo}`;
    if (!vistas.has(chave)) vistas.set(chave, { nome, local, codigo });
  }
  return [...vistas.values()];
}
