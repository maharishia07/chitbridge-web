/**
 * tests/books-grant-fail-loud.test.cjs — 1138 firm screens: the client's books view never goes blank.
 *
 * Found on sit-au 28 Nov: /network.html?open=<client> painted only the header for both firm seats. wireBand / wireDaybook looked up markup that was not there,
 * threw, and mount() swallowed the rejection (Promise.resolve(reload()).then(focusHeading, focusHeading)). ONE enforcer: reload() catches a painting failure
 * and draws the shell's failed-read frame (worded, Try again, the way back) and logs it. This test mounts the real view as the auditor and as the adviser with
 * the door markup missing (every lookup null) and wants the frame in the page; and with the markup present wants no frame. MUTATION: the swallow put back goes red.
 * Run: node tests/books-grant-fail-loud.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const PARTS = ['public/app/books-grant-api.js', 'public/app/ui-field.js', 'public/app/ui-money.js', 'public/app/books-grant-reports.js', 'public/app/books-grant-cells.js', 'public/app/books-grant-marks.js', 'public/app/books-grant-list.js', 'public/app/books-grant-view.js'];
let n = 0, bad = 0;
const ok = async (name, fn) => { n++; try { await fn(); console.log('  ok  ', name); } catch (e) { bad++; console.log('  FAIL', name, '\n      ', e.message); } };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function world(markupThere, role, view, acting) {
  const logs = [], host = { innerHTML: '', isConnected: true, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, setAttribute() {}, appendChild() {} };
  const el = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? '' : k === 'style' ? {} : k === 'querySelectorAll' ? () => [] : k === 'querySelector' ? () => null : k === 'addEventListener' ? () => {} : el()), set: () => true, apply: () => el() });
  const root = {
    tx: (s) => s, esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'), shopDay: (d) => String(d).slice(0, 10),
    document: { getElementById: (id) => (markupThere ? el() : null), addEventListener() {}, removeEventListener() {}, createElement: () => el() },
    location: { search: '', pathname: '/network.html', hash: '' }, history: {}, matchMedia: undefined,
    cblog: (lvl, msg) => logs.push(lvl + ' ' + msg),
    CBShell: { readFailed: (h, o) => { h.innerHTML = '<div data-testid="read-failed">' + o.what + ' could not be read</div>'; return h; } },
    CBBooksActing: Object.assign({ setCurrency() {}, enter() {}, onClear: () => () => {}, current: () => ({ currency: 'AUD', store: { id: 's1', name: 'Shop' } }), leave() {}, css() {}, crumbs: () => '', periodSlot: () => '', banner: () => '<div id="ba_band"></div>', wireBanner() {}, figure: (m) => String(m), headers: () => ({}), postedByWords: () => '' }, acting || {}),
    CBPeriodPick: { control: () => '', same: () => true, filled: (p) => p, toAddress: () => '' },
    Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, URLSearchParams, setTimeout, Proxy,
  };
  root.window = root; root.globalThis = root;
  const context = vm.createContext(root);
  PARTS.forEach((f) => vm.runInContext(view && f.endsWith('books-grant-view.js') ? view : read(f), context, { filename: f }));
  const answer = { rows: [], entries: [], periods: [], currency: 'AUD' };
  const options = { member: { id: 'c1', name: 'Client', role, posting: '' }, stores: [], call: () => Promise.resolve(answer), mountList() {}, sheet() {}, closeSheet() {}, onBack() {}, onSwitch() {}, onEnded() {}, view: 'daybook' };
  return { root, host, logs, options, mount: () => root.CBBooksGrantView.mount(host, options) };
}
const settle = () => new Promise((r) => setTimeout(r, 60));

(async () => {
  for (const role of ['auditor', 'adviser']) {
    await ok(role + ': the markup the wiring looks up is gone -> the page says so in words (the shell frame) and logs, never blank', async () => {
      const w = world(false, role); w.mount(); await settle(); if (process.env.DBG) console.log(w.logs, w.host.innerHTML);
      assert.ok(/read-failed/.test(w.host.innerHTML), 'blank host: ' + JSON.stringify(w.host.innerHTML.slice(0, 80)));
      assert.ok(w.logs.some((l) => /could not be painted/.test(l)), 'no log: ' + w.logs.join('|'));
    });
  }
  await ok('an exception while KEEPING the answer (keepAnswer) is said in words and logged, not taken for "ended"', async () => {
    const w = world(true, 'auditor', null, { setCurrency() { throw new TypeError('setCurrency is gone'); } }); let ended = 0; w.options.onEnded = () => { ended++; }; w.mount(); await settle();
    assert.ok(/read-failed/.test(w.host.innerHTML) && ended === 0, 'ended=' + ended + ' ' + w.host.innerHTML.slice(0, 80));
    assert.ok(w.logs.some((l) => /setCurrency is gone/.test(l)), w.logs.join('|'));
  });
  await ok('MUTATION: a load failure taken for "ended" again goes red', async () => {
    const src = read(PARTS[7]), mutant = src.replace('else paintFailed(mine, failure);' , 'else if (grantKit.viewState.o.onEnded) grantKit.viewState.o.onEnded();');
    assert.notStrictEqual(mutant, src, 'mutation did not apply');
    const w = world(true, 'auditor', mutant, { setCurrency() { throw new TypeError('setCurrency is gone'); } }); w.mount(); await settle();
    assert.ok(!/read-failed/.test(w.host.innerHTML), 'the mutant should stay blank');
  });
  await ok('control: with the door markup present nothing is flagged and the screen paints its band', async () => {
    const w = world(true, 'auditor'); w.mount(); await settle();
    assert.ok(!/read-failed/.test(w.host.innerHTML) && /bv_back/.test(w.host.innerHTML), w.host.innerHTML.slice(0, 120) + ' ' + w.logs.join('|'));
  });
  await ok('MUTATION: the rejection swallowed again (no catch in reload) goes red', async () => {
    const swallowed = read(PARTS[7]).replace('.catch(function (failure) { paintFailed(mine, failure); })', '');
    assert.notStrictEqual(swallowed, read(PARTS[7]), 'mutation did not apply');
    const w = world(false, 'auditor', swallowed); w.mount(); await settle();
    assert.ok(!/read-failed/.test(w.host.innerHTML), 'the mutant should stay blank');
  });
  console.log('\n' + n + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
