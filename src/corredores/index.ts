// Os "corredores" do site: cada fonte de dados é um corredor de supermercado, com placa numerada, cores e
// fundo próprios (CSS em [data-corredor]), textos e exemplos. Um corredor novo é uma pasta aqui com:
// - meta.ts: o registro (tipos.ts), só dados; entra em CORREDORES abaixo;
// - fonte.ts: a fonte de dados (Fonte, em lib/fonte.ts); entra em fontes.ts;
// - Cartao.vue e Pagina.vue: o cartão da lista e a página de detalhe; entram em telas.ts;
// - colunas.ts (opcional): as tabelas no dicionário de dados (título, o que é uma linha, palavras).
// Este arquivo e os meta.ts/colunas.ts são lidos no build pelas páginas Astro: nada de DuckDB nem Vue aqui
// (o ESLint barra).
import { url } from "../lib/format";
import * as colunasAlimentos from "./alimentos/colunas";
import * as colunasCosmeticos from "./cosmeticos/colunas";
import { meta as cosmeticos } from "./cosmeticos/meta";
import { meta as alimentos } from "./alimentos/meta";
import * as colunasMedicamentos from "./medicamentos/colunas";
import { meta as medicamentos } from "./medicamentos/meta";
import * as colunasProdutosSaude from "./produtos_saude/colunas";
import { meta as produtosSaude } from "./produtos_saude/meta";
import * as colunasSaneantes from "./saneantes/colunas";
import { meta as saneantes } from "./saneantes/meta";
import type { Corredor, InfoTabela } from "./tipos";

export type { Corredor, IdCorredor, InfoTabela } from "./tipos";

export const CORREDORES: Corredor[] = [alimentos, saneantes, cosmeticos, medicamentos, produtosSaude];

/**
 * As tabelas que o dicionário de dados descreve como Dataset (schema.org), de todos os corredores e as de
 * todo o site. Tabela do manifest sem entrada aqui aparece no dicionário com o título e as notas do
 * manifest, sem Dataset. As descrições das colunas são sempre as do manifest.
 */
export const TABELAS: Record<string, InfoTabela> = {
  ...colunasAlimentos.TABELAS,
  ...colunasSaneantes.TABELAS,
  ...colunasCosmeticos.TABELAS,
  ...colunasMedicamentos.TABELAS,
  ...colunasProdutosSaude.TABELAS,
  // de todos os corredores (cada um vê as do seu tipoProduto; ver lib/medidas.ts)
  produtos_irregulares: {
    titulo: "Medidas de fiscalização da ANVISA contra produtos irregulares",
    descricao:
      "Medidas de fiscalização da ANVISA contra produtos irregulares de todas as áreas (suspensão, proibição, recolhimento, interdição, apreensão, inutilização): uma linha por dossiê, ação, atividade e produto.",
    palavras: ["fiscalização", "produtos irregulares", "recolhimento", "proibição", "suspensão"],
  },
  // derivadas no repo `anvisa` a cada build (dados/derivar.py), com as mesmas colunas para alimentos e saneantes
  produtos: {
    titulo: "Produtos regularizados na ANVISA: uma linha por produto, cinco áreas",
    descricao:
      "Uma linha por alimento ou suplemento (agrupadas as apresentações), saneante, medicamento e produto para saúde regularizado na ANVISA, com empresa, CNPJ, processo, registro, situação, tipo e vencimento nas mesmas colunas; derivada das tabelas de cada área.",
    palavras: [
      "alimentos",
      "suplementos alimentares",
      "saneantes",
      "produtos de limpeza",
      "medicamentos",
      "dispositivos médicos",
      "registro",
      "notificação",
    ],
  },
  certificados: {
    titulo: "Certificados de boas práticas de fabricação e de distribuição (CBPF e CBPDA)",
    descricao:
      "Uma linha por certificado de boas práticas emitido pela ANVISA: a empresa que pediu, a fábrica inspecionada (CNPJ no Brasil ou código no exterior), a área, a validade e se está vigente; derivada das tabelas cbpf e cbpf_medicamentos.",
    palavras: ["boas práticas de fabricação", "CBPF", "CBPDA", "certificado", "inspeção", "fabricante"],
  },
  empresas: {
    titulo: "Empresas com produtos ou medidas na ANVISA, por CNPJ",
    descricao:
      "Uma linha por CNPJ que detém alimento, saneante, cosmético, medicamento ou produto para saúde regularizado na ANVISA ou que foi alvo de medida de fiscalização, com a razão social e a quantidade de produtos (total e ativos) por área e de medidas.",
    palavras: ["empresas", "CNPJ", "alimentos", "saneantes", "cosméticos", "medicamentos", "fiscalização"],
  },
};

export const CORREDOR_PADRAO = CORREDORES[0]!;

/** Caminho do corredor no site, com o base path. */
export function rotaDo(c: Corredor): string {
  return url(`/${c.slug}/`);
}

/** Corredor pelo primeiro segmento do caminho depois do base path; desconhecido (a raiz, o sobre) cai no padrão. */
export function corredorDaUrl(pathname: string): Corredor {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const resto = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const slug = resto.split("/").find(Boolean) ?? "";
  return CORREDORES.find((c) => c.slug === slug) ?? CORREDOR_PADRAO;
}

export function corredorPorId(id: string): Corredor {
  return CORREDORES.find((c) => c.id === id) ?? CORREDOR_PADRAO;
}
