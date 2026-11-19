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
