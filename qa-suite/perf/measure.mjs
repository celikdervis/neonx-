#!/usr/bin/env node
// NEON XI performance measurement (Chromium + mock Firebase, no live services).
//   node qa-suite/perf/measure.mjs --label baseline [--runs 5] [--only home,side,social,idle,listeners]
// Writes qa-suite/.artifacts/perf/<label>.json and prints medians.
//
// Interception uses CDP Fetch on https:// URLs only (Firebase SDK → mock,
// every other external host → blocked). Playwright's route() is not used
// because it disables the HTTP cache, which would make warm loads meaningless.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockRtdb } from '../harness/mock-rtdb-server.mjs';
import { startStaticServer } from './static-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'qa-suite/.artifacts/perf');
const MOCK_DIR = path.join(ROOT, 'qa-suite/harness/mock-modules');
const PROBE = fs.readFileSync(path.join(HERE, 'probe.js'), 'utf8') + '\n//# sourceURL=nx-qa-probe.js';
const SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\/12\.16\.0\/(firebase-app|firebase-auth|firebase-database|rtdb-shared)\.js(\?.*)?$/;

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const LABEL = arg('label', 'run');
const RUNS = Number(arg('runs', 5));
const ONLY = new Set(String(arg('only', 'home,side,social,idle,listeners')).split(','));
// Simulated download time of the Firebase SDK modules (production loads them from gstatic.com).
const SDK_DELAYS = String(arg('sdkDelay', '')).split(',').filter(Boolean).map(Number);
const PAGES = arg('pages', '') ? new Set(arg('pages').split(',')) : null;
const HOME_KEYS = arg('homeKeys', '') ? new Set(arg('homeKeys').split(',')) : null;

// Lighthouse mobile "devtools" throttling (Slow 4G + 4x CPU) and a slower-CPU variant.
const PROFILES = {
  fast: { cpu: 1, net: null },
  mid: { cpu: 4, net: { latency: 562.5, downloadThroughput: 1474.56 * 1024 / 8, uploadThroughput: 675 * 1024 / 8 } },
  low: { cpu: 6, net: { latency: 562.5, downloadThroughput: 1474.56 * 1024 / 8, uploadThroughput: 675 * 1024 / 8 } },
};
const SIDE = {
  xox: '/side-games/football-xox/index.html', twin: '/side-games/career-twin/index.html', wordle: '/side-games/football-wordle/index.html',
  arcade: '/side-games/index.html', imposter: '/side-games/futbol-imposter.html', reverse: '/side-games/reverse-xi/index.html',
  en11: '/side-games/en11/index.html', howto: '/side-games/how-to-play.html',
};

const median = (a) => { const v = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function newUser(browser, { site, rtdb, profile, returning = true, label = 'A', sdkDelay = 0 }) {
  const context = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const uid = `uid_${label}`;
  const cfg = { rtdb: rtdb.url, label, google: { uid, email: `${label}@qa.invalid`, displayName: `QA ${label}` } };
  const stored = returning ? { uid, isAnonymous: false, email: cfg.google.email, displayName: cfg.google.displayName } : null;
  await context.addInitScript(({ cfg, stored }) => {
    window.__NX_MOCK__ = cfg;
    try { if (stored && !localStorage.getItem('nxmock:seeded')) { localStorage.setItem('nxmock:seeded', '1'); localStorage.setItem('nxmock:auth:user', JSON.stringify(stored)); } } catch {}
  }, { cfg, stored });
  await context.addInitScript(PROBE);
  if (returning) {
    rtdb.seed(`social/usernames/qa_${label.toLowerCase()}`, uid);
    rtdb.seed(`social/profiles/${uid}`, { username: `qa_${label.toLowerCase()}`, key: `qa_${label.toLowerCase()}`, accountType: 'google', updatedAt: Date.now() });
  }
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', e => { if (!reqs.has(e.requestId)) reqs.set(e.requestId, { url: e.request.url, type: e.type, start: e.timestamp }); });
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.cache = e.response.fromDiskCache || e.response.fromMemoryCache || false; r.type = e.type || r.type; } });
  cdp.on('Network.requestServedFromCache', e => { const r = reqs.get(e.requestId); if (r) r.cache = true; });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp; } });
  cdp.on('Network.loadingFailed', e => { const r = reqs.get(e.requestId); if (r) { r.failed = e.errorText; r.end = e.timestamp; } });
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*', requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', async e => {
    const m = e.request.url.match(SDK);
    try {
      if (m) {
        if (sdkDelay) await sleep(sdkDelay);
        const body = fs.readFileSync(path.join(MOCK_DIR, m[1] + '.js'));
        await cdp.send('Fetch.fulfillRequest', { requestId: e.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: body.toString('base64') });
      } else {
        await cdp.send('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' });
      }
    } catch {}
  });
  const p = PROFILES[profile];
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  if (p.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...p.net });
  return { context, page, cdp, reqs, resetRequests: () => reqs.clear() };
}

