'use strict';
/* WX-O2C (2026-10-13): CB Accounts opens a bill by its door (app.html #/app/chit/<id>). Found on the real stack: a bill older than the Task list's
   first page (50 rows) opened, then the list's load replaced it with row 1 — the owner saw a Day summary instead of the bill.
   The door pins the id (UI.pin) and the list's "is the pane showing what is selected" check honours it. Run: node tests/wx-chit-door.test.cjs */
const fs = require('fs'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const html = fs.readFileSync(__dirname + '/../public/app.html', 'utf8');
const door = /if\(_bill && SESSION\.token\)\{[^\n]*\}/.exec(html);
ok(door && /UI\.pin=decodeURIComponent\(_bill\[1\]\)/.test(door[0]) && /openChit\(UI\.pin\)/.test(door[0]), 'the door pins the id it opens');
const line = /const here = (UI\.sel && \([^;]+\));/.exec(html);
ok(line, 'the list load asks "is the selection here, or pinned"');
const here = (UI) => Function('UI', 'return ' + line[1])(UI);
const rows = [{ id: 'day-summary' }, { id: 'bill-new' }];
ok(here({ sel: 'bill-old', pin: 'bill-old', rows }), 'a pinned bill NOT on the first page stays open');
ok(!here({ sel: 'other-folder', pin: 'bill-old', rows }), 'a selection from another folder (not pinned, not listed) is still replaced');
ok(here({ sel: 'bill-new', rows }), 'a listed selection stays');
console.log(n + ' checks passed');
