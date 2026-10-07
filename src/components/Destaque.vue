<script setup lang="ts">
import { computed } from "vue";
import { destacar } from "../lib/texto";

const props = defineProps<{ texto: string; termo?: string | null }>();
const trechos = computed(() => destacar(props.texto, props.termo));
</script>

<template><template v-for="(t, i) in trechos" :key="i"><mark v-if="t.achado">{{ t.texto }}</mark><template v-else>{{ t.texto }}</template></template></template>
