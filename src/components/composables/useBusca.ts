// Busca com paginação e facetas. Respostas fora de ordem (digitação rápida) são descartadas pelo
// número da vez.
import { computed, reactive, ref, shallowRef } from "vue";
import { detectar, type Consulta } from "../../lib/detect";
import { buscarProdutos, facetas, POR_PAGINA, type Facetas, type Filtros, type Produto } from "../../lib/queries";

const SEM_FACETAS: Facetas = { situacao: [], tipo: [], categoria: [] };

export function useBusca() {
  const entrada = ref("");
  /** marca escolhida numa sugestão; digitar de novo a desfaz */
  const marca = ref("");
  const filtros = reactive<Filtros>({ categoria: "", tipo: "", situacao: "ativo" });
  const consulta = computed<Consulta | null>(() => {
    if (marca.value) return { modo: "marca", valor: marca.value };
    // sem termo mas com categoria: navegar pela categoria
    return detectar(entrada.value) ?? (filtros.categoria ? { modo: "todos", valor: "" } : null);
  });
  const produtos = shallowRef<Produto[]>([]);
  const total = ref(0);
  const contagens = shallowRef<Facetas>(SEM_FACETAS);
  const carregando = ref(false);
  const erro = ref("");
  /** consulta que gerou a lista atual */
  const buscada = shallowRef<Consulta | null>(null);
  let pagina = 0;
  let vez = 0;
  let ultima = "";

  /** `forcar` refaz mesmo sem mudança (Enter, resumo novo); sem ele, a mesma busca é ignorada. */
  async function buscar(mais = false, forcar = false): Promise<void> {
    const q = consulta.value;
    const f = { ...filtros };
    const chave = JSON.stringify([q, f]);
    if (!mais && !forcar && chave === ultima) return;
    ultima = chave;
    const minha = ++vez;
    if (!q) {
      produtos.value = [];
      total.value = 0;
      contagens.value = SEM_FACETAS;
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
      let linhas = await buscarProdutos(usada, f, pagina);
      // 14 dígitos sem CNPJ correspondente: há 400 processos antigos desse tamanho
      if (!mais && !linhas.length && q.modo === "cnpj") {
        const comoNumero: Consulta = { modo: "numero", valor: q.valor };
        const outras = await buscarProdutos(comoNumero, f, 0);
        if (outras.length) [usada, linhas] = [comoNumero, outras];
      }
      const cont = mais ? contagens.value : await facetas(usada, f);
      if (minha !== vez) return;
      produtos.value = mais ? [...produtos.value, ...linhas] : linhas;
      if (linhas.length) total.value = linhas[0]!.total;
      else if (!mais) total.value = 0;
      contagens.value = cont;
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

  return { entrada, marca, filtros, consulta, produtos, total, contagens, carregando, erro, buscada, temMais, buscar };
}
