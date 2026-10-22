// O que a página de um corredor diz a quem não roda JavaScript (um LLM, um crawler, um navegador sem JS) sobre
// onde o produto de `?p=<id>` está: a consulta DuckDB ao Parquet do build, com o id como `<p>`. Sem
// dependências, para o build e o llms.txt montarem o mesmo texto; a coluna do id é a mesma que cada
// corredores/*/fonte.ts usa, repetida aqui porque as páginas não podem importar fonte.ts.
import type { IdCorredor } from "../corredores/tipos";

export const PLACEHOLDER = "<p>";

export interface ConsultaSemJs {
  /** a tabela do manifest que a consulta lê */
  tabela: string;
  /** o que vai depois de `?p=` na URL, em português */
  oQueE: string;
  /** a consulta com `<p>` no lugar do valor; `url` é o Parquet da tabela neste build */
  sql: (url: string) => string;
}

const linhas = (texto: string): string =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

export const CONSULTAS: Record<IdCorredor, ConsultaSemJs> = {
  alimentos: {
    tabela: "alimentos_por_produto",
    oQueE: "pelo número do produto",
    sql: (url) =>
      linhas(`
        SELECT id, nome, marcas, empresa, cnpj, processo, registro, ativo, tipo, categoria, desde, vencimento,
          gluten, lactose, contem, pode_conter, nao_contem, apresentacoes
        FROM read_parquet('${url}')
        WHERE id = ${PLACEHOLDER};`),
  },
  saneantes: {
    tabela: "saneantes",
    oQueE: "pelo número do expediente",
    sql: (url) =>
      linhas(`
        SELECT nu_expediente, no_produto, no_razao_social_empresa, nu_cnpj_empresa, nu_processo,
          nu_registro_produto, st_produto_ativo, is_registrado, dt_vencimento_produto
        FROM read_parquet('${url}')
        WHERE nu_expediente = '${PLACEHOLDER}'
        QUALIFY row_number() OVER (PARTITION BY nu_expediente
          ORDER BY is_registrado DESC, dt_vencimento_produto DESC NULLS LAST) = 1;`),
  },
  cosmeticos: {
    tabela: "cosmeticos",
    oQueE: "pelo número do processo",
    sql: (url) =>
      linhas(`
        SELECT nu_processo, no_produto, no_razao_social_empresa, nu_cnpj_empresa, nu_registro,
          st_situacao_produto, ds_tipo_peticao, st_registrado, dt_vencimento
        FROM read_parquet('${url}')
        WHERE nu_processo = '${PLACEHOLDER}'
        QUALIFY row_number() OVER (PARTITION BY nu_processo ORDER BY st_registrado) = 1;`),
  },
  medicamentos: {
    tabela: "medicamentos_por_produto",
    oQueE: "pelo registro de 9 dígitos",
    sql: (url) =>
      linhas(`
        SELECT id, registro_produto, nome, principio_ativo, categoria_regulatoria, classe_terapeutica,
          empresa, cnpj, processo, ativo, desde, vencimento
        FROM read_parquet('${url}')
        WHERE id = '${PLACEHOLDER}';`),
  },
  produtos_saude: {
    tabela: "produtos_saude_por_produto",
    oQueE: "pelo registro ou cadastro",
    sql: (url) =>
      linhas(`
        SELECT id, registro, nome, nome_tecnico, classe_risco, tipo, empresa, cnpj, processo, ativo,
          publicacao, vencimento, fabricantes
        FROM read_parquet('${url}')
        WHERE id = '${PLACEHOLDER}';`),
  },
};

/** As apresentações de um alimento (ingredientes, alergênicos, embalagem): a segunda consulta da página. */
export const apresentacoesAlimento = (urlAlimentos: string, urlResultado: string): string =>
  linhas(`
    SELECT a.nu_registro, a.marcas, r.ds_forma_fisica, r.tipo_embalagens, r.alergenicos, r.intolerancias,
      r.tabela_nutricional
    FROM read_parquet('${urlAlimentos}') a
    LEFT JOIN read_parquet('${urlResultado}') r USING (co_seq_apresentacao_produto)
    WHERE a.co_seq_produto = ${PLACEHOLDER};`);

/** A consulta de um corredor com o Parquet deste build; sem a tabela no manifest, o caminho fica indicado. */
export function consultaProduto(id: IdCorredor, url: string | null): string {
  const c = CONSULTAS[id];
  return c.sql(url ?? `<caminho de ${c.tabela} no manifest>`);
}
