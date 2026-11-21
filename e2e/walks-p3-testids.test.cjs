'use strict';
// @type: unit
/**
 * walks-p3-testids.test.cjs - WALK S S-F-10 / S-F-11 (and S-F-09 popup fit): a sortable column header carries a data-testid (cell list-col-<key>, button list-sort-<key>) and the Setup
 * "Your business" tax-id and address inputs carry pf-tax-id / pf-address, so a walk can find them by name.
 *
 * OWNS      the proof that app/list-ctl.js headerCellHTML and app/cap-shop.js shopFieldsHTML emit those ids
 * CALLED BY ci.yml (QA gate); by hand: node e2e/walks-p3-testids.test.cjs
 * FLOW      read the two sources, find the emitting lines
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/list-ctl
 */
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const lc = read('list-ctl.js'), shop = read('cap-shop.js');
check(/role="columnheader"' \+ \(id \? ' data-testid="list-col-' \+ esc\(id\)/.test(lc), 'a sortable column cell carries data-testid list-col-<key>');
check(/class="sort" data-testid="list-sort-' \+ esc\(id\)/.test(lc), 'its sort button carries data-testid list-sort-<key>');
check(/data-cbsid="ACC002-I04" data-testid="pf-tax-id"/.test(shop) && /data-cbsid="ACC002-I05" data-testid="pf-address"/.test(shop), 'the tax-id and address inputs keep their code and id and gain a testid');
check(lc.includes('function fitPop(box)') && lc.includes('ctx.box.innerHTML = ctx.h;\n    fitPop(ctx.box);'), 'S-F-09: an opened list popup is cut to the room under its top edge (fitPop runs after every toolbar paint)');
process.exit(failures ? 1 : 0);
