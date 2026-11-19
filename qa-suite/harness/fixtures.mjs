// NEON XI QA — Playwright fixtures.
// * `site`  : the project's own preview server (scripts/preview-server.cjs), one per worker.
// * `rtdb`  : a fresh MOCK Realtime Database per test (see mock-rtdb-server.mjs).
// * `users` : factory for independent users; each is its own browser context
//             (separate localStorage/cookies/identity), never a renamed tab.
// Every request that is not 127.0.0.1 is aborted and recorded, so nothing can
// reach the live Firebase project; Firebase SDK URLs are answered with the mock.
import { test as base, expect, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockRtdb } from './mock-rtdb-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
const MOCK_DIR = path.join(HERE, 'mock-modules');
const FIREBASE_SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\/12\.16\.0\/(firebase-app|firebase-auth|firebase-database|rtdb-shared)\.js(\?.*)?$/;
// Optional: serve the Google Fonts the pages request from local @fontsource
// packages (same OFL fonts) so screenshots use the production typefaces.
// QA_FONTS_DIR=<dir containing @fontsource/{rajdhani,orbitron,barlow,barlow-condensed}>
const FONTS_DIR = process.env.QA_FONTS_DIR;
function googleFontsCss(url) {
  const q = new URL(url), out = [];
  for (const fam of q.searchParams.getAll('family')) {
    const [name, spec = ''] = fam.split(':'), slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    const axes = spec.split('@')[0].split(','), values = (spec.split('@')[1] || '400').split(';');
    for (const v of values) {
      const parts = v.split(','), ital = axes.includes('ital') ? parts[axes.indexOf('ital')] === '1' : false, w = parts[axes.indexOf('wght')] ?? parts[0];
      const file = path.join(FONTS_DIR, slug, `${w}${ital ? '-italic' : ''}.css`);
      if (fs.existsSync(file)) out.push(fs.readFileSync(file, 'utf8').replace(/url\(\.\/files\/([^)]+)\)/g, `url(https://fonts.gstatic.com/qa/${slug}/$1)`));
    }
  }
  return out.join('\n');
}

export const usernameKey = (s) => String(s || '').toLocaleLowerCase('tr-TR').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9_]/g, '').slice(0, 20);

async function waitForHttp(url, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('preview server did not start: ' + url);
}

export const test = base.extend({
  site: [async ({}, use, workerInfo) => {
    const port = 4300 + workerInfo.workerIndex;
    const proc = spawn(process.execPath, [path.join(ROOT, 'scripts/preview-server.cjs'), '--port', String(port), '--host', '127.0.0.1'], { stdio: 'ignore' });
    const baseURL = `http://127.0.0.1:${port}`;
    await waitForHttp(`${baseURL}/README.md`);
    await use({ baseURL });
    proc.kill();
  }, { scope: 'worker' }],

  rtdb: async ({}, use) => {
    const db = await startMockRtdb();
    await use(db);
    await db.close();
  },

  users: async ({ browser, rtdb, site }, use, testInfo) => {
    const created = [];
    const make = async (label, opts = {}) => {
      const { device, guest = false, profile = true, username = `qa_${label.toLowerCase()}`, globals = {} } = opts;
      const uid = guest ? null : `uid_${label}`;
      const contextOptions = device ? { ...devices[device] } : { viewport: { width: 390, height: 844 }, isMobile: false };
      const context = await browser.newContext({ ...contextOptions, baseURL: site.baseURL, serviceWorkers: 'block' });
      const cfg = { rtdb: rtdb.url, label, google: guest ? null : { uid, email: `${label.toLowerCase()}@qa.invalid`, displayName: `QA ${label}` } };
      const stored = guest ? null : { uid, isAnonymous: false, email: cfg.google.email, displayName: cfg.google.displayName };
      await context.addInitScript(({ cfg, stored, globals }) => {
        window.__NX_MOCK__ = cfg;
        Object.assign(window, globals);
        try {
          if (stored && !localStorage.getItem('nxmock:seeded')) {
            localStorage.setItem('nxmock:seeded', '1');
            localStorage.setItem('nxmock:auth:user', JSON.stringify(stored));
          }
        } catch {}
      }, { cfg, stored, globals });
      const u = { label, uid, username, context, errors: [], console: [], blocked: [] };
      await context.route('**/*', async (route) => {
        const url = route.request().url();
        const m = url.match(FIREBASE_SDK);
        if (m) {
          return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(MOCK_DIR, m[1] + '.js'), 'utf8') });
        }
        const host = new URL(url).hostname;
        if (FONTS_DIR && host === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: googleFontsCss(url) });
        const fm = FONTS_DIR && url.match(/^https:\/\/fonts\.gstatic\.com\/qa\/([a-z-]+)\/([^?]+)$/);
        if (fm && fs.existsSync(path.join(FONTS_DIR, fm[1], 'files', fm[2]))) return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(FONTS_DIR, fm[1], 'files', fm[2])) });
        if (host === '127.0.0.1' || host === 'localhost' || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        u.blocked.push(url);
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      const hook = (p) => {
        p.on('pageerror', e => u.errors.push(String(e?.message || e)));
        p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') u.console.push(`[${m.type()}] ${m.text()}`); });
      };
      hook(page);
      context.on('page', hook);
      u.page = page;
      if (uid && profile) {
        const key = usernameKey(username);
        rtdb.seed(`social/usernames/${key}`, uid);
        rtdb.seed(`social/profiles/${uid}`, { username, key, accountType: 'google', googleEmail: cfg.google.email, displayName: cfg.google.displayName, updatedAt: Date.now() });
      }
      created.push(u);
      return u;
    };
    await use(make);
    for (const u of created) {
      const leaked = u.blocked.filter(x => /firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|googleapis\.com\/identitytoolkit/.test(x));
      if (leaked.length) testInfo.annotations.push({ type: 'live-firebase-attempt-blocked', description: `${u.label}: ${leaked.join(', ')}` });
      if (u.errors.length) await testInfo.attach(`${u.label}-pageerrors.txt`, { body: u.errors.join('\n'), contentType: 'text/plain' });
      if (u.console.length) await testInfo.attach(`${u.label}-console.txt`, { body: u.console.join('\n'), contentType: 'text/plain' });
      await u.context.close().catch(() => {});
    }
  },
});

export { expect };

/** Poll the mock database (the test oracle) until `predicate(value)` holds. */
export async function waitForDb(rtdb, dbPath, predicate, { timeout = 8000, message } = {}) {
  await expect.poll(() => predicate(rtdb.get(dbPath)), { timeout, message: message || `db ${dbPath}` }).toBeTruthy();
}
