// A pergunta antes de baixar: o sim guardado no navegador, a espera de quem quer baixar antes dele e o
// tamanho anunciado de cada corredor. O módulo lê o localStorage ao carregar, então cada teste o importa de novo.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Manifest } from "../src/lib/manifest";

function armazenamento(inicial: Record<string, string> = {}): Record<string, string> {
  const dados = { ...inicial };
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => dados[k] ?? null,
    setItem: (k: string, v: string) => (dados[k] = v),
  });
  return dados;
}

async function licenca() {
  vi.resetModules();
  return import("../src/lib/licenca");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("o sim", () => {
  it("sem sim guardado, não baixa e espera até a pessoa aceitar", async () => {
    const dados = armazenamento();
    const l = await licenca();
    expect(l.podeBaixar()).toBe(false);
    let solto = false;
    const espera = l.esperarLicenca().then(() => (solto = true));
    await Promise.resolve();
    expect(solto).toBe(false);
    l.permitirDownload();
    await espera;
    expect(l.podeBaixar()).toBe(true);
    expect(Object.values(dados)).toEqual(["sim"]);
  });

  it("com o sim guardado, nem pergunta", async () => {
    armazenamento({ "contem:baixar-dados": "sim" });
    const l = await licenca();
    expect(l.podeBaixar()).toBe(true);
    await l.esperarLicenca();
  });

  it("sem localStorage, o sim vale para a aba", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    const l = await licenca();
    expect(l.podeBaixar()).toBe(false);
    l.permitirDownload();
    expect(l.podeBaixar()).toBe(true);
    await l.esperarLicenca();
  });
});

describe("o tamanho anunciado", () => {
  const manifest = {
    tables: {
      alimentos: { bytes: 3_000_000 },
      cosmeticos: { bytes: 24_000_000, busca: { bytes: 118_000 } },
      medidas: { bytes: 400_000 },
    },
  } as unknown as Manifest;

  it("motor, tabela do corredor e medidas", async () => {
    const { downloadDe, MOTOR_BYTES } = await licenca();
    expect(downloadDe(manifest, { tabela: "alimentos", tipoProduto: 6 })).toEqual({
      bytes: MOTOR_BYTES + 3_000_000 + 400_000,
      porBusca: false,
    });
    // sem tipoProduto, o corredor não mostra medidas e não as baixa
    expect(downloadDe(manifest, { tabela: "alimentos" }).bytes).toBe(MOTOR_BYTES + 3_000_000);
  });

  it("nos arquivos por palavra, só o começo, não a tabela inteira", async () => {
    const { downloadDe, MOTOR_BYTES } = await licenca();
    const d = downloadDe(manifest, { tabela: "cosmeticos", tipoProduto: 2 });
    expect(d.porBusca).toBe(true);
    expect(d.bytes).toBeLessThan(MOTOR_BYTES + 1_000_000);
  });

  it("o tamanho do motor foi medido na versão instalada", async () => {
    const { MOTOR_VERSAO } = await licenca();
    const pacote = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
    // mudou a versão: medir de novo o .wasm e o worker no jsDelivr (com brotli) e atualizar MOTOR_BYTES
    expect(pacote.dependencies["@duckdb/duckdb-wasm"]).toBe(MOTOR_VERSAO);
  });
});
