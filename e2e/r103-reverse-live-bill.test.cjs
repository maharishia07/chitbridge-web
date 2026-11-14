'use strict';
/* OWNS: R1-03 (DEC-267) web twin — the Reverse action on a live bill is SHOWN, greyed with the server's sentence (BRIEF-RULES 4); the web composes no sentence.
   Proves: bkEntryWhy returns the server's words for may_reverse:false and '' otherwise · the Day book and Ledger Reverse actions pass it as `why` ·
   list-ctl greys an action whose why(row) is a sentence · the contract fixture carries may_reverse + why.
   Offline, text + a function lifted from the file. CALLED BY: node e2e/r103-reverse-live-bill.test.cjs (exit 1 on a miss). Api twin: tests/r103-reverse-live-bill.* */
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const books = read('public/app/cap-books.js'), ctl = read('public/app/list-ctl.js'), fixture = JSON.parse(read('e2e/fixtures/web-api.contract.json'));
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) bad++; };
const m = /function bkEntryWhy\(e\) \{[\s\S]*?\n\}/.exec(books);
check(!!m, 'bkEntryWhy exists in cap-books.js');
const why = m ? new Function(m[0] + '; return bkEntryWhy;')() : () => 'missing';
const WORDS = 'This entry is a bill that is still live. Make a credit note instead.';
check(why({ may_reverse: false, why: { code: 'ENTRY_OF_LIVE_BILL', words: WORDS } }) === WORDS, "a live bill: the server's sentence, verbatim");
check(why({ may_reverse: true, why: null }) === '' && why({}) === '' && why(null) === '', 'allowed, unknown (older server) or no entry: no sentence, the button stays live');
check(/why: bkEntryWhy/.test(books) && /return bkEntryWhy\(bkLgEntry\(l\)\)/.test(books), 'the Day book and the Ledger Reverse actions both pass why');
check(/\(why \? ' disabled aria-disabled="true" title="'/.test(ctl), 'list-ctl greys an action whose why is a sentence and shows it');
const entry = ((fixture['GET /api/books/daybook'] || {}).example || {}).entries;
check(Array.isArray(entry) && entry[0] && entry[0].may_reverse === false && entry[0].why && entry[0].why.code === 'ENTRY_OF_LIVE_BILL', 'the contract fixture carries may_reverse + why on a day book entry');
console.log(bad ? bad + ' failed' : 'all passed');
process.exit(bad ? 1 : 0);
