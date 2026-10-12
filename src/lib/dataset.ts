// Uma tabela do manifest como Dataset (schema.org), o que o Google Dataset Search lê no dicionário de dados.
// Só o que se sabe com segurança: sem licença (a ANVISA não declara uma nos arquivos; o `license.data` do
// manifest só diz de onde os dados vêm) e sem cobertura temporal. As descrições das colunas são as do
// manifest (escritas no repo `anvisa`, desde o build 20261012T000746Z).
import type { Tabela } from "./manifest";

/** Uma tabela do manifest no dicionário de dados: o título e o texto da seção, que também viram o Dataset. */
export interface InfoTabela {
  /** nome legível da tabela (a chave do manifest aparece ao lado) */
  titulo: string;
  /** o que é uma linha; o Google pede ao menos 50 caracteres no Dataset */
  descricao: string;
  /** termos do Dataset; ANVISA, dados abertos e Parquet entram em todas */
  palavras: string[];
}

const ANVISA = {
  "@type": "Organization",
  name: "Agência Nacional de Vigilância Sanitária (ANVISA)",
  url: "https://www.gov.br/anvisa",
};

/**
 * O Dataset de uma tabela. `pagina` é a URL do dicionário (a âncora da seção vira @id e url) e
 * `parquet` a URL do arquivo; as colunas levam a descrição que o manifest traz.
 */
export function conjuntoDados(
  nome: string,
  t: Tabela,
  info: InfoTabela,
  { pagina, parquet, atualizado }: { pagina: string; parquet: string; atualizado: string },
) {
  const id = `${pagina}#${nome}`;
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": id,
    url: id,
    name: info.titulo,
    alternateName: nome,
    description: info.descricao,
    keywords: [...info.palavras, "ANVISA", "dados abertos", "Parquet"],
    inLanguage: "pt-BR",
    spatialCoverage: { "@type": "Place", name: "Brasil" },
    dateModified: atualizado,
    isBasedOn: t.source.url,
    creator: ANVISA,
    variableMeasured: t.columns.map((c) => ({
      "@type": "PropertyValue",
      name: c.name,
      ...(c.description ? { description: c.description } : {}),
    })),
    distribution: [{ "@type": "DataDownload", encodingFormat: "application/vnd.apache.parquet", contentUrl: parquet }],
  };
}
