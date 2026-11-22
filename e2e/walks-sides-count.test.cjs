'use strict';
// @type: unit
/**
 * walks-sides-count.test.cjs - WALK S S-F-02: "We lean on 5 / Leans on us 3" on a brand-new shop counted the placeholder rows ("not yet", "Nobody yet").
 * The count is now rows with something real behind them.
 *
 * OWNS      the proof for CBSides.countOf (app/sides.js)
 * CALLED BY ci.yml (QA gate); by hand: node e2e/walks-sides-count.test.cjs
 * FLOW      load sides.js in a vm with a bare window, hand countOf the answer a new shop gets, then a shop with real links
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shell
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const box = { console }; box.window = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'sides.js'), 'utf8'), box);
const later = (id) => ({ id, n: id, s: 'later' });
const newShopLean = [{ key: 'rules', rows: [later('jurisdiction'), later('standards'), later('constitution')] }, { key: 'mould', rows: [later('boilerplate'), later('blueprint')] }];
const newShopUse = [{ key: 'trade', rows: [{ id: 'nobody', s: 'empty' }] }, { key: 'cite', rows: [later('filings'), later('proof')] }, { key: 'inherit', rows: [later('inherit')] }];
check(box.CBSides.countOf(newShopLean) === 0, 'a new shop: We lean on counts 0 (five "not yet" rows are not links)');
check(box.CBSides.countOf(newShopUse) === 0, 'a new shop: Leans on us counts 0 (placeholders and "Nobody yet" are not links)');
check(box.CBSides.countOf([{ key: 'rules', rows: [{ id: 'constitution', s: 'ok' }, later('x')] }, { key: 'buy', rows: [{ id: 'suppliers' }] }]) === 2, 'a real row (ok, or no state) counts; a "not yet" row does not');
check(box.CBSides.countOf(null) === 0, 'no groups is 0');
process.exit(failures ? 1 : 0);
