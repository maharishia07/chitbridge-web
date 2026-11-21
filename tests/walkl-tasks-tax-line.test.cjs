'use strict';
/* WALK L L-F-06 (21 Nov 2026): the Tasks and Orders sheet says its total holds the tax: "AED 400.00 · incl. VAT 19.05", the tax word from the country pack, the figure as the chit states it (tax_minor from GET /api/work/:id).
   Hand figures in fils (UAE 5%): 4 x 100.00 inclusive = total 40000 fils; the tax the chit states (1905 fils = 19.05) is the api's figure and is only printed here.
   Offline, no browser. Run: node tests/walkl-tasks-tax-line.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const sandbox = { console, esc: (s) => String(s == null ? '' : s), tx: (s) => s, bkMoney: (m, c) => c + ' ' + (m / 100).toFixed(2), document: { getElementById: () => null }, EP: {}, CBList: { mount: () => ({}) } };
const cx = vm.createContext(sandbox); cx.window = cx; cx.globalThis = cx;
cx.CBAssign = { slotHTML: () => '', queue: () => ({ views: [], filter: {} }) };
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-tasks-assign.js', 'utf8'), cx);
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-tasks.js', 'utf8'), cx);
const head = cx.CBTasks.headLine;
const chit = { party: 'Acme', total_minor: 40000, tax_minor: 1905, currency: 'AED', age_days: 0 };
cx.packWord = (kind) => (kind === 'taxName' ? 'VAT' : '');
ok(/AED 400\.00<\/span> · <span[^>]*tk-tax[^>]*>incl\. VAT AED 19\.05<\/span>/.test(head(chit)), 'the total is followed by "incl. VAT" and the tax the chit states, the word from the pack');
cx.packWord = (kind) => (kind === 'taxName' ? 'GST' : '');
ok(head(chit).includes('incl. GST AED 19.05'), 'another country says its own word (GST), none is written in the sheet');
delete cx.packWord;
ok(head(chit).includes('incl. tax AED 19.05'), 'a pack with no word says plain "tax"');
ok(!head(Object.assign({}, chit, { tax_minor: null })).includes('incl.'), 'a chit that states no tax claims none');
ok(!head({ party: 'Acme', total_minor: null, currency: 'AED', cost_hidden: true, age_days: 0 }).includes('incl.'), 'a cost-hidden reader gets no tax_minor from the api (never in the blind allowlist), so no tax line');
console.log(n + ' checks');
