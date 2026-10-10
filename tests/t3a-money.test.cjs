'use strict';
/* T3a (M141 · M137 · M136 · M132 · M148-late-count): the money rules, run as the page runs them — functions lifted whole from the page source, no browser.
   Run: node tests/t3a-money.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = (f) => fs.readFileSync(__dirname + '/../public/app/' + f, 'utf8');
/** a top-level `function name(` with its body, by brace matching */
function fn(text, name) {
  const i = text.indexOf('function ' + name + '('); assert(i >= 0, name + ' is in the source');
  let d = 0, j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) { if (text[k] === '{') d++; else if (text[k] === '}' && --d === 0) return text.slice(i, k + 1); }
  throw new Error('unbalanced ' + name);
}
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };

/* ── M141: Add missing posts against the ledger the statement belongs to ── */
const bank = src('cap-bank.js'), opened = [];
const cx = vm.createContext({ BKB: { acct: '1520', file: { hash: 'h' }, accts: [{ code: '1500', role: 'bank' }, { code: '1520', role: 'card' }, { code: '1530', role: null }] },
  bkbMinorText: (m) => String(m / 100), toast() {}, tx: (x) => x, enOpen: (p) => opened.push(p) });
vm.runInContext(fn(bank, 'bkbModeOf') + fn(bank, 'bankAdd'), cx);
const charge = { amount_minor: 590, stmt: { date: '2026-10-10', narration: 'CHARGES', row: 3 }, sugg: { event: { type: 'expense', class: 'bank_charges', narration: 'Bank charges' } } };
cx.bankAdd(charge);
ok(opened[0].kind === 'expense' && opened[0].v.paid_from === 'card', 'M141: a bank charge on the Card settlements statement (1520) is paid from card — Cr 1520, not Bank 1500');
cx.BKB.acct = '1500'; cx.bankAdd(charge);
ok(opened[1].v.paid_from === 'bank', 'M141: the same charge on the Bank statement still posts to Bank');
cx.BKB.acct = '1530'; cx.bankAdd(charge);
ok(opened[2].kind === null, 'M141: a ledger with no payment mode is never guessed — the sheet opens at "What happened?"');
cx.BKB.acct = '1520'; cx.bankAdd({ amount_minor: 100, stmt: { date: '2026-10-10', narration: 'X', row: 4 }, sugg: { event: { type: 'contra', from: 'bank', to: 'cash' } } });
ok(opened[3].v.from === 'card' && opened[3].v.to === 'cash', 'M141: a contra suggestion takes the statement\'s mode in place of the fixed bank');

/* ── M137: a supplier with a Dr balance is an advance, never under To pay ── */
const books = src('cap-books.js'), cb = vm.createContext({});
vm.runInContext(fn(books, 'bkDuesSide') + fn(books, 'bkDuesAdvance'), cb);
const paidAhead = { side: 'supplier', balance_minor: 200 }, owed = { side: 'supplier', balance_minor: -5000 }, cust = { side: 'customer', balance_minor: 900 };
ok(cb.bkDuesAdvance(paidAhead) === true && cb.bkDuesAdvance(owed) === false && cb.bkDuesAdvance(cust) === false, 'M137: only a supplier with a Dr balance is an advance');
ok(cb.bkDuesSide(paidAhead) === 'pay', 'M137: the ledger tree still files the supplier under suppliers (bkDuesSide unchanged)');

/* ── M136/M139/M132/M138: the words and the doors are in the source the page runs ── */
ok(/Nobody owes you money/.test(books) && /You owe nobody/.test(books), 'M136: the empty sides say "Nobody owes you money" / "You owe nobody"');
ok(/filters: onlySide \? \[\]/.test(books), 'M136: a page\'s own side is not a filter chip');
ok(/These filters match nothing here/.test(src('list-ctl.js')) && !/These filters'\) \+ ' '\) \+ esc\(T\(I, 'matches/.test(src('list-ctl.js')), 'M136: "These filters match nothing here" (grammar)');
const acc = fs.readFileSync(__dirname + '/../public/accounts.html', 'utf8');
ok(/\['bills', 'Unpaid bills'/.test(acc), 'M139: the menu says "Unpaid bills"');
ok(/addEventListener\('hashchange'/.test(acc), 'M138: the # decides the page — hashchange is listened to');
ok(/bkDayBillsLink\(s, tid\)/.test(books) && /function bkDayBillsOpen/.test(books), 'M132: a walk-in day\'s "N bills" opens the bills it covers');
const bank2 = bank; ok(/tx\(r\.in \? 'In' : 'Out'\)/.test(bank2) && !/'Dr' : 'Cr'\)\) \}/.test(bank2), 'M142: bank lines say In / Out');
console.log('\n  ' + n + ' checks');
