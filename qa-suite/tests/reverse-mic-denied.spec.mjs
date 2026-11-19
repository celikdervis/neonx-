// RE:VERSE microphone — permission denied / unsupported browser.
// Headless Chromium cannot produce a real user denial (it answers every case
// with NotSupportedError), so the denial is SIMULATED by rejecting
// getUserMedia with the exact DOMException real Chrome/Safari raise.
import { test, expect } from '../harness/fixtures.mjs';
import { open, startRoom } from '../harness/reverse-helpers.mjs';

const deny = () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); };
const noMediaDevices = () => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); };

for (const [name, device] of [['iPhone UA', 'iPhone 14'], ['Android UA', 'Pixel 7']]) {
  test(`R-02 ${name}: permission denied (simulated) shows guidance and the button is not stuck`, async ({ users, rtdb }) => {
    const A = await open(users, 'A', device, deny), B = await open(users, 'B', device);
    await startRoom(rtdb, A, B);
    await A.page.locator('#record-name').click();
    await expect(A.page.locator('#toast')).toContainText(/izni verilmedi/i);
    if (device === 'iPhone 14') await expect(A.page.locator('#toast')).toContainText('Web Sitesi Ayarları');
    await expect(A.page.locator('#record-name')).toHaveText(/BAŞLAT/);
    await expect(A.page.locator('#record-name')).toBeEnabled();
    await A.page.locator('#record-name').click();
    await expect(A.page.locator('#toast')).toContainText(/izni verilmedi/i);
  });
}

test('R-02b in-app browser without microphone API: tells the player to open Safari/Chrome', async ({ users, rtdb }) => {
  const A = await open(users, 'A', 'iPhone 14', noMediaDevices), B = await open(users, 'B', 'iPhone 14');
  await startRoom(rtdb, A, B);
  await A.page.locator('#record-name').click();
  await expect(A.page.locator('#toast')).toContainText(/Safari veya Chrome/);
  await expect(A.page.locator('#record-name')).toHaveText(/BAŞLAT/);
});
