<script setup lang="ts">
import { computed } from "vue";
import type { ProdutoSaude } from "./fonte";
import { fmtProcesso } from "../../lib/format";
import { dicaTipos, situacaoDe } from "../../lib/situacao";
import { legivel } from "../../lib/texto";
import { meta } from "./meta";
import { validade } from "../../lib/validade";
import { cliqueInterno, montarUrl } from "../../components/composables/useUrlState";
import Destaque from "../../components/Destaque.vue";
import Icone from "../../components/Icone.vue";

const props = defineProps<{ p: ProdutoSaude; termo?: string | readonly string[] | null; medidas?: number }>();
const emit = defineEmits<{ abrir: [id: string] }>();

const ativo = computed(() => props.p.situacao_registro === "Ativo");
const sit = computed(() => situacaoDe(ativo.value));
const cadastro = computed(() => props.p.tipo_regularizacao === "Cadastrado");
const val = computed(() => validade(props.p.validade, props.p.dt_vencimento, ativo.value));
const href = computed(() => montarUrl({ produto: props.p.id }));

function abrir(ev: MouseEvent): void {
  if (!cliqueInterno(ev)) return;
  ev.preventDefault();
  emit("abrir", props.p.id);
}
</script>

<template>
  <article class="cartao" :class="{ inativo: !ativo }">
    <a class="cartao-link" :href="href" @click="abrir">
      <div class="cartao-topo">
        <h3><Destaque :texto="legivel(p.nome, 'nome')" :termo="termo" /></h3>
        <span class="situacao" :class="ativo ? 'ok' : 'off'" :title="sit.dica">{{ sit.curto }}</span>
      </div>
      <p v-if="p.nome_tecnico" class="cartao-empresa"><Destaque :texto="legivel(p.nome_tecnico)" :termo="termo" /></p>
      <p class="cartao-empresa"><Destaque :texto="legivel(p.empresa, 'nome')" :termo="termo" /></p>
      <div class="alergia compacta">
        <span class="selo" :title="dicaTipos(meta.tipos)">{{ p.tipo_regularizacao }}</span>
        <span v-if="p.grupo" class="selo" title="Classe de risco, de I (menor) a IV (maior)"
          ><Icone nome="pulso" />{{ p.grupo }}</span
        >
        <span v-if="!cadastro" class="selo" :class="val.classe === 'neutro' ? '' : val.classe" :title="val.dica"
          ><Icone nome="gota" />{{ val.curto }}</span
        >
      </div>
      <p
        v-if="medidas"
        class="aviso-curto"
        title="Medidas de fiscalização contra a empresa, não necessariamente sobre este produto"
      >
        <Icone nome="alerta" /> Empresa com medidas da ANVISA ({{ medidas }})
      </p>
      <p class="cartao-rodape">
        <span>{{ cadastro ? "Cadastro" : "Registro" }} {{ p.registro }}</span>
        <span v-if="p.processo">Processo {{ fmtProcesso(p.processo) }}</span>
        <Icone nome="seta" class="seta" />
      </p>
    </a>
  </article>
</template>
