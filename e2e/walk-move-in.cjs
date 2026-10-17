#!/usr/bin/env node
/**
 * e2e/walk-move-in.cjs - MOVE IN FROM XERO / QUICKBOOKS, WALKED (IM1, 2026-10-12): CB Accounts › Setup › Move in.
 * Black box: the real CB Accounts page and the real Move in screen (public/app/cap-move-in.js); the API is a stand-in answering inside the page,
 * every /api/books answer held to the API contract (e2e/fixtures/web-api.contract.json) through C.json. The files are the api's own fixtures
 * (e2e/fixtures/move-in — a Xero chart of accounts; an unbalanced Xero trial balance).
 *   M1  Setup › Move in -> the three steps (File · Columns · Preview), the file picker, the source and the export to choose
 *   M2  pick ChartOfAccounts.csv -> Read the file -> ONE preflight call with the csv, kind and source; the Columns step shows every header with its guess
 *   M3  Preview -> ONE preview call carrying the confirmed decisions; three large numbers (will add · will merge · will skip) and a row with its reason
 *   M4  Import -> ONE import call with confirm: true; the outcome (added · merged · skipped), the skipped row with its reason, Download skipped rows
 *   M5  Another file: an UNBALANCED trial balance -> the preview says the sentence and Import is greyed WITH it (the server's refusal, painted)
 *   M6  390 px: the preview step fits the width (no sideways scroll)
 *   M7  every stand-in answer for a route in the contract had the API's keys, nesting and types
 *
 * ⚠️ the stand-in's ORDER: Playwright tries the LAST registered route first - the catch-all goes in FIRST, the specific answers after it.
 *   NODE_PATH=e2e/node_modules node e2e/walk-move-in.cjs         headless, fast
 *   node e2e/walk-move-in.cjs --show                              watch it
 */
'use strict';
const path = require('path');
const fs = require('fs');
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const books = require('./lib/books-api.cjs');
const FIX = (f) => path.join(__dirname, 'fixtures', 'move-in', f);
const J = (r, o, status) => C.json(r, status || 200, o);

