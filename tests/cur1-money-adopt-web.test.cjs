/**
 * tests/cur1-money-adopt-web.test.cjs - CUR-1: the web's adopted public/engine/money.js (pin v1.89.0) is the ISO 4217 value type.
 * Twin of api tests/cur1-money-adopt.test.cjs: the till and the server must answer the same (HUF 2, PTS and unlisted refused).
 * Break case: on money 1.0.0 HUF answers 0, ZZZ answers 2 and PTS makes, so each assertion below fails.
 * MIN unit-test
 * Run: node tests/cur1-money-adopt-web.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const cx = vm.createContext({});
cx.window = cx; cx.self = cx;
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'engine', 'money.js'), 'utf8'), cx);
const M = cx.CBMoney;
let n = 0;
const ok = (body, what) => { body(); n++; console.log('  ok  ' + what); };
const refuses = (body, code, status) => assert.throws(body, (e) => e && e.code === code && e.status === status);

ok(() => { const want = { INR: 2, USD: 2, AUD: 2, AED: 2, HUF: 2, JPY: 0, KWD: 3 }; Object.keys(want).forEach((c) => assert.strictEqual(M.decimals(c), want[c], c)); }, 'the minor unit is ISO 4217 (HUF 2 by Athi, 11 Nov)');
ok(() => ['ZZZ', 'PTS', 'INRR'].forEach((c) => refuses(() => M.decimals(c), 'MONEY_CURRENCY_UNKNOWN', 422)), 'an unlisted code is refused (422), not answered 2');
ok(() => { refuses(() => M.make(50, 'PTS'), 'MONEY_CURRENCY_UNKNOWN', 422); assert.strictEqual(M.make(50, 'INR').currency, 'INR'); }, 'a point cannot be stamped as money');
ok(() => refuses(() => M.plusMoney(M.makeMinor(100, 'INR'), M.makeMinor(100, 'USD')), 'MONEY_CURRENCY_MISMATCH', 409), 'a currency mismatch is refused loudly');
console.log('\n  ' + n + ' checks\n');
