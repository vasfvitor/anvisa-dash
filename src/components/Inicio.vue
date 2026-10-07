<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import type { Corredor } from "../lib/corredores";
import type { Fonte, Item, Numeros, ValorFaceta } from "../lib/fontes/comum";
import { fmtInt } from "../lib/format";
import { legivel } from "../lib/texto";
import Icone from "./Icone.vue";

const props = defineProps<{ corredor: Corredor; fonte: Fonte<Item> }>();
const emit = defineEmits<{ exemplo: [valor: string]; grupo: [valor: string] }>();

// só esta tela usa os números gerais e os grupos: consulta ao aparecer, não na partida do app
const totais = shallowRef<Numeros | null>(null);
const grupos = shallowRef<ValorFaceta[]>([]);
onMounted(() => {
  props.fonte.numeros().then((n) => (totais.value = n), () => {});
  if (!props.corredor.atalhos) props.fonte.grupos().then((c) => (grupos.value = c), () => {});
});
const principais = computed(() => grupos.value.slice(0, 12));
</script>

<template>
  <section class="inicio">
    <p class="exemplos">
      Experimente:
      <template v-for="(x, i) in corredor.exemplos" :key="x.valor">
        <a href="#" @click.prevent="emit('exemplo', x.valor)">{{ x.texto }}</a><span v-if="x.dica" class="muted"> ({{ x.dica }})</span>{{ i < corredor.exemplos.length - 1 ? ", " : "" }}
      </template>
    </p>

    <dl v-if="totais" class="numeros">
      <div><Icone nome="certo" /><dt>liberados</dt><dd>{{ fmtInt(totais.ativos) }}</dd></div>
      <div><Icone nome="caixas" /><dt>já passaram pela ANVISA</dt><dd>{{ fmtInt(totais.produtos) }}</dd></div>
      <div><Icone nome="fabrica" /><dt>empresas</dt><dd>{{ fmtInt(totais.empresas) }}</dd></div>
    </dl>

    <template v-if="corredor.atalhos">
      <h2>O que você procura?</h2>
      <div class="categorias">
        <button v-for="t in corredor.atalhos" :key="t" type="button" class="chip" @click="emit('exemplo', t)">{{ t }}</button>
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

    <h2>O que dá para saber aqui</h2>
    <ul class="o-que">
      <li v-for="o in corredor.oQue" :key="o.titulo">
        <Icone :nome="o.icone" /><div><strong>{{ o.titulo }}</strong><span>{{ o.texto }}</span></div>
      </li>
    </ul>
  </section>
</template>
