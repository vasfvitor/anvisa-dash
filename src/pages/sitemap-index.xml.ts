// O índice de sitemaps, no mesmo endereço que o @astrojs/sitemap usava (é o que está no robots.txt, no
// <link rel="sitemap"> e no Search Console), apontando o único sitemap (sitemap-0.xml.ts).
import type { APIRoute } from "astro";
import { url } from "../lib/format";

export const GET: APIRoute = ({ site }) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${new URL(url("/sitemap-0.xml"), site).href}</loc></sitemap></sitemapindex>\n`,
    { headers: { "Content-Type": "application/xml" } },
  );
