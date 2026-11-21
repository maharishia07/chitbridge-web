'use strict';
/**
 * tests/accfix-1121-staffledger.test.cjs — F-27: Staff advance's "Which staff ledger" carries the inline door to add one (under the advances group), like the savings-account door.
 * OWNS    the F-27 proof        CALLED BY npm test        CARD    books/entry
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-entry.js'), 'utf8');
const cut = (head, end) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf(end, i)); };
const calls = [];
const ctx = {
  tx: (s) => s, esc: (s) => String(s), EN: { addOwn: null, v: {}, accounts: [{ code: '1700', is_group: true, tally_group: 'advances' }, { code: '1400', is_group: true, tally_group: 'bank_accounts' }] },
  enSelect: () => '<select></select>', enOwnOptions: () => [], enPaint() {}, bkWhy: () => 'x',
  api: async (name, o) => { calls.push([name, o && o.body]); return name === 'booksAccountAdd' ? { account: { code: '1710' } } : { accounts: [] }; }
};
vm.createContext(ctx);
vm.runInContext(cut('var EN_DOOR', '/** Move money:') + cut('function enOwnField(', '/** add the account') + cut('async function enOwnAdd(', '/** F-10'), ctx);
assert.strictEqual(vm.runInContext('enStaffParent()', ctx), '1700');
const html = vm.runInContext("enOwnField('ledger', 'Which staff ledger', 'en-f-ledger', '', 'x', '<select>L</select>')", ctx);
assert.ok(/Add a staff ledger/.test(html) && /<select>L<\/select>/.test(html), 'door beside the list');
assert.ok(!/savings/i.test(html), 'staff words, not savings');
ctx.EN.addOwnName = 'Ravi';
(async () => {
  await vm.runInContext("enOwnAdd('ledger')", ctx);
  assert.strictEqual(calls[0][1].parent_code, '1700');
  assert.strictEqual(ctx.EN.v.ledger, '1710');
  console.log('accfix-1121-staffledger: 5 ok');
})();
