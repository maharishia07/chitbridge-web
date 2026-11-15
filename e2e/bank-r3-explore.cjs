'use strict';
const { chromium } = require('@playwright/test'), fs = require('fs'), path = require('path');
const L = require('./lib/live-harbour.cjs');
const OUT = process.env.OUT || 'e2e/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { base } = await L.serve(); const token = await L.signIn(process.env.HANDLE || 'harbour-plumbing-au');
  const b = await chromium.launch(); const { page: p } = await L.open(b, base, token, { width: 1366, height: 768 });
  const csv = fs.readFileSync('/w/Harbour-Plumbing-Oct2026-bank-statement-description.csv');
  await p.setInputFiles('[data-testid="bank-file"]', { name: 'Harbour-Oct2026.csv', mimeType: 'text/csv', buffer: csv });
  await p.waitForSelector('[data-testid="bank-currency"], [data-testid="bank-list"].cbl [data-status]', { timeout: 15000 });
  if (await p.locator('[data-testid="bank-currency"]').count()) await p.click('[data-testid="bank-currency-go"]');
  await p.waitForSelector('[data-testid="bank-list"].cbl [data-status]', { timeout: 15000 }); await p.waitForTimeout(800);
  await p.click('[data-testid="bank-sheet-open"]'); await p.waitForSelector('[data-testid="bank-sheet-lines"] .bd-row', { timeout: 15000 }); await p.waitForTimeout(600);
  const row = (n) => p.locator('[data-testid="bank-sheet-lines"] .bd-row').nth(n);
  const say = async (n, tag) => console.log(tag, n, ((await row(n).innerText()).replace(/\n+/g, ' | ')).slice(0, 260));
  const wait = () => p.waitForTimeout(500);
  // 11 interest
  await row(11).locator('button[data-act=tick]').first().click(); await wait(); await say(11, 'interest');
  // 6 transfer: add the savings account inline
  await row(6).locator('[data-testid="bd-addown-name"]').fill('Savings account 4411'); await row(6).locator('[data-testid="bd-addown"]').click(); await p.waitForTimeout(2500); await say(6, 'transfer');
  console.log('LEGS', JSON.stringify(await p.evaluate(() => { const i = BKSH.ctl.view().items.filter((x) => /SAVINGS/.test(x.line.narration))[0]; return { event: i.event, keys: Object.keys(i), proposal: i.proposal && i.proposal.entry }; })));
  // 7 ATO
  console.log('ATO buttons', JSON.stringify(await row(7).locator('button').allInnerTexts()));
  console.log('card buttons', JSON.stringify(await row(1).locator('button').allInnerTexts()));
  console.log('fee', JSON.stringify(await row(2).locator('button, select').evaluateAll((e) => e.map((x) => x.tagName + ':' + x.getAttribute('data-act') + ':' + (x.innerText || '').replace(/\n/g, '/').slice(0, 80)))));
  console.log('bunn', JSON.stringify(await row(9).locator('select[data-act=acct]').first().evaluate((e) => Array.from(e.options).map((o) => o.value + '=' + o.text).slice(0, 40))));
  await p.screenshot({ path: path.join(OUT, 'x-3-sheet.png') });
  console.log('THREW', JSON.stringify(p.__threw.filter((x) => !/stream|ERR_FAILED/.test(x))));
  await b.close(); process.exit(0);
})().catch((e) => { console.error('ERR', e.stack); process.exit(1); });
