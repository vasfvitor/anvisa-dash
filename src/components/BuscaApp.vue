<script setup lang="ts">
// A ilha da busca: só liga as peças. Estado e URL em useEstado, troca de corredor e voltar/avançar em
// useNavegacao, resultados em useBusca, motor e download em useCorredorPronto.
import { computed, onMounted, reactive, shallowRef, watch, watchEffect } from "vue";
import { MODO_ROTULO } from "../lib/detect";
import { CORREDORES, rotaDo } from "../corredores";
import { FONTES } from "../corredores/fontes";
import { fmtBytes, fmtCnpj, fmtInt, plural } from "../lib/format";
import { tituloPagina } from "../lib/marca";
import { palavrasDaBusca } from "../lib/palavras";
import { legivel } from "../lib/texto";
import CaixaBusca from "./CaixaBusca.vue";
import { useBusca } from "./composables/useBusca";
import { useCorredorPronto } from "./composables/useCorredorPronto";
import { useEstado } from "./composables/useEstado";
import { useMedidas } from "./composables/useMedidas";
import { useNavegacao } from "./composables/useNavegacao";
import { noApp } from "./composables/useUrlState";
import { TELAS } from "../corredores/telas";
import Facetas from "./Facetas.vue";
import Icone from "./Icone.vue";
import Inicio from "./Inicio.vue";
import MedidasBloco from "./MedidasBloco.vue";

const estado = useEstado(buscar);
const { corredor, entrada, filtros, produto, consulta } = estado;
const { digitar, confirmar, buscarPor, filtrar, explorar, abrir, voltar, urlCom } = estado;
const fonte = computed(() => FONTES[corredor.value.id]);
const telas = computed(() => TELAS[corredor.value.id]);
const motor = reactive(useCorredorPronto(corredor));
const b = reactive(useBusca(fonte));
const m = reactive(useMedidas());
const pronto = computed(() => motor.status === "pronto");

// todo caminho que busca passa por aqui (digitação, Enter, filtro, voltar, troca de corredor, carga)
function buscar(forcar: boolean): void {
  if (!pronto.value) return;
  const q = consulta.value;
  const lista = b.buscar(q, filtros.value, forcar);
  if (q?.modo !== "numero") {
    void m.buscar(corredor.value.tipoProduto, q);
    return;
  }
  // por número, as medidas também procuram pelo registro dos produtos achados: espera a lista
  void lista.then(() => {
    if (consulta.value !== q) return;
    const f = fonte.value;
    const registros = f.registroDe ? b.produtos.flatMap((p) => f.registroDe?.(p) ?? []) : [];
    void m.buscar(corredor.value.tipoProduto, q, registros);
  });
}

function limpar(): void {
  b.limpar();
  m.limpar();
  m.limparMarcas();
}

// cada página da lista (inclusive "mostrar mais") pergunta pelas empresas que ainda não conhece
watch(
  () => b.produtos,
  (lista) =>
    void m.marcar(
      corredor.value.tipoProduto,
      lista.map((p) => fonte.value.cnpjDe(p)),
    ),
);

useNavegacao(estado, { trocou: motor.trocou, subir: motor.subir, limpar, buscar });

// as medidas só aparecem junto da lista da mesma busca (não as de um termo novo sobre a lista antiga)
const medidasDaBusca = computed(() => m.itens.length > 0 && JSON.stringify(m.buscada) === JSON.stringify(b.buscada));
const semResultados = computed(() => !b.total && !b.carregando);
// nenhum liberado, mas há encerrados: o vazio diz quantos e oferece mostrá-los antes das medidas
const encerrados = computed(() =>
  semResultados.value && filtros.value.situacao === "ativo"
    ? (b.contagens.situacao.find((x) => x.valor === "Inativo")?.n ?? 0)
    : 0,
);

onMounted(async () => {
  estado.lerDaUrl();
  await motor.subir();
  if (!produto.value) buscar(false);
});

async function tentarDeNovo(): Promise<void> {
  await motor.subir();
  buscar(true);
}

// A página estática tem uma abertura que só faz sentido na tela inicial. O script inline do Base
// marca corredor e tela pela URL antes da primeira pintura; daqui em diante a ilha atualiza.
const tela = computed(() => (produto.value ? "produto" : consulta.value ? "busca" : "inicio"));
watch(tela, (t) => (document.documentElement.dataset.tela = t), { immediate: true });

