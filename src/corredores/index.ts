// Os "corredores" do site: cada fonte de dados é um corredor de supermercado, com placa numerada, cores e
// fundo próprios (CSS em [data-corredor]), textos e exemplos. Um corredor novo é uma pasta aqui com:
// - meta.ts: o registro (tipos.ts), só dados; entra em CORREDORES abaixo;
// - fonte.ts: a fonte de dados (Fonte, em lib/fonte.ts); entra em fontes.ts;
// - Cartao.vue e Pagina.vue: o cartão da lista e a página de detalhe; entram em telas.ts;
// - colunas.ts (opcional): descrições para o dicionário de dados.
// Este arquivo e os meta.ts/colunas.ts são lidos no build pelas páginas Astro: nada de DuckDB nem Vue aqui
// (o ESLint barra).
import { url } from "../lib/format";
import * as colunasAlimentos from "./alimentos/colunas";
import * as colunasCosmeticos from "./cosmeticos/colunas";
import { meta as cosmeticos } from "./cosmeticos/meta";
import { meta as alimentos } from "./alimentos/meta";
import * as colunasSaneantes from "./saneantes/colunas";
import { meta as saneantes } from "./saneantes/meta";
import type { Corredor, InfoTabela } from "./tipos";

export type { Corredor, IdCorredor, InfoTabela } from "./tipos";

export const CORREDORES: Corredor[] = [alimentos, saneantes, cosmeticos];

/** Tabelas e colunas que o dicionário de dados descreve, de todos os corredores. */
export const TABELAS: Record<string, InfoTabela> = {
  ...colunasAlimentos.TABELAS,
  ...colunasSaneantes.TABELAS,
  ...colunasCosmeticos.TABELAS,
  // de todos os corredores (cada um vê as do seu tipoProduto; ver lib/medidas.ts)
  produtos_irregulares: {
    titulo: "Medidas de fiscalização da ANVISA contra produtos irregulares",
    descricao:
      "Medidas de fiscalização da ANVISA contra produtos irregulares de todas as áreas (suspensão, proibição, recolhimento, interdição, apreensão, inutilização): uma linha por dossiê, ação, atividade e produto.",
    palavras: ["fiscalização", "produtos irregulares", "recolhimento", "proibição", "suspensão"],
  },
};
export const COLUNA_DESCRICAO: Record<string, Record<string, string>> = {
  ...colunasAlimentos.COLUNA_DESCRICAO,
  ...colunasSaneantes.COLUNA_DESCRICAO,
  ...colunasCosmeticos.COLUNA_DESCRICAO,
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
