#!/usr/bin/env node
// Mobile layout audit of every game page on several phone sizes:
// horizontal overflow, tap targets below 44 px (Apple HIG) / 24 px (WCAG 2.5.8),
// elements sticking out of the viewport, safe-area usage and pinch-zoom lock.
//   node qa-suite/perf/mobile-audit.mjs [outDir]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockRtdb } from '../harness/mock-rtdb-server.mjs';
import { startStaticServer } from './static-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.argv[2] || path.join(ROOT, 'qa-suite/.artifacts/mobile-audit');
const MOCK = path.join(ROOT, 'qa-suite/harness/mock-modules');
const PAGES = {
  arcade: '/side-games/index.html', xox: '/side-games/football-xox/index.html', twin: '/side-games/career-twin/index.html',
  wordle: '/side-games/football-wordle/index.html', imposter: '/side-games/futbol-imposter.html', reverse: '/side-games/reverse-xi/index.html',
  en11: '/side-games/en11/index.html', howto: '/side-games/how-to-play.html',
};
const VIEWS = { 'galaxy-s8': devices['Galaxy S8'], 'iphone-se': devices['iPhone SE'], 'iphone-14-pro-max': devices['iPhone 14 Pro Max'], 'iphone-14-landscape': devices['iPhone 14 landscape'] };

fs.mkdirSync(OUT, { recursive: true });
const site = await startStaticServer(ROOT), browser = await chromium.launch();
const rows = [];
for (const [pname, url] of Object.entries(PAGES)) {
  const css = [url, ...[]].map(u => u);
  for (const [vname, dev] of Object.entries(VIEWS)) {
    const rtdb = await startMockRtdb();
    rtdb.seed('social/profiles/uid_A', { username: 'qa_a', key: 'qa_a' });
    const ctx = await browser.newContext({ ...dev, serviceWorkers: 'block' });
    await ctx.addInitScript(({ u }) => { window.__NX_MOCK__ = { rtdb: u, google: { uid: 'uid_A' } }; try { localStorage.setItem('nxmock:auth:user', JSON.stringify({ uid: 'uid_A', isAnonymous: false })); } catch {} }, { u: rtdb.url });
    await ctx.route(/^https:/, r => { const m = r.request().url().match(/firebasejs\/12\.16\.0\/(firebase-[a-z]+|rtdb-shared)\.js/); return m ? r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(MOCK, m[1] + '.js'), 'utf8') }) : r.abort(); });
    const page = await ctx.newPage();
    await page.goto(site.url + url, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      const visible = el => { const cs = getComputedStyle(el), b = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && b.width > 0 && b.height > 0; };
      const label = el => (el.getAttribute('aria-label') || el.textContent || el.id || el.className || el.tagName).toString().replace(/\s+/g, ' ').trim().slice(0, 28);
      const targets = [...document.querySelectorAll('a[href],button,input,select,[role="button"],[onclick]')].filter(visible).filter(el => !el.closest('[hidden],[aria-hidden="true"],.nx-social-shade:not(.open)'));
      const small44 = targets.filter(el => { const b = el.getBoundingClientRect(); return b.width < 44 || b.height < 44; });
      const small24 = targets.filter(el => { const b = el.getBoundingClientRect(); return b.width < 24 || b.height < 24; });
      const outside = [...document.querySelectorAll('body *')].filter(visible).filter(el => { const b = el.getBoundingClientRect(); return b.right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[style*="overflow"],.results,.nx-social-panel'); }).slice(0, 5);
      const meta = document.querySelector('meta[name=viewport]')?.content || '';
      const sheets = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
      return {
        overflowX: document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth - vw : 0,
        targets: targets.length, under44: small44.length, under24: small24.length,
        under44Examples: small44.slice(0, 4).map(el => `${label(el)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`),
        outside: outside.map(el => label(el)),
        zoomLocked: /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(meta), viewportFit: /viewport-fit=cover/.test(meta),
        safeArea: /safe-area-inset/.test(sheets),
        tinyText: [...document.querySelectorAll('body *')].filter(visible).filter(el => el.childElementCount === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 10).length,
      };
    });
    await page.screenshot({ path: path.join(OUT, `${pname}-${vname}.png`) });
    rows.push({ page: pname, view: vname, ...r });
    await ctx.close(); await rtdb.close();
  }
}
await browser.close(); await site.close();
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${r.page.padEnd(9)} ${r.view.padEnd(20)} overflowX=${String(r.overflowX).padEnd(4)} targets=${String(r.targets).padEnd(3)} <44px=${String(r.under44).padEnd(3)} <24px=${String(r.under24).padEnd(2)} tinyText<10px=${String(r.tinyText).padEnd(3)} zoomLocked=${r.zoomLocked} safeArea=${r.safeArea} ${r.under44Examples.join(' | ')}${r.outside.length ? ' OUTSIDE: ' + r.outside.join(', ') : ''}`);
