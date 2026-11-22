/**
 * l1c-1129.test.cjs — batch 1129 fix L1c web rows, offline (vm, no browser, no network).
 * OWNS      REV5 05 M2: the ledger CSV says "N of M" when only a page was loaded (and stays clean when whole) · REV5 EL-04 M11: Accept at the count sends the counted figure (counted_minor) the owner saw
 * CALLED BY .github/workflows/ci.yml (Offline guards).   node e2e/l1c-1129.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { liftFns } = require('./lib/lift-fn.cjs');
const txf = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);

/* ── ledger CSV: never silently partial ── */
const saved = [];
const lg = vm.createContext({ txf, BK: { lt: { r: null, sel: { code: '1100' } } }, bkLgCsv: () => 'Date,Dr\r\n', bkCsvCell: (v) => '"' + v + '"', toast: () => {}, Blob: class { constructor(parts) { saved.push(parts.join('')); } }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } }, setTimeout: () => 0 });
vm.runInContext(liftFns('public/app/cap-books.js', ['bkLgPartialNote', 'bkLgDownload']) + '\nthis.note = bkLgPartialNote; this.dl = bkLgDownload;', lg);
lg.BK.lt.r = { currency: 'INR', lines: new Array(100).fill({}), next: 'cur', total: 307 };
assert.ok(/only 100 of 307 lines/.test(lg.note(lg.BK.lt.r)), 'the note names N of M');
lg.dl([]);
assert.ok(/NOT COMPLETE: only 100 of 307 lines/.test(saved[0]), 'the FILE carries the note');
lg.BK.lt.r.next = null;
assert.strictEqual(lg.note(lg.BK.lt.r), '', 'whole period held: no note');
lg.dl([]);
assert.ok(!/NOT COMPLETE/.test(saved[1]), 'a whole file has no note');

/* ── Accept at the count carries the figure ── */
let sent = null;
const wc = vm.createContext({ BK: { waiting: [{ chit_id: 'c1' }] }, bkWaitModel: () => ({ cur: 'INR' }), bkWaitShort: () => ({ ours_minor: 269000, theirs_minor: 280000, short_minor: 11000 }), CBAction: { run: (b, fn) => fn() }, CBSheet: { shortAsk: () => ({}) }, api: (name, o) => { sent = { name, o }; return Promise.resolve({}); }, tx: (s) => s });
vm.runInContext(liftFns('public/app/cap-books-waiting-cells.js', ['bkWaitAcceptShort']) + '\nthis.f = bkWaitAcceptShort;', wc);
wc.f(0, {});
assert.deepStrictEqual(JSON.parse(JSON.stringify(sent.o.body)), { status: 'accepted', counted_minor: 269000 }, 'Accept at the count names the count the owner saw');
console.log('l1c-1129: all passed');
