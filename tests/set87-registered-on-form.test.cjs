'use strict';
/* SET-87 (twin of api SET-87): the Country setup tax row asks, for a registered shop, the day the registration began (a date, not in the future; it may be earlier than sign-up).
   It is sent as tax.registered_on only when held, shown back on the row, and refused on screen when it is in the future. Runs public/app/cap-country.js in a vm with stubs (no browser).
   Run: node tests/set87-registered-on-form.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const src = fs.readFileSync(__dirname + '/../public/app/cap-country.js', 'utf8');
function load(taxAnswer) {
  const sent = []; const nodes = {}; const runs = [];
  const sb = {
    console, setTimeout, SESSION: { token: 't' }, window: {}, location: {}, navigator: { language: 'en-IN' },
    tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), esc: (s) => String(s == null ? '' : s),
    SHOP_SUPPLIES: [{ v: 'goods', t: 'Goods' }], CBUnsaved: { form() {} }, toast() {}, go() {}, govCtx() { return null; }, modeRibbon: () => '', logo: () => '',
    CBAction: { run(btn, fn, o) { runs.push(o); return fn(); } },
    api: (name, o) => { if (name === 'countrySetupSave') sent.push(o.body); return Promise.resolve({}); },
    document: { getElementById: (id) => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), addEventListener() {} },
  };
  sb.window = sb; const cx = vm.createContext(sb);
  for (const f of ['engine/money.js', 'engine/tax.js', 'engine/locale.js', 'app/shop-time.js', 'app/helpers.js']) vm.runInContext(fs.readFileSync(__dirname + '/../public/' + f, 'utf8'), cx);
  vm.runInContext(src, cx);
  const host = { innerHTML: '' };
  vm.runInContext('CSU.host = null;', cx);
  sb.CSU.host = host; sb.CSU.loading = false; sb.CSU.readErr = true; sb.CSU.flags = {};
  sb.CSU.p = { done: false, country: { code: 'AU' }, currency: 'AUD', fy_start_month: 7, tax: taxAnswer, countries: [] };
  sb.csuPrefill(); sb.renderCountrySetup();
  return { sb, host, sent, runs };
}
const GOOD = '2024-07-01';
const FUTURE = (() => { const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().slice(0, 10); })();
const dateBox = (h) => (h.innerHTML.match(/<input[^>]*id="cs-tax-registered-on"[^>]*>/) || [''])[0];

let t = load({ registered: true, number: '12345678901', scheme: 'regular' });
ok(/type="date"/.test(dateBox(t.host)) && /value=""/.test(dateBox(t.host)) && /max="\d{4}-\d{2}-\d{2}"/.test(dateBox(t.host)), 'a registered shop gets a date box, empty, with today as its latest day');
t.sb.csuSave();
ok(t.sent.length === 1 && !('registered_on' in t.sent[0].tax), 'no day typed: registered_on is not sent (the stored one is left alone)');

t = load({ registered: true, number: '12345678901', scheme: 'regular', registered_on: GOOD });
ok(t.sb.CSU.edit.registeredOn === GOOD && new RegExp('value="' + GOOD + '"').test(dateBox(t.host)), 'the stored day is read into the box');
t.sb.csuSave();
ok(t.sent[0].tax.registered_on === GOOD, 'a held day is sent back with the save');

t = load({ registered: true, number: '12345678901', scheme: 'regular' });
t.sb.csuSet('registeredOn', '1999-04-01'); t.sb.csuSave();
ok(t.sent.length === 1 && t.sent[0].tax.registered_on === '1999-04-01', 'a day earlier than sign-up is allowed and sent');

t = load({ registered: true, number: '12345678901', scheme: 'regular' });
t.sb.csuSet('registeredOn', FUTURE); t.sb.csuSave();
ok(t.sent.length === 0 && /cannot be in the future/.test(t.host.innerHTML), 'a day in the future is refused on screen in words and nothing is sent');
t.sb.csuSet('registeredOn', GOOD); t.sb.csuSave();
ok(t.sent.length === 1 && t.sent[0].tax.registered_on === GOOD, 'fixing the day lets the save through');

t = load({ registered: null });
t.sb.csuSet('registered', 'no'); t.sb.csuSave();
ok(!/cs-tax-registered-on/.test(t.host.innerHTML) && t.sent[0].tax.registered === false && !('registered_on' in t.sent[0].tax), 'a shop that says not registered has no day box and sends no day');
console.log(n + ' passed');
