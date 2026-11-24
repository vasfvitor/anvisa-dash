// Medidas de fiscalização que citam a busca atual, no corredor ativo. Anda junto com a busca (o BuscaApp
// chama as duas no mesmo lugar), mas não depende dos filtros: filtrar não refaz as medidas. Respostas
// fora de ordem e a troca de corredor descartam o que ainda está a caminho.
import { computed, ref, shallowRef } from "vue";
import type { Consulta } from "../../lib/detect";
import { buscarMedidas, MEDIDAS_POR_PAGINA, medidasPorEmpresa, type Medida } from "../../lib/medidas";
import { vezes } from "../../lib/vez";

export function useMedidas() {
  const itens = shallowRef<Medida[]>([]);
  const total = ref(0);
  const carregando = ref(false);
  /** the last request for the search's measures failed (a failed "mais" keeps the pages already shown) */
  const erroBusca = ref(false);
  /** the last count for the cards' companies failed: a card without a mark may still have measures */
  const erroMarcas = ref(false);
  /** some measures failed to load: said where they would be, never left looking like none */
  const erro = computed(() => erroBusca.value || erroMarcas.value);
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
      // sem medidas a busca continua valendo, com o aviso de erro; a mesma busca pode tentar de novo
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

  /** Conta as medidas das empresas dos cartões que ainda não foram perguntadas (cada página da lista). */
  async function marcar(tipoProduto: number | undefined, cnpjs: (string | null)[]): Promise<void> {
    if (!tipoProduto) return;
    const faltam = [...new Set(cnpjs)].filter((c): c is string => !!c && !perguntados.has(c));
    if (!faltam.length) return;
    for (const c of faltam) perguntados.add(c);
    const minha = geracao;
    try {
      const n = await medidasPorEmpresa(tipoProduto, faltam);
      if (minha !== geracao) return;
      if (n.size) porEmpresa.value = new Map([...porEmpresa.value, ...n]);
      erroMarcas.value = false;
    } catch {
      // sem a marca o cartão continua igual, com o aviso de erro; as próximas páginas perguntam de novo
      if (minha !== geracao) return;
      for (const c of faltam) perguntados.delete(c);
      erroMarcas.value = true;
    }
  }

  /** Esquece as marcas dos cartões e as perguntas a caminho (troca de corredor: são de outra área). */
  function limparMarcas(): void {
    geracao++;
    perguntados.clear();
    porEmpresa.value = new Map();
    erroMarcas.value = false;
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
