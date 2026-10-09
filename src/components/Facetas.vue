<script setup lang="ts">
import { computed, ref } from "vue";
import { fmtInt } from "../lib/format";
import type { Facetas, Filtros, Situacao } from "../lib/fontes/comum";
import { SITUACAO, TIPOS } from "../lib/situacao";
import { legivel } from "../lib/texto";

const props = defineProps<{ contagens: Facetas; rotuloGrupo: string }>();
const filtros = defineModel<Filtros>({ required: true });
const todosGrupos = ref(false);

const n = (dim: keyof Facetas, valor: string) => props.contagens[dim].find((x) => x.valor === valor)?.n ?? 0;
const situacoes = computed<{ valor: Situacao; rotulo: string; n: number }[]>(() => {
  const ativos = n("situacao", "Ativo");
  const inativos = n("situacao", "Inativo");
  return [
    { valor: "ativo", rotulo: SITUACAO.ativo.faceta, n: ativos },
    { valor: "inativo", rotulo: SITUACAO.inativo.faceta, n: inativos },
    { valor: "todos", rotulo: "Todos", n: ativos + inativos },
  ];
});
const VISIVEIS = 6;
const grupos = computed(() => {
  const lista = props.contagens.grupo;
  if (todosGrupos.value || lista.length <= VISIVEIS + 1) return lista;
  // a escolhida continua visível mesmo fora das primeiras
  const topo = lista.slice(0, VISIVEIS);
  const escolhida = lista.find((c) => c.valor === filtros.value.grupo);
  return escolhida && !topo.includes(escolhida) ? [...topo, escolhida] : topo;
});
const escondidas = computed(() => props.contagens.grupo.length - grupos.value.length);

function alternar(campo: "grupo" | "tipo", valor: string): void {
  filtros.value[campo] = filtros.value[campo] === valor ? "" : valor;
}
</script>

<template>
  <div class="facetas">
    <div class="faceta" role="group" aria-label="Situação">
      <span class="faceta-nome">Situação</span>
      <button
        v-for="s in situacoes"
        :key="s.valor"
        type="button"
        class="chip"
        :aria-pressed="filtros.situacao === s.valor"
        :disabled="!s.n && filtros.situacao !== s.valor"
        @click="filtros.situacao = s.valor"
      >
        {{ s.rotulo }} <span class="chip-n">{{ fmtInt(s.n) }}</span>
      </button>
    </div>
    <div v-if="contagens.tipo.length" class="faceta" role="group" aria-label="Tipo de regularização">
      <span class="faceta-nome" :title="TIPOS">Tipo</span>
      <button
        v-for="t in contagens.tipo"
        :key="t.valor"
        type="button"
        class="chip"
        :aria-pressed="filtros.tipo === t.valor"
        @click="alternar('tipo', t.valor)"
      >
        {{ t.valor }} <span class="chip-n">{{ fmtInt(t.n) }}</span>
      </button>
    </div>
    <div v-if="contagens.grupo.length > 1 || filtros.grupo" class="faceta" role="group" :aria-label="rotuloGrupo">
      <span class="faceta-nome">{{ rotuloGrupo }}</span>
      <button
        v-for="c in grupos"
        :key="c.valor"
        type="button"
        class="chip"
        :aria-pressed="filtros.grupo === c.valor"
        @click="alternar('grupo', c.valor)"
      >
        {{ legivel(c.valor) }} <span class="chip-n">{{ fmtInt(c.n) }}</span>
      </button>
      <button v-if="escondidas > 0" type="button" class="chip mais" @click="todosGrupos = true">
        +{{ escondidas }}
      </button>
      <button v-else-if="todosGrupos" type="button" class="chip mais" @click="todosGrupos = false">menos</button>
    </div>
  </div>
</template>
