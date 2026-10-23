// As páginas de empresa (/empresa/<cnpj>/): o que cada uma mostra e como as linhas das tabelas viram uma
// empresa. Puro: o build lê as linhas no DuckDB (dados.ts) e entrega aqui; os testes usam linhas falsas.
import type { IdCorredor } from "../../corredores/tipos";
import { slugFabricante } from "../chave";
import { fatiar } from "../format";
import type { LinhaFabricacaoDispositivo } from "./fabricantes";

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

/** A área do certificado de boas práticas, como o repo `anvisa` a grava em `certificados`. */
export type AreaCertificado =
  "produtos_saude" | "insumos" | "medicamentos" | "cosmeticos" | "saneantes" | "alimentos" | "outros";

/** A área do certificado na língua de quem compra; o `assunto` inteiro fica no hover. */
export const AREA_CERTIFICADO: Record<AreaCertificado, string> = {
  produtos_saude: "dispositivos médicos",
  insumos: "insumos de remédios",
  medicamentos: "remédios",
  cosmeticos: "cosméticos",
  saneantes: "produtos de limpeza",
  alimentos: "alimentos",
  outros: "outros produtos",
};

/** O vínculo entre quem pede o certificado e a fábrica; `desconhecida` quando a ANVISA não diz a fábrica. */
export type VinculoCertificado = Vinculo | "desconhecida";

/** Uma linha de certificados: um CBPF ou CBPDA pedido por uma empresa (cnpj, empresa) para uma fábrica. */
export interface LinhaCertificado {
  id: number;
  /** a fábrica brasileira; null no exterior ou quando a ANVISA não informa */
  inspecionadaCnpj: string | null;
  /** o código da ANVISA da fábrica no exterior; null fora disso */
  inspecionadaCodigo: string | null;
  inspecionada: string | null;
  pais: string | null;
  tipo: "CBPF" | "CBPDA";
  area: AreaCertificado;
  assunto: string;
  /** como a certificação foi feita, como a ANVISA escreve (INSPEÇÃO, ANÁLISE DE RISCO…); null nos antigos */
  emissao: string | null;
  /** Publicado deferimento, Revalidação automática… */
  situacao: string;
  /** AAAA-MM-DD */
  publicacao: string | null;
  validade: string | null;
  /** dentro da validade na data dos dados (dadosDe), deferido e não cancelado */
  vigente: boolean;
  cancelado: boolean;
  vinculo: VinculoCertificado;
  processo: string | null;
  /** remédios: as linhas e formas certificadas, com "|"; "" nas demais áreas */
  linhas: string;
  /** AAAA-MM-DD da carga da origem (a dos remédios parou em 2025-09-08) */
  dadosDe: string;
}

/** Um certificado como a página mostra. */
export interface Certificado {
  id: number;
  tipo: "CBPF" | "CBPDA";
  area: AreaCertificado;
  assunto: string;
  emissao: string | null;
  situacao: string;
  publicacao: string | null;
  validade: string | null;
  vigente: boolean;
  cancelado: boolean;
  processo: string | null;
  linhas: string[];
  dadosDe: string;
}

/** Uma fábrica certificada a pedido da empresa, com os certificados dela; vigentes antes. */
export interface PlantaCertificada {
  cnpj: string | null;
  codigo: string | null;
  nome: string;
  pais: string | null;
  vinculo: Vinculo;
  /** a fábrica brasileira de outra empresa: tem página (/empresa/) */
  comPagina: boolean;
  certificados: Certificado[];
}

/** Uma empresa que pediu certificado para a fábrica desta (a própria fica de fora). */
export interface Solicitante {
  cnpj: string;
  nome: string;
  vinculo: "grupo" | "terceira";
  certificados: Certificado[];
}

/** Um fabricante dos dispositivos médicos da empresa (fora ela mesma); `slug` só quando ele tem página. */
export interface FabricanteDispositivo {
  chave: string;
  nome: string;
  pais: string | null;
  vinculo: "terceira" | "exterior";
  registros: number;
  registrosAtivos: number;
  slug: string | null;
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
  /** produtos_saude_fabricacao: idem */
  fabricacaoDispositivos?: LinhaFabricacaoDispositivo[];
  /** certificados: idem */
  certificados?: (LinhaCertificado & DaEmpresa)[];
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
  /** os fabricantes dos dispositivos médicos desta empresa, fora ela mesma, de mais a menos registros */
  fabricadoPor: FabricanteDispositivo[];
  /** as fábricas com certificado de boas práticas pedido por esta empresa */
  fabricasCertificadas: PlantaCertificada[];
  /** as empresas que pediram certificado para a fábrica desta */
  certificadaPara: Solicitante[];
  /** os certificados pedidos por esta empresa sem a fábrica informada (os mais antigos) */
  certificadosSemFabrica: Certificado[];
}

