<script setup lang="ts">
import { computed } from "vue";
import type { Saneante } from "./fonte";
import { fmtProcesso } from "../../lib/format";
import { situacaoDe, TIPOS } from "../../lib/situacao";
import { legivel } from "../../lib/texto";
import { validade } from "./validade";
import { cliqueInterno, montarUrl } from "../../components/composables/useUrlState";
import Destaque from "../../components/Destaque.vue";
import Icone from "../../components/Icone.vue";

const props = defineProps<{ p: Saneante; termo?: string | null }>();
const emit = defineEmits<{ abrir: [id: string] }>();

const ativo = computed(() => props.p.situacao_registro === "Ativo");
const sit = computed(() => situacaoDe(ativo.value));
const val = computed(() => validade(props.p.grupo, props.p.dt_vencimento));
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
        <h3><Destaque :texto="legivel(p.no_produto, 'nome')" :termo="termo" /></h3>
        <span class="situacao" :class="ativo ? 'ok' : 'off'" :title="sit.dica">{{ sit.curto }}</span>
      </div>
      <p class="cartao-empresa"><Destaque :texto="legivel(p.no_razao_social_empresa, 'nome')" :termo="termo" /></p>
      <div class="alergia compacta">
        <span class="selo" :title="TIPOS">{{ p.tipo_regularizacao }}</span>
        <span class="selo" :class="val.classe === 'neutro' ? '' : val.classe"
          ><Icone nome="gota" />{{ val.curto }}</span
        >
      </div>
      <p class="cartao-rodape">
        <span>Processo {{ fmtProcesso(p.nu_processo) }}</span>
        <span>Expediente {{ p.nu_expediente }}</span>
        <Icone nome="seta" class="seta" />
      </p>
    </a>
  </article>
</template>
