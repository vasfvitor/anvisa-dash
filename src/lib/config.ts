// Produção lê os dados publicados pelo repo `anvisa`; em desenvolvimento aponte para um build local:
// PUBLIC_MANIFEST_URL=http://localhost:8000/manifest.json pnpm dev
export const MANIFEST_URL: string =
  import.meta.env.PUBLIC_MANIFEST_URL || "https://vasfvitor.github.io/anvisa-api/manifest.json";
