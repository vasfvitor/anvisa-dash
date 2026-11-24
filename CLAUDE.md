# anvisa-dash (contém.)

A static Astro site with one Vue island at `https://contem.abelhaninja.de`: lookup of products regularised
at ANVISA, searched in the browser with DuckDB-WASM over the Parquet that `vasfvitor/anvisa-api` publishes,
plus one static page per company and per device maker. `README.md` (Portuguese) explains the data, the
corridors, development and publishing; `RUNBOOK.md` every red run; a git-ignored `NOTES.local.md` holds
pending items when present.

## Facts to keep straight

- The app knows only the anvisa-api manifest (`src/lib/manifest.ts`, URL in `src/lib/config.ts`). A table's
  `source` is ANVISA's file for a raw table, but for a derived one (`alimentos_por_produto` and the other
  tables built by anvisa-api's `derivar.py`) it points at that script; the ANVISA files are behind its
  `fontes` (table names). Anything shown to the public resolves `fontes` down to the raw tables' `source`
  (name, URL, `loaded_at`), never stops at `derivar.py`. `loaded_at` is ANVISA's own `max(DT_CARGA_ETL)`,
  not our build date.
- Shared text has one home each: the footer and the source list in `src/layouts/Base.astro`; the product
  frame for the five corridors in `src/components/PaginaProduto.vue`; situation wording in
  `src/lib/situacao.ts` and `src/lib/validade.ts`; each corridor's prose in `src/corredores/*/Texto.astro`
  (pass computed totals and the data date in from `src/pages/[...corredor].astro` instead of typing them).
- The device `tipo` (Cadastrado/Registrado) is not shown: the data does not tie it to risk or expiry
  (decided 2026-11-03). Do not bring it back as a label or facet.
- Public text is pt-BR; code, comments, commit subjects and this file are English (the README is
  Portuguese, as it is for the user).
- Commands: `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm build` (downloads the
  manifest and Parquet). `DADOS_LIVE=<build dir> pnpm test` runs the derived-table checks on real data.

## Public text and data on a page

This section is the same in the five health site repos (anvisa-hub, anvisa-dash, portal-saude,
anvisa-feeds, ans): a change to it goes to all five in the same round. Rules only one site needs stay
outside it. Each rule below comes from a defect found on these sites in the 2026-11-24 audit.

Data:

- Every number, date, count and name of a source comes from the data at build time. A fact that cannot
  (a phone line's hours, a legal deadline) lives in one config entry with its source link and the date it
  was checked, and the page shows both. A sentence like "nenhum número é digitado à mão" stays only
  while it holds.
- Name the source where the value is shown: the publisher and the specific file, table or page, linked.
  "Dados da ANVISA" alone is not a source. A table we derive names the publisher's files it comes from,
  never only our own script. Every page that shows, compares or ranks data has its sources, not only the
  main pages.
- A value carries the date of its copy next to it, not only in a folded section: the source's own date
  (Last-Modified, publication or list date, said as such) and our collection date where they differ.
  "Atualizado em" or "dados de" alone is ambiguous: say whose date it is. A list's file date is not the
  publisher's list date unless the data says so.
- Freshness is read from the data, never promised. No fixed sentence about cadence ("o site é refeito
  todo dia", "mostra a nova em até um dia", "nos dias úteis por volta das 12h30", "republicados
  diariamente"): say the date of the copy shown. Static output never says "hoje", "agora", "atual" or
  "vigente"; it says the date.
- A source that failed or lags is named, with the date of the copy shown and the first day it failed,
  on the pages that use it and not on the others. A producer that records failures keeps the first
  failure day across runs (it is part of the contract). When the publisher is known to be ahead of the
  copy we read (a newer list on its own page), the page says so.
- A comparison says what it compares: "coleta de 23/11 contra a de 20/11", "lista de 09/10 contra a de
  09/09". A diff that spans a missed day says so.
- Missing is said in words ("a ANS não informou o valor de março de 2026"). Null is never shown as 0,
  "nada", an empty cell, a zero-height bar or a dropped row; null, 0 and "does not apply" are separate
  branches. An unknown or new category value never falls into the reassuring branch (a value other than
  "Sim" or "Não" is "não informado", not "sem glúten"), and a company's declaration is labelled as one.
- A value the site computes (a count, rate, ranking, threshold, classification, "típica") says how, once,
  next to it or behind one link. The rule is on the page, not only in a code comment. Our own
  transformations are said: the data is "como a ANVISA publica, convertida para Parquet; entradas e
  saídas calculadas aqui", never just "sem alteração".
- A known caveat of a field is stated where the field appears (a footnote marker is explained on the
  same screen) and in the dictionary when there is one.
- The raw data (our JSON or Parquet and the publisher's file) and the data's licence are one link away
  from every page that shows it. The code licence (MIT) is never given as the data's licence, in JSON-LD
  either.
- A failure to load data in the browser is said ("não foi possível carregar as medidas"), never left
  looking like "nenhuma medida".

Writing (public text is pt-BR, for people who do not know the jargon):

- Say what the data shows and stop. No filler intro ("Aqui você encontra", "Nesta página"), no heading
  repeated by the sentence under it, no closing summary, no definition given twice on a page.
- No stock phrases or slogans: "saiba mais", "clique aqui", "tudo o que você precisa", "simples assim",
  "só fatos", "na dúvida, confira", "de forma rápida e fácil", "respostas diretas", any "sem X, sem Y"
  pair, any run of three adjectives. A link says where it goes; never "fonte" or "aqui" alone.
- No praise of the site: "transparente", "completo", "confiável", "com a fonte de cada número". A
  property of the site is said once, on its about page, and only while every page meets it. A disclaimer
  ("não substitui a consulta oficial", "sem vínculo com a ANVISA") appears once per page, in the footer,
  with the official link.
- A general claim needs the data behind it: "todos", "sempre", "nunca", "costumam", "muitas", "com
  frequência" only when the build counts it. Absence from our copy is "não está na lista da ANVISA de
  {data}", never "não está liberado no Brasil".
- Explain a term once, plainly, as to an adult: abbreviations spelled out the first time (preço fábrica
  (PF)), no English where Portuguese exists ("coletas", not "snapshots"), no analogies or wordplay, no
  reassurance or advice not asked for, no vague hedge in place of a known fact ("às vezes demora" when
  the collection has failed since a date). No emojis.
- The phrases above that a test can match are in `frases-proibidas.txt` at the repo root (identical in
  the five repos), checked over the source strings by the phrase test; a new one goes in all five lists.

## Workflow

Commit when a unit of work is complete, one subject per commit, no attribution trailers. Commits are
SSH-signed, so `git commit` runs outside the sandbox: keep it as the only command on its line. Run
`git status --short` first and `git add` any new file the change needs. Pushing, Pages settings and
repository secrets are the user's.

`RUNBOOK.md` (Portuguese, for the user, not for an agent) explains every way a workflow here turns red.
Adding or changing an alarm or an error message means updating its entry in the same commit, quoting the
message exactly as the log prints it.
