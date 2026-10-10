<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { fonte, type Cosmetico } from "./fonte";
import { fmtCnpj, fmtData, fmtProcesso, url } from "../../lib/format";
import { CNPJ } from "../../lib/estatico/empresas";
import { situacaoDe } from "../../lib/situacao";
import { legivel } from "../../lib/texto";
import { validade } from "../../lib/validade";
import { useCopia } from "../../components/composables/useCopia";
import Copiar from "../../components/Copiar.vue";
import AvisoMedidas from "../../components/AvisoMedidas.vue";
import Icone from "../../components/Icone.vue";
import { noApp, urlEmpresa } from "../../components/composables/useUrlState";
import { meta } from "./meta";

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ voltar: []; empresa: [cnpj: string]; titulo: [texto: string] }>();
/** o CNPJ é um link de verdade para a busca pela empresa; o clique simples busca sem recarregar */
const verEmpresa = (ev: MouseEvent, cnpj: string) => noApp(ev, () => emit("empresa", cnpj));

const p = shallowRef<Cosmetico | null>(null);
const carregando = ref(true);
const erro = ref("");
const { copiado: compartilhado, compartilhar } = useCopia();
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
const registrado = computed(() => p.value?.tipo_regularizacao === "Registrado");
const val = computed(() => (p.value ? validade(p.value.grupo, p.value.dt_vencimento) : null));
const titulo = computed(() => (p.value ? legivel(p.value.no_produto, "nome") : ""));

const NOTA_TIPO: Record<string, string> = {
  Registrado: "(registro concedido pela ANVISA após análise)",
  Notificado: "(comunicado à ANVISA, sem análise prévia de registro)",
  "Isento de registro": "(comunicado à ANVISA, sem análise prévia de registro)",
};

// a consulta da ANVISA separa os registrados dos regularizados (notificados e isentos). Abre com o processo
// já preenchido; a página de detalhe de cada um não foi conferida (a consulta estava fora do ar em 2026-10-09)
const linkAnvisa = computed(() => {
  if (!p.value) return "";
  const lista = registrado.value ? "registrados" : "regularizados";
  return `https://consultas.anvisa.gov.br/#/cosmeticos/${lista}/?numeroProcesso=${p.value.nu_processo}`;
});

watch(titulo, (t) => t && emit("titulo", t));
</script>

<template>
  <div class="produto-pagina">
    <nav class="produto-nav">
      <button type="button" class="btn" @click="emit('voltar')"><Icone nome="volta" /> Voltar</button>
      <span v-if="p" class="produto-acoes">
        <button type="button" class="btn" @click="compartilhar">
          <Icone :nome="compartilhado ? 'certo' : 'compartilhar'" />
          {{ compartilhado ? "Link copiado" : "Compartilhar" }}
        </button>
        <a class="btn" :href="linkAnvisa" target="_blank" rel="noopener"><Icone nome="externo" /> Ver na ANVISA</a>
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
          <span class="situacao grande" :class="ativo ? 'ok' : 'off'" :title="sit.dica">{{ sit.longo }}</span>
          <span class="mono">{{ p.tipo_regularizacao }} · cosmético</span>
        </div>
        <h1>{{ titulo }}</h1>
        <p class="produto-empresa">
          <Icone nome="fabrica" />
          <template v-if="p.no_razao_social_empresa">{{ legivel(p.no_razao_social_empresa, "nome") }} · </template>
          <a
            :href="urlEmpresa(p.nu_cnpj_empresa)"
            title="Ver todos os cosméticos desta empresa"
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
        :registro="p.nu_registro"
        @empresa="(c: string) => emit('empresa', c)"
      />
      <div v-if="!ativo" class="aviso" role="note">
        <Icone nome="alerta" />
        <div>
          <strong>Liberação encerrada.</strong> Se ainda está à venda, procure a versão nova pelo nome ou pela empresa.
        </div>
      </div>

      <section v-if="val" class="secao">
        <h2><Icone nome="gota" />Até quando vale</h2>
        <div class="selos-validade">
          <span class="selo grande" :class="val.classe === 'neutro' ? '' : val.classe"
            ><Icone nome="gota" />{{ val.curto }}</span
          >
        </div>
        <p v-if="val.estranha" class="note">Data como publicada pela ANVISA.</p>
        <p v-if="ativo && val.classe === 'perigo'" class="note">
          A data já passou, mas a ANVISA ainda lista o produto como liberado. Confira na consulta oficial.
        </p>
      </section>

      <section class="secao tecnico">
        <h2><Icone nome="documento" />Dados técnicos</h2>
        <dl class="ficha">
          <dt>Nº do processo</dt>
          <dd>{{ fmtProcesso(p.nu_processo) }} <Copiar :valor="p.nu_processo" rotulo="nº do processo" /></dd>
          <template v-if="p.nu_registro">
            <dt>Nº do registro</dt>
            <dd>{{ p.nu_registro }} <Copiar :valor="p.nu_registro" rotulo="nº do registro" /></dd>
          </template>
          <dt>Empresa</dt>
          <dd>
            <template v-if="p.no_razao_social_empresa">{{ p.no_razao_social_empresa }} · </template
            >{{ fmtCnpj(p.nu_cnpj_empresa) }}
            <Copiar :valor="p.nu_cnpj_empresa" rotulo="CNPJ" />
          </dd>
          <dt>Categoria</dt>
          <dd>Cosmético, perfume ou produto de higiene pessoal</dd>
          <dt>Situação</dt>
          <dd>
            {{ sit.tecnico }} <span class="note">({{ sit.dica }})</span>
          </dd>
          <dt>Tipo</dt>
          <dd>
            {{ p.tipo_regularizacao }}
            <span v-if="NOTA_TIPO[p.tipo_regularizacao]" class="note">{{ NOTA_TIPO[p.tipo_regularizacao] }}</span>
          </dd>
          <template v-if="p.dt_vencimento">
            <dt>Vencimento</dt>
            <dd>{{ fmtData(p.dt_vencimento) }}</dd>
          </template>
        </dl>
        <p>
          <button type="button" class="btn" @click="emit('empresa', p.nu_cnpj_empresa)">
            <Icone nome="fabrica" /> Outros cosméticos desta empresa
          </button>
        </p>
      </section>
    </article>
  </div>
</template>
