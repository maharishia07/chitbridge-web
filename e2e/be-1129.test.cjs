'use strict';
// @type: unit
/**
 * be-1129.test.cjs - WALK BE (India, 22 Nov): the Bank page and the Returns page, as the owner reads them.
 * OWNS      BE-F-04 a bank line the books received, reversed and posted again (three 5,000.00 lines on 10 Nov): the matcher gets only the live re-post, so the
 *           statement's 5,000.00 is MATCHED (Accept) and never offered as "Add missing" again; the real engine (public/engine/bank-recon.js) and the page's own
 *           bksLiveLines are run over the walk's three lines. Fails on the parent (three candidates, "ambiguous", no match).
 * OWNS      BE-F-03 the Returns page: the file's own totals are printed (read from _cb, nothing summed) and the per-bill 'differs' warnings become ONE line per reason
 *           with the bills named, not one long jargon bullet per bill. Run on the page's own functions over the walk's four-bill shape.
 * CALLED BY ci.yml (the unit checks): node e2e/be-1129.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..', 'public');
/* the engine wants a regulation pack at load; the matcher needs none of it, so a stand-in with no bank rules is enough */
globalThis.CBRegulation = { DEFAULT: 'IN', packFor: () => ({ bank: null }) };
const recon = require(path.join(root, 'engine', 'bank-recon.js'));
const src = fs.readFileSync(path.join(root, 'app', 'cap-bank-store.js'), 'utf8');
const at = src.indexOf('const bksLiveLines'), line = src.slice(at, src.indexOf('\n', at));
const sb = {};
vm.createContext(sb);
vm.runInContext(line.replace('const bksLiveLines', 'this.bksLiveLines') + '\n', sb);
let ran = 0;
const ok = (what) => console.log('  ok  ' + what, ++ran && '');

const API = [
  { ref: 'JV-1', date: '2026-11-10', dr_minor: 500000, cr_minor: 0, entry_id: 'e1', reversed_by: 'e2', reverses_entry_id: null },
  { ref: 'JV-2', date: '2026-11-10', dr_minor: 0, cr_minor: 500000, entry_id: 'e2', reversed_by: null, reverses_entry_id: 'e1' },
  { ref: 'JV-3', date: '2026-11-10', dr_minor: 500000, cr_minor: 0, entry_id: 'e3', reversed_by: null, reverses_entry_id: null }
];
const asLedger = (rows) => rows.map((item, index) => ({ id: item.ref + '#' + index, date: item.date, dr_minor: item.dr_minor, cr_minor: item.cr_minor, ref: null, narration: '', entry_no: item.ref }));
const STMT = [{ date: '2026-11-10', narration: 'Capital in', debit_minor: 0, credit_minor: 500000 }];

const live = sb.bksLiveLines(API);
assert.strictEqual(live.map((item) => item.ref).join(), 'JV-3');
ok('the reversed receipt and its reversal leave the list; the live re-post stays');
assert.strictEqual(sb.bksLiveLines(null).length, 0);
ok('no lines is an empty list');

const before = recon.match(STMT, asLedger(API), { window_days: 3 });
assert.strictEqual(before.matched.length, 0, 'on the parent the three-line case is not matched');
const after = recon.match(STMT, asLedger(live), { window_days: 3 });
assert.strictEqual(after.matched.length, 1);
assert.strictEqual(after.unmatched_stmt.length, 0);
ok('with only the live re-post the 5,000.00 is matched (Accept), nothing is left to Add');

/* BE-F-03: the Returns page's own functions, lifted by name (the helpers with them) */
const lift = (names) => {
  const text = fs.readFileSync(path.join(root, 'app', 'cap-finance-returns.js'), 'utf8');
  return names.map((name) => { const i = text.indexOf('function ' + name + '('); return text.slice(i, text.indexOf('\n}\n', i) + 3); }).join('\n');
};
const page = { tx: (t) => t, txf: (t, o) => t.replace(/\{(\w+)\}/g, (m, k) => o[k]), esc: (t) => String(t), fmtMoney: (v) => 'Rs ' + Number(v).toFixed(2) };
vm.createContext(page);
vm.runInContext(lift(['frReasonOf', 'frTaxDiffers', 'frTotalsHtml', 'frNotes']) + '\nthis.notes = frNotes; this.totals = frTotalsHtml;', page);
const diff = (no, what) => ({ words: 'Bill ' + no + ': the invoice the till issued does not match the server check (long jargon).', differences: what.map((w) => ({ what: w })) });
const notes = page.notes({ tax_differs: [diff('C1/2', ['place_of_supply', 'supply', 'cgst', 'sgst', 'igst']), diff('C1/4', ['place_of_supply', 'supply', 'taxable', 'cgst', 'igst', 'taxable at 12%']), diff('C1/5', ['place_of_supply']), diff('C1/7', ['supply'])] });
assert.strictEqual(notes.length, 4, notes.join('\n'));
assert.ok(/State of supply .*\(4\): C1\/2, C1\/4, C1\/5, C1\/7/.test(notes[0]) && /split .*\(2\): C1\/2, C1\/4/.test(notes[1]) && /taxable value or total .*\(1\): C1\/4/.test(notes[2]) && /before you file/.test(notes[3]), notes.join('\n'));
assert.ok(!/long jargon/.test(notes.join(' ')));
ok('four bills with differences read as three reason lines plus one closing line, every bill named, none of the per-bill jargon');
const tot = page.totals({ summary: { invoices: 9, notes: 2, taxable: 261871.43, tax: 36241.58 } });
assert.ok(/data-testid="fr-totals"/.test(tot) && /Invoices 9 · Credit notes 2 · Taxable value Rs 261871.43 · Tax Rs 36241.58/.test(tot), tot);
assert.ok(/Net tax in this file Rs 36241.58/.test(page.totals({ net: { total: 36241.58 } })) && page.totals({}) === '');
ok("the totals line is the file's own figures (GSTR-1 summary, GSTR-3B net); a file with none prints none");
console.log(ran + ' checks passed');

