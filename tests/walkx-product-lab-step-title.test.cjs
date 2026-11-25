'use strict';
/** WALK-X X-F-09: the Product lab step title wraps inside its box at 390 (flex child may shrink, title breaks), no clip. Static CSS check. */
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'product-lab.html'), 'utf8');
let fail = 0; const ok = (n, f) => { try { f(); console.log('  ok ' + n); } catch (e) { fail++; console.log('  FAIL ' + n); } };
ok('R1 .stp may shrink', () => assert.ok(/\.stp\{[^}]*min-width:0/.test(css)));
ok('R2 the title wraps', () => assert.ok(/\.stp \.t\{[^}]*overflow-wrap:anywhere/.test(css)));
ok('R3 the text block may shrink', () => assert.ok(/\.stp > span:last-child\{min-width:0/.test(css)));
process.exit(fail ? 1 : 0);
