// Checks that the MOCK database module throws (or does not throw) synchronously
// in exactly the same cases as the real firebase@12.16.0 SDK. The real SDK is
// only used offline (goOffline) — no network request is made.
// Requires FIREBASE_SDK_DIR=<dir containing node_modules/firebase@12.16.0>;
// without it the test is reported as skipped (BLOCKED), never as passed.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SDK_DIR = process.env.FIREBASE_SDK_DIR;

const CASES = [
  ['B-01 change set: party node + its member + pointer', 'update', '', { 'social/userParty/u1': null, 'social/parties/p1/members/u1': null, 'social/parties/p1': null }],
  ['sibling paths', 'update', '', { 'social/userParty/u1': null, 'social/parties/p1/members/u1': null }],
  ['prefix that is not an ancestor (a vs ab)', 'update', '', { 'x/a': 1, 'x/ab': 2 }],
  ['nested ancestor via slash keys', 'update', 'root', { 'a/b': 1, 'a/b/c': 2 }],
  ['empty update', 'update', '', {}],
  ['update value containing undefined', 'update', '', { 'a/b': { c: undefined } }],
  ['update with invalid key', 'update', '', { 'a.b': 1 }],
  ['update with non-object', 'update', '', 'nope'],
  ['set with nested undefined', 'set', 'a', { b: undefined }],
  ['set with invalid key', 'set', 'a', { 'b.c': 1 }],
  ['set with NaN', 'set', 'a', Number.NaN],
  ['set with function', 'set', 'a', () => 1],
  ['set with array containing undefined', 'set', 'a', [1, undefined]],
  ['set with serverTimestamp sentinel', 'set', 'a', { at: { '.sv': 'timestamp' } }],
  ['set null', 'set', 'a', null],
  ['ref with # in path', 'ref', 'a#b', null],
  ['ref with .info/connected', 'ref', '.info/connected', null],
];

function outcome(fn) {
  try { const p = fn(); p?.catch?.(() => {}); return 'ok'; } catch (e) { return 'throws'; }
}

test('mock database validation matches the real Firebase SDK', async () => {
  test.skip(!SDK_DIR || !fs.existsSync(path.join(SDK_DIR, 'node_modules/firebase/package.json')), 'BLOCKED: FIREBASE_SDK_DIR with firebase@12.16.0 not provided');
  const req = createRequire(path.join(SDK_DIR, 'package.json'));
  expect(req('firebase/package.json').version).toBe('12.16.0');
  const realApp = req('firebase/app'), real = req('firebase/database');
  const app = realApp.initializeApp({ apiKey: 'x', projectId: 'demo-qa', databaseURL: 'http://127.0.0.1:9/?ns=demo-qa' }, 'conformance');
  const realDb = real.getDatabase(app);
  real.goOffline(realDb);

  globalThis.EventSource = class { constructor() {} addEventListener() {} close() {} };
  globalThis.__NX_MOCK__ = { rtdb: 'http://127.0.0.1:9' };
  const mock = await import(pathToFileURL(path.join(HERE, '../harness/mock-modules/firebase-database.js')).href);
  const mockDb = mock.getDatabase({ options: {} });

  const run = (api, db, [, op, p, v]) => {
    if (op === 'ref') return outcome(() => api.ref(db, p));
    if (op === 'set') return outcome(() => api.set(api.ref(db, p), v));
    return outcome(() => api.update(p ? api.ref(db, p) : api.ref(db), v));
  };
  const rows = CASES.map(c => ({ case: c[0], real: run(real, realDb, c), mock: run(mock, mockDb, c) }));
  console.log(rows.map(r => `${r.real === r.mock ? 'MATCH ' : 'DIFFER'} real=${r.real.padEnd(6)} mock=${r.mock.padEnd(6)} ${r.case}`).join('\n'));
  expect(rows.find(r => r.case.startsWith('B-01')).real, 'real SDK rejects the B-01 change set').toBe('throws');
  expect(rows.filter(r => r.real !== r.mock)).toEqual([]);
});
