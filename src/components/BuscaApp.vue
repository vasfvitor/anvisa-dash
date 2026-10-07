<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { MODO_ROTULO } from "../lib/detect";
import { fmtBytes, fmtCnpj, fmtData, fmtInt } from "../lib/format";
import { legivel } from "../lib/texto";
import CaixaBusca from "./CaixaBusca.vue";
import CartaoProduto from "./CartaoProduto.vue";
import { useBusca } from "./composables/useBusca";
import { useDuckDB } from "./composables/useDuckDB";
import { gravarUrl, lerUrl, type EstadoUrl } from "./composables/useUrlState";
import Facetas from "./Facetas.vue";
import Inicio from "./Inicio.vue";
import ProdutoPagina from "./ProdutoPagina.vue";

const motor = useDuckDB();
const b = useBusca();
const { entrada, marca, filtros } = b;
const produto = ref<number | null>(null);
/** se a página do produto foi aberta de dentro do app, "voltar" é o voltar do navegador */
const abertoDaqui = ref(false);
const pronto = computed(() => motor.status.value === "pronto");

function estado(): Partial<EstadoUrl> {
  return { q: entrada.value, marca: marca.value, ...filtros, produto: produto.value };
}

function aplicarUrl(): void {
  const e = lerUrl();
  marca.value = e.marca;
  entrada.value = e.marca || e.q;
  Object.assign(filtros, { categoria: e.categoria, tipo: e.tipo, situacao: e.situacao });
  produto.value = e.produto;
}

// a página estática tem um cabeçalho de apresentação: só faz sentido na tela inicial
const tela = computed(() => (produto.value ? "produto" : b.consulta.value ? "busca" : "inicio"));
watch(tela, (t) => (document.body.dataset.tela = t), { immediate: true });

let espera: ReturnType<typeof setTimeout> | undefined;

function buscarAgora(forcar = false): void {
  if (pronto.value) void b.buscar(false, forcar);
}

function confirmar(): void {
  clearTimeout(espera);
  produto.value = null;
  gravarUrl(estado(), true);
  buscarAgora(true);
}

// digitar desfaz a marca escolhida; a busca espera a pausa e só substitui a URL
watch(entrada, (v) => {
  if (marca.value && v !== marca.value) marca.value = "";
  clearTimeout(espera);
  espera = setTimeout(() => {
    if (produto.value) return;
    gravarUrl(estado());
    buscarAgora();
  }, 250);
});

// filtro é uma escolha deliberada: entra no histórico
watch(
  () => ({ ...filtros }),
  () => {
    gravarUrl(estado(), true);
    buscarAgora();
  },
);

// O resumo de alergênicos chegou: refaz a lista para os cartões mostrarem os selos. Vale também com
// uma busca ainda em andamento (começou sem o resumo); a resposta dela é descartada pela mais nova.
watch(motor.versaoResumo, () => b.consulta.value && !produto.value && buscarAgora(true));

function escolherMarca(rotulo: string): void {
  marca.value = rotulo;
  entrada.value = rotulo;
  confirmar();
}

function escolherEmpresa(cnpj: string): void {
  marca.value = "";
  entrada.value = fmtCnpj(cnpj);
  confirmar();
  window.scrollTo({ top: 0 });
}

function exemplo(valor: string): void {
  marca.value = "";
  entrada.value = valor;
  confirmar();
}

function explorar(categoria: string): void {
  marca.value = "";
  entrada.value = "";
  filtros.categoria = categoria;
}

function abrirProduto(id: number): void {
  produto.value = id;
  abertoDaqui.value = true;
  gravarUrl(estado(), true);
  window.scrollTo({ top: 0 });
}

function voltar(): void {
  if (abertoDaqui.value) {
    history.back();
    return;
  }
  produto.value = null;
  gravarUrl(estado(), true);
  buscarAgora();
}

function aoNavegar(): void {
  aplicarUrl();
  abertoDaqui.value = false;
  if (!produto.value) buscarAgora();
}

onMounted(async () => {
  aplicarUrl();
  window.addEventListener("popstate", aoNavegar);
  await motor.subir();
  if (pronto.value && !produto.value) void b.buscar();
});
onBeforeUnmount(() => {
  window.removeEventListener("popstate", aoNavegar);
  clearTimeout(espera);
});

const termo = computed(() => {
  const q = b.buscada.value;
  return q && (q.modo === "texto" || q.modo === "marca") ? q.valor : null;
});

