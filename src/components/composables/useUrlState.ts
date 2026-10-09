// Estado na URL, para todo link reproduzir a mesma tela. O caminho escolhe o corredor (/ ou /limpeza/);
// a query string guarda a busca:
//   ?q=whey&cat=…&tipo=Notificado&sit=todos   busca (sit: ativo é o padrão e não aparece; cat é o grupo)
//   ?marca=LIQUID%20I.V.                      marca escolhida numa sugestão
//   ?p=3767776                                página de um produto (id da fonte do corredor)
import { FILTROS_PADRAO, type Filtros, type Situacao } from "../../lib/fonte";

export interface EstadoUrl extends Filtros {
  q: string;
  marca: string;
  produto: string | null;
}

const SITUACOES: Situacao[] = ["ativo", "inativo", "todos"];

export function lerUrl(search = location.search): EstadoUrl {
  const p = new URLSearchParams(search);
  const sit = p.get("sit") as Situacao | null;
  const id = p.get("p");
  return {
    q: p.get("q") ?? "",
    marca: p.get("marca") ?? "",
    grupo: p.get("cat") ?? "",
    tipo: p.get("tipo") ?? "",
    situacao: sit && SITUACOES.includes(sit) ? sit : FILTROS_PADRAO.situacao,
    // qualquer id vai para a página do produto; um que não existe (ou inválido) diz "não encontrado"
    produto: id?.trim() || null,
  };
}

/** URL do estado no caminho `rota` (o do corredor; por padrão, o atual). */
export function montarUrl(e: Partial<EstadoUrl>, rota = location.pathname): string {
  const p = new URLSearchParams();
  if (e.produto) p.set("p", e.produto);
  if (e.marca) p.set("marca", e.marca);
  else if (e.q?.trim()) p.set("q", e.q.trim());
  if (e.grupo) p.set("cat", e.grupo);
  if (e.tipo) p.set("tipo", e.tipo);
  if (e.situacao && e.situacao !== FILTROS_PADRAO.situacao) p.set("sit", e.situacao);
  const qs = p.toString();
  return `${rota}${qs ? `?${qs}` : ""}`;
}

/** `push` cria entrada no histórico (ação deliberada); sem ele só substitui (digitação). */
export function gravarUrl(e: Partial<EstadoUrl>, push = false, rota?: string): void {
  const alvo = montarUrl(e, rota);
  if (alvo === `${location.pathname}${location.search}`) return;
  history[push ? "pushState" : "replaceState"](null, "", alvo);
}

/** Clique simples navega dentro do app; com Ctrl/Cmd/Shift/botão do meio deixa o navegador abrir aba. */
export function cliqueInterno(ev: MouseEvent): boolean {
  return ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey;
}
