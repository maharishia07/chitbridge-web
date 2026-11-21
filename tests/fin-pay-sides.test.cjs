/**
 * tests/fin-pay-sides.test.cjs — J-F-02, supplier side: a party on BOTH lists comes with the NETTED figure and each list's own in row.sides.<side>.
 * The Payables list (bkDuesRows('pay')) must show sides.supplier, matching the Payables tile; Receivables sides.customer.
 * Hand figures (minor units): customer 100000 (1,000.00), supplier 200000 (2,000.00) -> net -100000; customer 200000, supplier 200000 -> net 0.
 * Pure: bkSideHalf + bkDuesRows are cut from public/app/cap-books.js. Run: node tests/fin-pay-sides.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-books.js'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert(i > 0 && j > i, 'cut points moved: ' + a); return src.slice(i, j); };
const code = cut('function bkSideHalf', '/** a supplier the shop has paid ahead') + cut('function bkDuesAdvance', '/** the bills a party') + cut('function bkDuesRows', '/** ⚑ Needs you for the Dues list');
const sb = { BK: { duesRaw: { parties: [] } } };
vm.createContext(sb);
vm.runInContext(code + '\nthis.__t = { bkDuesRows, bkSideHalf };', sb);
const rows = (parties, side) => { sb.BK.duesRaw = { parties }; return Array.from(sb.__t.bkDuesRows(side)); };
let pass = 0;
const it = (what, fn) => { try { fn(); pass++; console.log('  ok  ' + what); } catch (e) { console.log('  FAIL ' + what + '\n      ' + e.message); process.exitCode = 1; } };
const both = (net, cust, supp) => ({ party_id: 'p1', side: 'both', balance_minor: net, disputed_minor: 0, sides: { customer: { balance_minor: cust, disputed_minor: 0 }, supplier: { balance_minor: supp, disputed_minor: 0 } } });
it('both-sides, net 0, supplier half 2,000.00: Payables shows 200000 (2,000.00)', () => {
  const r = rows([both(0, 200000, -200000)], 'pay');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(Math.abs(r[0].balance_minor), 200000);
  assert.strictEqual(r[0].side, 'supplier');
});
it('the same party on Receivables shows its customer half 2,000.00', () => {
  const r = rows([both(0, 200000, -200000)], 'rcv');
  assert.deepStrictEqual(Array.from(r, (x) => x.balance_minor), [200000]);
});
it('both-sides with net positive (customer 3,000 less supplier 1,000): Payables still lists the 1,000.00 owed', () => {
  const r = rows([both(200000, 300000, -100000)], 'pay');
  assert.deepStrictEqual(Array.from(r, (x) => Math.abs(x.balance_minor)), [100000]);
});
it('a party with a zero supplier half stays off Payables; plain customer stays off Payables', () => {
  assert.strictEqual(rows([both(5000, 5000, 0)], 'pay').length, 0);
  assert.strictEqual(rows([{ party_id: 'c', side: 'customer', balance_minor: 7000 }], 'pay').length, 0);
});
it('no side asked, or an older reply with no sides: the row is as the server sent it', () => {
  assert.strictEqual(rows([both(0, 200000, -200000)], null).length, 0);
  assert.strictEqual(rows([{ party_id: 'o', side: 'both', balance_minor: -4000 }], 'pay').length, 1);
});
console.log(pass + ' passed');
