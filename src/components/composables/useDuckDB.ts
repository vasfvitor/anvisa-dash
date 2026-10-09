// Motor e dados: um DuckDB só para o site inteiro. Sobe assim que a ilha monta e prepara a fonte do
// corredor ativo (baixa a tabela dele, com progresso). Trocar de corredor prepara a fonte nova; o que
// já foi baixado fica em memória e a volta é instantânea.
import { onBeforeUnmount, ref, shallowRef, type Ref } from "vue";
import type { Corredor } from "../../lib/corredores";
import { aoProgresso, iniciar } from "../../lib/db";
import { FONTES } from "../../lib/fontes";
import type { Origem } from "../../lib/manifest";

export type Status = "iniciando" | "baixando" | "pronto" | "erro";

export function useDuckDB(corredor: Ref<Corredor>) {
  const status = ref<Status>("iniciando");
  const erro = ref("");
  const origem = shallowRef<Origem | null>(null);
  const progresso = ref(0); // 0 a 1, download da tabela do corredor
  const tamanho = ref(0); // bytes da tabela do corredor, do manifest
  let vez = 0;

  const parar = aoProgresso((p) => {
    if (p.tabela !== corredor.value.tabela || status.value === "pronto") return;
    status.value = "baixando";
    progresso.value = p.total ? p.recebidos / p.total : 0;
  });
  onBeforeUnmount(parar);

  /** Prepara o corredor atual; chamar de novo depois de trocar de corredor. */
  async function subir(): Promise<void> {
    const minha = ++vez;
    const c = corredor.value;
    status.value = "iniciando";
    progresso.value = 0;
    erro.value = "";
    try {
      const t = (await iniciar()).tables[c.tabela];
      // trocou de corredor enquanto o manifest chegava: a vez nova é que mostra o dela
      if (minha !== vez) return;
      origem.value = t?.source ?? null;
      tamanho.value = t?.bytes ?? 0;
      if (!t) throw new Error(`os dados de ${c.nome.toLowerCase()} ainda não foram publicados`);
      await FONTES[c.id].preparar();
      if (minha === vez) status.value = "pronto";
    } catch (e) {
      if (minha !== vez) return;
      status.value = "erro";
      erro.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { status, erro, origem, progresso, tamanho, subir };
}