const porNome = (a: { ativo: boolean; nome: string }, b: { ativo: boolean; nome: string }) =>
  Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Uma empresa por CNPJ com produto, com medida da ANVISA (quem só tem medida também é procurado: "essa marca é
 * confiável?") ou com envase de alimentos para outra empresa (a envasadora sem produto próprio também é
 * procurada: "quem fabrica esta marca?"). O nome é o mais frequente nos produtos, depois nas medidas, depois
 * no nome da envasadora escrito nas apresentações, depois nos certificados de boas práticas: a razão social
 * varia na grafia entre processos. Quem só pediu certificado de boas práticas, e a fábrica brasileira
 * certificada a pedido de outra empresa, também ganham página. Liberados primeiro, depois por nome; medidas da
 * mais recente para a mais antiga; envases dos que mais produtos fazem para os que menos; certificados vigentes
 * antes. `fabricantesComPagina` são os slugs de /fabricante/ (fabricantes.ts): só eles viram link.
 */
export function agrupar(e: Entrada, fabricantesComPagina: ReadonlySet<string> = new Set()): Map<string, Empresa> {
  const empresas = new Map<string, Empresa>();
  type Origem = "produtos" | "medidas" | "fabricacao" | "certificados";
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
        fabricadoPor: [],
        fabricasCertificadas: [],
        certificadaPara: [],
        certificadosSemFabrica: [],
      };
      empresas.set(cnpj, emp);
      nomes.set(cnpj, { produtos: new Map(), medidas: new Map(), fabricacao: new Map(), certificados: new Map() });
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

  // o fabricante de dispositivo não tem CNPJ: fica na página da detentora, que já existe pelos produtos (sem
  // contar o nome, que já vem deles)
  for (const f of e.fabricacaoDispositivos ?? []) {
    if (f.vinculo === "propria" || !f.chave) continue;
    const dono = empresas.get(f.cnpj);
    if (!dono) continue;
    const slug = slugFabricante(f.chave, f.pais);
    dono.fabricadoPor.push({
      chave: f.chave,
      nome: f.fabricante,
      pais: f.pais,
      vinculo: f.vinculo,
      registros: f.registros,
      registrosAtivos: f.registrosAtivos,
      slug: fabricantesComPagina.has(slug) ? slug : null,
    });
  }

  // os certificados por último: o nome escrito neles é a última opção
  for (const c of e.certificados ?? []) {
    const quem = da(c.cnpj, c.empresa, "certificados");
    if (!quem) continue;
    const cert = certificadoDe(c);
    if (c.vinculo === "desconhecida") {
      quem.certificadosSemFabrica.push(cert);
      continue;
    }
    // a fábrica pelo CNPJ no Brasil, pelo código da ANVISA no exterior; sem os dois (raro), pelo nome e país
    const chave = chavePlanta(c.inspecionadaCnpj, c.inspecionadaCodigo, c.inspecionada ?? "", c.pais);
    let planta = quem.fabricasCertificadas.find((p) => chavePlanta(p.cnpj, p.codigo, p.nome, p.pais) === chave);
    if (!planta) {
      planta = {
        cnpj: c.inspecionadaCnpj,
        codigo: c.inspecionadaCodigo,
        nome: c.inspecionada ?? "",
        pais: c.pais,
        vinculo: c.vinculo,
        comPagina: false,
        certificados: [],
      };
      quem.fabricasCertificadas.push(planta);
    }
    planta.certificados.push(cert);
    // a fábrica brasileira de outra empresa ganha página, com quem pediu o certificado para ela
    if (c.inspecionadaCnpj && (c.vinculo === "grupo" || c.vinculo === "terceira")) {
      const fabrica = da(c.inspecionadaCnpj, c.inspecionada ?? "", "certificados");
      if (!fabrica) continue;
      let sol = fabrica.certificadaPara.find((x) => x.cnpj === quem.cnpj);
      if (!sol) {
        sol = { cnpj: quem.cnpj, nome: c.empresa, vinculo: c.vinculo, certificados: [] };
        fabrica.certificadaPara.push(sol);
      }
      sol.certificados.push(cert);
    }
  }

  for (const emp of empresas.values()) {
    const { produtos, medidas, fabricacao, certificados } = nomes.get(emp.cnpj)!;
    emp.nome = maisFrequente(
      produtos.size ? produtos : medidas.size ? medidas : fabricacao.size ? fabricacao : certificados,
    );
    emp.alimentos.sort(porNome);
    emp.saneantes.sort(porNome);
    emp.cosmeticos.sort(porNome);
    emp.medicamentos.sort(porNome);
    emp.produtosSaude.sort(porNome);
    emp.medidas.sort((a, b) => b.data.localeCompare(a.data) || a.produto.localeCompare(b.produto, "pt-BR"));
    emp.exterior.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || (a.pais ?? "").localeCompare(b.pais ?? ""));
    emp.fabricadoPor.sort((a, b) => b.registros - a.registros || a.nome.localeCompare(b.nome, "pt-BR"));
    for (const p of emp.fabricasCertificadas) p.certificados.sort(porVigencia);
    emp.certificadosSemFabrica.sort(porVigencia);
  }
  // os dois lados com o nome que a página da outra empresa usa, agora que todos os nomes estão escolhidos
  for (const emp of empresas.values()) {
    for (const x of [...emp.envasaPara, ...emp.envasadoPor]) x.nome = empresas.get(x.cnpj)?.nome || x.nome;
    emp.envasaPara.sort(porProdutos);
    emp.envasadoPor.sort(porProdutos);
    for (const p of emp.fabricasCertificadas) {
      if (p.cnpj) p.nome = empresas.get(p.cnpj)?.nome || p.nome;
      p.comPagina = !!p.cnpj && p.vinculo !== "propria" && empresas.has(p.cnpj);
    }
    for (const s of emp.certificadaPara) {
      s.nome = empresas.get(s.cnpj)?.nome || s.nome;
      s.certificados.sort(porVigencia);
    }
    emp.fabricasCertificadas.sort((a, b) => porVigencia(a.certificados[0]!, b.certificados[0]!) || porNomeDe(a, b));
    emp.certificadaPara.sort((a, b) => porVigencia(a.certificados[0]!, b.certificados[0]!) || porNomeDe(a, b));
  }
  return empresas;
}

