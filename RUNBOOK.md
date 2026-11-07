# RUNBOOK do contém (anvisa-dash)

O que fazer quando um workflow deste repo fica vermelho. Comece pelo
[RUNBOOK do anvisa-hub](https://github.com/vasfvitor/anvisa-hub/blob/main/RUNBOOK.md): lá estão o mapa
dos seis repos, a rotina e o que vale para todos (rodar de novo, run cinza, lockfile, Pages).

As mensagens aparecem aqui como o log mostra. Procure com Ctrl+F um trecho da mensagem que você viu.
`<tabela>`, `N` e afins marcam a parte que muda.

Quem cria ou muda um alarme ou uma mensagem de erro (um `throw`, um `::error::`, um `::warning::` ou um
`exit 1` num workflow) atualiza este arquivo no mesmo commit, citando a mensagem como o log mostra.

## Índice

| Workflow       | Trecho da mensagem                                                          | Entrada                                                             |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Publicar site  | `não deu para ler o build_id` (aviso amarelo)                               | [Manifest não abriu no verificar](#manifest-não-abriu-no-verificar) |
| Publicar site  | `manifest: HTTP`, `fetch failed`                                            | [anvisa-api fora do ar](#anvisa-api-fora-do-ar)                     |
| Publicar site  | `manifest com schema_version`, `manifest inválido`, `manifest sem a tabela` | [Contrato do anvisa-api mudou](#contrato-do-anvisa-api-mudou)       |
| Publicar site  | `HTTP 404 em`, `arquivo incompleto`                                         | [Parquet não baixou](#parquet-não-baixou)                           |
| Publicar site  | `Binder Error`, `Referenced column`                                         | [Coluna do anvisa-api mudou](#coluna-do-anvisa-api-mudou)           |
| Publicar site  | `dist com N MB`                                                             | [Site perto do limite do Pages](#site-perto-do-limite-do-pages)     |
| Publicar site  | `o tamanho do motor foi medido`, `MOTOR_VERSAO`                             | [Versão do DuckDB-WASM mudou](#versão-do-duckdb-wasm-mudou)         |
| Publicar site  | `heap out of memory`, tempo esgotado                                        | [Build sem memória ou lento](#build-sem-memória-ou-lento)           |
| Publicar site  | `format:check`, `lint`, `test`, `check`                                     | [Lint, formato, testes ou tipos](#lint-formato-testes-ou-tipos)     |
| Testes ao vivo | `faltam`, `AssertionError`, `curl: (22)`                                    | [Testes ao vivo falharam](#testes-ao-vivo-falharam)                 |
| (visitante)    | `Não foi possível carregar os dados de`, `A busca falhou`                   | [Erro que um visitante relata](#erro-que-um-visitante-relata)       |

## Publicar site

Roda em push no `main`, à mão, e três vezes por noite (22:30, 01:30 e 04:30 UTC). À noite, o job
`verificar` compara o `build_id` do manifest do anvisa-api com o de `/build.json` do site e só publica
quando há um build novo. Se não conseguir ler o manifest, não publica e deixa um aviso amarelo (ver
[Manifest não abriu no verificar](#manifest-não-abriu-no-verificar)). Se quem não abre é o `/build.json`
do próprio site, publica.

A busca do site lê o manifest ao vivo, no navegador. O build gera o resto: páginas de empresa, listas de
A a Z, `llms.txt`, dicionário, "sobre" e rodapé. Em qualquer falha deste workflow, **o site anterior
continua no ar**.

### anvisa-api fora do ar

- **Onde aparece:** passo Build (ou `check`).
- **Mensagens:** `manifest: HTTP 503 em https://vasfvitor.github.io/anvisa-api/manifest.json`, ou
  `TypeError: fetch failed`.
- **O que quer dizer:** o manifest do anvisa-api não abriu durante o build. Isso só aparece num push ou
  num "Run workflow": nos horários fixos, o `verificar` para antes, com o aviso amarelo.
- **O site foi afetado?** As páginas estáticas seguem as anteriores. A busca, que lê o manifest ao vivo,
  também pode estar fora.
- **Agir ou esperar:** esperar. Ver o
  [RUNBOOK do anvisa-api](https://github.com/vasfvitor/anvisa-api/blob/main/RUNBOOK.md).

### Manifest não abriu no verificar

- **Onde aparece:** job `verificar`, como aviso amarelo. O run fica verde e o build não roda.
- **Mensagem:** `::warning::não deu para ler o build_id do manifest do anvisa-api; nada publicado, o site segue com o build atual`
- **O que quer dizer:** num horário fixo, o manifest do anvisa-api não abriu, ou veio sem `build_id`. O
  contém não publica, porque o build falharia.
- **O site foi afetado?** As páginas estáticas seguem as anteriores. A busca lê o mesmo manifest ao vivo,
  então pode estar fora também.
- **Agir ou esperar:** esperar. Ver o
  [RUNBOOK do anvisa-api](https://github.com/vasfvitor/anvisa-api/blob/main/RUNBOOK.md).
- **Pedir ajuda quando:** o aviso se repetir por mais de um dia com o anvisa-api verde.

### Contrato do anvisa-api mudou

- **Onde aparece:** passo Build (ou `check`).
- **Mensagens:**
  - `manifest com schema_version N (esperado 1)`
  - `manifest inválido: não é um objeto` ou `manifest inválido: sem tables`
  - `manifest sem a tabela produtos`
- **O que quer dizer:** o manifest do anvisa-api mudou de forma que este site não sabe ler.
- **O site foi afetado?** As páginas estáticas seguem as anteriores, mas **a busca do site provavelmente
  quebrou na mesma hora**, porque lê o mesmo manifest ao vivo. Urgente.
- **Agir ou esperar:** pedir ajuda.

### Parquet não baixou

- **Onde aparece:** passo Build.
- **Mensagens:** `<tabela>: HTTP 404 em https://vasfvitor.github.io/anvisa-api/data/<build>/<tabela>.parquet`,
  ou `<tabela>: arquivo incompleto (N de M bytes)`.
- **O que quer dizer:** quase sempre, o anvisa-api publicou um build novo durante este build, e o arquivo
  antigo saiu do ar. O build lê o manifest com cache, o que deixa isso mais provável.
- **O que fazer:** esperar uns 10 minutos e rodar de novo ("Run workflow").
- **Pedir ajuda quando:** repetir.

### Coluna do anvisa-api mudou

- **Onde aparece:** passo Build.
- **Mensagem:** `Binder Error: Referenced column "<coluna>" not found ...`
- **O que quer dizer:** uma tabela do anvisa-api perdeu ou trocou o nome de uma coluna que o contém lê.
- **O site foi afetado?** As páginas seguem as anteriores. A busca pode estar quebrada para essa tabela.
- **Agir ou esperar:** pedir ajuda. O `Testes ao vivo` costuma avisar disso antes.

### Site perto do limite do Pages

- **Onde aparece:** passo "Tamanho do site".
- **Mensagens:**
  - `::warning::dist com N MB, perto do limite de 1 GB do Pages` (acima de 800 MB, o run segue verde);
  - `::error::dist com N MB, acima de 950 MB (o Pages recusa acima de 1 GB)` (o upload nem começa).
- **O que quer dizer:** o site cresce com os dados, uma página por empresa. O Pages não aceita mais de
  1 GB.
- **O site foi afetado?** Com o erro, o site anterior continua. Os dados novos não entram.
- **Agir ou esperar:** com o aviso, planejar. Com o erro, agir: é uma decisão de produto (o que deixa de
  ter página própria). Pedir ajuda.

### Versão do DuckDB-WASM mudou

- **Onde aparece:** passo `pnpm test`, no teste "o tamanho do motor foi medido na versão instalada".
- **Mensagem:** `expected '<versão nova>' to be '<versão antiga>'`
- **O que quer dizer:** alguém atualizou o `@duckdb/duckdb-wasm`. O site anuncia ao visitante quanto vai
  baixar, e esse número precisa ser medido de novo.
- **O que fazer:** seguir o comentário do próprio teste: medir de novo o `.wasm` e o worker no jsDelivr
  (com brotli) e atualizar `MOTOR_BYTES` e `MOTOR_VERSAO` em `src/lib/licenca.ts`.

### Build sem memória ou lento

- **Mensagens:** `JavaScript heap out of memory`, ou o job passou de 15 minutos.
- **O que quer dizer:** o site tem dezenas de milhares de páginas e cresce com os dados.
- **O que fazer:** rodar de novo uma vez.
- **Pedir ajuda quando:** repetir.

### Lint, formato, testes ou tipos

- **Onde aparece:** passos `pnpm format:check`, `pnpm lint`, `pnpm test` ou `pnpm check`.
- **O que fazer**, na máquina:

  ```bash
  pnpm install
  pnpm format        # corrige a formatação
  pnpm lint
  pnpm test
  pnpm check
  ```

- `pnpm install --frozen-lockfile` falhou: ver o RUNBOOK do hub, "Lockfile desatualizado".

## Testes ao vivo

Roda todo dia às 06:15 UTC e à mão. Baixa todas as tabelas do build publicado do anvisa-api e roda os
testes contra elas. **Não publica nada.** Vermelho aqui quer dizer que o anvisa-api mudou algo que o
contém lê, e que a busca do site pode estar quebrada agora.

### Testes ao vivo falharam

- **Mensagens:**
  - `curl: (22) The requested URL returned error: 404` no passo "Baixar o build publicado";
  - `Error: DADOS_LIVE=...: faltam <tabelas>`;
  - `AssertionError: expected N to be +0` (ou outra comparação).
- **O que fazer:**
  1. **404 no download:** o anvisa-api pode ter publicado no meio do download. Rodar de novo.
  2. **`faltam`:** uma tabela que o contém lê sumiu do manifest ou mudou de nome. Abrir a busca do site e
     testar o corredor dessa tabela. Pedir ajuda.
  3. **`AssertionError`:** os números que o contém calcula não batem com o dado real. Pode ser uma
     mudança no anvisa-api ou um teste desatualizado (aconteceu em 23/10/2026). Pedir ajuda.
- **Para rodar na máquina:** ver "Desenvolvimento" no README (`DADOS_LIVE=... pnpm test`).

## Erro que um visitante relata

A busca roda no navegador. Quando ela falha, o visitante vê uma caixa de erro com o motivo entre
parênteses. Por exemplo:

- `Não foi possível carregar os dados de <corredor>. (manifest com schema_version 2 (esperado 1))` e um
  botão "Tentar de novo": ver [Contrato do anvisa-api mudou](#contrato-do-anvisa-api-mudou).
- `(ainda não publicados neste build)`: a tabela desse corredor não está no manifest de hoje.
- `(HTTP 404 em <url>)`, `(arquivo incompleto: ...)` ou `(arquivo diferente do manifest em <url>)`: um
  deploy do anvisa-api no meio da visita, ou cache. Recarregar a página costuma resolver.
- `(o download parou: nada chegou em 20 s ...)` ou `(o download não terminou em 180 s ...)`: o motor de
  busca vem do jsDelivr e a extensão Parquet de extensions.duckdb.org. Um deles está lento ou fora.
- `A busca falhou. (...)`: uma consulta deu erro. Se repetir com qualquer termo, pedir ajuda.

## Problemas conhecidos

Achados em 2026-11-03, ainda sem correção.

- **"Liberado até" congelado no dia do build.** Nas páginas de empresa, "Em dia" ou "Vencida" é
  calculado no dia do build. Entre um build e outro, uma liberação que venceu continua aparecendo como
  "Liberado até <data>", em verde. A busca não tem esse problema, porque calcula na hora. Fase 3.
- **O aviso de medidas some sem aviso.** Se a tabela `medidas` não carregar, a página do produto
  simplesmente não mostra medidas da ANVISA, sem dizer que não conseguiu conferir. Fase 3.
- **O build lê o manifest com cache.** Isso deixa mais provável o 404 de
  [Parquet não baixou](#parquet-não-baixou). Fase 3.
- **Caminhos do `llms.txt` quebram por algumas horas depois de cada deploy do anvisa-api.** Os exemplos de
  `read_parquet` do `llms.txt` e a distribuição de cada tabela nos dados estruturados do dicionário apontam
  para os Parquet do build em que o site foi gerado, e dão 404 até o contém publicar de novo (até cerca de
  3 horas por dia). O `llms.txt` avisa que o manifest lista os arquivos atuais. Desde 07/11/2026, o "Baixar
  Parquet" do dicionário leva à tabela na página do próprio anvisa-api, que não quebra.
- **Seções opcionais somem sem aviso.** Se uma tabela opcional faltar no manifest, as seções que dependem
  dela somem das páginas e o build fica verde. O `Testes ao vivo` também não confere as tabelas
  opcionais.
- **Ninguém vigia se o contém está em dia.** Se o cron parar ou o build falhar todo dia, nenhum outro
  workflow fica vermelho. Fase 5 (página de status).
