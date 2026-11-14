/**
 * tests/till-money-helpers.test.cjs - CUR-1b: the till's money helpers (booksMajor, shopMinor, priceToGrain, cashDue) lifted out of public/till.html
 * and run with the adopted public/engine/money.js, no browser: a 0-decimal shop (JPY), HUF (2 decimals, cash to the whole
 * forint through a step of 100 minor), cash rounding, and a shop whose own currency is a WITHDRAWN code (BGN) - which must read, not throw.
 * An unlisted shop currency (ZZZ) is refused at setup by the api; the till would throw there, and the test says so.
 * Break case: on money v1.89.0 (no read list) the BGN shop throws on its first helper call, so the withdrawn check fails.
 * MIN unit-test (no browser). Run: node tests/till-money-helpers.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'till.html'), 'utf8');

/* the source of `function name(...) { ... }` by brace matching (the till is one big inline script) */
function lift(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'till.html has no function ' + name);
  const open = html.indexOf('{', html.indexOf(')', start));
  let depth = 0, i = open;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return html.slice(start, i + 1);
}

function till(currency, cashRounding) {
  const cx = vm.createContext({});
  cx.window = cx; cx.self = cx;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'engine', 'money.js'), 'utf8'), cx);
  cx.S = { shop: { currency, country: 'XX', pay: [] } };
  cx.shopPack = () => (cashRounding ? { cashRounding } : null);
  const src = ['MONEY', 'shopCur', 'booksMajor', 'shopMinor', 'priceToGrain', 'cashRule', 'payWayId', 'cashDue'].map(lift).join('\n')
    + '\nvar r2 = function(n){ return MONEY().round(Number(n) || 0); };';
  vm.runInContext(src, cx);
  return cx;
}

let n = 0;
const ok = (body, what) => { body(); n++; console.log('  ok  ' + what); };

ok(() => {
  const t = till('JPY', { step_minor: 10, tender: 'cash' });
  assert.strictEqual(t.shopMinor(1234), 1234);
  assert.strictEqual(t.booksMajor(1234), 1234);
  assert.strictEqual(t.priceToGrain(12.5), 13, 'a computed price rounds to whole yen, half away from zero');
  assert.strictEqual(t.cashDue(1234, 'cash'), 1230);
  assert.strictEqual(t.cashDue(1235, 'cash'), 1240, 'a half step goes up');
  assert.strictEqual(t.cashDue(1234, 'card'), 1234, 'a card pays the exact amount');
}, 'a 0-decimal shop (JPY): minor units equal major, prices round to the yen, cash rounds to the pack step');
ok(() => {
  const t = till('HUF', { step_minor: 100, tender: 'cash' });
  assert.strictEqual(t.shopMinor(1234.5), 123450, 'HUF is 2 decimals (ISO 4217), as decided 11 Nov');
  assert.strictEqual(t.cashDue(1234.4, 'cash'), 1234, 'cash rounds to the whole forint');
  assert.strictEqual(t.cashDue(1234.5, 'cash'), 1235);
}, 'HUF (2 decimals) with cash rounding to the whole forint');
ok(() => {
  const t = till('BGN', null);
  assert.strictEqual(t.booksMajor(1234), 12.34);
  assert.strictEqual(t.shopMinor(12.34), 1234);
  assert.strictEqual(t.priceToGrain(1.005), 1.01);
}, 'a shop whose own currency is a WITHDRAWN code (BGN) still reads: the till does not throw');
ok(() => {
  const t = till('ZZZ', null);
  assert.throws(() => t.booksMajor(1234), (e) => e.code === 'MONEY_CURRENCY_UNKNOWN' && e.status === 422);
}, 'an unlisted shop currency throws (the api refuses it at setup, so no shop reaches the till with one)');
console.log('\n  ' + n + ' checks\n');
