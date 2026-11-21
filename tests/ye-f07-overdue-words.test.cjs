/* tests/ye-f07-overdue-words.test.cjs — YE-F-07 (walk YE 21 Nov): an overdue BAS is named on the firm's row, the tile and the BAS list.
 * HAND-COMPUTED  Elm Park-like row: bas.overdue { n: 1, label "FY27 Q1 (Jul–Sep 2026)", due 2026-10-28 } → "overdue: FY27 Q1 (Jul–Sep 2026) · due 2026-10-28"; Alder-like n 5 → "(+4)";
 *                no overdue → the old "BAS 28 Feb 2027" cell; the tile and the filter exist; the BAS list says "· overdue" on the server's periods[].overdue.
 * OWNS the offline guard of basOverdueWords/basCell (public/app/books-practice-cells.js) and the list word (public/app/cap-period.js).   CARD 04-network/ACC-176-AUDITOR-GRANT */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').split('\r\n').join('\n');
const cells = read('books-practice-cells.js');
const pick = (text, name) => { const at = text.indexOf('  function ' + name + '('); return text.slice(at, text.indexOf('\n  }\n', at) + 5); };
const ctx = { practiceKit: { translate: (s) => s, escapeHtml: (s) => String(s), dayWords: (d) => String(d).slice(0, 10) } };
vm.createContext(ctx);
vm.runInContext(pick(cells, 'basOverdueWords') + pick(cells, 'basCell') + ';this.words=basOverdueWords;this.cell=basCell;', ctx);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
const label = 'FY27 Q1 (Jul–Sep 2026)';
ok('one overdue return is named with its due day', () => assert.strictEqual(ctx.words({ bas: { overdue: { n: 1, label, due: '2026-10-28' } } }), 'overdue: ' + label + ' · due 2026-10-28'));
ok('five overdue: the oldest named, four more counted', () => assert.ok(/\(\+4\)$/.test(ctx.words({ bas: { overdue: { n: 5, label, due: '2025-10-28' } } }))));
ok('the cell shows it instead of the next due date', () => assert.ok(/bas-overdue-e1/.test(ctx.cell({ entity_id: 'e1', bas: { due_date: '2027-02-28', form: 'BAS', overdue: { n: 1, label, due: '2026-10-28' } } }))));
ok('no overdue: the old cell', () => assert.strictEqual(ctx.cell({ bas: { due_date: '2027-02-28', form: 'BAS', due_in_days: 99 } }), 'BAS 2027-02-28'));
ok('the tile, the filter and the BAS list word exist', () => {
  assert.ok(/return_overdue: \['Return overdue', \{ bas: 'overdue' \}\]/.test(read('books-practice-band.js')));
  assert.ok(/\['overdue', 'Overdue'\]/.test(read('books-practice.js')) && /v === 'overdue' \? !!r\.bas\.overdue/.test(read('books-practice.js')));
  assert.ok(/item\.overdue \? ' · ' \+ tx\('overdue'\)/.test(read('cap-period.js')));
});
console.log('\n' + n + ' checks');
