// Serve um build local do `anvisa dados build` imitando o GitHub Pages (medido em 2026-10-06). O site
// em `pnpm dev` roda noutra origem, então precisa de CORS, que o http.server do Python não envia. O
// app hoje só faz GET inteiro; Range e HEAD ficam imitados para testar leitura parcial no futuro.
// O que o Pages faz e este servidor repete:
// - Access-Control-Allow-Origin: *, sem Expose-Headers;
// - GET com Range responde 206;
// - HEAD ignora Range e responde 200 com o tamanho inteiro;
// - OPTIONS (preflight) responde 405.
//   node scripts/dados-local.mjs <dir> [porta=8000]
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const raiz = resolve(process.argv[2] ?? "dados");
const porta = Number(process.argv[3] ?? 8000);
const TIPOS = { ".json": "application/json", ".parquet": "application/octet-stream", ".html": "text/html" };

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    console.log(req.method, req.url, 405);
    return res.writeHead(405).end();
  }

  const caminho = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const arquivo = join(raiz, caminho);
  let st;
  try {
    if (!arquivo.startsWith(raiz)) throw new Error("fora da raiz");
    st = statSync(arquivo);
    if (!st.isFile()) throw new Error("não é arquivo");
  } catch {
    console.log(req.method, req.url, 404);
    return res.writeHead(404).end();
  }
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "max-age=600");
  res.setHeader("Content-Type", TIPOS[extname(arquivo)] ?? "application/octet-stream");

  // como o Pages: HEAD ignora Range
  const m = req.method === "HEAD" ? null : /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  let ini = 0;
  let fim = st.size - 1;
  if (m) {
    if (m[1] === "") ini = Math.max(0, st.size - Number(m[2]));
    else {
      ini = Number(m[1]);
      if (m[2] !== "") fim = Math.min(fim, Number(m[2]));
    }
    if (ini > fim) {
      res.setHeader("Content-Range", `bytes */${st.size}`);
      return res.writeHead(416).end();
    }
    res.setHeader("Content-Range", `bytes ${ini}-${fim}/${st.size}`);
  }
  res.setHeader("Content-Length", fim - ini + 1);
  res.writeHead(m ? 206 : 200);
  console.log(req.method, req.url, m ? `206 ${ini}-${fim}` : 200);
  if (req.method === "HEAD") return res.end();
  createReadStream(arquivo, { start: ini, end: fim }).pipe(res);
}).listen(porta, () => console.log(`dados em http://localhost:${porta}/manifest.json (raiz ${raiz})`));
