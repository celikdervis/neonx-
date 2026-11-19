// B-01 — the last member of a party cannot leave it on side-game pages.
// Two independent users (separate browser contexts and identities).
// Expected: when the last member leaves, both `social/parties/{id}` and
// `social/userParty/{uid}` are gone, the UI says so, and no error is thrown.
import { test, expect, waitForDb } from '../harness/fixtures.mjs';
import { SIDE_PAGES, befriend, openPage, legacy, partyOf } from '../harness/social-helpers.mjs';

for (const [name, path] of Object.entries(SIDE_PAGES)) {
  test(`B-01 ${name}: A creates, B joins, B leaves, then A (last member) leaves`, async ({ users, rtdb }) => {
    const A = await users('A'), B = await users('B');
    befriend(rtdb, A, B);
    await Promise.all([openPage(A, path), openPage(B, path)]);

    await legacy.createParty(A);
    await waitForDb(rtdb, `social/userParty/${A.uid}`, v => !!v);
    const partyId = partyOf(rtdb, A);

    await legacy.invite(A, B);
    await waitForDb(rtdb, `social/partyInvites/${B.uid}/${partyId}`, v => !!v);
    await legacy.acceptInvite(B, partyId);
    await waitForDb(rtdb, `social/parties/${partyId}/members`, m => m && Object.keys(m).length === 2);
    // A sees B in the lobby.
    await legacy.open(A, 'party');
    await expect(A.page.locator('.nx-social-shade [data-view="party"]')).toContainText(`@${B.username}`);

    // Step 2: B leaves (party keeps A).
    await legacy.leave(B);
    await waitForDb(rtdb, `social/parties/${partyId}/members`, m => m && !m[B.uid] && !!m[A.uid]);
    // Leaving is two transactions (party node, then the member's pointer), as in
    // neon-party-membership-integrity-v2.js — wait for the pointer, don't race it.
    await waitForDb(rtdb, `social/userParty/${B.uid}`, v => v === null, { message: 'B must no longer point at the party' });
    await expect(A.page.locator('.nx-social-shade [data-view="party"]')).not.toContainText(`@${B.username}`);

    // Step 3: A, now the only member, leaves.
    const errorsBefore = A.errors.length;
    await legacy.leave(A);
    await waitForDb(rtdb, `social/userParty/${A.uid}`, v => v === null, { message: 'A must no longer point at a party' });
    await waitForDb(rtdb, `social/parties/${partyId}`, v => v === null, { message: 'empty party record must be removed' });
    await expect(A.page.locator('.nx-social-shade [data-act="create-party"]')).toBeVisible();
    expect(A.errors.slice(errorsBefore), 'no uncaught error while leaving').toEqual([]);
  });
}

test('B-01 home (control): last member leaves through the drawer path', async ({ users, rtdb }) => {
  const A = await users('A');
  await A.page.goto('/index.html');
  await A.page.waitForFunction(() => window.NEON_SOCIAL?.profile && window.NEON_PARTY_MEMBERSHIP && window.NEON_SOCIAL_CONSISTENCY, null, { timeout: 30000 });
  await A.page.evaluate(() => window.NEON_SOCIAL_CONSISTENCY.ensureParty());
  await waitForDb(rtdb, `social/userParty/${A.uid}`, v => !!v);
  const partyId = partyOf(rtdb, A);
  const result = await A.page.evaluate(() => window.NEON_PARTY_MEMBERSHIP.leaveCurrentParty());
  expect(result.left).toBe(true);
  await waitForDb(rtdb, `social/userParty/${A.uid}`, v => v === null);
  await waitForDb(rtdb, `social/parties/${partyId}`, v => v === null);
});
