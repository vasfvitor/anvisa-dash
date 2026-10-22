// Leituras de um produto usadas tanto no cartão da lista quanto na página do produto.
import { marcas } from "../../lib/format";
import type { Produto } from "./fonte";
import { palavras } from "../../lib/palavras";
import { legivel } from "../../lib/texto";

export const ativo = (p: Produto): boolean => p.situacao_registro === "Ativo";

/** A petição foi indeferida ("Publicado indeferimento", 252 produtos em 2026-10-06). */
export const indeferido = (p: Produto): boolean => /indeferimento/i.test(p.ds_situacao_assunto_doc ?? "");

/** Quantas marcas o título mostra; as outras viram "+N". */
export const MARCAS_NO_TITULO = 2;

/**
 * Título de um alimento no cartão e na página da empresa: as primeiras marcas, que é o que a pessoa
 * reconhece (o nome registrado costuma ser genérico, "Suplemento alimentar em pó"), e o nome registrado
 * embaixo. Sem marca, o nome vira o título.
 */
export function tituloAlimento(listaMarcas: string[], noProduto: string): { titulo: string; subtitulo: string } {
  return {
    titulo: listaMarcas.slice(0, MARCAS_NO_TITULO).join(" · ") || legivel(noProduto),
    subtitulo: listaMarcas.length ? legivel(noProduto) : "",
  };
}

/** A marca é o que a pessoa reconhece; sem marca, o nome registrado vira o título. */
export const marcaPrincipal = (p: Produto): string => marcas(p.marcas)[0] ?? legivel(p.no_produto);

/**
 * Marcas na ordem do registro, com a que casou com a busca logo depois da primeira: o título do
 * cartão começa igual ao da página do produto e mostra por que o produto apareceu.
 */
export function marcasParaBusca(p: Produto, termo?: string | readonly string[] | null): string[] {
  const [primeira, ...resto] = marcas(p.marcas);
  if (!primeira) return [];
  // a marca casa quando alguma palavra buscada começa uma palavra dela (a regra da busca)
  const ps = typeof termo === "string" ? palavras(termo) : (termo ?? []);
  const casa = (m: string) => palavras(m).some((w) => ps.some((t) => w.startsWith(t)));
  const casou = ps.length && !casa(primeira) ? resto.find(casa) : undefined;
  return casou ? [primeira, casou, ...resto.filter((m) => m !== casou)] : [primeira, ...resto];
}
