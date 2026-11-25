/**
 * tests/till-slip.test.cjs — THE VENDORED SLIP (public/app/till-slip.js) draws a slip with no browser: each named step, then the whole of it.
 *
 * OWNS      the web-side proof that the vendored till part loads as a classic script and renders (header · who · lines · count · tax block · tender · footer).
 *           The byte-for-byte golden table over India / Australia / the Emirates / Japan lives with the master, in the api (tests/till-slip-read-1129.test.cjs).
 * CALLED BY by hand: node tests/till-slip.test.cjs
 * FLOW      read public/app/till-slip.js ──▶ run it in a vm with plain stand-ins for the page's helpers ──▶ render one bill ──▶ assert each step is on the paper
 * CARD      09-counter/bill-slip
 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const SLIP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'till-slip.js'), 'utf8');

/** the page's helpers, as plain stand-ins: the slip reads them at call time */
function slipPage() {
  const ctx = {
    Number, String, Math, Object, Array,
    S: { shop: { name: 'Test Shop', address: '1 Main St', gstin: '29AAAAA0000A1Z5', slip_footer: 'Thanks' } },
    esc: (x) => String(x), money: (x) => 'M' + Number(x).toFixed(2), counterName: () => 'Counter 1', atShop: () => '17 Oct 10:00 am',
    shopPack: () => null, taxIdLabel: () => 'GSTIN', schemeWord: () => 'GST', invoiceRule: () => null, buyerFromMajor: () => 0, posWords: (c) => c,
    unratedOnBill: () => [], bandWordsOf: () => '', billOrderRow: () => '', billSendTo: () => null, slipCheckedHTML: () => '', modWordsPlain: (m) => m.join(', '),
    cartCount: (lines) => ({ items: lines.length, measured: {} }), taxSummaryHTML: (bill, row) => row('GST', '5.00'), rewardOnSlip: () => '',
  };
  vm.createContext(ctx);
  vm.runInContext(SLIP + '\nthis.__slip = { slipHTML, slipRowHTML, slipWhoRowsHTML, slipLinesHTML, slipTenderHTML, slipCountBlockHTML, slipOffersOf };', ctx);
  return ctx.__slip;
}

const bill = { no: 'C1-0001', at: '2026-10-17T04:30:00Z', kind: 'cash', total: 105, tax: 0, saved: 0, payments: [{ how: 'Cash', amount: 110 }], change: 5, customer: { name: 'Ravi' },
  lines: [{ name: 'Rice', qty: 1, unit: 'pc', price: 105, gross: 105, net: 105, offers: [] }] };
let count = 0;
const ok = (what, fn) => { fn(); count++; console.log('  ok  ' + what); };

const page = slipPage();
ok('the whole slip carries the head, the number, the line, the count, the total, the tender, the change and the shop footer', () => {
  const html = page.slipHTML(bill, {});
  ['Test Shop', 'No C1-0001', 'Ravi', 'Rice', 'Products', 'TOTAL', 'Cash', 'Change', 'Thanks'].forEach((word) => assert.ok(html.includes(word), 'missing ' + word));
  assert.ok(html.indexOf('Rice') < html.indexOf('TOTAL') && html.indexOf('TOTAL') < html.indexOf('Change') && html.indexOf('Change') < html.indexOf('Thanks'), 'the steps print in order');
});
ok('a row says its label and value; the big one is the bold total', () => {
  assert.match(page.slipRowHTML('a', 'b'), /<span>a<\/span><span>b<\/span>/);
  assert.match(page.slipRowHTML('TOTAL', 'x', true), /font-weight:700/);
});
ok('an offer on a line prints its Gross row and its named scheme', () => {
  const html = page.slipLinesHTML({ kind: 'cash', lines: [{ name: 'Dal', qty: 1, unit: 'pc', price: 90, gross: 100, net: 90, offers: [{ label: 'Diwali', off: 10 }] }] });
  assert.ok(html.includes('Gross') && html.includes('Diwali') && html.includes('−M10.00'));
});
console.log('\n' + count + ' passed');
