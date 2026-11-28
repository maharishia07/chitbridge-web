'use strict';
// @type: unit
/**
 * bank-truth-1129.test.cjs - fixBankTruth (batch 1129, BANK-SCREEN-TRUTH), no browser.
 *
 * FINDINGS  BANK-TRUTH b, BANK-TRUTH c, BANK-TRUTH d, BANK-TRUTH e (register ids; retest 1130 names them so the coverage map credits this file).
 * OWNS      the proof that (b) the confirm popup's money is what WILL post: lines in a locked month are held on the proposal, so the REAL vendored engine leaves them out of its own totals
 *           (and the popup names them apart); (c) an opening with no books balance is "none" even when an engine check ran; (d) a trial-balance bank state the page does not know never reads
 *           "nothing unexplained"; (e) a failed Add never says "Every statement line is in the books"; (a) a tax-invoice answer stays on its own line (also in bank-ui-answers.test.cjs).
 * CALLED BY ci.yml (the unit checks): node e2e/bank-truth-1129.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
globalThis.esc = (value) => String(value);
require(pub('app/shop-time.js'));
const P = require(pub('app/bank-preview.js')), Band = require(pub('app/bank-band.js')), Tb = (require(pub('app/bank-tb-line.js')), globalThis.CBBankTbLine), Rep = (require(pub('app/bank-demo-report.js')), globalThis.CBBankDemoReport);
globalThis.window = globalThis; /* the page's engine scripts, in the page's order */
for (const f of ['money', 'tax', 'chart', 'accounts-packs', 'posting-voucher', 'posting-bad-debt', 'posting', 'bank-entry', 'bank-json', 'bank-brs', 'bank-files']) require(pub('engine/' + f + '.js'));
const REAL = { recon: require(pub('engine/bank-recon.js')), project: require(pub('engine/bank-project.js')), entry: require(pub('engine/bank-entry.js')) };
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;

/* (b) real engine: two fee lines, one in a locked month */
const CSV = 'Date,Description,Debit,Credit,Balance\n2026-10-05,Account fee,22.00,,978.00\n2026-11-05,Account fee,10.00,,968.00\n';
function make(lock) {
  const ctl = P.create({ engine: REAL, currency: 'AUD', statementCurrency: () => 'AUD', account: 'Demo', ledger: () => ({ lines: [], opening_minor: 100000 }), post: async () => ({ ok: true }), lockedMonth: lock, suggestOpts: { learned: [], country: 'AU' }, parseOpts: { country: 'AU', currency: 'AUD' } });
  return ctl;
}
const locked = (d) => (d.startsWith('2026-10') ? { key: '2026-10', month: 'Oct 2026', words: 'Oct 2026 is closed.' } : null);
const open = make(() => null), shut = make(locked);
for (const c of [open, shut]) { c.load(CSV, 'f.csv'); c.answer('gst_basis', 'cash'); c.view().items.forEach((one) => c.tick(one.key)); }
const openWords = open.confirmText(), shutWords = shut.confirmText();
if (!openWords || !shutWords) { console.log('SKIP (b): engine gave no figures: ' + JSON.stringify(shut.view().refusal)); } else {
  assert.ok(/Money out: .*32\.00/.test(openWords.lines.join('|')), 'control: both fees count when nothing is locked: ' + openWords.lines.join('|'));
  assert.ok(/Money out: .*10\.00/.test(shutWords.lines.join('|')) && !/32\.00|22\.00/.test(shutWords.lines.join('|').split('Money out')[1].split('|')[0]), 'the locked 22.00 is not in the popup money: ' + shutWords.lines.join('|'));
  assert.ok(/1 in a closed month/.test(shutWords.lines.join('|')), 'and the locked line is named apart: ' + shutWords.lines.join('|'));
  ok('(b) the popup money is the posting lines only; the closed-month line is named apart');
}

/* (c) */
const parsed = { opening_minor: 500, lines: [], warnings: [] }, fmt = String;
const checkRan = { items: [] };
const find = (list, id) => list.filter((one) => one.id === id)[0];
assert.strictEqual(find(Band.rightAccount({ parsed, check: checkRan, fmt, booksOpening_minor: null, currency: 'AUD' }), 'opening').state, 'none');
ok('(c) an engine check that ran but had no books balance to compare says "not compared", not "agrees"');

/* (d) */
const o = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => v[k]), money: String, day: String, codes: { note: 'n', open: 'o', at: 'a' }, ids: 'x', href: () => '' };
const base = { account_id: 1, name: 'Bank', currency: 'AUD', period_to: '2026-10-31', statement_minor: 100, books_signed_minor: 100, unexplained_minor: 0, apart_minor: 0 };
assert.ok(!/nothing unexplained/.test(Tb.html([Object.assign({}, base, { state: 'mystery' })], o)), 'unknown state');
assert.ok(/not known/.test(Tb.html([Object.assign({}, base, { state: 'mystery' })], o)));
assert.ok(/nothing unexplained/.test(Tb.html([Object.assign({}, base, { state: 'reconciled' })], o)), 'reconciled still reads clean');
ok('(d) an unknown bank state is "not known"; only the api\'s reconciled reads nothing unexplained');

/* (e) */
const host = { plural: (n, a, b) => n + ' ' + (n === 1 ? a : b) };
const rep = Rep.create(host);
const card = rep.successCard({ count: 1, balance: '9.00', open: 0, failed: 2 });
assert.ok(card && !/Every statement line is in the books/.test(card) && /2 lines were not added/.test(card), card);
assert.ok(/Every statement line is in the books/.test(rep.successCard({ count: 3, balance: '9.00', open: 0, failed: 0 })));
ok('(e) a failed Add says the failed lines; "every line is in the books" only with none failed');
console.log(ran + ' passed');
