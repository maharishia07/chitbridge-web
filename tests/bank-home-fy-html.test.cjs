/* tests/bank-home-fy-html.test.cjs: the Bank page's year switcher must read the year the page holds (BKST.fy) and keep its testids
 * (bank-home-fy, -prev, -now, -next, -all) which the walks and bank17 wait on. A split once renamed fy to financialYear INSIDE the
 * strings and the state key: the switcher read "FY NaN-NaN". Runs the real bankHomeFyHtml in a vm with a stub page. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank-home.js'), 'utf8');
let pass = 0;
const ok = (m) => { pass++; console.log('  ok  ' + m); };
function render(state) {
  const ctx = { BKST: state, tx: (s) => s, txf: (s) => s, shopReg: () => ({ retentionYears: 7, fyStartMonth: 4 }), console };
  ctx.window = { addEventListener() {} }; ctx.document = { addEventListener() {} };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.__html = bankHomeFyHtml();', ctx, { filename: 'cap-bank-home.js' });
  return ctx.__html;
}
for (const fy of [2025, 2026]) {
  const h = render({ fy, cur: 2026, data: { older: 1 }, all: false });
  assert.ok(!/NaN|undefined|null/.test(h), 'no NaN/undefined in the switcher for ' + fy + ': ' + h); ok('fy ' + fy + ': no NaN, no undefined');
  assert.ok(h.includes('data-testid="bank-home-fy-now"') && new RegExp('FY ' + fy).test(h), 'now shows the year'); ok('fy ' + fy + ': bank-home-fy-now names FY ' + fy);
  for (const id of ['bank-home-fy"', 'bank-home-fy-prev', 'bank-home-fy-next', 'bank-home-fy-all']) assert.ok(h.includes('data-testid="' + id) || h.includes('data-testid="' + id.replace('"', '') + '"'), id);
}
ok('the five testids are present');
assert.ok(!/BKST\.financialYear/.test(src), 'no BKST.financialYear read (BKST has no such key)'); ok('BKST.financialYear is not read');
console.log(pass + ' ok');
