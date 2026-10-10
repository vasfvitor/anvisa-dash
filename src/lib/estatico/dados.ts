// Só no build: baixa as tabelas do manifest, abre no DuckDB do Node e monta as empresas das páginas
// /empresa/<cnpj>/. As tabelas derivadas vêm do mesmo SQL da ilha (consultas.ts), então produto, situação e
// deduplicação batem com a busca. Uma vez por processo (build ou dev); qualquer falha derruba o build e o
// site no ar continua o anterior.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { CORREDORES } from "../../corredores";
import { SQL_PRODUTOS, TABELA as ALIMENTOS } from "../../corredores/alimentos/consultas";
import { sqlCos, TABELA as COSMETICOS } from "../../corredores/cosmeticos/consultas";
import { SQL_SAN, TABELA as SANEANTES } from "../../corredores/saneantes/consultas";
import type { IdCorredor } from "../../corredores/tipos";
import { MANIFEST_URL } from "../config";
import { SQL_MEDIDAS, sqlNumeros, TABELA_MEDIDAS } from "../consultas";
import type { Numeros } from "../fonte";
import { manifestDoBuild, tabelaUrl, type Manifest } from "../manifest";
import { agrupar, COSMETICOS_POR_EMPRESA, type Empresa, type Entrada } from "./empresas";

interface DoBuild {
  empresas: Map<string, Empresa>;
  /** totais de cada corredor (os cosméticos só aqui: a ilha não baixa a tabela inteira) */
  totais: Partial<Record<IdCorredor, Numeros>>;
}

let doBuild: Promise<DoBuild> | undefined;
const umaVez = () => (doBuild ??= carregar());

/** As empresas com produto, por CNPJ. */
export async function empresasDoBuild(): Promise<Map<string, Empresa>> {
  return (await umaVez()).empresas;
}

/** Liberados, total e empresas de cada corredor, como estavam os dados no build. */
export async function totaisDoBuild(): Promise<Partial<Record<IdCorredor, Numeros>>> {
  return (await umaVez()).totais;
}

async function carregar(): Promise<DoBuild> {
  const manifest = await manifestDoBuild(MANIFEST_URL);
  const pasta = await mkdtemp(join(tmpdir(), "contem-"));
  const db = await DuckDBInstance.create(":memory:");
  const con = await db.connect();
  try {
    // tabela que o manifest ainda não tem fica sem seção, sem derrubar o build
    const medidas = TABELA_MEDIDAS in manifest.tables;
    const cosmeticos = COSMETICOS in manifest.tables;
    const opcionais = [...(medidas ? [TABELA_MEDIDAS] : []), ...(cosmeticos ? [COSMETICOS] : [])];
    for (const nome of [ALIMENTOS, SANEANTES, ...opcionais]) {
      await abrir(con, manifest, nome, pasta);
    }
    await con.run(SQL_PRODUTOS);
    await con.run(SQL_SAN);
    if (medidas) await con.run(SQL_MEDIDAS);
    if (cosmeticos) await con.run(`CREATE TABLE cos AS ${sqlCos(`"${COSMETICOS}"`)}`);
    const derivadas: [IdCorredor, string][] = [
      ["alimentos", "produtos"],
      ["saneantes", "san"],
      ...(cosmeticos ? [["cosmeticos", "cos"] as [IdCorredor, string]] : []),
    ];
    const totais: DoBuild["totais"] = {};
    for (const [id, tabela] of derivadas) {
      totais[id] = (await con.runAndReadAll(sqlNumeros(tabela))).getRowObjectsJson()[0] as unknown as Numeros;
    }
    return { empresas: agrupar(await ler(con, medidas, cosmeticos)), totais };
  } finally {
    con.closeSync();
    db.closeSync();
    await rm(pasta, { recursive: true, force: true });
  }
}

