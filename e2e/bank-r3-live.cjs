/* bank-r3-live.cjs — l16-bank-r3 + l16-bank-9 (the page remembers the statement · one line, one short answer · one status vocabulary · currency once · no empty brackets) · Harbour Plumbing's October statement to Difference 0.00 ON SCREEN as the owner, against a REAL api (a SIT box's throwaway api), then a reload that is still 0.00 with the twins paired.
 * Run on the box (r3-e2e.sh in C:/dev/shots/l16-bank-r3/box): web = this checkout's public/, api = $API, owner = harbour-plumbing-au. Shots: $OUT (1366x768 and 390x844).
 * Answers only: no typing beyond the new party's name and the new savings account's name (the two things the statement cannot know). */
'use strict';
const { chromium } = require('@playwright/test'), fs = require('fs'), path = require('path');
const L = require('./lib/live-harbour.cjs');
const OUT = process.env.OUT || 'e2e/shots';
let pass = 0, fail = 0;
const PRESS_TARGET = Number(process.env.PRESS_TARGET || 12);
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
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message.slice(0, 300)));
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
  ok(await p.locator('[data-testid="bd-looks-transfer"]').count() === 1 && !/New party|New supplier|New customer|Savings.*Use this party/i.test(sheetText), 'l16-bank-rules: the Savings line leads with "Looks like: Moved between my own accounts" and proposes no new party (' + sheetText.slice(0, 160) + ')');
  const stacked = await p.$$eval('.bd-choice', (els) => els.every((e) => { const b = e.querySelector('button'), l = e.querySelector('select'); return !l || (l.getBoundingClientRect().top >= b.getBoundingClientRect().bottom - 1 && Math.abs(l.getBoundingClientRect().left - b.getBoundingClientRect().left) < 4); }));
  ok(stacked, 'ITEM 2: each choice that has a list carries it right under its own button');
  ok(await p.locator('[data-testid="bank-sheet-lines"] input[data-act=pname]').count() === 0 && await p.locator('[data-testid="bank-sheet-lines"] select[data-act=acct]').count() === 0, 'ITEM 2: the New party and Or an account boxes are not under the question from the start');
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
  /* a line that asks "What is this?" shows the party and account boxes only after "Someone or something else" */
  const openMore = async (needle) => { const more = p.locator('[data-testid="bank-sheet-lines"] .bd-row', { hasText: needle }).first().locator('button[data-act=more]'); if (await more.count()) { await more.click(); await p.waitForTimeout(300); } };
  const row = (needle) => p.locator('[data-testid="bank-sheet-lines"] .bd-row', { hasText: needle }).first();
  const pause = () => p.waitForTimeout(450);
  const show = async (needle) => console.log('   ' + needle + ' -> ' + flat(await row(needle).innerText()).slice(0, 200));
  /* the answers: each line that needs one opens by itself, one at a time; every press and choice is counted */
  let presses = 0;
  const lines = '[data-testid="bank-sheet-lines"]';
  const press = async (loc) => { presses++; console.log('   press ' + presses + ': ' + flat(await loc.first().innerText().catch(() => '?')).slice(0, 50)); await loc.click(); await pause(); };
  const choose = async (loc, what) => { presses++; console.log('   press ' + presses + ': choose ' + JSON.stringify(what)); await loc.selectOption(what); await pause(); };
  const heightOf = (sel) => p.evaluate((q) => { const e = document.querySelector(q); return e ? e.scrollHeight : -1; }, sel);
  const sheetHeight = await heightOf('#acc_sheet');
  const pageScrolls = await p.evaluate(() => document.documentElement.scrollHeight > innerHeight + 2);
  console.log('   sheet content height at 1366x768: ' + await heightOf('.bks-lines') + ' px, dialog ' + sheetHeight + ', page scrolls: ' + pageScrolls);
  ok(!pageScrolls, 'ITEM 1: the 1366 page does not scroll with the sheet open');
  ok(sheetHeight <= 768, 'ITEM 1: the whole sheet fits the 768 px screen (' + sheetHeight + ' px); its list scrolls inside, ' + await heightOf('.bks-lines') + ' px of content for ' + await p.locator(lines + ' .bd-row').count() + ' rows shown');
  /* the same sheet on the phone */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(600);
  const phoneDialog = await heightOf('#acc_sheet'), phoneScrolls = await p.evaluate(() => document.documentElement.scrollHeight > innerHeight + 2 || document.documentElement.scrollWidth > innerWidth);
  console.log('   sheet at 390x844: dialog ' + phoneDialog + ' px, lines content ' + await heightOf('.bks-lines') + ' px, page scrolls: ' + phoneScrolls);
  await p.screenshot({ path: path.join(OUT, 'b9-09-sheet-390.png') });
  ok(phoneDialog <= 844 && !phoneScrolls, 'ITEM 1: at 390x844 the sheet fits the screen and the page does not scroll (' + phoneDialog + ' px)');
  await p.setViewportSize({ width: 1366, height: 768 });
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, 'b9-09-sheet-1366.png') });
  const strip = flat(await p.textContent('[data-testid="bank-sheet-strip"]'));
  console.log('   strip: ' + strip);
  ok(/9 lines to add/.test(strip) && /ready/.test(strip) && /need an answer/.test(strip), 'ITEM 4: the sheet says what each number is (' + strip.slice(0, 90) + ')');
  const atoWords = flat(await row('ATO PAYMENT').innerText());
  console.log('   ATO row before any answer: ' + atoWords.slice(0, 260));
  ok(!/New party|New supplier|New customer/i.test(atoWords) && await row('ATO PAYMENT').locator('input[data-act=pname]').count() === 0, 'l16-bank-rules: the ATO line offers no new supplier (its entry is checked below: Dr GST collected, the tax account) (' + atoWords.slice(0, 170) + ')');
  for (let round = 0; round < 24; round++) {
    const basis = p.locator(lines + ' button[data-act=gst][data-v=cash]');
    if (await basis.count()) {
      const inView = await p.evaluate(() => { const e = document.querySelector('.bks-lines .bd-confirm'), h = document.querySelector('.bks-lines'); if (!e) return false; const r = e.getBoundingClientRect(), q = h.getBoundingClientRect(); return r.top >= q.top - 1 && r.bottom <= q.bottom + 1; });
      ok(inView, 'ITEM 1: the GST basis question is in view at the top of the sheet when it is asked');
      await press(basis.first());
      continue;
    }
    const open = p.locator(lines + ' .bd-row.bd-is-open').first();
    if (!(await open.count())) break;
    const text = flat(await open.innerText());
    console.log('   OPEN: ' + text.slice(0, 230));
    const more = open.locator('button[data-act=more]');
    if (/ATO PAYMENT/.test(text)) {
      await press(open.locator('button[data-act=tick]').first());
    } else if (/CARD SETTLEMENT/.test(text)) {
      ok(!/New party|New supplier|New customer/i.test(text) && await open.locator('input[data-act=pname]').count() === 0 && /card/i.test(text), 'l16-bank-rules: the card settlement line is proposed into the card account, no new customer (' + text.slice(0, 170) + ')');
      await press(open.locator('button[data-act=tick]').first());
    } else if (/MONTHLY ACCOUNT FEE/.test(text)) await choose(open.locator('select[data-act=taxkind1]'), { label: 'Input-taxed supply' });
    else if (/PACIFIC RIM/.test(text)) { if (await more.count()) await press(more); await open.locator('input[data-act=pname]').fill('Pacific Rim Traders'); await choose(open.locator('select[data-act=pkind]'), 'customer'); await press(open.locator('button[data-act=resolve]')); }
    else if (/BUNNINGS/.test(text) && ((await more.count()) || (await open.locator('select[data-act=acct]').count()))) { if (await more.count()) await press(more); await choose(open.locator('select[data-act=acct]'), 'repairs'); await choose(open.locator('select[data-act=taxkind]'), { index: 1 }); }
    else if (await open.locator('button[data-act=tick]').count()) await press(open.locator('button[data-act=tick]').first());
    else if (await open.locator('button[data-act=inv][data-v=held]').count()) await press(open.locator('button[data-act=inv][data-v=held]'));
    else { console.log('   UNHANDLED open row: ' + text.slice(0, 160)); break; }
    for (let held = 0; held < 3; held++) {
      const again = p.locator(lines + ' .bd-row.bd-is-open button[data-act=inv][data-v=held], ' + lines + ' .bd-row.bd-is-open button[data-act=tick]').first();
      if (await again.count()) await press(again); else break;
    }
  }
  console.log('PRESSES for the rest of the statement: ' + presses);
  ok(presses <= PRESS_TARGET, 'ITEM 1/2: the nine lines answered in ' + presses + ' presses (target ' + PRESS_TARGET + ')');
  await p.locator(lines + ' button[data-act=group][data-g=ready]').first().click().catch(() => {});
  await p.waitForTimeout(300);
  await row('ATO PAYMENT').locator('button[data-act=open]').click();
  await p.waitForTimeout(300);
  const entryWords = flat(await row('ATO PAYMENT').innerText());
  console.log('   entry words: ' + entryWords);
  ok(/Dr GST collected/.test(entryWords) && !/New party|New supplier/i.test(entryWords) && !/gst collected|Dr bank |Cr card/.test(entryWords), 'ITEM 3: the entry prints the chart account names (' + entryWords.slice(0, 160) + ')');
  const rows = await p.$$eval('[data-testid="bank-sheet-lines"] .bd-row', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 170)));
  rows.forEach((r, i) => console.log('   row ' + i + ': ' + r));
  await p.screenshot({ path: path.join(OUT, 'r3-02-sheet-answered-1366.png') });
  const addBtn = p.locator('#acc_sheet button', { hasText: /Add these \d+ ready lines/ }).first();
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
