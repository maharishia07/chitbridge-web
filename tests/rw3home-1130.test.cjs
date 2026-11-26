'use strict';
/* RW3 HOME (walk 3, 1130): RW3-10 the Day book owes a day only when it has happened; RW3-11 an adviser reading a client's books sees the CLIENT's clock.
   Hand figures: 18 Oct 2026 01:30 UTC = 11:30 am in Brisbane (UTC+10, no daylight saving) and 12:30 pm in Sydney (UTC+11 in October).
   Run: node tests/rw3home-1130.test.cjs */
const fs = require('fs'), path = require('path'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

/* RW3-11 · the zone follows the books being read */
const view = read('public/app/books-grant-view.js');
assert(/function useClientZone\(answer\)/.test(view) && /root\.shopZoneSet\(answer\.timezone\)/.test(view), 'the grant view hands the audited shop\'s zone to the one owner (shopZoneSet)');
assert(/useClientZone\(answer\);\s*grantKit\.viewState\.answer = answer;/.test(view), 'every answer sets it before the rows are painted');
assert((view.match(/backToOwnZone\(\)/g) || []).length >= 3, 'the viewer\'s own zone returns when the books are forgotten or closed');
const at = Date.UTC(2026, 9, 18, 1, 30);
const clock = (zone) => new Date(at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zone }).toLowerCase();
assert.strictEqual(clock('Australia/Brisbane'), '11:30 am', 'the client (Brisbane) reads 11:30 am');
assert.strictEqual(clock('Australia/Sydney'), '12:30 pm', 'the firm (Sydney) would have read 12:30 pm: the two screens now take the client\'s zone');

/* RW3-10 · a future day is not owed */
const books = read('public/app/cap-books.js');
assert(/var stripDay = dayRange\.to > bkToday\(\) \? bkToday\(\) : dayRange\.to;/.test(books), 'the strip day never passes the shop\'s today');
assert(/bkNoCloseNotice\(sales, stripDay\)/.test(books) && /bkDaySales\(\(reply && reply\.entries\) \|\| \[\], stripDay\)/.test(books), 'the notice and the strip read the same clamped day');
assert(!/bkNoCloseNotice\(sales, dayRange\.to\)/.test(books), 'no notice names the range end');
console.log('rw3home-1130: ok');