/* ── the stand-in: the API's answers for the three move-in doors, shaped as routes/books.js sends them ── */
const FIELDS = {
  accounts: [['code', 'Their code', false], ['name', 'Account name', true], ['type', 'Account type', true], ['system', 'System account', false], ['tax_code', 'Default tax', false], ['description', 'Description', false]],
  trial_balance: [['account', 'Account', true], ['code', 'Their code', false], ['debit', 'Debit', true], ['credit', 'Credit', true]],
};
const KNOWN = { accounts: { '*Code': 'code', '*Name': 'name', '*Type': 'type', '*Tax Code': 'tax_code', Description: 'description' }, trial_balance: { Account: 'account', Debit: 'debit', Credit: 'credit' } };
function preflight(b) {
  const headers = String(b.csv || '').split(/\r?\n/)[0].split(',').map((h) => h.trim()), known = KNOWN[b.kind] || {};
  const guess = headers.map((h) => known[h] ? { incoming: h, field: known[h], how: 'known', confidence: 1, why: '"' + h + '" is what the export calls ' + known[h] }
    : { incoming: h, field: null, how: 'unmatched', confidence: 0, why: 'not one of the columns this import reads — ignored unless you pick a field' });
  return { kind: b.kind, source: b.source, headers, fields: (FIELDS[b.kind] || []).map(([key, label, required]) => ({ key, label, required })), guess, missing: [], ready: true,
    rows_total: String(b.csv || '').trim().split(/\r?\n/).length - 1, sample: [], sheet: null, sheets: null, header_row: 1 };
}
const ROWS_ACCOUNTS = [
  { line: 2, what: 'Business Bank Account', action: 'merge', why: 'A ledger named "Business bank account" exists (1500) — keeps Xero code 090.', data: { account_id: 'a1', code: '1500', source_code: '090', note: null } },
  { line: 3, what: 'Business Savings Account', action: 'add', why: 'Under Bank Accounts, keeping Xero code 091.', data: { name: 'Business Savings Account', group_code: 'G1500', group_id: 'g1', group_name: 'Bank Accounts', source_code: '091', note: null } },
  { line: 4, what: 'Sales', action: 'merge', why: 'A ledger named "Sales" exists (4000) — keeps Xero code 200.', data: { account_id: 'a2', code: '4000', source_code: '200', note: 'default tax GST on Income = Taxable supply 10% — not kept' } },
  { line: 5, what: 'Other Revenue', action: 'add', why: 'Under Sales, keeping Xero code 260.', data: { name: 'Other Revenue', group_code: 'G4000', group_id: 'g2', group_name: 'Sales', source_code: '260', note: null } },
  { line: 6, what: 'Cost of Goods Sold', action: 'add', why: 'Under Cost of Sales, keeping Xero code 300.', data: { name: 'Cost of Goods Sold', group_code: 'G5100', group_id: 'g3', group_name: 'Cost of Sales', source_code: '300', note: null } },
  { line: 7, what: 'Advertising', action: 'merge', why: 'A ledger named "Advertising" exists (6110) — keeps Xero code 400.', data: { account_id: 'a3', code: '6110', source_code: '400', note: null } },
  { line: 8, what: 'Bank Fees', action: 'add', why: 'Under Operating Expenses, keeping Xero code 404.', data: { name: 'Bank Fees', group_code: 'G6000', group_id: 'g4', group_name: 'Operating Expenses', source_code: '404', note: null } },
  { line: 9, what: 'Rent', action: 'merge', why: 'A ledger named "Rent" exists (6010) — keeps Xero code 469.', data: { account_id: 'a4', code: '6010', source_code: '469', note: null } },
  { line: 10, what: 'Accounts Receivable', action: 'merge', why: 'Is your Customers (Trade debtors) ledger (1300) — keeps Xero code 610.', data: { account_id: 'a5', code: '1300', source_code: '610', note: null } },
  { line: 11, what: 'Inventory', action: 'add', why: 'Under Inventory, keeping Xero code 630.', data: { name: 'Inventory', group_code: 'G1200', group_id: 'g5', group_name: 'Inventory', source_code: '630', note: null } },
  { line: 12, what: 'Accounts Payable', action: 'merge', why: 'Is your Suppliers (Trade creditors) ledger (2100) — keeps Xero code 800.', data: { account_id: 'a6', code: '2100', source_code: '800', note: null } },
  { line: 13, what: 'GST', action: 'merge', why: 'Is your GST collected ledger (2200) — keeps Xero code 820.', data: { account_id: 'a7', code: '2200', source_code: '820', note: null } },
  { line: 14, what: 'Owner A Drawings', action: 'add', why: 'Under Equity, keeping Xero code 880.', data: { name: 'Owner A Drawings', group_code: 'G3000', group_id: 'g6', group_name: 'Equity', source_code: '880', note: null } },
  { line: 15, what: 'Retained Earnings', action: 'merge', why: 'A ledger named "Retained earnings" exists (3900) — keeps Xero code 960.', data: { account_id: 'a8', code: '3900', source_code: '960', note: null } },
  { line: 16, what: 'Tracking Transfers', action: 'skip', why: 'No home for Xero type "TRACKING" — add it under Shop ledgers and pick its group.', data: null },
];
const TB_REFUSAL = 'The trial balance does not balance: debits A$15,230.50, credits A$12,000.00 — the difference is A$3,230.50. Export it again as at the move date, with every account.';
const ROWS_TB = [
  { line: 2, what: 'Business Bank Account', action: 'add', why: 'Debit A$15,230.50 on 1500 Business bank account.', data: { code: '1500', name: 'Business bank account', dr_minor: 1523050, cr_minor: 0 } },
  { line: 3, what: 'Sales', action: 'add', why: 'Credit A$12,000.00 on 4000 Sales.', data: { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 1200000 } },
  { line: 4, what: 'Total', action: 'skip', why: 'A total row.', data: null },
];
function preview(b) {
  const base = { kind: b.kind, source: b.source, side: b.side || null, as_at: b.as_at || '2026-07-01' };
  if (b.kind === 'trial_balance') return Object.assign(base, { counts: { add: 2, merge: 0, skip: 1 }, refusal: TB_REFUSAL, notes: [], rows: ROWS_TB, totals: { dr_minor: 1523050, cr_minor: 1200000 }, control: { debtors_minor: 0, creditors_minor: 0 } });
  return Object.assign(base, { counts: { add: 6, merge: 8, skip: 1 }, refusal: null, notes: [], rows: ROWS_ACCOUNTS });
}
function imported(b) {
  return { side: b.side || null, as_at: b.as_at || '2026-07-01', kind: b.kind, source: b.source, added: 6, merged: 8, skipped: 1, rows: [{ line: 16, what: 'Tracking Transfers', why: 'No home for Xero type "TRACKING" — add it under Shop ledgers and pick its group.' }],
    notes: ['Their account codes could not be kept yet (a database update, b302, is still to run) — a trial balance will match on names.'], source_code_written: false };
}
/* the three doors, as the page calls them (e2e/contract.cjs reads these literals to know this harness answers them) */
const DOORS = { preflight: '/api/books/move-in/preflight', preview: '/api/books/move-in/preview', import: '/api/books/move-in/import', health: '/api/books/health', todo: '/api/books/todo' };
async function stub(ctx, sent) {
  await ctx.route('**/api/**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })));
  await ctx.route('**/api/entities/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entity: { display_name: 'Walk Shop', currency_code: 'AUD' } }) }));
  await ctx.route('**' + DOORS.health, (r) => J(r, books.health({ currency: 'AUD' })));
  await ctx.route('**' + DOORS.todo, (r) => J(r, []));
  await ctx.route('**' + DOORS.preflight, (r) => { const b = JSON.parse(r.request().postData() || '{}'); sent.preflight.push(b); return J(r, preflight(b)); });
  await ctx.route('**' + DOORS.preview, (r) => { const b = JSON.parse(r.request().postData() || '{}'); sent.preview.push(b); return J(r, preview(b)); });
  await ctx.route('**' + DOORS.import, (r) => { const b = JSON.parse(r.request().postData() || '{}'); sent.import.push(b); return J(r, imported(b)); });
}
const text = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.textContent.trim() : ''; }, sel);

