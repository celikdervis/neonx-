// Party / lobby regression on a side-game page (legacy panel + consistency-v1),
// with 2–4 independent users. The database is checked as the oracle and each
// user's own screen is checked for what that user should see.
import { test, expect, waitForDb } from '../harness/fixtures.mjs';
import { befriend, openPage, legacy, partyOf } from '../harness/social-helpers.mjs';

const PAGE = '/side-games/football-xox/index.html';
const view = (u) => u.page.locator('.nx-social-shade [data-view="party"]');
const GRACE = { NEON_SOCIAL_OFFLINE_GRACE_MS: 2500 };

async function setup(users, rtdb, labels, opts = {}) {
  const list = [];
  for (const l of labels) list.push(await users(l, opts));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) befriend(rtdb, list[i], list[j]);
  await Promise.all(list.map(u => openPage(u, PAGE)));
  return list;
}
async function partyWith(rtdb, leader, members) {
  await legacy.createParty(leader);
  await waitForDb(rtdb, `social/userParty/${leader.uid}`, v => !!v);
  const id = partyOf(rtdb, leader);
  for (const m of members) {
    await legacy.invite(leader, m);
    await waitForDb(rtdb, `social/partyInvites/${m.uid}/${id}`, v => !!v);
    await legacy.acceptInvite(m, id);
    await waitForDb(rtdb, `social/parties/${id}/members/${m.uid}`, v => !!v);
    await waitForDb(rtdb, `social/userParty/${m.uid}`, v => v === id);
  }
  return id;
}

test('P-01/02 create, invite, accept: both screens show the same lobby', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B']);
  const id = await partyWith(rtdb, A, [B]);
  const party = rtdb.get(`social/parties/${id}`);
  expect(party.leaderUid).toBe(A.uid);
  expect(Object.keys(party.members).sort()).toEqual([A.uid, B.uid].sort());
  expect(rtdb.get(`social/partyInvites/${B.uid}`)).toBeNull();
  await legacy.open(A, 'party');
  await expect(view(A)).toContainText(`@${B.username}`);
  await expect(view(A)).toContainText('LİDER');
  await legacy.open(B, 'party');
  await expect(view(B)).toContainText(`@${A.username}`);
  await expect(view(B)).toContainText('ÜYE');
});

test('P-03 reject invite: invite removed, party unchanged', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B']);
  await legacy.createParty(A);
  await waitForDb(rtdb, `social/userParty/${A.uid}`, v => !!v);
  const id = partyOf(rtdb, A);
  await legacy.invite(A, B);
  await waitForDb(rtdb, `social/partyInvites/${B.uid}/${id}`, v => !!v);
  await legacy.open(B, 'party');
  await B.page.locator(`.nx-social-shade [data-party-reject="${id}"]`).click();
  await waitForDb(rtdb, `social/partyInvites/${B.uid}/${id}`, v => v === null);
  await expect(B.page.locator(`.nx-social-shade [data-party-accept="${id}"]`)).toHaveCount(0);
  expect(partyOf(rtdb, B)).toBeNull();
  expect(Object.keys(rtdb.get(`social/parties/${id}/members`))).toEqual([A.uid]);
});

test('P-04 leader leaves: leadership passes to the remaining member on both screens', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B']);
  const id = await partyWith(rtdb, A, [B]);
  await legacy.open(B, 'party');
  await legacy.leave(A);
  await waitForDb(rtdb, `social/parties/${id}/leaderUid`, v => v === B.uid);
  await waitForDb(rtdb, `social/userParty/${A.uid}`, v => v === null);
  expect(Object.keys(rtdb.get(`social/parties/${id}/members`))).toEqual([B.uid]);
  await expect(view(B)).toContainText('LİDER');
  await expect(view(B)).not.toContainText(`@${A.username}`);
  await expect(A.page.locator('.nx-social-shade [data-act="create-party"]')).toBeVisible();
});

test('P-05 stale invite: accepting after the party closed fails cleanly (scenario 10)', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B']);
  await legacy.createParty(A);
  await waitForDb(rtdb, `social/userParty/${A.uid}`, v => !!v);
  const id = partyOf(rtdb, A);
  await legacy.invite(A, B);
  await waitForDb(rtdb, `social/partyInvites/${B.uid}/${id}`, v => !!v);
  await legacy.leave(A);
  await waitForDb(rtdb, `social/parties/${id}`, v => v === null);
  await legacy.acceptInvite(B, id);
  await expect(legacy.status(B)).toHaveClass(/error/);
  await waitForDb(rtdb, `social/partyInvites/${B.uid}/${id}`, v => v === null, { message: 'stale invite removed' });
  await B.page.waitForTimeout(500);
  expect(rtdb.get(`social/parties/${id}`), 'no zombie party node').toBeNull();
  expect(partyOf(rtdb, B)).toBeNull();
});

test('P-06 two invited users accept at the same moment (scenario 6)', async ({ users, rtdb }) => {
  const [A, B, C] = await setup(users, rtdb, ['A', 'B', 'C']);
  await legacy.createParty(A);
  await waitForDb(rtdb, `social/userParty/${A.uid}`, v => !!v);
  const id = partyOf(rtdb, A);
  for (const u of [B, C]) { await legacy.invite(A, u); await waitForDb(rtdb, `social/partyInvites/${u.uid}/${id}`, v => !!v); }
  await Promise.all([B, C].map(u => legacy.open(u, 'party')));
  await Promise.all([B, C].map(u => u.page.locator(`.nx-social-shade [data-party-accept="${id}"]`).click()));
  await waitForDb(rtdb, `social/parties/${id}/members`, m => m && Object.keys(m).length === 3);
  for (const u of [B, C]) await waitForDb(rtdb, `social/userParty/${u.uid}`, v => v === id);
  expect(rtdb.get(`social/parties/${id}/leaderUid`)).toBe(A.uid);
  await legacy.open(A, 'party');
  for (const u of [B, C]) await expect(view(A)).toContainText(`@${u.username}`);
});

