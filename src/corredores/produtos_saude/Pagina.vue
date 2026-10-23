<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { fabricantesComPagina, fonte, type ProdutoSaude } from "./fonte";
import { slugFabricante } from "../../lib/chave";
import { fmtCnpj, fmtData, fmtProcesso, plural, url } from "../../lib/format";
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
const verEmpresa = (ev: MouseEvent, cnpj: string) => noApp(ev, () => emit("empresa", cnpj));

const p = shallowRef<ProdutoSaude | null>(null);
const carregando = ref(true);
const erro = ref("");
// um por fabricante: o nome sem o " (país)" do fim, o país e a chave na mesma posição (split cru, não fatiar: um
// item vazio desalinharia as três listas); sem as chaves (build de dados anterior), o texto como veio
const fabricantes = computed(() => {
  if (!p.value?.fabricantes) return [];
  const chaves = p.value.fabricantes_chaves.split("|");
  const paises = p.value.fabricantes_paises.split("|");
  return p.value.fabricantes
    .split("|")
    .map((texto, i) => {
      const chave = chaves[i] ?? "";
      const pais = chave ? paises[i] || null : null;
      const sufixo = pais ? ` (${pais})` : "";
      const nome = (sufixo && texto.endsWith(sufixo) ? texto.slice(0, -sufixo.length) : texto).trim();
      return { texto, nome, pais, chave, slug: chave ? slugFabricante(chave, pais) : "" };
    })
    .filter((f) => f.nome);
});
// os fabricantes com página e para quantas empresas fabricam, por slug: chegam depois do produto (outra tabela)
const paginas = shallowRef<Map<string, number>>(new Map());
async function carregar(): Promise<void> {
  try {
    p.value = await fonte.porId(props.id);
  } catch (e) {
    erro.value = e instanceof Error ? e.message : String(e);
  } finally {
    carregando.value = false;
  }
  // sem a tabela, ou se ela falhar, a lista fica sem links: não é motivo para erro na página
  paginas.value = await fabricantesComPagina(fabricantes.value.map((f) => f.chave)).catch(
    () => new Map<string, number>(),
  );
}
void carregar();

