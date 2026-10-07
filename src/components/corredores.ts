// Cartão da lista e página de detalhe de cada corredor (o registro de textos e cores está em
// lib/corredores.ts; a fonte de dados, em lib/fontes/).
import type { Component } from "vue";
import type { IdCorredor } from "../lib/corredores";
import CartaoProduto from "./CartaoProduto.vue";
import CartaoSaneante from "./CartaoSaneante.vue";
import ProdutoPagina from "./ProdutoPagina.vue";
import SaneantePagina from "./SaneantePagina.vue";

export const TELAS: Record<IdCorredor, { cartao: Component; pagina: Component }> = {
  alimentos: { cartao: CartaoProduto, pagina: ProdutoPagina },
  saneantes: { cartao: CartaoSaneante, pagina: SaneantePagina },
};
