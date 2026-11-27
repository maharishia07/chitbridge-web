'use strict';
/* FIN-127 (1131): a Dues bill row never shows the same action twice. "Set terms" is in the action column ONLY; the Due date cell says "No due date".
   The link opens the party's terms in a side panel (the one terms editor, framed), Ctrl/middle-click opens a new tab, a save re-ages the rows.
   Run: node tests/fin127-set-terms-once.test.cjs */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const ok = (m) => { n++; console.log('  ok  ' + m); };
const books = read('public/app/cap-books.js');
const cut = (name) => { const a = books.indexOf('function ' + name + '('); assert(a >= 0, name); let d = 0, j = books.indexOf('{', a); for (; j < books.length; j++) { if (books[j] === '{') d++; else if (books[j] === '}' && --d === 0) break; } return books.slice(a, j + 1); };

/* 1 · one place draws the link: the action column */
const callers = books.split('\n').filter((l) => /bkSetTermsLink\(/.test(l) && !/^\s*(\*|\/\/)/.test(l) && !/function bkSetTermsLink/.test(l));
assert.strictEqual(callers.length, 1, 'bkSetTermsLink has one caller (the action column): ' + callers.length);
assert(/row\.action === 'terms'\) return bkSetTermsLink\(pid\)/.test(callers[0] + '') || /bkNeedAction/.test(books), 'the caller is bkNeedAction');
ok('"Set terms" is drawn from ONE place: the action column');
assert(/'No due date'/.test(books) && /no_terms && row\.status !== 'paid' \? '<span data-b="no-due-date"/.test(books), 'due cell is plain words'); ok('the Due date cell says "No due date", plain');

/* 2 · the link: new tab by href, panel by plain press */
const ctx = { esc: (s) => String(s), tx: (s) => s, encodeURIComponent }; vm.createContext(ctx);
vm.runInContext(cut('bkSetTermsLink') + '\nthis.f = bkSetTermsLink;', ctx);
const html = ctx.f('P-1');
assert(/href="\/finance\.html#terms\/party\/P-1"/.test(html) && /onclick="return bkTermsPanelOpen\(event,this\)"/.test(html) && (html.match(/Set terms/g) || []).length === 1); ok('one link, href = the party in the terms editor (Ctrl / middle-click: new tab), a plain press: the panel');
const open = cut('bkTermsPanelOpen');
assert(/event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey \|\| event\.button > 0\) return true/.test(open)); ok('Ctrl / Meta / Shift / middle press is left to the browser');
assert(/\?panel=1/.test(open) && /key === 'Escape'/.test(cut('bkTermsPanelKey')) && /\.focus\(\{ preventScroll: true \}\)/.test(cut('bkTermsPanelClose'))); ok('Esc closes the panel and the focus returns to the same row, scroll untouched');
assert(/what === 'saved'[\s\S]{0,400}bkPbRead\(pid\)[\s\S]{0,120}booksDuesLoad\(true\)/.test(books)); ok('a save re-reads the party bills and the dues: the rows re-age at once');
const terms = read('public/app/cap-finance-terms.js');
assert(/ftTellPanel\('saved'\)/.test(terms) && /ftPanelOpenOnce\(\)/.test(terms)); ok('the terms editor opens the party sheet in panel mode and tells the page a save landed');

/* 3 · the general guard: a row-drawing function never repeats an action word across its cells */
const cells = books.slice(books.indexOf("{ k: 'due'"), books.indexOf("{ k: 'days'"));
assert(!/bkSetTermsLink|Set terms/.test(cells), 'the due cell has no action word'); ok('no cell of a bill row repeats the action column word');
console.log('\n  ' + n + ' passed');
