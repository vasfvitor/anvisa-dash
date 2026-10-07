<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { deJson, resumirAlergia } from "../lib/alergia";
import { consenso, empresas, vazio } from "../lib/apresentacoes";
import { fatiar, fmtCnpj, fmtData, fmtMesAno, fmtProcesso, marcas } from "../lib/format";
import { buscarApresentacoes, produtoPorId, type Apresentacao, type Produto } from "../lib/queries";
import { NOME } from "../lib/marca";
import { legivel } from "../lib/texto";
import Copiar from "./Copiar.vue";
import Icone from "./Icone.vue";
import ResumoAlergia from "./ResumoAlergia.vue";

const props = defineProps<{ id: number; versaoResumo: number }>();
const emit = defineEmits<{ voltar: []; empresa: [cnpj: string] }>();

const p = shallowRef<Produto | null>(null);
const aps = shallowRef<Apresentacao[] | null>(null);
const carregando = ref(true);
const erro = ref("");
const compartilhado = ref(false);
const todasMarcas = ref(false);

async function carregar(): Promise<void> {
  carregando.value = true;
  erro.value = "";
  aps.value = null;
  try {
    p.value = await produtoPorId(props.id);
    carregando.value = false;
    // o detalhe pode exigir baixar a segunda tabela: o topo aparece antes
    if (p.value) aps.value = await buscarApresentacoes(props.id);
  } catch (e) {
    erro.value = e instanceof Error ? e.message : String(e);
  } finally {
    carregando.value = false;
  }
}
watch(() => props.id, carregar, { immediate: true });
watch(() => props.versaoResumo, () => p.value && !aps.value && carregar());

const listaMarcas = computed(() => marcas(p.value?.marcas));
const titulo = computed(() => (p.value ? listaMarcas.value[0] ?? legivel(p.value.no_produto) : ""));
const ativo = computed(() => p.value?.situacao_registro === "Ativo");
const indeferido = computed(() => /indeferimento/i.test(p.value?.ds_situacao_assunto_doc ?? ""));
const notificado = computed(() => p.value?.tipo_regularizacao === "Notificado");

watch(titulo, (t) => {
  if (t) document.title = `${t} · ${NOME}.`;
});
const tituloOriginal = document.title;
onBeforeUnmount(() => (document.title = tituloOriginal));

const comDetalhe = computed(() => (aps.value ?? []).filter((a) => a.tem_detalhe));
const semDetalhe = computed(() => (aps.value ?? []).length - comDetalhe.value.length);

const resumo = computed(() => {
  if (aps.value) return resumirAlergia(comDetalhe.value.map((a) => a.alergenicos), comDetalhe.value.map((a) => a.intolerancias));
  if (p.value?.alergenicos_json) return resumirAlergia(deJson(p.value.alergenicos_json), deJson(p.value.intolerancias_json));
  return null;
});

type Campo = keyof Apresentacao;
const CAMPOS: { campo: Campo; rotulo: string; curto: boolean }[] = [
  { campo: "ds_forma_fisica", rotulo: "Forma física", curto: true },
  { campo: "validade", rotulo: "Validade", curto: true },
  { campo: "grupos_populacionais", rotulo: "Público indicado", curto: true },
  { campo: "vias_administracao", rotulo: "Via de uso", curto: true },
  { campo: "tipo_embalagens", rotulo: "Embalagem", curto: true },
  { campo: "material_embalagens", rotulo: "Material da embalagem", curto: true },
  { campo: "situacao_apresentacao", rotulo: "Situação", curto: true },
  { campo: "tabela_nutricional", rotulo: "Ingredientes", curto: false },
  { campo: "alergenicos", rotulo: "Alergênicos", curto: false },
  { campo: "intolerancias", rotulo: "Glúten e lactose", curto: false },
];
const cons = computed(() => consenso(comDetalhe.value, CAMPOS.map((c) => c.campo)));
const usoComum = computed(() =>
  CAMPOS.filter((c) => c.curto && c.campo !== "situacao_apresentacao" && cons.value.comum[c.campo] !== undefined),
);
const variamCurtos = computed(() => CAMPOS.filter((c) => c.curto && cons.value.variam.includes(c.campo)));
const variamLongos = computed(() => CAMPOS.filter((c) => !c.curto && cons.value.variam.includes(c.campo)));

