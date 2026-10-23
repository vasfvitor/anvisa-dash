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

/** Um produto com validade da liberação (saneantes e cosméticos). */
export interface LinhaValidade {
  /** o id na URL: nu_expediente nos saneantes (com zeros à esquerda), nu_processo nos cosméticos */
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

/** Totais de um corredor que a página não lista inteiro (os cosméticos de uma empresa grande). */
export interface Totais {
  produtos: number;
  ativos: number;
}

/** Quantos cosméticos de cada empresa a página lista (liberados primeiro); o resto fica na busca. */
export const COSMETICOS_POR_EMPRESA = 100;

export interface LinhaMedida {
  corredor: IdCorredor;
  produto: string;
  acoes: string[];
  /** AAAA-MM-DD da publicação mais recente */
  data: string;
}

/**
 * O vínculo entre a empresa detentora e quem fabrica: o mesmo CNPJ (`propria`), outra filial da mesma raiz de
 * 8 dígitos (`grupo`), outra empresa brasileira (`terceira`) ou um fabricante no exterior (`exterior`).
 */
export type Vinculo = "propria" | "grupo" | "terceira" | "exterior";

/** Uma linha de alimentos_fabricacao: uma empresa detentora (cnpj, empresa) e um fabricante dos alimentos dela. */
export interface LinhaFabricacao {
  /** a envasadora brasileira; null no fabricante no exterior */
  fabricanteCnpj: string | null;
  /** o código da ANVISA do fabricante no exterior; null na envasadora brasileira ou quando a ANVISA não informa */
  fabricanteCodigo: string | null;
  /** o nome como a ANVISA escreve na apresentação */
  fabricante: string;
  cidade: string | null;
  pais: string | null;
  vinculo: Vinculo;
  /** produtos distintos da detentora com esse fabricante */
  produtos: number;
  produtosAtivos: number;
  apresentacoes: number;
}

/** A outra ponta de um envase entre duas empresas brasileiras, na página de uma delas. */
export interface Envase {
  cnpj: string;
  nome: string;
  cidade: string | null;
  pais: string | null;
  vinculo: "grupo" | "terceira";
  /** os alimentos e suplementos da detentora que a envasadora faz */
  produtos: number;
  produtosAtivos: number;
}

/** Um fabricante no exterior dos alimentos da empresa: sem página, o mesmo nome e país pode ter vários códigos. */
export interface FabricanteExterior {
  nome: string;
  pais: string | null;
  codigos: string[];
}

/** Cada linha como sai da consulta: com o CNPJ e o nome da empresa que a agrupa. */
interface DaEmpresa {
  cnpj: string;
  empresa: string;
}

export interface Entrada {
  alimentos: (LinhaAlimento & DaEmpresa)[];
  saneantes: (LinhaValidade & DaEmpresa)[];
  /** até COSMETICOS_POR_EMPRESA por empresa; os totais vêm em cosmeticosTotais */
  cosmeticos: (LinhaValidade & DaEmpresa)[];
  cosmeticosTotais: (Totais & { cnpj: string })[];
  /** medicamentos: `tipo` é a categoria regulatória, `registro` os 9 dígitos, `vencimento` com precisão de mês */
  medicamentos?: (LinhaValidade & DaEmpresa)[];
  /** produtos para saúde: `tipo` Registrado ou Cadastrado, `vencimento` só nos registros */
  produtosSaude?: (LinhaValidade & DaEmpresa)[];
  medidas: (LinhaMedida & DaEmpresa)[];
  /** alimentos_fabricacao: ausente ou vazia quando o build de dados ainda não tem a tabela */
  fabricacao?: (LinhaFabricacao & DaEmpresa)[];
}

export interface Empresa {
  cnpj: string;
  nome: string;
  alimentos: LinhaAlimento[];
  saneantes: LinhaValidade[];
  cosmeticos: LinhaValidade[];
  /** todos os cosméticos da empresa, não só os listados */
  cosmeticosTotais: Totais;
  medicamentos: LinhaValidade[];
  produtosSaude: LinhaValidade[];
  medidas: LinhaMedida[];
  /** as empresas para as quais esta envasa alimentos (outra filial do grupo ou terceira) */
  envasaPara: Envase[];
  /** as envasadoras brasileiras dos alimentos desta empresa, fora ela mesma */
  envasadoPor: Envase[];
  /** os fabricantes no exterior dos alimentos desta empresa */
  exterior: FabricanteExterior[];
}

const porNome = (a: { ativo: boolean; nome: string }, b: { ativo: boolean; nome: string }) =>
  Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Uma empresa por CNPJ com produto, com medida da ANVISA (quem só tem medida também é procurado: "essa marca é
 * confiável?") ou com envase de alimentos para outra empresa (a envasadora sem produto próprio também é
 * procurada: "quem fabrica esta marca?"). O nome é o mais frequente nos produtos, depois nas medidas, depois
 * no nome da envasadora escrito nas apresentações: a razão social varia na grafia entre processos. Liberados
 * primeiro, depois por nome; medidas da mais recente para a mais antiga; envases dos que mais produtos fazem
 * para os que menos.
 */
export function agrupar(e: Entrada): Map<string, Empresa> {
  const empresas = new Map<string, Empresa>();
  type Origem = "produtos" | "medidas" | "fabricacao";
  const nomes = new Map<string, Record<Origem, Map<string, number>>>();

  const da = (cnpj: string, nome: string, origem: Origem): Empresa | undefined => {
    if (!CNPJ.test(cnpj)) return undefined;
    let emp = empresas.get(cnpj);
    if (!emp) {
      emp = {
        cnpj,
        nome: "",
        alimentos: [],
        saneantes: [],
        cosmeticos: [],
        cosmeticosTotais: { produtos: 0, ativos: 0 },
        medicamentos: [],
        produtosSaude: [],
        medidas: [],
        envasaPara: [],
        envasadoPor: [],
        exterior: [],
      };
      empresas.set(cnpj, emp);
      nomes.set(cnpj, { produtos: new Map(), medidas: new Map(), fabricacao: new Map() });
    }
    if (nome) {
      const conta = nomes.get(cnpj)![origem];
      conta.set(nome, (conta.get(nome) ?? 0) + 1);
    }
    return emp;
  };

  for (const { cnpj, empresa, ...linha } of e.alimentos) da(cnpj, empresa, "produtos")?.alimentos.push(linha);
  for (const { cnpj, empresa, ...linha } of e.saneantes) da(cnpj, empresa, "produtos")?.saneantes.push(linha);
  for (const { cnpj, empresa, ...linha } of e.cosmeticos) da(cnpj, empresa, "produtos")?.cosmeticos.push(linha);
  for (const { cnpj, empresa, ...linha } of e.medicamentos ?? []) {
    da(cnpj, empresa, "produtos")?.medicamentos.push(linha);
  }
  for (const { cnpj, empresa, ...linha } of e.produtosSaude ?? []) {
    da(cnpj, empresa, "produtos")?.produtosSaude.push(linha);
  }
  for (const { cnpj, produtos, ativos } of e.cosmeticosTotais) {
    const emp = empresas.get(cnpj);
    if (emp) emp.cosmeticosTotais = { produtos, ativos };
  }
  for (const m of e.medidas) {
    da(m.cnpj, m.empresa, "medidas")?.medidas.push({
      corredor: m.corredor,
      produto: m.produto,
      acoes: m.acoes,
      data: m.data,
    });
  }

  // a fabricação depois de produtos e medidas: o nome da envasadora escrito na apresentação é a última opção
  for (const f of e.fabricacao ?? []) {
    if (f.vinculo === "propria") continue; // a empresa envasa o que é dela: nada a ligar
    if (f.vinculo === "exterior") {
      const dono = da(f.cnpj, f.empresa, "fabricacao");
      if (!dono) continue;
      // o mesmo fabricante aparece sob mais de um código: uma linha por nome e país, sem somar produtos
      const igual = dono.exterior.find((x) => x.nome === f.fabricante && x.pais === f.pais);
      if (!igual)
        dono.exterior.push({
          nome: f.fabricante,
          pais: f.pais,
          codigos: f.fabricanteCodigo ? [f.fabricanteCodigo] : [],
        });
      else if (f.fabricanteCodigo && !igual.codigos.includes(f.fabricanteCodigo))
        igual.codigos.push(f.fabricanteCodigo);
      continue;
    }
    if (!f.fabricanteCnpj) continue;
    const dono = da(f.cnpj, f.empresa, "fabricacao");
    const quem = da(f.fabricanteCnpj, f.fabricante, "fabricacao");
    if (!dono || !quem) continue;
    const comum = { vinculo: f.vinculo, produtos: f.produtos, produtosAtivos: f.produtosAtivos };
    dono.envasadoPor.push({ cnpj: quem.cnpj, nome: f.fabricante, cidade: f.cidade, pais: f.pais, ...comum });
    // a cidade da detentora não vem na linha: só a da envasadora
    quem.envasaPara.push({ cnpj: dono.cnpj, nome: f.empresa, cidade: null, pais: null, ...comum });
  }

  for (const emp of empresas.values()) {
    const { produtos, medidas, fabricacao } = nomes.get(emp.cnpj)!;
    emp.nome = maisFrequente(produtos.size ? produtos : medidas.size ? medidas : fabricacao);
    emp.alimentos.sort(porNome);
    emp.saneantes.sort(porNome);
    emp.cosmeticos.sort(porNome);
    emp.medicamentos.sort(porNome);
    emp.produtosSaude.sort(porNome);
    emp.medidas.sort((a, b) => b.data.localeCompare(a.data) || a.produto.localeCompare(b.produto, "pt-BR"));
    emp.exterior.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || (a.pais ?? "").localeCompare(b.pais ?? ""));
  }
  // os dois lados com o nome que a página da outra empresa usa, agora que todos os nomes estão escolhidos
  for (const emp of empresas.values()) {
    for (const x of [...emp.envasaPara, ...emp.envasadoPor]) x.nome = empresas.get(x.cnpj)?.nome || x.nome;
    emp.envasaPara.sort(porProdutos);
    emp.envasadoPor.sort(porProdutos);
  }
  return empresas;
}

