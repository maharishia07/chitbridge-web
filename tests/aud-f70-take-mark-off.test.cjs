'use strict';
/* F-70 (21 Nov audit walk): an auditor's mark on an entry can be taken back. The Query sheet of a MARKED entry offers "Take mark off" (kind removed, the server writes its own row and keeps the history);
   an entry with no mark does not offer it (the server refuses a first removed). After the answer "removed" the row reads as no mark.
   Run: node tests/aud-f70-take-mark-off.test.cjs */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'public', 'app');
const made = [];
const doc = { querySelectorAll: () => [], head: { appendChild() {} }, documentElement: {}, addEventListener() {}, getElementById: () => null, hidden: false,
  createElement: () => { const el = { setAttribute() {}, appendChild() {}, style: {}, innerHTML: '', querySelector: () => ({ focus() {}, addEventListener() {} }), querySelectorAll: () => [], addEventListener() {}, showModal() {} }; made.push(el); return el; },
  body: { appendChild() {} } };
const root = { tx: (s) => s, esc: (s) => String(s == null ? '' : s), document: doc, Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, Intl, setTimeout };
root.window = root; root.globalThis = root;
const context = vm.createContext(root);
['cap-mark-sheet.js', 'cap-mark.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), context, { filename: f }));
const sheetOf = (mark) => {
  const ctl = root.CBMark.use({ adopter: 'acc.audit', call() {} });
  ctl.ingest([{ entry_id: 'e1', entry_no: 'PY/2026-27/000002', mark }], { mark_actions: { set: { ok: true } }, currency: 'AUD' });
  made.length = 0;
  try { ctl.sheet('e1', {}); } catch (failure) { /* the stub has no dialog wiring; the markup is what is read */ }
  return made.map((el) => el.innerHTML).join('');
};
assert(/mk-set-removed/.test(sheetOf({ kind: 'checked', class: 'clear', label: 'Checked' })), 'a Checked entry offers Take mark off');
assert(/mk-set-removed/.test(sheetOf({ kind: 'on_hold', class: 'hold', label: 'On hold' })), 'an On hold entry offers Take mark off');
assert(!/mk-set-removed/.test(sheetOf(null)), 'an unmarked entry does not');
console.log('ok aud-f70-take-mark-off');