function summarizeRequests(reqs) {
  const list = [...reqs.values()];
  const local = list.filter(r => r.url.startsWith('http://127.0.0.1') && !r.url.includes('/events?') && !/\/(get|write|cas|ondisconnect)\b/.test(new URL(r.url).pathname));
  const mocked = list.filter(r => SDK.test(r.url));
  const blocked = list.filter(r => r.failed && r.url.startsWith('https://'));
  const byType = {};
  for (const r of local) { const t = r.type || 'Other'; byType[t] ||= { n: 0, bytes: 0 }; byType[t].n++; byType[t].bytes += r.bytes || 0; }
  const counts = {};
  for (const r of local) { const u = r.url.replace(/\?.*$/, ''); counts[u] = (counts[u] || 0) + 1; }
  return {
    requests: local.length, bytes: local.reduce((s, r) => s + (r.bytes || 0), 0), fromCache: local.filter(r => r.cache).length,
    byType, mockedSdkModules: mocked.length, blockedExternal: [...new Set(blocked.map(r => new URL(r.url).host))],
    largest: [...local].sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 8).map(r => [r.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '').replace(/\?.*$/, ''), r.bytes || 0]),
    urls: local.map(r => r.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '').replace(/\?.*$/, '')),
    duplicates: Object.entries(counts).filter(([, n]) => n > 1).map(([u, n]) => [u.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''), n]),
  };
}
async function metrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
  return { scriptMs: Math.round(m.ScriptDuration * 1000), taskMs: Math.round(m.TaskDuration * 1000), layoutMs: Math.round(m.LayoutDuration * 1000), styleMs: Math.round(m.RecalcStyleDuration * 1000), heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, jsListeners: m.JSEventListeners, layouts: m.LayoutCount, styleRecalcs: m.RecalcStyleCount };
}
async function waitMark(page, names, timeout) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await page.evaluate(n => n.every(k => k in (window.__nxPerf?.marks || {})), names).catch(() => false);
    if (ok) return true;
    await sleep(200);
  }
  return false;
}
async function homeImagesLoaded(page) {
  return page.evaluate(() => { const imgs = [...document.querySelectorAll('#bootHome img[data-layer]')]; return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0); }).catch(() => false);
}
async function mockListeners(page) {
  return page.evaluate(() => {
    const S = window.__NX_MOCK_DB__; if (!S) return null;
    const byPath = {};
    for (const l of S.listeners) { const p = '/' + l.segs.join('/'); byPath[p] = (byPath[p] || 0) + 1; }
    const auth = window.__NX_MOCK_AUTH__?.auth?._listeners?.size ?? null;
    return { total: S.listeners.size, uniquePaths: Object.keys(byPath).length, duplicated: Object.entries(byPath).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]), authListeners: auth, byPath };
  });
}

