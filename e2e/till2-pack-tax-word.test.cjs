/**
 * e2e/till2-pack-tax-word.test.cjs — batch 1128 fixTill2 item 4: the shared screens say the PACK's tax word, not a typed "GST".
 * @type regression
 * OWNS      the five shared screens (cap-categories · cap-catsetup · cap-chit2 · cap-definitions · cap-standards): the tax word a shopkeeper reads on a category
 *           badge, a slab explanation, a chit line's tax name, a definition blurb and the standards area label comes from packWord('taxName') (VAT in the UAE),
 *           never a literal "GST"; the definition blurbs are read when drawn (a getter), not frozen at page load. Lifted into a vm with packWord answering VAT.
 * CALLED BY the web offline guards. No browser, no network.
 *   node e2e/till2-pack-tax-word.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'public', 'app');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? '   ok   ' : '   FAIL ') + n); };
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('cap-categories: the slab badge uses the pack word', /packWord\('taxName'\)/.test(read('cap-categories.js')) && !/'GST '\s*\+\s*t\.rate/.test(read('cap-categories.js')));
ok('cap-chit2: a line with no tax name falls back to the pack word, not GST', !/tax_name \|\| 'GST'/.test(read('cap-chit2.js')) && /tax_name \|\| \(\(typeof packWord/.test(read('cap-chit2.js')));
const cs = code(read('cap-catsetup.js'));
ok('cap-catsetup: the slab sentence and the reference heading say the pack word', !/“GST 18%”/.test(cs) && !/tx\('GST slab rates/.test(cs) && /\{tax\} slab rates \(reference\)/.test(cs));
ok('cap-standards: the area label is not GST-only', !/\['money', 'Money & GST'\]/.test(read('cap-standards.js')) && /\['money', 'Money & tax'\]/.test(read('cap-standards.js')));
const defs = read('cap-definitions.js'), i = defs.indexOf('var CBDEF_AUTHORABLE'), j = defs.indexOf('\n};', i) + 3;
const ctx = { tx: (s) => s, packWord: () => 'VAT' };
vm.createContext(ctx); vm.runInContext(defs.slice(i, j) + '\nthis.A = CBDEF_AUTHORABLE;', ctx);
ok('cap-definitions: the tax-slab blurb reads VAT under a VAT pack', /“VAT 18%”/.test(ctx.A.tax.blurb) && !/GST/.test(ctx.A.tax.blurb));
ok('cap-definitions: the certificate blurb names the pack word', /a VAT registration/.test(ctx.A.requirement.blurb) && !/GST/.test(ctx.A.requirement.blurb));
ctx.packWord = () => 'GST'; ok('  …and is read when drawn (changes with the word), not frozen at load', /“GST 18%”/.test(ctx.A.tax.blurb));
ok('cap-definitions: the slab example name uses the pack word', !/\? 'GST 18%'/.test(code(defs)));
console.log(fail ? 'FAIL ' + fail : 'PASS');
process.exit(fail ? 1 : 0);