const ativo = computed(() => p.value?.situacao_registro === "Ativo");
const sit = computed(() => situacaoDe(ativo.value));
const cadastro = computed(() => p.value?.tipo_regularizacao === "Cadastrado");
const val = computed(() => (p.value ? validade(p.value.validade, p.value.dt_vencimento, ativo.value) : null));
const titulo = computed(() => (p.value ? legivel(p.value.nome, "nome") : ""));
// a consulta oficial de produtos para saúde, com o registro já preenchido
const linkAnvisa = computed(() =>
  p.value
    ? `https://consultas.anvisa.gov.br/#/saude/q/?numeroRegistro=${p.value.registro}`
    : "https://consultas.anvisa.gov.br/#/saude/",
);

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
          <span class="produto-tipo"
            >{{ p.tipo_regularizacao }} · {{ meta.item[0] }}{{ p.grupo ? ` · ${p.grupo}` : "" }}</span
          >
        </div>
        <h1>{{ titulo }}</h1>
        <p v-if="p.nome_tecnico" class="lead">{{ legivel(p.nome_tecnico) }}</p>
        <p class="produto-empresa">
          <Icone nome="fabrica" />
          {{ legivel(p.empresa, "nome") }} ·
          <a
            :href="urlEmpresa(p.cnpj)"
            title="Ver todos os dispositivos médicos desta empresa"
            @click="verEmpresa($event, p.cnpj)"
          >
            CNPJ {{ fmtCnpj(p.cnpj) }}
          </a>
          <template v-if="CNPJ.test(p.cnpj)"> · <a :href="url(`/empresa/${p.cnpj}/`)">Página da empresa</a> </template>
        </p>
      </header>

      <AvisoMedidas
        v-if="meta.tipoProduto"
        :tipo="meta.tipoProduto"
        :cnpj="p.cnpj"
        :registro="p.registro"
        @empresa="(c: string) => emit('empresa', c)"
      />
      <div v-if="!ativo" class="aviso" role="note">
        <Icone nome="alerta" />
        <div>
          <strong>Liberação encerrada.</strong> {{ SITUACAO.inativo.aviso }} Se ainda está à venda, procure a versão
          nova pelo nome ou pela empresa.
        </div>
      </div>

      <section v-if="val && !cadastro" class="secao">
        <h2><Icone nome="gota" />Até quando vale</h2>
        <div class="selos-validade">
          <span class="selo grande" :class="val.classe === 'neutro' ? '' : val.classe"
            ><Icone :nome="val.classe === 'perigo' ? 'alerta' : val.classe === 'ok' ? 'certo' : 'gota'" />{{
              val.curto
            }}</span
          >
        </div>
        <p v-if="val.antiga" class="note">{{ val.dica }}</p>
      </section>
      <section v-else class="secao">
        <h2><Icone nome="gota" />Até quando vale</h2>
        <p>Cadastro não tem data de vencimento: vale enquanto a ANVISA o mantiver liberado.</p>
      </section>

      <section v-if="fabricantes.length" class="secao">
        <h2><Icone nome="fabrica" />Fabricantes</h2>
        <ul>
          <li v-for="f in fabricantes" :key="f.texto">
            <a
              v-if="paginas.has(f.slug)"
              :href="url(`/fabricante/${f.slug}/`)"
              title="As empresas que registram dispositivos deste fabricante"
              >{{ legivel(f.nome, "nome") }}</a
            >
            <template v-else>{{ legivel(f.nome, "nome") }}</template>
            <span v-if="f.pais" class="muted"> · {{ legivel(f.pais, "nome") }}</span>
            <span v-if="paginas.has(f.slug)" class="muted">
              · fabrica para {{ plural(paginas.get(f.slug) ?? 0, "empresa") }}</span
            >
          </li>
        </ul>
        <p class="note">
          Quem responde pelo produto no Brasil é a empresa responsável pelo registro; o fabricante pode ser outro.
        </p>
      </section>

      <section class="secao tecnico">
        <h2><Icone nome="documento" />Dados técnicos</h2>
        <dl class="ficha">
          <dt>Nº do {{ cadastro ? "cadastro" : "registro" }}</dt>
          <dd>{{ p.registro }} <Copiar :valor="p.registro" rotulo="nº do registro" /></dd>
          <template v-if="p.processo">
            <dt>Nº do processo</dt>
            <dd>{{ fmtProcesso(p.processo) }} <Copiar :valor="p.processo" rotulo="nº do processo" /></dd>
          </template>
          <dt>Empresa</dt>
          <dd>
            {{ p.empresa }} · {{ fmtCnpj(p.cnpj) }}
            <Copiar :valor="p.cnpj" rotulo="CNPJ" />
          </dd>
          <template v-if="p.nome_tecnico">
            <dt>Nome técnico</dt>
            <dd>{{ legivel(p.nome_tecnico) }}</dd>
          </template>
          <template v-if="p.classe_risco">
            <dt>Classe de risco</dt>
            <dd>{{ p.classe_risco }} <span class="note">(de I, menor, a IV, maior)</span></dd>
          </template>
          <dt>{{ meta.rotuloTipo ?? "Tipo" }}</dt>
          <dd>
            {{ p.tipo_regularizacao }}
            <span v-if="notaTipo(meta.tipos, p.tipo_regularizacao)" class="note">{{
              notaTipo(meta.tipos, p.tipo_regularizacao)
            }}</span>
          </dd>
          <dt>Situação</dt>
          <dd>
            {{ sit.tecnico }} <span class="note">({{ sit.dica }})</span>
          </dd>
          <template v-if="p.publicacao">
            <dt>Publicação</dt>
            <dd>{{ fmtData(p.publicacao) }}</dd>
          </template>
          <template v-if="p.dt_vencimento">
            <dt>Vencimento</dt>
            <dd>{{ fmtData(p.dt_vencimento) }}</dd>
          </template>
        </dl>
        <p>
          <button type="button" class="btn" @click="emit('empresa', p.cnpj)">
            <Icone nome="fabrica" /> Outros dispositivos desta empresa
          </button>
        </p>
      </section>
    </article>
  </PaginaProduto>
</template>
