#!/usr/bin/env node
// @type: unit
// UNIT      26/Home: a seat sees what it can use (UX-221)
/**
 * ux221-seat-hides.test.cjs — UX-221 (Fable walk AU r2, C3 C4): the REAL edition.js and the REAL home2.js ordering, run over the real manifest with a stand-in /me answer.
 * OWNS      (1) Counter staff: Home draws the till, tasks, customers and their own account only; the books, bank and owner-only tiles are gone; (2) the owner and an accountant lose nothing;
 *           (3) a view-only seat loses the money and owner tiles; (4) the Till leads the Sell row and is never folded, at 1366x768 (5 lines) and 390x844 (phone, 6 lines);
 *           (5) the edition keeps the answer and draws once more only when it changed.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network. The api's twin: tests/seat-home.test.cjs.
 *   node tests/ux221-seat-hides.test.cjs
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { sliceFrom, run } = require('./lib/proof-lift.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public/app/manifest.json'), 'utf8'));
const editionSource = fs.readFileSync(path.join(__dirname, '..', 'public/app/edition.js'), 'utf8');
let pass = 0;
const ok = (condition, name) => { assert(condition, name); pass++; console.log('  ok  ' + name); };

/* the real edition.js over a stand-in window; `kept` is the device storage (the seat /me answered), `redraws` counts the page redraws */
function windowWith(stored) {
  const kept = { v: stored ? JSON.stringify(stored) : null }, redraws = [];
  const win = {
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => kept.v, setItem: (key, value) => { kept.v = value; } },
    location: { search: '', reload: () => redraws.push('reload') },
    URLSearchParams,
    setTimeout: (fn) => fn()
  };
  win.window = win;
  run(editionSource, win);
  return { edition: win.CBEdition, redraws };
}
const shown = (seat) => windowWith(seat).edition.view(manifest).entries.map((entry) => entry.id);
const everyone = manifest.entries.map((entry) => entry.id);
const open = { owner: true, money: true, lead: null, entries: null };

const counter = { owner: false, money: false, lead: 'till', entries: ['till', 'tasks', 'crm', 'account'] };
ok(JSON.stringify(shown(counter).sort()) === JSON.stringify(['account', 'crm', 'tasks', 'till']), 'Counter staff: Home draws the till, tasks, customers and their own account, nothing else');
ok(counter.entries.every((id) => everyone.includes(id)), 'the seat list names only entries the manifest has');
['accounts', 'bank', 'compare', 'finance'].forEach((id) => ok(!shown(counter).includes(id), 'Counter staff: ' + id + ' (the books) is not drawn'));
ok(windowWith(counter).edition.hidesHref('/accounts.html', manifest) === true, 'Counter staff: a link into the Accounts page is hidden');
ok(shown(open).length === everyone.length, 'the owner loses nothing');
ok(shown(null).length === everyone.length, 'no answer yet hides nothing (never a blank Home)');
const accountant = shown({ owner: false, money: true, lead: null, entries: null });
ok(accountant.includes('accounts') && !accountant.includes('employees'), 'an accountant keeps the books and loses the owner-only tiles');
const viewer = shown({ owner: false, money: false, lead: null, entries: null });
ok(!viewer.includes('accounts') && !viewer.includes('shop') && viewer.includes('crm'), 'a view-only seat loses the money and owner tiles and keeps the rest');

/* the real ordering and folding of the Sell row, one laptop and one phone */
const home2 = 'public/app/home2.js';
const code = sliceFrom(home2, "  /** a card's state rank", "  /** a card's first fact") + sliceFrom(home2, '  function lead(card)', '  /** the cards (boxes and short cards)') + sliceFrom(home2, '  /** hide what does not fit', '  /** the fold line');
const lift = (seat) => run(code + '\nthis.rank = rank; this.lead = lead; this.hideOverflow = hideOverflow;', { root: { CBEdition: windowWith(seat).edition } });
const card = (id, state) => ({ id, hidden: false, getAttribute: (name) => (name === 'data-id' ? id : ''), querySelector: () => ({ getAttribute: () => state }) });
[['1366x768', false, 5], ['390x844', true, 6]].forEach(([size, phone, limit]) => {
  const cards = ['storefront', 'catalogue', 'marketing', 'delivery', 'till'].map((id) => card(id, id === 'till' ? 'not_started' : 'in_use'));
  const ctx = lift(counter);
  ok(ctx.rank(cards[4]) === 1, size + ': the lead card, not started, ranks as in use');
  const sorted = cards.slice().sort((left, right) => ctx.lead(right) - ctx.lead(left) || ctx.rank(left) - ctx.rank(right));
  ok(sorted[0].id === 'till', size + ': the Till is first');
  const counts = ctx.hideOverflow({ phone: { matches: phone } }, sorted, false);
  ok(!cards[4].hidden && counts.fold === 0 && counts.shown === Math.min(cards.length, limit), size + ': the Till is shown, not folded behind "not set up yet" (' + counts.shown + ' lines of ' + limit + ')');
});
ok(lift(open).rank(card('till', 'not_started')) === 3, 'the owner: a not-started Till still folds as before');

/* the edition keeps the answer and redraws once only when it changed */
let first = windowWith(null);
first.edition.seatNote(counter);
ok(first.redraws.length === 1 && first.edition.seat().lead === 'till', 'a seat we had no answer for: kept, and the page is drawn once more');
first.edition.seatNote(counter);
ok(first.redraws.length === 1, 'the same answer again draws nothing');
first = windowWith(null);
first.edition.seatNote(open);
ok(first.redraws.length === 0, 'the owner: no redraw on the first answer');
console.log('\n  ' + pass + ' passed');
