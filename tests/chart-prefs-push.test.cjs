/**
 * tests/chart-prefs-push.test.cjs — chart engine step 1 (REQ PM/REQ-CHART-ENGINE-2026-11-16.md, critic points 2 and 4).
 *
 *   · THE DATA-LOSS CASE: a device that has NOT hydrated changes its theme — the push body carries no chart key, so the favourite survives on the server
 *   · chartSet sends ONLY the key just changed (alone, in its own body); the full push never carries a chart_ key, before or after hydrate
 *   · the server's chart keys are the truth (hydrate takes them); a key still pending here is kept and sent again, alone; a cleared key resets the device
 *   · a bad value (a space, a slash, 36 characters) is refused on the device, nothing stored or sent
 *   · CBChartCap.ready(): no script is created until it is asked, and two asks make ONE script
 *   · the chart kinds and types are the pinned lists (the api's tests/chart-prefs.test.cjs pins the same literals)
 *   · CBDraw draws at most 120 points of a series
 *
 * (Step 2: the chart keys moved out of avatar.js into app/chart-cap.js; their pending marks have their own store, cb_chart_pending.)
 *
 * No browser: a stand-in document, storage and fetch (the avatar-hydrate harness, trimmed). Run: node tests/chart-prefs-push.test.cjs
 */
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const FILE = path.join(__dirname, '..', 'public', 'app', 'avatar.js');

function store() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => Array.from(m.keys())[i], get length() { return m.size; }, _m: m };
}
function page(o) {
  o = o || {};
  const el = () => ({ style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, setAttribute() {}, removeAttribute() {}, classList: { add() {}, toggle() {} } });
  const g = { localStorage: store(), sessionStorage: store(), sent: [], scripts: [], Promise };
  g.document = { documentElement: el(), addEventListener() {}, getElementById: () => null, createElement: () => { const n = el(); g.scripts.push(n); return n; }, head: { appendChild(n) { if (n.onload) setTimeout(n.onload, 0); } } };
  g.getComputedStyle = () => ({ getPropertyValue: () => '', fontSize: '16px' });
  g.location = { href: 'http://x/finance.html', reload() {}, replace() {} };
  g.URL = URL; g.setTimeout = (fn) => { fn(); return 1; }; g.clearTimeout = () => {}; g.addEventListener = () => {};
  g.CBScreen = { APP_THEMES: { cream: { name: 'Cream', vars: {} }, dark: { name: 'Dark', vars: { '--paper': '#111' }, scheme: 'dark' } } };
  g.fetch = (url, init) => { g.sent.push({ url, body: JSON.parse(init.body) }); return Promise.resolve({ ok: true, json: () => Promise.resolve(o.answer || { ok: true }) }); };
  Object.entries(o.ls || {}).forEach(([k, v]) => g.localStorage.setItem(k, v));
  if (typeof globalThis.esc !== 'function') require('vm').runInThisContext(fs.readFileSync(path.join(path.dirname(FILE), 'helpers.js'), 'utf8'));
  new Function('window', 'localStorage', 'document', fs.readFileSync(FILE, 'utf8')).call(g, g, g.localStorage, g.document);
  new Function('window', 'localStorage', 'document', fs.readFileSync(path.join(path.dirname(FILE), 'chart-cap.js'), 'utf8')).call(g, g, g.localStorage, g.document);
  g.A = g.CBAvatar;
  g.A.mount({ innerHTML: '', querySelector: () => null, contains: () => false }, { apiBase: 'http://api', token: 't', pull: false });
  return g;
}
const chartScripts = (g) => g.scripts.filter((n) => ['/engine/chart-draw.js', '/app/chart-bar.js'].includes(String(n.src || '')));
const tick = () => new Promise((r) => setTimeout(r, 5));
let pass = 0, fail = 0;
const it = (what, fn) => Promise.resolve().then(fn).then(() => { pass++; console.log('  ok  ' + what); }, (e) => { fail++; console.log('  FAIL ' + what + '\n       ' + ((e && e.message) || e)); });
const chartKeysIn = (body) => Object.keys(body).filter((k) => /^chart_/.test(k));

