<script setup lang="ts">
// Aviso de medidas de fiscalização na página de um produto: forte quando uma medida cita este produto
// pelo registro (só os saneantes trazem), discreto quando é contra a empresa. A página já carregou o
// produto quando isto aparece, então a tabela principal não disputa o download.
import { onMounted, ref, shallowRef } from "vue";
import { plural } from "../lib/format";
import { medidasPorEmpresa, porRegistro, type Medida } from "../lib/medidas";
import Icone from "./Icone.vue";
import MedidaCartao from "./MedidaCartao.vue";

const props = defineProps<{ tipo: number; cnpj: string; registro?: string | null }>();
const emit = defineEmits<{ empresa: [cnpj: string] }>();

const doProduto = shallowRef<Medida[]>([]);
const daEmpresa = ref(0);

onMounted(() => {
  const produto = props.registro ? porRegistro(props.tipo, props.registro) : Promise.resolve([]);
  Promise.all([produto, medidasPorEmpresa(props.tipo, [props.cnpj])]).then(
    ([m, n]) => {
      doProduto.value = m;
      daEmpresa.value = n.get(props.cnpj) ?? 0;
    },
    () => {
      // sem as medidas a página do produto continua completa; só não mostra o aviso
    },
  );
});
</script>

<template>
  <div v-if="doProduto.length" class="aviso perigo aviso-medidas" role="alert">
    <Icone nome="alerta" />
    <div>
      <strong>A ANVISA tomou {{ doProduto.length === 1 ? "medida" : "medidas" }} contra este produto.</strong>
      <div class="medidas-lista">
        <MedidaCartao v-for="m in doProduto" :key="m.id" :m="m" @empresa="(c: string) => emit('empresa', c)" />
      </div>
    </div>
  </div>
  <div v-else-if="daEmpresa" class="aviso aviso-medidas" role="note">
    <Icone nome="alerta" />
    <div>
      A ANVISA tem {{ plural(daEmpresa, "medida de fiscalização", "medidas de fiscalização") }} contra esta empresa (não
      necessariamente sobre este produto).
      <a href="#" @click.prevent="emit('empresa', cnpj)">Ver as medidas</a>
    </div>
  </div>
</template>
