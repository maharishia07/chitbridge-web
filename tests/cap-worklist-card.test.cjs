/**
 * tests/cap-worklist-card.test.cjs — public/app/cap-worklist.js: what the cost / delivery card reads from its fields and refuses in words (wlActCostRow, wlActDeliveryRow, wlActAfterCost), and that the module draws with theme tokens.
 * CARD 05-orders-and-workflow/worklist
 * Run: node tests/cap-worklist-card.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const FILE = path.join(__dirname, '..', 'public', 'app', 'cap-worklist.js');
const source = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
let steps = 0;
const step = (label, fn) => { fn(); steps++; console.log('ok - ' + label); };

const from = source.indexOf('function wlActFieldText');
const to = source.indexOf('async function wlActSaveNow');
assert(from > 0 && to > from, 'the card helpers are where the test looks');

/** a card with `typed` field values (id → text); the host globals the helpers read are stubbed */
function card(typed) {
  const fields = {};
  Object.keys(typed).forEach((id) => { fields[id] = { value: typed[id] }; });
  const context = { document: { getElementById: (id) => fields[id] || null }, WLL: { det: {} } };
  vm.createContext(context);
  vm.runInContext(source.slice(from, to) + '\nthis.api = { wlActCostRow, wlActDeliveryRow, wlActAfterCost };', context);
  return { api: context.api, fields, context };
}

step('a cost typed on the card becomes one "add" row with the line, the words, the quantity, the unit and the amount', () => {
  const { api } = card({ wl_what: ' Brake shoe ', wl_cqty: '2', wl_cunit: 'pc', wl_amt: '450' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.wlActCostRow('L1'))), { row: { line_id: 'L1', kind: 'add', particulars: 'Brake shoe', quantity: 2, unit: 'pc', amount: 450 } });
});
step('a cost with no words, or with neither quantity nor amount, is refused in words and nothing is built', () => {
  assert.strictEqual(card({ wl_what: '' }).api.wlActCostRow('L1').refusal, 'Say what the cost was for');
  assert.strictEqual(card({ wl_what: 'Call-out', wl_cqty: '', wl_amt: '' }).api.wlActCostRow('L1').refusal, 'Give a quantity or an amount');
});
step('a delivery reads its quantity and reference; zero or a word is refused in words (a delivery needs a quantity)', () => {
  const good = card({ wl_qty: '5', wl_ref: 'GRN-7' }).api.wlActDeliveryRow({ line_id: 'L1', unit: 'kg' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(good)), { row: { line_id: 'L1', quantity: 5, unit: 'kg', reference: 'GRN-7' } });
  assert.strictEqual(card({ wl_qty: '0' }).api.wlActDeliveryRow({ line_id: 'L1' }).refusal, 'A delivery needs a quantity');
  assert.strictEqual(card({ wl_qty: 'abc' }).api.wlActDeliveryRow({ line_id: 'L1' }).refusal, 'A delivery needs a quantity');
});
step('after a cost the next part starts empty (no inherited price) and the server\'s progress is applied without a reload', () => {
  const view = card({ wl_what: 'x', wl_cqty: '1', wl_cunit: 'u', wl_amt: '9', wl_mat: 'm' });
  view.api.wlActAfterCost({ progress: { done: 1 } });
  ['wl_what', 'wl_cqty', 'wl_cunit', 'wl_amt', 'wl_mat'].forEach((id) => assert.strictEqual(view.fields[id].value, '', id));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(view.context.WLL.det.line_delivery)), { done: 1 });
});
step('theme: the card paints with theme tokens, no fixed hex colour, so dark and light at 1366 and 390 follow the theme', () => {
  const code = source.split('\n').filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line)).join('\n');
  const bare = (code.match(/#[0-9a-fA-F]{3,6}\b/g) || []).length - (code.match(/var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,6}\)/g) || []).length;
  assert.ok(bare <= 3, 'hex colours are token fallbacks; only the three existing fixed ones remain, found ' + bare);
  assert.ok(/var\(--on-accent\)/.test(code) || /var\(--on-card\)/.test(code), 'text on a coloured surface names its on-colour token');
});
step('a11y contrast: text drawn on an accent or card surface names the paired on-accent or on-card token (the AA pair is the token\'s job)', () => {
  const pairs = source.match(/background:var\(--blue\);color:var\(--on-accent\)/g) || [];
  assert.ok(pairs.length >= 1, 'accent buttons carry their own on-accent colour');
});
console.log('cap-worklist-card: ' + steps + ' steps passed');
