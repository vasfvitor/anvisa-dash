<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { fonte, precos, type Medicamento, type Preco } from "./fonte";
import { fmtCnpj, fmtData, fmtMesAno, fmtProcesso, fmtReais, fmtRegistro, url } from "../../lib/format";
import { CNPJ } from "../../lib/estatico/empresas";
import { notaTipo, SITUACAO, situacaoDe } from "../../lib/situacao";
import { legivel } from "../../lib/texto";
import PaginaProduto from "../../components/PaginaProduto.vue";
import Copiar from "../../components/Copiar.vue";
import AvisoMedidas from "../../components/AvisoMedidas.vue";
import Icone from "../../components/Icone.vue";
import { noApp, urlEmpresa } from "../../components/composables/useUrlState";
import { meta } from "./meta";

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ voltar: []; empresa: [cnpj: string]; titulo: [texto: string] }>();
const verEmpresa = (ev: MouseEvent, cnpj: string) => noApp(ev, () => emit("empresa", cnpj));

const p = shallowRef<Medicamento | null>(null);
const carregando = ref(true);
const erro = ref("");

// os preços da CMED chegam depois do produto (outra tabela, 2 MB): a seção aparece quando há
const lista = shallowRef<Preco[]>([]);
const precosErro = ref(false);

async function carregar(): Promise<void> {
  try {
    p.value = await fonte.porId(props.id);
  } catch (e) {
    erro.value = e instanceof Error ? e.message : String(e);
  } finally {
    carregando.value = false;
  }
  const registro = p.value?.registro_produto;
  if (!registro) return;
  try {
    lista.value = await precos(registro);
  } catch {
    precosErro.value = true; // a tabela cmed pode não estar no manifest; a página fica sem a seção
  }
}
void carregar();

