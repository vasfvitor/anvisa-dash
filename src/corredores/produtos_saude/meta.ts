// Corredor 5: dispositivos médicos, que a ANVISA chama de produtos para saúde.
import type { Corredor } from "../tipos";
import { TABELA_FABRICACAO_PS } from "./consultas";

export const meta: Corredor = {
  id: "produtos_saude",
  numero: 5,
  nome: "Dispositivos médicos",
  curto: "Dispositivos",
  tecnico: "produtos para saúde",
  slug: "dispositivos",
  tabela: "produtos_saude_por_produto",
  tabelasDoProduto: [TABELA_FABRICACAO_PS],
  icone: "pulso",
  deco: ["pulso", "documento", "caixas", "certo", "etiqueta", "brilho", "pulso", "gota", "documento"],
  titulo: "Dispositivos médicos liberados pela ANVISA",
  descricao:
    "Veja se um dispositivo médico (produto para saúde) está liberado pela ANVISA, de qual empresa e com que risco: termômetro, seringa, implante. Busque pelo nome ou CNPJ.",
  lead: "Termômetro, seringa, preservativo, teste rápido, implante.",
  placeholder: "Produto, empresa ou CNPJ",
  rotuloTexto: "nome comercial, nome técnico ou empresa",
  rotuloNumero: "nº do registro ou do cadastro (10 ou 11 dígitos) ou do processo",
  exemplos: [
    { valor: "termômetro", texto: "termômetro" },
    { valor: "preservativo", texto: "preservativo" },
    { valor: "seringa", texto: "seringa" },
    { valor: "58430828000160", texto: "58.430.828/0001-60", dica: "CNPJ" },
    { valor: "10163770014", texto: "10163770014", dica: "registro" },
  ],
  grupo: "Classe de risco",
  // Sem explicação de Cadastrado e Registrado: o `tipo` do anvisa-api vem do primeiro dígito do número, e os dados
  // não o ligam a risco nem a prazo (2026-11-03: 18.533 Registrados de classe I ou II sem vencimento, 12.009
  // Cadastrados de classe III ou IV com vencimento). A classe e o vencimento, que os dados trazem, dizem isso.
  tipos: {},
  item: ["dispositivo médico", "dispositivos médicos"],
  dica: "Luvas, seringas, testes rápidos, implantes e aparelhos de medir pressão são dispositivos médicos.",
  tipoProduto: 8,
};
