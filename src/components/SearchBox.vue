<script setup lang="ts">
import { MODO_ROTULO, type Consulta } from "../lib/detect";
import { fmtCnpj, fmtProcesso } from "../lib/format";

const entrada = defineModel<string>({ required: true });
defineProps<{ consulta: Consulta | null; desabilitado: boolean }>();
const emit = defineEmits<{ confirmar: [] }>();

function lida(c: Consulta): string {
  if (c.modo === "cnpj") return `${MODO_ROTULO.cnpj} ${fmtCnpj(c.valor)}`;
  if (c.modo === "numero") return `${MODO_ROTULO.numero} ${fmtProcesso(c.valor)}`;
  return MODO_ROTULO.texto;
}
</script>

<template>
  <form class="busca" role="search" @submit.prevent="emit('confirmar')">
    <label for="busca-q" class="sr-only">Buscar</label>
    <input
      id="busca-q"
      v-model="entrada"
      class="field"
      type="search"
      autocomplete="off"
      spellcheck="false"
      placeholder="Nº do processo, CNPJ, nome, marca ou empresa"
      :disabled="desabilitado"
      autofocus
    />
    <button class="btn primary" type="submit" :disabled="desabilitado">Buscar</button>
  </form>
  <p class="lida" aria-live="polite">
    <template v-if="consulta">Buscando por: <strong>{{ lida(consulta) }}</strong></template>
  </p>
</template>
