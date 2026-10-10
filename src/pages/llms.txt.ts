// /llms.txt: o site explicado para assistentes e agentes. A busca do site roda em JavaScript no navegador;
// quem só lê páginas usa as páginas de empresa, e quem roda código consulta os Parquet direto. Os endereços
// dos arquivos mudam a cada build e vêm do manifest do mesmo build.
import type { APIRoute } from "astro";
import { CORREDORES } from "../corredores";
import { TABELA as ALIMENTOS } from "../corredores/alimentos/consultas";
import { TABELA as COSMETICOS } from "../corredores/cosmeticos/consultas";
import { TABELA as SANEANTES } from "../corredores/saneantes/consultas";
import { MANIFEST_URL } from "../lib/config";
import { TABELA_MEDIDAS } from "../lib/consultas";
import { fmtData, fmtInt } from "../lib/format";
import { manifestDoBuild, tabelaUrl } from "../lib/manifest";
import { DESCRICAO, NOME } from "../lib/marca";

export const GET: APIRoute = async ({ site }) => {
  const m = await manifestDoBuild(MANIFEST_URL);
  const raiz = (p: string) => new URL(p, site).href;
  const arquivo = (nome: string) => tabelaUrl(MANIFEST_URL, m, nome);
  const tabelas = [ALIMENTOS, SANEANTES, COSMETICOS, TABELA_MEDIDAS].filter((t) => t in m.tables);
  const busca = m.tables[COSMETICOS]?.busca;
  const tipo = (id: string) => CORREDORES.find((c) => c.id === id)?.tipoProduto;

  const texto = `# ${NOME}.

> ${DESCRICAO} Consulta independente aos dados abertos da ANVISA, sem vínculo com a ANVISA: para qualquer decisão, confira a consulta oficial.

A busca do site roda em JavaScript no navegador. Sem JavaScript, use as páginas de empresa ou os arquivos de dados abaixo.

## Páginas sem JavaScript

- [Página de empresa](${raiz("/empresa/84684620000187/")}): ${raiz("/empresa/")}<CNPJ com 14 dígitos>/. Lista os alimentos e suplementos, os produtos de limpeza e os cosméticos da empresa (até 100 cosméticos, liberados primeiro) com situação (Liberado ou Encerrado), tipo (Registrado ou Notificado; nos cosméticos também Isento de registro e Descartável), datas, nº do processo e registro, e as medidas de fiscalização da ANVISA contra a empresa. Todas estão no [sitemap](${raiz("/sitemap-index.xml")}).
- [Empresas de A a Z](${raiz("/empresas/")}): o link da página de cada uma
- [Sobre](${raiz("/sobre/")}): o site e os dados
- [Dicionário de dados](${raiz("/dicionario/")}): as colunas de cada tabela

A página de um produto (${raiz("/")}?p=<id>, ${raiz("/limpeza/")}?p=<expediente>, ${raiz("/cosmeticos/")}?p=<processo>) precisa de JavaScript; glúten, lactose, alergênicos e ingredientes só aparecem nela.

## Dados

Arquivos Parquet do build ${m.build_id}, com os dados abertos da ANVISA. O [manifest](${MANIFEST_URL}) lista os arquivos atuais.

${tabelas.map((t) => `- [${t}](${arquivo(t)}): ${fmtInt(m.tables[t]!.rows)} linhas${m.tables[t]!.source.loaded_at ? `, dados de ${fmtData(m.tables[t]!.source.loaded_at)}` : ""}`).join("\n")}

- ${ALIMENTOS}: uma linha por apresentação; o produto é co_seq_produto. Situação em situacao_registro ('Ativo' é liberado), marcas separadas por ";".
- ${SANEANTES}: produtos de limpeza, uma linha por processo; o produto é nu_expediente. st_produto_ativo é liberado, dt_vencimento_produto é o fim da liberação.
- ${COSMETICOS}: cosméticos, perfumes e produtos de higiene, uma linha por processo e st_registrado (11 mil processos registrados aparecem duas vezes). st_situacao_produto é liberado, ds_tipo_peticao o tipo (REGISTRO, Notificado, ISENTO DE REGISTRO, DESCARTAVEL; vazio nas linhas de registro).${busca ? ` Os mesmos dados também em ${fmtInt(busca.arquivos)} pedaços por palavra do nome, CNPJ e número, com [índice](${new URL(busca.indice, MANIFEST_URL).href}).` : ""}
- ${TABELA_MEDIDAS}: medidas de fiscalização (suspensão, proibição, recolhimento, interdição, apreensão, inutilização), uma linha por dossiê, produto, ação e atividade. co_tipo_produto ${tipo("alimentos")} é alimento, ${tipo("saneantes")} é saneante, ${tipo("cosmeticos")} é cosmético.

## Consultas (DuckDB)

Alimentos de uma marca, um produto por linha:

\`\`\`sql
SELECT co_seq_produto, any_value(no_produto) AS nome, any_value(marcas) AS marcas,
  any_value(no_razao_social_empresa) AS empresa, any_value(situacao_registro) AS situacao,
  any_value(nu_processo) AS processo
FROM read_parquet('${arquivo(ALIMENTOS)}')
WHERE lower(strip_accents(marcas)) LIKE '%whey%'
GROUP BY co_seq_produto;
\`\`\`

Produtos de limpeza de uma empresa:

\`\`\`sql
SELECT nu_expediente, no_produto, st_produto_ativo, is_registrado, dt_vencimento_produto, nu_processo
FROM read_parquet('${arquivo(SANEANTES)}')
WHERE nu_cnpj_empresa = '33122466000704';
\`\`\`

Cosméticos liberados de uma empresa, um por processo:

\`\`\`sql
SELECT nu_processo, any_value(no_produto) AS nome, any_value(nu_registro) AS registro,
  any_value(dt_vencimento) AS vencimento
FROM read_parquet('${m.tables[COSMETICOS] ? arquivo(COSMETICOS) : "<cosmeticos.parquet do manifest>"}')
WHERE nu_cnpj_empresa = '33306929000100' AND st_situacao_produto
GROUP BY nu_processo;
\`\`\`

Medidas contra uma empresa:

\`\`\`sql
SELECT DISTINCT dt_publicacao, produto, ds_acao_fiscalizacao
FROM read_parquet('${arquivo(TABELA_MEDIDAS)}')
WHERE nu_cnpj_empresa_investigada = '29822523000103'
ORDER BY dt_publicacao DESC;
\`\`\`
`;
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
