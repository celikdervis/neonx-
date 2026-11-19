// NEON XI QA — MOCK of https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js
// Not Firebase. Talks to qa-suite/harness/mock-rtdb-server.mjs on 127.0.0.1.
//
// Behaviour reproduced from the real SDK:
//  * set/update/remove apply locally at once (optimistic) and are sent in order;
//    their promises resolve after the server acknowledges them.
//  * update() validation (including the ancestor-path check) and value
//    validation throw synchronously, exactly where the real SDK throws.
//  * runTransaction runs the update function on the local cache first and
//    re-runs it with the server value on conflict (max 25 tries); returning
//    undefined aborts with committed:false.
//  * onDisconnect operations belong to the current connection and run when it
//    drops; they are not re-registered after a reconnect.
//  * While offline, writes queue locally and `.info/connected` is false.
// Known differences: no security rules, no query API, transactions ignore
// applyLocally (always behave as applyLocally:false), disconnect detection is
// immediate instead of after a socket timeout.
import {
  SERVER_TIMESTAMP, canonical, clone, exportVal, getAt, joinPath, normalize, pushId,
  setAt, sortedKeys, splitPath, validatePath, validateUpdate, validateValue,
} from './rtdb-shared.js';

const CFG = globalThis.__NX_MOCK__ || {};
const BASE = CFG.rtdb;
const S = (globalThis.__NX_MOCK_DB__ ||= {
  cid: 'c_' + (crypto.randomUUID?.() || String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 16),
  serverTree: null, serverRev: -1, view: null,
  pending: [], seq: 0, listeners: new Set(),
  connected: false, online: true, es: null,
  readyResolve: null, ready: null, revWaiters: [], onlineWaiters: [],
  sendChain: Promise.resolve(), firing: false, again: false, db: null,
});
S.ready ||= new Promise(r => { S.readyResolve = r; });

// ---------- connection ----------
function openStream() {
  if (!BASE) { console.error('[NX mock] window.__NX_MOCK__.rtdb is not set'); return; }
  const es = new EventSource(`${BASE}/events?cid=${S.cid}`);
  S.es = es;
  es.addEventListener('tree', ev => {
    if (S.es !== es) return;
    const { rev, tree } = JSON.parse(ev.data);
    S.serverTree = tree;
    S.serverRev = rev;
    S.pending = S.pending.filter(w => !(w.ackRev !== null && w.ackRev <= rev));
    const wasConnected = S.connected;
    S.connected = true;
    S.readyResolve?.();
    S.revWaiters = S.revWaiters.filter(w => (rev >= w.rev ? (w.resolve(), false) : true));
    recompute();
    if (!wasConnected) fire();
  });
  es.onerror = () => {
    if (S.es !== es) return;
    if (S.connected) { S.connected = false; fire(); }
  };
}
function whenOnline() {
  if (S.online && S.connected) return Promise.resolve();
  return new Promise(resolve => S.onlineWaiters.push(resolve));
}
function flushOnlineWaiters() {
  if (!(S.online && S.connected)) return;
  const waiters = S.onlineWaiters.splice(0);
  waiters.forEach(r => r());
}
function waitForRev(rev) {
  if (S.serverRev >= rev) return Promise.resolve();
  return new Promise(resolve => S.revWaiters.push({ rev, resolve }));
}
async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cid: S.cid, ...body }) });
  const json = await res.json();
  if (!res.ok) throw new Error(`[NX mock] ${endpoint}: ${json.error || res.status}`);
  return json;
}

// Test control: simulated network loss of this page only.
globalThis.__NX_MOCK_NET__ = {
  drop() { S.online = false; S.es?.close(); S.es = null; S.connected = false; fire(); },
  restore() { S.online = true; openStream(); },
  get online() { return S.online; },
  get connected() { return S.connected; },
  get cid() { return S.cid; },
  pendingWrites() { return S.pending.length; },
};

