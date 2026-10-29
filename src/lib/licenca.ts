// A busca só baixa depois que a pessoa aceita (manifest, motor e tabelas: nada antes do sim). O sim fica
// guardado no navegador para sempre; sem ele, a ilha pergunta de novo a cada visita. Sem localStorage (aba
// anônima, armazenamento bloqueado), o sim vale até fechar a aba.
import { TABELA_MEDIDAS } from "./consultas";
import type { Manifest } from "./manifest";

const CHAVE = "contem:baixar-dados";

/**
 * O motor como chega pela rede, com brotli: o .wasm e o worker do DuckDB-WASM (jsDelivr) e a extensão de
 * Parquet, que o DuckDB baixa de extensions.duckdb.org no primeiro read_parquet. Medido em 2026-10-29 na
 * versão MOTOR_VERSAO: eh 7.124.338 + 188.570 + 522.051 bytes; mvp 7.053.959 + 159.790 + 502.416. Um teste
 * compara a versão com a do package.json, para medir de novo quando ela mudar.
 */
export const MOTOR_BYTES = 7_840_000;
export const MOTOR_VERSAO = "1.33.1-dev57.0";

function guardado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "sim";
  } catch {
    return false;
  }
}

let sim = guardado();
let soltar: (() => void) | undefined;
const liberado = sim ? Promise.resolve() : new Promise<void>((r) => (soltar = r));

/** Se a pessoa já aceitou baixar (nesta aba ou numa visita anterior). */
export const podeBaixar = (): boolean => sim;

/** O sim: guarda e solta quem esperava por ele. */
export function permitirDownload(): void {
  sim = true;
  try {
    localStorage.setItem(CHAVE, "sim");
  } catch {
    // sem armazenamento, vale até fechar a aba
  }
  soltar?.();
}

/** Resolve quando a pessoa aceitar (na hora, se já aceitou). */
export const esperarLicenca = (): Promise<void> => liberado;

export interface Download {
  /** o que a primeira busca baixa: o motor, a tabela do corredor e as medidas de fiscalização */
  bytes: number;
  /** a busca baixa arquivos por palavra (os cosméticos): cada busca nova baixa um pouco mais */
  porBusca: boolean;
}

/**
 * O que a primeira busca de um corredor baixa, pelo manifest do build. Os tamanhos do manifest são os dos
 * arquivos; pela rede vai menos, porque o Pages manda gzip. Abrir um produto pode baixar mais uma tabela
 * (os preços da CMED, as análises dos alimentos), que não entra aqui.
 */
export function downloadDe(m: Manifest, c: { tabela: string; tipoProduto?: number }): Download {
  const t = m.tables[c.tabela];
  // os arquivos por palavra: de início só o índice e a lista de empresas, menos de 250 KB juntos (fonteIndice)
  const tabela = t?.busca ? 250_000 : (t?.bytes ?? 0);
  const medidas = c.tipoProduto ? (m.tables[TABELA_MEDIDAS]?.bytes ?? 0) : 0;
  return { bytes: MOTOR_BYTES + tabela + medidas, porBusca: Boolean(t?.busca) };
}
