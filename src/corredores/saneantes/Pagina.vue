<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { fonte, type Saneante } from "./fonte";
import { fmtCnpj, fmtData, fmtProcesso, url } from "../../lib/format";
import { CNPJ } from "../../lib/estatico/empresas";
import { notaTipo, SITUACAO, situacaoDe } from "../../lib/situacao";
import { legivel } from "../../lib/texto";
import { validade } from "../../lib/validade";
import PaginaProduto from "../../components/PaginaProduto.vue";
import Copiar from "../../components/Copiar.vue";
import AvisoMedidas from "../../components/AvisoMedidas.vue";
import Icone from "../../components/Icone.vue";
import { noApp, urlEmpresa } from "../../components/composables/useUrlState";
import { meta } from "./meta";

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ voltar: []; empresa: [cnpj: string]; titulo: [texto: string] }>();
/** o CNPJ é um link de verdade para a busca pela empresa; o clique simples busca sem recarregar */
const verEmpresa = (ev: MouseEvent, cnpj: string) => noApp(ev, () => emit("empresa", cnpj));

const p = shallowRef<Saneante | null>(null);
const carregando = ref(true);
const erro = ref("");
// o BuscaApp monta esta página de novo a cada produto (:key), então ela carrega uma vez só
async function carregar(): Promise<void> {
  try {
    p.value = await fonte.porId(props.id);
  } catch (e) {
    erro.value = e instanceof Error ? e.message : String(e);
  } finally {
    carregando.value = false;
  }
}
void carregar();

const ativo = computed(() => p.value?.situacao_registro === "Ativo");
const sit = computed(() => situacaoDe(ativo.value));
const notificado = computed(() => p.value?.tipo_regularizacao === "Notificado");
const val = computed(() => (p.value ? validade(p.value.grupo, p.value.dt_vencimento, ativo.value) : null));
// o nome do saneante costuma trazer a marca ("RAID ELÉTRICO LÍQUIDO JOHNSON"): iniciais maiúsculas
const titulo = computed(() => (p.value ? legivel(p.value.no_produto, "nome") : ""));

// a consulta da ANVISA separa os registrados ("produtos") dos isentos de registro ("notificados"). A página
// de detalhe abre pelo nº do processo, mas só para o que a ANVISA considera vigente: vencido ou encerrado dá
// "Erro inesperado" lá (conferido em 2026-10-09). Para esses, a consulta com o processo já preenchido.
const linkAnvisa = computed(() => {
  if (!p.value) return "";
  const lista = notificado.value ? "notificados" : "produtos";
  const processo = p.value.nu_processo;
  const vigente = ativo.value && p.value.grupo !== "Vencida";
  return `https://consultas.anvisa.gov.br/#/saneantes/${lista}/${vigente ? `${processo}/` : ""}?numeroProcesso=${processo}`;
});

watch(titulo, (t) => t && emit("titulo", t));
</script>

<template>
  <PaginaProduto
    :carregando="carregando"
    :erro="erro"
    :achou="!!p"
    :link-anvisa="linkAnvisa"
    :item="meta.item[0]"
    @voltar="emit('voltar')"
  >
    <article v-if="p">
      <header class="produto-cabecalho" :class="{ inativo: !ativo }">
        <div class="produto-status">
          <span class="situacao grande" :class="ativo ? 'ok' : 'off'" :title="sit.dica">{{ sit.longo }}</span>
          <span class="produto-tipo">{{ p.tipo_regularizacao }} · {{ meta.item[0] }}</span>
        </div>
        <h1>{{ titulo }}</h1>
        <p class="produto-empresa">
          <Icone nome="fabrica" />
          {{ legivel(p.no_razao_social_empresa, "nome") }} ·
          <a
            :href="urlEmpresa(p.nu_cnpj_empresa)"
            title="Ver todos os produtos de limpeza desta empresa"
            @click="verEmpresa($event, p.nu_cnpj_empresa)"
          >
            CNPJ {{ fmtCnpj(p.nu_cnpj_empresa) }}
          </a>
          <!-- a página estática da empresa: tudo dela num lugar, também sem JavaScript -->
          <template v-if="CNPJ.test(p.nu_cnpj_empresa)">
            · <a :href="url(`/empresa/${p.nu_cnpj_empresa}/`)">Página da empresa</a>
          </template>
        </p>
      </header>

      <AvisoMedidas
        v-if="meta.tipoProduto"
        :tipo="meta.tipoProduto"
        :cnpj="p.nu_cnpj_empresa"
        :registro="p.nu_registro_produto"
        @empresa="(c: string) => emit('empresa', c)"
      />
      <div v-if="!ativo" class="aviso" role="note">
        <Icone nome="alerta" />
        <div>
          <strong>Liberação encerrada.</strong> {{ SITUACAO.inativo.aviso }} Se ainda está à venda, procure a versão
          nova pelo nome ou pela empresa.
        </div>
      </div>

      <section v-if="val" class="secao">
        <h2><Icone nome="gota" />Até quando vale</h2>
        <div class="selos-validade">
          <span class="selo grande" :class="val.classe === 'neutro' ? '' : val.classe"
            ><Icone :nome="val.classe === 'perigo' ? 'alerta' : val.classe === 'ok' ? 'certo' : 'gota'" />{{
              val.curto
            }}</span
          >
        </div>
        <p v-if="val.estranha" class="note">Data como publicada pela ANVISA.</p>
        <p v-if="val.antiga" class="note">{{ val.dica }}</p>
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
          <dd>
            {{ p.no_razao_social_empresa }} · {{ fmtCnpj(p.nu_cnpj_empresa) }}
            <Copiar :valor="p.nu_cnpj_empresa" rotulo="CNPJ" />
          </dd>
          <dt>Categoria</dt>
          <dd>
            {{ meta.nome }} <span class="note">(na ANVISA: {{ meta.tecnico }})</span>
          </dd>
          <dt>Situação</dt>
          <dd>
            {{ sit.tecnico }} <span class="note">({{ sit.dica }})</span>
          </dd>
          <dt>{{ meta.rotuloTipo ?? "Tipo" }}</dt>
          <dd>
            {{ p.tipo_regularizacao }}
            <span v-if="notaTipo(meta.tipos, p.tipo_regularizacao)" class="note">{{
              notaTipo(meta.tipos, p.tipo_regularizacao)
            }}</span>
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
  </PaginaProduto>
</template>