const ativo = computed(() => p.value?.situacao_registro === "Ativo");
const sit = computed(() => situacaoDe(ativo.value));
const titulo = computed(() => (p.value ? legivel(p.value.nome, "nome") : ""));
const vencido = computed(() => {
  const v = p.value?.dt_vencimento;
  return Boolean(v && v < new Date().toISOString().slice(0, 10));
});
// a consulta oficial, com o registro já preenchido
const linkAnvisa = computed(() => {
  if (!p.value?.registro_produto) return "https://consultas.anvisa.gov.br/#/medicamentos/";
  return `https://consultas.anvisa.gov.br/#/medicamentos/q/?numeroRegistro=${p.value.registro_produto}`;
});
const publicadoEm = computed(() => lista.value[0]?.publicado_em ?? null);

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
          <span class="produto-tipo">{{ legivel(p.tipo_regularizacao) }} · {{ meta.item[0] }}</span>
        </div>
        <h1>{{ titulo }}</h1>
        <p v-if="p.principio_ativo" class="lead">{{ p.principio_ativo }}</p>
        <p class="produto-empresa">
          <Icone nome="fabrica" />
          {{ legivel(p.empresa, "nome") }} ·
          <a :href="urlEmpresa(p.cnpj)" title="Ver todos os remédios desta empresa" @click="verEmpresa($event, p.cnpj)">
            CNPJ {{ fmtCnpj(p.cnpj) }}
          </a>
          <template v-if="CNPJ.test(p.cnpj)"> · <a :href="url(`/empresa/${p.cnpj}/`)">Página da empresa</a> </template>
        </p>
      </header>

      <AvisoMedidas
        v-if="meta.tipoProduto"
        :tipo="meta.tipoProduto"
        :cnpj="p.cnpj"
        :registro="p.registro_produto"
        @empresa="(c: string) => emit('empresa', c)"
      />
      <div v-if="!ativo" class="aviso" role="note">
        <Icone nome="alerta" />
        <div>
          <strong>Liberação encerrada.</strong> {{ SITUACAO.inativo.aviso }} Se ainda está à venda, procure a versão
          nova pelo nome ou pelo princípio ativo.
        </div>
      </div>
      <div v-else-if="vencido" class="aviso" role="note">
        <Icone nome="alerta" />
        <div>
          <strong>A data de vencimento já passou</strong> ({{ fmtMesAno(p.dt_vencimento) }}), mas a ANVISA ainda lista o
          remédio como liberado. Confira na consulta oficial.
        </div>
      </div>

      <section v-if="lista.length" class="secao">
        <h2><Icone nome="etiqueta" />Preço máximo (CMED)</h2>
        <p class="note">
          Lista da CMED publicada em {{ fmtData(publicadoEm) }}. Preço fábrica (PF) e preço máximo ao consumidor (PMC)
          com ICMS de 18 %, a alíquota mais comum; a lista traz as outras.
        </p>
        <div class="table-wrap">
          <table class="precos">
            <thead>
              <tr>
                <th>Apresentação</th>
                <th>PF</th>
                <th>PMC</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="x in lista" :key="x.ggrem">
                <td>
                  <span class="linha">{{ x.apresentacao }}</span>
                  <span class="linha muted">
                    <template v-if="x.ean_1">EAN {{ x.ean_1 }} · </template>GGREM {{ x.ggrem }}
                    <template v-if="x.regime_preco"> · {{ x.regime_preco }}</template>
                    <template v-if="x.restricao_hospitalar"> · uso restrito a hospitais</template>
                  </span>
                </td>
                <td class="mono">{{ fmtReais(x.pf_18) }}</td>
                <td class="mono">{{ x.pmc_18 === null ? "—" : fmtReais(x.pmc_18) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          Apresentação com preço livre (regime “Liberado” na lista da CMED) não tem teto de PMC, só monitoramento.
          Apresentação de uso restrito a hospitais não tem PMC.
        </p>
      </section>

      <section class="secao tecnico">
        <h2><Icone nome="documento" />Dados técnicos</h2>
        <dl class="ficha">
          <template v-if="p.registro_produto">
            <dt>Nº do registro</dt>
            <dd>
              {{ fmtRegistro(p.registro_produto) }}
              <Copiar :valor="p.registro_produto" rotulo="nº do registro" />
              <span class="note">(os 9 primeiros dígitos do número da caixa)</span>
            </dd>
          </template>
          <template v-else>
            <dt>Nº do registro</dt>
            <dd><span class="note">A ANVISA não publica número de registro para este produto.</span></dd>
          </template>
          <template v-if="p.processo">
            <dt>Nº do processo</dt>
            <dd>{{ fmtProcesso(p.processo) }} <Copiar :valor="p.processo" rotulo="nº do processo" /></dd>
          </template>
          <dt>Empresa</dt>
          <dd>
            {{ p.empresa }} · {{ fmtCnpj(p.cnpj) }}
            <Copiar :valor="p.cnpj" rotulo="CNPJ" />
          </dd>
          <template v-if="p.principio_ativo">
            <dt>Princípio ativo</dt>
            <dd>{{ p.principio_ativo }}</dd>
          </template>
          <template v-if="p.classe_terapeutica">
            <dt>Classe terapêutica</dt>
            <dd>{{ legivel(p.classe_terapeutica) }}</dd>
          </template>
          <dt>{{ meta.rotuloTipo ?? "Tipo" }}</dt>
          <dd>
            {{ legivel(p.tipo_regularizacao) }}
            <span v-if="notaTipo(meta.tipos, p.tipo_regularizacao)" class="note">{{
              notaTipo(meta.tipos, p.tipo_regularizacao)
            }}</span>
          </dd>
          <dt>Situação</dt>
          <dd>
            {{ sit.tecnico }} <span class="note">({{ sit.dica }})</span>
          </dd>
          <template v-if="p.desde">
            <dt>Registro concedido em</dt>
            <dd>{{ fmtData(p.desde) }}</dd>
          </template>
          <template v-if="p.dt_vencimento">
            <dt>Vencimento</dt>
            <dd>{{ fmtMesAno(p.dt_vencimento) }} <span class="note">(a ANVISA publica só mês e ano)</span></dd>
          </template>
        </dl>
        <p>
          <button type="button" class="btn" @click="emit('empresa', p.cnpj)">
            <Icone nome="fabrica" /> Outros remédios desta empresa
          </button>
        </p>
      </section>
    </article>
  </PaginaProduto>
</template>
