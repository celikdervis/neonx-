// RE:VERSE microphone — fake mic fed with a rising chirp. See harness/reverse-helpers.mjs for limits.
import { test, expect, waitForDb } from '../harness/fixtures.mjs';
import { FIX, fakeMic, open, startRoom, room, record, playTurn } from '../harness/reverse-helpers.mjs';

test.use(fakeMic(FIX.chirp));


  for (const [name, device] of [['desktop', undefined], ['iPhone UA', 'iPhone 14'], ['Android UA', 'Pixel 7']]) {
    test(`R-01 ${name}: two full turns; both reversed recordings reach the other player`, async ({ users, rtdb }, testInfo) => {
      const A = await open(users, 'A', device), B = await open(users, 'B', device);
      const code = await startRoom(rtdb, A, B);
      const t1 = await playTurn(rtdb, code, A, B, 'Arda Güler');
      await expect(A.page.locator('#next-turn')).toBeVisible();
      await expect(B.page.locator('#next-turn')).toBeHidden();
      await A.page.locator('#next-turn').click();
      await waitForDb(rtdb, `reverseXI/rooms/${code}/currentSpeaker`, v => v === 'B');
      const t2 = await playTurn(rtdb, code, B, A, 'Kenan Yıldız');
      testInfo.annotations.push({ type: 'audio', description: JSON.stringify({ t1, t2 }) });
      for (const x of [t1.original, t1.imitation, t2.original, t2.imitation]) expect(x.rate, 'upload sample rate').toBeLessThanOrEqual(22050);
    });
  }

  test('R-04 going to the background during a recording cancels it and releases the microphone', async ({ users, rtdb }) => {
    const A = await open(users, 'A', 'iPhone 14'), B = await open(users, 'B', 'iPhone 14');
    const code = await startRoom(rtdb, A, B);
    await A.page.locator('#record-name').click();
    await expect(A.page.locator('#record-name')).toHaveText(/DURDUR/);
    await A.page.waitForTimeout(800);
    await A.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => A.page.evaluate(() => window.__qaLiveTracks())).toBe(0);
    await A.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(A.page.locator('#record-name')).toHaveText(/BAŞLAT/);
    await expect(A.page.locator('#heard-result')).toBeHidden();
    // and the next recording works
    await playTurn(rtdb, code, A, B, 'Arda Güler');
  });

  test('R-05 microphone track ends between turns (capture interrupted) — next turn still records', async ({ users, rtdb }) => {
    const A = await open(users, 'A', 'iPhone 14'), B = await open(users, 'B', 'iPhone 14');
    const code = await startRoom(rtdb, A, B);
    await playTurn(rtdb, code, A, B, 'Arda Güler');
    for (const u of [A, B]) await u.page.evaluate(() => window.__qa.streams.forEach(s => s.getTracks().forEach(t => t.stop())));
    await A.page.locator('#next-turn').click();
    await waitForDb(rtdb, `reverseXI/rooms/${code}/currentSpeaker`, v => v === 'B');
    await playTurn(rtdb, code, B, A, 'Kenan Yıldız');
  });

  test('R-06 iPhone UA: the AudioContext is resumed inside the tap, before the permission request', async ({ users, rtdb }) => {
    const A = await open(users, 'A', 'iPhone 14'), B = await open(users, 'B', 'iPhone 14');
    await startRoom(rtdb, A, B);
    await A.page.locator('#record-name').click();
    await expect(A.page.locator('#record-name')).toHaveText(/DURDUR/);
    const order = await A.page.evaluate(() => window.__qa.order);
    expect(order.indexOf('resume'), JSON.stringify(order)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('resume'), JSON.stringify(order)).toBeLessThan(order.indexOf('getUserMedia'));
  });

  for (const [name, device, expected] of [['desktop', undefined, 1], ['iPhone UA', 'iPhone 14', 0], ['Android UA', 'Pixel 7', 0]]) {
    test(`R-07 ${name}: speech recognition ${expected ? 'runs' : 'does not run'} while the microphone records`, async ({ users, rtdb }) => {
      const A = await open(users, 'A', device), B = await open(users, 'B', device);
      await startRoom(rtdb, A, B);
      await record(A, '#record-name', 1200);
      await expect(A.page.locator('#heard-result')).toBeVisible();
      expect(await A.page.evaluate(() => window.__qa.srStarted)).toBe(expected);
      await expect(A.page.locator('#manual-name')).toBeVisible();
    });
  }

  test('R-08 a recording that is never stopped ends by itself at the time limit', async ({ users, rtdb }) => {
    test.setTimeout(60000);
    const A = await open(users, 'A', 'iPhone 14'), B = await open(users, 'B', 'iPhone 14');
    await startRoom(rtdb, A, B);
    await A.page.locator('#record-name').click();
    await expect(A.page.locator('#heard-result')).toBeVisible({ timeout: 20000 });
    await expect(A.page.locator('#record-name')).toBeHidden();
  });

  test('R-09 a double tap on the record button starts exactly one recording', async ({ users, rtdb }) => {
    const A = await open(users, 'A', 'Pixel 7'), B = await open(users, 'B', 'Pixel 7');
    await startRoom(rtdb, A, B);
    await A.page.locator('#record-name').evaluate(b => { b.click(); b.click(); });
    await A.page.waitForTimeout(1200);
    await expect(A.page.locator('#record-name')).toHaveText(/DURDUR/);
    await A.page.locator('#record-name').click();
    await expect(A.page.locator('#heard-result')).toBeVisible();
    expect(await A.page.evaluate(() => window.__qa.gum)).toBe(1);
  });

