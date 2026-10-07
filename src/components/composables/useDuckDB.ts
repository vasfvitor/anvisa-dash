// Motor e dados: sobe o DuckDB e baixa a tabela principal assim que a ilha monta, para estar pronto
// quando a pessoa terminar de digitar. A tabela de detalhes (resumo de alergênicos) vem em seguida.
import { onBeforeUnmount, ref, shallowRef } from "vue";
import { TABELA } from "../../lib/config";
import { aoProgresso, iniciar } from "../../lib/db";
import type { Fonte } from "../../lib/manifest";
import { preparar } from "../../lib/queries";

export type Status = "iniciando" | "baixando" | "pronto" | "erro";

export function useDuckDB() {
  const status = ref<Status>("iniciando");
  const erro = ref("");
  const fonte = shallowRef<Fonte | null>(null);
  const progresso = ref(0); // 0 a 1, download da tabela principal
  const tamanho = ref(0); // bytes da tabela principal, do manifest

  const parar = aoProgresso((p) => {
    if (p.tabela !== TABELA || status.value === "pronto") return;
    status.value = "baixando";
    progresso.value = p.total ? p.recebidos / p.total : 0;
  });
  onBeforeUnmount(parar);

  async function subir(): Promise<void> {
    status.value = "iniciando";
    erro.value = "";
    try {
      const m = await iniciar();
      fonte.value = m.tables[TABELA]?.source ?? null;
      tamanho.value = m.tables[TABELA]?.bytes ?? 0;
      await preparar();
      status.value = "pronto";
    } catch (e) {
      status.value = "erro";
      erro.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { status, erro, fonte, progresso, tamanho, subir };
}