/** Baixa a tabela, confere como a ilha confere (tamanho do manifest e o rodapé PAR1) e cria a view. */
async function abrir(con: DuckDBConnection, m: Manifest, nome: string, pasta: string): Promise<void> {
  const url = tabelaUrl(MANIFEST_URL, m, nome);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${nome}: HTTP ${res.status} em ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const fim = new TextDecoder().decode(bytes.subarray(-4));
  if (bytes.length !== m.tables[nome]!.bytes || fim !== "PAR1") {
    throw new Error(`${nome}: arquivo incompleto (${bytes.length} de ${m.tables[nome]!.bytes} bytes)`);
  }
  const arquivo = join(pasta, `${nome}.parquet`);
  await writeFile(arquivo, bytes);
  await con.run(`CREATE VIEW "${nome}" AS SELECT * FROM read_parquet('${arquivo.replaceAll("'", "''")}')`);
}

const CORREDOR_DO_TIPO = new Map<number, IdCorredor>(
  CORREDORES.flatMap((c) => (c.tipoProduto ? [[c.tipoProduto, c.id] as const] : [])),
);

// as colunas e os tipos de cada linha são os do SELECT (getRowObjectsJson: INTEGER e BOOLEAN viram number e
// boolean, NULL vira null); a conversão de tipo é o contrato entre o SQL e empresas.ts
async function ler(con: DuckDBConnection, medidas: boolean, cosmeticos: boolean): Promise<Entrada> {
  const linhas = async <T>(sql: string) => (await con.runAndReadAll(sql)).getRowObjectsJson() as T[];

  const alimentos = await linhas<Entrada["alimentos"][number]>(
    `SELECT co_seq_produto::INTEGER AS id, no_produto AS nome, marcas, ds_categoria_produto AS categoria,
      situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo, nu_processo AS processo,
      nu_registro_notificacao_produto AS registro, left(dt_regularizacao, 10) AS desde,
      n_apresentacoes AS apresentacoes, nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
    FROM produtos`,
  );
  const saneantes = await linhas<Entrada["saneantes"][number]>(
    `SELECT id, no_produto AS nome, situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo,
      nu_processo AS processo, nu_registro_produto AS registro, dt_vencimento AS vencimento, grupo,
      nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
    FROM san`,
  );
  // 1,19 milhão de cosméticos não cabem em páginas (nem na memória do build como objetos): cada empresa
  // lista os primeiros, liberados antes, e leva os totais para o resumo
  const cos = cosmeticos
    ? await linhas<Entrada["cosmeticos"][number]>(
        `SELECT id, no_produto AS nome, situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo,
          nu_processo AS processo, nu_registro AS registro, dt_vencimento AS vencimento, grupo,
          nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
        FROM cos
        QUALIFY row_number() OVER (PARTITION BY nu_cnpj_empresa ORDER BY situacao_registro, no_produto, id)
          <= ${COSMETICOS_POR_EMPRESA}`,
      )
    : [];
  const cosmeticosTotais = cosmeticos
    ? await linhas<Entrada["cosmeticosTotais"][number]>(
        `SELECT nu_cnpj_empresa AS cnpj, count(*)::INTEGER AS produtos,
          (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos
        FROM cos GROUP BY 1`,
      )
    : [];
  if (!medidas) return { alimentos, saneantes, cosmeticos: cos, cosmeticosTotais, medidas: [] };

  const tipos = [...CORREDOR_DO_TIPO.keys()].join(", ");
  const brutas = await linhas<{
    tipo: number;
    produto: string;
    acoes: string;
    data: string;
    cnpj: string;
    empresa: string | null;
  }>(
    `SELECT tipo::INTEGER AS tipo, produto, acoes, dt_ultima AS data, cnpj, empresa
    FROM medidas WHERE cnpj IS NOT NULL AND tipo IN (${tipos})`,
  );
  return {
    alimentos,
    saneantes,
    cosmeticos: cos,
    cosmeticosTotais,
    medidas: brutas.map((x) => ({
      corredor: CORREDOR_DO_TIPO.get(x.tipo)!,
      produto: x.produto,
      acoes: x.acoes ? x.acoes.split("|") : [],
      data: x.data,
      cnpj: x.cnpj,
      empresa: x.empresa ?? "",
    })),
  };
}
