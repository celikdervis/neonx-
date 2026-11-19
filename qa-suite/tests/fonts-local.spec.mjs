// Side games use self-hosted fonts (assets/fonts/neon-fonts.css): the production typefaces load from the
// site itself, Turkish letters come from the same family, and no request goes to Google Fonts.
import { test, expect } from '../harness/fixtures.mjs';
import { SIDE_PAGES } from '../harness/social-helpers.mjs';

const PAGES = { ...SIDE_PAGES, reverse: '/side-games/reverse-xi/index.html', en11: '/side-games/en11/index.html', howto: '/side-games/how-to-play.html' };
// Families each page's own CSS asks for (checked with the text the pages actually render, incl. Turkish letters).
const EXPECT = {
  xox: ['Orbitron', 'Barlow Condensed'], twin: ['Barlow Condensed', 'Barlow'], wordle: ['Orbitron', 'Rajdhani'],
  arcade: ['Orbitron', 'Rajdhani'], imposter: ['Barlow Condensed'], reverse: ['Orbitron', 'Rajdhani'],
  en11: ['Orbitron', 'Rajdhani'], howto: ['Orbitron', 'Rajdhani'],
};

for (const [name, url] of Object.entries(PAGES)) test(`F-01 ${name}: fonts are self-hosted and load`, async ({ users }) => {
  const A = await users('A', { device: 'iPhone 13 Mini' });
  const google = [], local = [];
  A.context.on('request', r => { const u = r.url(); if (/fonts\.(googleapis|gstatic)\.com/.test(u)) google.push(u); else if (u.includes('/assets/fonts/')) local.push(u.replace(/^.*\/assets\/fonts\//, '')); });
  await A.page.goto(url);
  await A.page.waitForTimeout(2500);
  const r = await A.page.evaluate(async (families) => {
    await document.fonts.ready;
    const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family.replace(/"/g, '')} ${f.weight} ${f.style}`);
    const used = families.map(f => ({ f, ok: loaded.some(x => x.startsWith(f + ' ')) }));
    // Turkish letters outside Latin-1 (ğ ş İ) come from the latin-ext file of the same family, where the family has one.
    const tr = await document.fonts.load('600 20px Rajdhani', 'ğşİ').then(list => list.length).catch(() => -1);
    return { loaded: [...new Set(loaded)].sort(), used, tr };
  }, EXPECT[name]);
  console.log('F-01', name, JSON.stringify({ google: google.length, local: local.length, used: r.used, tr: r.tr }));
  expect(google, 'no request to Google Fonts').toEqual([]);
  expect(local.some(x => x.startsWith('neon-fonts.css')), 'self-hosted sheet requested').toBe(true);
  for (const u of r.used) expect(u.ok, `${u.f} loaded`).toBe(true);
  expect(r.tr, 'Turkish latin-ext face for Rajdhani').toBeGreaterThan(0);
  expect(A.errors).toEqual([]);
});
