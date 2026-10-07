<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ valor: string; rotulo?: string }>();
const copiado = ref(false);
let espera: ReturnType<typeof setTimeout> | undefined;

async function copiar(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.valor);
    copiado.value = true;
    clearTimeout(espera);
    espera = setTimeout(() => (copiado.value = false), 1500);
  } catch {
    // sem permissão de área de transferência: o valor continua visível para copiar à mão
  }
}
</script>

<template>
  <button class="copiar" type="button" :aria-label="`Copiar ${rotulo ?? valor}`" :title="`Copiar ${rotulo ?? valor}`" @click="copiar">
    <span aria-hidden="true">{{ copiado ? "✓" : "⧉" }}</span>
    <span class="sr-only" aria-live="polite">{{ copiado ? "Copiado" : "" }}</span>
  </button>
</template>
