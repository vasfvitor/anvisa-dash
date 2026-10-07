<script setup lang="ts">
import { useCopia } from "./composables/useCopia";
import Icone from "./Icone.vue";

const props = defineProps<{ valor: string; rotulo?: string }>();
const { copiado, copiar } = useCopia();
</script>

<template>
  <button
    class="copiar"
    type="button"
    :aria-label="`Copiar ${props.rotulo ?? valor}`"
    :title="`Copiar ${props.rotulo ?? valor}`"
    @click="copiar(valor)"
  >
    <Icone :nome="copiado ? 'certo' : 'copiar'" />
    <span class="sr-only" aria-live="polite">{{ copiado ? "Copiado" : "" }}</span>
  </button>
</template>
