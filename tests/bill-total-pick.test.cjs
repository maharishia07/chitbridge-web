/**
 * tests/bill-total-pick.test.cjs — ACC-206 D1: one web read of a chit's bill total (helpers.js billTotalOf), on every fixture row, at every reader's REAL call.
 * Rows = e2e/fixtures/bill-total-fixtures.json (hand-computed; the master, api C1 requires it). The three readers' own `amt` / `v` expressions are lifted from
 * their source and run on the real shapes (header.summary_json, not delivery_summary), so a call that passes the wrong object goes red.
 * Mutations (in-test, on copies): swap the arms · pass delivery_summary · restore the raw read → each must turn row b red.
 * Run: node tests/bill-total-pick.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', 'public');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'e2e', 'fixtures', 'bill-total-fixtures.json'), 'utf8'));
const row = (name) => FX.rows.find((r) => r.name === name);

function helperOf(src) {
  const a = src.indexOf('function billFigure('), b = src.indexOf('function deepClone(');
  assert(a > 0 && b > a, 'billFigure/billTotalOf must sit in helpers.js before deepClone');
  return new Function(src.slice(a, b) + '; return billTotalOf;')();
}
const SRC = read('app/helpers.js');
const pick = helperOf(SRC);

/* one definition, in helpers.js only */
for (const f of ['app.html', 'app/chit-sheet.js', 'app/cap-chit2.js', 'authority-forms.html'])
  assert(!/function\s+billTotalOf\s*\(/.test(read(f)), f + ' must not define a second billTotalOf');
assert.strictEqual((SRC.match(/function\s+billTotalOf\s*\(/g) || []).length, 1, 'exactly one billTotalOf');

/* the readers' real expressions, lifted from source */
const grab = (file, re, what) => { const m = read(file).match(re); assert(m, what + ' call not found in ' + file); return m[1]; };
const exprApp = grab('app.html', /\bamt: (billTotalOf\(sum\) \|\| 0),/, 'app.html amt');
const exprC2 = grab('app/cap-chit2.js', /\bamt: (billTotalOf\(h\.summary_json, \(d\.detail && d\.detail\.total_value\) \|\| h\.total_value\) \|\| 0),/, 'cap-chit2 amt');
const exprAuth = grab('authority-forms.html', /\bv = (billTotalOf\(sj\)),/, 'authority-forms v');
const stripOf = (bt, expr, r) => new Function('billTotalOf', 'd', 'h', 'return ' + expr)(bt,
  { header: { summary_json: r.summary }, detail: { total_value: r.detail }, delivery_summary: { lines: [] } }, { summary_json: r.summary });
const listOf = (bt, r) => new Function('billTotalOf', 'sum', 'return ' + exprApp)(bt, r.summary);
const authOf = (bt, r) => new Function('billTotalOf', 'sj', 'return ' + exprAuth)(bt, r.summary);

const bad = [];
for (const r of FX.rows) {
  const amt = r.expect == null ? 0 : r.expect;
  if (pick(r.summary) !== r.expect) bad.push('pick ' + r.name + ' got ' + pick(r.summary));
  if (listOf(pick, r) !== amt) bad.push('list ' + r.name);
  if (stripOf(pick, exprC2, r) !== (r.strip != null ? r.strip : amt)) bad.push('strip ' + r.name);
  if (authOf(pick, r) !== r.expect) bad.push('authority ' + r.name);
}
assert.deepStrictEqual(bad, [], 'every fixture row on every reader');

/* a stamped mismatch (k) and the legacy row (b) read 189 — flagged by api pickOf, never recomputed here */
assert.strictEqual(pick(row('k-stamped-mismatch').summary), 189);
assert.strictEqual(pick(row('b-b2b-before-2nov').summary), 189);
assert.strictEqual(row('b-b2b-before-2nov').summary.total_value, 180, 'row b really is the old shape');

/* never a bare Number(): refused inputs are not figures, in the money arm, the total_value arm and the raw arm */
for (const v of FX.refused.concat([NaN, Infinity, -Infinity])) {
  assert.strictEqual(pick({ money: { total: v } }), null, 'money.total ' + String(v));
  assert.strictEqual(pick({ total_value: v }), null, 'total_value ' + String(v));
  assert.strictEqual(pick({}, v), null, 'raw ' + String(v));
}
assert.strictEqual(pick({ money: { total: ' 12.50 ' } }), 12.5);
assert.strictEqual(pick(null), null); assert.strictEqual(pick('x'), null); assert.strictEqual(pick({ money: 5 }), null);
assert.strictEqual(pick({ total_value: 0 }), 0, 'a stored 0 stays 0');

/* currency is the caller's, read from the same header summary */
assert(/currency: sum\.currency_code/.test(read('app.html')), 'list row still reads sum.currency_code');
assert(/cur = sj\.currency_code/.test(read('authority-forms.html')), 'authority still reads sj.currency_code');

/* mutations: each must turn row b red */
const b = row('b-b2b-before-2nov');
const swapped = SRC.replace(/  var m = s\.money[^\n]*\n  if \(m != null\) return m;\n  var t = billFigure\(s\.total_value\);\n  return t != null \? t : billFigure\(raw\);/,
  '  var t = billFigure(s.total_value);\n  if (t != null) return t;\n  var m = s.money && typeof s.money === "object" ? billFigure(s.money.total) : null;\n  return m != null ? m : billFigure(raw);');
assert.notStrictEqual(swapped, SRC, 'mutation 1 applied');
assert.notStrictEqual(helperOf(swapped)(b.summary), 189, 'arms swapped: row b must go red');
const wrong = exprC2.replace('h.summary_json', 'd.delivery_summary');
assert.notStrictEqual(wrong, exprC2, 'mutation 2 applied');
assert.notStrictEqual(stripOf(pick, wrong, b), 189, 'delivery_summary passed: row b must go red');
assert.notStrictEqual(new Function('sum', 'return sum.total_value || 0')(b.summary), 189, 'raw read restored: row b must go red');

console.log('bill-total-pick: all ok (' + FX.rows.length + ' rows x 3 readers, ' + (FX.refused.length + 3) + ' refused inputs, 3 mutations)');
