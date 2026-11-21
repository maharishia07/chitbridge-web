/**
 * tests/locale-reader.test.cjs — I-F-14 / L-F-01 (21 Nov, UAE walks): ONE READER FOR EVERY DATE AND TIME.
 *   · an English screen on a UAE shop (format tag ar-AE) reads "21 Nov 2026" and "1:42 pm" — no Arabic month, no م — in the shop's zone
 *   · an Arabic screen on the same shop stays Arabic, whole (month and marker both)
 *   · a language that is the format's own language gets the engine's tag untouched
 *   · the chosen zone still rules (Asia/Dubai, not the device); a missing time is '' (never 1970)
 * No browser: the engine and app/helpers.js loaded into one context. Run: node tests/locale-reader.test.cjs
 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', 'public');
function page(ls) {
  const m = new Map(Object.entries(ls));
  const g = { localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } };
  g.document = { documentElement: { setAttribute() {}, style: {}, lang: '' }, addEventListener() {}, getElementById: () => null };
  g.window = g; g.navigator = { language: 'en-US' }; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(root, 'engine', 'locale.js'), 'utf8'), g);
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'helpers.js'), 'utf8'), g);
  return g;
}
const ARABIC = /[\u0600-\u06FF]/;
const AT = '2026-11-21T09:42:00Z'; /* 13:42 in Dubai */
{
  const en = page({ cb_lang: 'en', cb_locale: 'ar-AE', cb_tz: 'Asia/Dubai' }).CBLocale;
  const d = en.date(AT), t = en.time(AT), dt = en.datetime(AT);
  assert.ok(!ARABIC.test(d + t + dt), 'English screen, no Arabic script: ' + [d, t, dt].join(' | '));
  assert.ok(/21/.test(d) && /Nov/.test(d) && /2026/.test(d), d);
  assert.ok(/1:42/.test(t) && /pm/i.test(t), 'shop zone 13:42 → ' + t);
  assert.ok(/Nov/.test(dt), dt);
  assert.strictEqual(en.date(null), ''); assert.strictEqual(en.time(''), '');
}
{
  const ar = page({ cb_lang: 'ar', cb_locale: 'ar-AE', cb_tz: 'Asia/Dubai' }).CBLocale;
  assert.ok(ARABIC.test(ar.date(AT)), 'Arabic screen keeps its Arabic month: ' + ar.date(AT));
  assert.ok(ARABIC.test(ar.time(AT)), 'and its marker: ' + ar.time(AT));
}
{
  const g = page({ cb_lang: 'en', cb_locale: 'en-IN', cb_tz: 'Asia/Kolkata' });
  assert.strictEqual(g.cbReadTag(), 'en-IN', 'same language as the format → the engine tag untouched');
  assert.ok(/3:12|03:12/.test(g.CBLocale.time(AT)) && /pm/i.test(g.CBLocale.time(AT)), g.CBLocale.time(AT));
}
{
  const g = page({ cb_lang: 'en', cb_locale: 'ar-AE', cb_tz: 'Pacific/Auckland' });
  assert.ok(/Nov/.test(g.CBLocale.date('2026-11-21T23:30:00Z')) && /22/.test(g.CBLocale.date('2026-11-21T23:30:00Z')), 'the chosen zone rules the day');
  assert.strictEqual(g.cbInstallReader(), false, 'installed once');
}
console.log('locale-reader: all ok');
