'use strict';
/**
 * tests/acc363-pack-reader.test.cjs — ACC-363: the web reads a shop's registration form (schemes · second id · exporter ids · id check · rail return)
 * from the ONE reader helpers.js packRegForm (the pack's tax.registrationForm), never from a country code. One block per changed display, run for IN · AU · AE
 * and a shop with no pack; and a guard that fails when a quoted country-code literal comes back into those files.
 * OWNS    the ACC-363 proof        CALLED BY npm test (tests/*.test.cjs)       CARD    country/pack-reader
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'public');
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
let pass = 0;
const ok = (m) => { pass++; console.log('  ok  ' + m); };

/** the source of one top-level function or var, by name (to the closing brace / semicolon at column 0) */
function part(src, name) {
  const m = new RegExp('^(?:function ' + name + '\\(|var ' + name + ' =)', 'm').exec(src);
  assert.ok(m, 'found ' + name);
  const rest = src.slice(m.index);
  if (rest.startsWith('function')) return rest.slice(0, rest.search(/\n}\n/) + 3);
  const lines = rest.split('\n'), out = [];
  for (const l of lines) { out.push(l); if (/[;]\s*(\/\*.*\*\/)?\s*$/.test(l) && !/^\s/.test(l.slice(0, 1)) || /^};?$/.test(l)) break; }
  return out.join('\n');
}
/** a context with the REAL packs (engine/tax.js) and the real helpers.js reader */
function ctxFor(code, extra) {
  const ctx = Object.assign({ console, tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), SESSION: { country: code } }, extra || {});
  ctx.window = ctx; ctx.document = { head: { appendChild() {} }, createElement: () => ({}) };
  vm.createContext(ctx);
  vm.runInContext(read('engine/tax.js'), ctx, { filename: 'tax.js' });
  const helpers = read('app/helpers.js');
  const names = ['shopReg', 'packWord', 'packRowKey', 'packRegForm', 'taxIdWord', 'bankCodeWord', 'PACK_WORDS', 'PACK_WORDS_NONE', 'REG_FORM_NONE'];
  vm.runInContext(names.map((n) => part(helpers, n)).join('\n'), ctx, { filename: 'helpers.js' });
  return ctx;
}
const run = (ctx, src, expr) => vm.runInContext(src + '\n(' + expr + ')', ctx);

/* 1 - the reader itself */
const form = { IN: ctxFor('IN'), AU: ctxFor('AU'), AE: ctxFor('AE'), '': ctxFor('') };
const rf = (c) => run(form[c], '', 'packRegForm(SESSION.country)');
assert.deepStrictEqual([].concat(rf('IN').schemes), ['regular', 'composition']); ok('IN: regular + composition');
assert.deepStrictEqual([].concat(rf('AU').schemes), ['regular']); assert.deepStrictEqual([].concat(rf('AE').schemes), ['regular']); ok('AU and AE: regular only');
assert.deepStrictEqual([].concat(rf('').schemes), ['regular']); assert.strictEqual(rf('').railReturn, false); assert.strictEqual(rf('').idCheck, null); ok('no pack: the neutral form, never India');
assert.strictEqual(rf('IN').railReturn, true); assert.strictEqual(rf('AU').railReturn, false); assert.strictEqual(rf('AE').railReturn, false); ok('rail return: IN only (finance returns card and MIS tax band read this)');
const bank = (c) => run(form[c], '', 'bankCodeWord(SESSION.country)')[1];
assert.deepStrictEqual(['IN', 'AU', 'AE', ''].map(bank), ['ifsc', 'bsb', 'iban', 'bank_code']); ok('bank code word: ifsc · bsb · iban · neutral (no India default)');

/* 2 - cap-shop: licence rows and the GSTIN hint */
const shop = read('app/cap-shop.js');
const shopParts = ['LICENCE_ROWS', 'VAULT_HINT', 'licenceSuggest', 'vaultRowHint'].map((n) => part(shop, n)).join('\n') + '\nvar shopCc = function () { return SESSION.country; };';
const list = [['GSTIN', 'gstin'], ['PAN', 'pan'], ['IEC', 'iec'], ['LUT', 'lut'], ['AD code', 'ad_code'], ['Trade name', 'trade_name']];
const tags = (c) => run(form[c], shopParts, 'licenceSuggest(' + JSON.stringify(list) + ', SESSION.country, { gstin: taxIdWord(SESSION.country) }).map(function (x) { return x[1]; })');
assert.deepStrictEqual([].concat(tags('IN')), ['gstin', 'pan', 'licence_name', 'licence_no', 'issuer', 'valid_until', 'iec', 'lut', 'ad_code', 'trade_name']); ok('licence rows IN: tax id, PAN, standard rows, exporter ids');
assert.deepStrictEqual([].concat(tags('AU')), ['gstin', 'acn', 'licence_name', 'licence_no', 'issuer', 'valid_until', 'trade_name']); ok('licence rows AU: ACN second, no exporter ids');
assert.deepStrictEqual([].concat(tags('AE')), ['gstin', 'licence_name', 'licence_no', 'issuer', 'valid_until', 'trade_name']); ok('licence rows AE: no second id, no exporter ids');
const hint = (c) => run(form[c], shopParts, "vaultRowHint('gstin')");
assert.deepStrictEqual(['IN', 'AU', 'AE'].map(hint), ['15 characters', '', '']); ok('GSTIN hint: IN only');

