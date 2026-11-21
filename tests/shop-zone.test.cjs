/**
 * tests/shop-zone.test.cjs — E-F-06 (walk E, 21 Nov): EVERY DISPLAYED TIME USES THE SHOP'S OWN ZONE, never the device's and never a typed Asia/Kolkata.
 *
 *   1. helpers.js shopZoneInstall: with no zone chosen by the person, CBLocale.timezone() answers window.CB_SHOP_TZ (the one /me read: avatar.js) — so CBLocale.time /
 *      datetime / date and shopDateTime agree; the person's own cb_tz choice still wins; no shop zone -> the device's answer; an unknown zone is ignored.
 *   2. avatar.js hands the /me timezone to window.CB_SHOP_TZ.
 *   3. GUARD (a list that only shrinks): no hardcoded zone (Asia/Kolkata · +05:30 · IST) in public/app/*.js beyond the named exceptions, and no new direct
 *      toLocaleTimeString/toLocaleString with an hour in public/app/*.js — a time goes through shopDateTime / CBLocale.time.
 *
 * No browser. Run: node tests/shop-zone.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const APP = path.join(__dirname, '..', 'public', 'app');
let pass = 0;
const ok = (what, fn) => { fn(); pass++; console.log('  ok  ' + what); };

/* ── 1. the shim, run against helpers.js with a stand-in CBLocale ── */
function load(opts) {
  const store = Object.assign({}, opts.ls || {});
  const win = { CB_SHOP_TZ: opts.shop || '' };
  const L = { timezone: () => store.cb_tz || 'Asia/Kolkata' }; /* the engine's own: the person's choice, else the device */
  const g = { window: win, CBLocale: L, localStorage: { getItem: (k) => (k in store ? store[k] : null) } };
  const src = fs.readFileSync(path.join(APP, 'helpers.js'), 'utf8');
  new Function('window', 'CBLocale', 'localStorage', 'document', src + '\n;return typeof shopZoneInstall === "function";')(win, L, g.localStorage, undefined);
  return { L, win };
}
ok('a shop zone and no personal choice -> the shop zone', () => { const { L } = load({ shop: 'Australia/Sydney' }); assert.strictEqual(L.timezone(), 'Australia/Sydney'); });
ok('the person\'s own choice (cb_tz) still wins', () => { const { L } = load({ shop: 'Australia/Sydney', ls: { cb_tz: 'Europe/London' } }); assert.strictEqual(L.timezone(), 'Europe/London'); });
ok('no shop zone stated -> the device answer, nothing guessed', () => { const { L } = load({}); assert.strictEqual(L.timezone(), 'Asia/Kolkata'); });
ok('an unknown shop zone is ignored (a date in the wrong zone beats no date)', () => { const { L } = load({ shop: 'Nowhere/Land' }); assert.strictEqual(L.timezone(), 'Asia/Kolkata'); });
ok('the zone follows a later /me answer (read at call time, not at load)', () => { const { L, win } = load({}); win.CB_SHOP_TZ = 'Australia/Sydney'; assert.strictEqual(L.timezone(), 'Australia/Sydney'); });

/* ── 2. avatar.js ── */
ok('avatar.js sets CB_SHOP_TZ from the one /me read', () => {
  assert(/root\.CB_SHOP_TZ\s*=\s*String\(e\.timezone\)/.test(fs.readFileSync(path.join(APP, 'avatar.js'), 'utf8')));
});

/* ── 3. the guard ── */
const files = fs.readdirSync(APP).filter((f) => f.endsWith('.js') && !/\.min\./.test(f));
/* the code lines of a file with numbers: block comments are blanked (keeping line numbers), then // lines dropped */
const codeOf = (f) => {
  const text = fs.readFileSync(path.join(APP, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return text.split('\n').map((line, n) => ({ line, n: n + 1 })).filter((x) => !/^\s*\/\//.test(x.line) && x.line.trim() !== '');
};
/* the named exceptions: a picker's fallback list of zones the person may CHOOSE, and a Standards table row that DESCRIBES the IANA form */
const ZONE_OK = { 'cap-admin.js': /tzAll\.length \? tzAll : \[/, 'cap-standards.js': /std: 'IANA tz'/ };
ok('no hardcoded Asia/Kolkata · +05:30 · IST zone in public/app (named exceptions only)', () => {
  const bad = [];
  files.forEach((f) => codeOf(f).forEach((x) => { if (/Asia\/Kolkata|\+05:30|\bIST\b/.test(x.line) && !(ZONE_OK[f] && ZONE_OK[f].test(x.line))) bad.push(f + ':' + x.n); }));
  assert.deepStrictEqual(bad, [], 'a displayed time uses the shop zone (shopDateTime / CBLocale), never a typed one: ' + bad.join(' '));
});
/* a ratchet: today's direct clock formatters outside the one formatter. It may only shrink. */
const CLOCK_DIRECT = { 'rail-bell-html.js': 1 /* the fallback after CBLocale.datetime throws */ };
ok('no new direct toLocaleTimeString / toLocaleString-with-an-hour in public/app (ratchet)', () => {
  const seen = {};
  files.forEach((f) => codeOf(f).forEach((x) => { if (/toLocaleTimeString\(|toLocaleString\([^)]*hour/.test(x.line)) seen[f] = (seen[f] || 0) + 1; }));
  Object.keys(seen).forEach((f) => assert((CLOCK_DIRECT[f] || 0) >= seen[f], f + ' formats a clock itself (' + seen[f] + '): use shopDateTime(ts, opts) or CBLocale.time(ts)'));
});
console.log('\n' + pass + ' passed');
