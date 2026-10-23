// As páginas de fabricante (/fabricante/<slug>/): quem fabrica dispositivos médicos para duas empresas ou mais,
// das linhas de produtos_saude_fabricacao. Puro: o build (dados.ts) lê a tabela inteira e entrega aqui; a ilha
// entrega só as linhas das chaves de um produto, e a mesma regra decide quem tem página; os testes usam linhas
// falsas. Não importa empresas.ts (empresas.ts importa daqui o tipo da linha: sem ciclo).
import { slugFabricante } from "../chave";

export type VinculoDispositivo = "propria" | "terceira" | "exterior";

/** Uma linha de produtos_saude_fabricacao: uma detentora (cnpj, empresa) e um fabricante dos dispositivos dela. */
export interface LinhaFabricacaoDispositivo {
  cnpj: string;
  empresa: string;
  /** a chave do nome (lib/chave.ts), gravada no repo `anvisa` */
  chave: string;
  /** a grafia mais frequente do nome nos registros */
  fabricante: string;
  pais: string | null;
  vinculo: VinculoDispositivo;
  /** registros e cadastros da detentora com esse fabricante */
  registros: number;
  registrosAtivos: number;
  linhas: number;
}

/** Uma empresa que registra dispositivos do fabricante, na página dele. */
export interface Detentor {
  cnpj: string;
  nome: string;
  /** o fabricante registrando em nome próprio: listado, mas não conta entre as empresas para quem fabrica */
  propria: boolean;
  registros: number;
  registrosAtivos: number;
}

export interface Fabricante {
  slug: string;
  chave: string;
  /** a grafia mais frequente entre as detentoras, pesada pelos registros; no empate, a primeira em ordem alfabética */
  nome: string;
  pais: string | null;
  /** a própria primeiro, depois de mais a menos registros */
  detentores: Detentor[];
  /** detentoras fora a própria */
  empresas: number;
  registros: number;
  registrosAtivos: number;
}

/**
 * Detentoras (fora a própria) para o fabricante ter página, e para a página entrar no índice e no sitemap: o
 * mesmo mínimo das páginas de empresa (PRODUTOS_PARA_INDEXAR). Duas linhas de tabela com totais equivalem à
 * página de uma empresa com dois produtos; subir para 3 é trocar a constante.
 */
export const DETENTORES_PARA_PAGINA = 2;
export const DETENTORES_PARA_INDEXAR = 2;

/** O de maior peso; no empate, o primeiro em ordem alfabética (estável entre builds). */
function maisPesado(conta: Map<string, number>): string {
  const [maior] = [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  return maior?.[0] ?? "";
}

/**
 * Os fabricantes com página, por slug e em ordem de slug. Cada (chave, país) é um fabricante; dois países que dão
 * o mesmo slug ("Reino Unido" e "REINO UNIDO") ficam juntos, com o país mais pesado. A detentora que aparece em
 * mais de uma linha do mesmo slug soma os registros.
 */
export function indexarFabricantes(linhas: Iterable<LinhaFabricacaoDispositivo>): Map<string, Fabricante> {
  interface Acumulado {
    chave: string;
    nomes: Map<string, number>;
    paises: Map<string, number>;
    detentores: Map<string, Detentor & { nomes: Map<string, number> }>;
  }
  const porSlug = new Map<string, Acumulado>();
  for (const l of linhas) {
    if (!l.chave) continue;
    const s = slugFabricante(l.chave, l.pais);
    let a = porSlug.get(s);
    if (!a) porSlug.set(s, (a = { chave: l.chave, nomes: new Map(), paises: new Map(), detentores: new Map() }));
    a.nomes.set(l.fabricante, (a.nomes.get(l.fabricante) ?? 0) + l.registros);
    if (l.pais) a.paises.set(l.pais, (a.paises.get(l.pais) ?? 0) + l.registros);
    let d = a.detentores.get(l.cnpj);
    if (!d) {
      d = { cnpj: l.cnpj, nome: "", propria: false, registros: 0, registrosAtivos: 0, nomes: new Map() };
      a.detentores.set(l.cnpj, d);
    }
    d.propria ||= l.vinculo === "propria";
    d.registros += l.registros;
    d.registrosAtivos += l.registrosAtivos;
    d.nomes.set(l.empresa, (d.nomes.get(l.empresa) ?? 0) + l.registros);
  }

  const fabricantes = new Map<string, Fabricante>();
  for (const s of [...porSlug.keys()].sort()) {
    const a = porSlug.get(s)!;
    const detentores: Detentor[] = [...a.detentores.values()].map(({ nomes, ...d }) => ({
      ...d,
      nome: maisPesado(nomes),
    }));
    const empresas = detentores.filter((d) => !d.propria).length;
    if (empresas < DETENTORES_PARA_PAGINA) continue;
    detentores.sort(
      (x, y) =>
        Number(y.propria) - Number(x.propria) ||
        y.registros - x.registros ||
        x.nome.localeCompare(y.nome, "pt-BR") ||
        x.cnpj.localeCompare(y.cnpj),
    );
    fabricantes.set(s, {
      slug: s,
      chave: a.chave,
      nome: maisPesado(a.nomes),
      pais: maisPesado(a.paises) || null,
      detentores,
      empresas,
      registros: detentores.reduce((n, d) => n + d.registros, 0),
      registrosAtivos: detentores.reduce((n, d) => n + d.registrosAtivos, 0),
    });
  }
  return fabricantes;
}

/** Se a página do fabricante entra no índice dos buscadores e no sitemap. */
export const indexavelFabricante = (f: Fabricante): boolean => f.empresas >= DETENTORES_PARA_INDEXAR;

/** As detentoras com o nome que a página de empresa usa (o mais frequente nos produtos), quando ele existe. */
export function comNomesDe(fabricantes: Map<string, Fabricante>, empresas: ReadonlyMap<string, { nome: string }>) {
  for (const f of fabricantes.values()) {
    for (const d of f.detentores) d.nome = empresas.get(d.cnpj)?.nome || d.nome;
  }
}
