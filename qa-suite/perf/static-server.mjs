// Static server for performance measurements only. It approximates GitHub
// Pages (production host): gzip for text types, Cache-Control max-age=600,
// ETag revalidation. The project's own scripts/preview-server.cjs sends
// uncompressed files with no-store, which would distort transfer sizes and
// make warm-cache measurements impossible.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg\+xml)/;

export async function startStaticServer(root, { port = 0 } = {}) {
  const cache = new Map();
  const server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); } catch { res.writeHead(400).end(); return; }
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    let entry = cache.get(file);
    if (!entry) {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
      const body = fs.readFileSync(file);
      const type = TYPES[path.extname(file)] || 'application/octet-stream';
      entry = { body, type, gz: COMPRESSIBLE.test(type) ? zlib.gzipSync(body, { level: 6 }) : null, etag: '"' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 16) + '"' };
      cache.set(file, entry);
    }
    const headers = { 'Content-Type': entry.type, 'Cache-Control': 'max-age=600', ETag: entry.etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304, headers).end(); return; }
    const gzipOk = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gzipOk) headers['Content-Encoding'] = 'gzip';
    const out = gzipOk ? entry.gz : entry.body;
    headers['Content-Length'] = out.length;
    res.writeHead(200, headers);
    res.end(out);
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}
