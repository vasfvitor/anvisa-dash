// Se o corredor ativo está pronto para buscar. Um DuckDB só para o site inteiro sobe assim que a ilha monta;
// cada corredor baixa a tabela dele (com progresso) e monta as tabelas derivadas. O que já foi baixado
// fica em memória, então voltar a um corredor é instantâneo.
import { onBeforeUnmount, ref, shallowRef, type Ref } from "vue";
import type { Corredor } from "../../lib/corredores";
import { aoProgresso, iniciar } from "../../lib/db";
import { FONTES } from "../../lib/fontes";
import type { Origem } from "../../lib/manifest";
import { vezes } from "../../lib/vez";

export type Status = "iniciando" | "baixando" | "pronto" | "erro";

export function useCorredorPronto(corredor: Ref<Corredor>) {
  const status = ref<Status>("iniciando");
  const erro = ref("");
  const origem = shallowRef<Origem | null>(null);
  const progresso = ref(0); // 0 a 1, download da tabela do corredor
  const tamanho = ref(0); // bytes da tabela do corredor, do manifest
  const vez = vezes();

  const parar = aoProgresso((p) => {
    if (p.tabela !== corredor.value.tabela || status.value === "pronto") return;
    status.value = "baixando";
    progresso.value = p.total ? p.recebidos / p.total : 0;
  });
  onBeforeUnmount(parar);

  /** O corredor mudou: deixa de estar pronto na hora, para nenhuma busca ir à fonte nova antes de subir(). */
  function trocou(): void {
    vez.invalidar();
    status.value = "iniciando";
    progresso.value = 0;
    erro.value = "";
    origem.value = null;
  }

  /** Prepara o corredor atual; chamar de novo depois de trocar de corredor. */
  async function subir(): Promise<void> {
    const minhaVez = vez.nova();
    const c = corredor.value;
    status.value = "iniciando";
    progresso.value = 0;
    erro.value = "";
    try {
      const t = (await iniciar()).tables[c.tabela];
      if (!minhaVez()) return;
      origem.value = t?.source ?? null;
      tamanho.value = t?.bytes ?? 0;
      if (!t) throw new Error(`os dados de ${c.nome.toLowerCase()} ainda não foram publicados`);
      await FONTES[c.id].preparar();
      if (minhaVez()) status.value = "pronto";
    } catch (e) {
      if (!minhaVez()) return;
      status.value = "erro";
      erro.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { status, erro, origem, progresso, tamanho, trocou, subir };
}
