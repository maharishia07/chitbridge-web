/**
 * tests/links-to-not-ready.test.cjs — AT-02 / FW-01 (Athi, 25 Nov 2026): a working screen never sends a person into the grey "Being finished" cover.
 *  1. every in-app link (href, location, go(), open()) whose ADDRESS resolves (shell.entryOfAddress, the same reader the cover uses) to a ready:false entry must be on
 *     tests/links-to-not-ready.known.json, the work list: each is rendered grey through the one helper (CBShell.greyLink) or removed. A NEW one fails this test.
 *  2. a ready sub-view on a not-ready host page (network.html?open=<client>&view=…) is ready: gateUnready never covers it (manifest `ready_for`).
 * Run: node tests/links-to-not-ready.test.cjs        (--list prints every place found)
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const root = path.join(__dirname, '..');
const man = JSON.parse(fs.readFileSync(path.join(root, 'public/app/manifest.json'), 'utf8'));
const SKIP = /^(strings-|screens\.js|manifest|shell\.js|shortcuts\.js|shell-facts\.js)/; /* the shell draws its own grey tiles; the registers name routes without linking */
const files = fs.readdirSync(path.join(root, 'public')).filter((f) => /\.html$/.test(f)).map((f) => 'public/' + f)
  .concat(fs.readdirSync(path.join(root, 'public/app')).filter((f) => /\.js$/.test(f) && !SKIP.test(f)).map((f) => 'public/app/' + f));
const ctx = { window: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'public/app/shell.js'), 'utf8'), ctx);
const Shell = ctx.CBShell || ctx.window.CBShell;

const URL_AT = /['"`(=]\s*(\/[a-z0-9-]+\.html)([?#][^'"`\s)<]*)?/g;
const LINKY = /href\s*=|location|\bgo\(|open\(/;
const found = [];
files.forEach((f) => {
  fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((line, i) => {
    if (!LINKY.test(line)) return;
    let m;
    URL_AT.lastIndex = 0;
    while ((m = URL_AT.exec(line))) {
      const rest = m[2] || '', h = rest.indexOf('#'), q = rest.indexOf('?');
      const hash = h >= 0 ? rest.slice(h) : '', search = q >= 0 ? rest.slice(q, h > q ? h : undefined) : '';
      const entry = Shell.entryOfAddress(man.entries, { pathname: m[1], hash, search });
      if (entry && !Shell.readyAt(entry, { search }) && path.basename(f) !== path.basename(m[1])) found.push(f + ':' + (i + 1) + ' → ' + entry.id + ' (' + m[1] + rest + ') · ' + line.trim().slice(0, 100));
    }
  });
});
if (process.argv.includes('--list')) { console.log(found.join('\n')); console.log(found.length + ' places'); process.exit(0); }

const known = JSON.parse(fs.readFileSync(path.join(__dirname, 'links-to-not-ready.known.json'), 'utf8'));
const key = (s) => s.split(' · ')[0].replace(/:\d+/, '');
const knownKeys = new Set(known.map(key));
const fresh = found.filter((s) => !knownKeys.has(key(s)));
assert.strictEqual(fresh.length, 0, 'a link to a not-ready entry that is not on the work list:\n' + fresh.join('\n'));

/* 2. a ready sub-view on a not-ready host */
const doc = { nodes: [], querySelector() { return this.nodes[0] || null; }, createElement: () => ({ setAttribute() {}, remove() { doc.nodes.length = 0; } }), body: { appendChild: (n) => doc.nodes.push(n) } };
const at = (p, s) => ({ pathname: p, hash: '', search: s || '' });
['bas', 'tb', 'pl', 'bs', 'daybook', 'dues', 'periods', 'actions'].forEach((v) => {
  assert.strictEqual(Shell.gateUnready(doc, man, at('/network.html', '?open=c1&view=' + v)), false, 'client books ?open=…&view=' + v + ' is ready: no cover');
});
console.log('links-to-not-ready: ' + found.length + ' known places, none new; ready sub-views uncovered');