// Título da aba: o do produto aberto quando a página dele já o informou; senão, o do corredor. A chave
// impede que o título de um produto apareça na página de outro enquanto ela carrega.
const chaveProduto = computed(() => (produto.value ? `${corredor.value.id}-${produto.value}` : ""));
const tituloProduto = shallowRef({ chave: "", texto: "" });
watchEffect(() => {
  const t = tituloProduto.value;
  const doProduto = chaveProduto.value && t.chave === chaveProduto.value ? t.texto : "";
  document.title = tituloPagina(doProduto || corredor.value.titulo);
});
function guardarTitulo(texto: string): void {
  tituloProduto.value = { chave: chaveProduto.value, texto };
}

// ---------------------------------------------------------------------------------------------
// textos

// poucos ou nenhum resultado: o produto pode estar noutro corredor (sabonete, álcool gel, protetor solar). Os
// links são data-corredor-link: o clique troca de corredor levando o termo (useNavegacao), sem contar antes
// (contar nos alimentos e na limpeza seria baixar a tabela inteira)
const POUCOS = 5;
const outros = computed(() => {
  const q = b.buscada;
  if (!q || b.carregando || b.erro || b.total > POUCOS) return [];
  if (q.modo !== "texto" && q.modo !== "marca" && q.modo !== "cnpj") return [];
  const termo = q.modo === "cnpj" ? fmtCnpj(q.valor) : q.valor;
  return CORREDORES.filter((c) => c.id !== corredor.value.id).map((c) => ({
    c,
    termo,
    href: `${rotaDo(c)}?${new URLSearchParams({ q: termo }).toString()}`,
  }));
});

// corredor que busca por palavra (os cosméticos): sem nenhuma do tamanho mínimo não há o que procurar
const semPalavra = computed(() => {
  const min = corredor.value.palavraMinima;
  const q = consulta.value;
  if (!min || !q) return false;
  return q.modo === "todos" || ((q.modo === "texto" || q.modo === "marca") && !palavrasDaBusca(q.valor, min).length);
});

// o que os cartões destacam: a frase buscada, ou cada palavra nos corredores que buscam por palavra
const termo = computed(() => {
  const q = b.buscada;
  if (!q || (q.modo !== "texto" && q.modo !== "marca")) return null;
  const min = corredor.value.palavraMinima;
  return min ? palavrasDaBusca(q.valor, min) : q.valor;
});

const titulo = computed(() => {
  const q = b.buscada;
  if (!q) return "";
  const [um, varios] = corredor.value.item;
  const itens = plural(b.total, um, varios);
  const primeiro = b.produtos[0] as { no_razao_social_empresa?: string } | undefined;
  if (q.modo === "cnpj" && primeiro?.no_razao_social_empresa)
    return `${itens} de ${legivel(primeiro.no_razao_social_empresa, "nome")}`;
  if (q.modo === "marca") return `${itens} da marca ${q.valor}`;
  if (q.modo === "texto") return `${itens} para “${q.valor}”`;
  if (q.modo === "todos") return `${itens} · ${corredor.value.grupo}: ${legivel(filtros.value.grupo)}`;
  return `${itens} · ${q.modo === "numero" ? (corredor.value.rotuloNumero ?? MODO_ROTULO.numero) : MODO_ROTULO[q.modo]}`;
});
</script>

