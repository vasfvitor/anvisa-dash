// Copiar para a área de transferência com um aviso que some sozinho (botões de copiar e compartilhar).
import { onBeforeUnmount, ref } from "vue";

export function useCopia(ms = 1600) {
  const copiado = ref(false);
  let espera: ReturnType<typeof setTimeout> | undefined;
  onBeforeUnmount(() => clearTimeout(espera));

  async function copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return; // sem permissão de área de transferência: o valor continua visível para copiar à mão
    }
    copiado.value = true;
    clearTimeout(espera);
    espera = setTimeout(() => (copiado.value = false), ms);
  }

  /** Compartilhamento do sistema quando existe (celular); senão copia o link da página. */
  async function compartilhar(): Promise<void> {
    if (!navigator.share) return copiar(location.href);
    try {
      await navigator.share({ title: document.title, url: location.href });
    } catch {
      // compartilhamento cancelado
    }
  }

  return { copiado, copiar, compartilhar };
}
