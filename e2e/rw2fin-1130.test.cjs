'use strict';
// @type: unit
/**
 * rw2fin-1130.test.cjs - RE-WALK 2 (26 Nov), RW2-01: the books' side of a statement is every ledger line dated in the statement's PERIOD.
 * OWNS      bkbLedgerWindow (public/app/cap-bank.js): statement lines 10-25 Oct, book lines 3, 6, 13, 20 Oct -> the window is 1-31 Oct, so 3 book lines are
 *           "Not on the statement" (3, 6, 13 Oct) and the 20 Oct line matches; a kept file's own period wins over the calendar month; the window never narrows the lines' span.
 *           The real engine (public/engine/bank-recon.js) is run over the hand-built shape. Fails on the parent (window = first..last line: 13 Oct and earlier are never read).
 * CALLED BY ci.yml (the unit checks): node e2e/rw2fin-1130.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..', 'public');
globalThis.CBRegulation = { DEFAULT: 'AU', packFor: () => ({ bank: null }) };
const recon = require(path.join(root, 'engine', 'bank-recon.js'));
const src = fs.readFileSync(path.join(root, 'app', 'cap-bank.js'), 'utf8');
const at = src.indexOf('function bkbLedgerWindow'), end = src.indexOf('\n}\n', at) + 3;
const sb = {};
vm.createContext(sb);
vm.runInContext(src.slice(at, end) + '\nthis.bkbLedgerWindow = bkbLedgerWindow;', sb);
let ran = 0;
const ok = (what) => console.log('  ok  ' + what, ++ran && '');

const win = sb.bkbLedgerWindow('2026-10-10', '2026-10-25', null);
assert.deepStrictEqual({ from: win.from, to: win.to }, { from: '2026-10-01', to: '2026-10-31' });
ok('no declared period: the whole calendar month of the first and last line');
const kept = sb.bkbLedgerWindow('2026-10-10', '2026-10-25', { from: '2026-10-01', to: '2026-10-31' });
assert.deepStrictEqual({ from: kept.from, to: kept.to }, { from: '2026-10-01', to: '2026-10-31' });
ok('a kept file: its own period');
const narrow = sb.bkbLedgerWindow('2026-10-01', '2026-10-31', { from: '2026-10-10', to: '2026-10-25' });
assert.deepStrictEqual({ from: narrow.from, to: narrow.to }, { from: '2026-10-01', to: '2026-10-31' });
ok('a period never narrows the span of the statement lines');
const feb = sb.bkbLedgerWindow('2028-02-03', '2028-02-20', null);
assert.strictEqual(feb.to, '2028-02-29');
ok('month end is real (leap February)');
assert.deepStrictEqual({ ...sb.bkbLedgerWindow('', '', null) }, { from: '', to: '' });
ok('no dates, no window');

/* the hand-computed case: statement 10-25 Oct (one line on the 20th), books 3, 6, 13, 20 Oct */
const books = [['2026-10-03', 829185], ['2026-10-06', 1534500], ['2026-10-13', 1380500], ['2026-10-20', 25000]].map(([date, cr], index) => ({ id: 'b' + index, date, dr_minor: 0, cr_minor: cr, ref: null, narration: 'book ' + date, entry_no: 'JV-' + index }));
const stmt = [{ date: '2026-10-10', narration: 'Deposit', debit_minor: 0, credit_minor: 777 }, { date: '2026-10-20', narration: 'Card', debit_minor: 25000, credit_minor: 0 }, { date: '2026-10-25', narration: 'Fee', debit_minor: 1220, credit_minor: 0 }];
const inWindow = (w) => books.filter((item) => item.date >= w.from && item.date <= w.to);
const notOn = (rows) => recon.match(stmt, rows, { window_days: 3 }).unmatched_ledger.length;
assert.strictEqual(notOn(inWindow({ from: '2026-10-10', to: '2026-10-25' })), 1);
ok('the old span (first..last line) lists only 13 Oct, never 3 and 6 Oct: the bug');
assert.strictEqual(notOn(inWindow(win)), 3);
ok('the period window lists 3 "Not on the statement" (3, 6 and 13 Oct); the 20 Oct line matched');

/* RW2-02: the month's tick carries its remainder; RW2-03: the trial balance line has the one phrase */
const home = fs.readFileSync(path.join(root, 'app', 'cap-bank-home.js'), 'utf8');
const lineOf = (head) => { const a = home.indexOf(head); return home.slice(a, home.indexOf(String.fromCharCode(10), a)); };
const fnOf = (head) => { const a = home.indexOf(head); return home.slice(a, home.indexOf(String.fromCharCode(10) + '}' + String.fromCharCode(10), a) + 3); };
const hsb = { BANK_HOME: { signed: { a1: [{ period_from: '2026-10-01', period_to: '2026-10-31', at: '2026-11-15T01:00:00Z', difference_minor: 35432, currency: 'AUD' }, { period_from: '2026-09-01', period_to: '2026-09-30', at: '2026-11-14T01:00:00Z', difference_minor: 0, currency: 'AUD' }] } }, bkMoney: (minor) => 'A$' + (minor / 100).toFixed(2), txf: (t, v) => t.replace('{a}', v.a) };
vm.createContext(hsb);
vm.runInContext([lineOf('const bkhCovers'), fnOf('function bkhUnexplainedIn'), lineOf('const bkhUnexplainedWords'), 'this.un = bkhUnexplainedIn; this.words = bkhUnexplainedWords;'].join(String.fromCharCode(10)), hsb);

const un = hsb.un({ account_id: 'a1' }, '2026-10');
assert.deepStrictEqual({ ...un }, { minor: 35432, currency: 'AUD' });
assert.strictEqual(hsb.words(un), 'A$354.32 unexplained');
assert.strictEqual(hsb.un({ account_id: 'a1' }, '2026-09'), null);
ok('October signed with A$354.32 unexplained says so; September signed clean says nothing');
assert.ok(home.includes("(un ? '✓!' : '✓')") && home.includes("tx('Signed off') + ' · ' + bkhUnexplainedWords(un)"), 'the grid cell title and mark carry it');
ok('the grid cell title and mark carry the remainder');
require(path.join(root, 'app', 'bank-tb-line.js'));
const line = globalThis.CBBankTbLine.wordsOf;
assert.strictEqual(line({ state: 'no_run' }, { tx: (t) => t, txf: (t) => t }), 'Months are signed off, none in an unbroken run from the first bank entry');
ok('the trial balance line says the one phrase for a month signed outside an unbroken run');
console.log(ran + ' checks');