test('R-10 the step header tells both players whose move it is, in every phase', async ({ users, rtdb }) => {
  const A = await open(users, 'A'), B = await open(users, 'B');
  const code = await startRoom(rtdb, A, B);
  for (const u of [A, B]) await expect(u.page.locator('#step-title')).toHaveText('A oyuncusu futbolcu ismini söylüyor');
  await record(A, '#record-name', 1500);
  await A.page.locator('#manual-name').fill('Arda Güler');
  await A.page.locator('#confirm-name').click();
  await waitForDb(rtdb, `reverseXI/rooms/${code}/phase`, v => v === 'imitate');
  for (const u of [A, B]) await expect(u.page.locator('#step-title')).toHaveText('B oyuncusu ters sesi taklit ediyor');
  for (const u of [A, B]) await expect(u.page.locator('#step-desc')).not.toContainText('paylaş');
});

test('R-11 live level meter while recording; ?micdebug=1 shows permission, context, track and last take', async ({ users, rtdb }) => {
  const A = await users('A', { device: 'iPhone 14', profile: false });
  await A.context.addInitScript(() => { window.SpeechRecognition = window.webkitSpeechRecognition = undefined; });
  await A.page.goto('/side-games/reverse-xi/index.html?micdebug=1');
  const B = await open(users, 'B', 'iPhone 14');
  await A.page.waitForFunction(() => window.__NX_MOCK_NET__?.connected);
  await startRoom(rtdb, A, B);
  await A.page.locator('#record-name').click();
  await expect.poll(() => A.page.locator('#record-name').evaluate(b => parseFloat(getComputedStyle(b).getPropertyValue('--nx-level') || '0')), { timeout: 5000 }).toBeGreaterThan(0.05);
  await A.page.waitForTimeout(800);
  await A.page.locator('#record-name').click();
  await expect(A.page.locator('#heard-result')).toBeVisible();
  const panel = await A.page.locator('#nx-mic-debug').textContent();
  for (const key of ['platform: iOS', 'audioContext: running', 'track: live', 'lastTake: name']) expect(panel).toContain(key);
  expect(await A.page.locator('#record-name').evaluate(b => getComputedStyle(b).getPropertyValue('--nx-level').trim())).toBe('0.000');
});

test('R-12 party launch: host and guest join the same room automatically (nxAuto)', async ({ users, rtdb }) => {
  const q = (role, name) => `/side-games/reverse-xi/index.html?nxAuto=1&nxRole=${role}&nxCode=QA7RVS&nxPartySize=2&nxName=${name}`;
  const A = await users('A', { profile: false }), B = await users('B', { profile: false });
  await A.page.goto(q('host', 'Lider'));
  await waitForDb(rtdb, 'reverseXI/rooms/QA7RVS/players/A', v => v?.name === 'Lider');
  await B.page.goto(q('guest', 'Uye'));
  await waitForDb(rtdb, 'reverseXI/rooms/QA7RVS/players/B', v => v?.name === 'Uye');
  for (const u of [A, B]) { await expect(u.page.locator('#game')).toBeVisible(); await expect(u.page.locator('#room-label')).toHaveText('QA7RVS'); }
  await expect(A.page.locator('#speaker-panel')).toBeVisible();
  await expect(B.page.locator('#waiting-panel')).toBeVisible();
  await expect(B.page.locator('#name-a')).toHaveText('Lider');
});