const titulo = computed(() => {
  const q = b.buscada.value;
  if (!q) return "";
  const n = b.total.value;
  const produtos = `${fmtInt(n)} produto${n === 1 ? "" : "s"}`;
  if (q.modo === "cnpj" && b.produtos.value[0]) return `${produtos} de ${legivel(b.produtos.value[0].no_razao_social_empresa, "nome")}`;
  if (q.modo === "marca") return `${produtos} da marca ${q.valor}`;
  if (q.modo === "texto") return `${produtos} para “${q.valor}”`;
  if (q.modo === "todos") return `${produtos} em ${legivel(filtros.categoria)}`;
  return `${produtos} · ${MODO_ROTULO[q.modo]}`;
});
</script>

<template>
  <CaixaBusca
    v-model="entrada"
    :consulta="b.consulta.value"
    :pronto="pronto"
    @confirmar="confirmar"
    @marca="escolherMarca"
    @empresa="escolherEmpresa"
  />

  <div v-if="motor.status.value === 'iniciando' || motor.status.value === 'baixando'" class="carregamento" role="status">
    <div class="barra" :class="{ indeterminada: motor.status.value === 'iniciando' }">
      <span :style="{ width: `${Math.round(motor.progresso.value * 100)}%` }"></span>
    </div>
    <p>
      <template v-if="motor.status.value === 'iniciando'">Preparando o motor de consulta…</template>
      <template v-else>Baixando os dados da ANVISA: {{ Math.round(motor.progresso.value * 100) }}% de {{ fmtBytes(motor.tamanho.value) }}</template>
      <span class="muted"> Só na primeira visita; depois fica guardado no navegador.</span>
    </p>
  </div>
  <div v-else-if="motor.status.value === 'erro'" class="estado erro" role="alert">
    <p>Não foi possível iniciar a consulta: {{ motor.erro.value }}</p>
    <button class="btn" type="button" @click="motor.subir().then(() => b.buscar(false, true))">Tentar de novo</button>
  </div>

  <ProdutoPagina
    v-if="produto"
    :id="produto"
    :versao-resumo="motor.versaoResumo.value"
    @voltar="voltar"
    @empresa="escolherEmpresa"
  />

  <template v-else-if="b.consulta.value">
    <Facetas v-if="b.buscada.value" v-model="filtros" :contagens="b.contagens.value" />
    <p v-if="b.erro.value" class="estado erro" role="alert">Erro na busca: {{ b.erro.value }}</p>
    <template v-else-if="b.buscada.value">
      <h2 class="resultado-titulo" aria-live="polite">
        <template v-if="b.total.value">{{ titulo }}</template>
        <template v-else-if="!b.carregando.value">Nenhum produto encontrado</template>
      </h2>
      <div v-if="!b.total.value && !b.carregando.value" class="vazio">
        <p v-if="filtros.situacao === 'ativo'">
          Só estão sendo mostrados produtos ativos.
          <a href="#" @click.prevent="filtros.situacao = 'todos'">Incluir os inativos</a>
        </p>
        <p v-if="filtros.categoria || filtros.tipo">
          <a href="#" @click.prevent="Object.assign(filtros, { categoria: '', tipo: '' })">Limpar os filtros</a>
        </p>
        <p class="note">Dica: busque por parte do nome, sem acento se preferir, ou cole o CNPJ ou o nº do processo.</p>
      </div>
      <div class="lista" :class="{ esmaecida: b.carregando.value }">
        <CartaoProduto v-for="p in b.produtos.value" :key="p.co_seq_produto" :p="p" :termo="termo" @abrir="abrirProduto" />
      </div>
      <p v-if="b.temMais.value" class="mais">
        <button class="btn" type="button" :disabled="b.carregando.value" @click="b.buscar(true)">
          {{ b.carregando.value ? "Carregando…" : `Mostrar mais (${fmtInt(b.produtos.value.length)} de ${fmtInt(b.total.value)})` }}
        </button>
      </p>
    </template>
    <p v-else-if="pronto" class="estado" role="status">Buscando…</p>
  </template>

  <Inicio
    v-else
    :totais="motor.totais.value"
    :categorias="motor.categorias.value"
    @exemplo="exemplo"
    @categoria="explorar"
  />

  <p v-if="motor.fonte.value?.loaded_at" class="note fonte">
    Dados abertos da ANVISA de {{ fmtData(motor.fonte.value.loaded_at) }}
    (<a :href="motor.fonte.value.url">{{ motor.fonte.value.name }}</a>).
  </p>
</template>
