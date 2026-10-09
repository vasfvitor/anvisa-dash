// O build_id do manifest com que o site foi gerado. O cron do workflow compara com o manifest ao vivo e só
// refaz o site quando o pipeline de dados publicou um build novo.
import type { APIRoute } from "astro";
import { MANIFEST_URL } from "../lib/config";
import { manifestDoBuild } from "../lib/manifest";

export const GET: APIRoute = async () => {
  const { build_id } = await manifestDoBuild(MANIFEST_URL);
  return new Response(`${JSON.stringify({ build_id })}\n`, { headers: { "Content-Type": "application/json" } });
};
