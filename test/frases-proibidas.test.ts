// The phrases in frases-proibidas.txt (same list in the five health repos) never appear in the text this
// site renders. Scans the source, not dist: the Vue island's text is rendered in the browser and is not in
// the built HTML. Comments are stripped first (they are Portuguese and may say "sem X, sem Y" legitimately).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..");

/** One pattern per line; "re:" is a regular expression, anything else a literal whose spaces match any whitespace. */
function padroes(lista: string): { frase: string; re: RegExp }[] {
  return lista
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const fonte = l.startsWith("re:")
        ? l.slice(3)
        : l
            .split(/\s+/)
            .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\s+");
      return { frase: l, re: new RegExp(fonte, "giu") };
    });
}

/** Blanks out comments, keeping every newline so match offsets map to the same line numbers. */
function semComentarios(s: string): string {
  const branco = (m: string) => m.replace(/[^\n]/g, " ");
  return s
    .replace(/\/\*[\s\S]*?\*\//g, branco)
    .replace(/<!--[\s\S]*?-->/g, branco)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_m, antes: string, c: string) => antes + branco(c));
}

/** `file:line: phrase` for every hit in `texto`. */
function achados(arquivo: string, texto: string, lista: { frase: string; re: RegExp }[]): string[] {
  const limpo = semComentarios(texto);
  const out: string[] = [];
  for (const { frase, re } of lista) {
    for (const m of limpo.matchAll(re)) {
      const linha = limpo.slice(0, m.index).split("\n").length;
      out.push(`${arquivo}:${linha}: ${frase}`);
    }
  }
  return out;
}

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(astro|vue|ts|mjs)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

const LISTA = padroes(readFileSync(join(RAIZ, "frases-proibidas.txt"), "utf8"));

describe("frases proibidas", () => {
  it("the list loads", () => {
    expect(LISTA.length).toBeGreaterThan(10);
  });

  it("no phrase from the list in src (strings and templates, comments excluded)", () => {
    const hits = arquivos(join(RAIZ, "src")).flatMap((f) => achados(relative(RAIZ, f), readFileSync(f, "utf8"), LISTA));
    expect(hits).toEqual([]);
  });

  it("catches a phrase in a string or template, across a line break, and not in a comment", () => {
    const fonte = [
      "// sem javascript, sem servidor (comment)",
      "const a = 'Sem cadastro, sem senha';",
      "<p>arquivos republicados",
      "  diariamente</p>",
      "<!-- clique aqui -->",
      "const u = 'https://x'; // saiba mais",
    ].join("\n");
    expect(achados("x.vue", fonte, LISTA)).toEqual([
      "x.vue:3: republicados diariamente",
      "x.vue:2: re:\\bsem [^\\s,]+, sem [^\\s,]+",
    ]);
  });
});
