// Home splash (side-games/neon-splash-safe-v1.js): once the overlay is removed its animation loop and
// tip timer must stop. NX_SPLASH.show() is reused later (Draft match preloader), so show/hide must keep working.
import { test, expect } from '../harness/fixtures.mjs';

const COUNTER = () => {
  const w = window;
  if (w.__nxSplashProbe) return;
  const probe = w.__nxSplashProbe = { detached: 0, attached: 0, tipWrites: 0 };
  const proto = SVGGeometryElement.prototype, orig = proto.getPointAtLength;
  proto.getPointAtLength = function (...a) { if (this.closest?.('#nxSplashOverlay') || this.id === 'nCore') { if (this.isConnected) probe.attached++; else probe.detached++; } return orig.apply(this, a); };
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', { ...desc, set(v) { if (this.id === 'tip' && !this.isConnected) probe.tipWrites++; return desc.set.call(this, v); } });
};

test('S-01 splash animation and tip timer stop after the overlay is removed; show() still works', async ({ users }) => {
  test.setTimeout(90000);
  const A = await users('A');
  await A.page.addInitScript(COUNTER);
  await A.page.goto('/index.html');
  await A.page.waitForFunction(() => window.NX_SPLASH, null, { timeout: 30000 });
  await A.page.waitForFunction(() => !document.getElementById('nxSplashOverlay'), null, { timeout: 30000 });
  await A.page.evaluate(() => { const p = window.__nxSplashProbe; p.detached = 0; p.tipWrites = 0; });
  await A.page.waitForTimeout(12000);
  const idle = await A.page.evaluate(() => ({ ...window.__nxSplashProbe }));
  console.log('S-01 after first hide', JSON.stringify(idle));

  // Reuse, as the match preloader does: show again, animation must run on the new overlay.
  await A.page.evaluate(() => { window.__nxSplashProbe.attached = 0; window.NX_SPLASH.show(); });
  await expect(A.page.locator('#nxSplashOverlay')).toBeVisible();
  await A.page.waitForTimeout(2500);
  const shown = await A.page.evaluate(() => window.__nxSplashProbe.attached);
  await A.page.evaluate(() => window.NX_SPLASH.hide());
  await A.page.waitForFunction(() => !document.getElementById('nxSplashOverlay'), null, { timeout: 5000 });
  await A.page.evaluate(() => { const p = window.__nxSplashProbe; p.detached = 0; p.tipWrites = 0; });
  await A.page.waitForTimeout(12000);
  const after = await A.page.evaluate(() => ({ ...window.__nxSplashProbe }));
  console.log('S-01 reuse', JSON.stringify({ shown, after }));

  expect(idle.detached, 'animation keeps drawing on the removed overlay').toBe(0);
  expect(idle.tipWrites, 'tip timer keeps writing into the removed overlay').toBe(0);
  expect(shown, 'animation runs when the splash is shown again').toBeGreaterThan(0);
  expect(after.detached + after.tipWrites, 'second overlay also stops after hide').toBe(0);
});
