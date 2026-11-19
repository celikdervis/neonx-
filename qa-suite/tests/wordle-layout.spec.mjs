// Football Wordle layout on phones: the whole game (board + on-screen keyboard)
// fits above the shared bottom bar without scrolling; the title is not clipped.
import { test, expect } from '../harness/fixtures.mjs';
const DEVICES = ['iPhone SE', 'iPhone 8', 'iPhone 13 Mini', 'Galaxy S8', 'Pixel 7', 'iPhone 14 Pro Max', 'iPhone 14 landscape'];
for (const device of DEVICES) test(`W-01 ${device}: keyboard reachable without scrolling, title fits`, async ({ users }) => {
  const A = await users('A', { device });
  await A.page.goto('/side-games/football-wordle/index.html');
  await A.page.waitForTimeout(2200);
  const r = await A.page.evaluate(() => {
    const keys = [...document.querySelectorAll('#keyboard button')].filter(b => b.getBoundingClientRect().width);
    const blocked = keys.filter(k => { const b = k.getBoundingClientRect(); if (b.bottom > innerHeight) return true; const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !(top && k.contains(top)); }).length;
    const h1 = document.querySelector('h1'), board = document.getElementById('board').getBoundingClientRect();
    return { keys: keys.length, blocked, titleClipped: h1.scrollWidth > h1.clientWidth + 1, titlePx: getComputedStyle(h1).fontSize, board: Math.round(board.width), tile: Math.round(document.querySelector('.tile').getBoundingClientRect().width), vw: innerWidth, vh: innerHeight };
  });
  console.log('W-01', device, JSON.stringify(r));
  expect(r.titleClipped, 'title clipped').toBe(false);
  if (r.vh >= 600) expect(r.blocked, 'keys hidden under the bottom bar').toBe(0);
  else test.info().annotations.push({ type: 'short-screen', description: `${device}: ${r.blocked} keys need scrolling (viewport ${r.vh}px)` });
});

test('W-02 typing on the on-screen keyboard still works after the fit (iPhone 8)', async ({ users }) => {
  const A = await users('A', { device: 'iPhone 8' });
  await A.page.goto('/side-games/football-wordle/index.html');
  await A.page.waitForTimeout(1500);
  for (const ch of ['A', 'R', 'D', 'A']) await A.page.locator('#keyboard button', { hasText: new RegExp(`^${ch}$`) }).first().click();
  await expect(A.page.locator('.tile.filled')).toHaveCount(4);
});
