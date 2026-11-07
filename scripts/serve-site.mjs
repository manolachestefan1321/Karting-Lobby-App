// Shows the built website (apps/mobile/dist) locally, the way Netlify / Cloudflare Pages serve it:
// compressed files, /join → join.html, the app's addresses → app.html (from _redirects),
// fingerprinted files cached. Run `npm run site:build` first, then `npm run site:preview`.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = fileURLToPath(new URL('../apps/mobile/dist', import.meta.url));
const port = Number(process.env.PORT || 8080);
if (!existsSync(join(dist, 'index.html'))) {
  console.error('apps/mobile/dist not found: run `npm run site:build` first.');
  process.exit(1);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };
const rules = existsSync(join(dist, '_redirects'))
  ? readFileSync(join(dist, '_redirects'), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.trim().split(/\s+/))
  : [];
const matches = (pattern, path) => (pattern.endsWith('/*') ? path === pattern.slice(0, -2) || path.startsWith(pattern.slice(0, -1)) : path === pattern);

function resolve(urlPath) {
  const path = decodeURIComponent(urlPath.split('?')[0]).replace(/\/$/, '') || '/';
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [safe === '/' ? '/index.html' : safe, `${safe}.html`, `${safe}/index.html`]) {
    const file = join(dist, candidate);
    if (file.startsWith(dist) && existsSync(file) && statSync(file).isFile()) return file;
  }
  const rule = rules.find(([from]) => matches(from, path));
  return rule ? join(dist, rule[1]) : null;
}

createServer((req, res) => {
  const file = resolve(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  let data = readFileSync(file);
  const type = TYPES[extname(file)] || 'application/octet-stream';
  const headers = { 'Content-Type': type };
  headers['Cache-Control'] = /\/(_expo|assets|fonts|site)\//.test(req.url || '') ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/gzip/.test(req.headers['accept-encoding'] || '') && !/image\/png/.test(type)) {
    data = gzipSync(data);
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = data.length;
  res.writeHead(200, headers).end(data);
}).listen(port, () => console.log(`KartUP website: http://localhost:${port}  (waitlist at / and /join, the app at /welcome)`));
