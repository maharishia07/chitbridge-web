'use strict';
/* tests/catalogue-import-rejects.test.cjs — AN IMPORT TAKES THE GOOD ROWS AND LISTS THE BAD ONES, WITH A DOWNLOAD (WALK S2 S2-F-02, public/app/cap-catalogue-import.js).
 * UNIT      CAT003 import (catalogue pane)
 * OWNS      _cfRejectsHtml: each rejected row on its own line as "line N · field — reason", escaped; no rejects = no block; the download button is there only with rejects.
 *           The preflight keeps Import on when some rows are good (takeGood) and asks the api for skip_bad_rows; checked in the source text.
 * CALLED BY package.json check (web guards). No browser, no network: the one function is cut out of the file and run in a vm.
 * FLOW      source slice → vm → _cfRejectsHtml(reply) → html asserted
 * Run: node tests/catalogue-import-rejects.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0;
const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const src = fs.readFileSync(__dirname + '/../public/app/cap-catalogue-import.js', 'utf8').replace(/\r\n/g, '\n');
const start = src.indexOf('function _cfRejectsHtml');
const end = src.indexOf('/** the rejected rows as a .csv');
assert(start > 0 && end > start, 'the function is where the test looks');
const cx = vm.createContext({ esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) });
vm.runInContext(src.slice(start, end), cx);

ok(cx._cfRejectsHtml({}) === '' && cx._cfRejectsHtml({ rejects: [] }) === '', 'no rejects, no block and no download button');
const html = cx._cfRejectsHtml({ rejects: [{ line: 3, field: 'price', message: '"abc" is not a number' }, { line: 7, field: 'name', message: 'no product name <b>' }] });
ok(/1?2 row\(s\) not imported/.test(html) || /2 row\(s\) not imported/.test(html), 'it says how many rows were left out');
ok(/line 3 · <b>price<\/b> — &quot;abc&quot; is not a number/.test(html), 'a row shows its line, field and reason (escaped)');
ok(/line 7 · <b>name<\/b> — no product name &lt;b&gt;/.test(html), 'a second row, and a server string is escaped');
ok(/data-testid="cf-rejects-download"/.test(html), 'the download button is offered');
ok(/var takeGood = blocking && \(s\.importable \|\| 0\) > 0/.test(src) && /skip_bad_rows: true/.test(src), 'Import stays on when some rows are good, and asks for skip_bad_rows');
console.log('\n' + n + ' passed');