// ---------- local view & events ----------
function recompute() {
  let view = S.serverTree;
  for (const w of S.pending) for (const op of w.local) view = setAt(view, splitPath(op.path), op.value);
  S.view = view;
  fire();
  flushOnlineWaiters();
}
function valueAt(segs) {
  if (segs[0] === '.info') {
    if (segs[1] === 'connected') return S.connected;
    if (segs[1] === 'serverTimeOffset') return 0;
    return null;
  }
  return getAt(S.view, segs);
}
function fire() {
  if (S.firing) { S.again = true; return; }
  S.firing = true;
  try {
    do {
      S.again = false;
      for (const l of [...S.listeners]) if (S.listeners.has(l)) deliver(l);
    } while (S.again);
  } finally { S.firing = false; }
}
function deliver(l) {
  const info = l.segs[0] === '.info';
  if (!info && S.serverRev < 0) return;
  const stored = valueAt(l.segs);
  if (l.kind === 'value') {
    const key = canonical(stored);
    if (l.last === key) return;
    l.last = key;
    if (l.onlyOnce) S.listeners.delete(l);
    safeCall(l.cb, new DataSnapshot(l.ref, stored));
  } else if (l.kind === 'child_added') {
    const keys = stored && typeof stored === 'object' ? sortedKeys(stored) : [];
    let prev = null;
    for (const k of keys) {
      if (!l.seen.has(k)) { l.seen.add(k); safeCall(l.cb, new DataSnapshot(new Reference(l.ref._db, [...l.segs, k]), stored[k]), prev); }
      prev = k;
    }
    for (const k of [...l.seen]) if (!keys.includes(k)) l.seen.delete(k);
  }
}
function safeCall(fn, ...args) {
  try { fn(...args); } catch (e) { setTimeout(() => { throw e; }); }
}

// ---------- public API ----------
class Database {
  constructor(app, url) { this.app = app; this._url = url || app?.options?.databaseURL || 'mock://rtdb'; this.type = 'database'; }
}
export function getDatabase(app, url) {
  if (!S.db) { S.db = new Database(app, url); openStream(); }
  return S.db;
}
export function connectDatabaseEmulator() {}
export function goOffline() { globalThis.__NX_MOCK_NET__.drop(); }
export function goOnline() { globalThis.__NX_MOCK_NET__.restore(); }
export function serverTimestamp() { return SERVER_TIMESTAMP; }
export function increment() { throw new Error('[NX mock] increment() is not implemented'); }

export class Reference {
  constructor(db, segs) { this._db = db; this._segs = segs; this.key = segs.length ? segs[segs.length - 1] : null; }
  get parent() { return this._segs.length ? new Reference(this._db, this._segs.slice(0, -1)) : null; }
  get root() { return new Reference(this._db, []); }
  get ref() { return this; }
  get _path() { return joinPath(this._segs); }
  isEqual(other) { return other instanceof Reference && other._path === this._path; }
  toString() { return `${this._db._url.replace(/\/$/, '')}${this._path === '/' ? '' : this._path}`; }
  toJSON() { return this.toString(); }
}
export function ref(db, path) {
  if (path !== undefined) validatePath('ref', path, { allowInfo: true });
  return new Reference(db, splitPath(path));
}
export function child(parent, path) {
  validatePath('child', path);
  return new Reference(parent._db, [...parent._segs, ...splitPath(path)]);
}

export class DataSnapshot {
  constructor(r, stored) { this.ref = r; this.key = r.key; this._s = stored ?? null; }
  val() { return clone(exportVal(this._s)); }
  exportVal() { return this.val(); }
  toJSON() { return this.val(); }
  exists() { return this._s !== null; }
  child(path) { const segs = splitPath(path); return new DataSnapshot(new Reference(this.ref._db, [...this.ref._segs, ...segs]), getAt(this._s, segs)); }
  hasChild(path) { return getAt(this._s, splitPath(path)) !== null; }
  hasChildren() { return this._s !== null && typeof this._s === 'object'; }
  get size() { return this.hasChildren() ? Object.keys(this._s).length : 0; }
  numChildren() { return this.size; }
  forEach(action) {
    if (!this.hasChildren()) return false;
    for (const k of sortedKeys(this._s)) if (action(this.child(k)) === true) return true;
    return false;
  }
  get priority() { return null; }
}

