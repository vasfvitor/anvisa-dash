<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { fmtData, fmtInt } from "../lib/format";
import { MODO_ROTULO } from "../lib/detect";
import { useBusca } from "./composables/useBusca";
import { useDuckDB } from "./composables/useDuckDB";
import { gravarUrl, lerUrl } from "./composables/useUrlState";
import Filtros from "./Filtros.vue";
import ListaProdutos from "./ListaProdutos.vue";
import SearchBox from "./SearchBox.vue";

const motor = useDuckDB();
const b = useBusca();
const { entrada, filtros } = b;

const EXEMPLOS = ["colágeno", "whey", "01615814000101"];

function estado() {
  return { q: entrada.value, ...filtros };
}

function aplicarUrl(): void {
  const e = lerUrl();
  entrada.value = e.q;
  Object.assign(filtros, { categoria: e.categoria, tipo: e.tipo, inativos: e.inativos });
}

let espera: ReturnType<typeof setTimeout> | undefined;

function confirmar(): void {
  clearTimeout(espera);
  gravarUrl(estado(), true);
  if (motor.status.value === "pronto") void b.buscar(false, true);
}

function buscarValor(v: string): void {
  entrada.value = v;
  confirmar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// digitação: espera a pausa, busca e só substitui a URL (não enche o histórico)
watch(entrada, () => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    gravarUrl(estado());
    if (motor.status.value === "pronto") void b.buscar();
  }, 350);
});

// filtro é uma escolha deliberada: entra no histórico
watch(
  () => ({ ...filtros }),
  () => {
    gravarUrl(estado(), true);
    if (motor.status.value === "pronto") void b.buscar();
  },
);

function voltar(): void {
  aplicarUrl();
}

onMounted(async () => {
  aplicarUrl();
  window.addEventListener("popstate", voltar);
  await motor.subir();
  // busca do link compartilhado, assim que o motor fica pronto
  if (motor.status.value === "pronto") void b.buscar();
});
onBeforeUnmount(() => {
  window.removeEventListener("popstate", voltar);
  clearTimeout(espera);
});
</script>

<template>
  <SearchBox v-model="entrada" :consulta="b.consulta.value" :desabilitado="motor.status.value === 'erro'" @confirmar="confirmar" />
  <Filtros v-model="filtros" :categorias="motor.categorias.value" />

  <p v-if="motor.status.value === 'iniciando'" class="estado" role="status">
    Carregando o motor de consulta… (cerca de 5 MB na primeira visita; depois fica no cache do navegador)
  </p>
  <div v-else-if="motor.status.value === 'erro'" class="estado erro" role="alert">
    <p>Não foi possível iniciar a consulta: {{ motor.erro.value }}</p>
    <button class="btn" type="button" @click="motor.subir().then(() => b.buscar(false, true))">Tentar de novo</button>
  </div>
  <template v-else>
    <p v-if="b.erro.value" class="estado erro" role="alert">Erro na busca: {{ b.erro.value }}</p>
    <p v-else-if="b.carregando.value && !b.produtos.value.length" class="estado" role="status">Buscando…</p>

    <template v-if="b.buscada.value">
      <p class="contagem" aria-live="polite">
        <template v-if="b.total.value">
          {{ fmtInt(b.total.value) }} produto{{ b.total.value === 1 ? "" : "s" }}
          {{ filtros.inativos ? "" : "ativo" + (b.total.value === 1 ? "" : "s") }}
          · {{ MODO_ROTULO[b.buscada.value.modo] }}
        </template>
        <template v-else-if="!b.carregando.value && !b.erro.value">
          Nenhum produto encontrado.
          <a v-if="!filtros.inativos" href="#" @click.prevent="filtros.inativos = true">Incluir inativos?</a>
        </template>
      </p>
      <ListaProdutos
        :produtos="b.produtos.value"
        :tem-mais="b.temMais.value"
        :carregando="b.carregando.value"
        @mais="b.buscar(true)"
        @buscar="buscarValor"
      />
    </template>
    <p v-else-if="!b.carregando.value" class="note">
      Experimente:
      <template v-for="(x, i) in EXEMPLOS" :key="x">
        <a href="#" @click.prevent="buscarValor(x)">{{ x }}</a>{{ i < EXEMPLOS.length - 1 ? ", " : "." }}
      </template>
    </p>
  </template>

  <p v-if="motor.fonte.value?.loaded_at" class="note">
    Dados da ANVISA de {{ fmtData(motor.fonte.value.loaded_at) }}
    (<a :href="motor.fonte.value.url">{{ motor.fonte.value.name }}</a>).
  </p>
</template>
