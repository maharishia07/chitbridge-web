/* tests/rw3firm-1130.test.cjs — walk 3 firm rows RW3-03/04/08/16/22/23.
 * HAND-COMPUTED  the BAS tab of an AU client is named by the pack's own return word ("BAS"), a client with no pack word keeps "Tax return";
 *                the trial-balance Group column reads group_label (the api's statement line), never the raw key;
 *                the Month lock column is headed Profit (Aug 7,717.79 + Sep -9,112.49 + Oct -13,655.52 = -15,050.22, the P&L loss, is profit not income);
 *                an acting seat is never offered "Switch on" for a client: the card is drawn only for the owner outside a client's books and acting reads the CLIENT's health.
 * OWNS the offline guard of those words.   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\r\n').join('\n');
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
const view = read('public/app/books-grant-view.js');
ok('RW3-16 (ONEP-1) the door is named by the client pack word (return_name), the neutral Tax return when it names none', () => { assert.ok(view.includes('viewState.choices.return_name') && view.includes("|| 'Tax return'")); });
ok('RW3-16 the door button and the phone select both read returnWord', () => { assert.ok(view.includes('words(returnWord())')); });
ok('RW3-22 the trial balance Group column reads group_label', () => assert.ok(/\['group_label', 'Group'\]/.test(read('public/app/books-grant-reports.js'))));
ok('RW3-08 the Month lock column says Profit and holds no "Income, tax out"', () => { const lock = read('public/app/cap-books-lock.js'); assert.ok(lock.includes("tx('Profit')")); assert.ok(!/tx\('Income, tax out'\)/.test(lock)); assert.ok(read('public/app/books-grant-reports.js').includes("['profit_minor', 'Profit'")); });
ok('RW3-03/04 acting: no Switch on for a client, and its own health is read', () => { const acc = read('public/accounts.html'); assert.ok(acc.includes('isOwner() && !(window.CBBooksActing && CBBooksActing.current())')); assert.ok(acc.includes('const profile = acting ? {}')); });
ok('RW3-16 a firm heads its client list Your clients', () => { const nw = read('public/app/network-app.js'); assert.ok(nw.includes('clientsHead() +') && nw.includes("T('Your clients')")); });
ok('RW3-23 the running year has no carry figure', () => assert.ok(!read('public/app/cap-opening-years.js').includes('so far (debit side)')));
console.log('\n' + n + ' checks');
