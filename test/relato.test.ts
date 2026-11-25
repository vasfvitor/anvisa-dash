// "Encontrou um erro?": the issue and e-mail links (encoding, the page address, an empty item) and the sentence as
// the pages render it, read back as text.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELATO_EMAIL, REPO } from "../src/lib/config";
import { itemProduto, linksRelato, paginaProduto, relatoHtml } from "../src/lib/relato";

const PAGINA = "https://contem.abelhaninja.de/empresa/12345678000190/";

/** The text a browser shows for the HTML: tags out, entities back, runs of whitespace as one space. */
const texto = (html: string): string =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The hrefs of the HTML, decoded as the browser would read the attribute. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) => (m[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));

describe("linksRelato", () => {
  it("prefills the issue form of this repo with the page, the item and the title", () => {
    const { issue, titulo } = linksRelato({
      pagina: PAGINA,
      item: "Drogaria São João & Cia (CNPJ 12.345.678/0001-90)",
      titulo: "não usado",
    });
    expect(titulo).toBe("Problema em Drogaria São João & Cia (CNPJ 12.345.678/0001-90)");
    const u = new URL(issue);
    expect(`${u.origin}${u.pathname}`).toBe(`${REPO}/issues/new`);
    expect(u.searchParams.get("template")).toBe("problema.yml");
    expect(u.searchParams.get("pagina")).toBe(PAGINA);
    expect(u.searchParams.get("item")).toBe("Drogaria São João & Cia (CNPJ 12.345.678/0001-90)");
    expect(u.searchParams.get("title")).toBe(titulo);
    // encodeURIComponent: accents as UTF-8, spaces as %20 (never "+"), "&" and "/" escaped inside a value
    expect(issue).toContain("item=Drogaria%20S%C3%A3o%20Jo%C3%A3o%20%26%20Cia%20(CNPJ%2012.345.678%2F0001-90)");
    expect(issue).not.toContain("+");
  });

  it("escapes '#' so the item does not become the fragment", () => {
    const { issue, email } = linksRelato({ pagina: PAGINA, item: "Creme #3, processo 1", titulo: "x" });
    expect(issue).not.toContain("#");
    expect(email).not.toContain("#");
    expect(new URL(issue).searchParams.get("item")).toBe("Creme #3, processo 1");
  });

  it("without an item: the title is the page's, no item field, and the e-mail body keeps an empty Item line", () => {
    const { issue, email, titulo } = linksRelato({ pagina: PAGINA, titulo: "Empresas na ANVISA" });
    expect(titulo).toBe("Problema em Empresas na ANVISA");
    expect(new URL(issue).searchParams.has("item")).toBe(false);
    expect(decodeURIComponent(email.split("&body=")[1] ?? "")).toContain(`Página: ${PAGINA}\r\nItem: \r\n`);
  });

  it("writes the e-mail to the configured address, subject = title, body with the page, the item and CRLF line breaks", () => {
    expect(RELATO_EMAIL).toBe("ajuda@abelhaninja.de");
    const { email, titulo } = linksRelato({ pagina: PAGINA, item: "Novalgina, registro 1.0090.0029", titulo: "x" });
    expect(email.startsWith(`mailto:${RELATO_EMAIL}?subject=`)).toBe(true);
    expect(email).not.toContain("+");
    expect(email).not.toContain("\n");
    // RFC 6068: a line break in a mailto body is CRLF, %0D%0A; never a bare %0A
    expect(email).toContain("%0D%0A");
    expect(email.replace(/%0D%0A/g, "")).not.toContain("%0A");
    const [, subject = "", body = ""] = /\?subject=([^&]*)&body=(.*)$/.exec(email) ?? [];
    expect(decodeURIComponent(subject)).toBe(titulo);
    expect(decodeURIComponent(body)).toBe(
      `Página: ${PAGINA}\r\nItem: Novalgina, registro 1.0090.0029\r\n\r\nO que está errado:\r\n\r\nO que a fonte oficial mostra (link):\r\n`,
    );
  });
});

