/**
 * reviews6-books-money.test.cjs — reviews6 (21 Nov 2026) GF-05 M5 and M9, on the real cap-books.js functions (vm sandbox).
 * OWNS      the proof that (1) the day strip does not count a reversed bill (its mirror row has no source, so the original must drop out);
 *           (2) a balance-sheet ledger on no listed head is still drawn, so the lines foot to the server's total.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews6-books-money.test.cjs
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };
const cx = vm.createContext({
  esc: (s) => String(s), tx: (s) => s,
  bkStRow: (cls, label, cells) => '<tr>' + label + (cells || []).map((c) => '[' + c.v + ']').join('') + '</tr>',
  bkFig: (m) => String(m), bkChange: () => '', bkPct: () => '', bkDrillLink: (code, name) => name
});
vm.runInContext(liftFns('public/app/cap-books.js', ['bkDayEntryTotal', 'bkDayAddTender', 'bkDaySales', 'bkBsSide']) + '\nthis.f = { bkDaySales, bkBsSide };', cx);
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
vm.runInContext(liftFns('public/app/cap-admin.js', ['misTaxMonth', 'misTaxSetMonth', 'misTaxRead', 'loadTaxLedger']) + '\nthis.f = { misTaxSetMonth };', cx2);
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
  // GF-08 M3 two currencies are never one unbilled sum
  const cx4 = vm.createContext({});
  vm.runInContext(liftFns('public/app/cap-crm-record.js', ['crmCountUnbilled', 'crmBillFacts']) + '\nthis.f = { crmBillFacts };', cx4);
  const ord = (minor, currency) => ({ kind: 'chit', src: 'chit', purpose: 'order', state: { word: 'open' }, amount_minor: minor, currency });
  const one = cx4.f.crmBillFacts([ord(100000, 'inr'), ord(5000, 'inr')]).unbilled;
  t('one currency still adds', one.minor === 105000 && one.n === 2, JSON.stringify(one));
  const two = cx4.f.crmBillFacts([ord(100000, 'inr'), ord(5000, 'usd'), ord(700, 'usd')]).unbilled;
  t('INR + USD orders give the count alone (minor null)', two.minor === null && two.n === 3, JSON.stringify(two));
  // GF-07 M14 a null price is no price (static: Number(null) is 0 and 0 is finite)
  const chit2 = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-chit2.js'), 'utf8');
  t('cap-chit2 reads a line price with null as NaN, never Number(null)', !/\bp = Number\(l\.price\)/.test(chit2) && /\.price == null/.test(chit2));
  // GF-07 M3 a late chit read must not overwrite the chit now on screen
  const cx5 = vm.createContext({ C2: { id: 'A' }, c2Paint() {}, UI: { actors: [1] }, mapApiMsg: null });
  const waiting = {};
  cx5.api = (name, o) => (name === 'chit' ? new Promise((res) => { waiting[o.params.id] = () => res({ id: o.params.id, lines: [] }); }) : Promise.resolve([]));
  vm.runInContext(liftFns('public/app/cap-chit2.js', ['loadChit2']) + '\nthis.f = { loadChit2 };', cx5);
  const first = cx5.f.loadChit2(); cx5.C2.id = 'B'; const second = cx5.f.loadChit2();
  waiting.B(); await second; waiting.A(); await first;
  t('a late read for chit A does not overwrite chit B', cx5.C2.data && cx5.C2.data.id === 'B', JSON.stringify(cx5.C2.data));
  // GF-07 M5 the installer makes config.json owner-only before the key is written
  const cx6 = vm.createContext({ CFG: {}, tx: (x) => x });
  const conn = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-connector.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-connector-reissue.js'), 'utf8'); /* the reissue half moved out (websplit C) */
  t('the installer creates config.json mode 600 before the tee that writes the key', /install -m 600 \/dev\/null "\$DIR\/config\.json"[^]*?sudo tee "\$DIR\/config\.json"/.test(conn));
  t('a failed device read after a reissue no longer drops the new key (shown once)', /catch \(failure\) \{[^}]*return null;/.test(conn) && /the old key is already dead/.test(conn) && /mode === 'package' \? 'The installer could not be built/.test(conn));
  // GF-07 M13 a double tap on Delivered posts once
  let posted = 0; const cx7 = vm.createContext({ C2: { id: 'A' }, document: { getElementById: (id) => (id === 'c2dq_L1' ? { value: '5', placeholder: '' } : null) }, toast() {}, MSG: { fail: String }, c2ApplyProgress: () => true, loadChit2: async () => {} });
  cx7.postDeliverLines = () => { posted++; return new Promise((r) => setTimeout(() => r({}), 10)); };
  vm.runInContext('var C2_DELIVERING = {};\n' + liftFns('public/app/cap-chit2.js', ['c2DeliverQuantity', 'c2Deliver']) + '\nthis.f = { c2Deliver };', cx7);
  await Promise.all([cx7.f.c2Deliver('L1', 'kg'), cx7.f.c2Deliver('L1', 'kg')]);
  t('a double tap on Delivered posts once', posted === 1, String(posted));
  process.exit(fail ? 1 : 0);
})();

