// O sitemap, gerado no build no lugar do @astrojs/sitemap (que lista toda página sem saber o que ela tem):
// as páginas fixas e as listas de A a Z com o lastmod do build de dados, porque os números mudam a cada um, e
// só as páginas de empresa que valem indexar (indexavel, em empresas.ts), e as de fabricante com duas
// detentoras ou mais (indexavelFabricante, em fabricantes.ts). As de empresa e de fabricante vão sem lastmod: a
// maioria não muda de um build para outro, e um lastmod sempre igual à data do build é ignorado pelo Google.
import type { APIRoute } from "astro";
import { CORREDORES, rotaDo } from "../corredores";
import { MANIFEST_URL } from "../lib/config";
import { empresasDoBuild, fabricantesDoBuild } from "../lib/estatico/dados";
import { indexavel, porLetra } from "../lib/estatico/empresas";
import { indexavelFabricante } from "../lib/estatico/fabricantes";
import { url } from "../lib/format";
import { manifestDoBuild } from "../lib/manifest";

/** Uma entrada do sitemap; `lastmod` no formato W3C (o built_at do manifest já é um instante ISO com Z). */
const entrada = (loc: string, lastmod?: string) =>
  `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;

export const GET: APIRoute = async ({ site }) => {
  const { built_at } = await manifestDoBuild(MANIFEST_URL);
  const empresas = [...(await empresasDoBuild()).values()];
  const fabricantes = [...(await fabricantesDoBuild()).values()];
  const letras = [...porLetra(empresas)]
    .filter(([, lista]) => lista.length > 0)
    .map(([letra]) => `/empresas/${letra}/`);
  const doBuild = [
    url("/"),
    ...CORREDORES.map(rotaDo),
    url("/dicionario/"),
    url("/sobre/"),
    url("/empresas/"),
    ...letras.map(url),
  ];
  const absoluta = (caminho: string) => new URL(caminho, site).href;
  const corpo = [
    ...doBuild.map((p) => entrada(absoluta(p), built_at)),
    ...empresas.filter(indexavel).map((e) => entrada(absoluta(url(`/empresa/${e.cnpj}/`)))),
    ...fabricantes.filter(indexavelFabricante).map((f) => entrada(absoluta(url(`/fabricante/${f.slug}/`)))),
  ].join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${corpo}</urlset>\n`,
    { headers: { "Content-Type": "application/xml" } },
  );
};
