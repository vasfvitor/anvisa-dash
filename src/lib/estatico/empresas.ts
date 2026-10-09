// As páginas de empresa (/empresa/<cnpj>/): o que cada uma mostra e como as linhas das tabelas viram uma
// empresa. Puro: o build lê as linhas no DuckDB (dados.ts) e entrega aqui; os testes usam linhas falsas.
import type { IdCorredor } from "../../corredores/tipos";

export const CNPJ = /^\d{14}$/;

export interface LinhaAlimento {
  id: number;
  nome: string;
  /** separadas por ";", como na origem */
  marcas: string | null;
  categoria: string | null;
  ativo: boolean;
  tipo: string;
  processo: string;
  registro: string | null;
  /** AAAA-MM-DD da primeira regularização */
  desde: string | null;
  apresentacoes: number;
}

export interface LinhaSaneante {
  /** nu_expediente, o id na URL (com zeros à esquerda) */
  id: string;
  nome: string;
  ativo: boolean;
  tipo: string;
  processo: string;
  registro: string | null;
  /** AAAA-MM-DD do vencimento da liberação */
  vencimento: string | null;
  /** Em dia, Vencida ou Sem data */
  grupo: string;
}

export interface LinhaMedida {
  corredor: IdCorredor;
  produto: string;
  acoes: string[];
  /** AAAA-MM-DD da publicação mais recente */
  data: string;
}

/** Cada linha como sai da consulta: com o CNPJ e o nome da empresa que a agrupa. */
interface DaEmpresa {
  cnpj: string;
  empresa: string;
}

export interface Entrada {
  alimentos: (LinhaAlimento & DaEmpresa)[];
  saneantes: (LinhaSaneante & DaEmpresa)[];
  medidas: (LinhaMedida & DaEmpresa)[];
}

export interface Empresa {
  cnpj: string;
  nome: string;
  alimentos: LinhaAlimento[];
  saneantes: LinhaSaneante[];
  medidas: LinhaMedida[];
}

const porNome = (a: { ativo: boolean; nome: string }, b: { ativo: boolean; nome: string }) =>
  Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Uma empresa por CNPJ com produto ou com medida da ANVISA (quem só tem medida também é procurado: "essa
 * marca é confiável?"). O nome é o mais frequente nos produtos, ou nas medidas quando não há produto: a
 * razão social varia na grafia entre processos. Liberados primeiro, depois por nome; medidas da mais recente
 * para a mais antiga.
 */
export function agrupar(e: Entrada): Map<string, Empresa> {
  const empresas = new Map<string, Empresa>();
  const nomes = new Map<string, { produtos: Map<string, number>; medidas: Map<string, number> }>();

  const da = (cnpj: string, nome: string, origem: "produtos" | "medidas"): Empresa | undefined => {
    if (!CNPJ.test(cnpj)) return undefined;
    let emp = empresas.get(cnpj);
    if (!emp) {
      emp = { cnpj, nome: "", alimentos: [], saneantes: [], medidas: [] };
      empresas.set(cnpj, emp);
      nomes.set(cnpj, { produtos: new Map(), medidas: new Map() });
    }
    if (nome) {
      const conta = nomes.get(cnpj)![origem];
      conta.set(nome, (conta.get(nome) ?? 0) + 1);
    }
    return emp;
  };

  for (const { cnpj, empresa, ...linha } of e.alimentos) da(cnpj, empresa, "produtos")?.alimentos.push(linha);
  for (const { cnpj, empresa, ...linha } of e.saneantes) da(cnpj, empresa, "produtos")?.saneantes.push(linha);
  for (const m of e.medidas) {
    da(m.cnpj, m.empresa, "medidas")?.medidas.push({
      corredor: m.corredor,
      produto: m.produto,
      acoes: m.acoes,
      data: m.data,
    });
  }

  for (const emp of empresas.values()) {
    const { produtos, medidas } = nomes.get(emp.cnpj)!;
    emp.nome = maisFrequente(produtos.size ? produtos : medidas);
    emp.alimentos.sort(porNome);
    emp.saneantes.sort(porNome);
    emp.medidas.sort((a, b) => b.data.localeCompare(a.data) || a.produto.localeCompare(b.produto, "pt-BR"));
  }
  return empresas;
}

/** O mais frequente; no empate, o primeiro em ordem alfabética (estável entre builds). Sem nenhum, "". */
function maisFrequente(conta: Map<string, number>): string {
  const [maior] = [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  return maior?.[0] ?? "";
}

/** Contagens para o título, a descrição e o cabeçalho da página. */
export function resumo(emp: Empresa) {
  const ativos = (l: { ativo: boolean }[]) => l.filter((x) => x.ativo).length;
  return {
    alimentos: emp.alimentos.length,
    alimentosAtivos: ativos(emp.alimentos),
    saneantes: emp.saneantes.length,
    saneantesAtivos: ativos(emp.saneantes),
    medidas: emp.medidas.length,
  };
}

/** As letras da lista de empresas (/empresas/<letra>/), na ordem; "0-9" junta quem começa com dígito ou símbolo. */
export const LETRAS = [..."abcdefghijklmnopqrstuvwxyz".split(""), "0-9"];

/** A letra da lista: o primeiro caractere de letra ou dígito do nome, sem acento ("Ótica" fica em o). */
export function letraDe(nome: string): string {
  const c = nome
    .normalize("NFD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .charAt(0)
    .toLowerCase();
  return /[a-z]/.test(c) ? c : "0-9";
}

/** As empresas por letra, cada letra em ordem de nome; toda letra de LETRAS aparece, mesmo vazia. */
export function porLetra<T extends { nome: string; cnpj: string }>(empresas: Iterable<T>): Map<string, T[]> {
  const letras = new Map(LETRAS.map((l) => [l, [] as T[]]));
  for (const emp of empresas) letras.get(letraDe(emp.nome))!.push(emp);
  for (const lista of letras.values()) {
    lista.sort(
      (a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) || a.cnpj.localeCompare(b.cnpj),
    );
  }
  return letras;
}
