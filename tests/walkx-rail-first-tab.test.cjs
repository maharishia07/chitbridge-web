'use strict';
/** WALK-X X-F-03: the rail inbox opens on the tab that holds work. vm over firstTabWithWork in app.html; the loadList call site is pinned by text. */
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');
let fail = 0; const ok = (n, f) => { try { f(); console.log('  ok ' + n); } catch (e) { fail++; console.log('  FAIL ' + n + '\n      ' + String(e.message).slice(0, 200)); } };
const m = html.match(/^function firstTabWithWork\([^]*?^}/m);
ok('R0 the helper exists', () => assert.ok(m));
const sb = {}; vm.createContext(sb); if (m) vm.runInContext(m[0] + '\nthis.f=firstTabWithWork;', sb);
const b = (o, a, c) => ({ open: { c: o }, act: { c: a }, close: { c } });
ok('R1 Open empty, Act holds 2 → act', () => assert.strictEqual(sb.f(b(0, 2, 0), 'open'), 'act'));
ok('R2 Open holds work → stays', () => assert.strictEqual(sb.f(b(1, 2, 0), 'open'), null));
ok('R3 all empty → stays', () => assert.strictEqual(sb.f(b(0, 0, 0), 'open'), null));
ok('R4 loadList uses it once, and the empty detail is not "bogie is empty" while work waits', () => { assert.ok(/firstTabWithWork\(rollupBuckets\(\), UI\.state\)/.test(html) && /_tabAutoDone/.test(html) && /X-F-03: work waits/.test(html)); });
process.exit(fail ? 1 : 0);
