import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const ROOT = process.cwd();
const PORT = Number(process.env['API_PORT'] || 3000);
const OUT_DIR = path.join(ROOT, '.angular', 'api-dev');

function loadEnv(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv('.env.local');
loadEnv('.env');

async function loadRoute(urlPath) {
  const rel = urlPath.replace(/^\/+/, '').replace(/\.ts$/, '');
  const entry = path.join(ROOT, rel + '.ts');
  if (!entry.startsWith(path.join(ROOT, 'api') + path.sep) || !fs.existsSync(entry)) return null;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outfile = path.join(OUT_DIR, rel.replace(/[\\/]/g, '_') + '.mjs');
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    const mod = await loadRoute(url.pathname);
    const method = (req.method || 'GET').toUpperCase();
    const fn = mod?.[method];
    if (typeof fn !== 'function') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `Route introuvable : ${method} ${url.pathname}` }));
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length && method !== 'GET' && method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
    }
    const webRes = await fn(new Request(url.toString(), { method, headers, body }));
    res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
    res.end(Buffer.from(await webRes.arrayBuffer()));
  } catch (err) {
    console.error('[api-dev]', err);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api-dev] Fonctions /api prêtes sur http://127.0.0.1:${PORT}`);
});

