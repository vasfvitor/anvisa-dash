<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import type { Corredor } from "../corredores";
import type { Fonte, ValorFaceta } from "../lib/fonte";
import { fmtCnpj, fmtInt } from "../lib/format";
import { recentes, type Medida } from "../lib/medidas";
import { legivel } from "../lib/texto";
import MedidaCartao from "./MedidaCartao.vue";

const props = defineProps<{ corredor: Corredor; fonte: Fonte; pronto: boolean }>();
const emit = defineEmits<{ exemplo: [valor: string]; grupo: [valor: string] }>();

// só esta tela usa os grupos: consulta ao aparecer, não na partida do app (os totais vêm prontos do build, na
// abertura estática: Abertura.astro)
const grupos = shallowRef<ValorFaceta[]>([]);
onMounted(() => {
  if (!props.corredor.atalhos)
    props.fonte.grupos().then(
      (c) => (grupos.value = c),
      () => {
        // sem os grupos, a abertura fica sem os atalhos
      },
    );
});
const principais = computed(() => grupos.value.slice(0, 12));

// as últimas medidas de fiscalização do corredor, depois que ele fica pronto (não disputam o download)
const medidas = shallowRef<Medida[]>([]);
let pedidas = false;
watch(
  () => props.pronto,
  (pronto) => {
    const tipo = props.corredor.tipoProduto;
    if (!pronto || !tipo || pedidas) return;
    pedidas = true;
    recentes(tipo).then(
      (m) => (medidas.value = m),
      () => {
        // sem as medidas, a abertura só não mostra a seção
      },
    );
  },
  { immediate: true },
);
</script>

<template>
  <section class="inicio">
    <template v-if="corredor.atalhos">
      <h2>O que você procura?</h2>
      <div class="categorias">
        <button v-for="t in corredor.atalhos" :key="t" type="button" class="chip" @click="emit('exemplo', t)">
          {{ t }}
        </button>
      </div>
    </template>
    <template v-else-if="principais.length">
      <h2>Explorar por {{ corredor.grupo.toLowerCase() }}</h2>
      <div class="categorias">
        <button v-for="c in principais" :key="c.valor" type="button" class="chip" @click="emit('grupo', c.valor)">
          {{ legivel(c.valor) }} <span class="chip-n">{{ fmtInt(c.n) }}</span>
        </button>
      </div>
    </template>

    <template v-if="medidas.length">
      <h2>Medidas recentes da ANVISA</h2>
      <div class="medidas-lista">
        <MedidaCartao v-for="m in medidas" :key="m.id" :m="m" @empresa="(c: string) => emit('exemplo', fmtCnpj(c))" />
      </div>
    </template>
  </section>
</template>
