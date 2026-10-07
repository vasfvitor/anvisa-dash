// Busca com paginação. Respostas fora de ordem (digitação rápida) são descartadas pelo número da vez.
import { computed, reactive, ref, shallowRef } from "vue";
import { detectar } from "../../lib/detect";
import { buscarProdutos, POR_PAGINA, type Filtros, type Produto } from "../../lib/queries";

export function useBusca() {
  const entrada = ref("");
  const filtros = reactive<Filtros>({ categoria: "", tipo: "", inativos: false });
  const consulta = computed(() => detectar(entrada.value));
  const produtos = shallowRef<Produto[]>([]);
  const total = ref(0);
  const carregando = ref(false);
  const erro = ref("");
  /** consulta que gerou a lista atual (para o texto "N produtos para …") */
  const buscada = shallowRef(consulta.value);
  let pagina = 0;
  let vez = 0;
  let ultima = "";

  /** `forcar` refaz mesmo sem mudança (Enter); sem ele, a mesma busca de novo é ignorada. */
  async function buscar(mais = false, forcar = false): Promise<void> {
    const q = consulta.value;
    const chave = JSON.stringify([q, filtros]);
    if (!mais && !forcar && chave === ultima) return;
    ultima = chave;
    const minha = ++vez;
    if (!q) {
      produtos.value = [];
      total.value = 0;
      buscada.value = null;
      erro.value = "";
      carregando.value = false;
      return;
    }
    pagina = mais ? pagina + 1 : 0;
    carregando.value = true;
    erro.value = "";
    try {
      let usada = mais && buscada.value ? buscada.value : q;
      let linhas = await buscarProdutos(usada, { ...filtros }, pagina);
      // 14 dígitos sem CNPJ correspondente: há 400 processos antigos desse tamanho
      if (!mais && !linhas.length && q.modo === "cnpj") {
        usada = { modo: "numero", valor: q.valor };
        linhas = await buscarProdutos(usada, { ...filtros }, 0);
      }
      if (minha !== vez) return;
      produtos.value = mais ? [...produtos.value, ...linhas] : linhas;
      // total vem em toda linha (window count); página vazia mantém o anterior
      if (linhas.length) total.value = linhas[0]!.total;
      else if (!mais) total.value = 0;
      buscada.value = usada;
    } catch (e) {
      if (minha !== vez) return;
      ultima = ""; // deixa tentar a mesma busca de novo
      erro.value = e instanceof Error ? e.message : String(e);
    } finally {
      if (minha === vez) carregando.value = false;
    }
  }

  const temMais = computed(() => produtos.value.length < total.value && produtos.value.length >= POR_PAGINA);

  return { entrada, filtros, consulta, produtos, total, carregando, erro, buscada, temMais, buscar };
}
