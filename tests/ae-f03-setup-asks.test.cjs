'use strict';
/* AE-F-03 (Walk AE 21 Nov): Country setup draws the questions the pack asks (the server's `asks`: Emirate · VAT period · zone), sends the picks as `particulars`, and a
   pack that asks nothing draws no row. Runs public/app/cap-country.js in a vm with stubs (no browser). Run: node tests/ae-f03-setup-asks.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const src = fs.readFileSync(__dirname + '/../public/app/cap-country.js', 'utf8');
const ASKS = [
  { key: 'region', label: 'Emirate', kind: 'choice', options: [{ value: 'Dubai', label: 'Dubai' }, { value: 'Sharjah', label: 'Sharjah' }], why: 'one emirate' },
  { key: 'period', label: 'Return period', kind: 'choice', options: [{ value: '4', label: 'Every month' }], why: '' },
  { key: 'zone', label: 'In a designated zone', kind: 'choice', options: [{ value: 'no', label: 'No, mainland' }, { value: 'yes', label: 'Yes' }], why: '' }
];
function load(code, asks, asked) {
  const sent = []; const runs = [];
  const sb = {
    console, setTimeout, SESSION: { token: 't' }, window: {}, location: {}, navigator: { language: 'en-AE' },
    tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), esc: (s) => String(s == null ? '' : s),
    SHOP_SUPPLIES: [{ v: 'goods', t: 'Goods' }], CBUnsaved: { form() {} }, toast() {}, go() {}, govCtx() { return null; }, modeRibbon: () => '', logo: () => '',
    CBAction: { run(btn, fn, o) { runs.push(o); return fn(); } },
    api: (name, o) => { if (name === 'countrySetupSave') sent.push(o.body); return Promise.resolve({}); },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), addEventListener() {} },
  };
  sb.window = sb; const cx = vm.createContext(sb);
  for (const f of ['engine/money.js', 'engine/tax.js', 'engine/locale.js', 'app/shop-time.js', 'app/helpers.js']) vm.runInContext(fs.readFileSync(__dirname + '/../public/' + f, 'utf8'), cx);
  vm.runInContext(src, cx);
  const host = { innerHTML: '' };
  sb.CSU.host = host; sb.CSU.loading = false; sb.CSU.readErr = true; sb.CSU.flags = {};
  sb.CSU.p = { done: true, country: { code }, currency: code === 'AE' ? 'AED' : 'INR', fy_start_month: 1, tax: { registered: true, number: '100234567800003', scheme: 'regular' }, asks, asked: asked || {}, countries: [] };
  sb.csuPrefill(); sb.renderCountrySetup();
  return { sb, host, sent, runs };
}
let t = load('AE', ASKS, {});
ok(/data-testid="cs-row-ask_region"/.test(t.host.innerHTML) && /data-testid="cs-row-ask_period"/.test(t.host.innerHTML) && /data-testid="cs-row-ask_zone"/.test(t.host.innerHTML), 'the pack asks Emirate, VAT period and zone as rows');
ok(/id="cs-ask-region"/.test(t.host.innerHTML) && /<option value="Dubai"/.test(t.host.innerHTML), 'the Emirate row offers the pack\'s own list');
t.sb.csuSet('ask:region', 'Dubai'); t.sb.csuSet('ask:period', '4'); t.sb.csuSave();
ok(t.sent.length === 1 && t.sent[0].particulars.region === 'Dubai' && t.sent[0].particulars.period === '4' && t.sent[0].particulars.zone === null, 'Save sends the picks as particulars, an unanswered question as null');
t = load('AE', ASKS, { region: 'Sharjah', zone: 'no' });
ok(/Sharjah/.test(t.host.innerHTML) && !/id="cs-ask-region"/.test(t.host.innerHTML), 'a held answer is shown, its picker closed');
t = load('IN', [], {});
ok(!/cs-row-ask_/.test(t.host.innerHTML), 'a pack that asks nothing draws no extra row');
t.sb.csuSave();
ok(t.sent.length === 1 && t.sent[0].particulars === undefined, 'and sends no particulars');
console.log(n + ' passed');
