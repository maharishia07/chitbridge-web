/* tests/ba-statement-items.test.cjs — WALK BA BA-F-07 (web half): the sign-off body carries the net of the listed items (exceptions_minor = computed bank balance less book balance),
 * so the api can add the figures up itself (bank = books + items + difference) and decide "tied". Hand figures (paise): books 111,111; one unpresented cheque 50,000 and one bank credit
 * not in the books 100,000 -> computed 111,111 + 50,000 + 100,000 = 261,111, bank 261,111, items 150,000, difference 0. Runs the real bankStoreBody in a vm. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank-store.js'), 'utf8');
const start = src.indexOf('function bankStoreBody()');
const end = src.indexOf('\n}\n', start) + 3;
assert.ok(start > 0 && end > start, 'bankStoreBody not found');
const brs = { book_balance_minor: 111111, computed_bank_minor: 261111, bank_balance_minor: 261111, difference_minor: 0 };
const ctx = { bankStoreState: { view: { brs, ledgerRaw: { opening_minor: 0, currency: 'inr' }, acct: '1510', from: '2026-04-01', to: '2026-04-30', file: { hash: 'h' } } }, bkCur: () => 'INR' };
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + '\nthis.__b = bankStoreBody();', ctx);
const b = ctx.__b;
assert.strictEqual(b.exceptions_minor, 150000); console.log('  ok  the body carries the listed items net: 150000');
assert.strictEqual(b.closing_bank_minor - b.closing_books_minor - b.exceptions_minor, b.difference_minor); console.log('  ok  bank - books - items = difference (the sum the api checks)');
console.log('2 ok');
