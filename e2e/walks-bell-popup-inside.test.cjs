'use strict';
// @type: unit
/**
 * walks-bell-popup-inside.test.cjs - WALK S S-F-08: the bell popup (POP113) must stay inside a 390px viewport. The panel is anchored to the bell's right edge,
 * 359px wide, so at 390 it left the screen (x -30 / -78). On a phone (max-width 620px) it is fixed to the screen edges instead.
 *
 * OWNS      the proof that app/rail-bell-html.js carries the narrow-screen rule AFTER the base panel rule, with both edges set and no fixed width
 * CALLED BY ci.yml (QA gate); by hand: node e2e/walks-bell-popup-inside.test.cjs. The pixel proof is e2e/rail-bell.cjs on a box.
 * FLOW      read the CSS source string, find the base rule and the 620px rule, check order and declarations
 * CARD      28-platform-and-operations/rail-bell
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'rail-bell-html.js'), 'utf8');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const base = src.indexOf('.cbb-panel{position:absolute');
const narrow = src.indexOf('@media (max-width:620px){.cbb-panel{');
check(base > 0 && narrow > base, 'the phone rule for .cbb-panel comes after the base rule, so it wins');
const rule = narrow > 0 ? src.slice(narrow, src.indexOf('}}', narrow)) : '';
check(/position:fixed/.test(rule) && /inset-inline:8px/.test(rule) && /width:auto/.test(rule), 'on a phone the panel is fixed with 8px at both edges and no fixed width');
check(/top:auto/.test(rule), 'it stays under the bell (top auto keeps the static position)');
process.exit(failures ? 1 : 0);
