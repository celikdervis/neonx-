// PeerJS is served from vendor/peerjs instead of unpkg.com. Only EN11 really loads it: Career Twin defines
// window.Peer with its Firebase shim (firebase-peer-shim-v1.js) and Imposter's online-base44-imposter.js
// replaces ensurePeerJS with a no-op, so their (now local) loader lines are fallbacks.
// The PeerJS signalling server itself stays remote and is unreachable here, so room creation is
// expected to fail afterwards: only the script load is under test (real P2P play stays BLOCKED).
import { test, expect } from '../harness/fixtures.mjs';

const CASES = {
  twin: { url: '/side-games/career-twin/index.html?nxAuto=1&nxRole=host&nxCode=4321&nxName=QA', vendor: [], peer: true, trigger: async () => {} },
  en11: { url: '/side-games/en11/index.html', vendor: [200], peer: true, trigger: async (page) => { await page.waitForSelector('#hostStart'); await page.evaluate(() => document.getElementById('hostStart').click()); } },
  imposter: { url: '/side-games/futbol-imposter.html', vendor: [], peer: false, trigger: async (page) => { await page.waitForFunction(() => typeof window.ensurePeerJS === 'function', null, { timeout: 15000 }); await page.evaluate(() => window.ensurePeerJS()?.catch?.(() => {})); } },
};

for (const [name, c] of Object.entries(CASES)) test(`PJ-01 ${name}: no PeerJS request to unpkg; EN11 loads it from the site`, async ({ users }) => {
  const A = await users('A');
  const cdn = [], local = [];
  A.context.on('request', r => { const u = r.url(); if (u.includes('unpkg.com')) cdn.push(u); });
  A.context.on('response', r => { if (r.url().includes('/vendor/peerjs/')) local.push(r.status()); });
  await A.page.goto(c.url);
  await A.page.waitForTimeout(1500);
  await c.trigger(A.page);
  if (c.peer) await A.page.waitForFunction(() => typeof window.Peer === 'function', null, { timeout: 10000 });
  else await A.page.waitForTimeout(2000);
  console.log('PJ-01', name, JSON.stringify({ cdn, local, peer: await A.page.evaluate(() => typeof window.Peer) }));
  expect(cdn, 'no request to unpkg.com').toEqual([]);
  expect(local, 'vendor/peerjs responses').toEqual(c.vendor);
});
