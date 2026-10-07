// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";

// GitHub Pages de projeto serve em https://<user>.github.io/anvisa-dash/; o workflow passa os dois.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://vasfvitor.github.io",
  base: process.env.SITE_BASE ?? "/anvisa-dash",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  // /saneantes/ só redireciona para /limpeza/: fica fora do sitemap
  integrations: [vue(), sitemap({ filter: (p) => !p.endsWith("/saneantes/") })],
});
