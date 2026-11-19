// Small touch-target regressions on side games.
import { test, expect } from '../harness/fixtures.mjs';
test('G-01 EN11: the back link has a 44 px tap target and still navigates', async ({ users }) => {
  const A = await users('A', { device: 'iPhone 8' });
  await A.page.goto('/side-games/en11/index.html');
  await A.page.waitForTimeout(1500);
  const r = await A.page.locator('a.back').first().evaluate(a => { const b = a.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top) }; });
  console.log('BACK', JSON.stringify(r));
  await A.page.screenshot({ path: 'qa-suite/.artifacts/games/en11-after.png' });
  expect(r.h).toBeGreaterThanOrEqual(44);
  await A.page.locator('a.back').first().click();
  await expect(A.page).toHaveURL(/side-games\/index\.html$/);
});

// G-02: EN11 "EN YÜKSEK / EN DÜŞÜK" chips look 30 px tall; taps up to 6 px above or below still hit them
// (44 px tap area, Apple HIG) and selecting one still works.
test('G-02 EN11: direction chips have a 44 px tap area and still select', async ({ users }) => {
  const A = await users('A', { device: 'iPhone SE' });
  await A.page.goto('/side-games/en11/index.html');
  await A.page.waitForTimeout(1500);
  // Pick metrics until one offers a direction choice.
  for (let i = 0; i < 12 && !(await A.page.locator('.directionRow .chip').count()); i++) {
    const metrics = A.page.locator('.metricGrid button, [data-metric], .metric');
    if (i >= await metrics.count()) break;
    await metrics.nth(i).click().catch(() => {});
  }
  const chips = A.page.locator('.directionRow .chip');
  expect(await chips.count(), 'direction chips shown').toBeGreaterThanOrEqual(2);
  await chips.first().scrollIntoViewIfNeeded();
  const r = await A.page.evaluate(() => [...document.querySelectorAll('.directionRow .chip')].map(c => {
    const b = c.getBoundingClientRect(), x = b.left + b.width / 2, hit = y => document.elementFromPoint(x, y)?.closest('.chip') === c;
    return { h: Math.round(b.height), above: hit(b.top - 6), below: hit(b.bottom + 6) };
  }));
  console.log('G-02', JSON.stringify(r));
  for (const c of r) { expect(c.above, 'tap 6 px above hits the chip').toBe(true); expect(c.below, 'tap 6 px below hits the chip').toBe(true); }
  const second = chips.nth(1), box = await second.boundingBox();
  await A.page.mouse.click(box.x + box.width / 2, box.y + box.height + 5);
  await expect(A.page.locator('.directionRow .chip').nth(1)).toHaveClass(/active/);
});
