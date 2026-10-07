<script setup lang="ts">
import { computed } from "vue";
import type { ResumoAlergia as Resumo } from "../lib/alergia";
import { fmtData, plural } from "../lib/format";
import { ativo, indeferido, marcasParaBusca } from "../lib/produto";
import type { Produto } from "../lib/fontes/alimentos";
import { situacaoDe } from "../lib/situacao";
import { legivel } from "../lib/texto";
import { cliqueInterno, montarUrl } from "./composables/useUrlState";
import Destaque from "./Destaque.vue";
import Icone from "./Icone.vue";
import ResumoAlergia from "./ResumoAlergia.vue";

// extra: o resumo de alergênicos, que chega depois da lista
const props = defineProps<{ p: Produto; termo?: string | null; extra?: Resumo }>();
const emit = defineEmits<{ abrir: [id: string] }>();

const listaMarcas = computed(() => marcasParaBusca(props.p, props.termo));
const titulo = computed(() => listaMarcas.value.slice(0, 2).join(" · ") || legivel(props.p.no_produto));
const outrasMarcas = computed(() => Math.max(0, listaMarcas.value.length - 2));
const subtitulo = computed(() => (listaMarcas.value.length ? legivel(props.p.no_produto) : ""));
const href = computed(() => montarUrl({ produto: String(props.p.co_seq_produto) }));

function abrir(ev: MouseEvent): void {
  if (!cliqueInterno(ev)) return;
  ev.preventDefault();
  emit("abrir", String(props.p.co_seq_produto));
}
</script>

<template>
  <article class="cartao" :class="{ inativo: !ativo(p) }">
    <a class="cartao-link" :href="href" @click="abrir">
      <div class="cartao-topo">
        <h3>
          <Destaque :texto="titulo" :termo="termo" />
          <span v-if="outrasMarcas" class="mais-marcas"> +{{ outrasMarcas }}</span>
        </h3>
        <span class="situacao" :class="ativo(p) ? 'ok' : 'off'" :title="situacaoDe(ativo(p)).dica">{{ situacaoDe(ativo(p)).curto }}</span>
      </div>
      <p v-if="subtitulo" class="cartao-nome"><Destaque :texto="subtitulo" :termo="termo" /></p>
      <p class="cartao-empresa">
        <Destaque :texto="legivel(p.no_razao_social_empresa, 'nome')" :termo="termo" />
        <template v-if="p.ds_categoria_produto"> · {{ legivel(p.ds_categoria_produto) }}</template>
      </p>
      <ResumoAlergia v-if="extra" :r="extra" compacto />
      <p v-if="indeferido(p)" class="aviso-curto"><Icone nome="alerta" /> Petição indeferida pela ANVISA</p>
      <p class="cartao-rodape">
        <span>{{ p.tipo_regularizacao }}<template v-if="p.dt_regularizacao"> em {{ fmtData(p.dt_regularizacao) }}</template></span>
        <span>{{ plural(p.n_apresentacoes, "apresentação", "apresentações") }}</span>
        <Icone nome="seta" class="seta" />
      </p>
    </a>
  </article>
</template>
