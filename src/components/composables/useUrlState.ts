// Estado na query string, para todo link reproduzir a mesma tela:
//   ?q=whey&cat=…&tipo=Notificado&sit=todos   busca (sit: ativo é o padrão e não aparece)
//   ?marca=LIQUID%20I.V.                      marca escolhida numa sugestão
//   ?p=3767776                                página de um produto
import type { Filtros, Situacao } from "../../lib/queries";

export interface EstadoUrl extends Filtros {
  q: string;
  marca: string;
  produto: number | null;
}

const SITUACOES: Situacao[] = ["ativo", "inativo", "todos"];

export function lerUrl(): EstadoUrl {
  const p = new URLSearchParams(location.search);
  const sit = p.get("sit") as Situacao | null;
  const id = Number(p.get("p"));
  return {
    q: p.get("q") ?? "",
    marca: p.get("marca") ?? "",
    categoria: p.get("cat") ?? "",
    tipo: p.get("tipo") ?? "",
    // inativos=1 é o formato antigo dos links compartilhados
    situacao: sit && SITUACOES.includes(sit) ? sit : p.get("inativos") === "1" ? "todos" : "ativo",
    produto: Number.isSafeInteger(id) && id > 0 ? id : null,
  };
}

export function montarUrl(e: Partial<EstadoUrl>): string {
  const p = new URLSearchParams();
  if (e.produto) p.set("p", String(e.produto));
  if (e.marca) p.set("marca", e.marca);
  else if (e.q?.trim()) p.set("q", e.q.trim());
  if (e.categoria) p.set("cat", e.categoria);
  if (e.tipo) p.set("tipo", e.tipo);
  if (e.situacao && e.situacao !== "ativo") p.set("sit", e.situacao);
  const qs = p.toString();
  return `${location.pathname}${qs ? `?${qs}` : ""}`;
}

/** `push` cria entrada no histórico (ação deliberada); sem ele só substitui (digitação). */
export function gravarUrl(e: Partial<EstadoUrl>, push = false): void {
  const alvo = montarUrl(e);
  if (alvo === `${location.pathname}${location.search}`) return;
  history[push ? "pushState" : "replaceState"](null, "", alvo);
}

/** Clique simples navega dentro do app; com Ctrl/Cmd/Shift/botão do meio deixa o navegador abrir aba. */
export function cliqueInterno(ev: MouseEvent): boolean {
  return ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey;
}
