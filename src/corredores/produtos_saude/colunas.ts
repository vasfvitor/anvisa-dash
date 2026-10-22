// As tabelas dos produtos para saúde no dicionário de dados: título, o que é uma linha e palavras do Dataset
// (schema.org). As descrições das colunas vêm do manifest.
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  produtos_saude: {
    titulo: "Produtos para saúde (dispositivos médicos) na ANVISA",
    descricao:
      "Uma linha por registro ou cadastro de produto para saúde e por fabricante, como a ANVISA publica: nome comercial, nome técnico, classe de risco, empresa detentora, fabricante e país, publicação e validade.",
    palavras: ["dispositivos médicos", "produtos para saúde", "registro", "cadastro", "classe de risco"],
  },
  produtos_saude_por_produto: {
    titulo: "Dispositivos médicos: uma linha por registro",
    descricao:
      "Uma linha por registro ou cadastro de produto para saúde na ANVISA, com nome técnico, classe de risco, empresa, a lista de fabricantes com o país, publicação e validade; derivada da tabela produtos_saude.",
    palavras: ["dispositivos médicos", "produtos para saúde", "registro", "fabricantes", "classe de risco"],
  },
};
