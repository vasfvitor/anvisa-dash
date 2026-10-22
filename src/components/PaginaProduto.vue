<script setup lang="ts">
// A moldura da página de produto, igual nos cinco corredores: a navegação (Voltar, Compartilhar, Ver na
// ANVISA) e os três estados (carregando, erro, não encontrado). O que é do corredor (cabeçalho, avisos,
// seções) vem no slot; `item` é o substantivo dele (meta.item[0]: "remédio", "produto de limpeza").
import { computed } from "vue";
import { useCopia } from "./composables/useCopia";
import Icone from "./Icone.vue";

const props = defineProps<{ carregando: boolean; erro: string; achou: boolean; linkAnvisa: string; item: string }>();
const emit = defineEmits<{ voltar: [] }>();
defineSlots<{ default(): unknown }>();
const { copiado: compartilhado, compartilhar } = useCopia();
const Item = computed(() => props.item.charAt(0).toLocaleUpperCase("pt-BR") + props.item.slice(1));
</script>

<template>
  <div class="produto-pagina">
    <nav class="produto-nav">
      <button type="button" class="btn" @click="emit('voltar')"><Icone nome="volta" /> Voltar</button>
      <span v-if="achou" class="produto-acoes">
        <button type="button" class="btn" @click="compartilhar">
          <Icone :nome="compartilhado ? 'certo' : 'compartilhar'" />
          {{ compartilhado ? "Link copiado" : "Compartilhar" }}
        </button>
        <a class="btn" :href="linkAnvisa" target="_blank" rel="noopener"><Icone nome="externo" /> Ver na ANVISA</a>
      </span>
    </nav>

    <p v-if="carregando" class="estado" role="status">Carregando {{ item }}…</p>
    <p v-else-if="erro" class="estado erro" role="alert">
      Não foi possível carregar o {{ item }}. <span class="note">{{ erro }}</span>
    </p>
    <div v-else-if="!achou" class="estado">
      <p>{{ Item }} não encontrado nos dados atuais.</p>
      <button type="button" class="btn" @click="emit('voltar')">Voltar à busca</button>
    </div>
    <slot v-else />
  </div>
</template>
