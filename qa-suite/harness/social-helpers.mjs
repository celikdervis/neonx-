// Helpers that drive the social UI the way a player does (real clicks), and
// read the mock database as the oracle. Opening a panel uses NEON_SOCIAL.open,
// the same entry point the page's own navigation calls.
import { expect } from './fixtures.mjs';

export const SIDE_PAGES = {
  xox: '/side-games/football-xox/index.html',
  twin: '/side-games/career-twin/index.html',
  wordle: '/side-games/football-wordle/index.html',
  arcade: '/side-games/index.html',
  imposter: '/side-games/futbol-imposter.html',
};

export function befriend(rtdb, a, b) {
  rtdb.seed(`social/friends/${a.uid}/${b.uid}`, { username: b.username, since: Date.now() });
  rtdb.seed(`social/friends/${b.uid}/${a.uid}`, { username: a.username, since: Date.now() });
}

export async function openPage(u, path) {
  await u.page.goto(path);
  await u.page.waitForFunction(() => window.NEON_SOCIAL?.profile && window.__NX_MOCK_NET__?.connected, null, { timeout: 15000 });
}

/** Legacy panel (neon-social.js) used on side-game pages. */
export const legacy = {
  shade: (u) => u.page.locator('.nx-social-shade'),
  async open(u, tab) {
    await u.page.evaluate(t => window.NEON_SOCIAL.open(t), tab);
    await expect(u.page.locator('.nx-social-shade.open')).toBeVisible();
    await u.page.locator(`.nx-social-shade [data-tab="${tab}"]`).click();
  },
  status: (u) => u.page.locator('.nx-social-shade .nx-social-status'),
  async createParty(u) {
    await legacy.open(u, 'party');
    await u.page.locator('.nx-social-shade [data-act="create-party"]').click();
    await expect(u.page.locator('.nx-social-shade [data-act="leave-party"]')).toBeVisible();
  },
  async invite(u, friend) {
    await legacy.open(u, 'friends');
    await u.page.locator(`.nx-social-shade [data-invite="${friend.uid}"]`).click();
  },
  async acceptInvite(u, partyId) {
    await legacy.open(u, 'party');
    await u.page.locator(`.nx-social-shade [data-party-accept="${partyId}"]`).click();
  },
  async leave(u) {
    await legacy.open(u, 'party');
    await u.page.locator('.nx-social-shade [data-act="leave-party"]').click();
  },
};

export const partyOf = (rtdb, u) => rtdb.get(`social/userParty/${u.uid}`);
