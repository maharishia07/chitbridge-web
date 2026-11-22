/* B-F-22 / B-F-01 (walk B 21 Nov): a new item in a tax-charging shop is born with the country pack's standard rate (never typed in the page: read off the pack),
   and a shop with no live slab can Set rate from the pack's own rates. Lifts the catalogue's functions over a stub pack. Break check: drop the stamp in save() and case 3 fails. */
'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../public/app/cap-catalogue.js', 'utf8');
const grab = (n) => { const at = src.indexOf('  function ' + n + '('); assert.ok(at >= 0, n + ' is gone'); let i = src.indexOf('{', at), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; } return src.slice(at, i + 1); };
const page = (pack, charges, face) => { const c = { S: { face }, taxPack: () => pack, shopCharges: () => charges, taxWord: () => 'GST', T: (s) => s, esc: (s) => String(s) }; vm.createContext(c); vm.runInContext(['defaultRate', 'packRateMenuHTML'].map(grab).join('\n'), c); return c; };
let n = 0; const ok = (w, f) => { f(); n++; console.log('  ok  ' + w); };
ok('AU (standard_rate 10): the default is 10, from the pack', () => assert.strictEqual(page({ standard_rate: 10, rates: [0, 10] }, true, {}).defaultRate(), 10));
ok('India (slab-rated, no one standard) or a shop that charges no tax: no default, the warning stays', () => { assert.strictEqual(page({ standard_rate: null }, true, {}).defaultRate(), null); assert.strictEqual(page({ standard_rate: 10 }, false, {}).defaultRate(), null); });
ok('a declared catalogue default slab wins: nothing is stamped over it', () => assert.strictEqual(page({ standard_rate: 10 }, true, { tax: { default_slab: 'x' } }).defaultRate(), null));
ok('save() stamps the default on a new item before prodAdd', () => assert.ok(/rate !== null && next\.gst_rate == null && !next\.tax_slab\) next\.gst_rate = rate;\s*return api\('prodAdd'/.test(src)));
ok('no live slab: Set rate offers the pack rates (0 and the standard), each a button on the bare-rate patch', () => {
  const html = page({ standard_rate: 10, rates: [0, 10] }, true, {}).packRateMenuHTML();
  assert.ok(/rate-pick-pack-10/.test(html) && /rate-pick-pack-0/.test(html) && /standard rate/.test(html) && /ratePickBare\(10/.test(html));
});
console.log(n + ' ok');
