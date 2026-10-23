// As tabelas derivadas do repo `anvisa` (produtos, empresas, medidas, alimentos_fabricacao, e, quando a pasta as
// tem, produtos_saude_fabricacao e certificados) contra o SQL da ilha ou as tabelas cruas, sobre os dados reais.
// Só roda com DADOS_LIVE apontando para uma pasta com os .parquet de TABELAS (baixados do manifest ao vivo); sem
// ela, fica de fora (não há rede no CI). As de OPCIONAIS só entram quando a pasta as tem.
// Primeira rodada em 2026-10-11 contra o build 20261012T000746Z; o que deve bater está no handoff
// ~/SharedFiles/agent/dados-produto/PROMPT.md.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SQL_PRODUTOS } from "../src/corredores/alimentos/consultas";
import { chave } from "../src/lib/chave";
import { chaveSql, sqlPalavras } from "../src/lib/palavras";
import { TS } from "../src/lib/consultas";
import { sqlCos } from "../src/corredores/cosmeticos/consultas";
import { SQL_SAN } from "../src/corredores/saneantes/consultas";
import { MEDIDAS_BUSCA, SQL_MEDIDAS, sqlNumeros } from "../src/lib/consultas";
import { SQL_PS } from "../src/corredores/produtos_saude/consultas";
import {
  sqlAlimentosDe,
  sqlCertificadosDe,
  sqlCosmeticosDe,
  sqlCosmeticosTotaisDe,
  sqlFabricacaoDispositivosDe,
  sqlNumerosCosmeticos,
  sqlSaneantesDe,
} from "../src/lib/estatico/dados";
import { agrupar, COSMETICOS_POR_EMPRESA, indexavel, totalProdutos, type Entrada } from "../src/lib/estatico/empresas";
import { indexarFabricantes, type LinhaFabricacaoDispositivo } from "../src/lib/estatico/fabricantes";
import type { Numeros } from "../src/lib/fonte";
import { deJson, resumirAlergia, type Sinal } from "../src/corredores/alimentos/alergia";

const pasta = process.env.DADOS_LIVE;
const TABELAS = [
  "alimentos",
  "alimentos_resultado",
  "saneantes",
  "cosmeticos",
  "produtos_irregulares",
  "produtos",
  "empresas",
  "medidas",
  "cosmeticos_por_empresa",
  "alimentos_por_produto",
  "alimentos_fabricacao",
];
// as do build de dados de 2026-10-23: sem elas na pasta, os testes delas ficam de fora
const OPCIONAIS = ["produtos_saude", "produtos_saude_por_produto", "produtos_saude_fabricacao", "certificados"];

// a tabela produtos como a ilha a derivava de alimentos até 2026-10-12 (SQL_PRODUTOS antigo): a referência de
// tudo o que a ilha lê hoje de alimentos_por_produto (busca e busca_nome no formato ' a b c ' de sqlPalavras,
// como a ilha passou a escrever em 710284c)
const SQL_PRODUTOS_ANTIGO = `CREATE TABLE produtos AS
    SELECT co_seq_produto,
      any_value(no_produto) AS no_produto,
      any_value(marcas) AS marcas,
      any_value(no_razao_social_empresa) AS no_razao_social_empresa,
      any_value(nu_cnpj_empresa) AS nu_cnpj_empresa,
      any_value(nu_processo) AS nu_processo,
      any_value(nu_registro_notificacao_produto) AS nu_registro_notificacao_produto,
      any_value(ds_categoria_produto) AS ds_categoria_produto,
      any_value(ds_categoria_produto) AS grupo,
      any_value(tipo_regularizacao) AS tipo_regularizacao,
      any_value(situacao_registro) AS situacao_registro,
      any_value(ds_situacao_assunto_doc) AS ds_situacao_assunto_doc,
      any_value(ds_alegacao_funcional) AS ds_alegacao_funcional,
      ${TS("min(dt_regularizacao)", "dt_regularizacao")},
      ${TS("max(dt_publicacao)", "dt_publicacao")},
      ${TS("max(dt_situacao)", "dt_situacao")},
      ${TS("min(dt_inicio_analise)", "dt_inicio_analise")},
      strftime(max(dt_vencimento_registro), '%Y-%m-%d') AS dt_vencimento_registro,
      count(*)::INTEGER AS n_apresentacoes,
      min(dt_regularizacao) AS ordem_data,
      list(nu_registro) FILTER (WHERE nu_registro IS NOT NULL) AS registros,
      ${sqlPalavras("concat_ws(' ', any_value(no_produto), any_value(marcas), any_value(no_razao_social_empresa))")} AS busca,
      ${sqlPalavras("any_value(no_produto)")} AS busca_nome,
      ';' || array_to_string(list_transform(string_split(coalesce(any_value(marcas), ''), ';'),
        x -> lower(strip_accents(trim(x)))), ';') || ';' AS busca_marcas
    FROM "alimentos"
    GROUP BY co_seq_produto`;

