<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { detectar, MODO_ROTULO, type Consulta } from "../lib/detect";
import { fmtCnpj, fmtProcesso, plural } from "../lib/format";
import { sugerir, type Sugestao } from "../lib/queries";
import { legivel } from "../lib/texto";
import Destaque from "./Destaque.vue";
import Icone from "./Icone.vue";

const entrada = defineModel<string>({ required: true });
const props = defineProps<{ consulta: Consulta | null; pronto: boolean }>();
const emit = defineEmits<{ confirmar: []; marca: [rotulo: string]; empresa: [cnpj: string] }>();

const campo = ref<HTMLInputElement | null>(null);
const lista = shallowRef<Sugestao[]>([]);
const ativa = ref(-1);
const aberta = ref(false);
let espera: ReturnType<typeof setTimeout> | undefined;
let vez = 0;
// valor posto por uma escolha: não reabre sugestões para ele
let escolhido = "";

const aberto = computed(() => aberta.value && lista.value.length > 0);

watch([entrada, () => props.pronto], () => {
  clearTimeout(espera);
  const t = entrada.value;
  if (t === escolhido || detectar(t)?.modo !== "texto" || !props.pronto) {
    lista.value = [];
    return;
  }
  espera = setTimeout(async () => {
    const minha = ++vez;
    const r = await sugerir(t).catch(() => [] as Sugestao[]);
    if (minha !== vez) return;
    lista.value = r;
    ativa.value = -1;
  }, 120);
});

function escolher(s: Sugestao): void {
  aberta.value = false;
  if (s.tipo === "marca") {
    escolhido = s.rotulo;
    emit("marca", s.rotulo);
  } else if (s.nu_cnpj_empresa) {
    escolhido = fmtCnpj(s.nu_cnpj_empresa);
    emit("empresa", s.nu_cnpj_empresa);
  }
}

function tecla(ev: KeyboardEvent): void {
  if (ev.key === "ArrowDown" && lista.value.length) {
    ev.preventDefault();
    aberta.value = true;
    ativa.value = (ativa.value + 1) % lista.value.length;
  } else if (ev.key === "ArrowUp" && lista.value.length) {
    ev.preventDefault();
    aberta.value = true;
    ativa.value = ativa.value <= 0 ? lista.value.length - 1 : ativa.value - 1;
  } else if (ev.key === "Escape") {
    aberta.value = false;
  } else if (ev.key === "Enter" && aberto.value && ativa.value >= 0) {
    ev.preventDefault();
    escolher(lista.value[ativa.value]!);
  }
}

function enviar(): void {
  aberta.value = false;
  emit("confirmar");
}

// "/" em qualquer lugar da página foca a busca, como em muitos sites de consulta
function atalho(ev: KeyboardEvent): void {
  const alvo = ev.target as HTMLElement | null;
  if (ev.key !== "/" || alvo?.closest("input, textarea, select, [contenteditable]")) return;
  ev.preventDefault();
  campo.value?.focus();
  campo.value?.select();
}
onMounted(() => document.addEventListener("keydown", atalho));
onBeforeUnmount(() => {
  document.removeEventListener("keydown", atalho);
  clearTimeout(espera);
});

function lida(c: Consulta): string {
  if (c.modo === "cnpj") return `${MODO_ROTULO.cnpj} ${fmtCnpj(c.valor)}`;
  if (c.modo === "numero") return `${MODO_ROTULO.numero} ${fmtProcesso(c.valor)}`;
  if (c.modo === "marca") return `${MODO_ROTULO.marca} “${c.valor}”`;
  if (c.modo === "todos") return "Navegando pela categoria escolhida";
  return MODO_ROTULO.texto;
}
</script>

<template>
  <form class="busca" role="search" @submit.prevent="enviar">
    <div class="busca-campo">
      <label for="busca-q" class="sr-only">Buscar produto</label>
      <Icone nome="lupa" />
      <input
        id="busca-q"
        ref="campo"
        v-model="entrada"
        class="field"
        type="search"
        autocomplete="off"
        spellcheck="false"
        enterkeyhint="search"
        placeholder="Marca, produto ou CNPJ"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="busca-sugestoes"
        :aria-expanded="aberto"
        :aria-activedescendant="aberto && ativa >= 0 ? `sugestao-${ativa}` : undefined"
        @keydown="tecla"
        @input="aberta = true"
        @focus="aberta = true"
        @blur="aberta = false"
      />
      <ul v-show="aberto" id="busca-sugestoes" class="sugestoes" role="listbox" aria-label="Sugestões">
        <li
          v-for="(s, i) in lista"
          :id="`sugestao-${i}`"
          :key="`${s.tipo}-${s.rotulo}-${s.nu_cnpj_empresa}`"
          role="option"
          :aria-selected="i === ativa"
          :class="{ ativa: i === ativa }"
          @mousedown.prevent="escolher(s)"
          @mousemove="ativa = i"
        >
          <span class="sugestao-tipo" :class="s.tipo"><Icone :nome="s.tipo === 'marca' ? 'etiqueta' : 'fabrica'" /></span>
          <span class="sugestao-nome">
            <Destaque :texto="s.tipo === 'empresa' ? legivel(s.rotulo, 'nome') : s.rotulo" :termo="entrada" />
            <small>{{ s.tipo === "marca" ? "marca" : "empresa" }}</small>
          </span>
          <span class="sugestao-n">
            {{ s.ativos ? plural(s.ativos, "ativo") : plural(s.n, "inativo") }}
          </span>
        </li>
      </ul>
    </div>
    <button class="btn primary" type="submit" aria-label="Buscar"><Icone nome="seta" /><span>Buscar</span></button>
  </form>
  <p class="lida" aria-live="polite">
    <template v-if="consulta">Buscando por: <strong>{{ lida(consulta) }}</strong></template>
    <template v-else>Dica: aperte <kbd>/</kbd> para buscar de qualquer lugar.</template>
  </p>
</template>