async function measureHome(browser, site, profile, { returning = true, warm = false, filmstrip = null, sdkDelay = 0 } = {}) {
  const rtdb = await startMockRtdb();
  const u = await newUser(browser, { site, rtdb, profile, returning, sdkDelay });
  let frames = [];
  try {
    if (warm) { // first visit fills the HTTP cache; measure the second one
      await u.page.goto(site.url + '/index.html', { waitUntil: 'commit' });
      await waitMark(u.page, returning ? ['homeInteractive'] : ['entryWelcome'], 90000);
      for (let i = 0; i < 300 && !(await homeImagesLoaded(u.page)) && returning; i++) await sleep(200);
      await sleep(1500);
      u.resetRequests();
      await u.page.goto('about:blank');
    }
    if (filmstrip) {
      await u.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 45, maxWidth: 412, maxHeight: 915, everyNthFrame: 1 });
      u.cdp.on('Page.screencastFrame', async f => { frames.push({ ts: f.metadata.timestamp, data: f.data }); try { await u.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
    }
    const t0 = Date.now();
    await u.page.goto(site.url + '/index.html', { waitUntil: 'commit' });
    const target = returning ? ['homeInteractive'] : ['entryWelcome'];
    const reached = await waitMark(u.page, target, 90000);
    let imagesAt = null;
    if (returning) {
      for (let i = 0; i < 450; i++) { if (await homeImagesLoaded(u.page)) { imagesAt = await u.page.evaluate(() => Math.round(performance.now())); break; } await sleep(200); }
    }
    await sleep(2500);
    const snap = await u.page.evaluate(() => window.__nxPerf.snapshot());
    const timeOrigin = await u.page.evaluate(() => performance.timeOrigin);
    const coreTiming = await u.page.evaluate(() => { const e = performance.getEntriesByType('resource').find(r => r.name.includes('neon-xi-core.html')); return e ? { start: Math.round(e.startTime), end: Math.round(e.responseEnd), bytes: e.transferSize } : null; });
    const m = await metrics(u.cdp);
    const net = summarizeRequests(u.reqs);
    const listeners = await mockListeners(u.page);
    if (filmstrip) {
      await u.cdp.send('Page.stopScreencast').catch(() => {});
      fs.mkdirSync(filmstrip, { recursive: true });
      const index = frames.map((f, i) => { const rel = Math.round(f.ts * 1000 - timeOrigin); const name = `f${String(i).padStart(3, '0')}_${rel}ms.jpg`; fs.writeFileSync(path.join(filmstrip, name), Buffer.from(f.data, 'base64')); return [rel, name]; });
      fs.writeFileSync(path.join(filmstrip, 'index.json'), JSON.stringify({ frames: index, states: snap.frames }, null, 1));
    }
    const tbt = snap.longtasks.reduce((s, [, d]) => s + Math.max(0, d - 50), 0);
    return { reached, wallMs: Date.now() - t0, fcp: snap.events.find(e => e[0] === 'paint:first-contentful-paint')?.[1] ?? null, marks: snap.marks, imagesLoaded: imagesAt, core: coreTiming, longtasks: snap.longtasks.length, longestTask: Math.max(0, ...snap.longtasks.map(x => x[1])), tbt, lcp: snap.lcp, oldHomeFrames: snap.oldHomeFrames, states: snap.frames, intervals: snap.intervals, metrics: m, net, listeners };
  } finally { await u.context.close(); await rtdb.close(); }
}

async function measureSide(browser, site, profile, name, url) {
  const rtdb = await startMockRtdb();
  const u = await newUser(browser, { site, rtdb, profile, returning: true });
  try {
    const t0 = Date.now();
    await u.page.goto(site.url + url, { waitUntil: 'load', timeout: 90000 });
    const hasSocial = name === 'imposter' || await u.page.evaluate(() => !!document.querySelector('script[src*="neon-social.js"]') || !!window.NEON_SOCIAL).catch(() => false);
    let socialAt = null;
    for (let i = 0; i < 150; i++) { socialAt = await u.page.evaluate(() => window.__nxPerf.marks.socialProfile ?? null); if (socialAt != null || !hasSocial) break; await sleep(200); }
    await sleep(1500);
    const snap = await u.page.evaluate(() => window.__nxPerf.snapshot());
    const loadAt = await u.page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.loadEventEnd) : null; });
    if (name === 'imposter') { const cp = snap.marks.coreComplete ?? snap.marks.coreParsed; snap.marks.load2 = cp; }
    return { page: name, wallMs: Date.now() - t0, fcp: snap.events.find(e => e[0] === 'paint:first-contentful-paint')?.[1] ?? null, lcp: snap.lcp?.[0] ?? null, load: snap.marks.load2 ?? snap.marks.load1 ?? loadAt, socialProfile: socialAt, longtasks: snap.longtasks.length, tbt: snap.longtasks.reduce((s, [, d]) => s + Math.max(0, d - 50), 0), metrics: await metrics(u.cdp), net: summarizeRequests(u.reqs) };
  } finally { await u.context.close(); await rtdb.close(); }
}

