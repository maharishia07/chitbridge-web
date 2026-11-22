'use strict';
// @type: system
/**
 * tests/overview-sold-period.test.cjs - the screen is the product: a Sold figure names its period in words (batch 1129, walk AJ: the books overview's
 * Sold 369.00 and Home's "today" are the same SOLD rule over different days, and the tile did not say which).
 *
 * OWNS    every Sold label on the books overview comes from the ONE helper bkSoldLabel (app/cap-books.js): the period word and the server's from / to days
 *         ("Sold this week so far · 16 Nov – 22 Nov"); the tile uses it, no bare "Sales, tax in" tile label is left; hi and ar carry each phrase.
 * RUN     node tests/overview-sold-period.test.cjs
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'public', 'app');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
let fail = 0;
const ok = (c, m) => { if (!c) fail++; console.log((c ? '  ok  ' : '  XX  ') + m); };

const books = read('cap-books.js'), overview = read('cap-books-overview.js');
const start = books.indexOf('function bkSoldLabel'), end = books.indexOf('\n}\n', start) + 3;
ok(start > 0, 'cap-books.js has the one helper bkSoldLabel');
const ctx = { tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), bkDate: (d) => 'D' + d };
vm.createContext(ctx);
if (start > 0) vm.runInContext(books.slice(start, end), ctx);
const label = (p) => (start > 0 ? ctx.bkSoldLabel(p) : '');
for (const [word, words] of [['week', 'this week'], ['mtd', 'this month'], ['quarter', 'this quarter'], ['ytd', 'this year']]) {
  const got = label({ word, from: '2026-11-16', to: '2026-11-22' });
  ok(got.includes(words) && got.includes('D2026-11-16') && got.includes('D2026-11-22'), word + ': "' + got + '" says its words and its days');
}
ok(label({ word: 'today' }) === 'Sold today', 'today: "Sold today"');
ok(/this week/.test(label({ word: 'week' })) && !/\{/.test(label({ word: 'week' })), 'no days sent: the words alone, no placeholder left');
ok(/bkSoldLabel\(answer\.period\)/.test(overview), 'the overview Sold tile takes its label from bkSoldLabel(answer.period)');
ok(!/ovTile\('sales', 'Sales, tax in'/.test(overview), 'no bare "Sales, tax in" tile label is left on the overview');
for (const lang of ['hi', 'ar']) {
  const pack = read('strings-' + lang + '.js');
  for (const key of ['Sold this week so far · {from} – {to}', 'Sold this month so far · {from} – {to}', 'Sold this quarter so far · {from} – {to}', 'Sold this year so far · {from} – {to}', 'Sold today'])
    ok(pack.includes("'" + key + "':"), lang + ' pack carries "' + key + '"');
}
console.log('\n' + (fail ? fail + ' FAILED' : 'all ok'));
process.exit(fail ? 1 : 0);
