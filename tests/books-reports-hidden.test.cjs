/**
 * tests/books-reports-hidden.test.cjs - RAIL-146o web twin (api B4, PR batch/2026-11-12-b4-cost-blind-reads): the Trial balance, Profit and loss, Balance sheet and Day book
 * of a cost-blind co-assist say "Hidden" where the server sent null + cost_hidden:true. null is NOT zero: never 0.00, never "Profit 0.00", never "balances".
 * An owner's answer paints exactly as before (no "Hidden" anywhere). Payload shapes are the api's own (api tests/rail146o-books-reports-cost-blind.test.cjs).
 * Offline: the page's own functions are cut out of public/app/cap-books.js (no second copy of the logic). Fails on main (bkHid does not exist).
 * Run: node tests/books-reports-hidden.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const NL = String.fromCharCode(10);
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-books.js'), 'utf8').replace(/\r\n/g, NL);
const fn = (name) => {
  const at = src.indexOf('function ' + name + '(');
  assert(at >= 0, name + ' not found in cap-books.js (the hidden-figure helpers are missing)');
  const start = src.slice(Math.max(0, at - 6), at) === 'async ' ? at - 6 : at;
  const first = src.slice(at, src.indexOf(NL, at));
  return first.split('{').length === first.split('}').length ? src.slice(start, at + first.length) : src.slice(start, src.indexOf(NL + '}' + NL, at) + 2);
};
globalThis.tx = (s) => s; globalThis.esc = (s) => String(s);
globalThis.bkDec = () => 2; globalThis.bkCur = (c) => c;
globalThis.fmtMoney = (n, c) => (c === 'INR' ? '₹' : c + ' ') + n.toFixed(2);
globalThis.bkTable = (head, rows, foot) => '<table>' + rows + foot + '</table>';
globalThis.bkLedgerLink = (code, name) => name;
globalThis.bkMountAttribute = () => '';
globalThis.bkToday = () => '2026-10-30';
globalThis.bkErr = (e) => 'ERR ' + e.message;
globalThis.bkRange = () => ({ from: '2026-04-01', to: '2026-10-30' });
globalThis.bkRangeHTML = () => '';
globalThis.document = { getElementById: () => null };
let answer = null;
globalThis.api = async () => answer;
eval(
  ['bkMoney', 'bkHid', 'bkSideHTML', 'bkTB', 'bkPL', 'bkBS', 'bkDvHidden', 'bkDvGist', 'bkDvTotal', 'bkDvGistHTML', 'bkDvGistText', 'bkDvGroupSummary'].map(fn).join(NL) +
    NL + 'globalThis.F = { bkHid, bkTB, bkPL, bkBS, bkDvHidden, bkDvTotal, bkDvGist, bkDvGistText };'
);
const F = globalThis.F;
globalThis.bkDaySales = () => ({ tenders: [] });
globalThis.bkDvKind = (e) => (e.event_type === 'sale_bill' ? 'Sales' : 'Other');
globalThis.txn = (a, b, n) => n + ' entries';
const paint = async (name, reply) => { answer = reply; const body = { innerHTML: '' }; await F[name](body); return body.innerHTML; };
const money = { currency: 'INR' };

(async () => {
  /* ---- the blind reader: the api's own answer, every figure null ---- */
  const tb = await paint('bkTB', Object.assign({ asOf: '2026-10-30', rows: [{ code: '1000', name: 'Cash', dr_minor: null, cr_minor: null }], total_dr_minor: null, total_cr_minor: null, balanced: true, cost_hidden: true }, money));
  assert(!/0\.00/.test(tb), 'TB: no 0.00 for a hidden figure: ' + tb);
  assert(!/balances/.test(tb) && /tb-balanced[^>]*>[^<]*Hidden/.test(tb), 'TB: the chip says Hidden, never "balances" nor "does not balance": ' + tb);
  assert(/data-testid="tb-dr"><b>Hidden/.test(tb) && /data-testid="tb-cr"><b>Hidden/.test(tb), 'TB: totals say Hidden');
  assert(/<td class="num">Hidden<\/td><td class="num">Hidden<\/td>/.test(tb), 'TB: the row says Hidden');
  const pl = await paint('bkPL', Object.assign({ from: 'a', to: 'b', income: [{ code: '4000', name: 'Sales', amount_minor: null }], expense: [{ code: '5000', name: 'Purchases', amount_minor: null }], total_income_minor: null, total_expense_minor: null, profit_minor: null, by_line: { income: [], expense: [] }, cost_hidden: true }, money));
  assert(!/0\.00/.test(pl) && !/Profit ₹/.test(pl) && /pl-profit"><b>Profit or loss Hidden/.test(pl), 'PL: "Profit or loss Hidden", never Profit 0.00: ' + pl);
  const bs = await paint('bkBS', Object.assign({ asOf: 'x', assets: [{ code: '1000', name: 'Cash', amount_minor: null }], liabilities: [], equity: [], total_assets_minor: null, total_liab_equity_minor: null, balanced: true, cost_hidden: true }, money));
  assert(!/0\.00/.test(bs) && !/balances/.test(bs) && /bs-balanced[^>]*>[^<]*Hidden/.test(bs), 'BS: Hidden, no 0.00, no "balances": ' + bs);
  assert(/<b>Hidden<\/b>/.test(bs), 'BS: the totals say Hidden');
  /* the day book: a hidden purchase entry says Hidden; a sales entry on the same page keeps its figure */
  const sale = { entry_no: 'SB-1', event_type: 'sale_bill', lines: [{ code: '1300', name: 'Debtors', dr_minor: 11800000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 11800000 }] };
  const purchase = { entry_no: 'PB-1', event_type: 'purchase_bill', lines: [{ code: '5000', name: 'Purchases', dr_minor: null, cr_minor: null }, { code: '2100', name: 'Creditors', dr_minor: null, cr_minor: null }] };
  assert.strictEqual(F.bkDvHidden(purchase), true); assert.strictEqual(F.bkDvHidden(sale), false);
  assert.strictEqual(F.bkDvTotal(purchase), null, 'a hidden entry has no total (not 0)');
  assert.strictEqual(F.bkDvTotal(sale), 11800000, 'a sales entry keeps its total');
  assert(F.bkDvGistText(purchase, 'INR').split(' · ').every((part) => /Hidden$/.test(part)) && !/0\.00/.test(F.bkDvGistText(purchase, 'INR')), 'the gist says Hidden: ' + F.bkDvGistText(purchase, 'INR'));
  assert(/118000\.00/.test(F.bkDvGistText(sale, 'INR')), 'the sales gist keeps its figures');
  assert.strictEqual(F.bkHid(null, 'INR'), 'Hidden'); assert.strictEqual(F.bkHid(0, 'INR'), '₹0.00', 'a true zero is still 0.00');
  /* ---- the owner: the same screen as before, no "Hidden" anywhere ---- */
  const tbO = await paint('bkTB', Object.assign({ asOf: 'x', rows: [{ code: '1000', name: 'Cash', dr_minor: 500, cr_minor: 0 }], total_dr_minor: 500, total_cr_minor: 500, balanced: true }, money));
  assert(!/Hidden/.test(tbO) && /✓ balances/.test(tbO) && /₹5\.00/.test(tbO), 'owner TB: figures and "balances": ' + tbO);
  const plO = await paint('bkPL', Object.assign({ from: 'a', to: 'b', income: [], expense: [], profit_minor: -70000, by_line: {} }, money));
  assert(!/Hidden/.test(plO) && /Loss ₹700\.00/.test(plO), 'owner PL: Loss 700.00: ' + plO);
  const bsO = await paint('bkBS', Object.assign({ asOf: 'x', assets: [], liabilities: [], equity: [], total_assets_minor: 9, total_liab_equity_minor: 9 }, money));
  assert(!/Hidden/.test(bsO) && /✓ balances/.test(bsO), 'owner BS: balances');
  console.log('books-reports-hidden: all checks passed');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
