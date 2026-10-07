// Leituras de um produto usadas tanto no cartão da lista quanto na página do produto.
import { marcas } from "./format";
import type { Produto } from "./queries";
import { legivel, normalizar } from "./texto";

export const ativo = (p: Produto): boolean => p.situacao_registro === "Ativo";

/** A petição foi indeferida ("Publicado indeferimento", 252 produtos em 2026-10-06). */
export const indeferido = (p: Produto): boolean => /indeferimento/i.test(p.ds_situacao_assunto_doc ?? "");

/** A marca é o que a pessoa reconhece; sem marca, o nome registrado vira o título. */
export const marcaPrincipal = (p: Produto): string => marcas(p.marcas)[0] ?? legivel(p.no_produto);

/**
 * Marcas na ordem do registro, com a que casou com a busca logo depois da primeira: o título do
 * cartão começa igual ao da página do produto e mostra por que o produto apareceu.
 */
export function marcasParaBusca(p: Produto, termo?: string | null): string[] {
  const [primeira, ...resto] = marcas(p.marcas);
  if (!primeira) return [];
  const t = termo ? normalizar(termo.trim()) : "";
  const casou = t && !normalizar(primeira).includes(t) ? resto.find((m) => normalizar(m).includes(t)) : undefined;
  return casou ? [primeira, casou, ...resto.filter((m) => m !== casou)] : [primeira, ...resto];
}
