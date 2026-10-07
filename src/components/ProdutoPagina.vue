<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { resumirAlergia } from "../lib/alergia";
import { consenso, empresas, vazio } from "../lib/apresentacoes";
import { fatiar, fmtCnpj, fmtData, fmtMesAno, fmtProcesso, marcas, plural } from "../lib/format";
import { tituloPagina } from "../lib/marca";
import { ativo as estaAtivo, indeferido as foiIndeferido, marcaPrincipal } from "../lib/produto";
import { alimentos, buscarApresentacoes, type Apresentacao, type Produto } from "../lib/fontes/alimentos";
import { situacaoDe } from "../lib/situacao";
import { legivel } from "../lib/texto";
import { useCopia } from "./composables/useCopia";
import Copiar from "./Copiar.vue";
import Icone from "./Icone.vue";
import ResumoAlergia from "./ResumoAlergia.vue";

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ voltar: []; empresa: [cnpj: string] }>();

const p = shallowRef<Produto | null>(null);
const aps = shallowRef<Apresentacao[] | null>(null);
const carregando = ref(true);
const erro = ref("");
const todasMarcas = ref(false);
const { copiado: compartilhado, compartilhar } = useCopia();
let vez = 0;

async function carregar(): Promise<void> {
  const minha = ++vez;
  carregando.value = true;
  erro.value = "";
  aps.value = null;
  try {
    const produto = await alimentos.porId(props.id);
    if (minha !== vez) return;
    p.value = produto;
    carregando.value = false;
    // o detalhe pode exigir baixar a segunda tabela: o topo aparece antes
    if (produto) {
      const lista = await buscarApresentacoes(Number(props.id));
      if (minha === vez) aps.value = lista;
    }
  } catch (e) {
    if (minha === vez) erro.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (minha === vez) carregando.value = false;
  }
}
watch(() => props.id, carregar, { immediate: true });

const listaMarcas = computed(() => marcas(p.value?.marcas));
const titulo = computed(() => (p.value ? marcaPrincipal(p.value) : ""));
const ativo = computed(() => !!p.value && estaAtivo(p.value));
const indeferido = computed(() => !!p.value && foiIndeferido(p.value));
const notificado = computed(() => p.value?.tipo_regularizacao === "Notificado");

const tituloOriginal = document.title;
watch(titulo, (t) => t && (document.title = tituloPagina(t)));
onBeforeUnmount(() => (document.title = tituloOriginal));

const comDetalhe = computed(() => (aps.value ?? []).filter((a) => a.tem_detalhe));
const semDetalhe = computed(() => (aps.value ?? []).length - comDetalhe.value.length);
// o resumo sai das próprias apresentações, que trazem a tabela de detalhes junto
const resumo = computed(() =>
  aps.value ? resumirAlergia(comDetalhe.value.map((a) => a.alergenicos), comDetalhe.value.map((a) => a.intolerancias)) : null,
);

// formatadores dos campos de apresentação
const lista = (s: string) => fatiar(s, "|").map((x) => legivel(x).replace(/^./, (c) => c.toLowerCase())).join(", ");
/** "Primária - pote | Secundária - caixa" → "pote (primária), caixa (secundária)" */
const nivel = (s: string) =>
  fatiar(s, "|")
    .map((x) => {
      const [n, item] = x.split(" - ");
      return item ? `${legivel(item).toLowerCase()} (${n!.toLowerCase()})` : legivel(x).toLowerCase();
    })
    .join(", ");
const minusculo = (s: string) => legivel(s).toLowerCase();

type Campo = keyof Apresentacao;
interface DefCampo {
  campo: Campo;
  rotulo: string;
  fmt: (s: string) => string;
  /** curto cabe numa coluna da tabela; longo vai para o detalhe expansível */
  curto: boolean;
  /** entra em "Uso e embalagem" quando todas as apresentações concordam */
  naFicha: boolean;
}
const CAMPOS: DefCampo[] = [
  { campo: "ds_forma_fisica", rotulo: "Forma física", fmt: minusculo, curto: true, naFicha: true },
  { campo: "validade", rotulo: "Validade", fmt: minusculo, curto: true, naFicha: true },
  { campo: "grupos_populacionais", rotulo: "Público indicado", fmt: lista, curto: true, naFicha: true },
  { campo: "vias_administracao", rotulo: "Via de uso", fmt: lista, curto: true, naFicha: true },
  { campo: "tipo_embalagens", rotulo: "Embalagem", fmt: nivel, curto: true, naFicha: true },
  { campo: "material_embalagens", rotulo: "Material da embalagem", fmt: nivel, curto: true, naFicha: true },
  { campo: "situacao_apresentacao", rotulo: "Situação", fmt: minusculo, curto: true, naFicha: false },
  { campo: "tabela_nutricional", rotulo: "Ingredientes", fmt: legivel, curto: false, naFicha: false },
  { campo: "alergenicos", rotulo: "Alergênicos", fmt: legivel, curto: false, naFicha: false },
  { campo: "intolerancias", rotulo: "Glúten e lactose", fmt: legivel, curto: false, naFicha: false },
];
const valor = (c: DefCampo, v: unknown): string => (vazio(v) ? "—" : c.fmt(String(v)));
const SITUACAO = CAMPOS.find((c) => c.campo === "situacao_apresentacao")!;

