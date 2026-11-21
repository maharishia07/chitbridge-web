/* tests/ye-f15-card-stage.test.cjs — YE-F-15 (walk YE 21 Nov): a practice card on a phone says the client's year-end stage.
 * HAND-COMPUTED  Elm Park, stage "lodged", no blocker → the card line is the stage word alone; Alder, stage "books_in", blocker "3 months not locked" → "Books in · 3 months not locked";
 *                the stage word is hidden on a table row (the chip carries it) and shown at phone width (the CSS rule).
 * OWNS the offline guard of stageLine (public/app/books-practice-cells.js) and the .bp-stage rule (public/app/books-practice.js).   CARD 04-network/ACC-176-AUDITOR-GRANT */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').split('\r\n').join('\n');
const cells = read('books-practice-cells.js');
const at = cells.indexOf('  function stageLine(');
const ctx = { practiceKit: { escapeHtml: (s) => String(s), translate: (s) => s, stageWord: (k) => ({ lodged: "Filed (owner's word)", books_in: 'Books in' })[k] }, blockerWords: (r) => r.why || '' };
vm.createContext(ctx);
vm.runInContext(cells.slice(at, cells.indexOf('\n  }\n', at) + 5) + ';this.line=stageLine;', ctx);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
ok('no blocker: the stage word alone', () => { const html = ctx.line({ entity_id: 'e1', stage: 'lodged' }, ''); assert.ok(html.includes('class="bp-stage" data-testid="practice-stage-word-e1">Filed (owner\'s word)</b>'), html); });
ok('a blocker: the stage word, then what stands in the way', () => { const html = ctx.line({ entity_id: 'e2', stage: 'books_in', why: ' · 3 months not locked'.replace(/^ · /, '') }, ''); assert.ok(html.includes('Books in · </b>3 months not locked'), html); });
ok('the stage word is shown at phone width only', () => assert.ok(/\.bp-stage\{display:none\}@media\(max-width:700px\)\{\.bp-stage\{display:inline;font-weight:600\}\}/.test(read('books-practice.js'))));
console.log('\n' + n + ' checks');
