// "Encontrou um erro?": the links that report a problem with a page, as a GitHub issue (the form
// .github/ISSUE_TEMPLATE/problema.yml, prefilled by query string) or as an e-mail. The wording is the same on the
// five health sites. The static pages (footer, company pages) get the HTML at build time; the Vue island builds it
// in the browser for the product view, where the page URL is only known at runtime.
import { RELATO_EMAIL, REPO } from "./config";

export interface Relato {
  /** canonical absolute URL of the page */
  pagina: string;
  /** what the page is about, with its identifier ("Novalgina, registro 1.0090.0029"); empty when it is not one item */
  item?: string;
  /** the page title, used in the report's title when there is no item */
  titulo: string;
}

export interface LinksRelato {
  titulo: string;
  issue: string;
  email: string;
}

const enc = encodeURIComponent;

/** The issue and e-mail links for a page. encodeURIComponent: spaces as %20, never "+". */
export function linksRelato({ pagina, item = "", titulo }: Relato): LinksRelato {
  const assunto = `Problema em ${item.trim() || titulo}`;
  const campos: [string, string][] = [
    ["template", "problema.yml"],
    ["title", assunto],
    ["pagina", pagina],
  ];
  if (item.trim()) campos.push(["item", item.trim()]);
  const consulta = campos.map(([k, v]) => `${k}=${enc(v)}`).join("&");
  const corpo = `Página: ${pagina}\nItem: ${item.trim()}\n\nO que está errado:\n\nO que a fonte oficial mostra (link):\n`;
  return {
    titulo: assunto,
    issue: `${REPO}/issues/new?${consulta}`,
    email: `mailto:${RELATO_EMAIL}?subject=${enc(assunto)}&body=${enc(corpo)}`,
  };
}

/** For an href attribute: the links above are already URL-encoded, so only "&" (and, defensively, quotes) remain. */
const attr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * The sentence as HTML, one line, so no formatter can split it ("( x )"). `curto` is the footer form; the full
 * sentence goes after the data on the pages about one item.
 */
export function relatoHtml(r: Relato, curto = false): string {
  const { issue, email } = linksRelato(r);
  return curto
    ? `Encontrou um erro? <a href="${attr(issue)}">Relato no GitHub</a> ou <a href="${attr(email)}">${RELATO_EMAIL}</a>.`
    : `Encontrou um erro? <a href="${attr(issue)}">Abra um relato no GitHub</a> (precisa de conta) ou ` +
        `<a href="${attr(email)}">escreva para ${RELATO_EMAIL}</a>. O relato no GitHub é público: não inclua dados pessoais.`;
}

/** "Nome, registro 1.0090.0029": the product name and its first number present, in the order given. */
export function itemProduto(nome: string, ...numeros: [rotulo: string, valor: string | null | undefined][]): string {
  const n = numeros.find(([, v]) => v);
  return n ? `${nome}, ${n[0]} ${n[1]}` : nome;
}

/** The product view's address without the search state or a hash: the corridor path and ?p= only. */
export function paginaProduto(href: string): string {
  const u = new URL(href);
  const p = u.searchParams.get("p");
  return `${u.origin}${u.pathname}${p ? `?p=${enc(p)}` : ""}`;
}
