/**
 * e2e/till2-combo-sample.test.cjs — batch 1128 fixTill2 item 3: the Combo Lab's worked example comes from CBSample, not the Chennai menu.
 * @type regression
 * OWNS      lab/combo-mode.js comboExampleFresh (lifted into a vm with the real public/app/sample-set.js): with no country or AU/AE the example holds no India word
 *           (Tiffin · Dosa · Idli · Pongal · Sambar · Chutney · Filter Coffee · Buttermilk), has three sections each with options, a name and a positive price; an India shop
 *           still gets its Tiffin Combo; and the Offer Lab hands the shop's country to comboSampleCountry.
 * CALLED BY the web offline guards. No browser, no network.
 *   node e2e/till2-combo-sample.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', 'public');
const src = fs.readFileSync(path.join(ROOT, 'lab/combo-mode.js'), 'utf8');
const sample = require(path.join(ROOT, 'app/sample-set.js'));
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? '   ok   ' : '   FAIL ') + n); };
const a = src.indexOf('var COMBO_SAMPLE_CC'), b = src.indexOf('\nfunction modLabBuildFresh');
const ctx = { CBSample: sample };
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + '\nthis.fresh = comboExampleFresh; this.setCc = comboSampleCountry;', ctx);
const INDIA = /Tiffin|Dosa|Idli|Pongal|Sambar|Chutney|Filter Coffee|Buttermilk|Parotta|Chennai/i;
const words = (e) => [e.name].concat(e.groups.reduce((o, g) => o.concat(g.name, g.options.map((x) => x.name)), [])).join(' | ');
for (const cc of ['', 'AU', 'AE', 'SG']) {
  ctx.setCc(cc); const e = ctx.fresh();
  ok('country ' + JSON.stringify(cc) + ': no India word in the combo example', cc === 'AU' || cc === 'AE' || cc === '' || cc === 'SG' ? !INDIA.test(words(e)) : true);
  ok('  …three sections, each with options, a name and a positive price', e.groups.length === 3 && e.groups.every((g) => g.options.length >= 1) && !!e.name && e.price > 0);
}
ctx.setCc('in'); ok('an India shop still gets its Tiffin Combo', ctx.fresh().name === 'Tiffin Combo' && ctx.fresh().groups[0].options[0].name === 'Masala Dosa');
ok('no country set at all = the neutral example', (() => { ctx.setCc(''); return ctx.fresh().name === sample.neutral.comboName; })());
ok('the Offer Lab hands the shop country to the Combo Lab', /comboSampleCountry\(countryOfReply\(body, code\)\)/.test(fs.readFileSync(path.join(ROOT, 'offer-lab-next.html'), 'utf8')));
ok('no India word left as code in combo-mode.js', !/Tiffin Combo|Masala Dosa|Extra sambar/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
console.log(fail ? 'FAIL ' + fail : 'PASS');
process.exit(fail ? 1 : 0);
