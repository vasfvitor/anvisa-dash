<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { corredorDaUrl, corredorPorId, rotaDo, type Corredor } from "../lib/corredores";
import { MODO_ROTULO } from "../lib/detect";
import { FONTES } from "../lib/fontes";
import { fmtBytes, fmtCnpj, fmtData, fmtInt, plural } from "../lib/format";
import { tituloPagina } from "../lib/marca";
import { legivel } from "../lib/texto";
import CaixaBusca from "./CaixaBusca.vue";
import { useBusca } from "./composables/useBusca";
import { useDuckDB } from "./composables/useDuckDB";
import { cliqueInterno, gravarUrl, lerUrl, type EstadoUrl } from "./composables/useUrlState";
import { TELAS } from "./corredores";
import Facetas from "./Facetas.vue";
import Icone from "./Icone.vue";
import Inicio from "./Inicio.vue";

const corredor = shallowRef<Corredor>(corredorDaUrl(location.pathname));
const fonte = computed(() => FONTES[corredor.value.id]);
const telas = computed(() => TELAS[corredor.value.id]);
const motor = useDuckDB(corredor);
const b = useBusca(fonte);
const { entrada, marca, filtros } = b;
const produto = ref<string | null>(null);
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
  Object.assign(filtros, { grupo: e.grupo, tipo: e.tipo, situacao: e.situacao });
  produto.value = e.produto;
}

// A página estática tem uma abertura que só faz sentido na tela inicial. O script inline do Base
// marca corredor e tela pela URL antes da primeira pintura; daqui em diante a ilha atualiza.
const tela = computed(() => (produto.value ? "produto" : b.consulta.value ? "busca" : "inicio"));
watch(tela, (t) => (document.documentElement.dataset.tela = t), { immediate: true });

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

/** Busca escolhida por clique (sugestão, exemplo, empresa): põe o texto na caixa e busca já. */
function buscarPor(texto: string, comoMarca = false): void {
  marca.value = comoMarca ? texto : "";
  entrada.value = texto;
  confirmar();
  window.scrollTo({ top: 0 });
}

function explorar(grupo: string): void {
  marca.value = "";
  entrada.value = "";
  filtros.grupo = grupo;
}

