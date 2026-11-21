'use strict';
/**
 * tests/accfix-1121-debitnote.test.cjs — F-10: a debit note's reasons read in words, and "Which bill" lists the supplier's open bills (the pay popup's read).
 * OWNS    the F-10 proof        CALLED BY npm test        CARD    books/entry
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-entry.js'), 'utf8');
const grab = (head, end) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf(end, i)); };
const ctx = {
  tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), EN: { bills: { P1: [{ against_ref: 'ref-1', bill_no: 'INV-7', open_minor: 3403050 }] }, picks: {} },
  BK: {}, EN_MODE: {}, bkBillNo: (n, r) => n || r, bkMoney: (m) => 'A$' + (m / 100).toFixed(2), bkCur: () => 'AUD'
};
vm.createContext(ctx);
vm.runInContext(grab('var EN_REASON', '\n};') + '};\n' + grab('function enOptions(', '\n}\n') + '\n}\n' + grab('function enBillOptions(', '\n}\n') + '\n}', ctx);
const opts = vm.runInContext("enOptions({ key: 'reason', kind: 'pick', pick: 'debit_reason', options: ['rate', 'returned', 'other'] }).map(function (o) { return o.l; })", ctx);
assert.strictEqual(opts.join('|'), 'Rate difference|Goods returned|Other difference');
assert.strictEqual(JSON.stringify(vm.runInContext("enBillOptions('P1')", ctx)), JSON.stringify([{ v: 'ref-1', l: 'INV-7 · A$34030.50 open' }]));
assert.strictEqual(vm.runInContext("enBillOptions('P2')", ctx), null);
assert.ok(/f\.key === 'against_ref' && f\.kind === 'text'/.test(src), 'the field is a list when bills are known');
console.log('accfix-1121-debitnote: 4 ok');
