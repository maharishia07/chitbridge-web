'use strict';
/* HOME BITS (1129): (1) the bell's dot and the Do-first sentence are ONE list: a page that says what needs you hands the bell its size, so a seat
   with 17 unread feed rows and nothing to do sees no dot beside "Nothing needs you" (AN-F-01); (2) an entity sent as an object never prints
   "[object Object]" in the app header (AM-F-11); (3) the sales change vs last year rides the Sell row's closed line (a closed row hid the Till card's teaser).
   Run: node tests/home-bits-1129.test.cjs */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const fnSrc = (src, name) => { const a = src.indexOf('function ' + name + '('); assert(a >= 0, name + ' exists'); let d = 0, i = src.indexOf('{', a); for (let j = i; j < src.length; j++) { if (src[j] === '{') d++; if (src[j] === '}' && --d === 0) return src.slice(a, j + 1); } };

/* 1 · the bell */
const win = { CBLocale: null, esc: (x) => String(x) }; win.window = win; win.document = { addEventListener() {} };
vm.runInNewContext(read('public/app/rail-bell-html.js'), win);
const kit = win.CBBellKit, dot = (n) => (/data-testid="bell-dot"[^>]*>([^<]*)</.exec(kit.bellButtonHtml({ count: n, open: false })) || [])[1];
assert.strictEqual(dot(17), '17', 'no page list: the feed count shows as before');
kit.needs = 0; assert.strictEqual(dot(17), undefined, 'Nothing needs you (0): no dot, even with 17 unread');
kit.needs = 3; assert.strictEqual(dot(17), '3', 'three doors: the dot says 3');
assert(/aria-label="[^"]*\(3\)"/.test(kit.bellButtonHtml({ count: 17, open: false })), 'the spoken label carries the same 3');
const home = read('public/app/home2.js'), bell = read('public/app/rail-bell.js');
assert(/CBBell\.setNeeds\(doors\.length\)/.test(home), 'doFirst hands the bell the size of the list it just painted');
assert(/setNeeds: setNeeds/.test(bell), 'CBBell exports setNeeds');

/* 2 · the header name */
const app = read('public/app.html');
const ctx = {}; vm.runInNewContext(fnSrc(app, 'entityNameOf') + ';this.f=entityNameOf', ctx);
assert.strictEqual(ctx.f({ display_name: 'cbt-wam-ae-a', id: 1 }, 'x'), 'cbt-wam-ae-a', 'an entity object becomes its display name');
assert.strictEqual(ctx.f('Shop', 'x'), 'Shop'); assert.strictEqual(ctx.f(null, 'fb'), 'fb');
assert(/s\.entity && typeof s\.entity === 'object'/.test(fnSrc(app, 'setSession')), 'setSession normalises an object entity');

/* 3 · the trend on the closed Sell row */
const trendOf = (() => { const c = {}; vm.runInNewContext(fnSrc(home, 'trendOf') + ';this.f=trendOf', c); return c.f; })();
const panel = (t) => ({ querySelector: () => (t == null ? null : { textContent: t }) });
assert.deepStrictEqual(JSON.parse(JSON.stringify(trendOf(panel('↑ +12% vs last year')))), { short: '↑ +12%', full: '↑ +12% vs last year' });
assert.strictEqual(trendOf(panel(null)), null, 'no teaser from the server: nothing drawn (never 0)');
assert(/ix2-trend/.test(home) && /\.ix-v \.ix-tr/.test(read('index.html')), 'the row paints it and the page styles it');
console.log('ok  home bits 1129');
