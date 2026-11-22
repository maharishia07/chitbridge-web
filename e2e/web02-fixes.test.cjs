'use strict';
// @type: unit
/**
 * web02-fixes.test.cjs - four small fixes from the web-screens-02 review (fixWeb02, batch 1128), each driven on the real file with fakes, no browser.
 *
 * OWNS      the proof that (1) public/app/attach-ui.js opens an image or a PDF in a new tab through an anchor with rel=noopener and does NOT also download it, and downloads a
 *           type it cannot show; (2) public/app/avatar.js signing out removes the session, the nav memory AND the look no push has landed yet (cb_prefs_pending), so the next
 *           person's sign-in never pushes it; (3) public/app/accounts-shell.js chitIsSelf compares names only when there is no id to compare, and inputMoved counts a select
 *           that has no option marked selected
 * CALLED BY ci.yml (the unit checks): node e2e/web02-fixes.test.cjs
 * CARD      01-rail-core-the-chit/assign
 */
const fs = require('fs'),
  path = require('path'),
  vm = require('vm'),
  assert = require('assert');
const src = (rel) => fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8').replace(/\r\n/g, '\n');
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;

/* 1 · attach-ui: the anchors the open makes */
(async () => {
  const anchors = [];
  const doc = { body: { appendChild() {} }, createElement: () => { const a = { removed: false, clicked: false, click() { this.clicked = true; }, remove() { this.removed = true; } }; anchors.push(a); return a; } };
  const opened = [];
  const box = { document: doc, toast() {}, CFG: { API_BASE: '' }, SESSION: { token: 't' }, window: { open: (...args) => (opened.push(args), null) }, URL: { createObjectURL: () => 'blob:x' }, console, encodeURIComponent };
  box.fetch = async () => ({ ok: true, status: 200, blob: async () => ({ type: box.mime }) });
  vm.createContext(box);
  vm.runInContext(src('app/attach-ui.js'), box);
  const open = async (mime, id) => { box.mime = mime; anchors.length = 0; await box.cbAttachOpen(id); return anchors[0]; };
  const png = await open('image/png', 'a1');
  assert.ok(png && png.target === '_blank' && png.rel === 'noopener' && png.download === undefined && png.clicked, 'an image opens in a new tab with rel=noopener and no download attribute');
  assert.strictEqual(anchors.length, 1, 'one anchor: the file is not ALSO downloaded');
  assert.strictEqual(opened.length, 0, 'window.open is not used: it answers null under noopener and caused the second, download, step');
  const pdf = await open('application/pdf', 'a2');
  assert.ok(pdf.target === '_blank' && pdf.download === undefined, 'a PDF the same');
  const zip = await open('application/zip', 'a3');
  assert.ok(zip.download === '' && zip.target === undefined && zip.rel === 'noopener' && zip.clicked, 'a type the browser cannot show is saved (the download is the answer asked for)');
  const svg = await open('image/svg+xml', 'a4');
  assert.ok(svg.download === '', 'SVG stays a download (it can carry a script)');
  ok('attach: an image or PDF opens in a new tab through an anchor (rel=noopener) and is not also downloaded; other types download');
})().then(() => {
  /* 2 · avatar: the sign-out list */
  const text = src('app/avatar.js');
  assert.ok(/var PERSON_KEYS = \['cb_sess', PEND\];/.test(text), 'one list of the keys that belong to the person who leaves');
  const store = { cb_sess: '{"x":1}', cb_prefs_pending: '{"theme":"dark"}', 'cb_nav@a': '1', cb_nav: '2', cb_theme: 'dark', other: 'kept' };
  Object.defineProperty(store, 'removeItem', { value: (key) => delete store[key], enumerable: false }); /* the store is its own localStorage: Object.keys lists the keys, removeItem is not one */
  const body = text.slice(text.indexOf('var PERSON_KEYS'), text.indexOf('  /**\n   * ⭐ THE ONE SIGN-OUT'));
  const run = new Function('PEND', 'root', body + '\n  return forget;');
  const rootFake = { localStorage: store };
  const forget = run('cb_prefs_pending', rootFake);
  assert.strictEqual(forget(), true);
  assert.deepStrictEqual(Object.keys(store).sort(), ['cb_theme', 'other'], 'session, pending look and nav memory are gone; the device look and unrelated keys stay: ' + Object.keys(store));
  ok('avatar: sign-out removes cb_sess, cb_prefs_pending and cb_nav*, so the next sign-in has nothing of the last person to push');

  /* 3 · accounts-shell: chitIsSelf and inputMoved (the functions lifted from the file, so the real text is tested) */
  const shell = src('app/accounts-shell.js');
  const grab = (start) => { const a = shell.indexOf(start); let depth = 0, i = shell.indexOf('{', a); for (; i < shell.length; i++) { if (shell[i] === '{') depth++; if (shell[i] === '}' && --depth === 0) break; } return shell.slice(a, i + 1); };
  const sandbox = { SESSION: { entityId: 'e1', entity: 'Alpha Timers' }, IGNORED_TYPES: ['button', 'submit'] };
  vm.createContext(sandbox);
  vm.runInContext(grab('function chitIsSelf') + '\n' + grab('function selectBase') + '\n' + grab('function inputMoved'), sandbox);
  assert.strictEqual(sandbox.chitIsSelf('e1', 'Anyone'), true, 'my id is me');
  assert.strictEqual(sandbox.chitIsSelf('e2', 'Alpha Timers'), false, 'another shop with my name is another shop (both ids known)');
  assert.strictEqual(sandbox.chitIsSelf('', 'Alpha Timers'), true, 'no id on the row: the name decides');
  assert.strictEqual(sandbox.chitIsSelf('', 'Other'), false);
  ok('accounts-shell: chitIsSelf never lets a same-named shop with a different id be "me"');
  const option = (selected, defaultSelected) => ({ selected, defaultSelected });
  const select = (options, selectedIndex) => ({ tagName: 'SELECT', type: 'select-one', disabled: false, hasAttribute: () => false, options, selectedIndex, multiple: false });
  assert.strictEqual(sandbox.inputMoved(select([option(false, false), option(true, false)], 1)), true, 'a select painted with no option marked selected, then changed: moved');
  assert.strictEqual(sandbox.inputMoved(select([option(true, false), option(false, false)], 0)), false, 'left on the first option: not moved');
  assert.strictEqual(sandbox.inputMoved(select([option(true, false), option(false, true)], 0)), true, 'the painted option was the second one: moved');
  assert.strictEqual(sandbox.inputMoved(select([option(false, false), option(true, true)], 1)), false, 'left on the painted option: not moved');
  ok('accounts-shell: a changed select counts as unsaved, with or without an option marked selected');
  console.log(ran + ' checks passed');
}).catch((failure) => { console.error(failure); process.exit(1); });
