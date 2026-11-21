/**
 * tests/fin-collect-sides.test.cjs — Walk J J-F-02: Collections said "Nobody owes you money" beside a 1,000 tile. A party on BOTH lists comes with the
 * NETTED figure on the row and each list's own in row.sides.<side>; the tile read sides.customer, the list read the net. Now the list reads sides.customer.
 * Hand figures (minor units): customer half 100000 (1,000.00) less supplier half 100000 -> net 0; customer 100000, supplier 150000 -> net -50000.
 * Pure: finOwes + finCollectRows are cut from public/app/cap-finance.js. Run: node tests/fin-collect-sides.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-finance.js'), 'utf8');
const from = src.indexOf('function finOwes'), to = src.indexOf("/** FIN-15: the server's disputed figure");
assert(from > 0 && to > from, 'the cut points moved');
/* bkDuesSide is cap-books.js's: the stand-in is its own rule (side first, else the sign) */
const sb = { bkDuesSide: (p) => (p.side === 'supplier' ? 'pay' : p.side === 'customer' ? 'rcv' : Number(p.balance_minor) < 0 ? 'pay' : 'rcv') };
vm.createContext(sb);
vm.runInContext(src.slice(from, to) + '\nthis.__t = { finCollectRows };', sb);
const rows = (parties) => sb.__t.finCollectRows(parties);
let pass = 0;
const it = (what, fn) => { try { fn(); pass++; console.log('  ok  ' + what); } catch (e) { console.log('  FAIL ' + what + '\n      ' + e.message); process.exitCode = 1; } };
const both = (net, cust, supp) => ({ party_id: 'p1', side: 'both', balance_minor: net, disputed_minor: 0, sides: { customer: { balance_minor: cust, disputed_minor: 0 }, supplier: { balance_minor: supp, disputed_minor: 0 } } });
it('both-sides, net 0 (1,000 owed to you, 1,000 owed by you): the row shows 1,000.00, not nobody', () => {
  const r = rows([both(0, 100000, 100000)]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].balance_minor, 100000);
  assert.strictEqual(r[0].side, 'customer');
});
it('both-sides, net -500.00 (you owe more): still on Collections with the customer half 1,000.00', () => {
  const r = rows([both(-50000, 100000, 150000)]);
  assert.deepStrictEqual(Array.from(r, (x) => x.balance_minor), [100000]);
});
it('the list total equals the tile: sum of sides.customer over the parties (1,000.00 + 250.00 = 1,250.00)', () => {
  const ps = [both(0, 100000, 100000), { party_id: 'p2', side: 'customer', balance_minor: 25000, disputed_minor: 0 }];
  assert.strictEqual(rows(ps).reduce((t, x) => t + x.balance_minor, 0), 125000);
});
it('a supplier-only party stays off; a both-sides party whose customer half is 0 stays off; a plain customer stays on', () => {
  assert.strictEqual(rows([{ party_id: 's', side: 'supplier', balance_minor: 5000, disputed_minor: 0 }]).length, 0);
  assert.strictEqual(rows([both(-30000, 0, 30000)]).length, 0);
  assert.strictEqual(rows([{ party_id: 'c', side: 'customer', balance_minor: 7000, disputed_minor: 0 }]).length, 1);
});
it('an older reply with no sides falls back to the netted rule (net 40.00 on a both row stays; net 0 does not)', () => {
  assert.strictEqual(rows([{ party_id: 'o', side: 'both', balance_minor: 4000, disputed_minor: 0 }]).length, 1);
  assert.strictEqual(rows([{ party_id: 'o', side: 'both', balance_minor: 0, disputed_minor: 0 }]).length, 0);
});
console.log(pass + ' passed');
