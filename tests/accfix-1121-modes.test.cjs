'use strict';
/**
 * tests/accfix-1121-modes.test.cjs — F-33: UPI is offered only where the shop's pack carries it (chart.paymentModes.upi); an AU/AE shop never sees it.
 * OWNS    the F-33 proof        CALLED BY npm test        CARD    country/pack-reader
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'public', p), 'utf8');
function ctxFor(code) {
  const ctx = { console, tx: (s) => s, SESSION: { country: code } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('engine/tax.js'), ctx, { filename: 'tax.js' });
  const h = read('app/helpers.js');
  for (const n of ['shopReg', 'payHasUpi']) {
    const i = h.indexOf('function ' + n + '('); assert.ok(i >= 0, n);
    vm.runInContext(h.slice(i, h.indexOf('\n}\n', i) + 3), ctx);
  }
  const p = read('app/cap-period.js'), i = p.indexOf('const peModeList');
  vm.runInContext(p.slice(i, p.indexOf('\n', i)).replace('const peModeList', 'var peModeList'), ctx);
  return ctx;
}
const ids = (c) => vm.runInContext('peModeList().map(function(x){return x[0]})', ctxFor(c)).join(',');
assert.strictEqual(ids('IN'), 'cash,bank,upi,card');
assert.strictEqual(ids('AU'), 'cash,bank,card');
assert.strictEqual(ids('AE'), 'cash,bank,card');
assert.ok(!/\['upi', 'UPI'\],\s*\['card'/.test(read('app/cap-period.js')), 'no hard-coded UPI row');
console.log('accfix-1121-modes: 4 ok');
