// Descrições das colunas para o dicionário de dados. Só o que se sabe com segurança; coluna nova no
// manifest sem entrada aqui aparece no dicionário só com tipo e nome de origem.
import type { InfoTabela } from "../tipos";

export const TABELAS: Record<string, InfoTabela> = {
  alimentos: {
    titulo: "Alimentos e suplementos regularizados na ANVISA",
    descricao:
      "Uma linha por apresentação de produto alimentício regularizado na ANVISA (registrado ou notificado), incluindo suplementos alimentares.",
    palavras: ["alimentos", "suplementos alimentares", "registro", "notificação"],
  },
  alimentos_resultado: {
    titulo: "Apresentações de alimentos: embalagens, ingredientes e alergênicos",
    descricao:
      "Detalhe de cada apresentação: validade, forma física, embalagens, ingredientes, intolerâncias e alergênicos.",
    palavras: ["alergênicos", "ingredientes", "embalagens", "validade"],
  },
  // CICLO_ANALISE_PETICOES_ALIMENTO e …_ANDAMENTO_ALIMENTO; só o primeiro tem data_primeira_finalizacao
  peticoes_alimento: {
    titulo: "Ciclo de análise das petições de alimentos na ANVISA",
    descricao:
      "Etapas do ciclo de análise das petições de alimentos na ANVISA: uma linha por petição e grupo de etapas, com assunto, situação atual, fila de análise e as datas de início e fim de cada etapa.",
    palavras: ["petições", "análise", "alimentos", "fila"],
  },
  peticoes_alimento_andamento: {
    titulo: "Petições de alimentos em análise na ANVISA",
    descricao: "As mesmas etapas do ciclo de análise, só para as petições de alimentos ainda em andamento na ANVISA.",
    palavras: ["petições", "análise", "alimentos", "fila"],
  },
};

export const COLUNA_DESCRICAO: Record<string, Record<string, string>> = {
  alimentos: {
    no_produto: 'Nome do produto como registrado; muitas vezes genérico ("Suplemento Alimentar em Cápsulas").',
    nu_processo:
      "Nº do processo, só dígitos. Os atuais têm 17 (exibidos como 25351.161029/2026-55); os antigos, de 6 a 16 (a maioria 13).",
    nu_cnpj_empresa: "CNPJ da empresa, 14 dígitos com zeros à esquerda. Texto, nunca número.",
    no_razao_social_empresa: "Razão social da empresa detentora.",
    marcas: 'Marcas do produto, separadas por ";".',
    ds_categoria_produto: "Categoria do produto (ex.: Suplementos alimentares).",
    tipo_regularizacao: "Registrado ou Notificado.",
    situacao_registro: "Ativo ou Inativo.",
    ds_situacao_assunto_doc: "Situação da petição (ex.: Anuído).",
    nu_registro_notificacao_produto: "Nº de registro (9 dígitos) ou, em notificações, o nº do processo.",
    nu_registro_produto: "Nº de registro do produto (9 dígitos); vazio em notificações.",
    nu_registro: "Nº de registro da apresentação: o do produto mais 4 dígitos; vazio em notificações.",
    dt_regularizacao: "Data de regularização (horário de Brasília).",
    dt_publicacao: "Data de publicação (horário de Brasília).",
    dt_situacao: "Data da situação atual (horário de Brasília).",
    dt_inicio_analise: "Início da análise (horário de Brasília).",
    dt_vencimento_registro: "Vencimento com precisão de mês, gravado como dia 1. Notificações trazem 12/2029.",
    st_produto_ativo: "Produto ativo (booleano). Pode ser nulo quando a origem traz valor inválido.",
    ds_alegacao_funcional: 'Alegações funcionais, separadas por ";".',
    co_seq_produto: "Identificador do produto; várias apresentações compartilham o mesmo.",
    co_seq_apresentacao_produto: "Identificador da apresentação; chave de junção com alimentos_resultado.",
    dt_carga_etl: "Data da carga ETL informada pela ANVISA no arquivo aberto.",
  },
  alimentos_resultado: {
    co_seq_apresentacao_produto: "Identificador da apresentação; chave de junção com alimentos.",
    co_produto: "Identificador do produto (igual a alimentos.co_seq_produto).",
    nu_apresentacao_produto: "Número da apresentação dentro do produto.",
    validade: 'Prazo de validade em texto (ex.: "24 Meses").',
    ds_forma_fisica: "Forma física (pó, cápsula, líquido…).",
    situacao_apresentacao: "Situação da apresentação.",
    material_embalagens: 'Materiais de embalagem, separados por " | ".',
    tipo_embalagens: 'Tipos de embalagem, separados por " | ".',
    empresas_envasadoras: 'Empresas envasadoras, separadas por " | ".',
    empresas_internacionais: 'Fabricantes internacionais, separados por " | ".',
    grupos_populacionais: "Grupos populacionais indicados.",
    vias_administracao: 'Vias de administração, separadas por " | ".',
    tabela_nutricional: "Lista de ingredientes em texto livre.",
    intolerancias: 'Pares "Contém X - Sim/Não" separados por " | ".',
    alergenicos: 'Grupos separados por " | ", itens por "#".',
    dt_carga_etl: "Data da carga ETL informada pela ANVISA no arquivo aberto.",
  },
};