W.run('move-in', async (w) => {
  const { page, ctx, base } = w;
  const sent = { preflight: [], preview: [], import: [] };
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Walk Owner', 'Walk Shop'));
  await stub(ctx, sent);

  await w.step('M1', 'Accounts › Setup › Move in -> the three steps, the file picker, the source and the export to choose', async () => {
    await page.goto(base + '/accounts.html#movein');
    await page.waitForSelector('[data-testid="mi-steps"]', { timeout: 20000 });
    const chips = await page.$$eval('[data-testid^="step-"]', (els) => els.filter((e) => /^step-(file|columns|preview)$/.test(e.dataset.testid)).map((e) => e.textContent.trim()));
    const src = await page.$eval('[data-testid="mi-source"]', (e) => e.value), kind = await page.$eval('[data-testid="mi-kind"]', (e) => e.value);
    const next = await page.$eval('[data-testid="mi-next"]', (e) => ({ disabled: e.disabled, title: e.title, text: e.textContent.trim() }));
    const ok = chips.length === 3 && !!(await page.$('[data-testid="mi-file"]')) && src === 'xero' && kind === 'accounts' && next.disabled && /Pick the file first/.test(next.title);
    return { ok, saw: chips.join(' · ') + ' · ' + next.text + (next.disabled ? ' (greyed: ' + next.title + ')' : '') };
  });
  await w.step('M2', 'pick ChartOfAccounts.csv -> Read the file -> ONE preflight call (csv · kind · source); the Columns step shows every header with its guess', async () => {
    await page.setInputFiles('[data-testid="mi-file"]', FIX('xero-accounts.csv'));
    await page.waitForSelector('[data-testid="mi-file-name"]');
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="mi-next"]'); return b && !b.disabled; });
    await page.click('[data-testid="mi-next"]');
    await page.waitForSelector('[data-testid="mi-columns-step"]', { timeout: 10000 });
    const code = await page.$eval('[data-testid="mi-pick-*Code"]', (e) => e.value), name = await page.$eval('[data-testid="mi-pick-*Name"]', (e) => e.value), bal = await page.$eval('[data-testid="mi-pick-Balance"]', (e) => e.value);
    const total = await text(page, '[data-testid="mi-rows-total"]');
    const b = sent.preflight[0] || {};
    const ok = sent.preflight.length === 1 && b.kind === 'accounts' && b.source === 'xero' && /\*Code,\*Name/.test(b.csv || '') && code === 'code' && name === 'name' && bal === '' && /15 rows/.test(total);
    return { ok, saw: sent.preflight.length + ' preflight call · *Code→' + code + ' · *Name→' + name + ' · Balance→' + (bal || 'not read') + ' · ' + total };
  });
  await w.step('M3', 'Preview -> ONE preview call with the confirmed decisions; will add 6 · will merge 8 · will skip 1, and a row with its reason', async () => {
    await page.click('[data-testid="mi-next"]');
    await page.waitForSelector('[data-testid="mi-preview-step"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="mi-row-16"]', { timeout: 10000 });
    const n = [await text(page, '[data-testid="mi-n-add"]'), await text(page, '[data-testid="mi-n-merge"]'), await text(page, '[data-testid="mi-n-skip"]')];
    const row = await text(page, '[data-testid="mi-row-16"]');
    const b = sent.preview[0] || {}, dec = b.decisions || [];
    const ok = sent.preview.length === 1 && dec.some((d) => d.incoming === '*Code' && d.field === 'code') && !dec.some((d) => d.incoming === 'Balance') && n.join(',') === '6,8,1' && /Will skip/.test(row) && /No home for Xero type "TRACKING"/.test(row);
    return { ok, saw: n.join(' · ') + ' · line 16: ' + row.replace(/\s+/g, ' ').slice(0, 90) };
  });
  await w.step('M4', 'Import -> ONE import call with confirm: true; added 6 · merged 8 · skipped 1, the skipped row with its reason, Download skipped rows', async () => {
    await page.click('[data-testid="mi-import"]');
    await page.waitForSelector('[data-testid="mi-done"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="mi-skip-16"]', { timeout: 10000 });
    const n = [await text(page, '[data-testid="mi-done-add"]'), await text(page, '[data-testid="mi-done-merge"]'), await text(page, '[data-testid="mi-done-skip"]')];
    const note = await text(page, '[data-testid="mi-note"]'), dl = !!(await page.$('[data-testid="mi-download"]'));
    const b = sent.import[0] || {};
    const ok = sent.import.length === 1 && b.confirm === true && b.kind === 'accounts' && n.join(',') === '6,8,1' && dl && /b302/.test(note);
    return { ok, saw: n.join(' · ') + (dl ? ' · Download skipped rows' : ' · no download') + ' · ' + note.slice(0, 60) };
  });
  await w.step('M5', 'Another file: an UNBALANCED trial balance -> the preview says the sentence and Import is greyed WITH it', async () => {
    await page.click('[data-testid="mi-again"]');
    await page.waitForSelector('[data-testid="mi-file-step"]');
    await page.selectOption('[data-testid="mi-kind"]', 'trial_balance');
    await page.waitForSelector('[data-testid="mi-asat"]');
    await page.fill('[data-testid="mi-asat"]', '2026-07-01');
    await page.setInputFiles('[data-testid="mi-file"]', FIX('xero-tb-unbalanced.csv'));
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="mi-next"]'); return b && !b.disabled; });
    await page.click('[data-testid="mi-next"]');
    await page.waitForSelector('[data-testid="mi-columns-step"]', { timeout: 10000 });
    await page.click('[data-testid="mi-next"]');
    await page.waitForSelector('[data-testid="mi-refusal"]', { timeout: 10000 });
    const refusal = await text(page, '[data-testid="mi-refusal"]');
    const imp = await page.$eval('[data-testid="mi-import"]', (e) => ({ disabled: e.disabled, title: e.title }));
    const why = await text(page, '[data-testid^="step-why-"]');
    const b = sent.preview[1] || {};
    const ok = b.kind === 'trial_balance' && b.as_at === '2026-07-01' && refusal === TB_REFUSAL && imp.disabled && imp.title === TB_REFUSAL && why === TB_REFUSAL && sent.import.length === 1;
    return { ok, saw: (imp.disabled ? 'Import greyed: ' : 'Import LIVE: ') + refusal.slice(0, 80) };
  });
  await w.step('M6', '390 px: the preview step fits the width', async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(400);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    return { ok: sw <= 390, saw: 'scrollWidth ' + sw };
  });
  await w.step('M7', 'every stand-in answer for a route in the contract had the API\'s keys, nesting and types', async () => {
    const [ok, msg] = C.finish();
    return { ok, saw: msg.slice(0, 160) };
  });
});
