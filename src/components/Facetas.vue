<script setup lang="ts">
import { computed, ref } from "vue";
import { fmtInt } from "../lib/format";
import type { Facetas, Filtros, Situacao } from "../lib/queries";
import { legivel } from "../lib/texto";

const filtros = defineModel<Filtros>({ required: true });
const props = defineProps<{ contagens: Facetas }>();
const todasCategorias = ref(false);

const n = (dim: keyof Facetas, valor: string) => props.contagens[dim].find((x) => x.valor === valor)?.n ?? 0;
const situacoes = computed<{ valor: Situacao; rotulo: string; n: number }[]>(() => {
  const ativos = n("situacao", "Ativo");
  const inativos = n("situacao", "Inativo");
  return [
    { valor: "ativo", rotulo: "Ativos", n: ativos },
    { valor: "inativo", rotulo: "Inativos", n: inativos },
    { valor: "todos", rotulo: "Todos", n: ativos + inativos },
  ];
});
const VISIVEIS = 6;
const categorias = computed(() => {
  const lista = props.contagens.categoria;
  if (todasCategorias.value || lista.length <= VISIVEIS + 1) return lista;
  // a escolhida continua visível mesmo fora das primeiras
  const topo = lista.slice(0, VISIVEIS);
  const escolhida = lista.find((c) => c.valor === filtros.value.categoria);
  return escolhida && !topo.includes(escolhida) ? [...topo, escolhida] : topo;
});
const escondidas = computed(() => props.contagens.categoria.length - categorias.value.length);

function alternar<K extends "categoria" | "tipo">(campo: K, valor: string): void {
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
      <span class="faceta-nome">Tipo</span>
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
    <div v-if="contagens.categoria.length > 1 || filtros.categoria" class="faceta" role="group" aria-label="Categoria">
      <span class="faceta-nome">Categoria</span>
      <button
        v-for="c in categorias"
        :key="c.valor"
        type="button"
        class="chip"
        :aria-pressed="filtros.categoria === c.valor"
        @click="alternar('categoria', c.valor)"
      >
        {{ legivel(c.valor) }} <span class="chip-n">{{ fmtInt(c.n) }}</span>
      </button>
      <button v-if="escondidas > 0" type="button" class="chip mais" @click="todasCategorias = true">
        +{{ escondidas }} categorias
      </button>
      <button v-else-if="todasCategorias" type="button" class="chip mais" @click="todasCategorias = false">menos</button>
    </div>
  </div>
</template>
