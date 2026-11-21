/**
 * reviews6-books-money.test.cjs — reviews6 (21 Nov 2026) GF-05 M5 and M9, on the real cap-books.js functions (vm sandbox).
 * OWNS      the proof that (1) the day strip does not count a reversed bill (its mirror row has no source, so the original must drop out);
 *           (2) a balance-sheet ledger on no listed head is still drawn, so the lines foot to the server's total.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews6-books-money.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };
const cx = vm.createContext({
  esc: (s) => String(s), tx: (s) => s,
  bkStRow: (cls, label, cells) => '<tr>' + label + (cells || []).map((c) => '[' + c.v + ']').join('') + '</tr>',
  bkFig: (m) => String(m), bkChange: () => '', bkPct: () => '', bkDrillLink: (code, name) => name
});
vm.runInContext(liftFns('public/app/cap-books.js', ['bkDaySales', 'bkBsSide']) + '\nthis.f = { bkDaySales, bkBsSide };', cx);
const bill = (id, rev) => ({ posting_date: '2026-11-20', entry_id: id, reversed_by: rev || null, source: { kind: 'bill', counter: 'C2', how: 'cash' }, lines: [{ dr_minor: 118000 }] });
const live = cx.f.bkDaySales([bill(1), bill(2)], '2026-11-20');
t('two live bills count 2', live.counters[0].bills === 2 && live.counters[0].amount_minor === 236000, JSON.stringify(live));
const net = cx.f.bkDaySales([bill(1, 9), bill(2)], '2026-11-20');
t('a reversed bill is not counted (1 bill, one amount)', net.counters[0].bills === 1 && net.counters[0].amount_minor === 118000 && net.tenders[0].amount_minor === 118000, JSON.stringify(net));
const html = cx.f.bkBsSide('Assets', [{ code: '1000', name: 'Cash', amount_minor: 5, group: { code: 'cur' } }, { code: '1900', name: 'Odd ledger', amount_minor: 7, group: null }, { code: '1901', name: 'Other', amount_minor: 3, group: { code: 'zzz' } }], [{ code: 'cur', name: 'Current' }], 'inr', 15, null, 't', '2026-11-20', '2026-04-01', false);
t('a ledger with no head still shows', html.includes('Odd ledger') && html.includes('Other') && html.includes('Cash'), html);
t('with no heads at all every line shows', cx.f.bkBsSide('Assets', [{ code: '1', name: 'Lone', amount_minor: 1 }], undefined, 'inr', 1, null, 't', 'a', 'b', false).includes('Lone'));
// GF-03 M3 the tax ledger: a slow answer for an old month must not land under the new month's label
const cx2 = vm.createContext({ UI: { _taxMonth: '2026-10' }, document: { getElementById: () => null }, misBand: () => 'x', MIS_BANDS: [], esc: String });
const slow = {};
cx2.api = (name, o) => new Promise((res) => { slow[o.query.month] = () => res({ month: o.query.month }); });
vm.runInContext(liftFns('public/app/cap-admin.js', ['misTaxMonth', 'misTaxSetMonth', 'loadTaxLedger']) + '\nthis.f = { misTaxSetMonth };', cx2);
(async () => {
  cx2.f.misTaxSetMonth('2026-10'); cx2.f.misTaxSetMonth('2026-09');
  slow['2026-09'](); await new Promise((r) => setTimeout(r, 5));
  slow['2026-10'](); await new Promise((r) => setTimeout(r, 5));
  t('a late October answer does not land under the September label', cx2.UI._taxLedger && cx2.UI._taxLedger.month === '2026-09', JSON.stringify(cx2.UI._taxLedger));
  // EL-04 M12 loan EMI: a null / empty / string interest is not a typed interest
  const cx3 = vm.createContext({});
  vm.runInContext(liftFns('public/app/cap-bank-post.js', ['lineFigure', 'loanEmiRefusal'], '  ') + '\nthis.f = { loanEmiRefusal };', cx3);
  const emi = (i) => cx3.f.loanEmiRefusal({ loanRef: 'L1', line: { debit_minor: 2500000 }, interestMinor: i });
  t('null interest is refused', /Type the interest/.test(emi(null) || ''), String(emi(null)));
  t('empty-string interest is refused', /Type the interest/.test(emi('') || ''), String(emi('')));
  t('a typed 0 and a typed 5000 pass', emi(0) === null && emi(500000) === null, emi(0) + '|' + emi(500000));
  process.exit(fail ? 1 : 0);
})();

