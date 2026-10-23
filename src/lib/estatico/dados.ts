// Só no build: baixa as tabelas do manifest, abre no DuckDB do Node e monta as empresas das páginas
// /empresa/<cnpj>/. Tudo vem de tabelas que o repo `anvisa` deriva a cada build com a mesma definição que
// a ilha: alimentos e saneantes de `produtos`, as medidas de `medidas`, os cosméticos de
// `cosmeticos_por_empresa` (os primeiros de cada CNPJ, pelas regras de sqlCos; 7,6 MB em vez dos 24 MB da
// tabela inteira) com os totais por empresa e do corredor em `empresas`, e quem envasa ou fabrica os
// alimentos de cada empresa de `alimentos_fabricacao` (a envasadora sem produto próprio também ganha página).
// test/derivadas-live.test.ts confere cada uma contra o SQL da ilha. Uma vez por processo (build ou dev);
// qualquer falha derruba o build e o site no ar continua o anterior.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { CORREDORES } from "../../corredores";
import type { IdCorredor } from "../../corredores/tipos";
import { MANIFEST_URL } from "../config";
import { fatiar } from "../format";
import { MEDIDAS_BUSCA, SQL_MEDIDAS, sqlGrupoValidade, sqlNumeros, TABELA_MEDIDAS } from "../consultas";
import type { Numeros } from "../fonte";
import { manifestDoBuild, tabelaUrl, type Manifest } from "../manifest";
import { TABELA_FABRICACAO } from "../../corredores/alimentos/consultas";
import { agrupar, COSMETICOS_POR_EMPRESA, type Empresa, type Entrada } from "./empresas";

/** A tabela derivada do manifest: uma linha por alimento ou saneante, nas mesmas colunas (`area` diz qual). */
const TABELA_PRODUTOS = "produtos";
/** Uma linha por CNPJ com produto ou medida, com as contagens por área. */
const TABELA_EMPRESAS = "empresas";
/** Os primeiros cosméticos de cada CNPJ (`ordem` 1..n, liberados antes, depois nome), um por processo. */
const TABELA_COSMETICOS_EMPRESA = "cosmeticos_por_empresa";

// As linhas das páginas de empresa a partir de `de` (a tabela produtos, ou outra com as mesmas colunas). As
// colunas e os tipos são os do SELECT (getRowObjectsJson: INTEGER e BOOLEAN viram number e boolean, DATE
// vira texto pelo strftime, NULL vira null); a conversão de tipo é o contrato com empresas.ts.
export const sqlAlimentosDe = (de = `"${TABELA_PRODUTOS}"`) =>
  `SELECT id::INTEGER AS id, nome, marcas, categoria, ativo, tipo, processo, registro,
    strftime(desde, '%Y-%m-%d') AS desde, apresentacoes, cnpj, empresa
  FROM ${de} WHERE area = 'alimentos'`;
// (area, id) é única em `produtos` desde o build 20261012T014436Z: a deduplicação de SQL_SAN já vem feita de lá
export const sqlSaneantesDe = (de = `"${TABELA_PRODUTOS}"`) =>
  `SELECT id, nome, ativo, tipo, processo, registro,
    strftime(vencimento, '%Y-%m-%d') AS vencimento, ${sqlGrupoValidade("vencimento")} AS grupo, cnpj, empresa
  FROM ${de} WHERE area = 'saneantes'`;

/** Medicamentos e produtos para saúde: a mesma forma dos saneantes (situação, tipo, validade e números). */
export const sqlMedicamentosDe = (de = `"${TABELA_PRODUTOS}"`) =>
  `SELECT id, nome, ativo, tipo, processo, registro,
    strftime(vencimento, '%Y-%m-%d') AS vencimento, ${sqlGrupoValidade("vencimento")} AS grupo, cnpj, empresa
  FROM ${de} WHERE area = 'medicamentos'`;
