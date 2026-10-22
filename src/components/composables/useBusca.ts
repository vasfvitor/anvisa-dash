// Resultados da busca na fonte do corredor ativo: lista paginada, facetas e o complemento que algumas
// fontes têm (o resumo de alergênicos nos alimentos). O que buscar vem de fora (useEstado); respostas
// fora de ordem (digitação rápida, troca de corredor) são descartadas.
import { computed, ref, shallowRef, type Ref } from "vue";
import type { Consulta } from "../../lib/detect";
import { POR_PAGINA, type Facetas, type Filtros, type Fonte, type Item } from "../../lib/fonte";
import { vezes } from "../../lib/vez";

const SEM_FACETAS: Facetas = { situacao: [], tipo: [], grupo: [] };

export function useBusca(fonte: Ref<Fonte>) {
  const produtos = shallowRef<Item[]>([]);
  const total = ref(0);
  const contagens = shallowRef<Facetas>(SEM_FACETAS);
  /** complemento por id (fonte.complementar); chega depois da lista e só acumula */
  const extras = shallowRef(new Map<string, unknown>());
  const carregando = ref(false);
  const erro = ref("");
  /** consulta que gerou a lista atual */
  const buscada = shallowRef<Consulta | null>(null);
  /** "você quis dizer": a lista é da busca `para`, não do que a pessoa digitou (`de`) */
  const corrigida = shallowRef<{ de: string; para: string } | null>(null);
  /** filtros que geraram a lista atual: "mostrar mais" continua com eles */
  let filtrosDaLista: Filtros | null = null;
  let pagina = 0;
  /** consulta e filtros do último pedido, para não repetir a mesma busca */
  let ultima = "";
  const vez = vezes();

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

  async function pedir(
    q: Consulta,
    filtros: Filtros,
    p: number,
    correcao: { de: string; para: string } | null = null,
  ): Promise<void> {
    const minhaVez = vez.nova();
    const f = fonte.value;
    carregando.value = true;
    erro.value = "";
    try {
      const [linhas, cont] = await Promise.all([f.buscar(q, filtros, p), p ? contagens.value : f.facetas(q, filtros)]);
      if (!minhaVez()) return;
      // nada achado: a busca corrigida entra no lugar, se a fonte souber corrigir e a pessoa não insistiu
      if (!p && !linhas.length && !correcao && q.modo === "texto" && !q.semCorrecao && f.corrigir) {
        const para = await f.corrigir(q.valor).catch(() => null);
        if (!minhaVez()) return;
        if (para) return await pedir({ modo: "texto", valor: para }, filtros, 0, { de: q.valor, para });
      }
      pagina = p;
      if (!p) corrigida.value = correcao;
      produtos.value = p ? [...produtos.value, ...linhas] : linhas;
      if (linhas.length) total.value = linhas[0]!.total;
      else if (!p) total.value = 0;
      contagens.value = cont;
      buscada.value = q;
      filtrosDaLista = filtros;
      completar(f, linhas);
    } catch (e) {
      if (!minhaVez()) return;
      ultima = ""; // deixa tentar a mesma busca de novo
      erro.value = e instanceof Error ? e.message : String(e);
    } finally {
      if (minhaVez()) carregando.value = false;
    }
  }

  /** Esquece a lista (ids de outra fonte, ou nada para buscar) e o que estiver a caminho. */
  function limpar(): void {
    vez.invalidar();
    ultima = "";
    produtos.value = [];
    total.value = 0;
    contagens.value = SEM_FACETAS;
    buscada.value = null;
    corrigida.value = null;
    filtrosDaLista = null;
    carregando.value = false;
    erro.value = "";
  }

  /** A primeira página de `q`; a mesma busca de antes é ignorada, a não ser `forcar` (Enter, troca de corredor). */
  async function buscar(q: Consulta | null, filtros: Filtros, forcar = false): Promise<void> {
    const chave = JSON.stringify([q, filtros]);
    if (!forcar && chave === ultima) return;
    if (!q) return limpar();
    ultima = chave;
    await pedir(q, filtros, 0);
  }

  /** A página seguinte da lista atual. */
  async function mais(): Promise<void> {
    if (buscada.value && filtrosDaLista) await pedir(buscada.value, filtrosDaLista, pagina + 1);
  }

  const temMais = computed(() => produtos.value.length < total.value && produtos.value.length >= POR_PAGINA);

  return { produtos, total, contagens, extras, carregando, erro, buscada, corrigida, temMais, buscar, mais, limpar };
}
