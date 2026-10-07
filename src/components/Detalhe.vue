<script setup lang="ts">
import { computed } from "vue";
import { alergenicos, fatiar, intolerancias } from "../lib/format";
import type { Apresentacao } from "../lib/queries";

const props = defineProps<{ a: Apresentacao }>();
const alerg = computed(() => alergenicos(props.a.alergenicos));
const intol = computed(() => intolerancias(props.a.intolerancias));
const lista = (s: string | null) => fatiar(s, "|");
</script>

<template>
  <div class="detalhe">
    <dl>
      <template v-if="a.validade"><dt>Validade</dt><dd>{{ a.validade }}</dd></template>
      <template v-if="a.situacao_apresentacao"><dt>Situação</dt><dd>{{ a.situacao_apresentacao }}</dd></template>
      <template v-if="a.tipo_embalagens">
        <dt>Embalagem</dt><dd><ul><li v-for="x in lista(a.tipo_embalagens)" :key="x">{{ x }}</li></ul></dd>
      </template>
      <template v-if="a.material_embalagens">
        <dt>Material</dt><dd><ul><li v-for="x in lista(a.material_embalagens)" :key="x">{{ x }}</li></ul></dd>
      </template>
      <template v-if="a.grupos_populacionais"><dt>Público</dt><dd>{{ lista(a.grupos_populacionais).join(", ") }}</dd></template>
      <template v-if="a.vias_administracao"><dt>Via</dt><dd>{{ lista(a.vias_administracao).join(", ") }}</dd></template>
      <template v-if="intol.length">
        <dt>Intolerâncias</dt>
        <dd>
          <span class="badges">
            <span v-for="i in intol" :key="i.rotulo" class="badge" :class="i.valor === 'Sim' ? 'off' : ''">
              {{ i.rotulo }}: {{ i.valor }}
            </span>
          </span>
        </dd>
      </template>
      <template v-for="g in alerg" :key="g.rotulo">
        <dt>{{ g.rotulo || "Alergênicos" }}</dt>
        <dd>{{ g.itens.join(", ") }}</dd>
      </template>
      <template v-if="a.tabela_nutricional"><dt>Ingredientes</dt><dd>{{ a.tabela_nutricional }}</dd></template>
      <template v-if="a.empresas_envasadoras">
        <dt>Envasadoras</dt><dd><ul><li v-for="x in lista(a.empresas_envasadoras)" :key="x">{{ x }}</li></ul></dd>
      </template>
      <template v-if="a.empresas_internacionais">
        <dt>Fabricantes no exterior</dt><dd><ul><li v-for="x in lista(a.empresas_internacionais)" :key="x">{{ x }}</li></ul></dd>
      </template>
    </dl>
  </div>
</template>
