'use strict';
/* WALK I I-F-05 (21 Nov 2026): the tax's NAME on the till day report and the day book comes from the country pack (AE: VAT), never a typed "GST"
   (product rule: country words come from the pack). Static guard on the two sources; run: node tests/walki-tax-word.test.cjs */
const fs = require('fs'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const till = fs.readFileSync(__dirname + '/../public/till.html', 'utf8');
const books = fs.readFileSync(__dirname + '/../public/app/cap-books.js', 'utf8');
ok(/t\(schemeWord\(\) \+ ' ' \+ r \+ '% on '/.test(till) && /t\(schemeWord\(\) \+ ' total'/.test(till), 'till day report: rate rows and total use schemeWord() (the pack word)');
ok(!/t\('GST (' \+ r|total'|total', money)/.test(till), 'till day report has no typed GST row label');
ok(/name: gst \? \(typeof packWord === 'function' && packWord\('taxName'\)\) \|\| 'Tax' : item\.name/.test(books), 'day book gist names the tax by packWord(taxName)');
for (const w of ['Composition dealer — no GST', 'not registered for GST', 'will ADD GST', 'splits the GST OUT', 'GST paid <b', 'No GST is charged']) ok(!till.includes(w), 'till: no typed "' + w + '"');
const sw = /function schemeWord\(\)\{ var pack = shopPack\(\); return countryWords\(\)\.taxName/.test(till); ok(sw, 'schemeWord() reads the registry taxName first');
console.log(n + ' passed');
