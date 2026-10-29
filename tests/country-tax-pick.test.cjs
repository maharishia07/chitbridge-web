'use strict';
/* SET-49 (twin of api #528): Country setup's Tax pick has no default. Unknown stays null; only an explicit "not registered" is false.
   Runs public/app/cap-country.js in a vm with stubs (no browser). Run: node tests/country-tax-pick.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const src = fs.readFileSync(__dirname + '/../public/app/cap-country.js', 'utf8');
function load(taxAnswer) {
  const sent = []; const nodes = {};
  const sb = {
    console, setTimeout, SESSION: { token: 't' }, window: {}, location: {}, navigator: { language: 'en-IN' },
    tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), esc: (s) => String(s == null ? '' : s),
    SHOP_SUPPLIES: [{ v: 'goods', t: 'Goods' }], CBUnsaved: { form() {} }, toast() {}, go() {}, govCtx() { return null; }, modeRibbon: () => '', logo: () => '',
    CBAction: { run(btn, fn) { return fn(); } },
    api: (name, o) => { if (name === 'countrySetupSave') sent.push(o.body); return Promise.resolve({}); },
    document: { getElementById: (id) => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), addEventListener() {} },
  };
  sb.window = sb; const cx = vm.createContext(sb);
  for (const f of ['engine/money.js', 'engine/tax.js', 'engine/locale.js', 'app/helpers.js']) vm.runInContext(fs.readFileSync(__dirname + '/../public/' + f, 'utf8'), cx);
  vm.runInContext(src, cx);
  const host = { innerHTML: '' };
  vm.runInContext('CSU.host = null;', cx);
  sb.CSU.host = host; sb.CSU.loading = false; sb.CSU.readErr = true; sb.CSU.flags = {};
  sb.CSU.p = { done: false, country: { code: 'AU' }, currency: 'AUD', fy_start_month: 7, tax: taxAnswer, countries: [] };
  sb.csuPrefill(); sb.renderCountrySetup();
  return { sb, host, sent };
}
const taxHtml = (h) => (h.innerHTML.match(/id="cs-tax-reg"[\s\S]*?<\/select>/) || [''])[0];

let t = load({ registered: null, number: null, scheme: null });
ok(t.sb.CSU.edit.registered === null, 'null from the server stays null in the edit state (not false)');
ok(!/ selected>Not registered|selected>Registered/.test(taxHtml(t.host)) && /<option value=""[^>]* selected>Pick one/.test(taxHtml(t.host)), 'null shows no selection (only "Pick one")');
t.sb.csuSave();
ok(t.sent.length === 1 && t.sent[0].tax.registered === null, 'Tax untouched: Save sends registered:null, never false');

t = load({ registered: null });
t.sb.csuOpen('tax'); t.sb.csuSave();
ok(t.sent.length === 0 && /Pick registered or not registered/.test(t.host.innerHTML), 'Tax opened with no pick: Save asks and sends nothing');

t = load({ registered: null });
t.sb.csuSet('registered', 'no'); t.sb.csuSave();
ok(t.sent.length === 1 && t.sent[0].tax.registered === false && t.sent[0].tax.number === null, 'explicit "not registered" sends false');

t = load({ registered: null });
t.sb.csuSet('registered', 'yes'); t.sb.csuSet('number', '12345678901');
t.sb.csuSave();
ok(t.sent.length === 1 && t.sent[0].tax.registered === true && t.sent[0].tax.number === '12345678901', 'registered sends true plus the number');

t = load({ registered: false });
ok(t.sb.CSU.edit.registered === false, 'a stored explicit false stays false');
console.log(n + ' passed');
