// Busca com paginação, facetas e o complemento que algumas fontes têm (o resumo de alergênicos nos
// alimentos), sobre a fonte do corredor ativo. Respostas fora de ordem (digitação rápida, troca de
// corredor) são descartadas pelo número da vez.
import { computed, reactive, ref, shallowRef, type Ref } from "vue";
import { detectar, type Consulta } from "../../lib/detect";
import { FILTROS_PADRAO, POR_PAGINA, type Facetas, type Filtros, type Fonte, type Item } from "../../lib/fonte";

const SEM_FACETAS: Facetas = { situacao: [], tipo: [], grupo: [] };

export function useBusca(fonte: Ref<Fonte>) {
  const entrada = ref("");
  /** marca escolhida numa sugestão; digitar de novo a desfaz */
  const marca = ref("");
  const filtros = reactive<Filtros>({ ...FILTROS_PADRAO });
  const consulta = computed<Consulta | null>(() => {
    if (marca.value) return { modo: "marca", valor: marca.value };
    // sem termo mas com um grupo escolhido: navegar por ele
    return detectar(entrada.value) ?? (filtros.grupo ? { modo: "todos", valor: "" } : null);
  });
  const produtos = shallowRef<Item[]>([]);
  const total = ref(0);
  const contagens = shallowRef<Facetas>(SEM_FACETAS);
  /** complemento por id (fonte.complementar); chega depois da lista e só acumula */
  const extras = shallowRef(new Map<string, unknown>());
  const carregando = ref(false);
  const erro = ref("");
  /** consulta que gerou a lista atual */
  const buscada = shallowRef<Consulta | null>(null);
  let pagina = 0;
  let vez = 0;
  let ultima = "";

  /** Pede o complemento dos que ainda não têm; a tabela dele pode ainda estar baixando. */
  function completar(f: Fonte, lista: Item[]): void {
    if (!f.complementar) return;
    const faltam = lista.map((p) => f.idDe(p)).filter((id) => !extras.value.has(id));
    if (!faltam.length) return;
    f.complementar(faltam).then(
      (novos) => (extras.value = new Map([...extras.value, ...novos])),
      () => {
        // o complemento é opcional: sem ele o cartão só não mostra o resumo
      },
    );
  }

  /** `forcar` refaz mesmo sem mudança (Enter, troca de corredor); sem ele, a mesma busca é ignorada. */
  async function buscar(mais = false, forcar = false): Promise<void> {
    const f = fonte.value;
    const q = mais ? buscada.value : consulta.value;
    const filtro = { ...filtros };
    const chave = JSON.stringify([q, filtro]);
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
      const [linhas, cont] = await Promise.all([
        f.buscar(q, filtro, pagina),
        mais ? contagens.value : f.facetas(q, filtro),
      ]);
      if (minha !== vez) return;
      produtos.value = mais ? [...produtos.value, ...linhas] : linhas;
      if (linhas.length) total.value = linhas[0]!.total;
      else if (!mais) total.value = 0;
      contagens.value = cont;
      buscada.value = q;
      completar(f, linhas);
    } catch (e) {
      if (minha !== vez) return;
      ultima = ""; // deixa tentar a mesma busca de novo
      erro.value = e instanceof Error ? e.message : String(e);
    } finally {
      if (minha === vez) carregando.value = false;
    }
  }

  /** Troca de corredor: esquece a lista anterior (ids de outra fonte) sem perder o termo. */
  function limpar(): void {
    vez++;
    ultima = "";
    produtos.value = [];
    total.value = 0;
    contagens.value = SEM_FACETAS;
    buscada.value = null;
    carregando.value = false;
    erro.value = "";
  }

  const temMais = computed(() => produtos.value.length < total.value && produtos.value.length >= POR_PAGINA);

  return {
    entrada,
    marca,
    filtros,
    consulta,
    produtos,
    total,
    contagens,
    extras,
    carregando,
    erro,
    buscada,
    temMais,
    buscar,
    limpar,
  };
}
