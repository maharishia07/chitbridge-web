'use strict';
/**
 * tests/misfix-1121-web.test.cjs — F-54 (the Accounts menu fits a 1366×768 window: only the open view's group is open until the owner chooses) and F-67 (the P&L head
 * reads to the day the server says, "year to date", never the year to come). vm over the page's own functions.
 * OWNS    the F-54 / F-67 proofs        CALLED BY npm test, .github/workflows/ci.yml        CARD    books/menu
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'public', p), 'utf8');
const cut = (src, head, end) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf(end, i)); };

/* F-54 */
const page = read('accounts.html');
const nav = { innerHTML: '' }, store = {};
const ctx = { window: { innerHeight: 768, innerWidth: 1366 }, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, esc: (x) => String(x), tx: (x) => x, $: () => nav, typeof: undefined, viewOnlyLogin: () => false /* red1128: the nav now greys shut views (WALK M); a full login shuts none */ };
ctx.NAV = [['todo', 'To do', ''], ['overview', 'Overview', ''], ['daybook', 'Day book', ''], ['lock', 'Month lock', ''], ['packs', 'Packs', '']];
vm.createContext(ctx);
vm.runInContext(cut(page, 'const NAV_GROUPS', 'const navFolded').replace('const NAV_GROUPS', 'var NAV_GROUPS'), ctx);
vm.runInContext(cut(page, 'const navFolded', '/** the period-end item'), ctx);
vm.runInContext('function taxCloseWord(){}\n' + cut(page, 'function navPaint(', "$('nav').addEventListener"), ctx);
const shutGroups = () => (nav.innerHTML.match(/class="nav-sec shut"/g) || []).length;
vm.runInContext("navPaint('overview')", ctx);
assert.strictEqual(shutGroups(), 3, 'short window, no choice yet: Outstandings, Period end and Setup are folded, Books (open view) is not');
ctx.window.innerHeight = 1080;
vm.runInContext("navPaint('overview')", ctx);
assert.strictEqual(shutGroups(), 0, 'a tall window keeps every group open');
ctx.window.innerHeight = 768; store.cb_acc_navfold = JSON.stringify({ 'Period end': false });
vm.runInContext("navPaint('overview')", ctx);
assert.strictEqual(shutGroups(), 2, 'a group the owner opened stays open on a short window');

/* F-67 */
const g = read('app/books-grant-reports.js');
const c2 = { esc: (x) => String(x), grantKit: { words: (x) => x }, root: { shopDay: (d) => 'D' + d } };
vm.createContext(c2);
vm.runInContext(cut(g, 'function forTag(a)', '/** the "As at'), c2);
const tag = (a) => vm.runInContext('forTag(' + JSON.stringify(a) + ')', c2);
assert.ok(/D2026-07-01 – D2026-11-21 · year to date/.test(tag({ from: '2026-07-01', to: '2027-06-30', period: { through: '2026-11-21' } })), 'a range past today is headed to today');
assert.ok(/D2026-07-01 – D2026-09-30<\/span>/.test(tag({ from: '2026-07-01', to: '2026-09-30', period: {} })), 'a finished range keeps its own end');
console.log('misfix-1121-web: 5 ok');
