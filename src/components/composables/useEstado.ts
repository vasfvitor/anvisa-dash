// O estado da tela, espelhado na URL para todo link reproduzir a mesma tela. Na carga e no voltar/avançar
// a URL manda (lerDaUrl, sem gravar nada); no resto, as ações mudam o estado e gravam a URL: push nas
// escolhas deliberadas (Enter, filtro, produto), replace na digitação. Não há observadores sobre a
// entrada nem sobre os filtros: só as ações gravam e buscam, então aplicar a URL não volta para ela.
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { corredorDaUrl, rotaDo, type Corredor } from "../../lib/corredores";
import { detectar, type Consulta } from "../../lib/detect";
import { FILTROS_PADRAO, type Filtros } from "../../lib/fonte";
import { gravarUrl, lerUrl } from "./useUrlState";

/** `buscar` busca a consulta atual (quem chama sabe se o corredor está pronto); `forcar` refaz a mesma busca. */
export function useEstado(buscar: (forcar: boolean) => void) {
  const corredor = shallowRef<Corredor>(corredorDaUrl(location.pathname));
  const entrada = ref("");
  /** marca escolhida numa sugestão; digitar de novo a desfaz */
  const marca = ref("");
  /** sempre trocado inteiro (filtrar, lerDaUrl), nunca alterado por dentro */
  const filtros = shallowRef<Filtros>({ ...FILTROS_PADRAO });
  const produto = ref<string | null>(null);
  /** a página do produto foi aberta de dentro do app: "voltar" é o voltar do navegador */
  const abertoDaqui = ref(false);

  const consulta = computed<Consulta | null>(() => {
    if (marca.value) return { modo: "marca", valor: marca.value };
    // sem termo mas com um grupo escolhido: navegar por ele
    return detectar(entrada.value) ?? (filtros.value.grupo ? { modo: "todos", valor: "" } : null);
  });

  function gravar(push: boolean): void {
    const e = { q: entrada.value, marca: marca.value, ...filtros.value, produto: produto.value };
    gravarUrl(e, push, rotaDo(corredor.value));
  }

  let espera: ReturnType<typeof setTimeout> | undefined;
  function cancelarDigitacao(): void {
    clearTimeout(espera);
  }
  onBeforeUnmount(cancelarDigitacao);

  /** O que a pessoa digita na caixa: desfaz a marca escolhida; a busca espera a pausa e só substitui a URL. */
  function digitar(v: string): void {
    entrada.value = v;
    if (marca.value && v !== marca.value) marca.value = "";
    cancelarDigitacao();
    espera = setTimeout(() => {
      if (produto.value) return; // com um produto aberto, digitar não troca a tela
      gravar(false);
      buscar(false);
    }, 250);
  }

  function confirmar(): void {
    cancelarDigitacao();
    produto.value = null;
    gravar(true);
    buscar(true);
  }

  /** Busca escolhida por clique (sugestão, exemplo, empresa): põe o texto na caixa e busca já. */
  function buscarPor(texto: string, comoMarca = false): void {
    marca.value = comoMarca ? texto : "";
    entrada.value = texto;
    confirmar();
    window.scrollTo({ top: 0 });
  }

  /** Filtro é escolha deliberada: entra no histórico. */
  function filtrar(f: Filtros): void {
    filtros.value = f;
    gravar(true);
    buscar(false);
  }

  /** Navegar por um valor da terceira faceta, sem termo. */
  function explorar(grupo: string): void {
    cancelarDigitacao();
    marca.value = "";
    entrada.value = "";
    filtrar({ ...filtros.value, grupo });
  }

  function abrir(id: string): void {
    produto.value = id;
    abertoDaqui.value = true;
    gravar(true);
    window.scrollTo({ top: 0 });
  }

  function voltar(): void {
    if (abertoDaqui.value) {
      history.back();
      return;
    }
    produto.value = null;
    gravar(true);
    buscar(false);
  }

  /** O estado inteiro a partir da URL, sem gravar nem buscar (carga da página, voltar/avançar). */
  function lerDaUrl(): void {
    const e = lerUrl();
    marca.value = e.marca;
    entrada.value = e.marca || e.q;
    filtros.value = { grupo: e.grupo, tipo: e.tipo, situacao: e.situacao };
    produto.value = e.produto;
    abertoDaqui.value = false;
  }

  /** Outro corredor: o termo fica; marca, filtros e produto aberto são do corredor anterior. */
  function entrarNo(novo: Corredor): void {
    corredor.value = novo;
    marca.value = "";
    produto.value = null;
    abertoDaqui.value = false;
    filtros.value = { ...FILTROS_PADRAO };
  }

  return {
    corredor,
    entrada,
    filtros,
    produto,
    consulta,
    gravar,
    digitar,
    cancelarDigitacao,
    confirmar,
    buscarPor,
    filtrar,
    explorar,
    abrir,
    voltar,
    lerDaUrl,
    entrarNo,
  };
}

export type Estado = ReturnType<typeof useEstado>;
