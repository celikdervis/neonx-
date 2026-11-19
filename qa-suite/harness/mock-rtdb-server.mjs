// NEON XI QA — MOCK Realtime Database server (in-process, 127.0.0.1 only).
// Not Firebase: no security rules, no persistence, a single in-memory tree.
// Every write is applied atomically on the Node event loop, transactions use
// compare-and-set on the canonical value (like the RTDB hash check), and
// onDisconnect operations run when a client's event stream closes.
import http from 'node:http';
import { canonical, getAt, normalize, setAt, splitPath, exportVal } from './mock-modules/rtdb-shared.js';

export async function startMockRtdb() {
  let tree = null, rev = 0;
  const clients = new Map();   // cid -> { res, onDisconnect: Map(id -> op) }
  const log = [];
  const record = (entry) => log.push({ t: Date.now(), rev, ...entry });

  const applyOps = (ops, now = Date.now()) => {
    for (const op of ops) tree = setAt(tree, splitPath(op.path), normalize(op.value, now));
    rev++;
  };
  const broadcast = () => {
    const data = `event: tree\ndata: ${JSON.stringify({ rev, tree })}\n\n`;
    for (const c of clients.values()) if (c.res) c.res.write(data);
  };
  const runDisconnectOps = (cid) => {
    const c = clients.get(cid);
    if (!c) return;
    const ops = [...c.onDisconnect.values()].flat();
    c.onDisconnect.clear();
    if (ops.length) { applyOps(ops); record({ kind: 'onDisconnect', cid, ops }); broadcast(); }
  };

  const readBody = (req) => new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', d => { raw += d; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
  });
  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST' });
      return res.end();
    }
    try {
      if (url.pathname === '/events') {
        const cid = url.searchParams.get('cid');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
        const c = clients.get(cid) || { onDisconnect: new Map() };
        c.res = res;
        clients.set(cid, c);
        record({ kind: 'connect', cid });
        res.write(`event: tree\ndata: ${JSON.stringify({ rev, tree })}\n\n`);
        req.on('close', () => {
          if (clients.get(cid)?.res !== res) return;
          c.res = null;
          record({ kind: 'disconnect', cid });
          runDisconnectOps(cid);
        });
        return;
      }
      if (url.pathname === '/get') {
        return send(res, 200, { rev, value: getAt(tree, splitPath(url.searchParams.get('path'))) });
      }
      const body = req.method === 'POST' ? await readBody(req) : {};
      if (url.pathname === '/write') {
        applyOps(body.ops);
        record({ kind: 'write', cid: body.cid, ops: body.ops });
        broadcast();
        return send(res, 200, { ok: true, rev });
      }
      if (url.pathname === '/cas') {
        const segs = splitPath(body.path), current = getAt(tree, segs);
        if (canonical(current) !== body.expect) {
          record({ kind: 'cas-conflict', cid: body.cid, path: body.path });
          return send(res, 200, { ok: false, rev, current });
        }
        applyOps([{ path: body.path, value: body.value }]);
        record({ kind: 'transaction', cid: body.cid, path: body.path, value: body.value });
        broadcast();
        return send(res, 200, { ok: true, rev, value: getAt(tree, segs) });
      }
      if (url.pathname === '/ondisconnect') {
        const c = clients.get(body.cid) || { res: null, onDisconnect: new Map() };
        clients.set(body.cid, c);
        if (body.action === 'cancel') {
          for (const [id, ops] of c.onDisconnect) if (ops.some(op => op.path === body.path || op.path.startsWith(body.path.replace(/\/$/, '') + '/'))) c.onDisconnect.delete(id);
        } else {
          c.onDisconnect.set(body.id, body.ops);
        }
        return send(res, 200, { ok: true });
      }
      send(res, 404, { error: 'unknown endpoint' });
    } catch (error) {
      send(res, 500, { error: String(error?.message || error) });
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    log,
    /** Read the stored (normalized) value at a path, as the test oracle. */
    get(path = '') { return exportVal(getAt(tree, splitPath(path))); },
    /** Seed test preconditions directly (recorded in the log as a seed). */
    seed(path, value) { applyOps([{ path, value }]); record({ kind: 'seed', path }); broadcast(); },
    connectedClients() { return [...clients.entries()].filter(([, c]) => c.res).map(([cid]) => cid); },
    pendingDisconnectOps(cid) { return [...(clients.get(cid)?.onDisconnect.values() || [])].flat(); },
    async close() {
      for (const c of clients.values()) c.res?.end();
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections?.();
      await closed;
    },
  };
}
