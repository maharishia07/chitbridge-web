/* tests/acct-c-f01-lock-income.test.cjs — Walk C C-F-01 (21 Nov): the Month lock column reads income before tax.
 * HAND-COMPUTED  August 2026 holds Rent 550.00 and bank fees 12.50 and no sales: the P&L's profit is -562.50 = -56250 minor, so the column reads -A$562.50, not "No income".
 * OWNS the offline guard of bkLockSalesWord in public/app/cap-books-lock.js.   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-books-lock.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const ctx = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), esc: (s) => String(s), bkMoney: (m) => (m < 0 ? '-' : '') + 'A$' + (Math.abs(m) / 100).toFixed(2) };
vm.createContext(ctx);
vm.runInContext(pick('bkLockSalesWord') + pick('bkLockConfirm') + ';this.word=bkLockSalesWord;this.ask=bkLockConfirm;', ctx);
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ok   ' + name); };

ok('C-F-01: a loss month (no sales, profit -56250) reads its loss', () => {
  assert.strictEqual(ctx.word({ sales_minor: 0, profit_minor: -56250 }), '-A$562.50');
});
ok('C-F-01: a profit month reads its profit, not its sales', () => {
  assert.strictEqual(ctx.word({ sales_minor: 100000, profit_minor: 40000 }), 'A$400.00');
});
ok('C-F-01: a seat that reads no figures still gets a dash; an older api (no profit) keeps the old words', () => {
  assert.strictEqual(ctx.word({}), '—');
  assert.strictEqual(ctx.word({ sales_minor: 0 }), 'No income');
});
console.log(String.fromCharCode(10) + pass + ' passed');
