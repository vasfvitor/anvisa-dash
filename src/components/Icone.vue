<script setup lang="ts">
// Ícones decorativos do sprite public/icones.svg (um arquivo, em cache, compartilhado com as páginas Astro).
import { url } from "../lib/format";

defineProps<{ nome: string }>();
const sprite = url("/icones.svg");
</script>

<template>
  <svg class="icone" aria-hidden="true"><use :href="`${sprite}#${nome}`" /></svg>
</template>
