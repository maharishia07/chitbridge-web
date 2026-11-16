/**
 * dues-ageing-one-answer.test.cjs — W15-94 / W15-95 / W15-96 (l16-ageing, 16 Nov 2026): one ageing on Receivables, Payables and the Day book chip; what is still owed on each bill; the hold and the tax-invoice flag beside Pay.
 * OWNS      the proof, on the real cap-books.js functions (lifted into a vm sandbox): bkFollowWord · bkDuesAge · bkDuesNext · bkBillStanding · bkBillFlags · bkOwedFlags · bkPartyBillsHTML · bkTodoCounts · payHeldBills
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network, no sibling repo.
 *   node e2e/dues-ageing-one-answer.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
const FILE = 'public/app/cap-books.js';
const src = fs.readFileSync(path.join(__dirname, '..', FILE), 'utf8');
const varText = (name) => { const a = src.indexOf('var ' + name + ' = '), b = src.indexOf('\n];\n', a); return src.slice(a, b + 3); };

const money = (n, c) => 'M' + n;
const cx = vm.createContext({
  tx: (s) => s, esc: (s) => String(s), bkMoney: money, bkDate: (d) => 'D' + d,
  txf: (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => v[k]),
  bkBillPart: (s) => '<i>' + (s && s.ref) + '</i>', bkBillNo: (no, ref) => no || ref,
  bkQuiet: (n, f, d) => d, bkCur: () => 'AUD', bkPartyKind: (pid) => (BK.dues[pid].side === 'supplier' ? 'supplier' : 'customer'),
  bkWaitN: () => ({}), bkWaitTodo: () => '', bkChequeNext: () => [], bkChequeStatus: (s) => s, bkOwedRead: () => {}, bkStmtRead: () => {}, bkDuesSide: (p) => (p.side === 'supplier' ? 'pay' : 'rcv'),
  CBList: { nextRow: (cells) => '[' + cells.join(' | ') + ']', get: () => null },
  payAllocs: () => ALLOCS, PAY: null
});
let ALLOCS = [];
cx.BK = { dues: {}, stmt: {}, owed: {}, mk: null };
const BK = cx.BK;
vm.runInContext(varText('BK_FOLLOW') + '\n' + src.match(/^var BK_STANDING = .*;$/m)[0] + '\n' + liftFns(FILE, ['bkFollowWord', 'bkDuesAge', 'bkDuesNext', 'bkBillStanding', 'bkBillFlags', 'bkOwedFlags', 'bkPartyBillsHTML', 'bkTodoCounts', 'payHeldBills']) +
  '\nthis.f = { bkFollowWord, bkDuesAge, bkDuesNext, bkBillStanding, bkBillFlags, bkOwedFlags, bkPartyBillsHTML, bkTodoCounts, payHeldBills, BK_FOLLOW };', cx);
const f = cx.f;
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };
const FU = (o) => Object.assign({ not_due: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, worst: null, no_terms_minor: 0, terms: 'ok' }, o);

/* W15-94 · the five words, one list */
ok(JSON.stringify(f.BK_FOLLOW.map((x) => x[1])) === JSON.stringify(['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days']), 'the five ageing words: Current · 1–30 · 31–60 · 61–90 · 90+');
ok(f.bkFollowWord('lt_1m') === '', 'a pack month bucket is no word of this screen (there is no "Other")');

