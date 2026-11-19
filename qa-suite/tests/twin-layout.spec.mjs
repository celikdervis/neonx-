// Career Twin menu layout on phones and desktop: the "OYUN MODU" title, the three mode buttons
// and the "NASIL OYNANIR?" card do not overlap, every mode button is tappable, and the help card
// can be scrolled clear of the shared bottom bar.
import { test, expect } from '../harness/fixtures.mjs';
const DEVICES = ['iPhone SE', 'iPhone 8', 'iPhone 13 Mini', 'Galaxy S8', 'Pixel 7', 'iPhone 14 Pro Max', 'Desktop Chrome'];

async function measure(page) {
  return page.evaluate(() => {
    const box = el => { const b = el.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, h: b.height }; };
    const overlap = (a, b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 0.5 && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5;
    const title = document.querySelector('.menuPanelTitle'), how = document.querySelector('.howPanel');
    const modes = [...document.querySelectorAll('.menuPanel .menuMode')];
    const t = box(title), h = how && box(how), m = modes.map(box);
    // Title: compare its text, not its line box, against the first button.
    const range = document.createRange(); range.selectNodeContents(title);
    const tr = range.getBoundingClientRect(), text = { top: tr.top + scrollY, bottom: tr.bottom + scrollY, left: tr.left, right: tr.right };
    const res = {
      vw: innerWidth, vh: innerHeight, modes: m.map(x => [Math.round(x.top), Math.round(x.bottom)]),
      title: [Math.round(text.top), Math.round(text.bottom)], how: h && [Math.round(h.top), Math.round(h.bottom)],
      titleOverlapsMode: m.some(x => overlap(text, x)),
      howOverlapsMode: !!h && m.some(x => overlap(h, x)),
      howOverlapsPanel: !!h && overlap(h, box(document.querySelector('.menuPanel'))),
      modesTiny: m.filter(x => x.h < 44).length,
      blocked: [], howCovered: null,
    };
    for (const el of modes) {
      el.scrollIntoView({ block: 'center' });
      const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (!(hit && el.contains(hit))) res.blocked.push(el.textContent.trim().slice(0, 18));
    }
    if (how) {
      scrollTo(0, document.documentElement.scrollHeight);
      const b = how.getBoundingClientRect(), footer = document.getElementById('nx-arcade-footer');
      const fTop = footer && getComputedStyle(footer).display !== 'none' ? footer.getBoundingClientRect().top : innerHeight;
      res.howCovered = Math.max(0, Math.round(b.bottom - Math.min(fTop, innerHeight)));
    }
    scrollTo(0, 0);
    return res;
  });
}

for (const device of DEVICES) test(`T-01 ${device}: Career Twin menu has no overlaps and every mode is tappable`, async ({ users }) => {
  const A = await users('A', { device });
  await A.page.goto('/side-games/career-twin/index.html');
  await A.page.waitForSelector('.menuPanel .menuMode');
  await A.page.evaluate(() => document.fonts?.ready);
  await A.page.waitForTimeout(1200);
  const r = await measure(A.page);
  console.log('T-01', device, JSON.stringify(r));
  await A.page.screenshot({ path: test.info().outputPath('menu.png') });
  expect(r.modes.length, 'three mode buttons').toBe(3);
  expect(r.titleOverlapsMode, '"OYUN MODU" title overlaps the first mode button').toBe(false);
  expect(r.howOverlapsMode, 'help card overlaps a mode button').toBe(false);
  expect(r.howOverlapsPanel, 'help card overlaps the mode panel').toBe(false);
  expect(r.modesTiny, 'mode buttons shorter than 44px').toBe(0);
  expect(r.blocked, 'mode buttons covered by another element').toEqual([]);
  expect(r.howCovered, 'help card hidden under the bottom bar at full scroll').toBe(0);
});

test('T-02 iPhone 8: RAKİP ARA opens the online search flow', async ({ users }) => {
  const A = await users('A', { device: 'iPhone 8' });
  await A.page.goto('/side-games/career-twin/index.html');
  await A.page.waitForSelector('.menuPanel .menuMode');
  await A.page.waitForTimeout(1500);
  const btn = A.page.locator('.menuPanel .menuMode', { hasText: 'RAKİP ARA' });
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ timeout: 5000 });
  await expect(A.page.locator('.nx-social-shade').first()).toBeVisible({ timeout: 8000 });
});
