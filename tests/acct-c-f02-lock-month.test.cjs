/* tests/acct-c-f02-lock-month.test.cjs — Walk C C-F-02 (21 Nov): the lock question names the month with its own year.
 * HAND-COMPUTED  July 2026 of the financial year 2026-27 is asked as "Lock Jul 2026?" (never "Lock Jul 2026-27?").
 * OWNS the offline guard of bkLockConfirm and bkLockDo's year in public/app/cap-books-lock.js.   CARD 14-accounting */
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
ok('C-F-02: the lock question names the month and its calendar year', () => {
  assert.strictEqual(ctx.ask('lock', 'Jul', '2026').title, 'Lock Jul 2026?');
});
const doText = pick('bkLockDo');
ok('C-F-02: bkLockDo passes the calendar year (the month\'s start date), not the financial-year key, to the question', () => {
  assert.ok(/bkLockConfirm\(what, monthName, calendarYear\)/.test(doText) && /start_date/.test(doText));
  assert.ok(!/bkLockConfirm\(what, monthName, fiscalYear\)/.test(doText));
});
console.log('\n' + pass + ' passed');console.log(String.fromCharCode(10) + pass + ' passed');
