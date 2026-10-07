// Estado da busca na query string (?q=&cat=&tipo=&inativos=1): um link copiado refaz a mesma busca.
import type { Filtros } from "../../lib/queries";

export interface EstadoUrl extends Filtros {
  q: string;
}

export function lerUrl(): EstadoUrl {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get("q") ?? "",
    categoria: p.get("cat") ?? "",
    tipo: p.get("tipo") ?? "",
    inativos: p.get("inativos") === "1",
  };
}

/** `push` cria entrada no histórico (busca confirmada); sem ele só substitui (digitação). */
export function gravarUrl(e: EstadoUrl, push = false): void {
  const p = new URLSearchParams();
  if (e.q.trim()) p.set("q", e.q.trim());
  if (e.categoria) p.set("cat", e.categoria);
  if (e.tipo) p.set("tipo", e.tipo);
  if (e.inativos) p.set("inativos", "1");
  const qs = p.toString();
  const alvo = `${location.pathname}${qs ? `?${qs}` : ""}`;
  if (alvo === `${location.pathname}${location.search}`) return;
  history[push ? "pushState" : "replaceState"](null, "", alvo);
}
