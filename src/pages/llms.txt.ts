// /llms.txt: o site explicado para assistentes e agentes. A busca do site roda em JavaScript no navegador;
// quem só lê páginas usa as páginas de empresa, e quem roda código consulta os Parquet direto. Os endereços
// dos arquivos mudam a cada build e vêm do manifest do mesmo build.
import type { APIRoute } from "astro";
import { CORREDORES } from "../corredores";
import { TABELA as ALIMENTOS } from "../corredores/alimentos/consultas";
import { TABELA as COSMETICOS } from "../corredores/cosmeticos/consultas";
import { TABELA as MEDICAMENTOS, TABELA_CMED } from "../corredores/medicamentos/consultas";
import { TABELA as PRODUTOS_SAUDE } from "../corredores/produtos_saude/consultas";
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
  const tabelas = [ALIMENTOS, SANEANTES, COSMETICOS, MEDICAMENTOS, PRODUTOS_SAUDE, TABELA_CMED, TABELA_MEDIDAS].filter(
    (t) => t in m.tables,
  );
  const busca = m.tables[COSMETICOS]?.busca;
  const tipo = (id: string) => CORREDORES.find((c) => c.id === id)?.tipoProduto;

  const texto = `# ${NOME}.

> ${DESCRICAO} Consulta independente aos dados abertos da ANVISA, sem vínculo com a ANVISA: para qualquer decisão, confira a consulta oficial.

A busca do site roda em JavaScript no navegador. Sem JavaScript, use as páginas de empresa ou os arquivos de dados abaixo.

## Páginas sem JavaScript

- [Página de empresa](${raiz("/empresa/84684620000187/")}): ${raiz("/empresa/")}<CNPJ com 14 dígitos>/. Lista os alimentos e suplementos, os produtos de limpeza, os cosméticos (até 100, liberados primeiro), os remédios e os dispositivos médicos da empresa com situação (Liberado ou Encerrado), tipo (Registrado ou Notificado; nos cosméticos também Isento de registro e Descartável), datas, nº do processo e registro, e as medidas de fiscalização da ANVISA contra a empresa. Todas estão no [sitemap](${raiz("/sitemap-index.xml")}).
- [Página inicial](${raiz("/")}): os cinco corredores com uma busca em cada um, que sem JavaScript só abre o corredor
- [Empresas de A a Z](${raiz("/empresas/")}): o link da página de cada uma
- [Sobre](${raiz("/sobre/")}): o site e os dados
- [Dicionário de dados](${raiz("/dicionario/")}): as colunas de cada tabela

A página de um produto (${raiz("/alimentos/")}?p=<id>, ${raiz("/limpeza/")}?p=<expediente>, ${raiz("/cosmeticos/")}?p=<processo>, ${raiz("/remedios/")}?p=<registro de 9 dígitos>, ${raiz("/dispositivos/")}?p=<registro>) precisa de JavaScript; glúten, lactose, alergênicos, ingredientes, preços da CMED e fabricantes só aparecem nela.

## Dados

Arquivos Parquet do build ${m.build_id}, com os dados abertos da ANVISA. O [manifest](${MANIFEST_URL}) lista os arquivos atuais.

${tabelas.map((t) => `- [${t}](${arquivo(t)}): ${fmtInt(m.tables[t]!.rows)} linhas${m.tables[t]!.source.loaded_at ? `, dados de ${fmtData(m.tables[t]!.source.loaded_at)}` : ""}`).join("\n")}

- ${ALIMENTOS}: uma linha por produto (co_seq_produto), com as apresentações agrupadas e o resumo de alergênicos (gluten, lactose, contem, pode_conter, nao_contem). ativo é liberado, marcas separadas por ";"; registros são os números das apresentações. A tabela por apresentação é alimentos; a de detalhe (ingredientes, embalagens, alergênicos por apresentação), alimentos_resultado.
- ${SANEANTES}: produtos de limpeza, uma linha por processo; o produto é nu_expediente. st_produto_ativo é liberado, dt_vencimento_produto é o fim da liberação.
- ${COSMETICOS}: cosméticos, perfumes e produtos de higiene, uma linha por processo e st_registrado (11 mil processos registrados aparecem duas vezes). st_situacao_produto é liberado, ds_tipo_peticao o tipo (REGISTRO, Notificado, ISENTO DE REGISTRO, DESCARTAVEL; vazio nas linhas de registro).${busca ? ` Os mesmos dados também em ${fmtInt(busca.arquivos)} pedaços por palavra do nome, CNPJ e número, com [índice](${new URL(busca.indice, MANIFEST_URL).href}).` : ""}
- ${MEDICAMENTOS}: remédios, uma linha por registro de 9 dígitos (registro_produto; os 13 dígitos da caixa são o registro mais a apresentação), com principio_ativo, classe_terapeutica, categoria_regulatoria (Genérico, Similar, Novo…), ativo e vencimento. A tabela como a ANVISA publica, com repetições, é medicamentos.
- ${PRODUTOS_SAUDE}: dispositivos médicos (produtos para saúde), uma linha por registro ou cadastro, com nome_tecnico, classe_risco (I a IV), tipo (Registrado ou Cadastrado), ativo, vencimento e a lista fabricantes. A tabela por fabricante é produtos_saude.
- ${TABELA_CMED}: a lista de preços da CMED, uma linha por apresentação (ggrem), preços em centavos por alíquota de ICMS (pf_18, pmc_18, pmvg_18…), junta aos remédios por registro_produto.
- ${TABELA_MEDIDAS}: medidas de fiscalização (suspensão, proibição, recolhimento, interdição, apreensão, inutilização), uma linha por dossiê e produto, com acoes e atividades em lista e cnpj da empresa fiscalizada. area_codigo ${tipo("alimentos")} é alimento, ${tipo("saneantes")} é saneante, ${tipo("cosmeticos")} é cosmético, ${tipo("medicamentos")} é medicamento, ${tipo("produtos_saude")} é dispositivo médico.

## Consultas (DuckDB)

Alimentos de uma marca, um produto por linha:

\`\`\`sql
SELECT id, nome, marcas, empresa, ativo, processo, contem
FROM read_parquet('${arquivo(ALIMENTOS)}')
WHERE lower(strip_accents(marcas)) LIKE '%whey%';
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

Preço máximo de um remédio por apresentação (o registro de 9 dígitos é o da caixa sem os 4 últimos):

\`\`\`sql
SELECT m.nome, c.apresentacao, c.pf_18 / 100.0 AS pf, c.pmc_18 / 100.0 AS pmc, c.publicado_em
FROM read_parquet('${m.tables[MEDICAMENTOS] ? arquivo(MEDICAMENTOS) : "<medicamentos_por_produto.parquet do manifest>"}') m
JOIN read_parquet('${m.tables[TABELA_CMED] ? arquivo(TABELA_CMED) : "<cmed.parquet do manifest>"}') c USING (registro_produto)
WHERE m.registro_produto = '186200018';
\`\`\`

Medidas contra uma empresa:

\`\`\`sql
SELECT ultima, produto, area, acoes
FROM read_parquet('${arquivo(TABELA_MEDIDAS)}')
WHERE cnpj = '29822523000103'
ORDER BY ultima DESC;
\`\`\`
`;
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
