'use strict';
/* 20 Nov (S1: attach to ANY posted entry): an entry whose Evidence state is "No source" no longer paints a dash in the owner/adviser Day book; it paints the chip, worded "Attach receipt" for a seat that may attach and "No receipt" for one that may not (the state, filter and count stay "No source": stateOf is unchanged).
   The Lines view carries the chip too; the foreign line reads "AUD 350.00 @ 54.60".
   Run: node tests/bk-dv-no-source-dash.test.cjs */
const fs = require('fs'), assert = require('assert'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../public/app/cap-books.js', 'utf8');
const ev = fs.readFileSync(__dirname + '/../public/app/cap-evidence.js', 'utf8');
const win = { document: { addEventListener() {}, getElementById: () => null, head: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {} }) }, tx: (s) => s, esc: (s) => String(s) };
vm.createContext(win);
vm.runInContext(ev, Object.assign(win, { window: win }));
const E = win.CBEvidence;
const line = src.split('\n').find((l) => l.includes("key: 'evidence', sort: 'evidence'"));
assert(line && line.includes('return BK.ev.chip(e);') && !line.includes("'—'"), 'the evidence cell paints the chip for every state');
assert(/ctx\.view === 'lines' && BK\.ev \? .*BK\.ev\.chip\(e\)/.test(src), 'the Lines view carries the chip');
const nodoc = { entry_id: 'a', entry_no: 'J-1', evidence: { doc: null, count: 0 } };
assert.strictEqual(E.stateOf(nodoc.evidence).key, 'nodoc');
assert.strictEqual(E.stateOf(nodoc.evidence).word, 'No source', 'the state word is unchanged');
const chipFor = (may) => E.use({ attach: () => {}, mayAttach: () => may }).chip(nodoc);
assert(/Attach receipt/.test(chipFor(true)), 'a seat that may attach: Attach receipt');
assert(/No receipt/.test(chipFor(false)) && !/Attach receipt/.test(chipFor(false)), 'a read-only seat: No receipt');
assert(/data-ev-open="a"/.test(chipFor(true)), 'the chip still opens the sheet');
// the firm Day book (books-grant-cells.js) and the drill use the same chip: no dash for a no-source entry
const firm = fs.readFileSync(__dirname + '/../public/app/books-grant-cells.js', 'utf8');
const fl = firm.split('\n').find((l) => l.includes("kind === 'evidence'"));
assert(fl && fl.includes('state.ev.chip(row)') && !fl.includes('noSourceRow'), 'the firm cell paints the chip for every state');
assert(!/noSourceRow/.test(firm), 'no no-source dash branch left in the firm cells');
const drill = fs.readFileSync(__dirname + '/../public/app/books-grant-drill.js', 'utf8');
assert(drill.includes('ctx.ev && ctx.ev.chip(entry)'), 'the drill uses the same chip');
assert(/No receipt/.test(E.use({ raw() {} }).chip(nodoc)), 'the firm (cannot attach) reads No receipt');
// foreign line
const a = src.indexOf('function bkFxText'), b = src.indexOf('/** a balance the way', a);
const ctx = { bkDec: (c) => (c === 'JPY' ? 0 : 2), CBLocale: { number: (n, o) => n.toLocaleString('en-US', o) } };
vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
assert.strictEqual(ctx.bkFxText({ currency: 'AUD', rate: 54.6, foreign_minor: 35000 }), 'AUD 350.00 @ 54.60');
assert.strictEqual(ctx.bkFxText({ currency: 'AUD', rate: '54.6025', foreign_minor: 35000 }), 'AUD 350.00 @ 54.6025');
assert.strictEqual(ctx.bkFxText({ currency: 'JPY', rate: 0.55, foreign_minor: 1200 }), 'JPY 1,200 @ 0.55');
console.log('PASS bk-dv-no-source-dash');
