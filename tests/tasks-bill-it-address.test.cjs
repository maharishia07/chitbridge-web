/**
 * tests/tasks-bill-it-address.test.cjs — F-43 (walk 21 Nov): "Bill it" (TSK003-B05 tk_do_bill) on the Tasks & Orders PAGE opened the till with no word of
 * the order, so it came up in the last mode held (Receive) and nothing was billed. It now opens /till.html?bill=<chit_id>; inside the till's own frame it still tells the host.
 * Run: node tests/tasks-bill-it-address.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-tasks.js'), 'utf8');
function fnSource(name) {
  const at = src.indexOf('  function ' + name + '(');
  assert(at >= 0, name + ' is in cap-tasks.js');
  const rest = src.slice(at + 2);
  const end = rest.search(/\n  (?:\/\*\*|function )/);
  return rest.slice(0, end);
}
const sent = [], tellLog = [];
const board = { o: { embed: false } }, root = { location: { href: '' } };
const tell = (e, d) => tellLog.push([e, d]);
eval(fnSource('tkBillAddress') + '\n' + fnSource('tkBill') + '\nglobalThis.tkBill = tkBill; globalThis.tkBillAddress = tkBillAddress;');
assert.strictEqual(tkBillAddress({ chit_id: 'a1b2-c3' }), '/till.html?bill=a1b2-c3', 'the address names the order');
assert.strictEqual(tkBillAddress({ chit_id: 'x y&z' }), '/till.html?bill=x%20y%26z', 'the id is encoded');
assert.strictEqual(tkBillAddress({}), '/till.html', 'no id, no query');
tkBill({ chit_id: 'ord-12345678' });
assert.strictEqual(root.location.href, '/till.html?bill=ord-12345678', 'standalone page goes to the till AT the order');
board.o.embed = true; root.location.href = '';
tkBill({ chit_id: 'ord-12345678', kind: 'order' });
assert.strictEqual(root.location.href, '', 'embedded does not navigate');
assert.strictEqual(tellLog[0][0], 'bill', 'embedded tells the host');
console.log('tasks-bill-it-address: ok');
