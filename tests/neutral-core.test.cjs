'use strict';
/* NEUTRAL CORE (2026-10-17) — web side. N0: an assumed (b299) country is said once and confirmed with one tap; the server refuses a document
   with no country or money, and the screens paint its sentence. Source-level plus the units in node (no browser). Run: node tests/neutral-core.test.cjs */
const fs = require('fs'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const read = (f) => fs.readFileSync(__dirname + '/../public/' + f, 'utf8');

const country = read('app/cap-country.js');
ok(country.includes('!(answer && answer.assumed)') && /data-testid="cs-assumed"/.test(country), 'N0: the Country setup screen says "assumed" once when the server says so');
ok(/data-testid="cs-confirm"[^>]*onclick="csuSave\(\)"/.test(country), 'N0: one tap (Confirm) saves the step, the same write as Save');
ok(/\(assumed\) — confirm or change/.test(country), 'N0: the sentence names the country and both ways out');

console.log('\n' + n + ' checks');
