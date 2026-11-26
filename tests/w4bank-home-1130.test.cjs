/* tests/w4bank-home-1130.test.cjs: walk 4 (26 Nov 2026) W4-10: the Bank page counts sign-offs of the months DUE (Jul..Oct = 4 on 26 Nov, not the 12 of the year) and the key
 * explains every symbol a cell can show (the "✓!" too). HAND-COMPUTED: today 2026-11-26, FY27 months 2026-07..2027-06; Oct signed with A$354.32 (35432 minor) unexplained
 * -> "Monthly sign-offs: 1 of 4 · Oct: A$354.32 unexplained". Runs the real cap-bank-home.js in a vm with a stub page. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank-home.js'), 'utf8');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n      ' + e.message); } };
const months = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'];
const ACCOUNT = { account_id: 'a1', code: '1020', name: 'Business bank account' };
function page() {
  const data = { today: '2026-11-26', months, accounts: [ACCOUNT], cells: [{ account_id: 'a1', month: '2026-10', missing: false, file_ids: ['f1'] }] };
  const ctx = { BKST: { data, fy: 2027, cur: 2027 }, tx: (s) => s, txf: (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] !== undefined ? o[k] : m)), bkstMonth: (m) => ({ '10': 'Oct' }[m.slice(5)] || m), bkstAccountName: (a) => a.name, bkMoney: (minor, cur) => 'A$' + (minor / 100).toFixed(2), shopReg: () => ({ retentionYears: 7, fyStartMonth: 7 }), console };
  ctx.window = { addEventListener() {} }; ctx.document = { addEventListener() {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'cap-bank-home.js' });
  vm.runInContext("BANK_HOME.known = true; BANK_HOME.signed = { a1: [{ period_from: '2026-10-01', period_to: '2026-10-31', difference_minor: 35432, currency: 'AUD', at: '2026-11-26' }] };", ctx);
  return ctx;
}
t('W4-10 the count is of months due: 1 of 4, with the remainder named', () => {
  const ctx = page();
  const h = vm.runInContext('bkhSignedLinesHtml(BKST.data)', ctx);
  assert.ok(/Monthly sign-offs: 1 of 4/.test(h) && /Oct: A\$354\.32 unexplained/.test(h), h);
});
t('W4-10 the key names every symbol the cells use: ✓ ✓! ● ○', () => {
  const ctx = page();
  const grid = vm.runInContext('bankHomeGridHtml()', ctx);
  const key = (/data-testid="bank-home-key">([^<]*)</.exec(grid) || [])[1] || '';
  assert.ok(/✓!/.test(grid), 'the Oct cell shows ✓!');
  for (const sym of ['✓!', '●', '○']) assert.ok(key.includes(sym), 'key has ' + sym + ': ' + key);
  assert.ok(/✓ signed off/.test(key) && /✓! .*unexplained/.test(key), key);
});
t('W4-12 the Bank page says the one no-run sentence the api carries beside the count, and nothing when there is none', () => {
  const ctx = page();
  const W = 'Months are signed off, none in an unbroken run from the first bank entry';
  vm.runInContext('BKST.data.unexplained = { count: 0, no_run: true, words: ' + JSON.stringify(W) + ' }', ctx);
  assert.ok(vm.runInContext('bkhSignedLinesHtml(BKST.data)', ctx).includes(W));
  vm.runInContext('BKST.data.unexplained = { count: 1, no_run: false, words: null }', ctx);
  assert.ok(!vm.runInContext('bkhSignedLinesHtml(BKST.data)', ctx).includes('unbroken run'));
});
/* W4-11: the sign-off record names its two balances. HAND-COMPUTED: bank 100000 minor = A$1,000.00, books 64568 minor = A$645.68, difference 35432 = A$354.32 (1000.00 - 645.68). */
t('W4-11 the signed record row says Bank, Books and the difference', () => {
  const store = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank-store.js'), 'utf8');
    const ctx = { tx: (x) => x, txf: (x, o) => String(x).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] !== undefined ? o[k] : m)), bkMoney: (m) => 'A$' + (m / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }), bkDate: (d) => d, bksE: (x) => x, console, window: {}, document: { addEventListener() {} } };
  vm.createContext(ctx);
  vm.runInContext(store + "\nbankStoreState.statements = [{ at: '2026-11-26', period_to: '2026-10-31', closing_bank_minor: 100000, closing_books_minor: 64568, difference_minor: 35432, currency: 'AUD', tied: false }]; this.__h = bankStoreSigned();", ctx);
  const h = ctx.__h; assert.ok(/Bank A\$1,000\.00 · Books A\$645\.68 · Difference A\$354\.32/.test(h), String(h));
});
console.log(pass + ' ok, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
