// O cartão da lista e a página de detalhe de cada corredor (componentes Vue: só na ilha).
import type { Component } from "vue";
import CartaoAlimentos from "./alimentos/Cartao.vue";
import PaginaAlimentos from "./alimentos/Pagina.vue";
import CartaoCosmeticos from "./cosmeticos/Cartao.vue";
import PaginaCosmeticos from "./cosmeticos/Pagina.vue";
import CartaoMedicamentos from "./medicamentos/Cartao.vue";
import PaginaMedicamentos from "./medicamentos/Pagina.vue";
import CartaoProdutosSaude from "./produtos_saude/Cartao.vue";
import PaginaProdutosSaude from "./produtos_saude/Pagina.vue";
import CartaoSaneantes from "./saneantes/Cartao.vue";
import PaginaSaneantes from "./saneantes/Pagina.vue";
import type { IdCorredor } from "./tipos";

export const TELAS: Record<IdCorredor, { cartao: Component; pagina: Component }> = {
  alimentos: { cartao: CartaoAlimentos, pagina: PaginaAlimentos },
  saneantes: { cartao: CartaoSaneantes, pagina: PaginaSaneantes },
  cosmeticos: { cartao: CartaoCosmeticos, pagina: PaginaCosmeticos },
  medicamentos: { cartao: CartaoMedicamentos, pagina: PaginaMedicamentos },
  produtos_saude: { cartao: CartaoProdutosSaude, pagina: PaginaProdutosSaude },
};
