<script setup lang="ts">
import { computed, ref } from "vue";
import { nomeCurto, type ResumoAlergia, type Sinal } from "../lib/alergia";
import Icone from "./Icone.vue";

const props = defineProps<{ r: ResumoAlergia; compacto?: boolean }>();
const verNaoContem = ref(false);

function rotulo(nome: string, icone: string, s: Sinal): { texto: string; classe: string; icone: string } | null {
  if (s === "sim") return { texto: `Contém ${nome}`, classe: "perigo", icone };
  if (s === "nao") return { texto: `Sem ${nome}`, classe: "ok", icone };
  if (s === "varia") return { texto: `${nome[0]!.toUpperCase()}${nome.slice(1)}: varia`, classe: "atencao", icone };
  return null;
}
const intolerancias = computed(() =>
  [rotulo("glúten", "trigo", props.r.gluten), rotulo("lactose", "leite", props.r.lactose)].filter((x) => x !== null),
);
// no cartão a lista de alergênicos é cortada: o nome completo fica no title
function curta(itens: string[], max = 2): string {
  const nomes = itens.map(nomeCurto);
  return nomes.length <= max ? nomes.join(", ") : `${nomes.slice(0, max).join(", ")} +${nomes.length - max}`;
}
</script>

<template>
  <div v-if="r.temDados && compacto" class="alergia compacta" aria-label="Glúten, lactose e alergênicos">
    <span v-for="i in intolerancias" :key="i.texto" class="selo" :class="i.classe"><Icone :nome="i.icone" />{{ i.texto }}</span>
    <span v-if="r.contem.length" class="selo perigo" :title="`Contém: ${r.contem.join(', ')}`">Contém {{ curta(r.contem) }}</span>
    <span v-if="r.podeConter.length" class="selo atencao" :title="`Pode conter: ${r.podeConter.join(', ')}`">
      Pode conter {{ curta(r.podeConter, 1) }}
    </span>
    <span v-if="!r.contem.length && !r.podeConter.length && r.naoContem.length" class="selo ok">Sem alergênicos declarados</span>
  </div>

  <div v-else-if="r.temDados" class="alergia completa">
    <div class="selos">
      <span v-for="i in intolerancias" :key="i.texto" class="selo grande" :class="i.classe"><Icone :nome="i.icone" />{{ i.texto }}</span>
    </div>
    <dl class="ficha">
      <template v-if="r.contem.length">
        <dt class="perigo">Contém</dt>
        <dd>{{ r.contem.join(", ") }}</dd>
      </template>
      <template v-if="r.podeConter.length">
        <dt class="atencao">Pode conter</dt>
        <dd>{{ r.podeConter.join(", ") }}</dd>
      </template>
      <template v-if="!r.contem.length && !r.podeConter.length">
        <dt class="ok">Alergênicos</dt>
        <dd>Nenhum alergênico declarado como presente ou possível.</dd>
      </template>
      <template v-if="r.naoContem.length">
        <dt>Não contém</dt>
        <dd>
          <button class="link" type="button" :aria-expanded="verNaoContem" @click="verNaoContem = !verNaoContem">
            {{ verNaoContem ? "esconder" : `ver os ${r.naoContem.length} itens` }}
          </button>
          <span v-if="verNaoContem"> {{ r.naoContem.join(", ") }}</span>
        </dd>
      </template>
    </dl>
    <p v-if="r.varia" class="note">As apresentações deste produto declaram valores diferentes; acima está a soma de todas. Veja cada uma em “Apresentações”.</p>
  </div>
</template>
