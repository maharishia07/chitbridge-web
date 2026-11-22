'use strict';
// @type: unit
/* tests/date-one-formatter.test.cjs — AE-F-05 / AE-F-10 / AE-F-20 (WALK-AE 2026-11-21): dates and times format through ONE formatter (public/app/shop-time.js).
 * HAND-COMPUTED  the moment 2026-11-21T20:30:00Z is 22 Nov 2026 00:30 in Dubai (UTC+4), 22 Nov 07:30 in Sydney (UTC+11), 22 Nov 02:00 in Kolkata (UTC+5:30), 21 Nov in Los Angeles (UTC-8, 12:30).
 *   An AE shop (locale ar-AE) on an English screen reads "22 Nov 2026" and 22/11/2026, Latin digits, no Arabic letter anywhere; the browser zone (here Kolkata) never decides.
 *   today() at that moment is 2026-11-22 for the Dubai shop and 2026-11-21 for a Los Angeles shop; a stored subject holds that ISO day.
 *   GUARD: no toLocaleDateString / toLocaleTimeString / Intl.DateTimeFormat / Date.toLocaleString in public/ outside shop-time.js, engine/ (adopted), vendor/ and lines marked zone-ok.
 * OWNS the one-formatter rule: app/shop-time.js and the call sites that were routed to it. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const PUB = path.join(__dirname, '..', 'public');
let pass = 0;
const ok = (n, f) => { f(); pass++; console.log('  ok   ' + n); };
function world(store, zone) {
  const root = { console, Intl, Date, Math, Object, String, Number, Array, RegExp, JSON, isNaN, Error };
  root.window = root; root.globalThis = root; root.self = root;
  root.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  root.document = { documentElement: { setAttribute() {}, style: {}, lang: '', dir: '' }, addEventListener() {}, querySelectorAll: () => [], getElementById: () => null, head: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {} }) };
  root.navigator = { language: 'en-IN', languages: ['en-IN'] };
  root.addEventListener = () => {}; root.setTimeout = setTimeout; root.requestAnimationFrame = () => {};
  if (zone) root.CB_SHOP_TZ = zone;
  const ctx = vm.createContext(root);
  vm.runInContext(fs.readFileSync(path.join(PUB, 'engine', 'locale.js'), 'utf8'), ctx, { filename: 'locale.js' });
  vm.runInContext(fs.readFileSync(path.join(PUB, 'app', 'shop-time.js'), 'utf8'), ctx, { filename: 'shop-time.js' });
  return root;
}
const MOMENT = '2026-11-21T20:30:00Z';
const NO_ARABIC = /[\u0600-\u06FF\u0660-\u0669]/;
ok('AE shop, ar-AE format, English UI, Dubai zone: 22 Nov 2026, 22/11/2026, no Arabic letter or digit', () => {
  const w = world({ cb_locale: 'ar-AE', cb_lang: 'en', cb_tz: 'Asia/Kolkata' }, 'Asia/Dubai');
  assert.strictEqual(w.CBShopTime.date(MOMENT), '22 Nov 2026');
  assert.strictEqual(w.CBLocale.date(MOMENT), '22 Nov 2026'); // the engine's own caller now answers through the one formatter
  assert.strictEqual(w.CBShopTime.date(MOMENT, { day: '2-digit', month: '2-digit', year: 'numeric' }), '22/11/2026');
  assert.ok(!NO_ARABIC.test(w.CBShopTime.datetime(MOMENT, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })));
});
ok('the zone is the shop\'s (Dubai 00:30, Sydney 07:30), never the browser\'s Kolkata', () => {
  assert.ok(/12:30\s?am|00:30/i.test(world({ cb_locale: 'ar-AE', cb_tz: 'Asia/Kolkata' }, 'Asia/Dubai').CBShopTime.time(MOMENT)));
  assert.ok(/7:30\s?am|07:30/i.test(world({ cb_locale: 'en-AU', cb_tz: 'Asia/Kolkata' }, 'Australia/Sydney').CBShopTime.time(MOMENT)));
  assert.strictEqual(world({ cb_locale: 'en-AU' }, 'Australia/Sydney').CBShopTime.date(MOMENT, { day: '2-digit', month: '2-digit', year: 'numeric' }), '22/11/2026');
});
ok('a bare day is a calendar day: no zone moves it; month words follow the UI language, in English here', () => {
  const w = world({ cb_locale: 'ar-AE' }, 'Pacific/Kiritimati');
  assert.strictEqual(w.CBShopTime.day('2026-11-21'), '21 Nov 2026');
  assert.strictEqual(w.CBShopTime.day('2026-01', { month: 'long' }), 'January 2026');
  assert.strictEqual(w.CBShopTime.month(0, 'short'), 'Jan');
});
ok('today() is the shop\'s ISO day: Dubai 2026-11-22, Los Angeles 2026-11-21 (stored text holds this, never a formatted date)', () => {
  assert.strictEqual(world({ cb_locale: 'ar-AE' }, 'Asia/Dubai').CBShopTime.today(MOMENT), '2026-11-22');
  assert.strictEqual(world({ cb_locale: 'en-US' }, 'America/Los_Angeles').CBShopTime.today(MOMENT), '2026-11-21');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(world({}, 'Asia/Dubai').CBShopTime.today()));
});
ok('an unknown shop zone is dropped (the person\'s own stays), an unreadable moment is empty, never "Invalid Date"', () => {
  const w = world({ cb_locale: 'en-AU', cb_tz: 'Asia/Kolkata' }, 'Not/AZone');
  assert.strictEqual(w.CBShopTime.zone(), 'Asia/Kolkata');
  assert.strictEqual(w.CBShopTime.date('nonsense'), '');
  assert.strictEqual(w.CBShopTime.date(null), '');
});
ok('the app.html Counter-sale subject stores the ISO day, not a formatted date', () => {
  const src = fs.readFileSync(path.join(PUB, 'app.html'), 'utf8'), a = src.indexOf('function selfBillSubject()');
  assert.ok(/CBShopTime\.today\(\)/.test(src.slice(a, a + 400)) && !/CBLocale\.date/.test(src.slice(a, a + 400)));
});
// ---- the guard ----
const FLAG = /toLocale(?:Date|Time)String\s*\(|Intl\s*\.\s*DateTimeFormat|\b(?:new Date\([^)]*\)|when|date|moment|d|t)\s*\.\s*toLocaleString\s*\(/;
const ALLOW = (rel) => rel === 'app/shop-time.js' || rel.startsWith('engine/') || rel.includes('/vendor/') || rel.startsWith('vendor/');
function walk(dir, out) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(js|html)$/.test(e.name)) out.push(p); } return out; }
ok('GUARD: no date/time formatter call outside shop-time.js, engine/, vendor/', () => {
  const bad = [];
  for (const file of walk(PUB, [])) {
    const rel = path.relative(PUB, file).split(path.sep).join('/');
    if (ALLOW(rel)) continue;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => { if (FLAG.test(line) && !/zone-ok/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) bad.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 110)); });
  }
  assert.strictEqual(bad.length, 0, 'second date formatters:\n   ' + bad.join('\n   '));
});
console.log('\n' + pass + ' passed');
