'use strict';
// @type: unit
/* CARD: retest 1130 (lane retest1129b): proof for the 1129 inline-handler / stored-XSS fixes that no test named. Offline, reads source and runs the real esc/escJs.
   Findings: GF-app-html-r2#L51 (header name/entity through esc) · GF-app-html-r4#L10 (group name/id escJs) · GF-app-html-r4#L11 (supplier chip data-attributes) ·
   GF-app-html-r6#L48 (lightbox esc(a.n)) · L-sec-web-screens-16#L24 (wlToggle escJs) · L-sec-web-screens-03#L51 and L-sec-web-screens-06#L19 (escJs in handlers,
   esc-in-handler scan clean) · L-sec-web-screens-17#L24 (cart handler args) · L-sec-web-screens-25#L19 (till holdHearStart) · GF-web-screens-01#L35 (data-catg) ·
   EL-web-screens-07#L72 (chit2 unit) · EL-web-screens-09#L73 (definitions retire) · and netAvailToggle escJs (L-sec-web-screens-11#L24).
   Break check: every source check below is also run on the source with escJs( swapped for esc( and must then FAIL (the "flip" lines).
   Run: node tests/retest-1130-xss-handlers.test.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const rd = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const flat = (s) => s.replace(/\s+/g, ' ');
const { scanHandlerEsc } = require('../e2e/lib/handler-esc-scan.cjs');
let n = 0, fail = 0;
const ok = (name, cond, why) => { n++; if (!cond) { fail++; console.log('  FAIL ' + name + (why ? ' - ' + why : '')); } else console.log('  ok  ' + name); };
const flip = (name, check, src) => { const bad = src.replace(/escJs\(/g, 'esc('); ok('flip: ' + name + ' fails on the pre-fix shape (escJs -> esc)', check(bad) === false); };

/* the real helpers */
const helpers = rd('app/helpers.js');
const grab = (re) => { const m = helpers.match(re); if (!m) throw new Error('helper gone: ' + re); return m[0]; };
const box = {}; vm.createContext(box);
vm.runInContext(grab(/function esc\(v\)[\s\S]*?\n\}/) + '\n' + grab(/function escJs\(v\)[\s\S]*?\n\}/), box);
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/* 1. behaviour: a hostile value put through escJs into an inline handler arrives as the same string and runs nothing else */
const payloads = ["x');globalThis.PWN=1;//", '"><img src=x onerror=PWN=1>', 'a\\', "line\nbreak'", "</script><script>PWN=1</script>", 'plain name'];
for (const p of payloads) {
  const html = "<b onclick=\"f('" + vm.runInContext('escJs', box)(p) + "')\">";
  const attr = decode(html.match(/onclick="([^"]*)"/)[1]);
  const got = []; const ctx = { f: (v) => got.push(v), PWN: 0 }; ctx.globalThis = ctx; vm.createContext(ctx);
  let err = null; try { vm.runInContext(attr, ctx); } catch (e) { err = e; }
  ok('escJs round-trips ' + JSON.stringify(p).slice(0, 30) + ' into one call, nothing else runs', !err && got.length === 1 && got[0] === p && !ctx.PWN, err && err.message);
}
/* the old esc() in the same slot is the break the review found */
{
  const p = payloads[0]; const attr = decode(("<b onclick=\"f('" + vm.runInContext('esc', box)(p) + "')\">").match(/onclick="([^"]*)"/)[1]);
  const ctx = { f() {}, PWN: 0 }; ctx.globalThis = ctx; vm.createContext(ctx); try { vm.runInContext(attr, ctx); } catch (e) { /* tolerated */ }
  ok('flip: plain esc() in the same slot lets the payload run', ctx.PWN === 1);
}

