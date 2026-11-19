// Drives a real local ("TEK TELEFON") Futbol XOX game: reads the row/column
// conditions from the board, finds valid answers in the same (integrity-
// patched) data the game uses, and lets X complete the top row while O passes.
export async function startLocalXox(page) {
  await page.locator('button', { hasText: 'TEK TELEFON' }).first().click();
  await page.locator('.grid .cell').first().waitFor({ timeout: 20000 });
}

export async function readChallenge(page) {
  return page.evaluate(() => {
    const type = t => /KUL/.test(t) ? 'club' : /L[İI]G/.test(t) ? 'league' : 'nationality';
    const heads = [...document.querySelectorAll('.grid .head')].map(h => ({ type: type(h.querySelector('small')?.textContent || ''), value: h.textContent.replace(h.querySelector('small')?.textContent || '', '').replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3F4}\u{E0020}-\u{E007F}\u{FE0F}\u{200D}]/gu, '').trim() }));
    return { cols: heads.slice(0, 3), rows: heads.slice(3, 6) };
  });
}

export async function validAnswers(page, row, col, used = []) {
  return page.evaluate(async ({ row, col, used }) => {
    const players = await (await fetch('../data/master/xox-players.json', { cache: 'no-store' })).json();
    const m = (p, c) => c.type === 'nationality' ? p.nationality === c.value : c.type === 'club' ? (p.clubs || []).includes(c.value) : (p.leagues || []).includes(c.value);
    const names = new Map();
    for (const p of players) names.set(p.name, (names.get(p.name) || 0) + 1);
    return players.filter(p => m(p, row) && m(p, col) && !used.includes(p.id) && names.get(p.name) === 1)
      .sort((a, b) => (b.recognitionScore || 0) - (a.recognitionScore || 0)).slice(0, 5).map(p => ({ id: p.id, name: p.name }));
  }, { row, col, used });
}

export async function claim(page, cellIndex, player) {
  await page.locator('.grid .cell').nth(cellIndex).click();
  const input = page.locator('.modal .field').first();
  await input.waitFor();
  await input.fill(player.name);
  const result = page.locator('.modal .result').filter({ hasText: player.name }).first();
  await result.waitFor({ timeout: 8000 });
  await result.click();
  await page.locator('.modal').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
}

export async function pass(page) {
  await page.locator('button', { hasText: 'TURU PAS GEÇ' }).click();
  const confirm = page.locator('.modal button, .confirm button').filter({ hasText: /PAS GEÇ|EVET|ONAYLA/ }).first();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

/** X claims the top row (cells 0,1,2) with valid answers; O passes in between. */
export async function playTopRowWin(page, { onStep } = {}) {
  const ch = await readChallenge(page);
  const used = [];
  for (let c = 0; c < 3; c++) {
    const answers = await validAnswers(page, ch.rows[0], ch.cols[c], used);
    if (!answers.length) throw new Error(`no valid answer for ${JSON.stringify(ch.rows[0])} × ${JSON.stringify(ch.cols[c])}`);
    await claim(page, c, answers[0]);
    used.push(answers[0].id);
    await page.locator('.grid .cell').nth(c).and(page.locator('.claimed')).waitFor({ timeout: 8000 });
    if (onStep) await onStep(c);
    if (c < 2) await pass(page);
  }
  await page.locator('.winTitle').waitFor({ timeout: 8000 });
  return { challenge: ch, used };
}
