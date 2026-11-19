#!/usr/bin/env node
// Startup CPU attribution: samples the main thread from navigation until the
// home screen is interactive and attributes self time to files. Inline scripts
// of neon-xi-core.html (written into index.html) are mapped to their block by line.
//   node qa-suite/perf/cpu-profile.mjs --label baseline [--cpu 4] [--runs 3]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockRtdb } from '../harness/mock-rtdb-server.mjs';
import { startStaticServer } from './static-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const LABEL = arg('label', 'run'), CPU = Number(arg('cpu', 4)), RUNS = Number(arg('runs', 3));
// --idle N: instead of startup, profile N seconds of an idle home screen (10 s after it became interactive).
const IDLE = Number(arg('idle', 0));
const PROBE = fs.readFileSync(path.join(HERE, 'probe.js'), 'utf8') + '\n//# sourceURL=nx-qa-probe.js';

// Core inline <script> blocks → line ranges (labels from each block's leading comment / first statement).
const core = fs.readFileSync(path.join(ROOT, 'neon-xi-core.html'), 'utf8');
const blocks = [];
for (const m of core.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  const startLine = core.slice(0, m.index).split('\n').length;
  const lines = m[0].split('\n').length;
  const head = m[2].replace(/\s+/g, ' ').trim().slice(0, 70);
  blocks.push({ startLine, endLine: startLine + lines, id: (m[1].match(/id="([^"]+)"/) || [])[1] || '', head, bytes: Buffer.byteLength(m[2]) });
}
const blockFor = (line) => blocks.findIndex(b => line + 1 >= b.startLine - 8 && line + 1 <= b.endLine + 8);

async function once(browser, site) {
  const rtdb = await startMockRtdb();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  await ctx.addInitScript(({ u }) => { window.__NX_MOCK__ = { rtdb: u, google: { uid: 'uid_A' } }; try { localStorage.setItem('nxmock:auth:user', JSON.stringify({ uid: 'uid_A', isAnonymous: false })); } catch {} }, { u: rtdb.url });
  await ctx.addInitScript(PROBE);
  rtdb.seed('social/profiles/uid_A', { username: 'qa_a', key: 'qa_a' });
  rtdb.seed('social/usernames/qa_a', 'uid_A');
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
  cdp.on('Fetch.requestPaused', async e => {
    const m = e.request.url.match(/firebasejs\/12\.16\.0\/(firebase-[a-z]+|rtdb-shared)\.js/);
    try {
      if (m) await cdp.send('Fetch.fulfillRequest', { requestId: e.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: fs.readFileSync(path.join(ROOT, 'qa-suite/harness/mock-modules', m[1] + '.js')).toString('base64') });
      else await cdp.send('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' });
    } catch {}
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  if (!IDLE) await cdp.send('Profiler.start');
  await page.goto(site.url + '/index.html', { waitUntil: 'commit' });
  for (let i = 0; i < 600; i++) { if (await page.evaluate(() => 'homeInteractive' in (window.__nxPerf?.marks || {})).catch(() => false)) break; await new Promise(r => setTimeout(r, 200)); }
  const interactive = await page.evaluate(() => window.__nxPerf.marks.homeInteractive);
  if (IDLE) { await new Promise(r => setTimeout(r, 30000)); await cdp.send('Profiler.start'); await new Promise(r => setTimeout(r, IDLE * 1000)); }
  const { profile } = await cdp.send('Profiler.stop');
  await ctx.close(); await rtdb.close();
  // self time per node
  const self = new Map();
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0) / 1000);
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  // Attribute native/builtin self time (getBoundingClientRect, layout, regexp…) to the nearest JS caller with a URL.
  const owner = (id) => { for (let n = id; n != null; n = parent.get(n)) { const cf = byId.get(n).callFrame; if (cf.url) return n; } return id; };
  const files = {}, coreBlocks = {}, natives = {};
  for (const [rawId, ms] of self) {
    const rawCf = byId.get(rawId).callFrame;
    const id = owner(rawId);
    const cf = byId.get(id).callFrame;
    if (!rawCf.url && cf.url) { const nk = rawCf.functionName || '(native)'; natives[nk] = (natives[nk] || 0) + ms; }
    let key = cf.url ? cf.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '').replace(/\?.*$/, '') : `(${cf.functionName || 'native'})`;
    if (key.startsWith('https://www.gstatic.com')) key = '(mock firebase sdk)';
    if (/nx-qa-probe/.test(key)) key = '(QA probe — measurement overhead)';
    if (key === '/index.html') {
      const b = blockFor(cf.lineNumber);
      if (b >= 0) { key = `core#${b}`; coreBlocks[b] = (coreBlocks[b] || 0) + ms; } else key = '/index.html (boot/inline)';
    }
    files[key] = (files[key] || 0) + ms;
  }
  return { interactive, files, natives, total: [...self.values()].reduce((a, b) => a + b, 0) };
}

const site = await startStaticServer(ROOT);
const browser = await chromium.launch();
const runs = [];
for (let i = 0; i < RUNS; i++) { runs.push(await once(browser, site)); console.log('run', i + 1, 'interactive', runs.at(-1).interactive, 'sampled ms', Math.round(runs.at(-1).total)); }
await browser.close(); await site.close();
const keys = new Set(runs.flatMap(r => Object.keys(r.files)));
const med = (a) => { const v = [...a].sort((x, y) => x - y); return v[v.length >> 1]; };
const rows = [...keys].map(k => [k, Math.round(med(runs.map(r => r.files[k] || 0)))]).sort((a, b) => b[1] - a[1]);
const total = med(runs.map(r => r.total));
const nkeys = new Set(runs.flatMap(r => Object.keys(r.natives)));
const nativeRows = [...nkeys].map(k => [k, Math.round(med(runs.map(r => r.natives[k] || 0)))]).sort((a, b) => b[1] - a[1]).slice(0, 12);
const out = { label: LABEL, cpu: CPU, runs: RUNS, interactive: med(runs.map(r => r.interactive)), sampledMs: Math.round(total), rows, nativeRows, coreBlocks: blocks.map((b, i) => ({ i, ...b })) };
fs.mkdirSync(path.join(ROOT, 'qa-suite/.artifacts/perf'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `qa-suite/.artifacts/perf/${LABEL}-cpu.json`), JSON.stringify(out, null, 1));
console.log(`median interactive ${out.interactive} ms, sampled ${out.sampledMs} ms (CPU x${CPU})`);
for (const [k, ms] of rows.slice(0, 40)) {
  const b = k.startsWith('core#') ? blocks[Number(k.slice(5))] : null;
  console.log(String(ms).padStart(7), (ms / total * 100).toFixed(1).padStart(5) + '%', k, b ? `[${b.id || ''}] ${b.head.slice(0, 60)} (${Math.round(b.bytes / 1024)} KB)` : '');
}
console.log('native/builtin time folded into callers:', nativeRows.map(([k, ms]) => `${k} ${ms}`).join(', '));
