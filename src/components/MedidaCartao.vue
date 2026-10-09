<script setup lang="ts">
// Uma medida de fiscalização (um dossiê e um produto). Fechado: o produto, quem responde, a data e as
// ações; aberto (<details>, nativo), o resto.
import { computed } from "vue";
import { fmtCnpj, fmtData, fmtProcesso } from "../lib/format";
import type { Medida } from "../lib/medidas";
import { legivel } from "../lib/texto";
import Copiar from "./Copiar.vue";
import Icone from "./Icone.vue";
import { noApp, urlEmpresa } from "./composables/useUrlState";

const props = defineProps<{ m: Medida }>();
const emit = defineEmits<{ empresa: [cnpj: string] }>();
/** o CNPJ é um link de verdade para a busca pela empresa; o clique simples busca sem recarregar */
const verEmpresa = (ev: MouseEvent, cnpj: string) => noApp(ev, () => emit("empresa", cnpj));

/** Suspensão é temporária; as outras tiram o produto de circulação. */
const grave = (acao: string) => acao !== "Suspensão";
const atividades = computed(() => props.m.atividades.map((a) => a.toLowerCase()).join(", "));
const datas = computed(() =>
  props.m.dt_primeira === props.m.dt_ultima
    ? fmtData(props.m.dt_ultima)
    : `de ${fmtData(props.m.dt_primeira)} a ${fmtData(props.m.dt_ultima)}`,
);
</script>

<template>
  <details class="medida">
    <summary>
      <span class="medida-topo">
        <span class="medida-produto">{{ legivel(m.produto, "nome") }}</span>
        <span class="medida-data">{{ fmtData(m.dt_ultima) }}</span>
      </span>
      <span class="medida-empresa">{{
        m.empresa ? legivel(m.empresa, "nome") : "Empresa não informada na medida"
      }}</span>
      <span class="medida-acoes">
        <span v-for="a in m.acoes" :key="a" class="selo" :class="grave(a) ? 'perigo' : 'atencao'">
          <Icone nome="alerta" />{{ a }}
        </span>
      </span>
    </summary>
    <dl class="ficha">
      <div v-if="m.atividades.length">
        <dt>Sobre</dt>
        <dd>{{ atividades }}</dd>
      </div>
      <div>
        <dt>Publicada</dt>
        <dd>{{ datas }}</dd>
      </div>
      <div v-if="m.risco">
        <dt>Risco</dt>
        <dd>{{ m.risco }}</dd>
      </div>
      <div v-if="m.processo">
        <dt>Processo da medida</dt>
        <dd>{{ fmtProcesso(m.processo) }} <Copiar :valor="m.processo" rotulo="processo" /></dd>
      </div>
      <div v-if="m.cnpj">
        <dt>Empresa</dt>
        <dd>
          <a :href="urlEmpresa(m.cnpj)" title="Ver o que mais há desta empresa" @click="verEmpresa($event, m.cnpj)"
            >CNPJ {{ fmtCnpj(m.cnpj) }}</a
          >
        </dd>
      </div>
    </dl>
    <p class="note">Medida publicada pela ANVISA; não diz se o produto ainda está à venda.</p>
  </details>
</template>
