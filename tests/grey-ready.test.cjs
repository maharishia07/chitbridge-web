/**
 * tests/grey-ready.test.cjs - READY-GREY (Athi 21 Nov 2026): "if any of the functionality is not fully done yet or fully tested, make it grey".
 * OWNS  the guard that EVERY Home card (public/app/manifest.json entry) states `ready` true or false; a not-ready one draws the grey tile with the note and no link;
 *       a typed address to its page shows the same note; a ready one is untouched. Runs the real shell.js in a stub window. No browser.
 * Run: node tests/grey-ready.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const man = JSON.parse(fs.readFileSync(path.join(root, 'public/app/manifest.json'), 'utf8'));
const win = { document: undefined, matchMedia: undefined, esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]) }; /* the page's esc (helpers.js) */
win.window = win;
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/app/shell.js'), 'utf8'), win);
const Shell = win.CBShell;

/* 1. every entry says its readiness, explicitly */
man.entries.forEach((e) => assert.strictEqual(typeof e.ready, 'boolean', e.id + ' states ready: true or false'));
const notReady = man.entries.filter((e) => e.ready === false), ready = man.entries.filter((e) => e.ready === true);
assert(notReady.length > 0 && ready.length > 0, 'both kinds exist: ' + ready.length + ' ready, ' + notReady.length + ' not');
['delivery', 'rail-lab'].forEach((id) => assert.strictEqual(man.entries.find((e) => e.id === id).ready, false, id + ' (state coming) is not ready'));

/* 2. a not-ready entry renders the grey tile: the note, no link, no href, no way in */
const note = Shell.WORDS.unfinished;
assert.strictEqual(note, 'Being finished · not ready yet');
notReady.filter((e) => e.state === 'built' && e.route).forEach((e) => {
  const html = Shell.greyedTileHTML(e, '', true);
  assert(/class="cbsh-box off"/.test(html) && /aria-disabled="true"/.test(html) && /data-ready="no"/.test(html), e.id + ' draws grey');
  assert(!/<a |href=/.test(html), e.id + ' has no link');
  assert(html.includes(note), e.id + ' says: ' + note);
});
/* the older reason (no shop id) still reads its own sentence for a ready entry */
const shopTile = Shell.greyedTileHTML({ id: 'x', name: 'X', ready: true }, '', true);
assert(/No shop yet/.test(shopTile) && !/data-ready/.test(shopTile), 'a ready tile greyed for want of a shop keeps its own sentence');

/* 3. a typed address: the most specific entry decides, and a not-ready page gets the note over it */
function fakeDoc() {
  const nodes = [];
  return {
    nodes,
    querySelector: (sel) => (/shell-unready/.test(sel) ? nodes[0] || null : null),
    createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() { nodes.length = 0; } }),
    body: { appendChild: (n) => nodes.push(n) },
  };
}
const at = (p, h, s) => ({ pathname: p, hash: h || '', search: s || '' });
const idAt = (loc) => (Shell.entryOfAddress(man.entries, loc) || {}).id;
assert.strictEqual(idAt(at('/till.html')), 'till');
assert.strictEqual(idAt(at('/operations.html', '#/stock')), 'stock', 'a hash route is the more specific entry');
assert.strictEqual(idAt(at('/crm.html', '#/privacy')), 'privacy');
assert.strictEqual(idAt(at('/crm.html')), 'crm');
assert.strictEqual(idAt(at('/settings.html', '#/connectors')), 'connectors');
/* READY-HINT (Athi, 25 Nov): NO page is ever covered. gateUnready is kept as a name and always answers false; a cover an older load left is removed. */
const blocked = fakeDoc();
blocked.nodes.push({ remove() { blocked.nodes.length = 0; } });
assert.strictEqual(Shell.gateUnready(blocked, man, at('/operations.html', '#/stock')), false, 'a typed address to a not-ready page opens it: no cover');
assert.strictEqual(blocked.nodes.length, 0, 'a cover an older load left is removed');
const open = fakeDoc();
man.entries.filter((e) => e.state === 'built' && e.route && !/{bridge_id}/.test(e.route)).forEach((e) => {
  const u = e.route.split('#'), pq = u[0].split('?');
  assert.strictEqual(Shell.gateUnready(open, man, at(pq[0], u[1] ? '#' + u[1] : '', pq[1] ? '?' + pq[1] : '')), false, e.id + ' is never covered');
});
assert.strictEqual(open.nodes.length, 0, 'nothing was ever appended to a page');
/* the hint is ONE control, said at the element */
const hint = Shell.readyHintHTML('network');
assert(/data-ready="no"/.test(hint) && /Being finished/.test(hint) && /shell-hint-network/.test(hint), 'the one hint: small, "Being finished", on the element');
assert(!/not ready yet/.test(hint) && !/Back to Home/.test(hint), 'no slogan, no Back to Home');
/* the shell's source: no code path appends a cover, and a not-ready Home card is a live link with the hint */
const shellSrc = fs.readFileSync(path.join(root, 'public/app/shell.js'), 'utf8');
assert(!/appendChild(cover)|cbsh-unready'/.test(shellSrc), 'no page cover is built anywhere');
assert(shellSrc.indexOf('(e.ready === false ? readyHintHTML(e.id)') >= 0, 'a not-ready Home card carries the hint');


/* 4. the shortcut and the facts read skip a not-ready card (no way in by key, no read for a grey tile) */
assert(/item\.ready !== false/.test(fs.readFileSync(path.join(root, 'public/app/shortcuts.js'), 'utf8')), 'the keyboard door skips a not-ready card');
assert(/card\.ready === false/.test(fs.readFileSync(path.join(root, 'public/app/shell-facts.js'), 'utf8')), 'no facts read for a grey card');
console.log('grey-ready: ' + ready.length + ' ready, ' + notReady.length + ' not ready - all ok');
