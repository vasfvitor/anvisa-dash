// Corredor 5: dispositivos médicos, que a ANVISA chama de produtos para saúde.
import type { Corredor } from "../tipos";

export const meta: Corredor = {
  id: "produtos_saude",
  numero: 5,
  nome: "Dispositivos médicos",
  curto: "Dispositivos",
  tecnico: "produtos para saúde",
  slug: "dispositivos",
  tabela: "produtos_saude_por_produto",
  icone: "pulso",
  deco: ["pulso", "documento", "caixas", "certo", "etiqueta", "brilho", "pulso", "gota", "documento"],
  titulo: "Dispositivos médicos liberados pela ANVISA",
  descricao:
    "Veja se um dispositivo médico (produto para saúde) está registrado ou cadastrado na ANVISA, de qual empresa e fabricante, com qual classe de risco: termômetro, seringa, preservativo, teste, implante. Busque pelo nome, pela empresa ou pelo CNPJ.",
  lead: "Registrados ou cadastrados na ANVISA.",
  placeholder: "Produto, empresa ou CNPJ",
  rotuloTexto: "Nome comercial, nome técnico ou empresa",
  rotuloNumero: "Nº do registro ou cadastro (10 ou 11 dígitos) ou do processo",
  exemplos: [
    { valor: "termômetro", texto: "termômetro" },
    { valor: "preservativo", texto: "preservativo" },
    { valor: "seringa", texto: "seringa" },
    { valor: "58430828000160", texto: "58.430.828/0001-60", dica: "CNPJ" },
    { valor: "10163770014", texto: "10163770014", dica: "registro" },
  ],
  grupo: "Classe de risco",
  item: ["dispositivo médico", "dispositivos médicos"],
  dica: "Luvas, seringas, testes rápidos, implantes e aparelhos de medir pressão são dispositivos médicos.",
  tipoProduto: 8,
};
