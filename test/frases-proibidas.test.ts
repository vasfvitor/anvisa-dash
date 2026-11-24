// The phrases of frases-proibidas.txt (the same list in the five health repos) never appear in the text this
// site renders. The check reads src/**/*.{astro,vue,ts,mjs}, not dist: the Vue islands render their text in the
// browser. This file is the same, byte for byte, in anvisa-hub, portal-saude and anvisa-dash.
//
// A source file becomes searchable text in three steps, each one keeping the length and the newlines, so a match
// offset maps to the right line:
// 1. What is not text is blanked. Script regions (a whole .ts/.mjs file, the .astro frontmatter, <script> blocks)
//    go through a small tokenizer that knows comments, '…', "…", `…${…}…` and regex literals: only the strings and
//    the template text stay (a `//` inside a string is text, "://" never opens a comment), so a constant named
//    HOJE is not a hit. Template regions (the rest of an .astro/.vue file) lose only <!-- … --> and {/* … */}; a
//    `//` there is text. <style> blocks are blanked whole: selectors and CSS are not text.
// 2. The seams that join one rendered sentence are blanked: Astro {" "}, HTML/Vue tags, and the "…" + "…" of a
//    string concatenation.
// 3. A literal phrase matches with any run of whitespace between its words, ignoring case; a "re:" line is used as
//    written. Both with the flags "giu".
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url);

interface Phrase {
  phrase: string;
  re: RegExp;
}

function loadPhrases(list: string): Phrase[] {
  return list
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => ({
      phrase: l,
      re: new RegExp(
        l.startsWith("re:")
          ? l.slice(3)
          : l
              .split(/\s+/)
              .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              .join("\\s+"),
        "giu",
      ),
    }));
}

/** Same length, same newlines, nothing else. */
const blank = (s: string): string => s.replace(/[^\n]/g, " ");

/** What may come right before a `/` that starts a regex literal (anything else makes it a division). */
const BEFORE_REGEX =
  /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\b(?:return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await))\s*$/;

/** Index just past the string literal that opens at `start`; an unterminated one stops at the line end. */
function endOfString(code: string, start: number): number {
  const quote = code.charAt(start);
  let i = start + 1;
  while (i < code.length) {
    const c = code.charAt(i);
    if (c === "\\") i += 2;
    else if (c === quote) return i + 1;
    else if (c === "\n") return i;
    else i++;
  }
  return code.length;
}

/** Index just past the regex literal that opens at `start`, or `start + 1` when the `/` is not one. */
function endOfRegex(code: string, start: number): number {
  let inClass = false;
  let i = start + 1;
  while (i < code.length) {
    const c = code.charAt(i);
    if (c === "\n") return start + 1;
    if (c === "\\") i += 2;
    else if (c === "/" && !inClass) {
      i++;
      while (/[a-z]/i.test(code.charAt(i))) i++;
      return i;
    } else {
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      i++;
    }
  }
  return start + 1;
}

/**
 * The text of script code: what its string and template literals say, plus the `+` between them; the rest (code,
 * comments, regex literals, the `${…}` of a template) is blanked. The tokenizer is what keeps a quote inside a
 * comment from opening a string, and a `//` inside a string from opening a comment.
 */