/* Northside: 135,300 owed; 6,600 not due, the rest 31–60 late (the walk's AU numbers) */
const north = { party_id: 'n', side: 'customer', balance_minor: 13530000, oldest_due: '2026-10-16', disputed_minor: 0, buckets: { not_due: 660000, lt_1m: 12870000 }, follow_up: FU({ not_due: 660000, d31_60: 12870000, worst: 'd31_60' }) };
ok(f.bkDuesAge(north) === '31–60 days', 'the oldest-due cell says "31–60 days", not "Not due" (the AU pack buckets are not read)');
const next = f.bkDuesNext(north, 'AUD', 'dues');
ok(/data-b="not_due">Current<\/span> \| M660000/.test(next) && /data-b="d31_60">31–60 days<\/span> \| M12870000/.test(next), 'the next level shows Current 6,600 and 31–60 days 128,700');
ok(!/Other/.test(next) && !/data-b="other"/.test(next), 'no "Other" row, whatever the pack sends');
ok(f.bkDuesAge({ follow_up: FU({ not_due: 5 }) }) === 'Current' && f.bkDuesAge({ follow_up: FU({}) }) === '' && f.bkDuesAge({}) === '', 'all not yet due = Current; nothing owed or no answer = no word');

/* no due date: the screen says so */
const nodue = Object.assign({}, north, { follow_up: FU({ d61_90: 100000, worst: 'd61_90', no_terms_minor: 100000, terms: 'not_set' }) });
ok(/M100000 has no due date — aged from the bill date/.test(f.bkDuesNext(nodue, 'AUD', 'dues')), 'a bill with no due date: "no due date — aged from the bill date"');

/* Payables: the same five, from the supplier row */
const metro = { party_id: 'm', side: 'supplier', balance_minor: -2125730, oldest_due: '2026-10-01', disputed_minor: 0, follow_up: FU({ d31_60: 2125730, worst: 'd31_60' }) };
ok(/data-b="d31_60">31–60 days<\/span> \| M2125730/.test(f.bkDuesNext(metro, 'AUD', 'dues')), 'Payables: Metro 21,257.30 sits under 31–60 days, the same word as Receivables');

/* the Day book chip counts the customers the same word calls late */
const counts = f.bkTodoCounts({ parties: [north, metro, { party_id: 'k', side: 'customer', follow_up: FU({ not_due: 800000 }) }, { party_id: 'x', side: 'customer' }] }, { cheques: [] }, {});
ok(counts.overdue === 1, 'the Day book chip: 1 customer overdue = the customers whose follow_up has a late bucket (' + counts.overdue + ')');

/* W15-95 · the bills with what is still owed */
BK.dues = { n: north };
BK.stmt.n = { lines: [
  { entry_id: 'e1', date: '2026-08-03', ref: 'S042-01', source_chit_id: 'c1', source: { ref: 'S042-01', chit_id: 'c1', kind: 'sale' }, dr_minor: 5000000, cr_minor: 0 },
  { entry_id: 'e2', date: '2026-08-20', ref: 'S042-02', source_chit_id: 'c2', source: { ref: 'S042-02', chit_id: 'c2', kind: 'sale' }, dr_minor: 6000000, cr_minor: 0 },
  { entry_id: 'e3', date: '2026-10-01', ref: 'S042-03', source_chit_id: 'c3', source: { ref: 'S042-03', chit_id: 'c3', kind: 'sale' }, dr_minor: 5000000, cr_minor: 0 },
  { entry_id: 'e4', date: '2026-11-10', ref: 'S042-04', source_chit_id: 'c4', source: { ref: 'S042-04', chit_id: 'c4', kind: 'sale' }, dr_minor: 660000, cr_minor: 0 },
  { entry_id: 'r1', date: '2026-09-12', ref: 'RV/2026-27/000001', source_chit_id: 'cr', source: { ref: 'RV', chit_id: 'cr', kind: 'receipt' }, dr_minor: 0, cr_minor: 7920000, payment_id: 'p1', unapplied_minor: 7920000 }] };
BK.owed.n = { checks: true, proposal: [
  { entry_id: 'e2', due_minor: 5080000, open_minor: 6000000, disputed: false },
  { entry_id: 'e3', due_minor: 5000000, open_minor: 5000000, disputed: false },
  { entry_id: 'e4', due_minor: 660000, open_minor: 660000, disputed: false }] };
