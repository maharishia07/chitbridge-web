/**
 * tests/cur1b-stored-money-web.test.cjs - CUR-1b: an OLD record in a withdrawn code (BGN HRK CUC SLL ZWL) still shows on the web: cbSumByCurrency (the select bar
 * and folder totals), moneyRead (minor and major), cbCurrency, and the conversion lab's readers; NEW money in the same code is still refused.
 * Run: node tests/cur1b-stored-money-web.test.cjs (no browser; the functions are lifted from public/app/helpers.js and public/app.html by name).
 * Break case: on money v1.89.0 (no read list) moneyRead on a BGN minor amount returns unreadable and cbCurrency throws, so the checks fail.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
function lift(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'no function ' + name);
  const open = src.indexOf('{', src.indexOf(')', start));
  let depth = 0, i = open;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return src.slice(start, i + 1);
}
const cx = vm.createContext({});
cx.window = cx; cx.self = cx;
vm.runInContext(read('engine/money.js'), cx);
const helpers = read('app/helpers.js'), app = read('app.html');
vm.runInContext(['moneyCode', 'isoCodeOf', 'moneyRead', 'moneyReadMajor', 'moneyReadMinor', 'moneyCellRead', 'cbSumByCurrency'].map((n) => lift(helpers, n)).join('\n') + '\n' + lift(app, 'cbCurrency'), cx);
let n = 0;
const ok = (body, what) => { body(); n++; console.log('  ok  ' + what); };

['BGN', 'HRK', 'CUC', 'SLL', 'ZWL'].forEach((code) => {
  ok(() => {
    const rows = [{ amt: { amount: 10, currency: code } }, { amt: { amount_minor: '550', currency: code } }];
    assert.strictEqual(JSON.stringify(cx.cbSumByCurrency(rows, 'amt')), JSON.stringify([{ currency: code, total: 15.5 }]), 'the old total is kept');
    assert.strictEqual(cx.moneyRead({ amount_minor: '1234', currency: code }).amount, 12.34);
    assert.strictEqual(cx.cbCurrency({ amount: 3, currency: code }), code);
    assert.throws(() => cx.CBMoney.make(3, code), (e) => e.code === 'MONEY_CURRENCY_UNKNOWN' && e.withdrawn === true);
  }, code + ': an old record sums, reads and shows; new money in it is refused');
});
ok(() => ['conversion-lab.html'].forEach((f) => { const s = read(f); assert.ok(/CBMoney\.currencyOf\(d\.price, \{ stored: true \}\)/.test(s) && /CBMoney\.amountOf\(m, \{ stored: true \}\)/.test(s)); }), 'the conversion lab reads stored prices through the opt-in');
console.log('\n  ' + n + ' checks\n');
