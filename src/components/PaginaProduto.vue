<script setup lang="ts">
// A moldura da página de produto, igual nos cinco corredores: a navegação (Voltar, Compartilhar, Ver na
// ANVISA) e os três estados (carregando, erro, não encontrado). O que é do corredor (cabeçalho, avisos,
// seções) vem no slot; `item` é o substantivo dele (meta.item[0]: "remédio", "produto de limpeza").
// `relato` names this product with its number ("Novalgina, registro 1.0090.0029") for the "Encontrou um erro?"
// sentence after the data; the page address is read here, in the browser.
import { computed } from "vue";
import { paginaProduto, relatoHtml } from "../lib/relato";
import { useCopia } from "./composables/useCopia";
import Icone from "./Icone.vue";

const props = defineProps<{
  carregando: boolean;
  erro: string;
  achou: boolean;
  linkAnvisa: string;
  item: string;
  relato: string;
}>();
const emit = defineEmits<{ voltar: [] }>();
defineSlots<{ default(): unknown }>();
const { copiado: compartilhado, compartilhar } = useCopia();
const Item = computed(() => props.item.charAt(0).toLocaleUpperCase("pt-BR") + props.item.slice(1));
// built from our own constants and URL-encoded values only (relato.ts), so v-html carries no outside markup
const relatoFrase = computed(() =>
  relatoHtml({ pagina: paginaProduto(location.href), item: props.relato, titulo: props.relato || document.title }),
);
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
    <template v-else>
      <slot />
      <!-- eslint-disable-next-line vue/no-v-html -- relato.ts builds it from constants and URL-encoded values -->
      <p class="note relato" v-html="relatoFrase" />
    </template>
  </div>
</template>
