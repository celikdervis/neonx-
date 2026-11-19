// B-02 — cancelling an Imposter search on a side-game page must take the player
// out of the queue. Three independent users (Imposter needs a group of three).
// Expected after A cancels: A's queue entry is gone, A's UI leaves the
// searching state, and B + C searching afterwards are NOT grouped with A.
import { test, expect, waitForDb } from '../harness/fixtures.mjs';
import { openPage } from '../harness/social-helpers.mjs';

const PAGE = '/side-games/futbol-imposter.html';
const Q = 'social/universalQueuesV2/imposter';

async function search(u) {
  await u.page.locator('button.nx-imp-mode', { hasText: 'RAKİP ARA' }).click();
  await expect(u.page.locator('.nx-social-shade [data-act="cancel"]')).toBeVisible();
}

test('B-02 imposter: cancel removes the queue entry and A is not matched afterwards', async ({ users, rtdb }) => {
  const A = await users('A'), B = await users('B'), C = await users('C');
  await Promise.all([openPage(A, PAGE), openPage(B, PAGE), openPage(C, PAGE)]);

  await search(A);
  await waitForDb(rtdb, `${Q}/${A.uid}`, v => v?.status === 'waiting');

  await A.page.locator('.nx-social-shade [data-act="cancel"]').click();
  await expect(A.page.locator('.nx-social-shade [data-act="cancel"]')).toHaveCount(0);
  // Soft: keep going so the user-visible consequence is recorded too.
  await expect.configure({ soft: true }).poll(() => rtdb.get(`${Q}/${A.uid}`), { timeout: 4000, message: "A's queue entry must be removed on cancel" }).toBeNull();

  // B and C now search; with A gone they are only two and must keep waiting.
  await search(B);
  await search(C);
  await waitForDb(rtdb, `${Q}/${C.uid}`, v => !!v);
  await A.page.waitForTimeout(1500);
  const q = rtdb.get(Q) || {};
  expect.soft(q[A.uid], 'A must not be in the queue').toBeUndefined();
  // A wrongful group of three would send B and C into an Imposter room.
  console.log('after B+C search:', JSON.stringify({ queueA: q[A.uid] || null, B: B.page.url(), C: C.page.url() }));
  for (const u of [B, C]) expect(new URL(u.page.url()).searchParams.get('nxAuto'), `${u.label} must still be searching`).toBeNull();
  expect(Object.values(q).filter(x => x?.status === 'matched'), 'no group may be formed with a cancelled player').toEqual([]);

  // A can search again and, with B and C waiting, a fresh group of three forms
  // and all three are sent to the same room.
  // After cancelling, the panel stays open on its "Oyna" tab; A searches again from there.
  await expect(A.page.locator('.nx-social-shade #nxMode')).toHaveValue('imposter');
  await A.page.locator('.nx-social-shade [data-act="match"]').click();
  for (const u of [A, B, C]) await u.page.waitForURL(/nxAuto=1/, { timeout: 10000 });
  const codes = [A, B, C].map(u => new URL(u.page.url()).searchParams.get('nxCode'));
  expect(new Set(codes).size, 'same room for the whole group').toBe(1);
  expect(codes[0]).toBeTruthy();
});