const bills = f.bkPartyBillsHTML('n', 'dues', 'AUD');
ok(/S042-01<\/i> <span class="optchip" data-b="standing-paid"[^>]*>Paid<\/span> \| M5000000 \| <b data-b="owed">M0<\/b>/.test(bills), 'S042-01: amount 50,000 · still owed 0 · Paid');
ok(/S042-02<\/i> <span class="optchip" data-b="standing-part"[^>]*>Part-paid<\/span> \| M6000000 \| <b data-b="owed">M5080000<\/b>/.test(bills), 'S042-02: amount 60,000 · still owed 50,800 · Part-paid');
ok(/standing-unpaid[^>]*>Unpaid<\/span> \| M5000000 \| <b data-b="owed">M5000000<\/b>/.test(bills), 'S042-03: owed the whole 50,000 · Unpaid');
ok(/Bills M16660000 · still owed M10740000/.test(bills), 'the carried totals: bills and still owed');
ok(/Received M7920000 on D2026-09-12 · RV\/2026-27\/000001 · on account, counted against the oldest bills first/.test(bills), 'the receipt is said as the books hold it: on account, counted against the oldest bills first (not a made-up match)');
ok(/data-b="owed-mismatch"[^>]*>The party owes M13530000 — these bills do not add up to it/.test(bills), 'two carried totals that disagree are said (here the stand-in balance is not the bills), never hidden');
BK.owed.n = null;
ok(!/Still owed|data-b="owed"/.test(f.bkPartyBillsHTML('n', 'dues', 'AUD')), 'while the owed read is out (or an older api): the plain bills, no invented owed column');
BK.owed.n = { checks: true, failed: true, proposal: [] };
ok(!/data-b="owed"/.test(f.bkPartyBillsHTML('n', 'dues', 'AUD')), 'a failed owed read: the plain bills');
BK.owed.n = { proposal: [{ entry_id: undefined }] };
ok(!/data-b="standing/.test(f.bkPartyBillsHTML('n', 'dues', 'AUD')), 'an answer that never heard of checks does not paint every bill Paid');

/* W15-96 · the hold and the tax-invoice flag beside Pay */
const held = { against_ref: 'S042-19', bill_no: 'S042-19', due_date: '2026-10-01', mark: { class: 'hold', kind: 'on_hold', by_name: 'Pat Auditor', note: 'wait for the invoice' }, evidence_flag: 'no_tax_invoice' };
const flags = f.bkBillFlags(held);
ok(/data-b="mark-hold"[^>]*>‖ On hold/.test(flags) && /data-b="no-tax-invoice"[^>]*>⚠ No tax invoice/.test(flags), 'a held bill shows "On hold" and "No tax invoice" together');
ok(f.bkBillFlags({ mark: { class: 'clear' }, evidence_flag: null }) === '' && f.bkBillFlags(null) === '', 'a checked bill with its invoice shows nothing extra');
BK.dues.m = metro;
BK.owed.m = { checks: true, proposal: [held] };
const beside = f.bkOwedFlags('m');
ok(/On hold/.test(beside) && /No tax invoice/.test(beside), 'beside the party\'s Pay: both flags once its bills have been read');
cx.PAY = { preview: { proposal: [held, { against_ref: 'S042-20', bill_no: 'S042-20', mark: null }] } };
ALLOCS = [{ against_ref: 'S042-19', amount_minor: 2125730 }, { against_ref: 'S042-20', amount_minor: 100 }];
const heldList = f.payHeldBills();
ok(heldList.length === 1 && heldList[0].no === 'S042-19' && heldList[0].by === 'Pat Auditor' && heldList[0].note === 'wait for the invoice', 'Pay asks: the held bill is named with who and why');
ALLOCS = [{ against_ref: 'S042-19', amount_minor: 0 }, { against_ref: 'S042-20', amount_minor: 100 }];
ok(f.payHeldBills().length === 0, 'paying only the other bill asks nothing extra (the hold is on a bill that takes nothing)');

console.log(bad ? '\n' + bad + ' FAILED' : '\nall ok');
process.exit(bad ? 1 : 0);
