<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import type { Corredor } from "../corredores";
import type { Fonte, Numeros, ValorFaceta } from "../lib/fonte";
import { fmtCnpj, fmtInt } from "../lib/format";
import { recentes, type Medida } from "../lib/medidas";
import { legivel } from "../lib/texto";
import Icone from "./Icone.vue";
import MedidaCartao from "./MedidaCartao.vue";

const props = defineProps<{ corredor: Corredor; fonte: Fonte; pronto: boolean }>();
const emit = defineEmits<{ exemplo: [valor: string]; grupo: [valor: string] }>();

// só esta tela usa os números gerais e os grupos: consulta ao aparecer, não na partida do app
const totais = shallowRef<Numeros | null>(null);
const grupos = shallowRef<ValorFaceta[]>([]);
onMounted(() => {
  props.fonte.numeros().then(
    (n) => (totais.value = n),
    () => {
      // sem os números a abertura só não mostra o painel; o erro da tabela aparece na busca
    },
  );
  if (!props.corredor.atalhos)
    props.fonte.grupos().then(
      (c) => (grupos.value = c),
      () => {
        // idem: sem os grupos, a abertura fica sem os atalhos
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
    <p class="exemplos">
      Experimente:
      <template v-for="(x, i) in corredor.exemplos" :key="x.valor">
        <a href="#" @click.prevent="emit('exemplo', x.valor)">{{ x.texto }}</a
        ><span v-if="x.dica" class="muted"> ({{ x.dica }})</span>{{ i < corredor.exemplos.length - 1 ? ", " : "" }}
      </template>
    </p>

    <dl v-if="totais" class="numeros">
      <div>
        <Icone nome="certo" />
        <dt>liberados</dt>
        <dd>{{ fmtInt(totais.ativos) }}</dd>
      </div>
      <div>
        <Icone nome="caixas" />
        <dt>já passaram pela ANVISA</dt>
        <dd>{{ fmtInt(totais.produtos) }}</dd>
      </div>
      <div>
        <Icone nome="fabrica" />
        <dt>empresas</dt>
        <dd>{{ fmtInt(totais.empresas) }}</dd>
      </div>
    </dl>

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
      <p class="note">Suspensões, proibições, recolhimentos e apreensões publicados nos últimos dados abertos.</p>
      <div class="medidas-lista">
        <MedidaCartao v-for="m in medidas" :key="m.id" :m="m" @empresa="(c: string) => emit('exemplo', fmtCnpj(c))" />
      </div>
    </template>

    <h2>O que dá para saber aqui</h2>
    <ul class="o-que">
      <li v-for="o in corredor.oQue" :key="o.titulo">
        <Icone :nome="o.icone" />
        <div>
          <strong>{{ o.titulo }}</strong
          ><span>{{ o.texto }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>
