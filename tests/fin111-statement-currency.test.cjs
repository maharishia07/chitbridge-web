'use strict';
/* FIN-111 (B5-05) invariant: a statement's currency is never taken from the account unasked. A file that does not say its currency (USD file, AUD account) is asked, not read as AUD.
   Hand cases: file 'USD' -> USD; no file currency, nothing confirmed -> '' (ask); no file currency, confirmed 'usd' on this device -> USD; file wins over a stale confirmation.
   Run: node tests/fin111-statement-currency.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(__dirname + '/../public/app/cap-bank.js', 'utf8');
function fn(name) {
  const i = text.indexOf('function ' + name + '('); assert(i >= 0, name);
  let d = 0;
  for (let k = text.indexOf('{', i); k < text.length; k++) { if (text[k] === '{') d++; else if (text[k] === '}' && --d === 0) return text.slice(i, k + 1); }
}
const cx = vm.createContext({});
vm.runInContext(fn('bkbStatementCurrency'), cx);
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
ok(cx.bkbStatementCurrency('USD', '') === 'USD', 'the file says USD: USD');
ok(cx.bkbStatementCurrency('', '') === '' && cx.bkbStatementCurrency(undefined, undefined) === '', 'the file is silent, nothing confirmed: asked (empty), not the account\'s');
ok(cx.bkbStatementCurrency('', 'usd') === 'USD', 'confirmed once for this file: not asked again');
ok(cx.bkbStatementCurrency('EUR', 'USD') === 'EUR', 'the file wins over a confirmation');
ok(!/BKB\.stmtCur = parsed\.currency \|\| bkbAcctCur\(\)/.test(text), 'the account default is gone from bankTake');
console.log(n + ' ok');
