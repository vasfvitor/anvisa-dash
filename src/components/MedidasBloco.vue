<script setup lang="ts">
// As medidas de fiscalização que citam a busca, no fim dos resultados (ou antes da dica, quando nenhum
// produto liberado apareceu).
import { fmtInt } from "../lib/format";
import type { Medida } from "../lib/medidas";
import Icone from "./Icone.vue";
import MedidaCartao from "./MedidaCartao.vue";

defineProps<{ itens: Medida[]; total: number; carregando: boolean; temMais: boolean }>();
const emit = defineEmits<{ mais: []; empresa: [cnpj: string] }>();
</script>

<template>
  <section class="medidas" aria-labelledby="medidas-titulo">
    <h2 id="medidas-titulo" class="medidas-titulo">
      <Icone nome="alerta" />Medidas da ANVISA <span class="chip-n">{{ fmtInt(total) }}</span>
    </h2>
    <div class="medidas-lista">
      <MedidaCartao v-for="m in itens" :key="m.id" :m="m" @empresa="(c: string) => emit('empresa', c)" />
    </div>
    <p v-if="temMais" class="mais">
      <button class="btn" type="button" :disabled="carregando" @click="emit('mais')">
        {{ carregando ? "Carregando…" : `Mostrar mais medidas (${fmtInt(itens.length)} de ${fmtInt(total)})` }}
      </button>
    </p>
  </section>
</template>
