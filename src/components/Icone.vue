<script setup lang="ts">
// Ícones do sprite public/icones.svg (um arquivo, em cache, compartilhado com as páginas Astro).
defineProps<{ nome: string; rotulo?: string }>();
const sprite = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/icones.svg`;
</script>

<template>
  <svg class="icone" :aria-hidden="rotulo ? undefined : 'true'" :role="rotulo ? 'img' : undefined" :aria-label="rotulo">
    <use :href="`${sprite}#${nome}`" />
  </svg>
</template>
