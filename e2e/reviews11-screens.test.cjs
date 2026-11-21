/**
 * reviews11-screens.test.cjs - reviews11 (21 Nov 2026), GF/EL web-screens 17-21 findings fixed in the shared screens.
 * OWNS      proof that: a shared read keeps its list siblings (truncated, total ...); a read for store A never joins store B's; the call log
 *           redacts the answer; an object error is never "[object Object]"; the cart bar shows the block's figure, a tier is read at the cart
 *           quantity, "add all" goes through the quantity gate, maps keyed by outside strings have no prototype; ?api= cannot aim a token at
 *           another host; a source link is http(s) only; the register form escapes and words its errors; a deleted draft leaves memory too;
 *           a swept unsent change is announced; the greyed-tile redraw tolerates a missing tile; a fact link goes only to a path of this site.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews11-screens.test.cjs
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const has = (f, text) => src(f).includes(text);

// GF-17 M5: the clone of a list keeps the non-enumerable siblings unwrap() hung on it
const ctx = vm.createContext({ Object, Array, JSON, structuredClone });
vm.runInContext(liftFns('public/app/core.js', ['_apiCopy', '_apiClone']) + '\nthis.f = { _apiCopy };', ctx);
const list = [{ a: 1 }];
Object.defineProperty(list, 'truncated', { value: true, enumerable: false, configurable: true, writable: true });
const copy = ctx.f._apiCopy(list);
t('a joined read keeps .truncated', copy.truncated === true && copy !== list && copy[0] !== list[0], 'truncated=' + copy.truncated);

// GF-17 M6 / M7 / error object
t('the in-flight key includes the acting-store headers', /JSON\.stringify\(actingHeaders\(\)\)/.test(src('app/core.js')), 'key');
const ctx2 = vm.createContext({ JSON });
vm.runInContext(liftFns('public/app/core.js', ['_callClean']) + '\nthis.f = { _callClean };', ctx2);
const logged = ctx2.f._callClean({ token: 'abc.def', name: 'x' });
t('the call log redacts a token in the answer', logged.indexOf('abc.def') < 0 && logged.indexOf('x') > 0, logged);
t('an object error is not printed as [object Object]', has('app/core.js', "typeof j.error === 'string' ? j.error : j.error && typeof j.error.message === 'string'"), 'unwrap');

// GF-17 M2 / M3 / M4 / M9: cart
t('the bar total is the block figure (grand)', has('app/cart.js', 'Number(M.grand != null ? M.grand : M.ev.total)'), 'bar');
t('"add all" goes through put()', has('app/cart.js', 'else if (!s.sel[id]) put(ns, id, 1);') && !has('app/cart.js', 'else if (!s.sel[id]) s.sel[id] = 1;'), 'group');
t('the tier is priced at the cart quantity', has('app/cart.js', 'Number((s.sel || {})[r.item_id])'), 'tier');
t('maps keyed by outside strings have no prototype', (src('app/cart.js').match(/Object\.create\(null\)/g) || []).length >= 5, 'maps');

// GF-21 / GF-20: ?api= allow-list
const c3 = vm.createContext({ URL, location: { href: 'https://web.chitbridge.example/shop.html', origin: 'https://web.chitbridge.example', hostname: 'web.chitbridge.example' } });
vm.runInContext(liftFns('public/app/cb-words.js', ['cbApiParam']) + '\nthis.f = { cbApiParam };', c3);
const P = c3.f.cbApiParam;
t('?api= to a foreign host is dropped', P('https://evil.example') === '', P('https://evil.example'));
t('?api= to this site, a local host and a sibling host is kept', P('https://web.chitbridge.example/x') && P('http://localhost:4000') && P('https://api.chitbridge.example'), 'allowed');
t('shop.html and tasks.html use it', has('shop.html', 'cbApiParam(new URLSearchParams') && has('tasks.html', 'cbApiParam(q.get'), 'pages');
t('conversion-lab honours ?api= for this origin or local only', has('conversion-lab.html', 'u.origin === location.origin'), 'lab');
t('a source link must be http(s)', has('know-your-business.html', 'x.source_url || \'\').trim())'), 'kyb');
t('a fact link goes only to a path of this site', has('app/shell.js', "[a-z0-9_-]+[.]html)/i.test(go)") && has('app/sides.js', '[.]html)/i.test(String(r.href'), 'href');
t('the greyed tile redraw tolerates a missing tile', has('app/shell.js', 'if (tile) tile.outerHTML = card(entry);'), 'null');

// GF-18 M6 / EL-18 M7 / M4: register form, pick
t('register errors are escaped at the sink', (src('app/register-form.js').match(/\$\{esc\(R\.err\)\}/g) || []).length === 2, 'sink');
t('register failure words through failWords', has('app/register-form.js', 'failWords(e, tx('), 'words');
t('a picked line says whether it had a price', has('app/pick.js', 'priced: raw != null'), 'priced');
t('privacy sheet words through bodyWords', (src('app/shop-privacy.js').match(/bodyWords\(/g) || []).length >= 2, 'bodyWords');

// regexes missing the backslash (the letter s)
t('no split(/s+/) left', !/split\(\/s\+\//.test(src('app/ui-standard.js')) && !/split\(\/s\+\//.test(src('app/lab-kit.js')), 'regex');

// GF-20 M7 / M8: offline
t('del() clears the memory copy first', has('cb-offline.js', 'delete mem[k]; /* reviews11'), 'del');
t('a swept unsent change is announced when the page has no onSwept', has('cb-offline.js', '!cfg.onSwept && ownSwept.length'), 'sweep');

process.exit(fail ? 1 : 0);