/* 2. source sites */
const app = flat(rd('app.html'));
const cHeader = (s) => /esc\(SESSION\.name\)/.test(s) && /esc\(SESSION\.entity \|\| ''\)/.test(s);
ok('GF-app-html-r2#L51 header name and entity are esc()ed', cHeader(app));
const cGroup = (s) => /custToggleNamedGroup\(\\'' \+ escJs\(c\.customer_list_id\) \+ "','" \+ escJs\(item\) \+/.test(s);
ok('GF-app-html-r4#L10 group list id and item go through escJs', cGroup(app));
flip('GF-app-html-r4#L10', cGroup, app);
const cChip = (s) => /data-bid="\$\{esc\(x\.bridge_id\)\}" data-nm="\$\{esc\(String\(supName\(x\)\)\)\}" onclick="viewSupplierPassport\(this\.dataset\.bid,this\.dataset\.nm\)"/.test(s);
ok('GF-app-html-r4#L11 supplier chip passes id and name through data-attributes read by dataset', cChip(app));
ok('GF-app-html-r4#L11 no viewSupplierPassport(\' string argument is left', !/viewSupplierPassport\(\\?'/.test(app));
const cLb = (s) => /<div class="lbtop"><span>\$\{esc\(a\.n\)\}<\/span>/.test(s);
ok('GF-app-html-r6#L48 lightbox top bar writes esc(a.n)', cLb(app));
const cCatg = (s) => /data-catg="\$\{esc\(v\)\}" onclick="\$\{ctx && ctx\.onPick \? ctx\.onPick\(v\) : 'prodCatgFilter\(this\.dataset\.catg\)'\}"/.test(s);
ok('GF-web-screens-01#L35 category chip uses data-catg + this.dataset.catg', cCatg(app));

const wl = flat(rd('app/cap-worklist.js'));
const wlCalls = wl.match(/wlToggle\(&quot;' \+ [^+]*\+/g) || [];
const cWl = (s) => { const c = s.match(/wlToggle\(&quot;' \+ [^+]*\+/g) || []; return c.length >= 2 && c.every((x) => /escJs\(/.test(x)); };
ok('L-sec-web-screens-16#L24 every wlToggle(&quot; handler argument is escJs (' + wlCalls.length + ' sites)', cWl(wl));
flip('L-sec-web-screens-16#L24', cWl, wl);

const chit2 = flat(rd('app/cap-chit2.js'));
const cChit2 = (s) => /escJs\(l\.unit \|\| ''\)/.test(s);
ok('EL-web-screens-07#L72 line unit in the inline onclick goes through escJs', cChit2(chit2));
flip('EL-web-screens-07#L72', cChit2, chit2);
const defs = flat(rd('app/cap-definitions.js'));
const cDef = (s) => /cbDefRetire\(\\'' \+ escJs\(item\.definition_id\) \+/.test(s);
ok('EL-web-screens-09#L73 retire handler arguments go through escJs', cDef(defs));
flip('EL-web-screens-09#L73', cDef, defs);
const cart = flat(rd('app/cart.js'));
const cCart = (s) => /CBCart\.category\(\\'' \+ escJs\(ns\) \+ /.test(s) && /CBCart\.add\(\\'' \+ escJs\(ns\) \+ "','" \+ escJs\(id\) \+/.test(s);
ok('L-sec-web-screens-17#L24 cart handler arguments go through escJs', cCart(cart));
flip('L-sec-web-screens-17#L24', cCart, cart);
const nm = flat(rd('app/cap-network-member.js'));
const cNm = (s) => /netAvailToggle\(\\'' \+ escJs\(item\.key\) \+/.test(s);
ok('L-sec-web-screens-11#L24 netAvailToggle argument (a sibling store key) goes through escJs', cNm(nm));
flip('L-sec-web-screens-11#L24', cNm, nm);
const cat = flat(rd('app/cap-categories.js')) + flat(rd('app/cap-catsetup.js'));
const cCat = (s) => /cbcatSeedPick\(\\'' \+ escJs\(item\) \+/.test(s) && /escJs\(d\.id\)/.test(s);
ok('L-sec-web-screens-06#L19 catsetup and categories handlers go through escJs', cCat(cat));
flip('L-sec-web-screens-06#L19', cCat, cat);

const till = rd('till.html');
const hold = (till.match(/holdHearStart\(\\'' \+ [^\n]*/g) || []);
const cHold = (s) => { const h = s.match(/holdHearStart\(\\'' \+ [^\n]*/g) || []; return h.length >= 2 && h.every((l) => /\+ escJs\(i\.name\)/.test(l)); };
ok('L-sec-web-screens-25#L19 till holdHearStart sites use escJs for the name (' + hold.length + ' sites)', cHold(till));
flip('L-sec-web-screens-25#L19', cHold, till);
ok('L-sec-web-screens-25#L19 till escJs unicode-escapes quote, backslash and angle brackets', /var escJs = function\(s\)\{ return esc\(String\(s==null\?'':s\)\.replace\(\/\[\\\\'"<>&\\r\\n\\u2028\\u2029\]\/g/.test(till));

/* 3. the scan over every public page: no esc( inside a quoted JS string of an inline handler (the till copy is the documented leftover) */
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const leaks = walk(pub).filter((f) => /\.(html|js)$/.test(f) && path.basename(f) !== 'till.html').flatMap((f) => scanHandlerEsc(fs.readFileSync(f, 'utf8')).map((h) => path.relative(pub, f) + ':' + h.line));
ok('L-sec-web-screens-03#L51 / GF-web-screens-01#L35 no esc( inside a handler string anywhere in public (' + leaks.length + ')', leaks.length === 0, leaks.slice(0, 6).join(', '));
ok('flip: the scan reports the unsafe form', scanHandlerEsc("'<b onclick=\"go(\\'' + esc(k) + '\\')\">'").length === 1);

console.log(n + ' checks, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
