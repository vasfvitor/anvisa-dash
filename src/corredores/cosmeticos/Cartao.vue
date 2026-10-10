<script setup lang="ts">
import { computed } from "vue";
import type { Cosmetico } from "./fonte";
import { fmtProcesso } from "../../lib/format";
import { situacaoDe, TIPOS } from "../../lib/situacao";
import { legivel } from "../../lib/texto";
import { validade } from "../../lib/validade";
import { cliqueInterno, montarUrl } from "../../components/composables/useUrlState";
import Destaque from "../../components/Destaque.vue";
import Icone from "../../components/Icone.vue";

const props = defineProps<{ p: Cosmetico; termo?: string | null; medidas?: number }>();
const emit = defineEmits<{ abrir: [id: string] }>();

const ativo = computed(() => props.p.situacao_registro === "Ativo");
const sit = computed(() => situacaoDe(ativo.value));
const val = computed(() => validade(props.p.grupo, props.p.dt_vencimento, ativo.value));
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
      <p v-if="p.no_razao_social_empresa" class="cartao-empresa">{{ legivel(p.no_razao_social_empresa, "nome") }}</p>
      <div class="alergia compacta">
        <span class="selo" :title="TIPOS">{{ p.tipo_regularizacao }}</span>
        <span class="selo" :class="val.classe === 'neutro' ? '' : val.classe" :title="val.dica"
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
        <span>Processo {{ fmtProcesso(p.nu_processo) }}</span>
        <span v-if="p.nu_registro">Registro {{ p.nu_registro }}</span>
        <Icone nome="seta" class="seta" />
      </p>
    </a>
  </article>
</template>