function scriptText(code: string): string {
  const keep: [number, number][] = [];
  const open: number[] = []; // for each `${` still open, the brace depth that closes it
  let braces = 0;
  let textStart = -1; // where the template text being read began, or -1 outside a template
  let i = 0;
  while (i < code.length) {
    const c = code.charAt(i);
    const next = code.charAt(i + 1);
    if (textStart >= 0) {
      if (c === "`") {
        keep.push([textStart, i + 1]);
        textStart = -1;
      } else if (c === "$" && next === "{") {
        keep.push([textStart, i]);
        textStart = -1;
        open.push(braces++);
        i++;
      }
      i += c === "\\" ? 2 : 1;
    } else if (c === "`") {
      textStart = i;
      i++;
    } else if (c === "{") {
      braces++;
      i++;
    } else if (c === "}") {
      braces--;
      i++;
      if (open.at(-1) === braces) {
        open.pop();
        textStart = i;
      }
    } else if (c === '"' || c === "'") {
      const end = endOfString(code, i);
      keep.push([i, end]);
      i = end;
    } else if (c === "+") {
      keep.push([i, i + 1]);
      i++;
    } else if (c === "/" && next === "/" && code.charAt(i - 1) !== ":") {
      const end = code.indexOf("\n", i);
      i = end < 0 ? code.length : end;
    } else if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      i = end < 0 ? code.length : end + 2;
    } else if (c === "/" && BEFORE_REGEX.test(code.slice(Math.max(0, i - 16), i))) i = endOfRegex(code, i);
    else i++;
  }
  if (textStart >= 0) keep.push([textStart, code.length]);
  let out = "";
  let at = 0;
  for (const [from, to] of keep) {
    out += blank(code.slice(at, from)) + code.slice(from, to);
    at = to;
  }
  return out + blank(code.slice(at));
}

/** Template text with its <!-- … --> and {/* … *\/} comments blanked; `//` there is text. */
const blankTemplateComments = (s: string): string => s.replace(/<!--[\s\S]*?-->|\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank);

/** <script> and <style> blocks of an .astro/.vue file; a self-closing <script … /> is not a block. */
const BLOCK = /(<(script|style)\b(?:[^>]*[^/>])?>)([\s\S]*?)(<\/\2\s*>)/gi;

/** The source reduced to its text, region by region (see the header). */
function sourceText(file: string, src: string): string {
  if (!/\.(astro|vue)$/.test(file)) return scriptText(src);
  let out = "";
  let at = 0;
  if (file.endsWith(".astro") && src.startsWith("---")) {
    const end = src.indexOf("\n---", 3);
    if (end >= 0) {
      out = `---${scriptText(src.slice(3, end))}`;
      at = end;
    }
  }
  BLOCK.lastIndex = at;
  for (let m = BLOCK.exec(src); m; m = BLOCK.exec(src)) {
    const [whole, openTag = "", tag = "", body = "", closeTag = ""] = m;
    const inside = tag.toLowerCase() === "script" ? scriptText(body) : blank(body);
    out += blankTemplateComments(src.slice(at, m.index)) + openTag + inside + closeTag;
    at = m.index + whole.length;
  }
  return out + blankTemplateComments(src.slice(at));
}

