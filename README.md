# contém.

Consulta de produtos regularizados na ANVISA (alimentos e suplementos; produtos de limpeza, os saneantes) por nº do processo,
CNPJ, registro, nome, marca, empresa e categoria. Site estático (Astro + uma ilha Vue). A busca roda no navegador
com DuckDB-WASM sobre os Parquet que o repo [`anvisa`](https://github.com/vasfvitor/anvisa-api)
publica diariamente. Não há backend.

## Dados

O app só conhece o manifest (`src/lib/config.ts`). Os caminhos dos Parquet vêm dele e mudam a cada
build. Cada tabela do manifest vira uma view no DuckDB, e o dicionário (`/dicionario/`) é gerado do
manifest no build. Tabela nova aparece nos dois sem mudar código.

Coisas medidas que o código assume (build de 2026-10-06):

- **Processo nem sempre tem 17 dígitos.** 44% das linhas têm 13 (processos antigos), 400 têm 14 (o
  tamanho de um CNPJ) e há de 6 a 16. Por isso só 14 dígitos são tratados como CNPJ, e um CNPJ sem
  resultado é tentado de novo como processo. Os demais números procuram em `nu_processo`,
  `nu_registro_notificacao_produto` (registro, 9 dígitos) e `nu_registro` (apresentação, 13).
- **O worker do DuckDB não faz HTTP.** As tabelas são baixadas inteiras com `fetch()` na página,
  registradas com `registerFileBuffer` e expostas como views (`src/lib/db.ts`). Com
  duckdb-wasm 1.33.1-dev57.0, o HTTP do worker (XHR síncrono, com Range) falhou de três jeitos:
  por padrão baixa o arquivo inteiro; o GitHub Pages responde HEAD com Range usando 200, o que
  derruba o modo `reliableHeadRequests`; e o Firefox falha no GET com Range contra o Pages
  ("NetworkError"), enquanto o Chrome funciona. Por Range, uma busca por texto ainda relia pedaços
  e passava do tamanho do arquivo (5,3 MB para 3,25 MB). Os arquivos são pequenos (3,25 e 1,5 MB)
  e os caminhos são imutáveis, então um download por build, com cache HTTP, é mais simples e mais
  barato.
- Nome, marcas, empresa, processo e situação são iguais em todas as apresentações de um produto. A
  busca agrupa por `co_seq_produto` numa consulta só.
- 94 apresentações ativas (recentes) ainda não têm linha em `alimentos_resultado`. A interface avisa.

## Corredores

Cada fonte de dados é um corredor: `/` (alimentos e suplementos) e `/limpeza/` (saneantes). Os textos falam a língua de quem compra (liberado, encerrado, limpeza); o termo técnico
fica no hover e nos dados técnicos. Para criar outro:

1. uma entrada em `src/lib/corredores.ts` (nome, número, rota, tabela, textos, exemplos, ícones);
2. um módulo em `src/lib/fontes/` que implementa `Fonte` (`comum.ts`) e entra em `fontes/index.ts`;
3. um cartão e uma página em `src/components/corredores.ts`;
4. as cores em `[data-corredor="…"]` e na placa em `src/styles/global.css`.

A página é gerada por `src/pages/[...corredor].astro`. A troca de corredor não recarrega: a ilha
intercepta o clique na placa, troca `html[data-corredor]` numa View Transition (círculo a partir do
clique) e leva o termo da busca. Um DuckDB só atende todos os corredores; cada tabela é baixada na
primeira vez que o corredor abre.

## Desenvolvimento

```bash
pnpm install
pnpm dev                 # usa o manifest de produção
pnpm test                # vitest: detecção da entrada, formatação, manifest
pnpm check               # astro check + vue-tsc
pnpm build               # dist/ estático; lê o manifest no build (dicionário, sobre, rodapé)
```

Para não depender do site publicado, gere os dados localmente com o CLI do repo `anvisa` e sirva-os
com CORS, como o GitHub Pages faz (o `pnpm dev` roda noutra origem). O `http.server` do Python não
envia CORS.

```bash
anvisa dados build --out /tmp/dados          # ~10 s; baixa ~57 MB da ANVISA
pnpm dados:local /tmp/dados 8000             # scripts/dados-local.mjs
PUBLIC_MANIFEST_URL=http://localhost:8000/manifest.json pnpm dev
```

## Publicação

`.github/workflows/pages.yml` testa, checa e publica no GitHub Pages a cada push em `main` e
diariamente às 22:30 UTC, depois do pipeline de dados (21:00 UTC). O rebuild diário só atualiza
dicionário, "sobre" e rodapé, porque a busca lê o manifest ao vivo. Em Settings → Pages, use a fonte
"GitHub Actions".

Código sob a licença MIT (`LICENSE`). Os dados são da ANVISA, e este site não tem vínculo com ela.