async function measureSocial(browser, site, profile) {
  const rtdb = await startMockRtdb();
  const u = await newUser(browser, { site, rtdb, profile, returning: true });
  try {
    await u.page.goto(site.url + '/index.html', { waitUntil: 'commit' });
    await waitMark(u.page, ['homeInteractive'], 90000);
    await sleep(2000);
    const before = { metrics: await metrics(u.cdp), listeners: await mockListeners(u.page) };
    const opens = { friends: [], lobby: [] };
    for (let i = 0; i < 10; i++) {
      for (const tab of ['friends', 'lobby']) {
        const ms = await u.page.evaluate(async (tab) => {
          const t = performance.now();
          window.NEON_SOCIAL.openDrawer(tab);
          for (let k = 0; k < 400; k++) {
            const layer = document.querySelector('.nx-social-drawer-layer.open');
            const body = layer?.querySelector('.nx-social-drawer-body, .nx-drawer-body, section');
            if (layer && body && layer.getBoundingClientRect().height > 0) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - t); }
            await new Promise(r => requestAnimationFrame(r));
          }
          return null;
        }, tab);
        opens[tab].push(ms);
        await u.page.evaluate(() => window.NEON_SOCIAL.closeDrawer?.());
        await sleep(300);
      }
    }
    await sleep(1500);
    await u.cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const after = { metrics: await metrics(u.cdp), listeners: await mockListeners(u.page) };
    return { openFriendsMs: opens.friends, openLobbyMs: opens.lobby, before, after };
  } finally { await u.context.close(); await rtdb.close(); }
}

async function measureIdle(browser, site, profile, seconds) {
  const rtdb = await startMockRtdb();
  const u = await newUser(browser, { site, rtdb, profile, returning: true });
  try {
    await u.page.goto(site.url + '/index.html', { waitUntil: 'commit' });
    await waitMark(u.page, ['homeInteractive'], 90000);
    await u.page.evaluate(() => window.__nxPerf.stop());
    await sleep(5000);
    await u.cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const samples = [];
    for (let s = 0; s <= seconds; s += 15) {
      const m = await metrics(u.cdp);
      samples.push({ s, ...m });
      if (s < seconds) await sleep(15000);
    }
    const intervals = await u.page.evaluate(() => [...window.__nxPerf.intervals.values()]);
    const a = samples[0], b = samples.at(-1);
    return { seconds, cpuMsPerSecond: +((b.taskMs - a.taskMs) / seconds).toFixed(1), scriptMsPerSecond: +((b.scriptMs - a.scriptMs) / seconds).toFixed(1), heapDeltaMB: +(b.heapMB - a.heapMB).toFixed(2), nodesDelta: b.nodes - a.nodes, listenersDelta: b.jsListeners - a.jsListeners, samples, intervals };
  } finally { await u.context.close(); await rtdb.close(); }
}

