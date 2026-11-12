/**
 * tests/match-other-unit.test.cjs - CTR-248 (web twin of api #1194, OPS-87): the three-way match screen, public/app/cap-match.js, with no browser.
 *
 * OWNS      the proof that a line the api marks counted_in_another_unit (ordered 10 box, received 0 in box, 2 dozen counted) reads
 *           "counted in another unit: dozen mine 2 / theirs 0" in the Difference cell AND in the dispute draft - never "short 10" -
 *           with one segment per other_units entry joined " · ", and that an ordinary short / excess line still reads short / excess.
 * CALLED BY package.json check script · .github/workflows/ci.yml (web job). The real cap-match.js in node, stubs for the page helpers.
 * FLOW      GET /api/till/match line -> matchDetail (table row) / matchDispute (draft in the modal)
 * CARD      03-disputes-service-and-register/three-way-match
 * UNIT      03/Three-way match (other-unit line)
 * MUTATION  checked: in cap-match.js make matchOtherUnits() return '' -> every other-unit check below goes red.
 * Run: node tests/match-other-unit.test.cjs        (CAPM_FILE=<path> aims it at another copy of cap-match.js: the mutation check)
 */
'use strict';
const path = require('path'),
  fs = require('fs'),
  assert = require('assert');
const FILE = process.env.CAPM_FILE || path.join(__dirname, '..', 'public', 'app', 'cap-match.js');

globalThis.window = globalThis;
const helpers = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'helpers.js'), 'utf8');
const m = helpers.match(/function esc\([\s\S]*?\n\}\n/);
assert(m, 'helpers.js has esc');
(0, eval)(m[0] + ';globalThis.esc = esc;');
globalThis.tx = (s) => s;
globalThis.txf = (s, v) => s.replace(/\{(\w+)\}/g, (w, k) => (v && k in v ? String(v[k]) : w));
globalThis.inr = (n) => String(n);
globalThis.fmtMoney = (n) => String(n);
globalThis.myCur = () => 'INR';
let modalHtml = '';
globalThis.modal = (h) => {
  modalHtml = h;
};
(0, eval)(fs.readFileSync(FILE, 'utf8'));

const other = {
  line_id: 'a',
  name: 'Eggs',
  unit: 'box',
  ordered: 10,
  received: 0,
  difference: -10,
  reason: null,
  state: 'other_unit',
  counted_in_another_unit: true,
  other_units: [
    { unit: 'dozen', mine: 2, theirs: 0 },
    { unit: 'piece', mine: 5, theirs: 3 }
  ]
};
const plain = { line_id: 'b', name: 'Oil', unit: 'L', ordered: 10, received: 7, difference: -3, reason: 'broken', state: 'short' };
const order = { chit_id: 'c1', party: 'Acme', verdict: 'differs', lines: [other, plain], receipts: [], ordered_total: 1, invoiced_total: 1 };

const html = matchDetail(order, null);
const rows = html.split('data-testid="match-line"').slice(1);
assert.strictEqual(rows.length, 2, 'two lines drawn');
const seg = 'counted in another unit: dozen mine 2 / theirs 0 · counted in another unit: piece mine 5 / theirs 3';
assert(rows[0].includes(seg), 'other-unit line: one segment per unit, joined');
assert(!/short 10|excess/.test(rows[0]), 'other-unit line is not "short 10"');
assert(rows[1].includes('short 3') && rows[1].includes('broken'), 'a plain short line still reads short 3 with its reason');

MATCH.rows = [order];
matchDispute('c1');
const draft = modalHtml.replace(/&amp;/g, '&');
assert(draft.includes('Eggs: ordered 10 box, received 0 (' + seg + ')'), 'dispute draft carries the other-unit words');
assert(!/short 10/.test(draft), 'dispute draft does not say short 10');
assert(draft.includes('Oil: ordered 10 L, received 7 (short 3) — broken'), 'dispute draft: plain line unchanged');
console.log('ok match-other-unit: 6 checks');
