// Nome e frases do site num lugar só. "contém" é a palavra mais lida dos rótulos brasileiros
// ("CONTÉM GLÚTEN", "contém leite") e também dos saneantes; é o que o site responde sobre cada produto.
export const NOME = "contém";

/** Descrição das páginas que não são de um corredor (cada corredor tem a sua no registro). */
export const DESCRICAO =
  "Consulte alimentos, suplementos, produtos de limpeza e cosméticos liberados pela ANVISA pela marca, pelo nome, pela empresa, pelo CNPJ ou pelo número do rótulo.";

export const tituloPagina = (titulo: string): string => `${titulo} · ${NOME}.`;