function write(ops) {
  const now = Date.now();
  const w = { id: ++S.seq, raw: ops, local: ops.map(o => ({ path: o.path, value: normalize(o.value, now) })), ackRev: null };
  S.pending.push(w);
  recompute();
  const p = (S.sendChain = S.sendChain.then(async () => {
    await whenOnline();
    const r = await post('/write', { ops: w.raw });
    w.ackRev = r.rev;
    if (S.serverRev >= r.rev) { S.pending = S.pending.filter(x => x !== w); recompute(); }
    await waitForRev(r.rev);
  }));
  S.sendChain = p.catch(() => {});
  return p;
}
function assertWritable(fnName, r) {
  if (r._segs[0] === '.info') throw new Error(`${fnName} failed: path argument was an invalid path = "${r._path}". Paths must be non-empty strings and can't contain ".", "#", "$", "[", or "]"`);
}

export function set(r, value) {
  assertWritable('set', r);
  validateValue('set', value);
  return write([{ path: r._path, value }]);
}
export function update(r, values) {
  assertWritable('update', r);
  validateUpdate('update', r._path, values);
  const ops = Object.entries(values).map(([k, v]) => ({ path: joinPath([...r._segs, ...splitPath(k)]), value: v }));
  return ops.length ? write(ops) : Promise.resolve();
}
export function remove(r) { return set(r, null); }

export function push(parent, value) {
  const childRef = new Reference(parent._db, [...parent._segs, pushId()]);
  if (value !== undefined) validateValue('push', value);
  const p = value === undefined ? Promise.resolve(childRef) : set(childRef, value).then(() => childRef);
  const thenable = new Reference(parent._db, childRef._segs);
  thenable.then = p.then.bind(p);
  thenable.catch = p.catch.bind(p);
  return thenable;
}

export async function get(q) {
  await S.ready;
  if (q._segs[0] === '.info') return new DataSnapshot(q, valueAt(q._segs));
  if (!(S.online && S.connected)) {
    const cached = valueAt(q._segs);
    if (cached === null) throw new Error('Error: Client is offline.');
    return new DataSnapshot(q, cached);
  }
  const res = await fetch(`${BASE}/get?path=${encodeURIComponent(q._path)}`);
  const json = await res.json();
  return new DataSnapshot(q, json.value);
}

export function onValue(q, cb, cancelOrOptions, options) {
  const opts = typeof cancelOrOptions === 'object' && cancelOrOptions ? cancelOrOptions : options || {};
  const l = { kind: 'value', ref: q, segs: q._segs, cb, last: undefined, onlyOnce: !!opts.onlyOnce };
  S.listeners.add(l);
  Promise.resolve().then(() => S.listeners.has(l) && deliver(l));
  return () => S.listeners.delete(l);
}
export function onChildAdded(q, cb) {
  const l = { kind: 'child_added', ref: q, segs: q._segs, cb, seen: new Set() };
  S.listeners.add(l);
  Promise.resolve().then(() => S.listeners.has(l) && deliver(l));
  return () => S.listeners.delete(l);
}
export function off() { /* listeners are removed through the unsubscribe functions */ }

export async function runTransaction(r, updateFn) {
  assertWritable('runTransaction', r);
  await S.ready;
  await S.sendChain;
  await whenOnline();
  let current = exportVal(valueAt(r._segs));
  for (let attempt = 0; attempt < 25; attempt++) {
    const next = updateFn(clone(current));
    if (next === undefined) return { committed: false, snapshot: new DataSnapshot(r, normalize(current)), toJSON() { return { committed: false }; } };
    validateValue('runTransaction', next);
    await whenOnline();
    const res = await post('/cas', { path: r._path, expect: canonical(normalize(current)), value: next });
    if (res.ok) {
      await waitForRev(res.rev);
      return { committed: true, snapshot: new DataSnapshot(r, res.value), toJSON() { return { committed: true }; } };
    }
    current = exportVal(res.current);
  }
  throw new Error('maxretry');
}

export function onDisconnect(r) {
  const register = async (ops) => {
    await S.ready;
    await whenOnline();
    await post('/ondisconnect', { action: 'add', id: 'od_' + (++S.seq), ops });
  };
  return {
    set(value) { validateValue('onDisconnect.set', value); return register([{ path: r._path, value }]); },
    remove() { return register([{ path: r._path, value: null }]); },
    update(values) {
      validateUpdate('onDisconnect.update', r._path, values);
      return register(Object.entries(values).map(([k, v]) => ({ path: joinPath([...r._segs, ...splitPath(k)]), value: v })));
    },
    async cancel() { await S.ready; await whenOnline(); await post('/ondisconnect', { action: 'cancel', path: r._path }); },
  };
}
