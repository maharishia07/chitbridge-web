'use strict';
// @type: unit
/**
 * web02b-fixes.test.cjs - rows 10 and 14 of VERIFY-WEB-02 (fixWeb02b, batch 1128), no browser.
 *
 * OWNS      the proof that (1) the bank difference says who shows more with ONE helper (CBBankBand.differenceWords), amount unsigned; (2) the "Right account?" facts are counted by ONE function
 *           and a fact that could not be compared (no books balance, no currency) is "none", never agreement; the break count prefers the reader's own number; (3) openNext skips Ready lines and
 *           lands on the next line that needs an answer; (4) editPartyFrom on a vanished line or a line with no new party does nothing (no TypeError); (5) inputMoved measures a select against the
 *           choice recorded AFTER the page's own script set it, not the painted option
 * CALLED BY ci.yml (the unit checks): node e2e/web02b-fixes.test.cjs
 * FLOW      load the files, or lift a function from the file text -> call it with plain stand-ins -> assert
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = (rel) => fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8');
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;
const grab = (text, start) => {
  const a = text.indexOf(start);
  assert(a >= 0, start);
  let depth = 0, i = text.indexOf('{', a);
  for (; i < text.length; i++) { if (text[i] === '{') depth++; if (text[i] === '}' && --depth === 0) break; }
  return text.slice(a, i + 1);
};

/* 1 · the direction word */
globalThis.esc = (value) => String(value);
const Band = require('../public/app/bank-band.js');
assert.strictEqual(Band.differenceWords(1240, '12.40'), 'The bank shows 12.40 more');
ok('bank higher: "The bank shows 12.40 more", the amount unsigned');
assert.strictEqual(Band.differenceWords(-1240, '12.40'), 'Your books show 12.40 more');
ok('books higher: "Your books show 12.40 more"');
assert.strictEqual(Band.differenceWords(0, '0.00') + Band.differenceWords(null, '1') + Band.differenceWords(NaN, '1'), '');
ok('no gap, or an unknown figure: no words');
const real = src('app/cap-bank.js'), demo = src('app/bank-demo.js');
assert(/CBBankBand\.differenceWords\(/.test(real) && /CBBankBand\.differenceWords\(/.test(demo));
ok('the real band and the demo both use the one helper');

/* 2 · one count source, unknown is not agreement */
const items = [{ state: 'ok' }, { state: 'bad' }, { state: 'none' }, { state: 'none' }, { state: 'ok' }];
assert.deepStrictEqual(Band.factCounts(items), { ok: 2, bad: 1, none: 2 });
ok('factCounts: 2 agree, 1 differs, 2 not compared');
const fmt = (m) => String(m), parsed = { opening_minor: 500, lines: [], warnings: [] };
const find = (list, id) => list.filter((one) => one.id === id)[0];
assert.strictEqual(find(Band.rightAccount({ parsed, check: null, fmt, booksOpening_minor: null, currency: '', statementCurrency: '' }), 'opening').state, 'none');
ok('an opening with nothing to compare against is "none", not "agrees"');
assert.strictEqual(find(Band.rightAccount({ parsed, check: null, fmt, booksOpening_minor: 500, currency: 'AUD' }), 'opening').state, 'ok');
ok('an opening equal to the books balance still agrees');
assert.strictEqual(find(Band.rightAccount({ parsed, check: null, fmt, booksOpening_minor: 500, currency: '', statementCurrency: '' }), 'currency').state, 'none');
ok('no currency stated anywhere: "none"');
const broke = { opening_minor: 1, lines: [{ balance_minor: 1 }], warnings: [], balance_breaks: 2 };
assert.strictEqual(find(Band.rightAccount({ parsed: broke, check: null, fmt }), 'running').state, 'bad');
ok('the reader own break count is used with no English warning');
const english = { lines: [{ balance_minor: 1 }], warnings: ['line 2: the balance 5 does not follow from the line before (expected 6)'] };
assert.strictEqual(find(Band.rightAccount({ parsed: english, check: null, fmt }), 'running').state, 'bad');
ok('the English warning stays as the fallback');

/* 3 · openNext skips Ready */
globalThis.CBLabKit = { statusIcon: () => '' };
globalThis.CBBankPreview = { dateText: (d) => d };
globalThis.CBList = { reset() {}, mount: () => { const opened = []; return { open: (id, on) => opened.push([id, on]), refresh() {}, opened }; } };
const Lines = require('../public/app/bank-lines.js');
const rows = [{ id: 'a', status: 'need', date: '2026-10-01' }, { id: 'b', status: 'ready', date: '2026-10-02' }, { id: 'c', status: 'need', date: '2026-10-03' }];
const mounted = Lines.mount({}, { key: 'k', rows: () => rows, fmt: String });
assert.strictEqual(mounted.openNext('a'), 'c');
assert.deepStrictEqual(mounted.list.opened[0], ['c', true]);
ok('after an answer the next line that NEEDS one opens, the Ready line is skipped');
rows[0].status = 'done';
rows[2].status = 'ready';
assert.strictEqual(mounted.openNext('a'), '');
assert.deepStrictEqual(mounted.list.opened[1], ['a', false]);
ok('only Ready lines left: nothing opens, the open row closes');

/* 4 · editPartyFrom guard */
const ui = src('app/bank-preview-ui.js'), told = [];
const sandbox = { told };
vm.createContext(sandbox);
vm.runInContext(grab(ui, 'function editPartyFrom'), sandbox);
const cfgOf = (list) => ({ controller: () => ({ view: () => ({ items: list }), editParty: (k, v) => (told.push([k, v]), { ok: true }) }), say() {}, changed() {} });
sandbox.editPartyFrom(cfgOf([]), { value: 'x' }, 'pname', 'gone');
sandbox.editPartyFrom(cfgOf([{ key: 'k' }]), { value: 'x' }, 'pname', 'k');
assert.strictEqual(told.length, 0);
ok('a vanished line, or a line with no new party: no TypeError, the controller is not told');
sandbox.editPartyFrom(cfgOf([{ key: 'k', party: { name: 'Old', kind: 'supplier' } }]), { value: 'New' }, 'pname', 'k');
assert.strictEqual(JSON.stringify(told[0]), JSON.stringify(['k', { name: 'New', kind: 'supplier' }]));
ok('a real party edit still reaches the controller');

/* 5 · inputMoved against the recorded choice */
const shell = src('app/accounts-shell.js') + '\n' + src('app/accounts-shell-unsaved.js'), box = { IGNORED_TYPES: ['button', 'submit'] };
vm.createContext(box);
vm.runInContext(grab(shell, 'function selectBase') + '\n' + grab(shell, 'function selectRemember') + '\n' + grab(shell, 'function inputMoved'), box);
const select = (count, index) => ({ tagName: 'SELECT', type: 'select-one', multiple: false, disabled: false, hasAttribute: () => false, options: Array.from({ length: count }, () => ({ defaultSelected: false, selected: false })), selectedIndex: index });
const picked = select(3, 0);
assert.strictEqual(box.inputMoved(picked), false);
ok('untouched, nothing recorded: the painted (first) option is the base');
picked.selectedIndex = 2;
box.selectRemember(picked); /* the page's own script set it, then the first idle recorded it */
assert.strictEqual(box.inputMoved(picked), false);
ok('a select set by script after paint, recorded at first idle: NOT unsaved');
picked.selectedIndex = 1;
assert.strictEqual(box.inputMoved(picked), true);
ok('the person then changes it: unsaved');
picked.selectedIndex = 2;
assert.strictEqual(box.inputMoved(picked), false);
ok('back to the recorded choice: not unsaved');
box.selectRemember(picked);
picked.selectedIndex = 0;
assert.strictEqual(box.inputMoved(picked), true);
ok('a later record does not overwrite the first');
console.log(ran + ' ok');
