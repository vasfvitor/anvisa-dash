// Motor e metadados: sobe o DuckDB assim que a ilha monta, para estar pronto quando a pessoa digitar.
import { ref, shallowRef } from "vue";
import { TABELA } from "../../lib/config";
import { iniciar } from "../../lib/db";
import type { Fonte } from "../../lib/manifest";
import { categorias, type Categoria } from "../../lib/queries";

export type Status = "iniciando" | "pronto" | "erro";

export function useDuckDB() {
  const status = ref<Status>("iniciando");
  const erro = ref("");
  const fonte = shallowRef<Fonte | null>(null);
  const cats = shallowRef<Categoria[]>([]);

  async function subir(): Promise<void> {
    status.value = "iniciando";
    erro.value = "";
    try {
      const m = await iniciar();
      fonte.value = m.tables[TABELA]?.source ?? null;
      status.value = "pronto";
      // a lista de categorias não segura a busca: chega quando chegar
      categorias().then((c) => (cats.value = c), () => {});
    } catch (e) {
      status.value = "erro";
      erro.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { status, erro, fonte, categorias: cats, subir };
}