<template>
  <CaixaBusca
    :model-value="entrada"
    :consulta="consulta"
    :pronto="pronto"
    :placeholder="corredor.placeholder"
    :rotulo-texto="corredor.rotuloTexto"
    :rotulo-numero="corredor.rotuloNumero"
    :sugerir="fonte.sugerir"
    @update:model-value="digitar"
    @confirmar="confirmar"
    @marca="(m) => buscarPor(m, true)"
    @empresa="(c) => buscarPor(fmtCnpj(c))"
  />

  <div v-if="motor.status === 'iniciando' || motor.status === 'baixando'" class="carregamento" role="status">
    <!-- um pote enchendo: o nível acompanha o download da tabela do corredor -->
    <svg
      class="pote-carregando"
      :class="{ indeterminado: motor.status === 'iniciando' }"
      viewBox="0 0 64 80"
      aria-hidden="true"
    >
      <defs>
        <path id="pote-forma" d="M14 20h36a4 4 0 0 1 4 4v44a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V24a4 4 0 0 1 4-4Z" />
        <clipPath id="pote-dentro"><use href="#pote-forma" /></clipPath>
      </defs>
      <g clip-path="url(#pote-dentro)">
        <g
          class="nivel"
          :style="motor.status === 'baixando' ? { transform: `translateY(${76 - 58 * motor.progresso}px)` } : undefined"
        >
          <path class="onda" d="M0 0q8-5 16 0t16 0 16 0 16 0 16 0 16 0V80H0Z" />
        </g>
      </g>
      <rect class="tampa" x="12" y="8" width="40" height="10" rx="3" />
      <use href="#pote-forma" class="contorno" />
      <rect class="etiqueta" x="17" y="40" width="30" height="15" rx="2" />
    </svg>
    <p>
      <strong v-if="motor.status === 'iniciando'">Carregando…</strong>
      <strong v-else
        >Baixando os dados ({{ Math.round(motor.progresso * 100) }}% de {{ fmtBytes(motor.tamanho) }})</strong
      >
    </p>
  </div>
  <div v-else-if="motor.status === 'erro'" class="estado erro" role="alert">
    <p>Não foi possível abrir este corredor: {{ motor.erro }}</p>
    <button class="btn" type="button" @click="tentarDeNovo">Tentar de novo</button>
  </div>

  <component
    :is="telas.pagina"
    v-if="produto"
    :id="produto"
    :key="`${corredor.id}-${produto}`"
    @voltar="voltar"
    @empresa="(c: string) => buscarPor(fmtCnpj(c))"
    @titulo="guardarTitulo"
  />

  <p v-else-if="consulta && semPalavra" class="estado" role="status">
    Digite ao menos {{ corredor.palavraMinima }} letras de uma palavra do nome.
  </p>

  <template v-else-if="consulta">
    <Facetas
      v-if="b.buscada"
      :model-value="filtros"
      :contagens="b.contagens"
      :rotulo-grupo="corredor.grupo"
      @update:model-value="filtrar"
    />
    <p v-if="b.erro" class="estado erro" role="alert">Erro na busca: {{ b.erro }}</p>
    <template v-else-if="b.buscada">
      <h2 class="resultado-titulo" aria-live="polite">
        <template v-if="b.total">{{ titulo }}</template>
        <template v-else-if="!b.carregando"
          >Nenhum {{ corredor.item[0] }} {{ encerrados ? "liberado" : "encontrado" }}</template
        >
      </h2>
      <p v-if="encerrados" class="encerrados">
        {{ plural(encerrados, "encerrado", "encerrados") }} com esta busca.
        <a
          :href="urlCom({ situacao: 'todos' })"
          @click="noApp($event, () => filtrar({ ...filtros, situacao: 'todos' }))"
          >Mostrar</a
        >
      </p>
      <p v-if="outros.length" class="outros-corredores">
        Procurar “{{ outros[0]!.termo }}” também em:
        <template v-for="(o, i) in outros" :key="o.c.id"
          >{{ i ? " · " : " " }}<a :href="o.href" :data-corredor-link="o.c.id">{{ o.c.nome }}</a></template
        >
      </p>
      <MedidasBloco
        v-if="medidasDaBusca && semResultados"
        :itens="m.itens"
        :total="m.total"
        :carregando="m.carregando"
        :tem-mais="m.temMais"
        @mais="m.mais()"
        @empresa="(c: string) => buscarPor(fmtCnpj(c))"
      />
      <div v-if="semResultados && (!encerrados || filtros.grupo || filtros.tipo)" class="vazio">
        <Icone nome="pote" />
        <p v-if="filtros.grupo || filtros.tipo">
          <a
            :href="urlCom({ grupo: '', tipo: '' })"
            @click="noApp($event, () => filtrar({ ...filtros, grupo: '', tipo: '' }))"
            >Limpar os filtros</a
          >
        </p>
        <!-- a dica (o que não passa pela ANVISA) é para quando nada foi achado, nem entre os encerrados -->
        <p v-if="!encerrados" class="note">{{ corredor.dica }}</p>
      </div>
      <div class="lista" :class="{ esmaecida: b.carregando }">
        <component
          :is="telas.cartao"
          v-for="(p, i) in b.produtos"
          :key="fonte.idDe(p)"
          :p="p"
          :termo="termo"
          :extra="b.extras.get(fonte.idDe(p))"
          :medidas="m.porEmpresa.get(fonte.cnpjDe(p) ?? '')"
          :style="{ '--i': i % 30 }"
          @abrir="abrir"
        />
      </div>
      <p v-if="b.temMais" class="mais">
        <button class="btn" type="button" :disabled="b.carregando" @click="b.mais()">
          {{ b.carregando ? "Carregando…" : `Mostrar mais (${fmtInt(b.produtos.length)} de ${fmtInt(b.total)})` }}
        </button>
      </p>
      <MedidasBloco
        v-if="medidasDaBusca && !semResultados"
        :itens="m.itens"
        :total="m.total"
        :carregando="m.carregando"
        :tem-mais="m.temMais"
        @mais="m.mais()"
        @empresa="(c: string) => buscarPor(fmtCnpj(c))"
      />
    </template>
    <p v-else-if="pronto" class="estado" role="status">Buscando…</p>
  </template>

  <Inicio
    v-else
    :key="corredor.id"
    :corredor="corredor"
    :fonte="fonte"
    :pronto="pronto"
    @exemplo="buscarPor"
    @grupo="explorar"
  />
</template>
