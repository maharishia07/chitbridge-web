/**
 * evidence-attach-receipt.test.cjs — S1 (b887): the Evidence sheet of a Day book entry carries "Attach receipt" (CMP063-B03) only for a seat that may attach, and the server's exact-copy note (evidence.duplicate), both painted, never computed.
 * Proves: no control without cfg.mayAttach · the control for a seat that may · the note carries the server's words and the other entry's number · a press runs cfg.attach(entry), repaints (cfg.after) and closes · a refusal is shown in the server's words and nothing repaints.
 * Run: node tests/evidence-attach-receipt.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, w) => { if (c) { pass++; console.log('   ok   ' + n); } else { fail++; console.log('   FAIL ' + n + (w ? '\n          ' + w : '')); } };
const made = [];
function node() {
  const n = { attrs: {}, listeners: {}, innerHTML: '', textContent: '', closed: false, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; }, addEventListener(t, f) { this.listeners[t] = f; }, querySelector() { return out; }, showModal() {}, close() { this.closed = true; }, remove() {}, focus() {}, appendChild() {} };
  made.push(n);
  return n;
}
const out = node();
const doc = { createElement: () => node(), head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} };
const sandbox = { globalThis: null, document: doc, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') };
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-evidence.js'), 'utf8'), sandbox);
const entry = (extra) => ({ entry_id: 'e1', entry_no: 'J-0001', evidence: Object.assign({ doc: null, files: [], count: 0, flag: null }, extra) });
const sheet = (cfg, e) => { const c = sandbox.CBEvidence.use(Object.assign({ raw: () => Promise.resolve({ ok: true }) }, cfg)); return c.sheet(e, {}); };

let d = sheet({}, entry());
ok('no seat function: no Attach receipt control', d && !/data-ev-attach/.test(d.innerHTML));
d = sheet({ mayAttach: () => false, attach: () => Promise.resolve({}) }, entry());
ok('a seat that may not (auditor, firm, view-only): no control', !/data-ev-attach/.test(d.innerHTML));
let repainted = 0;
d = sheet({ mayAttach: () => true, attach: () => Promise.resolve({ id: 'f1' }), after: () => { repainted++; } }, entry());
ok('a seat that may: the control, coded CMP063-B03, worded Attach receipt', /data-cbsid="CMP063-B03"/.test(d.innerHTML) && /Attach receipt/.test(d.innerHTML) && /data-ev-attach/.test(d.innerHTML));
ok('no note when the server sent none', !/ev-duplicate/.test(d.innerHTML));
const press = (dialog, outNode) => dialog.listeners.click({ target: { closest: () => ({ hasAttribute: (k) => k === 'data-ev-attach', getAttribute: () => null }) } });
press(d);
setImmediate(() => {
  ok('a press attaches, repaints the Day book and closes the sheet', repainted === 1 && d.closed === true, JSON.stringify({ repainted, closed: d.closed }));
  let again = 0;
  const e2 = sheet({ mayAttach: () => true, attach: () => Promise.reject(new Error('Only a JPEG, PNG or PDF can be attached.')), after: () => { again++; } }, entry());
  press(e2);
  setImmediate(() => {
    ok('a refusal is shown in the server\'s words; nothing repaints; the sheet stays', out.textContent === 'Only a JPEG, PNG or PDF can be attached.' && again === 0 && e2.closed === false, out.textContent);
    const twin = sheet({}, entry({ count: 1, files: [{ id: 'f', name: 'r.png', size: 10 }], duplicate: { entry_id: 'e9', entry_no: 'J-0009', note: 'Check: same file as entry J-0009' } }));
    ok('the exact-copy note is the server\'s sentence, for any seat', /data-testid="ev-duplicate"/.test(twin.innerHTML) && /same file as entry J-0009/.test(twin.innerHTML));
    console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  });
});
