// Shared helpers for the RE:VERSE microphone specs — two independent users, Chromium fake microphone
// fed with a known WAV. Checks what actually reaches the other player (the
// reversed WAV written to the room), not just that buttons change.
//
// LIMITS (reported, not hidden): this is Chromium. "iPhone"/"Android" below
// emulate the user agent so the page takes its iOS / Android code paths; they
// do NOT reproduce WebKit or Android audio-session behaviour (mic contention,
// capture interruption). Those need real devices — see BLOCKED_TESTS.md.
import path from 'node:path';
import { expect, waitForDb, ROOT } from './fixtures.mjs';
import { audioFixtures, inspectWavDataUrl } from './audio-fixtures.mjs';

export const FIX = audioFixtures(path.join(ROOT, 'qa-suite/.artifacts/audio'));
export const PAGE = '/side-games/reverse-xi/index.html';
export const fakeMic = (file) => ({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${file}`] } });

// Deterministic speech recognition stub + microphone/AudioContext instrumentation.
export async function instrument(u) {
  await u.context.addInitScript(() => {
    window.__qa = { gum: 0, streams: [], order: [], srStarted: 0 };
    class SR { constructor() { this.lang = ''; } start() { window.__qa.srStarted++; window.__qa.order.push('speech'); } stop() { setTimeout(() => this.onend?.(), 0); } abort() {} }
    window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const orig = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => { window.__qa.gum++; window.__qa.order.push('getUserMedia'); const s = await orig(c); window.__qa.streams.push(s); return s; };
    }
    const AC = window.AudioContext;
    if (AC) { const r = AC.prototype.resume; AC.prototype.resume = function () { window.__qa.order.push('resume'); return r.call(this); }; }
    window.__qaLiveTracks = () => window.__qa.streams.flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').length;
  });
}
export async function open(users, label, device, before) {
  const u = await users(label, { device, profile: false });
  if (before) await u.context.addInitScript(before);
  await instrument(u);
  await u.page.goto(PAGE);
  await u.page.waitForFunction(() => window.__NX_MOCK_NET__?.connected, null, { timeout: 15000 });
  return u;
}
export async function startRoom(rtdb, A, B) {
  await A.page.locator('#create-room').click();
  await expect(A.page.locator('#game')).toBeVisible();
  await expect(A.page.locator('#room-label')).not.toHaveText('------');
  const code = (await A.page.locator('#room-label').textContent()).trim();
  await B.page.locator('#room-code').fill(code);
  await B.page.locator('#join-room').click();
  await expect(B.page.locator('#game')).toBeVisible();
  await waitForDb(rtdb, `reverseXI/rooms/${code}/players/B`, v => !!v);
  return code;
}
export const room = (rtdb, code) => rtdb.get(`reverseXI/rooms/${code}`) || {};
export async function record(u, buttonId, ms) {
  await u.page.locator(buttonId).click();
  await expect(u.page.locator(buttonId)).toHaveText(/DURDUR/);
  await u.page.waitForTimeout(ms);
  await u.page.locator(buttonId).click();
}
export function expectAudible(info, label) {
  expect(info.ok, `${label}: ${info.reason || ''} ${info.head || ''}`).toBe(true);
  expect(info.peak, `${label} must not be silent`).toBeGreaterThan(0.05);
  expect(info.falls, `${label} must be reversed (rising chirp → falling)`).toBeGreaterThan(info.rises);
}

export async function playTurn(rtdb, code, speaker, imitator, answer) {
  await expect(speaker.page.locator('#speaker-panel')).toBeVisible();
  await expect(imitator.page.locator('#waiting-panel')).toBeVisible();
  await record(speaker, '#record-name', 2200);
  await expect(speaker.page.locator('#heard-result')).toBeVisible();
  await speaker.page.locator('#manual-name').fill(answer);
  await speaker.page.locator('#confirm-name').click();
  await waitForDb(rtdb, `reverseXI/rooms/${code}/phase`, v => v === 'imitate', { timeout: 15000 });
  const original = inspectWavDataUrl(room(rtdb, code).reverseOriginal);
  expectAudible(original, 'reversed original');

  await expect(imitator.page.locator('#listen-panel')).toBeVisible();
  await expect(imitator.page.locator('#reverse-audio')).toHaveAttribute('src', /^data:audio\/wav;base64,/);
  await record(imitator, '#record-imitation', 1800);
  await waitForDb(rtdb, `reverseXI/rooms/${code}/phase`, v => v === 'guess', { timeout: 15000 });
  const imitation = inspectWavDataUrl(room(rtdb, code).reverseImitation);
  expectAudible(imitation, 'reversed imitation');

  await expect(imitator.page.locator('#guess-panel')).toBeVisible();
  await expect(imitator.page.locator('#final-audio')).toHaveAttribute('src', /^data:audio\/wav;base64,/);
  await imitator.page.locator('#guess-input').fill(answer);
  await imitator.page.locator('#send-guess').click();
  await waitForDb(rtdb, `reverseXI/rooms/${code}/phase`, v => v === 'result', { timeout: 15000 });
  expect(room(rtdb, code).lastResult?.correct).toBe(true);
  for (const u of [speaker, imitator]) await expect(u.page.locator('#result-title')).toHaveText('DOĞRU TAHMİN!');
  return { original, imitation };
}

