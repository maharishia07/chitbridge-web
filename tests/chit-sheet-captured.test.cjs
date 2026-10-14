/**
 * tests/chit-sheet-captured.test.cjs — F10: MY counter receipt that carries their bill no. + total is read by the popup as a SUPPLIER BILL:
 * who and which bill (theirs), their total, its step is my own copy's, Accept without the use question (no Goods in, no Dispute — the goods
 * were counted at my door and nobody else holds it). What the server said about it on the Books Waiting list (a gap, an unknown supplier)
 * greys Accept with that sentence; "Who is …" adds the supplier door. A receipt without their bill stays a receipt.
 * Run: node tests/chit-sheet-captured.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
globalThis.counterOfBill = () => '';
globalThis.counterWord = () => '';
globalThis.chitIsSelf = (en) => en === 'me';
eval(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'chit-sheet.js'), 'utf8'));
const S = globalThis.CBSheet;
const rcpt = (bj, st) => ({ header: { chit_id: 'r1', purpose: 'receipt', current_status: st || 'pending', created_at: '2026-10-13T05:00:00Z',
  all_recipients: [{ role: 'sender', display_name: 'Mayur Stores', entity_id: 'me' }, { role: 'receiver', display_name: 'self', entity_id: 'me' }],
  summary_json: { total_value: 1000, currency_code: 'INR' },
  business_json: Object.assign({ doc: 'receipt', doc_no: 'G/C1/0001', till: { id: 'C1' }, party: { name: 'Sri Ganesh Provisions' }, their_bill: { no: 'SG-101', total: 1180 } }, bj || {}) },
  detail: { line_items: [{ particulars: 'Rice 25kg', quantity: 10, price: 100, total: 1000, gst_rate: 18 }] } });

const m = S.model(rcpt());
assert.strictEqual(m.captured, true, 'a receipt with their bill no. and total is captured');
assert.strictEqual(m.billRx, true, '…a bill I received');
assert.strictEqual(m.counterBill, false, '…never my counter sale (it has a till, but it is their bill)');
assert.strictEqual(m.no, 'SG-101', 'the number is THEIR bill number');
assert.strictEqual(m.who, 'Sri Ganesh Provisions', 'who is the supplier the door named');
assert.strictEqual(m.money.total, 1180, 'the money it carries is their total, read (the server taxes the lines when it posts)');
assert.strictEqual(S.titleFor(m), 'Supplier bill');
assert.strictEqual(m.status, 'pending', 'its step is my own copy\'s status');
assert.deepStrictEqual(S.actionsFor(m), ['accept', 'page'], 'Accept · Open page — no Goods in, no Dispute');
assert.deepStrictEqual(S.actionsFor(S.model(rcpt({}, 'accepted'))), ['page'], 'accepted → nothing more to accept');

const plain = S.model(rcpt({ their_bill: { no: null, date: null, total: null } }));
assert.strictEqual(plain.captured, false, 'without their bill it stays a receipt');
assert.strictEqual(plain.billRx, false, '…not a bill to accept (its reading is unchanged)');

/* what the server said on the Waiting list greys Accept (paint reads it); here the reading itself */
globalThis.BK = { waiting: [{ chit_id: 'r1', reason: 'Their bill SG-101 says ₹1,300, the lines counted come to ₹1,180 — ₹120 apart. Ask Sri Ganesh Provisions to correct it, or reject it and record their bill by hand.' }] };
let html = '';
const dlg = { open: true, querySelector: (q) => (q === '.cs-acts' ? { set innerHTML(v) { html = v; } } : { set innerHTML(v) {}, appendChild() {}, textContent: '' }) };
globalThis.document = { getElementById: (id) => (id === 'chitsheet' ? dlg : null), body: { contains: () => true, classList: { toggle() {} } }, documentElement: { style: {} } };
globalThis.api = async () => rcpt();
S.open('r1').then(() => {
  assert(/data-testid="cs-act-accept"[^>]* disabled title="Their bill SG-101 says ₹1,300/.test(html), 'a gap: Accept is SHOWN, greyed, with the server\'s sentence (both figures)');
  globalThis.BK.waiting = [{ chit_id: 'r1', reason: 'Who is Sri Ganesh? Add them as a supplier — then bill SG-101 waits for you to accept it.' }];
  return S.open('r1');
}).then(() => {
  assert(/cs-act-supplier/.test(html) && /cs-act-accept"[^>]* disabled/.test(html), 'an unknown supplier: Add supplier is offered, Accept greyed with "Who is …"');
  globalThis.BK.waiting = [{ chit_id: 'r1', reason: 'Waiting for you to confirm the goods were received (bill SG-101 from Sri Ganesh Provisions)' }];
  return S.open('r1');
}).then(() => {
  assert(/cs-act-accept"(?![^>]*disabled)/.test(html) && !/cs-act-supplier/.test(html), 'waiting for acceptance: Accept is live');
  console.log('chit-sheet-captured: all ok');
}).catch((e) => { console.error(e); process.exit(1); });
