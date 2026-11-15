/* bank-r3-live.cjs — l16-bank-r3 + l16-bank-9 (the page remembers the statement · one line, one short answer · one status vocabulary · currency once · no empty brackets) · Harbour Plumbing's October statement to Difference 0.00 ON SCREEN as the owner, against a REAL api (a SIT box's throwaway api), then a reload that is still 0.00 with the twins paired.
 * Run on the box (r3-e2e.sh in C:/dev/shots/l16-bank-r3/box): web = this checkout's public/, api = $API, owner = harbour-plumbing-au. Shots: $OUT (1366x768 and 390x844).
 * Answers only: no typing beyond the new party's name and the new savings account's name (the two things the statement cannot know). */
'use strict';
const { chromium } = require('@playwright/test'), fs = require('fs'), path = require('path');
const L = require('./lib/live-harbour.cjs');
const OUT = process.env.OUT || 'e2e/shots';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const CSV = () => fs.readFileSync(fs.existsSync('/w/Harbour-Plumbing-Oct2026-bank-statement-description.csv') ? '/w/Harbour-Plumbing-Oct2026-bank-statement-description.csv' : path.join(__dirname, 'fixtures', 'harbour-oct-2026.csv'));
const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
async function load(p) {
  await p.setInputFiles('[data-testid="bank-file"]', { name: 'Harbour-Plumbing-Oct2026.csv', mimeType: 'text/csv', buffer: CSV() });
  await p.waitForSelector('[data-testid="bank-currency"], [data-testid="bank-list"].cbl [data-status]', { timeout: 20000 });
  if (await p.locator('[data-testid="bank-currency"]').count()) { console.log('   NOTE the currency was asked'); await p.click('[data-testid="bank-currency-go"]'); }
  await p.waitForSelector('[data-testid="bank-list"].cbl [data-status]', { timeout: 20000 });
  await p.waitForTimeout(1200);
}
const band = async (p) => flat(await p.textContent('[data-testid="bank-finish"]'));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { base } = await L.serve(), token = await L.signIn(process.env.HANDLE || 'harbour-plumbing-au');
  const b = await chromium.launch();
  const { ctx, page: p } = await L.open(b, base, token, { width: 1366, height: 768 });
  await load(p);
  let bd = await band(p);
  ok(/Statement\s*18,280\.75/.test(bd) && /Books\s*19,963\.00/.test(bd) && /Difference\s*1,682\.25/.test(bd) && !/A\$/.test(bd), 'ITEM 5: the band reads plain figures, statement 18,280.75, books 19,963.00, difference 1,682.25, no A$ (' + bd.slice(0, 160) + ')');
  ok(await p.locator('[data-testid="bank-currency-ask"]').count() === 0, 'ITEM 1: the account has its currency on record, so no currency question');
  const head = flat(await p.textContent('[data-testid="bank-line"]'));
  ok(/AUD/.test(head) && /Load another statement/.test(head), 'ITEM 5: the currency is said once, in the header line; ITEM 1: Load another statement is the secondary action (' + head.slice(0, 120) + ')');
  ok(!/A\$/.test(await p.textContent('[data-testid="bank-list"]')), 'ITEM 5: no A$ on any row');
  ok(/Add 10 lines to your books/.test(bd), 'the primary carries the count: "Add 10 lines to your books"');
  await p.screenshot({ path: path.join(OUT, 'r3-01-before-1366.png') });
  /* ITEM 1: a visit with no file: the page opens on the latest statement (this same page, reloaded: nothing chosen) */
  await p.reload();
  await p.waitForSelector('[data-testid="bank-list"].cbl [data-status]', { timeout: 20000 });
  await p.waitForTimeout(1200);
  ok(/Statement\s*18,280\.75/.test(await band(p)), 'ITEM 1: opened with no file: the latest statement is on screen, band unchanged (' + (await band(p)).slice(0, 100) + ')');
  ok(await p.locator('[data-testid="bank-currency-ask"]').count() === 0, 'ITEM 1: the restored statement asks no currency');
  await p.screenshot({ path: path.join(OUT, 'b9-01-opens-on-last-statement-1366.png') });
  /* ITEM 2 + 3: answer ONE line (Add missing on the transfer): the sheet shows that line, one short question, each list under its own button */
  const tr = p.locator('[data-testid^="bank-row-"]', { hasText: 'TRANSFER TO SAVINGS' }).first();
  await tr.locator('[data-caret]').click();
  await p.locator('[data-testid="bank-add"]').first().click();
  await p.waitForSelector('[data-testid="bank-sheet-lines"] .bd-row', { timeout: 20000 });
  await p.waitForTimeout(600);
  const shown = await p.locator('[data-testid="bank-sheet-lines"] .bd-row').count();
  ok(shown === 1, 'ITEM 2: the sheet shows the ONE line, not all of them (' + shown + ' rows)');
  const sheetText = flat(await p.locator('[data-testid="bank-sheet-lines"]').innerText());
  ok(!/say which account|from the list for/i.test(sheetText) && (sheetText.match(/What is this\?/g) || []).length === 1, 'ITEM 2: one short question, said once: "What is this?"');
  const stacked = await p.$$eval('.bd-choice', (els) => els.every((e) => { const b = e.querySelector('button'), l = e.querySelector('select'); return !l || (l.getBoundingClientRect().top >= b.getBoundingClientRect().bottom - 1 && Math.abs(l.getBoundingClientRect().left - b.getBoundingClientRect().left) < 4); }));
  ok(stacked, 'ITEM 2: each choice that has a list carries it right under its own button');
  const asks = await p.locator('[data-testid="bank-sheet-lines"] [data-act=kind]').count();
  console.log('   choices as buttons: ' + asks);
  ok(asks >= 2, 'ITEM 2: the choices are buttons (' + asks + ')');
  await p.screenshot({ path: path.join(OUT, 'b9-02-one-line-answer-1366.png') });
  await p.locator('[data-testid="bd-addown-name"]').fill('Savings account 4411');
  await p.locator('[data-testid="bd-addown"]').click();
  await p.waitForTimeout(2500);
  const one = flat(await p.locator('[data-testid="bank-sheet-lines"] .bd-row').first().innerText());
  ok(/Ready to add/.test(one) && /Savings account 4411/.test(one), 'the one line is Ready to add, Dr Savings account 4411 (' + one.slice(-90) + ')');
  const addOne = p.locator('#acc_sheet button', { hasText: /Add this line to your books/ }).first();
  ok(await addOne.count() === 1, 'the press reads "Add this line to your books"');
  await addOne.click();
  await p.waitForTimeout(800);
  const dlg = flat(await p.locator('[role=dialog], dialog[open]').last().innerText().catch(() => ''));
  console.log('   confirm: ' + dlg.slice(0, 260));
  ok(/Add 1 entry/.test(dlg) && /Currency: AUD/.test(dlg) && !/AUD \d/.test(dlg) && !/Money in: AUD|Money out: AUD/.test(dlg) && /Money out: 4,000\.00|Money out: \d/.test(dlg), 'ITEM 5: the confirm follows the page: plain figures, the currency said once, the one line only');
  await p.screenshot({ path: path.join(OUT, 'b9-03-confirm-1366.png') });
  await p.locator('[role=dialog] button, dialog[open] button', { hasText: /^(Yes|Add|Confirm)/ }).last().click();
  await p.waitForTimeout(6000);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1500);
  bd = await band(p);
  ok(/Add 9 lines to your books/.test(bd), 'one line added, nine left: the primary says "Add 9 lines to your books" (' + bd.slice(-60) + ')');
  await p.click('[data-testid="bank-sheet-open"]');
  await p.waitForSelector('[data-testid="bank-sheet-lines"] .bd-row', { timeout: 20000 });
  await p.waitForTimeout(800);
  const row = (needle) => p.locator('[data-testid="bank-sheet-lines"] .bd-row', { hasText: needle }).first();
  const pause = () => p.waitForTimeout(450);
  const show = async (needle) => console.log('   ' + needle + ' -> ' + flat(await row(needle).innerText()).slice(0, 200));
  /* the answers, each on its own line */
  await row('CREDIT INTEREST').locator('button[data-act=tick]').first().click();
  await pause();
  await row('ATO PAYMENT').locator('button[data-act=kind][data-kind=tax_payment]').click();
  await pause();
  await show('ATO PAYMENT');
  await row('CARD SETTLEMENT').locator('select[data-act=acct]').selectOption({ label: 'Sundry income' });
  await row('CARD SETTLEMENT').locator('select[data-act=taxkind]').selectOption({ label: 'Taxable supply' });
  await row('CARD SETTLEMENT').locator('button[data-act=useacct]').click();
  await pause();
  await show('CARD SETTLEMENT');
  await row('MONTHLY ACCOUNT FEE').locator('select[data-act=taxkind1]').selectOption({ label: 'Input-taxed supply' });
  await row('MONTHLY ACCOUNT FEE').locator('button[data-act=taxuse]').click();
  await pause();
  await show('MONTHLY ACCOUNT FEE');
  await row('PACIFIC RIM').locator('input[data-act=pname]').fill('Pacific Rim Traders');
  await row('PACIFIC RIM').locator('select[data-act=pkind]').selectOption('customer');
  await row('PACIFIC RIM').locator('button[data-act=resolve]').click();
  await pause();
  await show('PACIFIC RIM');
  for (let n = 0; n < 2; n++) {
    const r = p.locator('[data-testid="bank-sheet-lines"] .bd-row', { hasText: 'BUNNINGS' }).nth(n);
    await r.locator('select[data-act=acct]').selectOption('repairs');
    await r.locator('select[data-act=taxkind]').selectOption({ index: 1 });
    await r.locator('button[data-act=useacct]').click();
    await pause();
  }
  /* whatever still asks a plain yes (tax invoice held, a tick, cash basis): answered with the first yes the line offers */
  for (let round = 0; round < 12; round++) {
    const yes = p.locator('[data-testid="bank-sheet-lines"] button[data-act=inv][data-v=held], [data-testid="bank-sheet-lines"] button[data-act=gst][data-v=cash], [data-testid="bank-sheet-lines"] button[data-act=tick]');
    if (!(await yes.count())) break;
    await yes.first().click();
    await pause();
  }
  const rows = await p.$$eval('[data-testid="bank-sheet-lines"] .bd-row', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 170)));
  rows.forEach((r, i) => console.log('   row ' + i + ': ' + r));
  await p.screenshot({ path: path.join(OUT, 'r3-02-sheet-answered-1366.png') });
  const addBtn = p.locator('#acc_sheet button', { hasText: /Add \d+ to your books/ }).first();
  console.log('   add button: ' + flat(await addBtn.innerText().catch(() => '')));
  await addBtn.click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, 'r3-03-confirm-1366.png') });
  console.log('   confirm: ' + flat(await p.locator('[role=dialog], dialog[open]').last().innerText().catch(() => '')).slice(0, 300));
  await p.locator('[role=dialog] button, dialog[open] button', { hasText: /^(Yes|Add|Confirm)/ }).last().click();
  await p.waitForTimeout(9000);
  await p.screenshot({ path: path.join(OUT, 'r3-04-posted-1366.png') });
  console.log('   after: ' + flat(await p.locator('#acc_sheet').innerText().catch(() => '')).slice(0, 400));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1500);
  bd = await band(p);
  ok(/Difference\s*0\.00/.test(bd) && /Unexplained\s*0\.00/.test(bd) && !/A\$/.test(bd), 'AFTER POSTING: Difference 0.00, Unexplained 0.00, plain figures (' + bd.slice(0, 200) + ')');
  await p.screenshot({ path: path.join(OUT, 'b9-04-nil-1366.png') });
  const states = async (pg) => pg.$$eval('[data-testid="bank-list"] [data-status]', (els) => els.map((e) => e.getAttribute('data-status')));
  console.log('   states after posting: ' + JSON.stringify(await states(p)));
  /* RELOAD: the same page, nothing chosen: still nil */
  await p.reload();
  await p.waitForSelector('[data-testid="bank-list"].cbl [data-status]', { timeout: 20000 });
  await p.waitForTimeout(1500);
  bd = await band(p);
  ok(/Difference\s*0\.00/.test(bd) && /Unexplained\s*0\.00/.test(bd), 'AFTER RELOAD (no file chosen): still Difference 0.00 (' + bd.slice(0, 200) + ')');
  console.log('   states after reload: ' + JSON.stringify(await states(p)));
  const text2 = flat(await p.textContent('[data-testid="bank-list"]'));
  ok(!/More than one entry fits/.test(text2) && !(await states(p)).includes('missing'), 'after the reload the two Bunnings lines are paired one to one');
  await p.screenshot({ path: path.join(OUT, 'b9-05-reload-1366.png') });
  /* ITEM 3: one vocabulary */
  const chips = flat(await p.textContent('[data-testid="bank-group-books"]') + ' | ' + await p.textContent('[data-testid="bank-group-matched"]') + ' | ' + await p.textContent('[data-testid="bank-group-bank"]'));
  ok(/Not in your books/.test(chips) && /In your books/.test(chips) && /Not on the statement/.test(chips) && !/Missing in|Matched/.test(chips), 'ITEM 3: the chips use the band words (' + chips + ')');
  const chipWords = await p.$$eval('[data-testid="bank-list"] [data-status]', (els) => els.map((e) => e.textContent.trim()));
  ok(!chipWords.includes('Accepted') && chipWords.filter((w) => w === 'In your books').length === chipWords.length, 'ITEM 3: every settled row reads "In your books", none "Accepted" (' + JSON.stringify(chipWords) + ')');
  /* ITEM 4: no empty brackets anywhere on the page, nor in the sheet's already-in-the-books notes */
  const all = flat(await p.innerText('body'));
  const hole = /.{0,60}\(\s*\).{0,30}/.exec(all);
  if (hole) console.log('   EMPTY BRACKETS: ' + hole[0]);
  ok(!/\(\s*\)/.test(all), 'ITEM 4: no empty brackets on the page');
  await p.locator('[data-testid="bank-more"]').click();
  await p.locator('[data-testid="bank-tab-brs"]').click();
  await p.waitForTimeout(1200);
  const brs = flat(await p.innerText('body'));
  const hole2 = /.{0,60}\(\s*\).{0,30}/.exec(brs);
  if (hole2) console.log('   EMPTY BRACKETS (brs): ' + hole2[0]);
  console.log('   A$ in brs: ' + (/.{0,40}A\$.{0,20}/.exec(await p.textContent('[data-testid="bank-brs"]')) || [''])[0]);
  ok(!/\(\s*\)/.test(brs) && !/A\$/.test(await p.textContent('[data-testid="bank-brs"]')), 'ITEM 4+5: the reconciliation statement has no empty brackets and no A$');
  await p.screenshot({ path: path.join(OUT, 'b9-06-brs-1366.png') });
  await p.locator('[data-testid="bank-tab-lines"]').click();
  await p.waitForTimeout(800);
  /* KEYBOARD ONLY: Tab to Load another statement, Enter opens the form, Tab reaches the file box */
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  let reached = '';
  for (let n = 0; n < 60 && reached !== 'bank-change'; n++) { await p.keyboard.press('Tab'); reached = await p.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-testid')) || ''); }
  ok(reached === 'bank-change', 'KEYBOARD: Tab reaches "Load another statement" (' + reached + ')');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  ok(await p.locator('[data-testid="bank-change"]').getAttribute('aria-expanded') === 'true' && await p.locator('[data-testid="bank-file"]').isVisible(), 'KEYBOARD: Enter opens the form with the file box');
  let file = false;
  for (let n = 0; n < 8 && !file; n++) { await p.keyboard.press('Tab'); file = await p.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-testid')) === 'bank-file'); }
  ok(file, 'KEYBOARD: Tab reaches the file box');
  await p.screenshot({ path: path.join(OUT, 'b9-07-keyboard-another-statement-1366.png') });
  /* PHONE: the same page at 390x844, the statement is still there */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.reload();
  await p.waitForSelector('[data-testid="bank-list"].cbl [data-status]', { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'b9-08-phone-390.png') });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390x844: no sideways scroll');
  const fold = await p.evaluate(() => { const first = document.querySelector('[data-testid="bank-list"] [data-row]'); return first ? Math.round(first.getBoundingClientRect().top) : -1; });
  ok(fold > 0 && fold <= Math.round(844 / 3) + 10, '390x844: the first line starts within a third of the screen (' + fold + ' px of 844)');
  ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), '390x844: the page itself does not scroll (' + await p.evaluate(() => document.documentElement.scrollHeight) + ' of 844)');
  console.log('THREW ' + JSON.stringify(p.__threw.filter((x) => !/stream|ERR_FAILED/.test(x))));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e.stack); process.exit(1); });
