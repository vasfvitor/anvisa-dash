<script setup lang="ts">
import { computed } from "vue";
import { deJson, resumirAlergia } from "../lib/alergia";
import { fmtData, marcas } from "../lib/format";
import type { Produto } from "../lib/queries";
import { legivel, normalizar } from "../lib/texto";
import { cliqueInterno, montarUrl } from "./composables/useUrlState";
import Destaque from "./Destaque.vue";
import Icone from "./Icone.vue";
import ResumoAlergia from "./ResumoAlergia.vue";

const props = defineProps<{ p: Produto; termo?: string | null }>();
const emit = defineEmits<{ abrir: [id: number] }>();

// A marca é o que a pessoa reconhece; sem marca, o nome registrado vira o título. A primeira marca é
// sempre a do registro (a mesma do título da página do produto); a segunda é a que casou com a busca,
// se houver, para a pessoa ver por que o produto apareceu.
const listaMarcas = computed(() => {
  const [primeira, ...resto] = marcas(props.p.marcas);
  if (!primeira) return [];
  const t = props.termo ? normalizar(props.termo.trim()) : "";
  const casou = t && !normalizar(primeira).includes(t) ? resto.find((m) => normalizar(m).includes(t)) : undefined;
  return casou ? [primeira, casou, ...resto.filter((m) => m !== casou)] : [primeira, ...resto];
});
const titulo = computed(() => listaMarcas.value.slice(0, 2).join(" · ") || legivel(props.p.no_produto));
const outrasMarcas = computed(() => Math.max(0, listaMarcas.value.length - 2));
const subtitulo = computed(() => (listaMarcas.value.length ? legivel(props.p.no_produto) : ""));
const ativo = computed(() => props.p.situacao_registro === "Ativo");
const indeferido = computed(() => /indeferimento/i.test(props.p.ds_situacao_assunto_doc ?? ""));
const resumo = computed(() =>
  props.p.alergenicos_json === null ? null : resumirAlergia(deJson(props.p.alergenicos_json), deJson(props.p.intolerancias_json)),
);
const href = computed(() => montarUrl({ produto: props.p.co_seq_produto }));

function abrir(ev: MouseEvent): void {
  if (!cliqueInterno(ev)) return;
  ev.preventDefault();
  emit("abrir", props.p.co_seq_produto);
}
</script>

<template>
  <article class="cartao" :class="{ inativo: !ativo }">
    <a class="cartao-link" :href="href" @click="abrir">
      <div class="cartao-topo">
        <h3>
          <Destaque :texto="titulo" :termo="termo" />
          <span v-if="outrasMarcas" class="mais-marcas"> +{{ outrasMarcas }}</span>
        </h3>
        <span class="situacao" :class="ativo ? 'ok' : 'off'">{{ ativo ? "Ativo" : "Inativo" }}</span>
      </div>
      <p v-if="subtitulo" class="cartao-nome"><Destaque :texto="subtitulo" :termo="termo" /></p>
      <p class="cartao-empresa">
        <Destaque :texto="legivel(p.no_razao_social_empresa, 'nome')" :termo="termo" />
        <template v-if="p.ds_categoria_produto"> · {{ legivel(p.ds_categoria_produto) }}</template>
      </p>
      <ResumoAlergia v-if="resumo" :r="resumo" compacto />
      <p v-if="indeferido" class="aviso-curto"><Icone nome="alerta" /> Petição indeferida pela ANVISA</p>
      <p class="cartao-rodape">
        <span>{{ p.tipo_regularizacao }}<template v-if="p.dt_regularizacao"> em {{ fmtData(p.dt_regularizacao) }}</template></span>
        <span>{{ p.n_apresentacoes }} apresentaç{{ p.n_apresentacoes === 1 ? "ão" : "ões" }}</span>
        <Icone nome="seta" class="seta" />
      </p>
    </a>
  </article>
</template>
