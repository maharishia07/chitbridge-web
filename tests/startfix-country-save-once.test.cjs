'use strict';
/* A-F-15 (Walk A 21 Nov): ONE press of Save saves. The press blurs the number box, its change repaints the row and replaces the Save button before the click lands;
   the press is remembered (pointerdown) and the change saves. Same vm harness as country-tax-pick.test.cjs.
   Runs public/app/cap-country.js in a vm with stubs (no browser). Run: node tests/country-tax-pick.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const src = fs.readFileSync(__dirname + '/../public/app/cap-country.js', 'utf8');
function load(taxAnswer) {
  const sent = []; const nodes = { 'cs-save': {} }; const runs = [];
  const sb = {
    console, setTimeout, SESSION: { token: 't' }, window: {}, location: {}, navigator: { language: 'en-IN' },
    tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), esc: (s) => String(s == null ? '' : s),
    SHOP_SUPPLIES: [{ v: 'goods', t: 'Goods' }], CBUnsaved: { form() {} }, toast() {}, go() {}, govCtx() { return null; }, modeRibbon: () => '', logo: () => '',
    CBAction: { run(btn, fn, o) { runs.push(o); return fn(); } },
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
  return { sb, host, sent, runs, nodes };
}

let t = load({ registered: null });
ok(typeof t.nodes['cs-save'].onpointerdown === 'function', 'Save listens for the press itself (pointerdown)');
t.sb.csuSet('registered', 'yes');
t.sb.csuSet('number', '51824753556');
ok(t.sent.length === 0, 'typing the number alone sends nothing');
t.nodes['cs-save'].onpointerdown();
t.sb.csuSet('number', '51824753556'); /* the blur the press causes: change -> repaint */
ok(t.sent.length === 1 && t.sent[0].tax.registered === true && t.sent[0].tax.number === '51824753556', 'press on Save while the number is still being typed: ONE call, with the typed number');
t.sb.csuSet('number', '51824753556');
ok(t.sent.length === 1, 'a later edit does not send again');

t = load({ registered: null });
t.sb.csuSet('registered', 'yes');
t.nodes['cs-save'].onpointerdown(); t.nodes['cs-save'].onclick(); /* the box was already committed: the click lands as it always did */
t.sb.csuSet('number', '51824753556');
ok(t.sent.length === 1 && t.sent[0].tax.registered === true, 'a press whose click lands saves once; a later edit does not send');

t = load({ registered: null });
t.sb.csuSet('registered', 'yes');
t.nodes['cs-save'].onpointerdown();
t.sb.csuSet('number', '12345'); /* a number the checker refuses keeps the row open with its reason — nothing is sent */
ok(t.sent.length === 0 && /cs-tax-error|Registered/.test(t.host.innerHTML) && t.sb.CSU.taxErr, 'a refused number is not sent by the press; the reason is on the row');
setTimeout(() => process.exit(0), 50);
console.log(n + ' passed');
