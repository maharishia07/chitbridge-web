/* bank-r3-live.cjs — l16-bank-r3 · Harbour Plumbing's October statement to Difference 0.00 ON SCREEN as the owner, against a REAL api (a SIT box's throwaway api), then a reload that is still 0.00 with the twins paired.
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
  if (await p.locator('[data-testid="bank-currency"]').count()) await p.click('[data-testid="bank-currency-go"]');
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
  ok(/Statement\s*A\$18,280\.75/.test(bd) && /Books\s*A\$19,963\.00/.test(bd) && /Difference\s*A\$1,682\.25/.test(bd), 'before: the band reads statement 18,280.75, books 19,963.00, difference 1,682.25 (' + bd.slice(0, 160) + ')');
  ok(/Add 10 lines to your books/.test(bd), 'the primary carries the count: "Add 10 lines to your books"');
  await p.screenshot({ path: path.join(OUT, 'r3-01-before-1366.png') });
  await p.click('[data-testid="bank-sheet-open"]');
  await p.waitForSelector('[data-testid="bank-sheet-lines"] .bd-row', { timeout: 20000 });
  await p.waitForTimeout(800);
  const row = (needle) => p.locator('[data-testid="bank-sheet-lines"] .bd-row', { hasText: needle }).first();
  const pause = () => p.waitForTimeout(450);
  const show = async (needle) => console.log('   ' + needle + ' -> ' + flat(await row(needle).innerText()).slice(0, 200));
  /* the answers, each on its own line */
  await row('CREDIT INTEREST').locator('button[data-act=tick]').first().click();
  await pause();
  await row('TRANSFER TO SAVINGS').locator('[data-testid="bd-addown-name"]').fill('Savings account 4411');
  await row('TRANSFER TO SAVINGS').locator('[data-testid="bd-addown"]').click();
  await p.waitForTimeout(2500);
  const transfer = flat(await row('TRANSFER TO SAVINGS').innerText());
  ok(/Ready to add/.test(transfer) && /Savings account 4411/.test(transfer) && /Cr bank/.test(transfer), 'the transfer is Ready to add, Dr Savings account 4411 / Cr bank, after naming the account once (' + transfer.slice(-90) + ')');
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
  ok(/Difference\s*A\$0\.00/.test(bd) && /Unexplained\s*A\$0\.00/.test(bd), 'AFTER POSTING: Difference A$0.00, Unexplained A$0.00 on the page (' + bd.slice(0, 200) + ')');
  await p.screenshot({ path: path.join(OUT, 'r3-05-nil-1366.png') });
  const states = async (pg) => pg.$$eval('[data-testid="bank-list"] [data-status]', (els) => els.map((e) => e.getAttribute('data-status')));
  console.log('   states after posting: ' + JSON.stringify(await states(p)));
  /* the reload: a new page, the same owner, the same file */
  await ctx.close();
  const again = await L.open(b, base, token, { width: 1366, height: 768 });
  await load(again.page);
  bd = await band(again.page);
  ok(/Difference\s*A\$0\.00/.test(bd) && /Unexplained\s*A\$0\.00/.test(bd), 'AFTER RELOAD: still Difference A$0.00 (' + bd.slice(0, 200) + ')');
  console.log('   states after reload: ' + JSON.stringify(await states(again.page)));
  const text2 = flat(await again.page.textContent('[data-testid="bank-list"]'));
  ok(!/More than one entry fits/.test(text2) && !/Not on the statement/.test(text2), 'after the reload the two Bunnings lines are paired one to one: no "More than one entry fits", no entry "Not on the statement"');
  await again.page.screenshot({ path: path.join(OUT, 'r3-06-reload-1366.png') });
  await again.ctx.close();
  const phone = await L.open(b, base, token, { width: 390, height: 844 });
  await load(phone.page);
  await phone.page.screenshot({ path: path.join(OUT, 'r3-07-reload-390.png') });
  ok(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390x844: no sideways scroll');
  const fold = await phone.page.evaluate(() => { const first = document.querySelector('[data-testid="bank-list"] [data-row]'); return first ? Math.round(first.getBoundingClientRect().top) : -1; });
  ok(fold > 0 && fold <= Math.round(844 / 3) + 10, '390x844: the first line starts within a third of the screen (' + fold + ' px of 844)');
  console.log('THREW ' + JSON.stringify(p.__threw.concat(again.page.__threw).filter((x) => !/stream|ERR_FAILED/.test(x))));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e.stack); process.exit(1); });
