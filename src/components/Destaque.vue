<script setup lang="ts">
import { computed } from "vue";
import { destacar } from "../lib/texto";

/** `termo`: a frase buscada, ou as palavras (busca por começo de palavra) */
const props = defineProps<{ texto: string; termo?: string | readonly string[] | null }>();
const trechos = computed(() => destacar(props.texto, props.termo));
</script>

<template>
  <template v-for="(t, i) in trechos" :key="i"
    ><mark v-if="t.achado">{{ t.texto }}</mark
    ><template v-else>{{ t.texto }}</template></template
  >
</template>
