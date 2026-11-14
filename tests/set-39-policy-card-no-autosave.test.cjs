'use strict';
/* SET-39 (R121b): the workshop Business rules card must NOT save the moment a box changes. A rule is a draft; Save asks first (CBSettings.policyRun).
   Fails if setPolFlag comes back, or if the card's row/markup builders carry an onchange handler. Run: node tests/set-39-policy-card-no-autosave.test.cjs */
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../public/app/cap-admin.js', 'utf8');
let n = 0;
const ok = (c, w) => { assert(c, w); n++; console.log('  ok  ' + w); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = strip(src);
ok(!/setPolFlag/.test(code), 'no setPolFlag in the code of cap-admin.js (the write-on-change function is gone)');
function section(from, to) { const a = src.indexOf(from), b = src.indexOf(to, a); assert(a > 0 && b > a, 'found ' + from); return strip(src.slice(a, b)); }
const card = section('function _polRow(flag)', '/* ---- CHANNELS');
ok(!/onchange\s*=/.test(card) && !/\.onchange\b/.test(card), 'the Business rules row builders carry no onchange handler');
ok(/CBSettings\.policyControl/.test(card) && /CBSettings\.policyEditButtons/.test(card) && /CBSettings\.policyRowEdit/.test(card), 'the card draws via the draft-and-Save helpers (policyControl, policyEditButtons, policyRowEdit)');
const settings = fs.readFileSync(__dirname + '/../public/app/cap-settings.js', 'utf8');
ok(/policyRun/.test(settings), 'cap-settings.js holds policyRun, the one confirmed write');
console.log(n + ' checks');
