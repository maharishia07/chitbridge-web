/**
 * till-walkaa-1129.test.cjs — WALK AA (21 Nov): the web copy of the till carries the slip words of AA-F-02 and AA-F-05.
 * OWNS      the proof on the real public/till.html code (a vendored byte copy of the api master): a line with no rate is its own row beside the zero-rated and standard ones (never inside
 *           "Taxable", never under "reason not stated"), the row's words take the pack's scheme word (VAT in AE, GST in IN), and the credit note's title is the pack's slip.titles.credit_note in each
 *           of slip.langs (Arabic beside English, as on the tax invoice), one English line when the pack has none.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network, no sibling repo. Hand figures: 5% 51.74 · zero-rated 130.00 · no rate 50.00.
 *   node e2e/till-walkaa-1129.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');

function till(pack, scheme) {
  const sandbox = { shopPack: () => pack, schemeWord: () => scheme, rmoney: (x) => Math.round(x * 100) / 100, esc: (x) => String(x), cbQuiet() {}, creditNoteTitle: () => 'CREDIT NOTE' };
  vm.createContext(sandbox);
  vm.runInContext(liftFns('public/till.html', ['noRateWord', 'unratedBaseOf', 'unratedApart', 'creditNoteTitleLines', 'slipTitleHTML']) + '\nthis.f = { noRateWord, unratedBaseOf, unratedApart, creditNoteTitleLines, slipTitleHTML };', sandbox);
  return sandbox.f;
}
let bad = 0;
const ok = (m, c, info) => { console.log((c ? '  ok   ' : '  FAIL ') + m + (c || !info ? '' : ' -> ' + info)); if (!c) bad++; };

const ae = till(null, 'VAT');
const invoice = { ItemList: [{ AssAmt: 51.74 }, { AssAmt: 130 }, { AssAmt: 50, _unrated: true }] };
const classes = [{ kind: 'standard', rate: 0, taxable: 50 }, { kind: 'zero_rated', rate: 0, taxable: 130 }, { kind: 'standard', rate: 5, taxable: 51.74, tax: 2.59 }];
ok('the unrated base is the flagged lines only (50.00)', ae.unratedBaseOf(invoice) === 50, String(ae.unratedBaseOf(invoice)));
const apart = ae.unratedApart(classes, 50).map((w) => w.kind + ':' + w.rate + ':' + w.taxable);
ok('the unrated 50.00 leaves the unnamed 0% class (emptied, so dropped) and stands as its own row', JSON.stringify(apart) === JSON.stringify(['zero_rated:0:130', 'standard:5:51.74', 'unrated:0:50']), JSON.stringify(apart));
const mixed = ae.unratedApart([{ kind: 'standard', rate: 0, taxable: 70 }], 50).map((w) => w.kind + ':' + w.taxable);
ok('an explicit 0% beside it keeps its own 20.00', JSON.stringify(mixed) === JSON.stringify(['standard:20', 'unrated:50']), JSON.stringify(mixed));
ok('the row word takes the pack scheme word: VAT in AE, GST in IN', ae.noRateWord() === 'No VAT rate set' && till(null, 'GST').noRateWord() === 'No GST rate set');

const pack = { slip: { langs: ['ar', 'en'], titles: { credit_note: { ar: '\u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646', en: 'Tax Credit Note' } } } };
const both = till(pack, 'VAT').creditNoteTitleLines();
ok('the credit note title is Arabic then English from the pack', both.length === 2 && both[0].lang === 'ar' && both[1].text === 'TAX CREDIT NOTE', JSON.stringify(both));
ok('a pack with no credit_note title prints the one English line', JSON.stringify(till({ slip: { langs: ['en'], titles: {} } }, 'GST').creditNoteTitleLines()) === JSON.stringify([{ lang: 'en', text: 'CREDIT NOTE' }]));
if (bad) { console.log('\n' + bad + ' failed'); process.exit(1); }
console.log('\nall ok');