test('P-07 one user, two invites from two parties, accepted at once: exactly one membership', async ({ users, rtdb }) => {
  const [A, B, D] = await setup(users, rtdb, ['A', 'B', 'D']);
  await legacy.createParty(A); await legacy.createParty(D);
  await waitForDb(rtdb, `social/userParty/${A.uid}`, v => !!v);
  await waitForDb(rtdb, `social/userParty/${D.uid}`, v => !!v);
  const pa = partyOf(rtdb, A), pd = partyOf(rtdb, D);
  await legacy.invite(A, B); await legacy.invite(D, B);
  await waitForDb(rtdb, `social/partyInvites/${B.uid}`, v => v && v[pa] && v[pd]);
  await legacy.open(B, 'party');
  await B.page.evaluate(([x, y]) => {
    document.querySelector(`.nx-social-shade [data-party-accept="${x}"]`).click();
    document.querySelector(`.nx-social-shade [data-party-accept="${y}"]`).click();
  }, [pa, pd]);
  await B.page.waitForTimeout(2500);
  const inA = !!rtdb.get(`social/parties/${pa}/members/${B.uid}`), inD = !!rtdb.get(`social/parties/${pd}/members/${B.uid}`);
  expect([inA, inD].filter(Boolean).length, 'member of exactly one party').toBe(1);
  expect(partyOf(rtdb, B)).toBe(inA ? pa : pd);
});

test('P-08 reload keeps the lobby on both sides', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B']);
  const id = await partyWith(rtdb, A, [B]);
  await B.page.reload();
  await openPage(B, PAGE);
  await legacy.open(B, 'party');
  await expect(view(B)).toContainText(`@${A.username}`);
  expect(partyOf(rtdb, B)).toBe(id);
  expect(Object.keys(rtdb.get(`social/parties/${id}/members`)).length).toBe(2);
});

test('P-09 member drops and reconnects within the grace period stays in the lobby (scenario 7)', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B'], { globals: GRACE });
  const id = await partyWith(rtdb, A, [B]);
  await B.page.evaluate(() => window.__NX_MOCK_NET__.drop());
  await waitForDb(rtdb, `social/presence/${B.uid}/connections`, v => v === null);
  await A.page.waitForTimeout(1000);
  await B.page.evaluate(() => window.__NX_MOCK_NET__.restore());
  await waitForDb(rtdb, `social/presence/${B.uid}/connections`, v => !!v);
  await A.page.waitForTimeout(3500);
  expect(rtdb.get(`social/parties/${id}/members/${B.uid}`)).toBeTruthy();
  expect(partyOf(rtdb, B)).toBe(id);
});

test('P-10 member offline beyond the grace period is removed; both screens agree', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B'], { globals: GRACE });
  const id = await partyWith(rtdb, A, [B]);
  await legacy.open(A, 'party');
  await B.page.evaluate(() => window.__NX_MOCK_NET__.drop());
  await waitForDb(rtdb, `social/parties/${id}/members/${B.uid}`, v => v === null, { timeout: 10000, message: 'offline member cleaned up' });
  await waitForDb(rtdb, `social/userParty/${B.uid}`, v => v === null);
  await expect(view(A)).not.toContainText(`@${B.username}`);
  await B.page.evaluate(() => window.__NX_MOCK_NET__.restore());
  await legacy.open(B, 'party');
  await expect(B.page.locator('.nx-social-shade [data-act="create-party"]')).toBeVisible();
});

test('P-11 leader offline beyond the grace period: remaining member becomes leader (scenario 8)', async ({ users, rtdb }) => {
  const [A, B] = await setup(users, rtdb, ['A', 'B'], { globals: GRACE });
  const id = await partyWith(rtdb, A, [B]);
  await legacy.open(B, 'party');
  await A.page.evaluate(() => window.__NX_MOCK_NET__.drop());
  await waitForDb(rtdb, `social/parties/${id}/leaderUid`, v => v === B.uid, { timeout: 10000 });
  expect(rtdb.get(`social/parties/${id}/members/${A.uid}`)).toBeNull();
  await expect(view(B)).toContainText('LİDER');
});

test('P-12 four users: join, two leave, leadership and membership stay consistent', async ({ users, rtdb }) => {
  const [A, B, C, D] = await setup(users, rtdb, ['A', 'B', 'C', 'D']);
  const id = await partyWith(rtdb, A, [B, C, D]);
  expect(Object.keys(rtdb.get(`social/parties/${id}/members`)).length).toBe(4);
  await Promise.all([legacy.leave(A), legacy.leave(C)]);
  await waitForDb(rtdb, `social/parties/${id}/members`, m => m && Object.keys(m).sort().join() === [B.uid, D.uid].sort().join());
  const leader = rtdb.get(`social/parties/${id}/leaderUid`);
  expect([B.uid, D.uid]).toContain(leader);
  for (const u of [A, C]) await waitForDb(rtdb, `social/userParty/${u.uid}`, v => v === null);
  for (const u of [B, D]) expect(partyOf(rtdb, u)).toBe(id);
});
