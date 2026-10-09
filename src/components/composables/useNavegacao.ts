// Troca de corredor sem recarregar e o voltar/avançar do navegador. As placas do cabeçalho são links de
// verdade (estáticos, fora da ilha, funcionam sem JavaScript); aqui o clique nelas vira uma troca animada.
import { nextTick, onBeforeUnmount, onMounted } from "vue";
import { corredorDaUrl, corredorPorId, type Corredor } from "../../corredores";
import type { Estado } from "./useEstado";
import { cliqueInterno } from "./useUrlState";

interface Acoes {
  /** o motor deixa de estar pronto (useCorredorPronto) */
  trocou(): void;
  /** prepara a fonte do corredor atual */
  subir(): Promise<void>;
  /** esquece a lista do corredor anterior */
  limpar(): void;
  buscar(forcar: boolean): void;
}

/** Marca a placa do corredor ativo no cabeçalho (estático, fora da ilha). */
function marcarPlacas(id: string): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-corredor-link]")) {
    if (a.dataset.corredorLink === id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

const reduzido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useNavegacao(estado: Estado, acoes: Acoes) {
  /**
   * Leva o termo e zera o resto (estado.entrarNo). Com View Transitions, a página nova aparece num círculo
   * que cresce a partir do clique, como a cor do corredor tomando conta. `depois` roda logo depois de
   * zerar, dentro da mesma atualização: o voltar/avançar aplica ali o estado da URL (a animação roda a
   * atualização mais tarde, então aplicar antes seria desfeito). Devolve se trocou.
   */
  async function trocar(
    novo: Corredor,
    opcoes: { origem?: { x: number; y: number }; push: boolean; depois?: () => void },
  ): Promise<boolean> {
    if (novo.id === estado.corredor.value.id) {
      opcoes.depois?.();
      return false;
    }
    const aplicar = () => {
      estado.entrarNo(novo);
      document.documentElement.dataset.corredor = novo.id;
      marcarPlacas(novo.id);
      acoes.trocou();
      acoes.limpar();
      opcoes.depois?.();
      if (opcoes.push) estado.gravar(true);
    };
    const h = document.documentElement;
    if ("startViewTransition" in document && !reduzido()) {
      const { x, y } = opcoes.origem ?? { x: innerWidth / 2, y: 0 };
      h.style.setProperty("--vt-x", `${x}px`);
      h.style.setProperty("--vt-y", `${y}px`);
      h.style.setProperty("--vt-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
      // A atualização roda depois de capturar a tela antiga (assíncrona): esperar por ela antes de preparar
      // a fonte nova. Se o navegador pular a animação (aba em segundo plano), ela roda do mesmo jeito.
      try {
        const vt = document.startViewTransition(() => {
          aplicar();
          return nextTick();
        });
        vt.ready.catch(() => {
          // animação pulada: a troca já aconteceu
        });
        await vt.updateCallbackDone;
      } catch {
        if (estado.corredor.value.id !== novo.id) aplicar();
      }
    } else aplicar();
    return true;
  }

  async function aoClicarPlaca(ev: MouseEvent): Promise<void> {
    const a = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>("a[data-corredor-link]") : null;
    if (!a || !cliqueInterno(ev)) return;
    ev.preventDefault();
    estado.cancelarDigitacao();
    const novo = corredorPorId(a.dataset.corredorLink ?? "");
    if (await trocar(novo, { origem: { x: ev.clientX, y: ev.clientY }, push: true })) await acoes.subir();
    acoes.buscar(true);
  }

  /** Voltar/avançar: o estado inteiro vem da URL, inclusive o corredor; nada é gravado no histórico. */
  async function aoNavegar(): Promise<void> {
    estado.cancelarDigitacao();
    const novo = corredorDaUrl(location.pathname);
    if (await trocar(novo, { push: false, depois: estado.lerDaUrl })) await acoes.subir();
    if (!estado.produto.value) acoes.buscar(true);
  }

  // ouvintes do DOM não esperam promessa: os erros já viram estado (motor e busca)
  const naNavegacao = () => void aoNavegar();
  const noClique = (ev: MouseEvent) => void aoClicarPlaca(ev);
  onMounted(() => {
    marcarPlacas(estado.corredor.value.id);
    window.addEventListener("popstate", naNavegacao);
    document.addEventListener("click", noClique);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("popstate", naNavegacao);
    document.removeEventListener("click", noClique);
  });
}
