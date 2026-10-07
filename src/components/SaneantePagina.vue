<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { saneantes, type Saneante } from "../lib/fontes/saneantes";
import { fmtCnpj, fmtData, fmtProcesso } from "../lib/format";
import { tituloPagina } from "../lib/marca";
import { situacaoDe } from "../lib/situacao";
import { legivel } from "../lib/texto";
import { validade } from "../lib/validade";
import { useCopia } from "./composables/useCopia";
import Copiar from "./Copiar.vue";
import Icone from "./Icone.vue";

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ voltar: []; empresa: [cnpj: string] }>();

const p = shallowRef<Saneante | null>(null);
const carregando = ref(true);
const erro = ref("");
const { copiado: compartilhado, compartilhar } = useCopia();
let vez = 0;

async function carregar(): Promise<void> {
  const minha = ++vez;
  carregando.value = true;
  erro.value = "";
  try {
    const s = await saneantes.porId(props.id);
    if (minha === vez) p.value = s;
  } catch (e) {
    if (minha === vez) erro.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (minha === vez) carregando.value = false;
  }
}
watch(() => props.id, carregar, { immediate: true });

const ativo = computed(() => p.value?.situacao_registro === "Ativo");
const notificado = computed(() => p.value?.tipo_regularizacao === "Notificado");
const val = computed(() => (p.value ? validade(p.value.grupo, p.value.dt_vencimento) : null));
// o nome do saneante costuma trazer a marca ("RAID ELÉTRICO LÍQUIDO JOHNSON"): iniciais maiúsculas
const titulo = computed(() => (p.value ? legivel(p.value.no_produto, "nome") : ""));

const tituloOriginal = document.title;
watch(titulo, (t) => t && (document.title = tituloPagina(t)));
onBeforeUnmount(() => (document.title = tituloOriginal));
</script>

<template>
  <div class="produto-pagina">
    <nav class="produto-nav">
      <button type="button" class="btn" @click="emit('voltar')"><Icone nome="volta" /> Voltar</button>
      <span v-if="p" class="produto-acoes">
        <button type="button" class="btn" @click="compartilhar">
          <Icone :nome="compartilhado ? 'certo' : 'compartilhar'" /> {{ compartilhado ? "Link copiado" : "Compartilhar" }}
        </button>
      </span>
    </nav>

    <p v-if="carregando" class="estado" role="status">Carregando produto…</p>
    <p v-else-if="erro" class="estado erro" role="alert">Não foi possível carregar o produto: {{ erro }}</p>
    <div v-else-if="!p" class="estado">
      <p>Produto não encontrado nos dados atuais.</p>
      <button type="button" class="btn" @click="emit('voltar')">Voltar à busca</button>
    </div>

    <article v-else>
      <header class="produto-cabecalho" :class="{ inativo: !ativo }">
        <div class="produto-status">
          <span class="situacao grande" :class="ativo ? 'ok' : 'off'" :title="situacaoDe(ativo).dica">{{ situacaoDe(ativo).longo }}</span>
          <span class="mono">{{ p.tipo_regularizacao }} · produto de limpeza</span>
        </div>
        <h1>{{ titulo }}</h1>
        <p class="produto-empresa">
          <Icone nome="fabrica" />
          {{ legivel(p.no_razao_social_empresa, "nome") }} ·
          <a href="#" title="Ver todos os produtos de limpeza desta empresa" @click.prevent="emit('empresa', p.nu_cnpj_empresa)">
            CNPJ {{ fmtCnpj(p.nu_cnpj_empresa) }}
          </a>
        </p>
      </header>

      <div v-if="!ativo" class="aviso" role="note">
        <Icone nome="alerta" />
        <div><strong>Liberação encerrada.</strong> A ANVISA não lista mais este produto como liberado (regularização
        inativa). Ele aparece aqui como histórico; se ainda está à venda, procure a versão atual pelo nome ou pela empresa.</div>
      </div>

      <section v-if="val" class="secao">
        <h2><Icone nome="gota" />Até quando vale</h2>
        <div class="selos-validade">
          <span class="selo grande" :class="val.classe === 'neutro' ? '' : val.classe"><Icone nome="gota" />{{ val.curto }}</span>
        </div>
        <p>{{ val.longo }}</p>
        <p v-if="val.estranha" class="note">A data parece fora do comum, mas é a que a ANVISA publica nos dados abertos.</p>
        <p v-if="ativo && val.classe === 'perigo'" class="note">
          A ANVISA ainda lista o produto como liberado, mas a data de vencimento já passou. Pode ser uma renovação em
          andamento ou um dado desatualizado; confira na consulta oficial.
        </p>
      </section>

      <section class="secao tecnico">
        <h2><Icone nome="documento" />Dados técnicos</h2>
        <dl class="ficha">
          <dt>Nº do processo</dt>
          <dd>{{ fmtProcesso(p.nu_processo) }} <Copiar :valor="p.nu_processo" rotulo="nº do processo" /></dd>
          <template v-if="p.nu_registro_produto">
            <dt>Nº do registro</dt>
            <dd>{{ p.nu_registro_produto }} <Copiar :valor="p.nu_registro_produto" rotulo="nº do registro" /></dd>
          </template>
          <dt>Expediente</dt>
          <dd>{{ p.nu_expediente }} <Copiar :valor="p.nu_expediente" rotulo="expediente" /></dd>
          <dt>Empresa</dt>
          <dd>{{ p.no_razao_social_empresa }} · {{ fmtCnpj(p.nu_cnpj_empresa) }} <Copiar :valor="p.nu_cnpj_empresa" rotulo="CNPJ" /></dd>
          <dt>Categoria</dt>
          <dd>Saneante <span class="note">(o nome técnico da ANVISA para produtos de limpeza, desinfecção e controle de pragas)</span></dd>
          <dt>Situação</dt>
          <dd>{{ ativo ? "Ativo" : "Inativo" }} <span class="note">(regularização {{ ativo ? "ativa" : "inativa" }} na ANVISA)</span></dd>
          <dt>Tipo</dt>
          <dd>
            {{ p.tipo_regularizacao }}
            <span class="note">
              {{ notificado ? "(comunicado à ANVISA, sem análise prévia de registro)" : "(registro concedido pela ANVISA após análise)" }}
            </span>
          </dd>
          <template v-if="p.dt_vencimento">
            <dt>Vencimento</dt>
            <dd>{{ fmtData(p.dt_vencimento) }}</dd>
          </template>
        </dl>
        <p>
          <button type="button" class="btn" @click="emit('empresa', p.nu_cnpj_empresa)">
            <Icone nome="fabrica" /> Outros produtos de limpeza desta empresa
          </button>
        </p>
      </section>
    </article>
  </div>
</template>
