// NEON XI QA — MOCK Realtime Database semantics shared by the browser mock
// and the Node mock server. This is NOT Firebase. It reproduces the subset of
// Realtime Database behaviour the NEON XI client relies on, and the client-side
// validation errors the real SDK raises synchronously (checked against the
// real firebase@12.16.0 SDK by qa-suite/tests/mock-conformance.spec.mjs).

export const SERVER_TIMESTAMP = Object.freeze({ '.sv': 'timestamp' });

const INVALID_KEY = /[\[\].#$\/\u0000-\u001F\u007F]/;
const INVALID_PATH = /[\[\].#$\u0000-\u001F\u007F]/;
const INTEGER_KEY = /^-?(0|[1-9]\d*)$/;

export function splitPath(path) {
  return String(path ?? '').split('/').filter(Boolean);
}
export function joinPath(segments) {
  return '/' + segments.join('/');
}

export function validatePath(fnName, path, { allowInfo = false } = {}) {
  const raw = String(path ?? '');
  const probe = allowInfo ? raw.replace(/^\/?\.info(\/|$)/, '/$1') : raw;
  if (INVALID_PATH.test(probe)) {
    throw new Error(`${fnName} failed: path argument was an invalid path = "${raw}". Paths must be non-empty strings and can't contain ".", "#", "$", "[", or "]"`);
  }
}

function isServerValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && '.sv' in value;
}

export function validateValue(fnName, value, where = '') {
  const at = where ? ` in property '${where}'` : '';
  if (value === undefined) throw new Error(`${fnName} failed: value argument contains undefined${at}`);
  if (typeof value === 'function') throw new Error(`${fnName} failed: value argument contains a function${at} with contents = ${String(value).slice(0, 40)}`);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${fnName} failed: value argument contains ${value}${at}`);
  if (typeof value === 'symbol' || typeof value === 'bigint') throw new Error(`${fnName} failed: value argument contains an invalid value${at}`);
  if (value === null || typeof value !== 'object') return;
  if (isServerValue(value)) return;
  for (const key of Object.keys(value)) {
    if (key === '.priority' || key === '.value' || key === '.sv') continue;
    if (!key || INVALID_KEY.test(key)) {
      throw new Error(`${fnName} failed: value argument contains an invalid key (${key})${at}. Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"`);
    }
    validateValue(fnName, value[key], where ? `${where}.${key}` : key);
  }
}

// Mirrors the SDK's validateFirebaseMergePaths: update() refuses a change set in
// which one path is an ancestor of another.
export function validateUpdate(fnName, basePath, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error(`${fnName} failed: First argument  must be an object containing the children to replace.`);
  }
  const paths = [];
  for (const [key, value] of Object.entries(values)) {
    if (INVALID_PATH.test(key)) throw new Error(`${fnName} failed: values argument contains an invalid key (${key}).`);
    validateValue(fnName, value, key);
    paths.push(splitPath(key));
  }
  const absolute = paths.map(p => [...splitPath(basePath), ...p]);
  const sorted = absolute.map(p => p.join('/')).sort();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i];
    if (prev === cur || cur.startsWith(prev + '/')) {
      throw new Error(`${fnName} failed: values argument contains a path /${prev} that is ancestor of another path /${cur}`);
    }
  }
}

// Stored form: no nulls, no empty objects, arrays become index-keyed objects.
export function normalize(value, now = Date.now()) {
  if (value === null || value === undefined) return null;
  if (isServerValue(value)) return value['.sv'] === 'timestamp' ? now : null;
  if (Array.isArray(value)) value = Object.fromEntries(value.map((v, i) => [String(i), v]));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === '.priority') continue;
    const n = normalize(v, now);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

export function compareKeys(a, b) {
  const ai = INTEGER_KEY.test(a), bi = INTEGER_KEY.test(b);
  if (ai && bi) return Number(a) - Number(b);
  if (ai) return -1;
  if (bi) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortedKeys(obj) {
  return Object.keys(obj || {}).sort(compareKeys);
}

// What DataSnapshot.val() returns: integer-keyed nodes become arrays when the
// SDK would do so (all keys integers and maxKey < 2 * numKeys).
export function exportVal(stored) {
  if (stored === null || typeof stored !== 'object') return stored ?? null;
  const keys = sortedKeys(stored);
  let allInt = true, maxKey = 0;
  for (const k of keys) {
    if (!INTEGER_KEY.test(k) || Number(k) < 0) { allInt = false; break; }
    maxKey = Math.max(maxKey, Number(k));
  }
  if (allInt && keys.length && maxKey < 2 * keys.length) {
    const arr = [];
    for (const k of keys) arr[Number(k)] = exportVal(stored[k]);
    return arr;
  }
  const out = {};
  for (const k of keys) out[k] = exportVal(stored[k]);
  return out;
}

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  return '{' + sortedKeys(value).map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

export function getAt(root, segments) {
  let node = root;
  for (const s of segments) {
    if (node === null || typeof node !== 'object' || !(s in node)) return null;
    node = node[s];
  }
  return node ?? null;
}

// Returns a new tree with `value` (already normalized) stored at `segments`.
export function setAt(root, segments, value) {
  if (!segments.length) return value;
  const [head, ...rest] = segments;
  const base = root !== null && typeof root === 'object' ? { ...root } : {};
  const child = setAt(base[head] ?? null, rest, value);
  if (child === null) delete base[head]; else base[head] = child;
  return Object.keys(base).length ? base : null;
}

export function clone(value) {
  return value === null || value === undefined ? null : JSON.parse(JSON.stringify(value));
}

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPushTime = 0, lastRandom = [];
export function pushId(now = Date.now()) {
  const dup = now === lastPushTime;
  lastPushTime = now;
  const time = [];
  for (let i = 7; i >= 0; i--) { time.unshift(PUSH_CHARS.charAt(now % 64)); now = Math.floor(now / 64); }
  if (!dup) lastRandom = Array.from({ length: 12 }, () => Math.floor(Math.random() * 64));
  else {
    let i = 11;
    for (; i >= 0 && lastRandom[i] === 63; i--) lastRandom[i] = 0;
    if (i >= 0) lastRandom[i]++;
  }
  return time.join('') + lastRandom.map(n => PUSH_CHARS.charAt(n)).join('');
}