export const sqlProdutosSaudeDe = (de = `"${TABELA_PRODUTOS}"`) =>
  `SELECT id, nome, ativo, tipo, processo, registro,
    strftime(vencimento, '%Y-%m-%d') AS vencimento, ${sqlGrupoValidade("vencimento")} AS grupo, cnpj, empresa
  FROM ${de} WHERE area = 'produtos_saude'`;

const DE_PRODUTOS = { ativo: "ativo", cnpj: "cnpj" };

/** Os cosméticos listados em cada página de empresa, de `de` (cosmeticos_por_empresa ou igual). */
export const sqlCosmeticosDe = (de = `"${TABELA_COSMETICOS_EMPRESA}"`) =>
  `SELECT id, nome, ativo, tipo, processo, registro, strftime(vencimento, '%Y-%m-%d') AS vencimento,
    ${sqlGrupoValidade("vencimento")} AS grupo, cnpj, empresa
  FROM ${de} WHERE ordem <= ${COSMETICOS_POR_EMPRESA} ORDER BY cnpj, ordem`;
/** Os totais de cosméticos por empresa, de `empresas`. */
export const sqlCosmeticosTotaisDe = (de = `"${TABELA_EMPRESAS}"`) =>
  `SELECT cnpj, cosmeticos AS produtos, cosmeticos_ativos AS ativos FROM ${de} WHERE cosmeticos > 0`;
/** Os totais do corredor de cosméticos (como sqlNumeros), de `empresas`. */
export const sqlNumerosCosmeticos = (de = `"${TABELA_EMPRESAS}"`) =>
  `SELECT sum(cosmeticos)::INTEGER AS produtos, sum(cosmeticos_ativos)::INTEGER AS ativos,
    (count(*) FILTER (WHERE cosmeticos > 0))::INTEGER AS empresas FROM ${de}`;

/** Quem envasa ou fabrica os alimentos de cada empresa, uma linha por empresa e fabricante, de `de`. */
export const sqlFabricacaoDe = (de = `"${TABELA_FABRICACAO}"`) =>
  `SELECT cnpj, empresa, fabricante_cnpj AS fabricanteCnpj, fabricante_codigo AS fabricanteCodigo, fabricante,
    cidade, pais, vinculo, produtos, produtos_ativos AS produtosAtivos, apresentacoes
  FROM ${de}`;

interface DoBuild {
  empresas: Map<string, Empresa>;
  /** totais de cada corredor (os cosméticos só aqui: a ilha não baixa a tabela inteira) */
  totais: Partial<Record<IdCorredor, Numeros>>;
}

let doBuild: Promise<DoBuild> | undefined;
const umaVez = () => (doBuild ??= carregar());

/** As empresas com produto, medida ou envase, por CNPJ. */
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
    const cosmeticos = TABELA_COSMETICOS_EMPRESA in manifest.tables && TABELA_EMPRESAS in manifest.tables;
    const fabricacao = TABELA_FABRICACAO in manifest.tables;
    const opcionais = [
      ...(medidas ? [TABELA_MEDIDAS] : []),
      ...(cosmeticos ? [TABELA_COSMETICOS_EMPRESA, TABELA_EMPRESAS] : []),
      ...(fabricacao ? [TABELA_FABRICACAO] : []),
    ];
    const nomes = [TABELA_PRODUTOS, ...opcionais];
    // os downloads em paralelo; as views uma a uma, na mesma conexão
    const arquivos = await Promise.all(nomes.map((nome) => baixar(manifest, nome, pasta)));
    for (const [i, nome] of nomes.entries()) {
      await con.run(`CREATE VIEW "${nome}" AS SELECT * FROM read_parquet('${arquivos[i]!.replaceAll("'", "''")}')`);
    }
    if (medidas) await con.run(SQL_MEDIDAS);
    // os corredores novos só contam quando o build de dados já os publicou (a tabela deles no manifest);
    // antes disso `produtos` não tem as áreas e a abertura fica sem números, não com zeros
    const publicada = (id: IdCorredor) => CORREDORES.some((c) => c.id === id && c.tabela in manifest.tables);
    const consultas: [IdCorredor, string][] = [
      ["alimentos", sqlNumeros(`(${sqlAlimentosDe()})`, DE_PRODUTOS)],
      ["saneantes", sqlNumeros(`(${sqlSaneantesDe()})`, DE_PRODUTOS)],
      ...(cosmeticos ? [["cosmeticos", sqlNumerosCosmeticos()] as [IdCorredor, string]] : []),
      ...(publicada("medicamentos")
        ? [["medicamentos", sqlNumeros(`(${sqlMedicamentosDe()})`, DE_PRODUTOS)] as [IdCorredor, string]]
        : []),
      ...(publicada("produtos_saude")
        ? [["produtos_saude", sqlNumeros(`(${sqlProdutosSaudeDe()})`, DE_PRODUTOS)] as [IdCorredor, string]]
        : []),
    ];
    const totais: DoBuild["totais"] = {};
    for (const [id, sql] of consultas) {
      totais[id] = (await con.runAndReadAll(sql)).getRowObjectsJson()[0] as unknown as Numeros;
    }
    return { empresas: agrupar(await ler(con, medidas, cosmeticos, fabricacao)), totais };
  } finally {
    con.closeSync();
    db.closeSync();
    await rm(pasta, { recursive: true, force: true });
  }
}