const cons = computed(() => consenso(comDetalhe.value, CAMPOS.map((c) => c.campo)));
const usoComum = computed(() => CAMPOS.filter((c) => c.naFicha && cons.value.comum[c.campo] !== undefined));
const variamCurtos = computed(() => CAMPOS.filter((c) => c.curto && cons.value.variam.includes(c.campo)));
const variamLongos = computed(() => CAMPOS.filter((c) => !c.curto && cons.value.variam.includes(c.campo)));
// a situação de cada apresentação sempre aparece: como coluna própria se não estiver entre as que variam
const colunaSituacao = computed(() => !variamCurtos.value.includes(SITUACAO));

const ingredientes = computed(() => {
  const v = cons.value.comum.tabela_nutricional;
  return typeof v === "string" ? legivel(v) : "";
});
const alegacoes = computed(() => fatiar(p.value?.ds_alegacao_funcional, ";"));
const juntar = (campo: "empresas_envasadoras" | "empresas_internacionais") =>
  empresas(comDetalhe.value.map((a) => a[campo] ?? "").join(" | "));
const fabricacao = computed(() =>
  [
    { rotulo: "Envasado por", lista: juntar("empresas_envasadoras"), comCodigo: true },
    { rotulo: "Fabricantes no exterior", lista: juntar("empresas_internacionais"), comCodigo: false },
  ].filter((f) => f.lista.length),
);
const datas = computed(() =>
  p.value
    ? (
        [
          ["Regularização", p.value.dt_regularizacao],
          ["Publicação", p.value.dt_publicacao],
          ["Início da análise", p.value.dt_inicio_analise],
          ["Situação atual desde", p.value.dt_situacao],
        ] as const
      ).filter(([, d]) => d)
    : [],
);

const linkAnvisa = computed(() =>
  p.value ? `https://consultas.anvisa.gov.br/#/alimentos/${p.value.nu_processo}/?numeroProcesso=${p.value.nu_processo}` : "",
);
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
          <span class="situacao grande" :class="ativo ? 'ok' : 'off'" :title="situacaoDe(ativo).dica">{{ situacaoDe(ativo).longo }}</span>
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
        <div><strong>Liberação encerrada.</strong> A ANVISA não lista mais este produto como liberado (regularização
        inativa). Ele aparece aqui como histórico; se ainda está à venda, procure a versão atual pela marca ou pela empresa.</div>
      </div>

      <section v-if="resumo?.temDados || (resumo && ativo)" class="secao">
        <h2><Icone nome="trigo" />Glúten, lactose e alergênicos</h2>
        <ResumoAlergia v-if="resumo.temDados" :r="resumo" />
        <p v-else class="note">Sem informação de alergênicos nos dados abertos da ANVISA para este produto.</p>
      </section>

      <section v-if="ingredientes || cons.variam.includes('tabela_nutricional')" class="secao">
        <h2><Icone nome="folha" />Ingredientes</h2>
        <template v-if="ingredientes">
          <p class="ingredientes">{{ ingredientes }}</p>
          <p class="note">Como declarado à ANVISA; letras maiúsculas ajustadas para leitura.</p>
        </template>
        <p v-else>
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
            <dd>{{ valor(c, cons.comum[c.campo]) }}</dd>
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
                  <th v-if="colunaSituacao">Situação</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="a in aps" :key="a.co_seq_apresentacao_produto">
                  <tr>
                    <td>{{ a.nu_apresentacao_produto ?? "—" }}</td>
                    <td v-for="c in variamCurtos" :key="c.campo">{{ a.tem_detalhe ? valor(c, a[c.campo]) : "—" }}</td>
                    <td v-if="colunaSituacao">
                      {{ a.tem_detalhe ? valor(SITUACAO, a.situacao_apresentacao) : "detalhe não publicado" }}
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
                            <dd>{{ valor(c, a[c.campo]) }}</dd>
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
            {{ plural(semDetalhe, "apresentação", "apresentações") }} ainda sem detalhe nos dados abertos da ANVISA.
          </p>
        </template>
      </section>

      <section v-if="fabricacao.length" class="secao">
        <h2><Icone nome="fabrica" />Fabricação</h2>
        <dl class="ficha">
          <template v-for="f in fabricacao" :key="f.rotulo">
            <dt>{{ f.rotulo }}</dt>
            <dd>
              <ul class="empresas">
                <li v-for="e in f.lista" :key="e.nome + e.codigo">
                  {{ legivel(e.nome, "nome") }}<span v-if="e.local" class="muted"> · {{ legivel(e.local, "nome") }}</span>
                  <span v-if="f.comCodigo && e.codigo" class="muted"> · {{ e.codigo }}</span>
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
          <dt>Situação</dt>
          <dd>{{ ativo ? "Ativo" : "Inativo" }} <span class="note">(regularização {{ ativo ? "ativa" : "inativa" }} na ANVISA)</span></dd>
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
          <template v-for="[rotulo, data] in datas" :key="rotulo">
            <dt>{{ rotulo }}</dt>
            <dd>{{ fmtData(data) }}</dd>
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