// o resumo de alergênicos como a ilha o montava (corredores/alimentos/fonte.ts até 2026-10-12): a referência das colunas novas
const SQL_RESUMO = `CREATE TABLE resumo AS
    SELECT co_produto AS co_seq_produto,
      to_json(list(DISTINCT alergenicos) FILTER (WHERE alergenicos <> ''))::VARCHAR AS alergenicos_json,
      to_json(list(DISTINCT intolerancias) FILTER (WHERE intolerancias <> ''))::VARCHAR AS intolerancias_json
    FROM "alimentos_resultado" GROUP BY co_produto`;

// o que a ilha e o build derivavam de produtos_irregulares até 2026-10-11 (lib/consultas.ts): a referência
const SQL_MEDIDAS_ANTIGO = `CREATE TABLE medidas_antigo AS
    SELECT co_tipo_produto AS tipo, co_seq_dossie_investig_med AS dossie, prod AS produto,
      any_value(no_empresa_investigada) AS empresa,
      any_value(nu_cnpj_empresa_investigada) FILTER (WHERE regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{14}') AND nu_cnpj_empresa_investigada <> '00000000000000') AS cnpj,
      coalesce(bool_or(regexp_full_match(nu_cnpj_empresa_investigada, '[0-9]{11}')), false) AS pessoa,
      any_value(nullif(regexp_replace(registro, '[^0-9]', '', 'g'), '')) AS registro,
      any_value(nu_processo) AS processo, any_value(ds_risco_produto) AS risco,
      array_to_string(list_sort(list(DISTINCT ds_acao_fiscalizacao) FILTER (WHERE ds_acao_fiscalizacao IS NOT NULL)), '|') AS acoes,
      array_to_string(list_sort(list(DISTINCT ds_atividade_fiscalizacao) FILTER (WHERE ds_atividade_fiscalizacao IS NOT NULL)), '|') AS atividades,
      strftime(min(dt_publicacao), '%Y-%m-%d') AS dt_primeira, strftime(max(dt_publicacao), '%Y-%m-%d') AS dt_ultima
    FROM (SELECT *, trim(produto) AS prod FROM "produtos_irregulares") WHERE coalesce(prod, '') <> ''
    GROUP BY co_tipo_produto, co_seq_dossie_investig_med, prod`;
const pronta = !!pasta && TABELAS.every((t) => existsSync(join(pasta, `${t}.parquet`)));
const comOpcionais = pronta && OPCIONAIS.every((t) => existsSync(join(pasta, `${t}.parquet`)));

