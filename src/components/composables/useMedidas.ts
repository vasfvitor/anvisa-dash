// Medidas de fiscalização que citam a busca atual, no corredor ativo. Anda junto com a busca (o BuscaApp
// chama as duas no mesmo lugar), mas não depende dos filtros: filtrar não refaz as medidas. Respostas
// fora de ordem e a troca de corredor descartam o que ainda está a caminho.
import { computed, ref, shallowRef } from "vue";
import type { Consulta } from "../../lib/detect";
import { buscarMedidas, MEDIDAS_POR_PAGINA, type Medida } from "../../lib/medidas";
import { vezes } from "../../lib/vez";

export function useMedidas() {
  const itens = shallowRef<Medida[]>([]);
  const total = ref(0);
  const carregando = ref(false);
  /** consulta que gerou as medidas atuais (para só mostrá-las junto da lista da mesma busca) */
  const buscada = shallowRef<Consulta | null>(null);
  let tipo = 0;
  let pagina = 0;
  let ultima = "";
  const vez = vezes();

  async function pedir(t: number, q: Consulta, p: number): Promise<void> {
    const minhaVez = vez.nova();
    carregando.value = true;
    try {
      const linhas = await buscarMedidas(t, q, p);
      if (!minhaVez()) return;
      tipo = t;
      pagina = p;
      itens.value = p ? [...itens.value, ...linhas] : linhas;
      if (linhas.length) total.value = linhas[0]!.total;
      else if (!p) total.value = 0;
      buscada.value = q;
    } catch {
      // sem medidas a busca continua valendo; a mesma busca pode tentar de novo
      if (minhaVez()) ultima = "";
    } finally {
      if (minhaVez()) carregando.value = false;
    }
  }

  /** Esquece as medidas e o que estiver a caminho (troca de corredor, busca sem medidas). */
  function limpar(): void {
    vez.invalidar();
    ultima = "";
    itens.value = [];
    total.value = 0;
    buscada.value = null;
    carregando.value = false;
  }

  /** Medidas de `q` no corredor de `tipoProduto`; a mesma consulta de antes é ignorada. */
  async function buscar(tipoProduto: number | undefined, q: Consulta | null): Promise<void> {
    const chave = JSON.stringify([tipoProduto, q]);
    if (chave === ultima) return;
    if (!tipoProduto || !q || q.modo === "todos") {
      limpar();
      ultima = chave;
      return;
    }
    ultima = chave;
    await pedir(tipoProduto, q, 0);
  }

  async function mais(): Promise<void> {
    if (buscada.value && tipo) await pedir(tipo, buscada.value, pagina + 1);
  }

  const temMais = computed(() => itens.value.length < total.value && itens.value.length >= MEDIDAS_POR_PAGINA);

  return { itens, total, carregando, buscada, temMais, buscar, mais, limpar };
}