const pick = (runs, f) => median(runs.map(f));
function homeSummary(runs) {
  const k = (n) => pick(runs, r => r.marks?.[n]);
  return {
    runs: runs.length, reached: runs.filter(r => r.reached).length,
    fcp: pick(runs, r => r.fcp),
    coreFetchEnd: pick(runs, r => r.core?.end), docWrite: k('docWriteStart'), docClose: k('docClose'), dclCore: k('dcl2'),
    coreParsed: k('coreParsed'), homeApproved: k('homeApproved'), oldHomeFirstSeen: k('oldHomeFirstSeen'), guardRemoved: k('guardRemoved'), splashHidden: k('splashHidden'), homeVisible: k('homeActiveVisible'),
    socialReady: k('socialDrawerReady'), socialProfile: k('socialProfile'), homeInteractive: k('homeInteractive'), entryWelcome: k('entryWelcome'),
    imagesLoaded: pick(runs, r => r.imagesLoaded), lcp: pick(runs, r => r.lcp?.[0]), load: k('load2'),
    longtasks: pick(runs, r => r.longtasks), longestTask: pick(runs, r => r.longestTask), tbt: pick(runs, r => r.tbt),
    scriptMs: pick(runs, r => r.metrics.scriptMs), taskMs: pick(runs, r => r.metrics.taskMs), layoutMs: pick(runs, r => r.metrics.layoutMs), styleMs: pick(runs, r => r.metrics.styleMs),
    heapMB: pick(runs, r => r.metrics.heapMB), nodes: pick(runs, r => r.metrics.nodes), jsListeners: pick(runs, r => r.metrics.jsListeners),
    requests: pick(runs, r => r.net.requests), kb: pick(runs, r => Math.round(r.net.bytes / 1024)), fromCache: pick(runs, r => r.net.fromCache),
    oldHomeFramesRuns: runs.filter(r => r.oldHomeFrames > 0).length,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const site = await startStaticServer(ROOT);
  const browser = await chromium.launch();
  const result = { label: LABEL, at: new Date().toISOString(), runs: RUNS, chromium: browser.version(), profiles: PROFILES, home: {}, side: {}, social: null, idle: null };
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
  try {
    if (ONLY.has('home')) {
      for (const [key, opts, profile, n] of [
        ['fast-cold', {}, 'fast', RUNS], ['mid-cold', {}, 'mid', RUNS], ['mid-warm', { warm: true }, 'mid', RUNS], ['low-cold', {}, 'low', Math.min(RUNS, 3)], ['mid-cold-signedout', { returning: false }, 'mid', Math.min(RUNS, 3)],
      ].filter(([key]) => !HOME_KEYS || HOME_KEYS.has(key))) {
        const runs = [];
        for (let i = 0; i < n; i++) {
          const film = i === 0 && (key === 'mid-cold' || key === 'low-cold' || key === 'mid-warm') ? path.join(OUT, `${LABEL}-filmstrip-${key}`) : null;
          const r = await measureHome(browser, site, profile, { ...opts, filmstrip: film });
          runs.push(r);
          log('home', key, i + 1, '/', n, 'interactive', r.marks.homeInteractive ?? r.marks.entryWelcome, 'images', r.imagesLoaded, 'oldHomeFrames', r.oldHomeFrames);
        }
        result.home[key] = { summary: homeSummary(runs), runs };
      }
    }
    if (SDK_DELAYS.length) {
      for (const d of SDK_DELAYS) {
        const runs = [];
        for (let i = 0; i < Math.min(RUNS, 3); i++) {
          const film = i === 0 ? path.join(OUT, `${LABEL}-filmstrip-sdkdelay-${d}`) : null;
          const r = await measureHome(browser, site, 'mid', { sdkDelay: d, filmstrip: film });
          runs.push(r);
          log('home sdkDelay', d, i + 1, 'parsed', r.marks.coreParsed, 'approved', r.marks.homeApproved, 'guardRemoved', r.marks.guardRemoved, 'oldHomeFrames', r.oldHomeFrames, 'oldHomeFirstSeen', r.marks.oldHomeFirstSeen);
        }
        result.home['mid-cold-sdkdelay-' + d] = { summary: homeSummary(runs), runs };
      }
    }
    if (ONLY.has('side')) {
      for (const [name, url] of Object.entries(SIDE).filter(([n]) => !PAGES || PAGES.has(n))) {
        const runs = [];
        for (let i = 0; i < Math.min(RUNS, 3); i++) { const r = await measureSide(browser, site, 'mid', name, url); runs.push(r); log('side', name, i + 1, 'load', r.load, 'social', r.socialProfile); }
        result.side[name] = { summary: { fcp: pick(runs, r => r.fcp), lcp: pick(runs, r => r.lcp), load: pick(runs, r => r.load), socialProfile: pick(runs, r => r.socialProfile), tbt: pick(runs, r => r.tbt), requests: pick(runs, r => r.net.requests), kb: pick(runs, r => Math.round(r.net.bytes / 1024)), heapMB: pick(runs, r => r.metrics.heapMB), scriptMs: pick(runs, r => r.metrics.scriptMs) }, runs };
      }
    }
    if (ONLY.has('social')) { result.social = await measureSocial(browser, site, 'mid'); log('social open friends', result.social.openFriendsMs.join(','), 'lobby', result.social.openLobbyMs.join(',')); }
    if (ONLY.has('idle')) { result.idle = await measureIdle(browser, site, 'mid', Number(arg('idle', 120))); log('idle cpu ms/s', result.idle.cpuMsPerSecond, 'heap', result.idle.heapDeltaMB); }
  } finally {
    await browser.close();
    await site.close();
    const file = path.join(OUT, `${LABEL}.json`);
    fs.writeFileSync(file, JSON.stringify(result, null, 1));
    console.log('wrote', path.relative(ROOT, file));
    for (const [k, v] of Object.entries(result.home)) console.log('HOME', k, JSON.stringify(v.summary));
    for (const [k, v] of Object.entries(result.side)) console.log('SIDE', k, JSON.stringify(v.summary));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
