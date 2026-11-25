// "Encontrou um erro?": the links that report a problem with a page, as a GitHub issue (the form
// .github/ISSUE_TEMPLATE/problema.yml, prefilled by query string) or as an e-mail. The wording is the same on the
// five health sites. The static pages (footer, company pages) get the HTML at build time; the Vue island builds it
// in the browser for the product view, where the page URL is only known at runtime.
import { RELATO_EMAIL, REPO } from "./config";
import { fmtProcesso } from "./format";

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
// the parts that are the same on every page, built once
const ISSUE = `${REPO}/issues/new?template=problema.yml`;
const MAILTO = `mailto:${RELATO_EMAIL}`;

/** The issue and e-mail links for a page. encodeURIComponent: spaces as %20, never "+". */
export function linksRelato({ pagina, item = "", titulo }: Relato): LinksRelato {
  const it = item.trim();
  const assunto = `Problema em ${it || titulo}`;
  // CRLF between lines, as RFC 6068 asks of a mailto body (encoded %0D%0A)
  const corpo = `Página: ${pagina}\r\nItem: ${it}\r\n\r\nO que está errado:\r\n\r\nO que a fonte oficial mostra (link):\r\n`;
  return {
    titulo: assunto,
    issue: `${ISSUE}&title=${enc(assunto)}&pagina=${enc(pagina)}${it ? `&item=${enc(it)}` : ""}`,
    email: `${MAILTO}?subject=${enc(assunto)}&body=${enc(corpo)}`,
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
    ? `Encontrou um erro? <a href="${attr(issue)}">Relato no GitHub</a> (público: não inclua dados pessoais) ou ` +
        `<a href="${attr(email)}">${RELATO_EMAIL}</a>.`
    : `Encontrou um erro? <a href="${attr(issue)}">Abra um relato no GitHub</a> (precisa de conta) ou ` +
        `<a href="${attr(email)}">escreva para ${RELATO_EMAIL}</a>. O relato no GitHub é público: não inclua dados pessoais.`;
}

/**
 * "Nome, registro 1.0090.0029": the product name and its number, already formatted with its label; without one,
 * the process number (raw, formatted here); without either, the name alone.
 */
export function itemProduto(
  nome: string,
  [rotulo, numero]: [rotulo: string, numero: string | null | undefined],
  processo: string | null | undefined,
): string {
  if (numero) return `${nome}, ${rotulo} ${numero}`;
  return processo ? `${nome}, processo ${fmtProcesso(processo)}` : nome;
}

/** The product view's address without the search state or a hash: the corridor path and ?p= only. */
export function paginaProduto(href: string): string {
  const u = new URL(href);
  const p = u.searchParams.get("p");
  return `${u.origin}${u.pathname}${p ? `?p=${enc(p)}` : ""}`;
}