/** "Primária - pote | Secundária - caixa" → "pote (primária), caixa (secundária)" */
function valor(campo: Campo, v: unknown): string {
  if (vazio(v)) return "—";
  const s = String(v);
  if (campo === "tipo_embalagens" || campo === "material_embalagens") {
    return fatiar(s, "|")
      .map((x) => {
        const [nivel, item] = x.split(" - ");
        return item ? `${legivel(item).toLowerCase()} (${nivel!.toLowerCase()})` : legivel(x).toLowerCase();
      })
      .join(", ");
  }
  if (campo === "grupos_populacionais" || campo === "vias_administracao") {
    return fatiar(s, "|").map((x) => legivel(x).replace(/^./, (c) => c.toLowerCase())).join(", ");
  }
  if (campo === "ds_forma_fisica" || campo === "situacao_apresentacao" || campo === "validade") return legivel(s).toLowerCase();
  return legivel(s);
}

const ingredientes = computed(() => {
  const v = cons.value.comum.tabela_nutricional;
  return typeof v === "string" ? legivel(v) : "";
});
const alegacoes = computed(() => fatiar(p.value?.ds_alegacao_funcional, ";"));
const envasadoras = computed(() => empresas(comDetalhe.value.map((a) => a.empresas_envasadoras ?? "").join(" | ")));
const exterior = computed(() => empresas(comDetalhe.value.map((a) => a.empresas_internacionais ?? "").join(" | ")));

const linkAnvisa = computed(() =>
  p.value ? `https://consultas.anvisa.gov.br/#/alimentos/${p.value.nu_processo}/?numeroProcesso=${p.value.nu_processo}` : "",
);

async function compartilhar(): Promise<void> {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: document.title, url });
    else {
      await navigator.clipboard.writeText(url);
      compartilhado.value = true;
      setTimeout(() => (compartilhado.value = false), 1800);
    }
  } catch {
    // compartilhamento cancelado
  }
}
</script>

