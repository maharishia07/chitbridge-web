'use strict';
/* AE-F-07 (Walk AE 21 Nov): the tax slab form takes its words and fields from the shop's PACK: UAE = "VAT 5%", no cess, no HSN list; India's pack keeps cess and HSN; no pack = the old form.
   Lifts cbDefTaxScheme + cbDefRuleFields out of public/app/cap-definitions.js. Break check: make cbDefTaxScheme return codes:true and case 1 fails. Run: node tests/ae-f07-slab-pack-words.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../public/app/cap-definitions.js', 'utf8');
function grab(name) {
  const at = src.indexOf('function ' + name + '('); assert.ok(at >= 0, name + ' is gone');
  let i = src.indexOf('{', at), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(at, i + 1);
}
function page(pack) {
  const c = { shopReg: () => pack, console };
  vm.createContext(c);
  vm.runInContext(grab('cbDefTaxScheme') + '\n' + grab('cbDefSubLabel') + '\n' + grab('cbDefCodeFields') + '\n' + grab('cbDefRuleFields'), c);
  return c;
}
const keys = (c) => vm.runInContext("cbDefRuleFields('tax','gst_slab').map(function(f){return f.k})", c).join();
let n = 0; const ok = (w, f) => { f(); n++; console.log('  ok  ' + w); };
const AE = { id: 'AE', tax: { scheme: 'VAT', rates: [0, 5], standard_rate: 5 } };
const IN = { id: 'IN', tax: { scheme: 'GST', rates: [0, 5, 12, 18, 28], hsn_digits: [{}] } };
ok('UAE: the slab form has rate and date only, the word is VAT 5%', () => {
  const c = page(AE);
  assert.strictEqual(keys(c), 'rate,effective_from');
  assert.strictEqual(vm.runInContext("cbDefTaxScheme().word + ' ' + cbDefTaxScheme().sample + '%'", c), 'VAT 5%');
  assert.strictEqual(vm.runInContext("cbDefSubLabel('tax','gst_slab')", c), 'VAT slab');
});
ok('India: rate, cess, hsn, date, as before', () => assert.strictEqual(keys(page(IN)), 'rate,cess,hsn,effective_from'));
ok('no pack known: the old India-shaped form stays', () => assert.strictEqual(keys(page(null)), 'rate,cess,hsn,effective_from'));
console.log(n + ' ok');
