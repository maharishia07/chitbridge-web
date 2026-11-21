'use strict';
/**
 * tests/accfix-1121-payleft.test.cjs — F-20: a part payment says what it leaves open, not "settles 1 bill".
 * OWNS    the F-20 proof        CALLED BY npm test        CARD    books/pay
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-books.js'), 'utf8');
const i = src.indexOf('function payAllocWords('); assert.ok(i >= 0);
const ctx = { bkMoney: (m) => 'A$' + (m / 100).toFixed(2), txn: (o, p, n, v) => (n === 1 ? o : p).replace(/\{(\w+)\}/g, (_, k) => (k === 'count' ? n : v[k])) };
vm.createContext(ctx); vm.runInContext(src.slice(i, src.indexOf('\n}\n', i) + 3), ctx);
const w = (list) => vm.runInContext('payAllocWords(' + JSON.stringify(list) + ',' + list.reduce((t, x) => t + x.amount_minor, 0) + ',' + list.length + ')', ctx);
assert.strictEqual(w([{ amount_minor: 100000, open_minor: 3403050 }]), 'A$1000.00 part-pays 1 bill, A$33030.50 still open');
assert.strictEqual(w([{ amount_minor: 5000, open_minor: 5000 }]), 'A$50.00 settles 1 bill');
assert.strictEqual(w([{ amount_minor: 5000, open_minor: 5000 }, { amount_minor: 100, open_minor: 400 }]), 'A$51.00 part-pays 2 bills, A$3.00 still open');
console.log('accfix-1121-payleft: 3 ok');
