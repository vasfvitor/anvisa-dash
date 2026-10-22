// A situação na ANVISA em palavras do dia a dia. "Ativo"/"Inativo" é como a ANVISA publica e fica no
// hover (dica) e nos dados técnicos; inativo cobre cancelado, vencido e encerrado a pedido da empresa,
// e para quem compra quer dizer o mesmo: a liberação acabou.
export const SITUACAO = {
  ativo: {
    curto: "Liberado",
    longo: "Liberado pela ANVISA",
    faceta: "Liberados",
    tecnico: "Ativo",
    dica: "Regularização ativa na ANVISA",
  },
  inativo: {
    curto: "Encerrado",
    longo: "Liberação encerrada",
    faceta: "Encerrados",
    tecnico: "Inativo",
    dica: "Regularização inativa na ANVISA: cancelada, vencida ou encerrada pela empresa",
    /** a primeira frase do aviso na página do produto; cada corredor diz depois onde procurar a versão nova */
    aviso: "A ANVISA não lista mais este produto como liberado.",
  },
} as const;

export const situacaoDe = (ativo: boolean) => SITUACAO[ativo ? "ativo" : "inativo"];

/** O hover da faceta e do selo de tipo: "Registrado: a ANVISA analisou… Notificado: …" (meta.tipos). */
export const dicaTipos = (tipos: Record<string, string>): string =>
  Object.entries(tipos)
    .map(([valor, oracao]) => `${valor}: ${oracao}.`)
    .join(" ");

const chave = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/**
 * A nota de "Dados técnicos" para um valor, "(oração)"; vazia quando o meta não o explica. A ANVISA escreve o
 * mesmo valor de vários jeitos (GENÉRICO, Generico), então a comparação ignora caixa e acento.
 */
export function notaTipo(tipos: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "";
  const k = chave(valor);
  const achado = Object.entries(tipos).find(([v]) => chave(v) === k);
  return achado ? `(${achado[1]})` : "";
}
