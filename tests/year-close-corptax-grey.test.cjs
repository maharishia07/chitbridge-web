'use strict';
/* I-F-13 (21 Nov, UAE walk I): the Year close of a UAE shop says "Corporate tax · Not built yet", greyed (the pack carries the data, nothing computes it); other countries show nothing.
   Run: node tests/year-close-corptax-grey.test.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-period.js'), 'utf8');
const at = src.indexOf('function peCorpTaxGrey()');
assert(at >= 0, 'cap-period.js has peCorpTaxGrey');
const fn = src.slice(at, src.indexOf('\n}\n', at) + 2);
const run = (pack) => vm.runInNewContext(fn + '\npeCorpTaxGrey()', { shopReg: () => pack, esc: (s) => s, tx: (s) => s });
const ae = run({ corporateTax: { bands: [] } });
assert.ok(/Corporate tax/.test(ae) && /Not built yet/.test(ae) && /aria-disabled="true"/.test(ae) && ae.includes('py-corptax-grey'), 'UAE: grey and said');
assert.strictEqual(run({ tax: {} }), '', 'a pack without Corporate tax data: nothing');
assert.strictEqual(run(null), '', 'no pack: nothing');
assert.ok(/peCorpTaxGrey\(\) \+/.test(src), 'the Year close paints it');
console.log('year-close-corptax-grey: all ok');
