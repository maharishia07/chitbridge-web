/* tests/bank-preview-build-calls.test.cjs - GUARD (batch 1138): every painter public/app/bank-preview-ui-parts.js declares as `addXxx(ctx)` is called by build(ctx), in the order that matters. A readability split once replaced `addTaxWords(ctx)` with a second `addAsks(ctx)` and the money words of a statement line went missing; the orphan guard saw it, this test names it. Run: node tests/bank-preview-build-calls.test.cjs */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'bank-preview-ui-parts.js'), 'utf8');
const a = src.indexOf('function build(ctx) {'); assert(a > 0, 'build(ctx) exists');
const body = src.slice(a, src.indexOf('\n  }', a));
const declared = [...src.matchAll(/function (add[A-Z]\w*)\(ctx\)/g)].map((m) => m[1]);
const called = [...body.matchAll(/(add[A-Z]\w*)\(ctx\);/g)].map((m) => m[1]);
declared.forEach((name) => assert(called.includes(name), name + ' is declared but build(ctx) never calls it (a split dropped the call)'));
console.log('  ok  every add* painter is called by build(ctx): ' + declared.length);
assert.strictEqual(called.filter((n) => n === 'addAsks').length, 1, 'addAsks is called once');
assert(called.indexOf('addTaxWords') === 0, 'addTaxWords comes first: the money words every later painter reads');
assert(called.indexOf('addPartyAsks') === called.indexOf('addAsks') + 1, 'addPartyAsks follows addAsks');
console.log('  ok  addTaxWords first, addAsks once, addPartyAsks right after it');
