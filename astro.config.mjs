// @ts-check
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";

// Domínio próprio no GitHub Pages (configurado nas settings do repositório); o site fica na raiz.
// O sitemap é gerado por src/pages/sitemap-index.xml.ts e sitemap-0.xml.ts, que escolhem as páginas.
export default defineConfig({
  site: "https://contem.abelhaninja.de",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [vue()],
});
