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
import { meta as alimentos } from "./alimentos/meta";
import { meta as saneantes } from "./saneantes/meta";
import type { Corredor } from "./tipos";

export type { Corredor, IdCorredor } from "./tipos";

export const CORREDORES: Corredor[] = [alimentos, saneantes];

/** Descrições de tabelas e colunas de todos os corredores, para o dicionário de dados. */
export const TABELA_DESCRICAO: Record<string, string> = { ...colunasAlimentos.TABELA_DESCRICAO };
export const COLUNA_DESCRICAO: Record<string, Record<string, string>> = { ...colunasAlimentos.COLUNA_DESCRICAO };

export const CORREDOR_PADRAO = CORREDORES[0]!;

/** Caminho do corredor no site, com o base path. */
export function rotaDo(c: Corredor): string {
  return url(c.slug ? `/${c.slug}/` : "/");
}

/** Corredor pelo primeiro segmento do caminho depois do base path; desconhecido cai no padrão. */
export function corredorDaUrl(pathname: string): Corredor {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const resto = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const slug = resto.split("/").find(Boolean) ?? "";
  return CORREDORES.find((c) => c.slug === slug) ?? CORREDOR_PADRAO;
}

export function corredorPorId(id: string): Corredor {
  return CORREDORES.find((c) => c.id === id) ?? CORREDOR_PADRAO;
}
