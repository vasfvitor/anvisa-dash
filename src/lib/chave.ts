// A chave de um nome e o slug de uma URL, pela regra que o repo `anvisa` usa ao gravar `chave` em
// produtos_saude_fabricacao e `fabricantes_chaves` em produtos_saude_por_produto: os casos de
// test/fixtures/chaves.json (cópia do fixtures/dados/chaves.json de lá) valem dos dois lados. Puro: a ilha
// (link do fabricante na página do dispositivo) e o build (rota /fabricante/<slug>/) montam o mesmo slug.
import { normalizarPalavras } from "./palavras";

/** "Zhejiang Guo-Bang Pharm. Co., Ltd." → "zhejiangguobangpharmcoltd": sem acento, minúsculo, só [a-z0-9]. */
export function chave(texto: string | null | undefined): string {
  return texto ? normalizarPalavras(texto).replace(/[^a-z0-9]/g, "") : "";
}

/** "INGLATERRA (REINO UNIDO)" → "inglaterra-reino-unido": como a chave, com um hífen onde havia separador. */
export function slug(texto: string | null | undefined): string {
  return texto
    ? normalizarPalavras(texto)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "";
}

/**
 * O segmento de /fabricante/<slug>/: a chave do nome, "-" e o slug do país; sem país, só a chave. A chave não tem
 * hífen, então o primeiro separa os dois. Depende só de duas colunas que a linha do produto traz
 * (fabricantes_chaves e fabricantes_paises): a ilha monta o endereço sem baixar nada a mais. Ilegível, mas
 * estável: a grafia mais frequente do nome muda entre builds, a chave não.
 */
export function slugFabricante(chaveNome: string, pais: string | null | undefined): string {
  const p = slug(pais);
  return p ? `${chaveNome}-${p}` : chaveNome;
}
