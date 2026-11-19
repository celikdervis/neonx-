// Matchmaking regression on side-game pages (legacy neon-social.js queue).
// 1v1 modes use social/matchQueues/{mode}; Imposter uses social/universalQueuesV2/imposter.
import { test, expect, waitForDb } from '../harness/fixtures.mjs';
import { openPage, legacy } from '../harness/social-helpers.mjs';

const XOX = '/side-games/football-xox/index.html';
const IMP = '/side-games/futbol-imposter.html';

async function searchFromPanel(u, mode) {
  await legacy.open(u, 'play');
  await u.page.locator('.nx-social-shade #nxMode').selectOption(mode);
  await u.page.locator('.nx-social-shade [data-act="match"]').click();
  await expect(u.page.locator('.nx-social-shade [data-act="cancel"]')).toBeVisible();
}
const params = (u) => new URL(u.page.url()).searchParams;

test('M-01 1v1 (XOX): two searchers are sent to the same room with host/guest roles', async ({ users }) => {
  const A = await users('A'), B = await users('B');
  await Promise.all([openPage(A, XOX), openPage(B, XOX)]);
  await searchFromPanel(A, 'xox');
  await searchFromPanel(B, 'xox');
  for (const u of [A, B]) await u.page.waitForURL(/nxAuto=1/, { timeout: 10000 });
  expect(params(A).get('nxCode')).toBe(params(B).get('nxCode'));
  expect(params(A).get('nxMatch')).toBe(params(B).get('nxMatch'));
  expect([params(A).get('nxRole'), params(B).get('nxRole')].sort()).toEqual(['guest', 'host']);
  expect(params(A).get('nxOpponent')).toBe(B.uid);
  expect(params(B).get('nxOpponent')).toBe(A.uid);
});

test('M-02 1v1 (XOX): cancel removes the entry, nobody is matched with the canceller, re-search works', async ({ users, rtdb }) => {
  const A = await users('A'), B = await users('B');
  await Promise.all([openPage(A, XOX), openPage(B, XOX)]);
  await searchFromPanel(A, 'xox');
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => v?.status === 'waiting');
  await A.page.locator('.nx-social-shade [data-act="cancel"]').click();
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => v === null);
  await searchFromPanel(B, 'xox');
  await B.page.waitForTimeout(1500);
  expect(params(B).get('nxAuto')).toBeNull();
  await expect(A.page.locator('.nx-social-shade #nxMode')).toHaveValue('xox');
  await A.page.locator('.nx-social-shade [data-act="match"]').click();
  for (const u of [A, B]) await u.page.waitForURL(/nxAuto=1/, { timeout: 10000 });
  expect(params(A).get('nxCode')).toBe(params(B).get('nxCode'));
});

test('M-03 Imposter: three searchers form one group; the earliest is host', async ({ users }) => {
  const A = await users('A'), B = await users('B'), C = await users('C');
  await Promise.all([A, B, C].map(u => openPage(u, IMP)));
  for (const u of [A, B, C]) await searchFromPanel(u, 'imposter');
  for (const u of [A, B, C]) await u.page.waitForURL(/nxAuto=1/, { timeout: 10000 });
  expect(new Set([A, B, C].map(u => params(u).get('nxCode'))).size).toBe(1);
  expect(params(A).get('nxRole')).toBe('host');
  expect([B, C].map(u => params(u).get('nxRole'))).toEqual(['guest', 'guest']);
  expect(params(A).get('nxPartySize')).toBe('3');
});

test('M-04 connection lost while searching removes the entry; others are not matched with the ghost', async ({ users, rtdb }) => {
  const A = await users('A'), B = await users('B');
  await Promise.all([openPage(A, XOX), openPage(B, XOX)]);
  await searchFromPanel(A, 'xox');
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => !!v);
  await A.page.evaluate(() => window.__NX_MOCK_NET__.drop());
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => v === null, { message: 'onDisconnect removes the queue entry' });
  await searchFromPanel(B, 'xox');
  await B.page.waitForTimeout(1500);
  expect(params(B).get('nxAuto')).toBeNull();
});

test('M-05 reload while searching removes the entry (no ghost in the queue)', async ({ users, rtdb }) => {
  const A = await users('A'), B = await users('B');
  await Promise.all([openPage(A, XOX), openPage(B, XOX)]);
  await searchFromPanel(A, 'xox');
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => !!v);
  await A.page.reload();
  await openPage(A, XOX);
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => v === null);
  await searchFromPanel(B, 'xox');
  await B.page.waitForTimeout(1500);
  expect(params(B).get('nxAuto')).toBeNull();
});

// Exploratory (records the outcome; tagged so it can be tracked separately).
test('M-06 [exploratory] cancel at the same moment the opponent starts searching', async ({ users, rtdb }, testInfo) => {
  const A = await users('A'), B = await users('B');
  await Promise.all([openPage(A, XOX), openPage(B, XOX)]);
  await searchFromPanel(A, 'xox');
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => !!v);
  await legacy.open(B, 'play');
  await B.page.locator('.nx-social-shade #nxMode').selectOption('xox');
  await Promise.all([
    A.page.locator('.nx-social-shade [data-act="cancel"]').click(),
    B.page.locator('.nx-social-shade [data-act="match"]').click(),
  ]);
  await B.page.waitForTimeout(2000);
  const outcome = { A: params(A).get('nxAuto') ? 'sent-to-room' : 'stayed', B: params(B).get('nxAuto') ? 'sent-to-room' : 'stayed' };
  testInfo.annotations.push({ type: 'outcome', description: JSON.stringify(outcome) });
  console.log('M-06 outcome', JSON.stringify(outcome));
  expect(outcome.A === outcome.B, 'both players must end in the same state (both matched or neither)').toBe(true);
});

// Forces the M-06 window deterministically: A's writes reach the server 1.5 s
// late (slow mobile uplink), so B's matching transaction lands first.
test('M-07 [exploratory] cancel on a slow connection while an opponent matches', async ({ users, rtdb }, testInfo) => {
  const A = await users('A'), B = await users('B');
  await Promise.all([openPage(A, XOX), openPage(B, XOX)]);
  await searchFromPanel(A, 'xox');
  await waitForDb(rtdb, `social/matchQueues/xox/${A.uid}`, v => !!v);
  await A.context.route(`${rtdb.url}/write`, async route => { await new Promise(r => setTimeout(r, 1500)); await route.continue(); });
  await A.page.locator('.nx-social-shade [data-act="cancel"]').click();
  await searchFromPanel(B, 'xox').catch(() => {});
  await B.page.waitForTimeout(3000);
  const outcome = { A: params(A).get('nxAuto') ? 'sent-to-room' : 'stayed', B: params(B).get('nxAuto') ? 'sent-to-room' : 'stayed', queueA: rtdb.get(`social/matchQueues/xox/${A.uid}`) };
  testInfo.annotations.push({ type: 'outcome', description: JSON.stringify(outcome) });
  console.log('M-07 outcome', JSON.stringify(outcome));
  expect(outcome.A === outcome.B, 'both players must end in the same state (both matched or neither)').toBe(true);
});
