# anvisa-dash

Consulta de alimentos e suplementos regularizados na ANVISA por nº do processo, CNPJ, registro,
nome, marca, empresa e categoria. Site estático (Astro + uma ilha Vue). A busca roda no navegador
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
- **duckdb-wasm 1.33.1-dev57.0 só faz HTTP Range com `forceFullHTTPReads: false` explícito**, e com
  `reliableHeadRequests: false`, porque o GitHub Pages responde HEAD com Range usando 200. Sem a
  primeira, baixa o arquivo inteiro a cada abertura; sem a segunda, a abertura falha no Pages
  (`src/lib/db.ts`). `scripts/dados-local.mjs` imita esse HEAD para o erro aparecer também local.
- **Busca por texto passa por Range mal.** Ela varre todos os row groups e, por Range, relê pedaços:
  5,3 MB para um arquivo de 3,25 MB. Por isso `alimentos` é baixado inteiro uma vez, em segundo plano
  (`emMemoria`), e todas as buscas seguintes rodam em memória. O detalhe (`alimentos_resultado`)
  continua por Range: ~100 KB por produto aberto.
- **Parâmetro `?` impede a poda de row groups no `BETWEEN` inteiro.** A consulta de detalhe usa
  literais validados. Os ids vêm do próprio resultado, nunca do usuário.
- Nome, marcas, empresa, processo e situação são iguais em todas as apresentações de um produto. A
  busca agrupa por `co_seq_produto` numa consulta só.
- 94 apresentações ativas (recentes) ainda não têm linha em `alimentos_resultado`. A interface avisa.

## Desenvolvimento

```bash
pnpm install
pnpm dev                 # usa o manifest de produção
pnpm test                # vitest: detecção da entrada, formatação, manifest
pnpm check               # astro check + vue-tsc
pnpm build               # dist/ estático; lê o manifest no build (dicionário, sobre, rodapé)
```

Para não depender do site publicado, gere os dados localmente com o CLI do repo `anvisa` e sirva-os
com Range e CORS, como o GitHub Pages faz. O `http.server` do Python não faz nenhum dos dois.

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
