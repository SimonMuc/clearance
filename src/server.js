import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, fail } from './store.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100000) throw fail(413, 'This entry is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw fail(400, 'Invalid JSON.'); }
}
export function createApp({ store, appUrl = process.env.APP_URL || '', osUrl = process.env.OS_URL || 'https://website.tailf4e733.ts.net' }) {
  return http.createServer(async (req, res) => {
    const send = (status, value, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      res.end(req.method === 'HEAD' ? undefined : (type.startsWith('application/json') ? JSON.stringify(value) : value));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Open Clearance to make changes.');
        const origin = req.headers.origin;
        const allowed = new Set([`http://${req.headers.host}`, `https://${req.headers.host}`]);
        if (appUrl) allowed.add(new URL(appUrl).origin);
        if (origin && !allowed.has(origin)) throw fail(403, 'Open Clearance to make changes.');
        if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Expected JSON.');
      }
      if (route === '/healthz' && req.method === 'GET') return send(200, 'ok', 'text/plain');
      if (route === '/api/config' && req.method === 'GET') return send(200, { osUrl });
      if (route === '/api/entries' && req.method === 'GET') return send(200, store.list());
      if (route === '/api/entries' && req.method === 'POST') return send(201, store.add(await readJson(req)));
      const match = /^\/api\/entries\/([a-f0-9-]+)$/.exec(route);
      if (match && req.method === 'PATCH') return send(200, store.update(match[1], await readJson(req)));
      if (route === '/api/widget' && req.method === 'GET') {
        const entries = store.list().filter(e => !e.archived);
        return send(200, { title: 'In view', state: entries.length ? 'ok' : 'idle', value: String(entries.length), lines: entries.slice(0, 4).map(e => e.title.slice(0, 120)), url: '/' });
      }
      if (route.startsWith('/api/')) throw fail(404, 'Not found.');
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Method not allowed.');
      const publicRoot = path.join(root, 'public');
      const file = path.resolve(publicRoot, '.' + (route === '/' ? '/index.html' : decodeURIComponent(route)));
      if (!file.startsWith(publicRoot + path.sep)) throw fail(404, 'Not found.');
      let data; try { data = readFileSync(file); } catch { throw fail(404, 'Not found.'); }
      return send(200, data, mime[path.extname(file)] || 'application/octet-stream');
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = openStore(path.join(process.env.DATA_DIR || path.join(root, 'data'), 'clearance.sqlite'));
  const server = createApp({ store });
  const port = Number(process.env.PORT || 8795);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Clearance: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
