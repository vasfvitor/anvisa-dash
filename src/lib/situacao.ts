// A situação na ANVISA em palavras do dia a dia. "Ativo"/"Inativo" é como a ANVISA publica e fica no
// hover (dica) e nos dados técnicos; inativo cobre cancelado, vencido e encerrado a pedido da empresa,
// e para quem compra quer dizer o mesmo: a liberação acabou.
export const SITUACAO = {
  ativo: { curto: "Liberado", longo: "Liberado pela ANVISA", faceta: "Liberados", dica: "Regularização ativa na ANVISA" },
  inativo: {
    curto: "Encerrado",
    longo: "Liberação encerrada",
    faceta: "Encerrados",
    dica: "Regularização inativa na ANVISA: cancelada, vencida ou encerrada pela empresa",
  },
} as const;

export const situacaoDe = (ativo: boolean) => SITUACAO[ativo ? "ativo" : "inativo"];

/** O que quer dizer cada tipo de regularização, para o hover da faceta e dos dados técnicos. */
export const TIPOS = "Registrado: a ANVISA analisou o produto antes de liberar. Notificado: a empresa comunicou a ANVISA e pode vender sem análise prévia.";
