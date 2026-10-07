<script setup lang="ts">
import { computed } from "vue";
import { fmtInt } from "../lib/format";
import type { Numeros, ValorFaceta } from "../lib/queries";
import { legivel } from "../lib/texto";

const props = defineProps<{ totais: Numeros | null; categorias: ValorFaceta[] }>();
const emit = defineEmits<{ exemplo: [valor: string]; categoria: [valor: string] }>();

const EXEMPLOS = [
  { valor: "whey", texto: "whey" },
  { valor: "colágeno", texto: "colágeno" },
  { valor: "creatina", texto: "creatina" },
  { valor: "01615814000101", texto: "01.615.814/0001-01", dica: "CNPJ" },
  { valor: "25351.453332/2024-10", texto: "25351.453332/2024-10", dica: "processo" },
];
const principais = computed(() => props.categorias.slice(0, 12));
</script>

<template>
  <section class="inicio">
    <p class="exemplos">
      Experimente:
      <template v-for="(x, i) in EXEMPLOS" :key="x.valor">
        <a href="#" @click.prevent="emit('exemplo', x.valor)">{{ x.texto }}</a><span v-if="x.dica" class="muted"> ({{ x.dica }})</span>{{ i < EXEMPLOS.length - 1 ? ", " : "" }}
      </template>
    </p>

    <dl v-if="totais" class="numeros">
      <div><dt>produtos ativos</dt><dd>{{ fmtInt(totais.ativos) }}</dd></div>
      <div><dt>produtos no histórico</dt><dd>{{ fmtInt(totais.produtos) }}</dd></div>
      <div><dt>empresas</dt><dd>{{ fmtInt(totais.empresas) }}</dd></div>
    </dl>

    <template v-if="principais.length">
      <h2>Explorar por categoria</h2>
      <div class="categorias">
        <button v-for="c in principais" :key="c.valor" type="button" class="chip" @click="emit('categoria', c.valor)">
          {{ legivel(c.valor) }} <span class="chip-n">{{ fmtInt(c.n) }}</span>
        </button>
      </div>
    </template>

    <h2>O que dá para saber aqui</h2>
    <ul class="o-que">
      <li><strong>Se o produto está regular:</strong> ativo ou inativo na ANVISA, registrado ou notificado, e desde quando.</li>
      <li><strong>Se serve para você:</strong> glúten, lactose, alergênicos que contém ou pode conter, ingredientes e público indicado.</li>
      <li><strong>Quem fabrica:</strong> a empresa responsável, quem envasa e os fabricantes no exterior.</li>
      <li><strong>Os números oficiais:</strong> processo, registro ou notificação, para conferir na consulta da ANVISA.</li>
    </ul>
  </section>
</template>