<template>
  <div class="produto-pagina">
    <nav class="produto-nav">
      <button type="button" class="btn" @click="emit('voltar')"><Icone nome="volta" /> Voltar</button>
      <span class="produto-acoes" v-if="p">
        <button type="button" class="btn" @click="compartilhar">
          <Icone :nome="compartilhado ? 'certo' : 'compartilhar'" /> {{ compartilhado ? "Link copiado" : "Compartilhar" }}
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
          <span class="situacao grande" :class="ativo ? 'ok' : 'off'">{{ ativo ? "Ativo na ANVISA" : "Inativo na ANVISA" }}</span>
          <span class="mono">
            {{ p.tipo_regularizacao }}<template v-if="p.dt_regularizacao"> em {{ fmtData(p.dt_regularizacao) }}</template>
            <template v-if="!notificado && p.dt_vencimento_registro"> · válido até {{ fmtMesAno(p.dt_vencimento_registro) }}</template>
          </span>
        </div>
        <h1>{{ titulo }}</h1>
        <p v-if="listaMarcas.length > 1" class="outras-marcas">
          Também vendido como:
          {{ (todasMarcas ? listaMarcas.slice(1) : listaMarcas.slice(1, 9)).join(" · ") }}
          <button v-if="listaMarcas.length > 9" type="button" class="link" @click="todasMarcas = !todasMarcas">
            {{ todasMarcas ? "menos" : `e mais ${listaMarcas.length - 9}` }}
          </button>
        </p>
        <p class="produto-nome">
          {{ legivel(p.no_produto) }}<span v-if="p.ds_categoria_produto" class="muted"> · {{ legivel(p.ds_categoria_produto) }}</span>
        </p>
        <p class="produto-empresa">
          <Icone nome="fabrica" />
          {{ legivel(p.no_razao_social_empresa, "nome") }} ·
          <a href="#" @click.prevent="emit('empresa', p.nu_cnpj_empresa)" title="Ver todos os produtos desta empresa">
            CNPJ {{ fmtCnpj(p.nu_cnpj_empresa) }}
          </a>
        </p>
      </header>

      <div v-if="indeferido" class="aviso perigo" role="note">
        <Icone nome="alerta" />
        <div><strong>Petição indeferida.</strong> A ANVISA publicou o indeferimento do pedido deste produto
        (“{{ p.ds_situacao_assunto_doc }}”).</div>
      </div>
      <div v-else-if="!ativo" class="aviso" role="note">
        <Icone nome="alerta" />
        <div><strong>Regularização inativa.</strong> Este registro não está mais em vigor na ANVISA. Ele aparece aqui como
        histórico; procure a versão ativa do produto pela marca ou pela empresa.</div>
      </div>

      <section v-if="resumo?.temDados" class="secao">
        <h2><Icone nome="trigo" />Glúten, lactose e alergênicos</h2>
        <ResumoAlergia :r="resumo" />
      </section>
      <section v-else-if="aps && ativo" class="secao">
        <h2><Icone nome="trigo" />Glúten, lactose e alergênicos</h2>
        <p class="note">Sem informação de alergênicos nos dados abertos da ANVISA para este produto.</p>
      </section>

      <section v-if="ingredientes" class="secao">
        <h2><Icone nome="folha" />Ingredientes</h2>
        <p class="ingredientes">{{ ingredientes }}</p>
        <p class="note">Como declarado à ANVISA; letras maiúsculas ajustadas para leitura.</p>
      </section>
      <section v-else-if="cons.variam.includes('tabela_nutricional')" class="secao">
        <h2><Icone nome="folha" />Ingredientes</h2>
        <p>
          Os ingredientes mudam conforme a apresentação (por exemplo, sabores diferentes).
          <a href="#apresentacoes">Veja os de cada uma em “Apresentações”</a>.
        </p>
      </section>

      <section v-if="alegacoes.length" class="secao">
        <h2><Icone nome="brilho" />Alegações funcionais</h2>
        <ul class="alegacoes">
          <li v-for="a in alegacoes" :key="a"><Icone nome="certo" /><span>{{ a }}</span></li>
        </ul>
      </section>

      <section v-if="usoComum.length" class="secao">
        <h2><Icone nome="colher" />Uso e embalagem</h2>
        <dl class="ficha">
          <template v-for="c in usoComum" :key="c.campo">
            <dt>{{ c.rotulo }}</dt>
            <dd>{{ valor(c.campo, cons.comum[c.campo]) }}</dd>
          </template>
        </dl>
      </section>

      <section id="apresentacoes" class="secao">
        <h2><Icone nome="caixas" />Apresentações <span class="sub">{{ p.n_apresentacoes }}</span></h2>
        <p v-if="!aps" class="note" role="status">Carregando apresentações…</p>
        <template v-else>
          <p v-if="aps.length > 1 && !variamCurtos.length && !variamLongos.length" class="note">
            As {{ aps.length }} apresentações têm as mesmas informações{{ semDetalhe ? " publicadas" : "" }}.
          </p>
          <div class="table-wrap">
            <table class="apresentacoes-tabela">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th v-for="c in variamCurtos" :key="c.campo">{{ c.rotulo }}</th>
                  <th v-if="!variamCurtos.some((c) => c.campo === 'situacao_apresentacao')">Situação</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="a in aps" :key="a.co_seq_apresentacao_produto">
                  <tr>
                    <td>{{ a.nu_apresentacao_produto ?? "—" }}</td>
                    <td v-for="c in variamCurtos" :key="c.campo">{{ a.tem_detalhe ? valor(c.campo, a[c.campo]) : "—" }}</td>
                    <td v-if="!variamCurtos.some((c) => c.campo === 'situacao_apresentacao')">
                      {{ a.tem_detalhe ? valor("situacao_apresentacao", a.situacao_apresentacao) : "detalhe não publicado" }}
                    </td>
                    <td>
                      <template v-if="a.nu_registro">{{ a.nu_registro }} <Copiar :valor="a.nu_registro" rotulo="registro" /></template>
                      <template v-else>—</template>
                    </td>
                  </tr>
                  <tr v-if="a.tem_detalhe && variamLongos.length" class="linha-longa">
                    <td :colspan="variamCurtos.length + 3">
                      <details>
                        <summary>{{ variamLongos.map((c) => c.rotulo).join(", ") }} desta apresentação</summary>
                        <dl class="ficha">
                          <template v-for="c in variamLongos" :key="c.campo">
                            <dt>{{ c.rotulo }}</dt>
                            <dd>{{ valor(c.campo, a[c.campo]) }}</dd>
                          </template>
                        </dl>
                      </details>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <p v-if="semDetalhe" class="note">
            {{ semDetalhe }} apresentaç{{ semDetalhe === 1 ? "ão" : "ões" }} ainda sem detalhe nos dados abertos da ANVISA.
          </p>
        </template>
      </section>

      <section v-if="envasadoras.length || exterior.length" class="secao">
        <h2><Icone nome="fabrica" />Fabricação</h2>
        <dl class="ficha">
          <template v-if="envasadoras.length">
            <dt>Envasado por</dt>
            <dd>
              <ul class="empresas">
                <li v-for="e in envasadoras" :key="e.nome + e.codigo">
                  {{ legivel(e.nome, "nome") }}<span v-if="e.local" class="muted"> · {{ legivel(e.local, "nome") }}</span>
                  <span v-if="e.codigo" class="muted"> · {{ e.codigo }}</span>
                </li>
              </ul>
            </dd>
          </template>
          <template v-if="exterior.length">
            <dt>Fabricantes no exterior</dt>
            <dd>
              <ul class="empresas">
                <li v-for="e in exterior" :key="e.nome + e.codigo">
                  {{ legivel(e.nome, "nome") }}<span v-if="e.local" class="muted"> · {{ legivel(e.local, "nome") }}</span>
                </li>
              </ul>
            </dd>
          </template>
        </dl>
      </section>

      <section class="secao tecnico">
        <h2><Icone nome="documento" />Dados técnicos</h2>
        <dl class="ficha">
          <dt>Nº do processo</dt>
          <dd>{{ fmtProcesso(p.nu_processo) }} <Copiar :valor="p.nu_processo" rotulo="nº do processo" /></dd>
          <template v-if="p.nu_registro_notificacao_produto">
            <dt>{{ notificado ? "Nº da notificação" : "Nº do registro" }}</dt>
            <dd>
              {{ p.nu_registro_notificacao_produto }}
              <Copiar :valor="p.nu_registro_notificacao_produto" rotulo="número da regularização" />
            </dd>
          </template>
          <dt>Empresa</dt>
          <dd>{{ p.no_razao_social_empresa }} · {{ fmtCnpj(p.nu_cnpj_empresa) }} <Copiar :valor="p.nu_cnpj_empresa" rotulo="CNPJ" /></dd>
          <dt>Tipo</dt>
          <dd>
            {{ p.tipo_regularizacao }}
            <span class="note">
              {{
                notificado
                  ? "(comunicado à ANVISA; a categoria dispensa registro)"
                  : "(registro concedido pela ANVISA após análise)"
              }}
            </span>
          </dd>
          <template v-if="p.ds_situacao_assunto_doc">
            <dt>Situação da petição</dt>
            <dd>{{ p.ds_situacao_assunto_doc }}</dd>
          </template>
          <template v-if="p.dt_regularizacao">
            <dt>Regularização</dt>
            <dd>{{ fmtData(p.dt_regularizacao) }}</dd>
          </template>
          <template v-if="p.dt_publicacao">
            <dt>Publicação</dt>
            <dd>{{ fmtData(p.dt_publicacao) }}</dd>
          </template>
          <template v-if="p.dt_inicio_analise">
            <dt>Início da análise</dt>
            <dd>{{ fmtData(p.dt_inicio_analise) }}</dd>
          </template>
          <template v-if="p.dt_situacao">
            <dt>Situação atual desde</dt>
            <dd>{{ fmtData(p.dt_situacao) }}</dd>
          </template>
          <template v-if="p.dt_vencimento_registro">
            <dt>Vencimento</dt>
            <dd>
              {{ fmtMesAno(p.dt_vencimento_registro) }}
              <span v-if="notificado" class="note">(data padrão de todas as notificações nos dados da ANVISA)</span>
            </dd>
          </template>
          <dt>Código do produto</dt>
          <dd>{{ p.co_seq_produto }}</dd>
        </dl>
      </section>
    </article>
  </div>
</template>
