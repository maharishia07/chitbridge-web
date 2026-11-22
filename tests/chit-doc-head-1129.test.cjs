/**
 * tests/chit-doc-head-1129.test.cjs - AU-F-11 (walk AU, UAE law): the chit sheet of a RAIL invoice and credit note carried no "Tax Invoice" / "Tax Credit Note" title,
 * no supplier TRN, address or date, named no invoice on a credit note, and offered "Mark paid" on it. Now CBSheet.docHeadHTML draws the head from the frozen invoice
 * (business_json.invoice DocDtls / SellerDtls, the api's fixAR fields) and the country pack's own words (pack.taxInvoice(...).title, pack.creditNote.title), with NO country
 * literal in the file; a credit note names its invoice (business_json.against) and reason; chitPaymentCell draws no Mark paid on a credit note.
 * Hand: AE pack -> "Tax Invoice", "Tax Credit Note"; a shop with no pack -> "Invoice", "Credit note"; a counter bill is not drawn here (its slip is titled).
 * Run: node tests/chit-doc-head-1129.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
globalThis.counterOfBill = () => '';
globalThis.chitIsSelf = () => false;
globalThis.tx = (s) => s;
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'helpers.js'), 'utf8'));
const sheetSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'chit-sheet.js'), 'utf8');
const headSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'chit-doc-head.js'), 'utf8');
eval(headSrc);
eval(sheetSrc);
const S = globalThis.CBSheet;

const PACKS = { AE: { creditNote: { title: 'Tax Credit Note' }, taxInvoice: () => ({ title: 'Tax Invoice' }) }, XX: {} };
let country = 'AE';
globalThis.shopReg = (cc) => PACKS[cc || country] || null; /* the page's one pack reader (helpers.js): the seller's country when given, else the shop's */
globalThis.taxIdWord = () => 'TRN';

const invoice = { DocDtls: { Typ: 'INV', No: 'uuid', Dt: '2026-11-22' }, SellerDtls: { Gstin: '100123450110003', LglNm: 'Karak House LLC', Addr1: 'Shop 4, Al Rigga Road, Deira, Dubai' } };
const sheetOf = (purpose, bj) => ({ doc: 'bill_received', header: { chit_id: 'i1', purpose, current_status: 'pending', created_at: '2026-11-22T08:00:00Z', all_recipients: [{ role: 'sender', display_name: 'Karak House', entity_id: 'a' }, { role: 'receiver', display_name: 'Dates Co', entity_id: 'b' }], summary_json: { total_value: 66.66, currency_code: 'AED' }, business_json: Object.assign({ bill_no: 'WAU-INV1', invoice }, bj || {}) }, detail: { line_items: [] } });
const head = (purpose, bj) => CBDocHead.html(S.model(sheetOf(purpose, bj)));

let html = head('invoice');
assert(/data-testid="cs-doc-title">Tax Invoice</.test(html), 'an invoice is titled by the pack: Tax Invoice');
assert(html.includes('Karak House LLC') && html.includes('TRN') && html.includes('100123450110003'), 'the supplier name and tax number');
assert(html.includes('Shop 4, Al Rigga Road, Deira, Dubai'), 'the supplier address (fixAR carries it on SellerDtls)');
assert(html.includes('2026-11-22') && html.includes('WAU-INV1'), 'the date and the number');
assert(!/Against invoice|Reason/.test(html), 'an invoice names no invoice it reduces');

html = head('credit_note', { bill_no: 'WAU-CN1', against: { chit_id: 'x', bill_no: 'WAU-INV1' }, reason_words: 'goods returned' });
assert(/data-testid="cs-doc-title">Tax Credit Note</.test(html), 'a credit note is titled by the pack: Tax Credit Note');
assert(/Against invoice<\/span><span[^>]*>WAU-INV1</.test(html) && /Reason<\/span><span[^>]*>goods returned</.test(html), 'a credit note names its invoice and why');
assert(CBDocHead.html(S.model(sheetOf('credit_note', { against: 'WAU-INV1' }))).includes('WAU-INV1'), 'an against given as text is read too');

country = 'XX';
assert(/data-testid="cs-doc-title">Invoice</.test(head('invoice')) && /data-testid="cs-doc-title">Credit note</.test(head('credit_note')), 'a pack with no document rule prints the neutral words, never a made-up title');
assert.strictEqual(CBDocHead.html(S.model(sheetOf('invoice', { invoice: null }))), '', 'a chit with no frozen invoice draws no head (nothing invented)');
assert.strictEqual(CBDocHead.html(S.model(sheetOf('order'))), '', 'an order is not a tax document');
assert.strictEqual(CBDocHead.html(S.model(Object.assign(sheetOf('invoice'), { doc: 'invoice' }))).length > 0, true, 'a bill I sent is drawn too (both seats)');

/* the head is in the sheet's paint and in design 1's Content tab, and no country literal is in the painter */
assert(sheetSrc.includes('pageNoteHTML() + docHeadHTML(m)') && sheetSrc.includes("return root.CBDocHead ? root.CBDocHead.html(m) : '';"), 'the popup paints the head');
assert(!/'(AE|IN|AU)'|UAE|TRN|GSTIN/.test(headSrc.slice(headSrc.indexOf('(function'))), 'no country literal in the document head code');
const TAGS = '<script src="/app/chit-doc-head.js"></script><script src="/app/chit-sheet.js"></script>';
assert(['accounts', 'app', 'crm', 'finance', 'tasks'].every((page) => fs.readFileSync(path.join(__dirname, '..', 'public', page + '.html'), 'utf8').includes(TAGS)), 'every page that loads the sheet loads the head first, on the same script line');

/* Mark paid: none on a credit note, still there on an invoice */
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');
function fnSource(name) {
  const at = src.indexOf('\nfunction ' + name + '(');
  assert(at > 0, name + ' is in app.html');
  const rest = src.slice(at + 1);
  return rest.slice(0, rest.search(/\n(?:\/\*\*|async function |function )/));
}
globalThis.SESSION = { entity: 'me' };
globalThis.chitUnpaidWord = () => 'Unpaid';
globalThis.payHasUpi = () => false;
eval(['chitPurposeOf', 'chitStatusWord', 'chitNoPayWhy', 'chitMarkPaidButton', 'chitIsNote', 'chitNoteWord', 'chitPaymentCellHidden', 'chitPaymentCell', 'chitDocHead'].map(fnSource).join('\n') + '\nglobalThis.chitPaymentCell = chitPaymentCell; globalThis.chitDocHead = chitDocHead;');
const cell = (label, value) => label + ':' + value;
const strip = (kind, header) => ({ id: 'c1', kind, header: Object.assign({ sender_entity_id: 'them', current_status: 'pending' }, header || {}) });
assert(/chit-mark-paid/.test(chitPaymentCell(strip('invoice'), cell, 100)), 'an invoice keeps Mark paid');
assert.strictEqual(chitPaymentCell(strip('credit_note'), cell, 100), '', 'a credit note shows no Mark paid (and no Unpaid)');
assert.strictEqual(chitPaymentCell({ id: 'c1', purpose: 'debit_note', header: { sender_entity_id: 'them' } }, cell, 100), '', 'a debit note either, from a raw chit');
assert(/cs-doc-head/.test(chitDocHead({ kind: 'invoice', business_json: sheetOf('invoice').header.business_json })), 'design 1 Content draws the same head');
const c2 = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-chit2.js'), 'utf8');
assert(/purpose: header\.purpose/.test(c2), 'design 2 hands the strip the purpose');
console.log('chit-doc-head-1129: all checks passed');