/* 3 - cap-country: the tax row, the id check, the year, the scheme fallback */
const cc = read('app/cap-country.js');
const stubs = 'var CSU = { p: null, edit: null }; function csuPackOf() { return null; } function csuCountryName(c) { return c; } function csuRow() { return Array.prototype.join.call(arguments, "|"); } function csuSel(id) { return "SEL:" + id; } function csuSchemeInfo() { return ""; } function csuTaxIdHint() { return ""; } var CSU_SCHEME_WHY = {}; function csuScheme() { return "GST"; } function esc(s) { return s; }';
const taxParts = stubs + ['csuPack', 'csuTaxRow', 'csuTaxSummary', 'csuTaxRowHTML', 'csuYearFromPack', 'csuGstinWhy', 'csuTaxIdWhy', 'csuTodayISO'].map((n) => part(cc, n)).join('\n');
const row = (c, scheme) => run(form[c], taxParts, 'csuTaxRow({ country: SESSION.country, registered: true, scheme: ' + JSON.stringify(scheme) + ', number: "N" }, {})');
assert.ok(row('IN', 'composition').includes('SEL:cs-tax-scheme') && row('IN', 'composition').includes('Composition')); ok('tax row IN: the scheme picker and "Composition"');
for (const c of ['AU', 'AE']) assert.ok(!row(c, 'regular').includes('cs-tax-scheme') && row(c, 'regular').includes('Registered'), c);
ok('tax row AU/AE: no scheme picker, "Registered"');
const yr = (c) => run(form[c], taxParts, '(function () { var e = { country: SESSION.country }, s = {}; csuYearFromPack(e, s); return [e.fy, s.fy_start_month]; })()');
assert.strictEqual(yr('IN')[0], 4); assert.strictEqual(yr('AU')[0], 7); assert.strictEqual(yr('AE')[0], 1); ok('year from the pack: IN April · AU July · AE January');
assert.strictEqual(yr('')[0], 1); assert.strictEqual(yr('')[1], 'the usual year'); ok('no pack: calendar year, "the usual year" (not India\'s April)');
const why = (c, n) => run(ctxFor(c, { CBProfileMap: { gstinChecksum: () => ({ ok: false, reason: 'checksum' }) } }), taxParts, 'csuTaxIdWhy(SESSION.country, ' + JSON.stringify(n) + ')');
assert.ok(/GSTIN.*does not check out/.test(why('IN', '27AAPFU0939F1ZV'))); ok('id check IN: the profile map, worded with the pack\'s GSTIN');
assert.ok(why('AU', '123').length > 0 && !/GSTIN/.test(why('AU', '123'))); assert.ok(!/GSTIN/.test(why('AE', '123'))); ok('id check AU/AE: the pack\'s own checker, no GSTIN words');

/* 4 - cap-admin: the MIS tax band */
const mis = read('app/cap-admin.js');
const band = (c) => run(form[c], 'var UI = { _taxLedger: undefined }; function loadTaxLedger() {} function _misHead(a, b) { return a + ":" + b; }' + part(mis, 'misTax'), 'misTax()');
assert.ok(band('IN').includes('reading…')); ok('MIS band IN: reads the rail');
for (const c of ['AU', 'AE']) assert.ok(band(c).includes("This band reads India's GST"), c);
ok('MIS band AU/AE: told where the return is');

/* 5 - guard: no quoted country-code literal in code (comments stripped) in the ACC-363 files */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
for (const f of ['cap-country.js', 'cap-shop.js', 'cap-admin.js', 'cap-finance-returns.js', 'cap-finance-cash.js', 'cap-books.js']) {
  const hits = strip(read('app/' + f)).match(/['"`](IN|AU|AE)['"`]/g) || [];
  assert.deepStrictEqual(hits, [], f + ' holds a quoted country code: read the pack (helpers.js packRegForm / packWord) instead');
}
const helpersCode = strip(read('app/helpers.js'));
assert.ok(!/PACK_WORDS\.(IN|AU|AE)\b/.test(helpersCode) && !/['"`](IN|AU|AE)['"`]/.test(helpersCode));
ok('guard: no country-code literal in the ACC-363 files');
console.log(pass + ' ok');