/** Astro {" "}, an HTML/Vue tag, or the `" + "` between two concatenated strings. */
const SEAMS = /\{\s*(["'`])\s*\1\s*\}|<\/?[A-Za-z][\w.:-]*(?:\s[^<>]*)?\/?>|["'`]\s*\+\s*["'`]/g;

/** `file:line: phrase` for every match in `src`, in line order. */
function findPhrases(file: string, src: string, phrases: Phrase[]): string[] {
  const text = sourceText(file, src).replace(SEAMS, blank);
  const hits: { line: number; hit: string }[] = [];
  for (const { phrase, re } of phrases) {
    for (const m of text.matchAll(re)) {
      const line = text.slice(0, m.index).split("\n").length;
      hits.push({ line, hit: `${file}:${String(line)}: ${phrase}` });
    }
  }
  return hits.sort((a, b) => a.line - b.line).map((h) => h.hit);
}

const PHRASES = loadPhrases(readFileSync(new URL("frases-proibidas.txt", ROOT), "utf-8"));
const SEM_PAIR = String.raw`re:\bsem\s+[^\s,]+,\s+sem\s+[^\s,]+`;

describe("frases proibidas", () => {
  it("loads the list, regexes included", () => {
    expect(PHRASES.length).toBeGreaterThan(20);
    expect(PHRASES.map((p) => p.phrase)).toContain(SEM_PAIR);
  });

  it("follows a phrase across line breaks, {' '}, tags and concatenation", () => {
    expect(findPhrases("x.astro", "<p>Arquivos republicados\n  diariamente.</p>", PHRASES)).toEqual([
      "x.astro:1: republicados diariamente",
      "x.astro:2: diariamente",
    ]);
    expect(findPhrases("x.astro", '<p>\n  Saiba{" "}\n  <a href="/sobre/">mais</a>\n</p>', PHRASES)).toEqual([
      "x.astro:2: saiba mais",
    ]);
    expect(findPhrases("x.vue", "<template><p>clique <strong>aqui</strong></p></template>", PHRASES)).toEqual([
      "x.vue:1: clique aqui",
    ]);
    expect(findPhrases("x.ts", 'const a =\n  "Sem cadastro, " +\n  "sem senha";', PHRASES)).toEqual([
      `x.ts:2: ${SEM_PAIR}`,
    ]);
    expect(findPhrases("x.ts", "const a = `sem cadastro,\n  sem senha`;", PHRASES)).toEqual([`x.ts:1: ${SEM_PAIR}`]);
    expect(findPhrases("x.ts", "const a = `Dados de ${dia}: sem alteração`;", PHRASES)).toEqual([
      "x.ts:1: sem alteração",
    ]);
  });

  it("reads strings as text and comments as comments", () => {
    expect(findPhrases("x.ts", 'const a = "veja // sem alteração";', PHRASES)).toEqual(["x.ts:1: sem alteração"]);
    expect(findPhrases("x.ts", "const a = 'b'; // sem alteração\n/* saiba\n mais */", PHRASES)).toEqual([]);
    expect(findPhrases("x.ts", 'const u = "https://x"; const v = "lista atual";', PHRASES)).toEqual([
      "x.ts:1: lista atual",
    ]);
    expect(findPhrases("x.ts", "const u = `https://x/${a}`; // saiba mais", PHRASES)).toEqual([]);
    expect(findPhrases("x.ts", "const r = /['\"]/g;\nconst s = 'só fatos';", PHRASES)).toEqual(["x.ts:2: só fatos"]);
    expect(
      findPhrases("x.ts", '// it\'s\nconst hoje = 1;\nconst s = `dia ${hoje}`;\nconst t = "só fatos";', PHRASES),
    ).toEqual(["x.ts:4: só fatos"]);
    expect(findPhrases("x.astro", "<p>a</p>\n<!-- saiba mais -->\n{/* clique aqui */}", PHRASES)).toEqual([]);
    expect(findPhrases("x.astro", "<p>veja https://x // lista atual</p>", PHRASES)).toEqual(["x.astro:1: lista atual"]);
  });

  it("splits an .astro/.vue file into frontmatter, template, <script> and <style>", () => {
    const astro = [
      "---",
      "// saiba mais",
      'const a = "só fatos"; // todo dia',
      "---",
      "<p>{a}</p>",
      "<script>",
      "  const b = 'clique aqui'; /* em tempo real */",
      "</script>",
      '<script type="application/ld+json" set:html={x} />',
      "<p>Atualizado hoje.</p>",
      "<style>",
      "  .hoje { color: red; } /* nada substitui */",
      "</style>",
    ].join("\n");
    expect(findPhrases("x.astro", astro, PHRASES)).toEqual([
      "x.astro:3: só fatos",
      "x.astro:7: clique aqui",
      String.raw`x.astro:10: re:\bhoje\b`,
    ]);
    const vue =
      '<script setup lang="ts">\n// lista atual\nconst a = "nada substitui";\n</script>\n<template>\n</template>';
    expect(findPhrases("x.vue", vue, PHRASES)).toEqual(["x.vue:3: nada substitui"]);
  });

  it("are absent from src/", () => {
    const files = readdirSync(new URL("src/", ROOT), { recursive: true, encoding: "utf-8" })
      .filter((f) => /\.(astro|vue|ts|mjs)$/.test(f))
      .sort();
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) =>
      findPhrases(`src/${f}`, readFileSync(new URL(`src/${f}`, ROOT), "utf-8"), PHRASES),
    );
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
