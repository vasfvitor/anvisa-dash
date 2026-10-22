<script setup lang="ts">
// A linha do cartão quando a empresa do produto tem medidas de fiscalização da ANVISA. O hover lembra que
// a medida é contra a empresa, não necessariamente sobre este produto (lib/medidas.ts).
import { plural } from "../lib/format";
import { SOBRE_A_EMPRESA } from "../lib/medidas";
import Icone from "./Icone.vue";

defineProps<{ n: number }>();
</script>

<template>
  <p class="aviso-curto" :title="SOBRE_A_EMPRESA">
    <Icone nome="alerta" /> Empresa com {{ plural(n, "medida") }} da ANVISA
  </p>
</template>
