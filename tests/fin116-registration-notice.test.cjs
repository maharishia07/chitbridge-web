'use strict';
/* FIN-116 remainder: a shop that never said whether it is tax registered is told so on the bank sheet (hand-computed: AU, bank fee A$22.00 stays 22.00 whole, no credit, until answered).
   Run: node tests/fin116-registration-notice.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(__dirname + '/../public/app/cap-bank-sheet.js', 'utf8');
function fn(name) {
  const i = text.indexOf('function ' + name + '('); assert(i >= 0, name);
  let d = 0;
  for (let k = text.indexOf('{', i); k < text.length; k++) { if (text[k] === '{') d++; else if (text[k] === '}' && --d === 0) return text.slice(i, k + 1); }
}
const cx = vm.createContext({ packWord: () => 'GST', txf: (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => v[k]), tx: (s) => s });
vm.runInContext(fn('bkshFirstWords') + fn('bkshTaxRegisteredFor'), cx);
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const said = { ok: true };
ok(/has not said whether it is registered for GST.*no GST credit.*Country setup/.test(cx.bkshFirstWords(said, null)), 'unanswered: the notice names GST, the whole-figure cost and Country setup');
ok(cx.bkshFirstWords(said, true) === '' && cx.bkshFirstWords(said, false) === '', 'answered yes or no: no notice');
ok(/Could not check/.test(cx.bkshFirstWords(said, 'unread')), 'unread: the existing words stand');
ok(cx.bkshFirstWords({ ok: false, why: 'X' }, null) === 'X', 'the engine refusal still comes first');
ok(cx.bkshTaxRegisteredFor(null) === null, 'posting unchanged: unanswered stays unknown, so A$22.00 posts as 22.00 expense, no input tax');
console.log(n + ' ok');
