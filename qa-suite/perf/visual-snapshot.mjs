#!/usr/bin/env node
// Renders the home screen (signed in) and the entry screen (signed out) after all
// artwork has loaded and saves screenshots, so asset/format changes can be
// compared pixel by pixel:  node qa-suite/perf/visual-snapshot.mjs <outDir>
//                           node qa-suite/perf/visual-snapshot.mjs --compare <dirA> <dirB>
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockRtdb } from '../harness/mock-rtdb-server.mjs';
import { startStaticServer } from './static-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MOCK = path.join(ROOT, 'qa-suite/harness/mock-modules');
const VIEWS = { 'pixel7': devices['Pixel 7'], 'iphone-se': devices['iPhone SE'], 'desktop': { viewport: { width: 1280, height: 800 } } };

async function shoot(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const site = await startStaticServer(ROOT), browser = await chromium.launch();
  const net = [];
  try {
    for (const [name, dev] of Object.entries(VIEWS)) {
      for (const signedIn of [true, false]) {
        const rtdb = await startMockRtdb();
        rtdb.seed('social/profiles/uid_A', { username: 'qa_a', key: 'qa_a' });
        const ctx = await browser.newContext({ ...dev, serviceWorkers: 'block' });
        await ctx.addInitScript(({ u, s }) => { window.__NX_MOCK__ = { rtdb: u, google: { uid: 'uid_A' } }; if (s) try { localStorage.setItem('nxmock:auth:user', JSON.stringify({ uid: 'uid_A', isAnonymous: false })); } catch {} }, { u: rtdb.url, s: signedIn });
        await ctx.route(/^https:/, r => { const m = r.request().url().match(/firebasejs\/12\.16\.0\/(firebase-[a-z]+|rtdb-shared)\.js/); return m ? r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(MOCK, m[1] + '.js'), 'utf8') }) : r.abort(); });
        const page = await ctx.newPage();
        page.on('response', r => { if (/\.(png|webp)(\?|$)/.test(r.url())) net.push(`${name}/${signedIn ? 'home' : 'entry'} ${r.url().replace(/^.*?\/\/[^/]+/, '').replace(/\?.*/, '')}`); });
        await page.goto(site.url + '/index.html');
        if (signedIn) await page.waitForFunction(() => { const imgs = [...document.querySelectorAll('#bootHome img[data-layer]')]; return document.querySelector('#bootHome.nx-approved-home-v1.active') && !document.getElementById('nxSplashOverlay') && imgs.length && imgs.every(i => i.complete && i.naturalWidth); }, null, { timeout: 60000 });
        else await page.waitForFunction(() => { const e = document.getElementById('nxEntry'), a = e?.querySelector('.nx-entry-art'); return e && !e.hidden && e.dataset.phase === 'welcome' && a?.complete && a.naturalWidth; }, null, { timeout: 60000 });
        await page.waitForTimeout(1200);
        // Freeze the ever-changing parts (profile chip text depends on timing).
        await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
        await page.waitForTimeout(300);
        const file = path.join(outDir, `${signedIn ? 'home' : 'entry'}-${name}.png`);
        await page.screenshot({ path: file });
        const chosen = await page.evaluate(() => [...document.querySelectorAll('#bootHome img[data-layer], #nxEntry .nx-entry-art')].map(i => (i.currentSrc || i.src).replace(/^.*\//, '').replace(/\?.*/, '')));
        console.log(path.basename(file), 'currentSrc:', chosen.join(', '));
        await ctx.close(); await rtdb.close();
      }
    }
  } finally { await browser.close(); await site.close(); }
  fs.writeFileSync(path.join(outDir, 'image-requests.txt'), [...new Set(net)].join('\n') + '\n');
}

async function compare(a, b) {
  const browser = await chromium.launch(), page = await browser.newPage();
  for (const f of fs.readdirSync(a).filter(x => x.endsWith('.png'))) {
    if (!fs.existsSync(path.join(b, f))) { console.log(f, 'missing in', b); continue; }
    const [da, db] = [a, b].map(d => 'data:image/png;base64,' + fs.readFileSync(path.join(d, f)).toString('base64'));
    const r = await page.evaluate(async ([x, y]) => {
      const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: [ia.width, ia.height, ib.width, ib.height] };
      const c = (img) => { const cv = new OffscreenCanvas(img.width, img.height), g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const pa = c(ia), pb = c(ib);
      let se = 0, max = 0, diff = 0;
      for (let i = 0; i < pa.length; i += 4) { let px = 0; for (let k = 0; k < 3; k++) { const d = pa[i + k] - pb[i + k]; se += d * d; px = Math.max(px, Math.abs(d)); } max = Math.max(max, px); if (px > 24) diff++; }
      const mse = se / (pa.length / 4 * 3);
      return { psnr: mse === 0 ? 99 : +(10 * Math.log10(255 * 255 / mse)).toFixed(1), maxChannelDiff: max, pixelsOver24: +(diff / (pa.length / 4) * 100).toFixed(3) + '%' };
    }, [da, db]);
    console.log(f.padEnd(22), JSON.stringify(r));
  }
  await browser.close();
}

if (process.argv[2] === '--compare') await compare(process.argv[3], process.argv[4]);
else await shoot(process.argv[2] || path.join(ROOT, 'qa-suite/.artifacts/visual'));
