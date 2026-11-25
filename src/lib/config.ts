// Produção lê os dados publicados pelo repo `anvisa`; em desenvolvimento aponte para um build local:
// PUBLIC_MANIFEST_URL=http://localhost:8000/manifest.json pnpm dev
export const MANIFEST_URL: string =
  import.meta.env.PUBLIC_MANIFEST_URL || "https://vasfvitor.github.io/anvisa-api/manifest.json";

// The site's repository: the "Código do site" link and the problem reports (issues) go to it.
export const REPO = "https://github.com/vasfvitor/anvisa-dash";
// Where to report a problem without a GitHub account (the same address on the five health sites).
export const RELATO_EMAIL = "ajuda@abelhaninja.de";
