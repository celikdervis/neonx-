// Futbol XOX presentation regression (game rules untouched): a real local game
// is played to a win on three phone/desktop sizes with valid answers taken from
// the game's own data. Run with QA_FONTS_DIR set to use the production fonts.
import { test, expect } from '../harness/fixtures.mjs';
import { startLocalXox, playTopRowWin } from '../harness/xox-play.mjs';

const overflowing = (page) => page.evaluate(() => [...document.querySelectorAll('.grid .headText, .grid .cellName')].filter(t => {
  const box = t.closest('.head, .cell'), s = getComputedStyle(box), avail = box.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
  const r = document.createRange(); r.selectNodeContents(t); return r.getBoundingClientRect().width > avail + 1;
}).map(t => t.textContent));

for (const [name, device] of [['iPhone SE', 'iPhone SE'], ['Pixel 7', 'Pixel 7'], ['desktop', undefined]]) {
  test(`X-01 ${name}: picker above the bottom bar, win line under names, result brought into view`, async ({ users }) => {
    const A = await users('A', { device, profile: false });
    await A.page.goto('/side-games/football-xox/index.html');
    await startLocalXox(A.page);
    // B-06: every result in the picker must be the element that receives the tap.
    await A.page.locator('.grid .cell').first().click();
    await A.page.locator('.modal .field').fill('a');
    await expect(A.page.locator('.modal .result').first()).toBeVisible();
    const covered = await A.page.evaluate(() => [...document.querySelectorAll('.modal .result')].filter(r => { const b = r.getBoundingClientRect(); if (b.bottom > innerHeight || b.top < 0) return false; const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return top && !r.contains(top); }).length);
    expect(covered, 'visible picker results covered by another layer').toBe(0);
    await A.page.locator('.modal .close').first().click();
    await A.page.locator('.modal').waitFor({ state: 'detached' }).catch(() => {});

    await playTopRowWin(A.page);
    await expect(A.page.locator('.winTitle')).toHaveText('OYUNCU 1 KAZANDI');
    await expect(A.page.locator('.grid .cell.winning-cell')).toHaveCount(3);
    // Names stay above the line: the line's svg sits below the name layer.
    const order = await A.page.evaluate(() => { const svg = document.querySelector('.win-stroke'), name = document.querySelector('.cell.winning-cell .cellName'); return [Number(getComputedStyle(svg).zIndex), Number(getComputedStyle(name).zIndex), getComputedStyle(document.querySelector('.cell.winning-cell')).isolation]; });
    expect(order[1], 'name z-index above line').toBeGreaterThan(order[0]);
    expect(order[2]).toBe('auto');
    // Result card ends up above the bottom navigation.
    await expect.poll(() => A.page.evaluate(() => { const c = document.querySelector('.winTitle').getBoundingClientRect(), f = document.getElementById('nx-arcade-footer')?.getBoundingClientRect(); return c.top >= 0 && c.bottom <= (f ? f.top : innerHeight); }), { timeout: 5000 }).toBe(true);
    expect(await overflowing(A.page)).toEqual([]);
    expect(A.errors).toEqual([]);
  });
}

test('X-02 iPhone SE: across 20 random boards no header or name overflows or is split mid-word', async ({ users }) => {
  const A = await users('A', { device: 'iPhone SE', profile: false });
  await A.page.goto('/side-games/football-xox/index.html');
  await startLocalXox(A.page);
  const bad = new Set(), wrapped = new Set();
  for (let n = 0; n < 20; n++) {
    await A.page.waitForTimeout(250);
    (await overflowing(A.page)).forEach(t => bad.add(t));
    (await A.page.evaluate(() => [...document.querySelectorAll('.grid .nx-fit-wrap')].map(t => t.textContent))).forEach(t => wrapped.add(t));
    await A.page.locator('button', { hasText: /YENİ TAHTA|YENİ OYUN|TAHTAYI YENİLE/ }).first().click();
  }
  expect([...bad]).toEqual([]);
  test.info().annotations.push({ type: 'wrap-fallback', description: JSON.stringify([...wrapped]) });
});
