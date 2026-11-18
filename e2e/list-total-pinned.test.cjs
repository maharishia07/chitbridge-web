'use strict';
// @type: unit
/**
 * list-total-pinned.test.cjs — P1-2 (18 Nov): a list's appended total line stays in view at the foot of the window (Trial balance at 1366×768).
 * OWNS      the proof that list-ctl.js marks a _total row cbl-total in BOTH row paths and list-ctl-css.js pins the last one (sticky, bottom 0).
 * CALLED BY by hand: node e2e/list-total-pinned.test.cjs
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 */
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
let failures = 0;
const check = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) failures++; };
check(read('list-ctl.js').split("ctx.row._total ? ' cbl-total'").length - 1 === 2, 'both row paths mark a total row cbl-total');
check(/\.cbl-row\.cbl-total:last-child\{position:sticky;bottom:0/.test(read('list-ctl-css.js')), 'the last total row is pinned at the foot of the list window');
process.exit(failures ? 1 : 0);