function abrirProduto(id: string): void {
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

// ---------------------------------------------------------------------------------------------
// corredores

/** Marca a placa do corredor ativo no cabeçalho (estático, fora da ilha). */
function marcarPlacas(id: string): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-corredor-link]")) {
    if (a.dataset.corredorLink === id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

const reduzido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// título da aba do corredor; "post" para rodar depois de uma página de produto desmontar e devolver o dela
watch(corredor, (c) => produto.value || (document.title = tituloPagina(c.titulo)), { flush: "post" });

/**
 * Troca de corredor sem recarregar: leva o termo, zera filtros, marca e produto aberto, e prepara a
 * fonte nova (o que já foi baixado continua em memória). Com View Transitions, a página nova aparece
 * num círculo que cresce a partir do clique, como a cor do corredor tomando conta.
 */
async function trocarCorredor(novo: Corredor, opcoes: { origem?: { x: number; y: number }; push: boolean }): Promise<void> {
  if (novo.id === corredor.value.id) return;
  const aplicar = () => {
    corredor.value = novo;
    document.documentElement.dataset.corredor = novo.id;
    marcarPlacas(novo.id);
    marca.value = "";
    produto.value = null;
    abertoDaqui.value = false;
    Object.assign(filtros, { grupo: "", tipo: "", situacao: "ativo" });
    b.limpar();
    if (opcoes.push) gravarUrl(estado(), true, rotaDo(novo));
  };
  const h = document.documentElement;
  if ("startViewTransition" in document && !reduzido()) {
    const { x, y } = opcoes.origem ?? { x: innerWidth / 2, y: 0 };
    h.style.setProperty("--vt-x", `${x}px`);
    h.style.setProperty("--vt-y", `${y}px`);
    h.style.setProperty("--vt-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    // A função de atualização roda depois de capturar a tela antiga (assíncrona): esperar por ela
    // antes de preparar a fonte nova, senão a preparação ainda vê o corredor anterior. Se o navegador
    // pular a animação (aba em segundo plano), ela roda do mesmo jeito; só `ready` rejeita.
    try {
      const vt = document.startViewTransition(() => {
        aplicar();
        return nextTick();
      });
      vt.ready.catch(() => {});
      await vt.updateCallbackDone;
    } catch {
      if (corredor.value.id !== novo.id) aplicar();
    }
  } else aplicar();
  await motor.subir();
}

async function aoClicarPlaca(ev: MouseEvent): Promise<void> {
  const a = (ev.target as Element | null)?.closest?.<HTMLAnchorElement>("a[data-corredor-link]");
  if (!a || !cliqueInterno(ev)) return;
  ev.preventDefault();
  clearTimeout(espera);
  await trocarCorredor(corredorPorId(a.dataset.corredorLink ?? ""), { origem: { x: ev.clientX, y: ev.clientY }, push: true });
  buscarAgora(true);
}

async function aoNavegar(): Promise<void> {
  const novo = corredorDaUrl(location.pathname);
  const trocando = trocarCorredor(novo, { push: false });
  aplicarUrl();
  abertoDaqui.value = false;
  await trocando;
  if (!produto.value) buscarAgora(true);
}

onMounted(async () => {
  aplicarUrl();
  marcarPlacas(corredor.value.id);
  window.addEventListener("popstate", aoNavegar);
  document.addEventListener("click", aoClicarPlaca);
  await motor.subir();
  if (!produto.value) buscarAgora();
});
onBeforeUnmount(() => {
  window.removeEventListener("popstate", aoNavegar);
  document.removeEventListener("click", aoClicarPlaca);
  clearTimeout(espera);
});

// ---------------------------------------------------------------------------------------------
// textos

const termo = computed(() => {
  const q = b.buscada.value;
  return q && (q.modo === "texto" || q.modo === "marca") ? q.valor : null;
});

const titulo = computed(() => {
  const q = b.buscada.value;
  if (!q) return "";
  const [um, varios] = corredor.value.item;
  const itens = plural(b.total.value, um, varios);
  const primeiro = b.produtos.value[0] as { no_razao_social_empresa?: string } | undefined;
  if (q.modo === "cnpj" && primeiro?.no_razao_social_empresa) return `${itens} de ${legivel(primeiro.no_razao_social_empresa, "nome")}`;
  if (q.modo === "marca") return `${itens} da marca ${q.valor}`;
  if (q.modo === "texto") return `${itens} para “${q.valor}”`;
  if (q.modo === "todos") return `${itens} · ${corredor.value.grupo}: ${legivel(filtros.grupo)}`;
  return `${itens} · ${MODO_ROTULO[q.modo]}`;
});
</script>

<template>
  <CaixaBusca
    v-model="entrada"
    :consulta="b.consulta.value"
    :pronto="pronto"
    :placeholder="corredor.placeholder"
    :sugerir="fonte.sugerir"
    @confirmar="confirmar"
    @marca="(m) => buscarPor(m, true)"
    @empresa="(c) => buscarPor(fmtCnpj(c))"
  />

  <div v-if="motor.status.value === 'iniciando' || motor.status.value === 'baixando'" class="carregamento" role="status">
    <!-- um pote enchendo: o nível acompanha o download da tabela do corredor -->
    <svg class="pote-carregando" :class="{ indeterminado: motor.status.value === 'iniciando' }" viewBox="0 0 64 80" aria-hidden="true">
      <defs>
        <path id="pote-forma" d="M14 20h36a4 4 0 0 1 4 4v44a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V24a4 4 0 0 1 4-4Z" />
        <clipPath id="pote-dentro"><use href="#pote-forma" /></clipPath>
      </defs>
      <g clip-path="url(#pote-dentro)">
        <g class="nivel" :style="motor.status.value === 'baixando' ? { transform: `translateY(${76 - 58 * motor.progresso.value}px)` } : undefined">
          <path class="onda" d="M0 0q8-5 16 0t16 0 16 0 16 0 16 0 16 0V80H0Z" />
        </g>
      </g>
      <rect class="tampa" x="12" y="8" width="40" height="10" rx="3" />
      <use href="#pote-forma" class="contorno" />
      <rect class="etiqueta" x="17" y="40" width="30" height="15" rx="2" />
    </svg>
    <p>
      <strong v-if="motor.status.value === 'iniciando'">Abrindo o corredor {{ corredor.numero }}…</strong>
      <strong v-else>Enchendo o pote: {{ Math.round(motor.progresso.value * 100) }}% de {{ fmtBytes(motor.tamanho.value) }}</strong>
      <span class="muted">Os dados de {{ corredor.nome.toLowerCase() }} vêm da ANVISA só na primeira visita; depois ficam guardados no navegador.</span>
    </p>
  </div>
  <div v-else-if="motor.status.value === 'erro'" class="estado erro" role="alert">
    <p>Não foi possível abrir este corredor: {{ motor.erro.value }}</p>
    <button class="btn" type="button" @click="motor.subir().then(() => b.buscar(false, true))">Tentar de novo</button>
  </div>

  <component
    :is="telas.pagina"
    v-if="produto"
    :id="produto"
    :key="`${corredor.id}-${produto}`"
    @voltar="voltar"
    @empresa="(c: string) => buscarPor(fmtCnpj(c))"
  />

  <template v-else-if="b.consulta.value">
    <Facetas v-if="b.buscada.value" v-model="filtros" :contagens="b.contagens.value" :rotulo-grupo="corredor.grupo" />
    <p v-if="b.erro.value" class="estado erro" role="alert">Erro na busca: {{ b.erro.value }}</p>
    <template v-else-if="b.buscada.value">
      <h2 class="resultado-titulo" aria-live="polite">
        <template v-if="b.total.value">{{ titulo }}</template>
        <template v-else-if="!b.carregando.value">Nada encontrado em {{ corredor.nome.toLowerCase() }}</template>
      </h2>
      <div v-if="!b.total.value && !b.carregando.value" class="vazio">
        <Icone nome="pote" />
        <p v-if="filtros.situacao === 'ativo'">
          Só estão sendo mostrados os ativos.
          <a href="#" @click.prevent="filtros.situacao = 'todos'">Incluir os inativos</a>
        </p>
        <p v-if="filtros.grupo || filtros.tipo">
          <a href="#" @click.prevent="Object.assign(filtros, { grupo: '', tipo: '' })">Limpar os filtros</a>
        </p>
        <p class="note">Dica: busque por parte do nome, sem acento se preferir, ou cole o CNPJ ou o nº do processo.</p>
      </div>
      <div class="lista" :class="{ esmaecida: b.carregando.value }">
        <component
          :is="telas.cartao"
          v-for="(p, i) in b.produtos.value"
          :key="fonte.idDe(p)"
          :p="p"
          :termo="termo"
          :extra="b.extras.value.get(fonte.idDe(p))"
          :style="{ '--i': i % 30 }"
          @abrir="abrirProduto"
        />
      </div>
      <p v-if="b.temMais.value" class="mais">
        <button class="btn" type="button" :disabled="b.carregando.value" @click="b.buscar(true)">
          {{ b.carregando.value ? "Carregando…" : `Mostrar mais (${fmtInt(b.produtos.value.length)} de ${fmtInt(b.total.value)})` }}
        </button>
      </p>
    </template>
    <p v-else-if="pronto" class="estado" role="status">Buscando…</p>
  </template>

  <Inicio v-else :key="corredor.id" :corredor="corredor" :fonte="fonte" @exemplo="buscarPor" @grupo="explorar" />

  <p v-if="motor.fonte.value?.loaded_at" class="note fonte">
    Dados abertos da ANVISA de {{ fmtData(motor.fonte.value.loaded_at) }}
    (<a :href="motor.fonte.value.url">{{ motor.fonte.value.name }}</a>).
  </p>
</template>
