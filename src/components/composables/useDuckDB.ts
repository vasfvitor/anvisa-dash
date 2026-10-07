// Motor e dados: sobe o DuckDB e baixa a tabela principal assim que a ilha monta, para estar pronto
// quando a pessoa terminar de digitar. O resumo de alergênicos e as sugestões chegam em seguida.
import { onBeforeUnmount, ref, shallowRef } from "vue";
import { TABELA } from "../../lib/config";
import { aoProgresso, iniciar } from "../../lib/db";
import type { Fonte } from "../../lib/manifest";
import { categoriasAtivas, numeros, preparar, type Numeros, type ValorFaceta } from "../../lib/queries";

export type Status = "iniciando" | "baixando" | "pronto" | "erro";

export function useDuckDB() {
  const status = ref<Status>("iniciando");
  const erro = ref("");
  const fonte = shallowRef<Fonte | null>(null);
  const progresso = ref(0); // 0 a 1, download da tabela principal
  const tamanho = ref(0); // bytes da tabela principal, do manifest
  const totais = shallowRef<Numeros | null>(null);
  const categorias = shallowRef<ValorFaceta[]>([]);
  /** muda quando o resumo de alergênicos fica pronto: quem lista produtos refaz a consulta */
  const versaoResumo = ref(0);

  const parar = aoProgresso((p) => {
    if (p.tabela !== TABELA) return;
    status.value = status.value === "pronto" ? "pronto" : "baixando";
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
      await preparar(() => versaoResumo.value++);
      status.value = "pronto";
      // números da página inicial não seguram a busca
      numeros().then((n) => (totais.value = n), () => {});
      categoriasAtivas().then((c) => (categorias.value = c), () => {});
    } catch (e) {
      status.value = "erro";
      erro.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { status, erro, fonte, progresso, tamanho, totais, categorias, versaoResumo, subir };
}
