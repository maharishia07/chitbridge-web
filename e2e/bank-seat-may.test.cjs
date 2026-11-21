'use strict';
// @type: unit
/**
 * bank-seat-may.test.cjs - FIN-129 (walk 19 Nov W26), no browser, no api: the Bank page draws a refused action greyed WITH the server's sentence.
 *
 * OWNS      bkSeatRead (cap-books.js) keeps the server's may.write / may.post answer and its sentences; bkbSeatNo (cap-bank-statements.js) turns them into the greyed button's words:
 *           the Regional manager who may write but not post, the view-only seat, the owner / adviser / auditor (never greyed), and "not answered yet" (nothing drawn).
 * CALLED BY CI (offline guards) · by hand: node e2e/bank-seat-may.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };
const lift = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('not found: ' + from); return src.slice(a, b); };
const books = read('cap-books.js'), bank = read('cap-bank-statements.js');
const box = { tx: (s) => s, state: { owner: false, acting: false, readOnly: false } };
box.peOwner = () => box.state.owner; box.bkbActing = () => box.state.acting; box.bkbReadOnly = () => box.state.readOnly;
vm.createContext(box);
vm.runInContext(lift(books, 'var BK_SEAT =', 'function bkIsBookkeeper'), box);
vm.runInContext(lift(bank, 'function bkbSeatUnasked()', 'const bkstSeatNoHtml'), box);
const seat = (w, p) => { box.state = { owner: false, acting: false, readOnly: false }; box.bkSeatRead({ may: { write: w, post: p } }); };
const YES_W = { may: true, code: null, why: null }, YES_P = { ok: true, code: null, why: null };
const NO_P = { ok: false, code: 'OWNER_ONLY', why: 'Only the owner or bookkeeper can record this.' };
const NO_W = { may: false, code: 'read_only', why: 'You can only look at this.' };

box.state = { owner: false, acting: false, readOnly: false };
check(box.bkbSeatNo('write') === '' && box.bkbSeatNo('post') === '', 'before the server has answered nothing is drawn greyed');
seat(YES_W, NO_P);
check(box.bkbSeatNo('write') === '', 'Regional manager (editor): add a statement / match / sign off are open');
check(box.bkbSeatNo('post') === NO_P.why, 'Regional manager: Add to your books is greyed with the server\'s sentence (who can: owner or bookkeeper)');
seat(NO_W, NO_P);
check(/You can only look at this\./.test(box.bkbSeatNo('write')) && /Ask the owner/.test(box.bkbSeatNo('write')), 'view-only seat: Add statement greyed with the server\'s sentence and who can');
check(box.bkbSeatNo('post') === '', 'view-only seat: the post sentence is not stacked on the write one (write comes first)');
seat(YES_W, YES_P);
check(box.bkbSeatNo('write') === '' && box.bkbSeatNo('post') === '', 'shop Bookkeeper: nothing greyed');
seat(NO_W, NO_P);
box.state.owner = true; check(box.bkbSeatNo('write') === '', 'the owner is never greyed');
box.state = { owner: false, acting: true, readOnly: false }; check(box.bkbSeatNo('write') === '', 'an acting adviser keeps his own refusal path (bkbActRefusal)');
box.state = { owner: false, acting: false, readOnly: true }; check(box.bkbSeatNo('write') === '', 'the auditor seat draws no write control, greyed or not (W15-71)');
seat({ may: false }, { ok: false });
check(box.bkbSeatNo('write') === 'Only the owner or the shop bookkeeper can do this.', 'a refusal with no sentence still says who can');
console.log(failures ? failures + ' failed' : 'all passed');
process.exit(failures ? 1 : 0);
