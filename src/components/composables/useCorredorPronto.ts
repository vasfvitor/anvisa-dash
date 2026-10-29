// Se o corredor ativo está pronto para buscar. Até a pessoa aceitar baixar (lib/licenca), o corredor fica em
// "licenca" e nada é baixado. Depois, um DuckDB só para o site inteiro sobe; cada corredor baixa a tabela dele
// (com progresso) e monta as tabelas derivadas. O que já foi baixado fica em memória, então voltar a um
// corredor é instantâneo.
import { onBeforeUnmount, ref, shallowRef, type Ref } from "vue";
import type { Corredor } from "../../corredores";
import { aoProgresso, iniciar } from "../../lib/db";
import { permitirDownload, podeBaixar } from "../../lib/licenca";
import { FONTES } from "../../corredores/fontes";
import { prepararMedidas } from "../../lib/medidas";
import type { Origem } from "../../lib/manifest";
import { vezes } from "../../lib/vez";

export type Status = "licenca" | "iniciando" | "baixando" | "pronto" | "erro";

export function useCorredorPronto(corredor: Ref<Corredor>) {
  const status = ref<Status>("iniciando");
  const erro = ref("");
  const origem = shallowRef<Origem | null>(null);
  const progresso = ref(0); // 0 a 1, download da tabela do corredor
  const tamanho = ref(0); // bytes da tabela do corredor, do manifest
  const motorNoAr = ref(false); // o DuckDB já subiu nesta aba (a espera inicial é o download dele)
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
    status.value = podeBaixar() ? "iniciando" : "licenca";
    progresso.value = 0;
    erro.value = "";
    if (status.value === "licenca") return;
    try {
      const t = (await iniciar()).tables[c.tabela];
      motorNoAr.value = true;
      if (!minhaVez()) return;
      origem.value = t?.source ?? null;
      tamanho.value = t?.bytes ?? 0;
      if (!t) throw new Error("ainda não publicados neste build");
      await FONTES[c.id].preparar();
      if (!minhaVez()) return;
      status.value = "pronto";
      // as medidas de fiscalização (uma tabela para todos os corredores) baixam depois, sem segurar a busca
      if (c.tipoProduto)
        prepararMedidas().catch(() => {
          // sem medidas o corredor funciona; cada consulta delas tenta de novo
        });
    } catch (e) {
      if (!minhaVez()) return;
      status.value = "erro";
      erro.value = e instanceof Error ? e.message : String(e);
    }
  }

  /** O sim da pessoa: guarda e sobe o corredor atual. */
  function aceitar(): Promise<void> {
    permitirDownload();
    return subir();
  }

  return { status, erro, origem, progresso, tamanho, motorNoAr, trocou, subir, aceitar };
}
