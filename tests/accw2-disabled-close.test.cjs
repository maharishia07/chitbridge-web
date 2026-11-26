/**
 * accw2-disabled-close.test.cjs — FW-33 (walk 25 Nov 2026): the Close button of a quarter that has not ended is DISABLED by the page, and a disabled primary button looks grey.
 * The page greys it from the server's `period.ended` (cap-period.js peReturnCloseCard); the walk saw it green because no style said what a disabled primary button looks like.
 * Run: node tests/accw2-disabled-close.test.cjs
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', file), 'utf8');
const period = read('cap-period.js');
const card = period.slice(period.indexOf('function peReturnCloseCard'), period.indexOf('/** the boxes as the Task table'));
assert.ok(/greyWhy = period\.ended \? '' : txf\('Ends on/.test(card), 'the day the quarter ends comes from the server period.ended');
assert.ok(/data-testid="pr-close" disabled/.test(card), 'a quarter still running gets a DISABLED button');
assert.ok(/data-testid="pr-close-why"/.test(card), 'and the sentence says why');
const css = read('cap-books.js');
const rule = css.split('\n').find((line) => line.indexOf('button.supact-pri:disabled') >= 0) || '';
assert.ok(/#bk_body \.supacts button:disabled/.test(rule), 'a disabled action button has its own style');
assert.ok(/background:var\(--card\)/.test(rule) && /color:var\(--grey\)/.test(rule) && /cursor:not-allowed/.test(rule), 'grey, not the filled accent');
assert.ok(css.indexOf('button.supact-pri:disabled') > css.indexOf('button.supact-pri{background:var(--accent)'), 'the disabled rule comes after the primary rule, so it wins');
console.log('accw2-disabled-close: 6 passed');
