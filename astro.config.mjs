// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";

// Domínio próprio no GitHub Pages (configurado nas settings do repositório); o site fica na raiz.
export default defineConfig({
  site: "https://contem.abelhaninja.de",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [vue(), sitemap()],
});
