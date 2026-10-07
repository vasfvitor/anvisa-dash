<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { fatiar, fmtCnpj, fmtData, fmtMesAno, fmtProcesso, marcas } from "../lib/format";
import { buscarApresentacoes, type Apresentacao, type Produto } from "../lib/queries";
import Detalhe from "./Detalhe.vue";

const props = defineProps<{ p: Produto }>();
const emit = defineEmits<{ buscar: [valor: string] }>();

const aberto = ref(false);
const carregando = ref(false);
const erro = ref("");
const apresentacoes = shallowRef<Apresentacao[] | null>(null);
const listaMarcas = computed(() => marcas(props.p.marcas));
const alegacoes = computed(() => fatiar(props.p.ds_alegacao_funcional, ";"));

// o detalhe só é buscado na primeira vez que a pessoa abre
async function alternar(e: Event): Promise<void> {
  aberto.value = (e.target as HTMLDetailsElement).open;
  if (!aberto.value || apresentacoes.value || carregando.value) return;
  carregando.value = true;
  erro.value = "";
  try {
    apresentacoes.value = await buscarApresentacoes(props.p);
  } catch (err) {
    erro.value = err instanceof Error ? err.message : String(err);
  } finally {
    carregando.value = false;
  }
}

function resumo(a: Apresentacao): string {
  return [a.ds_forma_fisica, fatiar(a.tipo_embalagens, "|")[0]?.replace(/^Primária - /, ""), a.validade]
    .filter(Boolean)
    .join(" · ");
}
</script>

<template>
  <article class="card produto">
    <h3>{{ p.no_produto }}</h3>
    <div v-if="listaMarcas.length" class="badges" aria-label="Marcas">
      <span v-for="m in listaMarcas" :key="m" class="badge">{{ m }}</span>
    </div>
    <div class="meta">
      <span>
        <b>{{ p.no_razao_social_empresa }}</b> ·
        <a href="#" title="Ver todos os produtos deste CNPJ" @click.prevent="emit('buscar', p.nu_cnpj_empresa)">{{ fmtCnpj(p.nu_cnpj_empresa) }}</a>
      </span>
      <span>Processo <b>{{ fmtProcesso(p.nu_processo) }}</b></span>
      <span v-if="p.nu_registro_notificacao_produto && p.nu_registro_notificacao_produto !== p.nu_processo">
        Registro <b>{{ p.nu_registro_notificacao_produto }}</b>
      </span>
    </div>
    <div class="meta">
      <span class="badge" :class="p.situacao_registro === 'Ativo' ? 'ok' : 'off'">{{ p.situacao_registro }}</span>
      <span>{{ p.tipo_regularizacao }}<template v-if="p.dt_regularizacao"> em {{ fmtData(p.dt_regularizacao) }}</template></span>
      <span v-if="p.dt_vencimento_registro">Vence {{ fmtMesAno(p.dt_vencimento_registro) }}</span>
      <span v-if="p.ds_categoria_produto">{{ p.ds_categoria_produto }}</span>
      <span v-if="p.ds_situacao_assunto_doc">Petição: {{ p.ds_situacao_assunto_doc }}</span>
    </div>
    <details v-if="alegacoes.length">
      <summary class="note">Alegações funcionais ({{ alegacoes.length }})</summary>
      <ul class="note"><li v-for="x in alegacoes" :key="x">{{ x }}</li></ul>
    </details>
    <details @toggle="alternar">
      <summary>Apresentações ({{ p.n_apresentacoes }})</summary>
      <p v-if="carregando" class="estado">Carregando apresentações…</p>
      <p v-else-if="erro" class="estado erro">Não foi possível carregar: {{ erro }}</p>
      <template v-else-if="apresentacoes">
        <p v-if="!apresentacoes.length" class="note">A ANVISA ainda não publicou o detalhe das apresentações deste produto.</p>
        <ul v-else class="apresentacoes">
          <li v-for="a in apresentacoes" :key="a.co_seq_apresentacao_produto">
            <details>
              <summary>
                <strong>Apresentação {{ a.nu_apresentacao_produto ?? "?" }}</strong>
                <span class="muted">{{ resumo(a) }}</span>
              </summary>
              <Detalhe :a="a" />
            </details>
          </li>
        </ul>
        <p v-if="apresentacoes.length && apresentacoes.length < p.n_apresentacoes" class="note">
          {{ p.n_apresentacoes - apresentacoes.length }} apresentação(ões) sem detalhe publicado pela ANVISA.
        </p>
      </template>
    </details>
  </article>
</template>
