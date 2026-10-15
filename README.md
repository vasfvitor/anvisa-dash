# contém.

Consulta de produtos regularizados na ANVISA (alimentos e suplementos; produtos de limpeza, os saneantes;
cosméticos) por nº do processo,
CNPJ, registro, nome, marca, empresa e categoria. Site estático (Astro + uma ilha Vue). A busca roda no navegador
com DuckDB-WASM sobre os Parquet que o repo [`anvisa`](https://github.com/vasfvitor/anvisa-api)
publica diariamente. Não há backend. No build, uma página estática por empresa (`/empresa/<cnpj>/`), a
lista delas de A a Z (`/empresas/`) e o `/llms.txt` levam os dados a quem não roda JavaScript: buscadores e
assistentes.

## Dados

O app só conhece o manifest (`src/lib/config.ts`). Os caminhos dos Parquet vêm dele e mudam a cada
build. Cada tabela do manifest vira uma view no DuckDB, e o dicionário (`/dicionario/`) é gerado do
manifest no build, com o título, as notas e as descrições das colunas que o próprio manifest traz (escritas
no repo `anvisa`, desde o build 20261012T000746Z). Tabela nova aparece nos dois sem mudar código.

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
  busca lê `alimentos_por_produto` (uma linha por `co_seq_produto`, com o resumo de alergênicos, 2,8 MB),
  que o repo `anvisa` deriva de `alimentos` e `alimentos_resultado` a cada build (desde 2026-10-12; antes
  a ilha agrupava `alimentos` ela mesma, e `test/derivadas-live.test.ts` confere que dá no mesmo). As
  duas tabelas de origem (3,3 e 1,7 MB) só baixam na primeira página de produto, para as apresentações.
- 94 apresentações ativas (recentes) ainda não têm linha em `alimentos_resultado`. A interface avisa.

## Corredores

Cada fonte de dados é um corredor: `/alimentos/` (alimentos e suplementos), `/limpeza/` (saneantes) e
`/cosmeticos/`. A raiz (`src/pages/index.astro`) apresenta os três, com os totais do build e uma busca
em cada um que funciona sem JavaScript. Os textos falam a língua de quem compra (liberado, encerrado,
limpeza); o termo técnico fica no hover e nos dados técnicos. Cada corredor é uma pasta em `src/corredores/`; para criar outro:

1. `meta.ts`: o registro (nome, número, rota, tabela, textos, exemplos, ícones; tipo em `tipos.ts`, onde
   o id também entra em `IdCorredor`), que entra em `CORREDORES` (`src/corredores/index.ts`). Com `tipoProduto` (o `co_tipo_produto` da área em
   `medidas` e `produtos_irregulares`: 6 alimento, 3 saneantes, 2 cosmético…), o corredor ganha as medidas de
   fiscalização (`src/lib/medidas.ts`) na busca, na abertura, na página do produto e nos cartões;
2. `fonte.ts`: a fonte de dados, que implementa `Fonte` (`src/lib/fonte.ts`) com o SQL compartilhado de
   `src/lib/sql.ts` e entra em `fontes.ts`;
3. `Cartao.vue` e `Pagina.vue`: o cartão da lista e a página de detalhe, que entram em `telas.ts`;
   `Texto.astro`: o texto próprio do corredor abaixo da busca (o que a consulta cobre e como ler o que ela
   mostra, para quem chega pelo buscador), que entra em `TEXTOS` na página `[...corredor].astro` e, como a
   abertura, espera em `<template data-texto>` nos outros corredores para a troca sem recarregar;
4. `colunas.ts` (opcional): a tabela no dicionário de dados como Dataset (schema.org): título, o que é
   uma linha e palavras; as colunas são descritas no manifest;
5. o CSS em `src/styles/corredores/<id>.css`, importado em `src/styles/global.css`: paleta e material
   (os tokens de `tokens.css`) em `[data-corredor="…"]`, a cor da placa e o que muda de caráter; os
   ícones novos em `public/icones.svg`;
6. no build: a tabela em `src/lib/estatico/dados.ts` e `empresas.ts` (páginas de empresa e lista de A a
   Z) e no `src/pages/llms.txt.ts`.

Tabela grande demais para baixar inteira (os cosméticos, 24 MB) vem também em pedaços com índice (a chave
`busca` da tabela no manifest; formato no repo `anvisa`): a fonte baixa só os pedaços de cada busca
(`src/corredores/cosmeticos/indice.ts`) e cria com eles uma tabela pequena, sobre a qual vale o mesmo SQL
de filtros e facetas. A regra das palavras é a mesma dos dois lados (`src/lib/palavras.ts`, casos em
`test/fixtures/tokens.json`); `COSMETICOS_BUSCA=<pasta> pnpm test` confere as buscas contra uma pasta de
verdade.

As páginas Astro rodam no build e só podem ler o registro (`index.ts`, `tipos.ts`, `meta.ts`,
`colunas.ts`) e o SQL puro (`consultas.ts`); o DuckDB-WASM, as fontes e os componentes da ilha só existem
no navegador, e o ESLint barra o import no lugar errado. As páginas de empresa leem os Parquet no build com
o DuckDB do Node (`src/lib/estatico/dados.ts`): alimentos e saneantes da tabela `produtos`, que o repo
`anvisa` deriva a cada build com a mesma definição de produto da ilha, as medidas de fiscalização da
tabela `medidas` (uma linha por dossiê e produto, também derivada lá; a ilha a lê pela view
`medidas_busca` de `src/lib/consultas.ts`), e os cosméticos de `cosmeticos_por_empresa` (os 100
primeiros de cada CNPJ pelas regras de `sqlCos`, 7,6 MB em vez dos 24 MB da tabela inteira) com os
totais em `empresas`. `DADOS_LIVE=<pasta com os Parquet> pnpm test` confere, contra os dados reais, que
cada derivada bate com o SQL da ilha (`test/derivadas-live.test.ts`).

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
pnpm build               # dist/ estático; baixa o manifest e os Parquet (páginas de empresa, ~12 s)
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

`.github/workflows/pages.yml` testa, checa e publica no GitHub Pages a cada push em `main`. À noite
(22:30, 01:30 e 04:30 UTC) ele compara o `build_id` do manifest com o de `/build.json` no site e só
republica quando o pipeline de dados publicou um build novo: o GitHub atrasa crons em horas, e o
pipeline pula dias sem dados novos. A busca lê o manifest ao vivo; o rebuild atualiza as páginas de
empresa e a lista de A a Z, o `llms.txt`, o dicionário, o "sobre" e o rodapé. O sitemap
(`src/pages/sitemap-index.xml.ts` e `sitemap-0.xml.ts`) lista as páginas fixas e as listas de A a Z com o
`lastmod` do build de dados e só as páginas de empresa com dois produtos ou mais (`indexavel` em
`src/lib/estatico/empresas.ts`); as demais, só com medidas ou com um produto, saem com `noindex`, porque
milhares de páginas de um parágrafo fazem o Google deixar o site inteiro em "rastreada, mas não indexada".
Em Settings → Pages, use a fonte
"GitHub Actions" e o domínio próprio `contem.abelhaninja.de` (o mesmo de `site` em `astro.config.mjs`;
o endereço `github.io` redireciona para ele).

Código sob a licença MIT (`LICENSE`). Os dados são da ANVISA, e este site não tem vínculo com ela.