const porProdutos = (a: Envase, b: Envase) => b.produtos - a.produtos || a.nome.localeCompare(b.nome, "pt-BR");

/** O mais frequente; no empate, o primeiro em ordem alfabética (estável entre builds). Sem nenhum, "". */
function maisFrequente(conta: Map<string, number>): string {
  const [maior] = [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  return maior?.[0] ?? "";
}

/** Contagens para o título, a descrição e o cabeçalho da página. */
export function resumo(emp: Empresa) {
  const ativos = (l: { ativo: boolean }[]) => l.filter((x) => x.ativo).length;
  // sem os totais (testes, ou empresa só com linhas), conta o que está na lista
  const cos = emp.cosmeticosTotais.produtos
    ? emp.cosmeticosTotais
    : { produtos: emp.cosmeticos.length, ativos: ativos(emp.cosmeticos) };
  return {
    alimentos: emp.alimentos.length,
    alimentosAtivos: ativos(emp.alimentos),
    saneantes: emp.saneantes.length,
    saneantesAtivos: ativos(emp.saneantes),
    cosmeticos: cos.produtos,
    cosmeticosAtivos: cos.ativos,
    medicamentos: emp.medicamentos.length,
    medicamentosAtivos: ativos(emp.medicamentos),
    produtosSaude: emp.produtosSaude.length,
    produtosSaudeAtivos: ativos(emp.produtosSaude),
    medidas: emp.medidas.length,
    envasaPara: emp.envasaPara.length,
    envasadoPor: emp.envasadoPor.length,
    exterior: emp.exterior.length,
  };
}

/** Quantos produtos a empresa tem, somadas as áreas. */
export function totalProdutos(emp: Empresa): number {
  const r = resumo(emp);
  return r.alimentos + r.saneantes + r.cosmeticos + r.medicamentos + r.produtosSaude;
}

/** Quantos produtos uma empresa precisa ter para a página entrar no índice dos buscadores e no sitemap. */
export const PRODUTOS_PARA_INDEXAR = 2;

/**
 * Se a página da empresa entra no índice dos buscadores (e no sitemap). Com um produto só, ou só com medidas,
 * a página é um parágrafo de modelo e uma linha de tabela: 4.363 das 16.466 páginas no build de 2026-10-13. O
 * Google julga o site inteiro pela média das páginas que rastreia, e milhares dessas o levam a deixar de fora
 * até as boas ("rastreada, mas não indexada"). As páginas finas continuam no ar e nas listas de A a Z. A
 * envasadora sem produto próprio que envasa para duas empresas ou mais (fora o próprio grupo) entra: a página
 * dela lista os clientes, e é o que se procura quando se quer saber quem fabrica uma marca.
 */
export function indexavel(emp: Empresa): boolean {
  return (
    totalProdutos(emp) >= PRODUTOS_PARA_INDEXAR ||
    emp.envasaPara.filter((x) => x.vinculo === "terceira").length >= PRODUTOS_PARA_INDEXAR
  );
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