describe.skipIf(!pronta)("derivadas do repo anvisa contra o SQL da ilha (DADOS_LIVE)", () => {
  let instancia: DuckDBInstance;
  let con: DuckDBConnection;
  const linhas = async <T>(sql: string) => (await con.runAndReadAll(sql)).getRowObjectsJson() as T[];
  const uma = async <T>(sql: string) => (await linhas<T>(sql))[0]!;
  const contar = async (sql: string) => (await uma<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM (${sql})`)).n;
  /** quantas linhas de `a` não estão em `b` */
  const diferentes = (a: string, b: string) => contar(`(${a}) EXCEPT ALL (${b})`);
  // o que o build lê de produtos (o Parquet do manifest fica como `produtos_pub`: a ilha chama sua derivada de `produtos`)
  const DE_PRODUTOS = { ativo: "ativo", cnpj: "cnpj" };
  const novoAlimentos = sqlAlimentosDe("produtos_pub");
  const novoSaneantes = sqlSaneantesDe("produtos_pub");

  beforeAll(async () => {
    instancia = await DuckDBInstance.create(":memory:");
    con = await instancia.connect();
    for (const t of comOpcionais ? [...TABELAS, ...OPCIONAIS] : TABELAS) {
      const arquivo = join(pasta!, `${t}.parquet`).replaceAll("'", "''");
      // o Parquet "produtos" do manifest fica como `produtos_pub`: a ilha chama sua derivada de `produtos`
      const nome = t === "produtos" ? "produtos_pub" : t;
      await con.run(`CREATE VIEW "${nome}" AS SELECT * FROM read_parquet('${arquivo}')`);
    }
    // a ilha de hoje (produtos_novo, de alimentos_por_produto) e a de antes (produtos, de alimentos)
    await con.run(SQL_PRODUTOS);
    await con.run("ALTER TABLE produtos RENAME TO produtos_novo");
    await con.run(SQL_PRODUTOS_ANTIGO);
    await con.run(SQL_SAN);
    await con.run(SQL_MEDIDAS);
    await con.run(SQL_MEDIDAS_ANTIGO);
    await con.run(`CREATE TABLE cos AS ${sqlCos('"cosmeticos"')}`);
  }, 120_000);
  afterAll(() => {
    con.closeSync();
    instancia.closeSync();
  });

  it("totais do build (de produtos) batem com sqlNumeros das derivadas da ilha", async () => {
    const totais = (de: string) => uma<Numeros>(sqlNumeros(`(${de})`, DE_PRODUTOS));
    expect(await totais(novoAlimentos)).toEqual(await uma(sqlNumeros("produtos")));
    expect(await totais(novoSaneantes)).toEqual(await uma(sqlNumeros("san")));
    // (area, id) única: os 6 expedientes em par da origem ficam com a linha registrada, como em SQL_SAN
    expect(await contar("SELECT area, id FROM produtos_pub GROUP BY ALL HAVING count(*) > 1")).toBe(0);
  });

  // as colunas de alergênicos de produtos são o resumirAlergia da ilha, produto a produto
  it("alergênicos em produtos batem com resumirAlergia sobre alimentos_resultado", async () => {
    await con.run(SQL_RESUMO);
    interface Linha {
      id: string;
      gluten: string | null;
      lactose: string | null;
      contem: string[] | null;
      pode_conter: string[] | null;
      nao_contem: string[] | null;
      alergia_varia: boolean | null;
      alergenicos_json: string | null;
      intolerancias_json: string | null;
    }
    const todas = await linhas<Linha>(
      `SELECT p.id, p.gluten, p.lactose, p.contem, p.pode_conter, p.nao_contem, p.alergia_varia,
         r.alergenicos_json, r.intolerancias_json
       FROM produtos_pub p LEFT JOIN resumo r ON r.co_seq_produto = p.id::INTEGER WHERE p.area = 'alimentos'`,
    );
    const SINAL: Record<string, Sinal> = { Sim: "sim", Não: "nao", Varia: "varia" };
    const erros: string[] = [];
    let comDados = 0;
    for (const l of todas) {
      const r = resumirAlergia(deJson(l.alergenicos_json), deJson(l.intolerancias_json));
      const esperado = r.temDados
        ? {
            gluten: r.gluten,
            lactose: r.lactose,
            contem: r.contem,
            podeConter: r.podeConter,
            naoContem: r.naoContem,
            varia: r.varia,
          }
        : { gluten: null, lactose: null, contem: null, podeConter: null, naoContem: null, varia: null };
      const lista = (xs: string[] | null) => xs && [...xs].sort((a, b) => a.localeCompare(b, "pt-BR"));
      const visto = {
        gluten: l.gluten && SINAL[l.gluten],
        lactose: l.lactose && SINAL[l.lactose],
        contem: lista(l.contem),
        podeConter: lista(l.pode_conter),
        naoContem: lista(l.nao_contem),
        varia: l.alergia_varia,
      };
      if (r.temDados) comDados++;
      if (JSON.stringify(visto) !== JSON.stringify(esperado))
        erros.push(`${l.id}: ${JSON.stringify({ visto, esperado })}`);
    }
    expect(erros.slice(0, 3)).toEqual([]);
    expect(await contar("SELECT 1 FROM produtos_pub WHERE contem IS NOT NULL")).toBe(comDados);
    console.log("alimentos com dados de alergênicos:", comDados, "de", todas.length);
  });

  it("cosméticos em empresas: processos distintos, ativos pela regra de sqlCos", async () => {
    const e = await uma<Numeros>(sqlNumerosCosmeticos("empresas"));
    const { n } = await uma<{ n: number }>(`SELECT count(DISTINCT nu_processo)::INTEGER AS n FROM cosmeticos`);
    expect(e.produtos).toBe(n);
    expect(e).toEqual(await uma(sqlNumeros("cos")));
  });

  // alimentos_por_produto: produtos (só alimentos) mais o que a ilha derivava de alimentos em SQL_PRODUTOS
  it("alimentos_por_produto é produtos nos alimentos, mais as colunas da ilha", async () => {
    const app = "alimentos_por_produto";
    const comuns =
      "area, id, nome, marcas, empresa, cnpj, processo, registro, ativo, tipo, categoria, desde, vencimento, apresentacoes, registros, gluten, lactose, contem, pode_conter, nao_contem, alergia_varia";
    const a = `SELECT ${comuns} FROM ${app}`;
    const b = `SELECT ${comuns} FROM produtos_pub WHERE area = 'alimentos'`;
    expect(await diferentes(a, b)).toBe(0);
    expect(await diferentes(b, a)).toBe(0);
    expect(await contar(`SELECT 1 FROM ${app} WHERE situacao_assunto IS NULL`)).toBe(0);
    // as cinco colunas novas e desde, contra a derivada da ilha (SQL_PRODUTOS sobre alimentos)
    // (vencimento: 141 alimentos têm apresentações com datas diferentes; os dois lados ficam com a maior,
    // a renovação mais recente, desde o build 20261012T024410Z)
    const ilha = `SELECT co_seq_produto::VARCHAR AS id, ds_situacao_assunto_doc AS situacao_assunto,
        ds_alegacao_funcional AS alegacao, dt_publicacao AS publicacao, dt_situacao AS situacao_em,
        dt_inicio_analise AS inicio_analise, dt_vencimento_registro AS vencimento,
        strftime(ordem_data, '%Y-%m-%d') AS desde
      FROM produtos`;
    const nova = `SELECT id, situacao_assunto, alegacao, strftime(publicacao, '%Y-%m-%dT%H:%M:%S') AS publicacao,
        strftime(situacao_em, '%Y-%m-%dT%H:%M:%S') AS situacao_em,
        strftime(inicio_analise, '%Y-%m-%dT%H:%M:%S') AS inicio_analise,
        strftime(vencimento, '%Y-%m-%d') AS vencimento, strftime(desde, '%Y-%m-%d') AS desde
      FROM ${app}`;
    expect(await diferentes(ilha, nova)).toBe(0);
    expect(await diferentes(nova, ilha)).toBe(0);
  });

  // a ilha lendo alimentos_por_produto dá a mesma tabela produtos que lendo alimentos: coluna por coluna
  it("SQL_PRODUTOS sobre alimentos_por_produto é o SQL_PRODUTOS antigo sobre alimentos", async () => {
    // dt_regularizacao e ordem_data: antes com hora (min do timestamp), agora só a data (desde). registros:
    // antes NULL sem nenhum e na ordem das apresentações, agora [] e em ordem; list_contains lê igual
    const colunas = `co_seq_produto, no_produto, marcas, no_razao_social_empresa, nu_cnpj_empresa, nu_processo,
      nu_registro_notificacao_produto, ds_categoria_produto, grupo, tipo_regularizacao, situacao_registro,
      ds_situacao_assunto_doc, ds_alegacao_funcional, left(dt_regularizacao, 10) AS dt_regularizacao,
      dt_publicacao, dt_situacao, dt_inicio_analise, dt_vencimento_registro, n_apresentacoes,
      ordem_data::DATE AS ordem_data, list_sort(coalesce(registros, [])) AS registros, busca, busca_nome, busca_marcas`;
    const antes = `SELECT ${colunas} FROM produtos`;
    const agora = `SELECT ${colunas} FROM produtos_novo`;
    expect(await diferentes(antes, agora)).toBe(0);
    expect(await diferentes(agora, antes)).toBe(0);
    expect(await uma(sqlNumeros("produtos_novo"))).toEqual(await uma(sqlNumeros("produtos")));
  });

  // cosmeticos_por_empresa: o que o build listava da tabela inteira (dados.ts até 2026-10-12), já cortado
  it("cosmeticos_por_empresa são os primeiros de cada CNPJ pela regra do build, com ordem 1..n", async () => {
    const cpe = "cosmeticos_por_empresa";
    // ordem contígua a partir de 1, sem repetir
    expect(
      await contar(
        `SELECT cnpj FROM ${cpe} GROUP BY cnpj
         HAVING min(ordem) <> 1 OR max(ordem) <> count(*) OR count(DISTINCT ordem) <> count(*)`,
      ),
    ).toBe(0);
    // liberados antes: nenhum ativo depois de um inativo
    expect(
      await contar(
        `SELECT 1 FROM ${cpe} a JOIN ${cpe} b USING (cnpj) WHERE a.ordem < b.ordem AND NOT a.ativo AND b.ativo`,
      ),
    ).toBe(0);
    // cada empresa com cosmético está, com min(total, teto) linhas; nenhuma a mais
    expect(
      await contar(
        `SELECT 1 FROM (SELECT cnpj, count(*) AS n FROM ${cpe} GROUP BY cnpj) c
         FULL JOIN (SELECT cnpj, cosmeticos FROM empresas WHERE cosmeticos > 0) e USING (cnpj)
         WHERE n IS DISTINCT FROM least(cosmeticos, ${COSMETICOS_POR_EMPRESA})`,
      ),
    ).toBe(0);
    // as linhas e os totais são os que o build tirava de cos (sqlCos sobre a tabela inteira)
    const antigo = `SELECT id, no_produto AS nome, situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo,
        nu_processo AS processo, nu_registro AS registro, dt_vencimento AS vencimento, grupo,
        nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
      FROM cos
      QUALIFY row_number() OVER (PARTITION BY nu_cnpj_empresa ORDER BY situacao_registro, no_produto, id)
        <= ${COSMETICOS_POR_EMPRESA}`;
    const novo = sqlCosmeticosDe(cpe);
    expect(await diferentes(antigo, novo)).toBe(0);
    expect(await diferentes(novo, antigo)).toBe(0);
    const totaisAntigos = `SELECT nu_cnpj_empresa AS cnpj, count(*)::INTEGER AS produtos,
        (count(*) FILTER (WHERE situacao_registro = 'Ativo'))::INTEGER AS ativos FROM cos GROUP BY 1`;
    expect(await diferentes(totaisAntigos, sqlCosmeticosTotaisDe("empresas"))).toBe(0);
    expect(await diferentes(sqlCosmeticosTotaisDe("empresas"), totaisAntigos)).toBe(0);
  });

  it("registros nunca é nulo", async () => {
    expect(await contar("SELECT 1 FROM produtos_pub WHERE registros IS NULL")).toBe(0);
  });

  // o que o build lia das derivadas da ilha (dados.ts até 2026-10-11) é o que lê de produtos: nenhuma linha difere
  it("as linhas das páginas de empresa saem iguais de produtos e do SQL da ilha", async () => {
    const antigoAlimentos = `SELECT co_seq_produto::INTEGER AS id, no_produto AS nome, marcas, ds_categoria_produto AS categoria,
        situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo, nu_processo AS processo,
        nu_registro_notificacao_produto AS registro, left(dt_regularizacao, 10) AS desde,
        n_apresentacoes AS apresentacoes, nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
      FROM produtos`;
    const antigoSaneantes = `SELECT id, no_produto AS nome, situacao_registro = 'Ativo' AS ativo, tipo_regularizacao AS tipo,
        nu_processo AS processo, nu_registro_produto AS registro, dt_vencimento AS vencimento, grupo,
        nu_cnpj_empresa AS cnpj, no_razao_social_empresa AS empresa
      FROM san`;
    expect(await diferentes(antigoAlimentos, novoAlimentos)).toBe(0);
    expect(await diferentes(novoAlimentos, antigoAlimentos)).toBe(0);
    expect(await diferentes(antigoSaneantes, novoSaneantes)).toBe(0);
    expect(await diferentes(novoSaneantes, antigoSaneantes)).toBe(0);
  });

  // a tabela medidas do manifest, lida por medidas_busca, dá as mesmas linhas que a derivação antiga
  it("medidas do manifest batem com a derivação antiga de produtos_irregulares", async () => {
    // atividades: sem nenhuma, a derivação antiga dava NULL e a lista vazia dá ''; a ilha lê os dois como []
    const colunas =
      "tipo, dossie, produto, cnpj, pessoa, processo, risco, acoes, coalesce(atividades, '') AS atividades, dt_primeira, dt_ultima";
    const nova = `SELECT ${colunas} FROM ${MEDIDAS_BUSCA}`;
    const antiga = `SELECT ${colunas} FROM medidas_antigo`;
    expect(await diferentes(nova, antiga)).toBe(0);
    expect(await diferentes(antiga, nova)).toBe(0);
    // a empresa: igual fora as pessoas, e nula nelas (medidas.ts confia nisso e não repete a regra)
    expect(
      await contar(
        `SELECT 1 FROM ${MEDIDAS_BUSCA} n JOIN medidas_antigo a USING (tipo, dossie, produto)
         WHERE NOT n.pessoa AND n.empresa IS DISTINCT FROM a.empresa`,
      ),
    ).toBe(0);
    expect(await contar(`SELECT 1 FROM ${MEDIDAS_BUSCA} WHERE pessoa AND empresa IS NOT NULL`)).toBe(0);
    // o registro antigo (um por linha) está na lista nova; a lista traz mais em alguns pares
    const r = await uma<{ faltando: number; com_mais: number }>(
      `SELECT (count(*) FILTER (WHERE a.registro IS NOT NULL AND NOT list_contains(n.registros, a.registro)))::INTEGER AS faltando,
         (count(*) FILTER (WHERE len(n.registros) > 1))::INTEGER AS com_mais
       FROM ${MEDIDAS_BUSCA} n JOIN medidas_antigo a USING (tipo, dossie, produto)`,
    );
    expect(r.faltando).toBe(0);
    console.log("medidas com mais de um registro citado:", r.com_mais);
  });

  // alimentos_fabricacao refeita das tabelas cruas: os pares (detentora, envasadora) das apresentações com produto,
  // a detentora como em alimentos_por_produto (o menor CNPJ do produto)
  it("alimentos_fabricacao tem os pares de envasadora das tabelas cruas, e empresas conta os dois lados", async () => {
    const pares = `WITH produto AS (SELECT co_seq_produto, min(nu_cnpj_empresa) AS cnpj FROM alimentos GROUP BY ALL),
        ap AS (SELECT DISTINCT co_seq_apresentacao_produto, co_seq_produto FROM alimentos),
        itens AS (
          SELECT co_seq_apresentacao_produto,
            regexp_extract(trim(x), ';\\s*([0-9]{14})$', 1) AS fabricante_cnpj
          FROM (SELECT co_seq_apresentacao_produto, unnest(string_split(empresas_envasadoras, '|')) AS x
            FROM alimentos_resultado)
        )
      SELECT DISTINCT p.cnpj, i.fabricante_cnpj
      FROM itens i JOIN ap USING (co_seq_apresentacao_produto) JOIN produto p USING (co_seq_produto)
      WHERE i.fabricante_cnpj <> ''`;
    const derivados = "SELECT cnpj, fabricante_cnpj FROM alimentos_fabricacao WHERE fabricante_cnpj IS NOT NULL";
    expect(await contar(derivados)).toBe(await contar(pares));
    expect(await diferentes(pares, derivados)).toBe(0);
    expect(await diferentes(derivados, pares)).toBe(0);
    // toda envasadora de outra empresa tem linha em empresas (e página no site)
    expect(
      await contar(
        `SELECT 1 FROM alimentos_fabricacao WHERE vinculo <> 'propria' AND fabricante_cnpj IS NOT NULL
         AND fabricante_cnpj NOT IN (SELECT cnpj FROM empresas)`,
      ),
    ).toBe(0);
    const r = await uma<{ para: number; por: number; linhas: number }>(
      `SELECT (SELECT sum(envasa_para) FROM empresas)::INTEGER AS para,
         (SELECT sum(envasado_por) FROM empresas)::INTEGER AS por,
         (SELECT count(*) FROM alimentos_fabricacao WHERE vinculo IN ('grupo', 'terceira'))::INTEGER AS linhas`,
    );
    expect(r.para).toBe(r.linhas);
    expect(r.por).toBe(r.linhas);
  });

  // onde empresas e o site divergem por definição, para quem for avaliar trocar a agregação do build
  it("relata empresas contra a agregação do site", async () => {
    const r = await uma<Record<string, number>>(
      `WITH site AS (
         SELECT cnpj FROM produtos_pub
         UNION SELECT nu_cnpj_empresa FROM cos
         UNION SELECT cnpj FROM ${MEDIDAS_BUSCA} WHERE cnpj IS NOT NULL AND tipo IN (6, 3, 2)
       )
       SELECT (SELECT count(*) FROM empresas)::INTEGER AS empresas,
         (SELECT count(*) FROM site)::INTEGER AS site,
         (SELECT count(*) FROM empresas WHERE cnpj NOT IN (SELECT cnpj FROM site))::INTEGER AS so_em_empresas,
         (SELECT count(*) FROM site WHERE cnpj NOT IN (SELECT cnpj FROM empresas))::INTEGER AS so_no_site,
         (SELECT count(*) FROM empresas WHERE produtos = 0)::INTEGER AS so_medidas`,
    );
    console.log("empresas × site:", r);
    expect(r.so_no_site).toBe(0);
  });

  // produtos_saude_fabricacao refeita da tabela crua: os pares (detentora, chave, país) com os registros, a
  // chave igual em JS e no SQL do site, e a regra de quem tem página igual na ilha e no build
  it.skipIf(!comOpcionais)("produtos_saude_fabricacao: pares, chaves e páginas de fabricante", async () => {
    const psf = "produtos_saude_fabricacao";
    const crua = `SELECT cnpj, chave, pais, count(DISTINCT registro)::INTEGER AS registros,
        min(chave_empresa) = chave AND pais = 'BRASIL' AS propria
      FROM (SELECT cnpj_detentor_registro_cadastro AS cnpj, ${chaveSql("nome_fabricante")} AS chave,
          nome_pais_fabric AS pais, numero_registro_cadastro AS registro,
          ${chaveSql("detentor_registro_cadastro")} AS chave_empresa
        FROM produtos_saude WHERE nome_fabricante IS NOT NULL)
      GROUP BY cnpj, chave, pais`;
    const derivada = `SELECT cnpj, chave, pais, registros, vinculo = 'propria' AS propria FROM ${psf}`;
    expect(await diferentes(crua, derivada)).toBe(0);
    expect(await diferentes(derivada, crua)).toBe(0);
    expect(await contar(`SELECT 1 FROM ${psf} WHERE (vinculo = 'exterior') <> (pais <> 'BRASIL')`)).toBe(0);
    // a chave do site (JS e SQL) é a do repo `anvisa`
    expect(await contar(`SELECT 1 FROM ${psf} WHERE ${chaveSql("fabricante")} <> chave`)).toBe(0);
    const todas = await linhas<LinhaFabricacaoDispositivo>(sqlFabricacaoDispositivosDe());
    expect(todas.filter((l) => chave(l.fabricante) !== l.chave).slice(0, 3)).toEqual([]);
    // a regra de página (indexarFabricantes, a mesma na ilha) contra a contagem em SQL por chave e país
    const paginas = indexarFabricantes(todas);
    const { n } = await uma<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM (SELECT chave, pais FROM ${psf} GROUP BY ALL
       HAVING count(DISTINCT cnpj) FILTER (WHERE vinculo <> 'propria') >= 2)`,
    );
    expect(paginas.size).toBe(n);
    console.log("produtos_saude_fabricacao:", todas.length, "pares,", paginas.size, "fabricantes com página");
  });

  // as três listas de produtos_saude_por_produto alinhadas, e o texto da ilha (sqlPs) sem perder posição
  it.skipIf(!comOpcionais)("produtos_saude_por_produto: fabricantes, chaves e países alinhados", async () => {
    const ppp = "produtos_saude_por_produto";
    expect(
      await contar(
        `SELECT 1 FROM ${ppp} WHERE fabricantes IS NULL OR len(fabricantes) <> len(fabricantes_chaves)
         OR len(fabricantes) <> len(fabricantes_paises)`,
      ),
    ).toBe(0);
    const comFabricante = await linhas<{ fabricantes: string[]; chaves: string[]; paises: (string | null)[] }>(
      `SELECT fabricantes, fabricantes_chaves AS chaves, fabricantes_paises AS paises FROM ${ppp} WHERE len(fabricantes) > 0`,
    );
    const erros: string[] = [];
    for (const l of comFabricante) {
      l.fabricantes.forEach((texto, i) => {
        const pais = l.paises[i];
        const nome = pais && texto.endsWith(` (${pais})`) ? texto.slice(0, -pais.length - 3) : texto;
        if (chave(nome) !== l.chaves[i]) erros.push(`${texto} → ${l.chaves[i]}`);
      });
    }
    expect(erros.slice(0, 3)).toEqual([]);
    await con.run(SQL_PS);
    expect(
      await contar(
        `SELECT 1 FROM ps WHERE fabricantes <> '' AND (len(string_split(fabricantes, '|')) <> len(string_split(fabricantes_chaves, '|'))
           OR len(string_split(fabricantes, '|')) <> len(string_split(fabricantes_paises, '|')))`,
      ),
    ).toBe(0);
  });

  // certificados: as regras que a página de empresa supõe, e o que ela monta com eles
  it.skipIf(!comOpcionais)("certificados: vínculo, código, vigência, linhas e área coerentes", async () => {
    const c = "certificados";
    expect(await contar(`SELECT id FROM ${c} GROUP BY id HAVING count(*) > 1`)).toBe(0);
    expect(await contar(`SELECT 1 FROM ${c} WHERE NOT regexp_full_match(cnpj, '[0-9]{14}')`)).toBe(0);
    const vinculo = `CASE
        WHEN inspecionada_cnpj = cnpj THEN 'propria'
        WHEN left(inspecionada_cnpj, 8) = left(cnpj, 8) THEN 'grupo'
        WHEN inspecionada_cnpj IS NOT NULL THEN 'terceira'
        WHEN inspecionada_codigo IS NOT NULL THEN 'exterior'
        ELSE 'desconhecida' END`;
    expect(await contar(`SELECT 1 FROM ${c} WHERE vinculo IS DISTINCT FROM ${vinculo}`)).toBe(0);
    expect(
      await contar(`SELECT 1 FROM ${c} WHERE inspecionada_cnpj IS NOT NULL AND inspecionada_codigo IS NOT NULL`),
    ).toBe(0);
    expect(await contar(`SELECT 1 FROM ${c} WHERE NOT regexp_full_match(inspecionada_codigo, '[ABC][0-9]{6}')`)).toBe(
      0,
    );
    expect(
      await contar(`SELECT 1 FROM ${c} WHERE vigente AND (cancelado OR validade IS NULL OR validade < dados_de)`),
    ).toBe(0);
    expect(await contar(`SELECT 1 FROM ${c} WHERE vigente IS NULL OR cancelado IS NULL`)).toBe(0);
    expect(await contar(`SELECT 1 FROM ${c} WHERE area <> 'medicamentos' AND len(linhas) > 0`)).toBe(0);
    expect(
      await contar(`SELECT 1 FROM ${c} WHERE list_bool_or(list_transform(linhas, lambda x: contains(x, '|')))`),
    ).toBe(0);
    expect(
      await contar(
        `SELECT 1 FROM ${c} WHERE area NOT IN ('produtos_saude', 'insumos', 'medicamentos', 'cosmeticos', 'saneantes', 'alimentos', 'outros')`,
      ),
    ).toBe(0);

    // o que o build monta: quem só tem certificado ganha página, e cada certificado aparece numa só lista
    const certificados = await linhas<NonNullable<Entrada["certificados"]>[number]>(sqlCertificadosDe());
    const empresas = agrupar({
      alimentos: await linhas<Entrada["alimentos"][number]>(novoAlimentos),
      saneantes: await linhas<Entrada["saneantes"][number]>(novoSaneantes),
      cosmeticos: [],
      cosmeticosTotais: [],
      medidas: [],
      certificados,
    });
    let pedidos = 0;
    let soCertificado = 0;
    let indexaveis = 0;
    for (const e of empresas.values()) {
      pedidos +=
        e.fabricasCertificadas.reduce((n, p) => n + p.certificados.length, 0) + e.certificadosSemFabrica.length;
      if (totalProdutos(e) === 0 && e.envasaPara.length === 0) {
        soCertificado++;
        if (indexavel(e)) indexaveis++;
      }
    }
    expect(pedidos).toBe(certificados.length);
    console.log(
      `certificados: ${certificados.length}; empresas sem alimento nem produto de limpeza: ${soCertificado} (${indexaveis} indexáveis)`,
    );
  });
});