const porProdutos = (a: Envase, b: Envase) => b.produtos - a.produtos || a.nome.localeCompare(b.nome, "pt-BR");
const porNomeDe = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

/** Vigentes antes; depois a validade mais longa, a publicação mais recente e o id (estável entre builds). */
const porVigencia = (a: Certificado, b: Certificado) =>
  Number(b.vigente) - Number(a.vigente) ||
  (b.validade ?? "").localeCompare(a.validade ?? "") ||
  (b.publicacao ?? "").localeCompare(a.publicacao ?? "") ||
  a.id - b.id;

const chavePlanta = (cnpj: string | null, codigo: string | null, nome: string, pais: string | null) =>
  cnpj ?? codigo ?? `${nome}|${pais ?? ""}`;

function certificadoDe(c: LinhaCertificado): Certificado {
  return {
    id: c.id,
    tipo: c.tipo,
    area: c.area,
    assunto: c.assunto,
    emissao: c.emissao,
    situacao: c.situacao,
    publicacao: c.publicacao,
    validade: c.validade,
    vigente: c.vigente,
    cancelado: c.cancelado,
    processo: c.processo,
    linhas: fatiar(c.linhas, "|"),
    dadosDe: c.dadosDe,
  };
}

/** Os certificados pedidos pela empresa, com e sem fábrica. */
export const certificadosDe = (emp: Empresa): Certificado[] => [
  ...emp.fabricasCertificadas.flatMap((p) => p.certificados),
  ...emp.certificadosSemFabrica,
];

/**
 * A data dos dados dos certificados de remédios que a página mostra (os pedidos pela empresa e os pedidos para a
 * fábrica dela): a ANVISA parou de atualizar essa lista. null sem nenhum.
 */
export function dadosDeRemedios(emp: Empresa): string | null {
  const datas = [...certificadosDe(emp), ...emp.certificadaPara.flatMap((s) => s.certificados)]
    .filter((c) => c.area === "medicamentos")
    .map((c) => c.dadosDe)
    .sort();
  return datas.at(-1) ?? null;
}

/** Certificados vigentes pedidos pela empresa para a página dela entrar no índice, mesmo sem produto. */
export const CERTIFICADOS_PARA_INDEXAR = 2;
/** Quantas fábricas, empresas solicitantes e certificados sem fábrica a página lista; o resto fica na nota. */
export const CERTIFICADOS_NA_PAGINA = 50;

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
  const certificados = certificadosDe(emp);
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
    fabricadoPor: emp.fabricadoPor.length,
    fabricasCertificadas: emp.fabricasCertificadas.length,
    certificados: certificados.length,
    certificadosVigentes: certificados.filter((c) => c.vigente).length,
    certificadaPara: emp.certificadaPara.length,
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
 * dela lista os clientes, e é o que se procura quando se quer saber quem fabrica uma marca. A empresa com dois
 * certificados de boas práticas vigentes também: é o que se procura antes de contratar uma fábrica.
 */
export function indexavel(emp: Empresa): boolean {
  return (
    totalProdutos(emp) >= PRODUTOS_PARA_INDEXAR ||
    emp.envasaPara.filter((x) => x.vinculo === "terceira").length >= PRODUTOS_PARA_INDEXAR ||
    resumo(emp).certificadosVigentes >= CERTIFICADOS_PARA_INDEXAR
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
