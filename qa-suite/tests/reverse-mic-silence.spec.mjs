// RE:VERSE microphone — fake mic fed with silence.
import { test, expect, waitForDb } from '../harness/fixtures.mjs';
import { FIX, fakeMic, open, startRoom, room, record, playTurn } from '../harness/reverse-helpers.mjs';

test.use(fakeMic(FIX.silence));

  test('R-03 a silent microphone is detected; nothing silent is sent to the other player', async ({ users, rtdb }) => {
    const A = await open(users, 'A', 'Pixel 7'), B = await open(users, 'B', 'Pixel 7');
    const code = await startRoom(rtdb, A, B);
    await record(A, '#record-name', 1500);
    await expect(A.page.locator('#toast')).toContainText(/ses algılanmadı/i);
    await expect(A.page.locator('#record-name')).toBeVisible();
    await expect(A.page.locator('#record-name')).toHaveText(/BAŞLAT/);
    expect(room(rtdb, code).reverseOriginal).toBeUndefined();
  });
