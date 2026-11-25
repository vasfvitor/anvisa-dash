// Medidas de fiscalização que citam a busca atual, no corredor ativo. Anda junto com a busca (o BuscaApp
// chama as duas no mesmo lugar), mas não depende dos filtros: filtrar não refaz as medidas. Respostas
// fora de ordem e a troca de corredor descartam o que ainda está a caminho.
import { computed, ref, shallowRef } from "vue";
import type { Consulta } from "../../lib/detect";
import { ausencia, buscarMedidas, MEDIDAS_POR_PAGINA, medidasPorEmpresa, type Medida } from "../../lib/medidas";
import { vezes } from "../../lib/vez";

export function useMedidas() {
  const itens = shallowRef<Medida[]>([]);
  const total = ref(0);
  const carregando = ref(false);
  /** the last request for the search's measures failed (a failed "mais" keeps the pages already shown) */
  const erroBusca = ref(false);
  /** CNPJs whose count for the cards failed; each leaves the set when a later count for it succeeds */
  const falhas = shallowRef(new Set<string>());
  /** the distinct CNPJs of the list shown (the last marcar call): a new search replaces them */
  const lista = shallowRef(new Set<string>());
  /** the counts failed for every company of the list shown, for some of them, or for none */
  const erroMarcas = computed<"todas" | "algumas" | null>(() => {
    const n = [...lista.value].filter((c) => falhas.value.has(c)).length;
    return !n ? null : n === lista.value.size ? "todas" : "algumas";
  });
  /** the manifest has no measures table (faltaMedidas, "" when it has): the block says it in place of the measures */
  const falta = ref("");
  /** some measures failed to load: said where they would be, never left looking like none */
  const erro = computed(() => erroBusca.value || !!erroMarcas.value);
  /** consulta que gerou as medidas atuais (para só mostrá-las junto da lista da mesma busca) */
  const buscada = shallowRef<Consulta | null>(null);
  let tipo = 0;
  let pagina = 0;
  /** registros dos produtos que a busca por número achou (entram na consulta das medidas) */
  let registros: string[] = [];
  let ultima = "";
  const vez = vezes();

  /** medidas por CNPJ das empresas dos cartões listados (só as que têm) */
  const porEmpresa = shallowRef(new Map<string, number>());
  /** CNPJs já perguntados, com ou sem medidas; várias páginas perguntam ao mesmo tempo, então não há
   * "vez" aqui: só a troca de corredor (limpar) invalida, pela geração */
  const perguntados = new Set<string>();
  let geracao = 0;

  async function pedir(t: number, q: Consulta, p: number, regs: string[]): Promise<void> {
    const minhaVez = vez.nova();
    carregando.value = true;
    try {
      const linhas = await buscarMedidas(t, q, p, regs);
      if (!minhaVez()) return;
      tipo = t;
      pagina = p;
      registros = regs;
      itens.value = p ? [...itens.value, ...linhas] : linhas;
      if (linhas.length) total.value = linhas[0]!.total;
      else if (!p) total.value = 0;
      buscada.value = q;
      erroBusca.value = false;
    } catch {
      // the search still stands, with the error said; the same search may try again
      if (!minhaVez()) return;
      ultima = "";
      if (!p) {
        itens.value = [];
        total.value = 0;
      }
      buscada.value = q;
      erroBusca.value = true;
    } finally {
      if (minhaVez()) carregando.value = false;
    }
  }

  /**
   * Counts the measures of the cards' companies not asked yet (called with the whole list on each page). A
   * company whose count failed is asked again by the next call that lists it: a later page or a new search.
   */
  async function marcar(tipoProduto: number | undefined, cnpjs: (string | null)[]): Promise<void> {
    const distintos = [...new Set(cnpjs)].filter((c): c is string => !!c);
    lista.value = new Set(distintos);
    if (!tipoProduto) return;
    const minha = geracao;
    // every list shown (even an empty one) checks the manifest the island has now, which a deploy may replace
    void ausencia().then(
      (f) => {
        if (minha === geracao) falta.value = f;
      },
      () => {
        // the engine failed: the search shows that error
      },
    );
    const faltam = distintos.filter((c) => !perguntados.has(c));
    if (!faltam.length) return;
    for (const c of faltam) perguntados.add(c);
    try {
      const n = await medidasPorEmpresa(tipoProduto, faltam);
      if (minha !== geracao) return;
      if (n.size) porEmpresa.value = new Map([...porEmpresa.value, ...n]);
      if (faltam.some((c) => falhas.value.has(c)))
        falhas.value = new Set([...falhas.value].filter((c) => !faltam.includes(c)));
    } catch {
      // the card stays as it is, with the error said in the measures block; the next call asks again
      if (minha !== geracao) return;
      for (const c of faltam) perguntados.delete(c);
      falhas.value = new Set([...falhas.value, ...faltam]);
    }
  }

  /** Esquece as marcas dos cartões e as perguntas a caminho (troca de corredor: são de outra área). */
  function limparMarcas(): void {
    geracao++;
    perguntados.clear();
    porEmpresa.value = new Map();
    falhas.value = new Set();
    lista.value = new Set();
    falta.value = "";
  }

  /** Esquece as medidas e o que estiver a caminho (troca de corredor, busca sem medidas). */
  function limpar(): void {
    vez.invalidar();
    ultima = "";
    itens.value = [];
    total.value = 0;
    buscada.value = null;
    carregando.value = false;
    erroBusca.value = false;
  }

  /**
   * Medidas de `q` no corredor de `tipoProduto` (com os `registros` dos produtos achados, numa busca por
   * número); a mesma consulta de antes é ignorada.
   */
  async function buscar(tipoProduto: number | undefined, q: Consulta | null, achados: string[] = []): Promise<void> {
    const regs = [...new Set(achados)].sort();
    const chave = JSON.stringify([tipoProduto, q, regs]);
    if (chave === ultima) return;
    if (!tipoProduto || !q || q.modo === "todos") {
      limpar();
      ultima = chave;
      return;
    }
    ultima = chave;
    await pedir(tipoProduto, q, 0, regs);
  }

  async function mais(): Promise<void> {
    if (buscada.value && tipo) await pedir(tipo, buscada.value, pagina + 1, registros);
  }

  const temMais = computed(() => itens.value.length < total.value && itens.value.length >= MEDIDAS_POR_PAGINA);

  return {
    itens,
    total,
    carregando,
    erro,
    erroBusca,
    erroMarcas,
    falta,
    buscada,
    temMais,
    porEmpresa,
    buscar,
    mais,
    marcar,
    limpar,
    limparMarcas,
  };
}
