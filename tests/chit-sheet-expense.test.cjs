/**
 * tests/chit-sheet-expense.test.cjs — FW-29: an EXPENSE chit (the server's `doc: 'expense'`) is a record the books took at send. It has no lines by design,
 * so the sheet shows what business_json.expense holds (what · who is owed · how paid · its GST · the amount as the Total), names the supplier (not our own shop),
 * and Accept is SHOWN greyed with the server's sentence (actions.accept already_booked) — never live, never "Total not recorded".
 * Run: node tests/chit-sheet-expense.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
globalThis.counterOfBill = () => '';
globalThis.counterWord = () => '';
globalThis.chitIsSelf = (en) => en === 'me';
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'helpers.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'chit-sheet.js'), 'utf8'));
const S = globalThis.CBSheet;
const SAID = 'This expense is already in your books. There is nothing to accept.';
/* the shape sit-au served for bill S068-22 (self-sent expense task, no lines, summary_json.total_value null) */
const read = () => ({
  doc: 'expense',
  actions: { accept: { ok: false, why: 'already_booked', say: SAID }, dispute: { ok: true } },
  header: { chit_id: 'e1', purpose: 'expense', current_status: 'pending', created_at: '2026-11-15T16:09:21Z', sender_entity_display_name: 'Moonee Espresso - demo', manual_subject: 'S068-22',
    all_recipients: [{ role: 'sender', display_name: 'Moonee Espresso - demo', entity_id: 'me' }, { role: 'receiver', display_name: 'Moonee Espresso - demo', entity_id: 'me' }],
    summary_json: { purpose: 'expense', total_value: null, currency_code: 'AUD', line_item_count: 0 },
    business_json: { bill_no: 'S068-22', billed_at: '2026-10-18T01:30:00.000Z', expense: { mode: 'On credit', what: 'Coffee, milk and food, October', class: 'sundry_expense', amount: 34030.5, supplier: 'sup-1', input_tax: { gst: 3093.68 } } } },
  detail: { line_items: [] }
});
const m = S.model(read());
assert.strictEqual(m.expenseDoc, true, 'the server says it is an expense');
assert(m.expense && m.expense.supplier === 'sup-1', 'the expense block is read');
assert.strictEqual(m.money.total, 34030.5, 'the Total is the amount the expense was booked with, not "not recorded"');
assert.notStrictEqual(m.who, 'Moonee Espresso - demo', 'the party is not our own shop');
assert.strictEqual(S.titleFor(m), 'Expense');
assert(S.actionsFor(m).includes('accept'), 'Accept is listed (greyed by the server answer), never silently hidden');

let acts = '', body = '';
const dlg = { open: false, parentNode: null, classList: { toggle() {}, add() {}, remove() {} }, close() { this.open = false; }, showModal() { this.open = true; }, show() { this.open = true; }, setAttribute() {}, removeAttribute() {}, addEventListener() {},
  querySelector: (q) => (q === '.cs-acts' ? { set innerHTML(v) { acts = v; } } : q === '.cs-body' ? { set innerHTML(v) { body = v; } } : { set innerHTML(v) {}, appendChild() {}, textContent: '' }) };
globalThis.document = { getElementById: (id) => (id === 'chitsheet' ? dlg : null), body: { contains: () => true, classList: { toggle() {} }, appendChild(n) { n.parentNode = this; } }, documentElement: { classList: { toggle() {} } } };
globalThis.api = async (name) => (name === 'crmParty' ? { name: 'Metro Trade Supplies' } : read());
S.open('e1').then(() => new Promise((r) => setTimeout(r, 20))).then(() => {
  assert(/Coffee, milk and food, October/.test(body), 'what it was is shown');
  assert(/Metro Trade Supplies/.test(body), 'the supplier is named once the party record is read');
  assert(/cs-exp-tax-gst/.test(body) && /3,093\.68/.test(body), 'the GST it carries is shown');
  assert(/34,030\.50/.test(body) && !/not recorded/.test(body), 'the Total is the booked amount');
  assert(!/No lines on this chit/.test(body) && !/Rate-wise GST is not recorded/.test(body), 'no "No lines" / "GST not recorded" for a record that has none by design');
  assert(/cs-act-accept"[^>]* disabled/.test(acts) && acts.includes('already in your books'), 'Accept is greyed with the server\'s sentence');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'chit-sheet.js'), 'utf8');
  assert(src.includes('.toLowerCase().replace(/\\s+/g, \'\')] || x.mode') && !src.includes('replace(/s+/g'), 'the payment-mode key strips whitespace, never the letter s: Cash must find HOW.cash');
  console.log('chit-sheet-expense: all ok');
}).catch((e) => { console.error(e); process.exit(1); });
