'use strict';
// @type: unit
/**
 * tax-kind-ask.test.cjs - THE 0% QUESTION (supply kind, AE-F-11; Athi 21 Nov 2026: ask the owner, never a default), the ONE builder in public/app/tax-slab-ui.js
 * (cbKindAskOf, cbKindAskHTML) that the slab dialog (POP025, cap-definitions.js) and the item rate buttons (cap-catalogue.js) both draw.
 *
 * Cases (hand-checked against the pack's own table, nothing typed here): the pack's own kinds at rate 0 become ONE button each, in the pack's order; no button starts selected;
 * a chosen kind shows a tick and the pack's one-line why; a name suggestion is only a hint on its button; a pack with no kinds asks nothing (the old behaviour, unchanged);
 * the pick is the host's own onclick, one per button (there is no "confirm all"); the host wiring is on the page's scripts.
 * Run: node e2e/tax-kind-ask.test.cjs   (CB_ENGINES_DIR=../chitbridge-engines adds the India 1.1.0 pack)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + '\n      ' + e.message); fail++; process.exitCode = 1; } };

globalThis.window = globalThis.window || globalThis;
require(path.join(__dirname, '..', 'public', 'engine', 'tax.js'));
globalThis.esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
require('vm').runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'tax-slab-ui.js'), 'utf8'), { filename: 'tax-slab-ui.js' });
const ask = globalThis.cbKindAskOf, html = globalThis.cbKindAskHTML;

const AE = {
  tax: { supplyKinds: {
    standard: { id: 'standard', name: 'Standard-rated supply', short: 'Standard-rated', rate: 5, why: 'VAT at 5% applies.' },
    zero_rated: { id: 'zero_rated', name: 'Zero-rated supply', short: 'Zero-rated', rate: 0, why: 'Zero-rated: no VAT is charged, and input tax may still be claimed.' },
    exempt: { id: 'exempt', name: 'Exempt supply', short: 'Exempt', rate: 0, why: 'Exempt: no VAT is charged, and input tax is not recoverable.' }
  } },
  returns: { unknownKind: { ask: 'Is this sale standard-rated, zero-rated or exempt?' } }
};
const IN_OLD = { tax: { rates: [0, 5, 12, 18, 28] } };

console.log('\ntax-kind-ask - the builder');
t('the pack\'s 0% kinds only (standard is not a 0% answer), in the pack\'s order, with its own question', () => {
  const q = ask(AE);
  assert.deepStrictEqual(q.kinds.map((k) => k.id), ['zero_rated', 'exempt']);
  assert.strictEqual(q.ask, 'Is this sale standard-rated, zero-rated or exempt?');
});
t('a pack that names no kind (India before 1.1.0, or any pack with no table) asks nothing: null and an empty string', () => {
  assert.strictEqual(ask(IN_OLD), null);
  assert.strictEqual(ask(null), null);
  assert.strictEqual(html(null), '');
});
t('one button per kind, NO button selected by default, no "confirm all" anywhere, each click the host\'s own', () => {
  const h = html(ask(AE), { pick: (id) => "pick('" + id + "')" });
  assert.strictEqual((h.match(/<button /g) || []).length, 2);
  assert.ok(!/aria-pressed="true"/.test(h) && !/✓/.test(h));
  assert.ok(/onclick="pick\(&#39;zero_rated&#39;\)"/.test(h) && /onclick="pick\(&#39;exempt&#39;\)"/.test(h));
  assert.ok(!/all/i.test(h.replace(/Until you answer, a sale at 0% is not filed under any of them\./, '')), 'no "all" button');
  assert.ok(/Until you answer/.test(h), 'while nothing is chosen the sentence says what waiting means');
});
t('a chosen kind shows its tick and the pack\'s one-line why; the others stay unpressed', () => {
  const h = html(ask(AE), { chosen: 'exempt', pick: () => '' });
  assert.ok(/aria-pressed="true"[^>]*>✓ Exempt<\/button>/.test(h) || /data-testid="kind-pick-exempt" aria-pressed="true"/.test(h));
  assert.ok(/input tax is not recoverable/.test(h) && !/Until you answer/.test(h));
  assert.strictEqual((h.match(/aria-pressed="true"/g) || []).length, 1);
});
t('a name suggestion is a hint on ITS button only and never selects it', () => {
  const h = html(ask(AE), { suggested: 'exempt', pick: () => '' });
  assert.strictEqual((h.match(/data-testid="kind-suggested"/g) || []).length, 1);
  assert.ok(h.indexOf('kind-pick-exempt') < h.indexOf('kind-suggested') && h.indexOf('kind-suggested') > h.indexOf('kind-pick-zero_rated') && !/aria-pressed="true"/.test(h));
});
t('the pack\'s words are escaped and the page wires both doors to the one builder', () => {
  const evil = { tax: { supplyKinds: { x: { id: 'x', name: '<b>x</b>', short: '<i>x</i>', rate: 0, why: '"><script>' } } } };
  assert.ok(!/<i>x<\/i>|<script>/.test(html(ask(evil), { pick: () => '' })));
  const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
  assert.ok(/cbKindAskHTML\(ask, \{ chosen: f\.rules\.tax_kind/.test(read('cap-definitions.js')) && /cbDefSetKind/.test(read('cap-definitions.js')), 'the slab dialog (POP025)');
  assert.ok(/cbKindAskOf\(shopReg\(\)\)/.test(read('cap-catalogue.js')) && /ratePickKind/.test(read('cap-catalogue.js')) && /tax_kind: kind/.test(read('cap-catalogue.js')), 'the item rate button');
  assert.ok(/if \(!cbDefRateIsZero\(\)\) delete R\.tax_kind/.test(read('cap-definitions.js')), 'a kind never rides with a rate that is not 0');
});

t('a rate tap on an item: a non-zero rate sends tax_kind null (the stale zero-rated or exempt answer is deleted), a rate of 0 sends the rate alone, a kind rides only with its own tap', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-catalogue.js'), 'utf8'), at = src.indexOf('function ratePatchOf'), end = src.indexOf('\n  }\n', at) + 4;
  const patchOf = new Function(src.slice(at, end) + '; return ratePatchOf;')();
  assert.deepStrictEqual(patchOf(5), { gst_rate: 5, tax_kind: null });
  assert.deepStrictEqual(patchOf(0), { gst_rate: 0 });
  assert.deepStrictEqual(patchOf(0, 'exempt'), { gst_rate: 0, tax_kind: 'exempt' });
  assert.ok(/item_data: ratePatchOf\(rate, kind\)/.test(src), 'the rate button sends that body');
});

if (process.env.CB_ENGINES_DIR) {
  const IN = require(path.join(path.resolve(process.env.CB_ENGINES_DIR), 'src', 'reg-in'));
  t('India 1.1.0: nil, exempt and non-GST, the pack\'s own question', () => {
    const q = ask(IN);
    assert.deepStrictEqual(q.kinds.map((k) => k.short), ['Nil-rated', 'Exempt', 'Non-GST']);
    assert.strictEqual(q.ask, 'Is this sale nil-rated, exempt or outside GST?');
  });
}

console.log('\n' + (fail ? 'FAIL ' : 'ok ') + pass + ' checks');
process.exit(fail ? 1 : 0);
