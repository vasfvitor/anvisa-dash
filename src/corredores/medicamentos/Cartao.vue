<script setup lang="ts">
import { computed } from "vue";
import type { Medicamento } from "./fonte";
import { fmtProcesso, fmtRegistroMedicamento } from "../../lib/format";
import { situacaoDe } from "../../lib/situacao";
import { legivel } from "../../lib/texto";
import { cliqueInterno, montarUrl } from "../../components/composables/useUrlState";
import Destaque from "../../components/Destaque.vue";
import Icone from "../../components/Icone.vue";

const props = defineProps<{ p: Medicamento; termo?: string | readonly string[] | null; medidas?: number }>();
const emit = defineEmits<{ abrir: [id: string] }>();

const ativo = computed(() => props.p.situacao_registro === "Ativo");
const sit = computed(() => situacaoDe(ativo.value));
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
      <p v-if="p.principio_ativo" class="cartao-empresa">
        <Destaque :texto="p.principio_ativo" :termo="termo" />
      </p>
      <p class="cartao-empresa"><Destaque :texto="legivel(p.empresa, 'nome')" :termo="termo" /></p>
      <div class="alergia compacta">
        <span class="selo" title="Categoria regulatória do medicamento">{{ legivel(p.tipo_regularizacao) }}</span>
        <span v-if="p.classe_terapeutica" class="selo" title="Classe terapêutica"
          ><Icone nome="comprimido" />{{ legivel(p.classe_terapeutica) }}</span
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
        <span v-if="p.registro_produto">Registro {{ fmtRegistroMedicamento(p.registro_produto) }}</span>
        <span v-else>Sem nº de registro na ANVISA</span>
        <span v-if="p.processo">Processo {{ fmtProcesso(p.processo) }}</span>
        <Icone nome="seta" class="seta" />
      </p>
    </a>
  </article>
</template>