(async () => {
  await it('an UN-HYDRATED device changing its theme sends no chart key (the favourite on the server survives)', async () => {
    const g = page();                         /* never hydrated: no chart key on this device */
    g.A.set('theme', 'dark');
    await tick();
    assert.ok(g.sent.length >= 1, 'the theme was pushed');
    g.sent.forEach((s) => assert.deepStrictEqual(chartKeysIn(s.body), [], 'no chart key in ' + JSON.stringify(s.body)));
  });
  await it('chartSet sends ONLY the key just changed, in a body of its own', async () => {
    const g = page();
    assert.strictEqual(g.CBChartCap.set('chart_fav_series', 'ocean-column'), true);
    await tick();
    assert.deepStrictEqual(g.sent.map((s) => s.body), [{ chart_fav_series: 'ocean-column' }]);
    assert.strictEqual(g.CBChartCap.chosen('chart_fav_series'), 'ocean-column');
    assert.deepStrictEqual(g.CBChartCap.pending(), {}, 'ok:true clears the mark');
  });
  await it('after a favourite is held, a theme change still carries no chart key', async () => {
    const g = page();
    g.A.hydrate({ chart_fav_series: 'ocean-column', chart_read: 'on' });
    g.sent.length = 0;
    g.A.set('theme', 'dark');
    await tick();
    g.sent.forEach((s) => assert.deepStrictEqual(chartKeysIn(s.body), []));
    assert.strictEqual(g.CBChartCap.chosen('chart_fav_series'), 'ocean-column');
    assert.strictEqual(g.CBChartCap.chosen('chart_read'), 'on');
  });
  await it('the server is the truth: it sets a key, and a key it no longer holds resets the device', () => {
    const g = page({ ls: { cb_chart_theme: 'old' } });
    assert.strictEqual(g.A.hydrate({ chart_read: 'on' }), true);
    assert.strictEqual(g.CBChartCap.chosen('chart_read'), 'on');
    assert.strictEqual(g.CBChartCap.chosen('chart_theme'), '', 'cleared on the server → cleared here');
  });
  await it('a key still pending here (the push never landed) is KEPT and sent again, alone', async () => {
    const g = page({ answer: { ok: false, pending: true } });
    g.CBChartCap.set('chart_theme', 'ocean');
    await tick();
    assert.deepStrictEqual(g.CBChartCap.pending(), { chart_theme: 'ocean' });
    g.sent.length = 0;
    g.A.hydrate({});
    await tick();
    assert.strictEqual(g.CBChartCap.chosen('chart_theme'), 'ocean', 'kept');
    assert.deepStrictEqual(g.sent.map((s) => s.body), [{ chart_theme: 'ocean' }]);
  });
  await it('clearing a key sends it empty (= remove) and holds the removal until the server has it', async () => {
    const g = page({ ls: { cb_chart_theme: 'ocean' }, answer: { ok: false, pending: true } });
    g.CBChartCap.set('chart_theme', '');
    await tick();
    assert.strictEqual(g.CBChartCap.chosen('chart_theme'), '');
    assert.deepStrictEqual(g.sent[0].body, { chart_theme: '' });
    assert.deepStrictEqual(g.CBChartCap.pending(), { chart_theme: '' });
  });
  await it('a bad value or key is refused on the device: nothing stored, nothing sent', async () => {
    const g = page();
    ['ocean blue', 'a/b', 'x'.repeat(36)].forEach((v) => assert.strictEqual(g.CBChartCap.set('chart_theme', v), false));
    assert.strictEqual(g.CBChartCap.set('theme', 'dark-ish'), false, 'not a chart key');
    assert.strictEqual(g.CBChartCap.set('chart_fav_Series', 'a-b'), false, 'kinds are lower case');
    await tick();
    assert.strictEqual(g.sent.length, 0);
    assert.strictEqual(g.CBChartCap.chosen('chart_theme'), '');
  });
  await it('CBChartCap.ready(): no script until asked; two asks make one load of the two files (the engine, the bar)', async () => {
    const g = page();
    assert.strictEqual(chartScripts(g).length, 0, 'a page that draws no chart fetches nothing');
    await Promise.all([g.CBChartCap.ready(), g.CBChartCap.ready()]);
    assert.deepStrictEqual(chartScripts(g).map((n) => n.src), ['/engine/chart-draw.js', '/app/chart-bar.js']);
  });
  await it('CBChartCap.ready() is already done where CBDraw is present', async () => {
    const g = page();
    g.CBDraw = {}; g.CBChartBar = {};
    await g.CBChartCap.ready();
    assert.strictEqual(chartScripts(g).length, 0);
  });
  await it('the kinds and the types are the pinned lists (the api pins the same literals)', () => {
    const D = require('../public/engine/chart-draw.js');
    assert.deepStrictEqual(D.KINDS, ['series', 'rank', 'split', 'bridge']);
    assert.deepStrictEqual(D.TYPES, ['column', 'line', 'bar', 'stack', 'pie', 'donut', 'area', 'waterfall']);
  });
  await it('a series draws at most 120 points (the newest), bars and spark alike', () => {
    const D = require('../public/engine/chart-draw.js');
    const points = Array.from({ length: 400 }, (_, i) => ({ key: 'k' + i, label: String(i), value: i + 1, title: 't' }));
    const svg = D.bars(points, { tid: 'big' });
    assert.strictEqual((svg.match(/data-testid="big-bar-/g) || []).length, 120);
    assert.ok(svg.includes('big-bar-k399') && !svg.includes('big-bar-k279"'), 'the newest 120');
    const spark = D.spark(points.map((p) => p.value), {});
    assert.strictEqual((spark.match(/ L/g) || []).length, 119);
  });
  console.log((fail ? 'FAIL' : 'PASS') + ' · chart prefs push · ' + pass + ' ok, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