describe("relatoHtml", () => {
  const r = { pagina: PAGINA, item: "Café & Cia, processo 25351.161029/2026-55", titulo: "x" };

  it("renders the full sentence after the data, one space between words", () => {
    expect(texto(relatoHtml(r))).toBe(
      "Encontrou um erro? Abra um relato no GitHub (precisa de conta) ou escreva para ajuda@abelhaninja.de. " +
        "O relato no GitHub é público: não inclua dados pessoais.",
    );
    expect(relatoHtml(r)).not.toContain("\n");
  });

  it("renders the footer form, saying the GitHub report is public, on one line", () => {
    const html = relatoHtml({ pagina: PAGINA, titulo: "Empresas" }, true);
    expect(texto(html)).toBe(
      "Encontrou um erro? Relato no GitHub (público: não inclua dados pessoais) ou ajuda@abelhaninja.de.",
    );
    expect(html).not.toContain("\n");
  });

  it("puts the two links in the hrefs, '&' escaped for HTML, the item never in the visible text", () => {
    const html = relatoHtml(r);
    const [issue, email] = hrefs(html);
    expect(issue).toBe(linksRelato(r).issue);
    expect(email).toBe(linksRelato(r).email);
    expect(html).not.toMatch(/&(?!amp;)/);
    expect(texto(html)).not.toContain("Café");
  });
});

describe("itemProduto", () => {
  it("names the product with its first number present", () => {
    expect(itemProduto("Novalgina", ["registro", "1.0090.0029"], ["processo", "25351.161029/2026-55"])).toBe(
      "Novalgina, registro 1.0090.0029",
    );
    expect(itemProduto("Sabão X", ["registro", ""], ["processo", "25351.161029/2026-55"])).toBe(
      "Sabão X, processo 25351.161029/2026-55",
    );
    expect(itemProduto("Sem número", ["registro", null])).toBe("Sem número");
  });
});

describe("paginaProduto", () => {
  it("keeps the corridor path and ?p=, drops the search state and the hash", () => {
    expect(paginaProduto("https://contem.abelhaninja.de/remedios/?p=123&q=dipirona#apresentacoes")).toBe(
      "https://contem.abelhaninja.de/remedios/?p=123",
    );
    expect(paginaProduto("https://contem.abelhaninja.de/?p=a%20b")).toBe("https://contem.abelhaninja.de/?p=a%20b");
    expect(paginaProduto("https://contem.abelhaninja.de/limpeza/")).toBe("https://contem.abelhaninja.de/limpeza/");
  });
});

// The components put the helper's HTML in as it is (set:html / v-html), so the text above is what they show; these
// check each place uses it with the right arguments.
describe("onde a frase aparece", () => {
  const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

  it("the footer of every page: the short form for the page, and the code link", () => {
    const base = ler("src/layouts/Base.astro");
    expect(base).toContain(
      'relatoHtml({ pagina: Astro.url.pathname.startsWith("/404") ? "" : canonico, titulo: title }, true)',
    );
    expect(base).toMatch(/<Fragment set:html=\{relato\} \/>/);
    expect(base).toMatch(/<a href=\{REPO\}>\s*Código do site\s*<\/a>/);
  });

  it("the company page: the full sentence with the name and CNPJ, after the last section", () => {
    const pagina = ler("src/pages/empresa/[cnpj].astro");
    expect(pagina).toContain("item: e.nome ? `${nome} (CNPJ ${fmtCnpj(e.cnpj)})` : nome");
    expect(pagina).toMatch(/<p class="note relato" set:html=\{relato\} \/>\s*<\/Base>/);
  });

  it("the device-maker page: the full sentence with the name and country, after the last section", () => {
    const pagina = ler("src/pages/fabricante/[slug].astro");
    expect(pagina).toContain("item: comPais");
    expect(pagina).toMatch(/<p class="note relato" set:html=\{relato\} \/>\s*<\/Base>/);
  });

  it("the product view: the full sentence after the corridor's sections, named by every corridor", () => {
    const frame = ler("src/components/PaginaProduto.vue");
    expect(frame).toMatch(/<slot \/>\s*(?:<!--.*?-->\s*)?<p class="note relato" v-html="relatoFrase" \/>/);
    expect(frame).toContain("paginaProduto(location.href)");
    for (const c of ["alimentos", "cosmeticos", "medicamentos", "produtos_saude", "saneantes"]) {
      const pagina = ler(`src/corredores/${c}/Pagina.vue`);
      expect(pagina, c).toContain(':relato="relato"');
      expect(pagina, c).toMatch(/itemProduto\(\s*titulo\.value,/);
    }
  });
});
