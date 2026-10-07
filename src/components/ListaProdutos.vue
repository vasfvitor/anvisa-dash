<script setup lang="ts">
import type { Produto as P } from "../lib/queries";
import Produto from "./Produto.vue";

defineProps<{ produtos: P[]; temMais: boolean; carregando: boolean }>();
const emit = defineEmits<{ mais: []; buscar: [valor: string] }>();
</script>

<template>
  <div>
    <Produto v-for="p in produtos" :key="p.co_seq_produto" :p="p" @buscar="(v) => emit('buscar', v)" />
    <p v-if="temMais" style="text-align: center">
      <button class="btn" type="button" :disabled="carregando" @click="emit('mais')">
        {{ carregando ? "Carregando…" : "Carregar mais" }}
      </button>
    </p>
  </div>
</template>