/** Baixa a tabela, confere como a ilha confere (tamanho do manifest e o rodapé PAR1) e devolve o arquivo. */
async function baixar(m: Manifest, nome: string, pasta: string): Promise<string> {
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
  return arquivo;
}

const CORREDOR_DO_TIPO = new Map<number, IdCorredor>(
  CORREDORES.flatMap((c) => (c.tipoProduto ? [[c.tipoProduto, c.id] as const] : [])),
);

async function ler(
  con: DuckDBConnection,
  medidas: boolean,
  cosmeticos: boolean,
  fabricacao: boolean,
): Promise<Entrada> {
  const linhas = async <T>(sql: string) => (await con.runAndReadAll(sql)).getRowObjectsJson() as T[];

  const alimentos = await linhas<Entrada["alimentos"][number]>(sqlAlimentosDe());
  const saneantes = await linhas<Entrada["saneantes"][number]>(sqlSaneantesDe());
  // `produtos` sem as áreas novas (build de dados anterior) devolve listas vazias: as páginas ficam sem a seção
  const medicamentos = await linhas<NonNullable<Entrada["medicamentos"]>[number]>(sqlMedicamentosDe());
  const produtosSaude = await linhas<NonNullable<Entrada["produtosSaude"]>[number]>(sqlProdutosSaudeDe());
  // 1,19 milhão de cosméticos não cabem em páginas (nem na memória do build como objetos): cada empresa
  // lista os primeiros, liberados antes, e leva os totais para o resumo
  const cos = cosmeticos ? await linhas<Entrada["cosmeticos"][number]>(sqlCosmeticosDe()) : [];
  const cosmeticosTotais = cosmeticos ? await linhas<Entrada["cosmeticosTotais"][number]>(sqlCosmeticosTotaisDe()) : [];
  // sem a tabela no manifest, nenhuma página ganha a seção Fabricação nem a envasadora sem produto
  const fab = fabricacao ? await linhas<NonNullable<Entrada["fabricacao"]>[number]>(sqlFabricacaoDe()) : [];
  const base = {
    alimentos,
    saneantes,
    cosmeticos: cos,
    cosmeticosTotais,
    medicamentos,
    produtosSaude,
    fabricacao: fab,
  };
  if (!medidas) return { ...base, medidas: [] };

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
    FROM ${MEDIDAS_BUSCA} WHERE cnpj IS NOT NULL AND tipo IN (${tipos})`,
  );
  return {
    ...base,
    medidas: brutas.map((x) => ({
      corredor: CORREDOR_DO_TIPO.get(x.tipo)!,
      produto: x.produto,
      acoes: fatiar(x.acoes, "|"),
      data: x.data,
      cnpj: x.cnpj,
      empresa: x.empresa ?? "",
    })),
  };
}
