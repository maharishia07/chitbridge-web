// e2e/guard-no-local-escaper.cjs — APPXSS 1129 a (retest, 25 Nov): ONE JS-string escaper for an inline handler, escJs (public/app/helpers.js).
// A local copy (the q() in app.html that left the HTML-entity quote alone, testJs in cap-testing.js) ran script: a supplier named
// d&#39;);window.__xss=1;// ended the string after the browser decoded the attribute. This guard fails when
//   (1) a JS-string escaper is written by hand outside helpers.js (.replace(/\\/g, ...) or .replace(/'/g, "\\'"), or a function named q jsq / testJs ...),
//   (2) the sites that failed (supplier "Record a purchase" / "Record a delivery", the testing screen's case-for button) stop using escJs,
//   (3) escJs, put in the real handler shape and decoded the way the browser decodes an attribute, keeps every payload inside one string.
// Run: node e2e/guard-no-local-escaper.cjs
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const pub = path.join(__dirname, '..', 'public');
const files = ['app.html'].concat(fs.readdirSync(path.join(pub, 'app')).filter((f) => f.endsWith('.js') && f !== 'helpers.js').map((f) => 'app/' + f));
const BS = String.fromCharCode(92); /* one backslash, built so no shell or editor can halve it */
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + why)); if (!ok) fail++; };
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const NAMES = 'jsq|jsStr|testJs|jsEsc|escQ'; /* a local q() is caught by its body (the two replace patterns), not by its name: q is also a DOM getter and a CSV quoter */
const bad = [
  new RegExp('[.]replace[(]/' + BS + BS + '/g'), /* .replace(/\\/g, ...)  — doubling backslashes by hand */
  new RegExp('[.]replace[(]/' + "'" + '/g, *["\']' + BS + BS + "'"), /* .replace(/'/g, "\\'") */
  new RegExp('function +(?:' + NAMES + ') *[(]'),
  new RegExp('(?:const|let|var) +(?:' + NAMES + ') *= *(?:function|[(]?[a-z]*[)]? *=>)')
];
const hits = [];
for (const f of files) read(f).split('\n').forEach((ln, i) => { if (bad.some((re) => re.test(ln))) hits.push(f + ':' + (i + 1)); });
t('no hand-written JS-string escaper outside helpers.js (use escJs)', hits.length === 0, hits.join(', '));
const app = read('app.html'), tst = read('app/cap-testing.js');
t('supplier Record a purchase / delivery build their handler with escJs', /supBuyModal[(]\\'' [+] escJs[(]/.test(app) && /supRecordDelivery[(]\\'' [+] escJs[(]/.test(app), 'escJs missing at supBuyModal / supRecordDelivery');
t('testCaseFor buttons use escJs', !/testCaseFor[(]\\'' [+]\s*(?=\S)(?!escJs)/.test(tst), 'a testCaseFor( argument is not escJs');
const helpers = read('app/helpers.js');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(helpers.match(/function esc\(v\)[\s\S]*?\n\}/)[0] + helpers.match(/function escJs\(v\)[\s\S]*?\n\}/)[0] + ';this.escJs=escJs;', ctx);
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); /* the attribute decode the browser does before the JS runs */
const payloads = ['d&#39;);window.__xss=1;//', "d');window.__xss=1;//", 'd");window.__xss=1;//', 'd' + BS + "');window.__xss=1;//", 'd&amp;#39;);window.__xss=1;//', 'x"><img src=x onerror=window.__xss=1>', "a ');window.__xss=1;//", "O'Brien & Sons"];
const failed = [];
for (const p of payloads) {
  const attr = "supRecordDelivery('" + ctx.escJs(p) + "','" + ctx.escJs(p) + "')"; /* what sits inside onclick="…" */
  const seen = []; const sb = { window: {}, supRecordDelivery: (a, b) => seen.push(a, b) }; vm.createContext(sb);
  try { vm.runInContext(decode(attr), sb); } catch (e) { failed.push(JSON.stringify(p) + ' threw ' + e.message); continue; }
  if (sb.window.__xss || seen.length !== 2 || seen[0] !== p || seen[1] !== p) failed.push(JSON.stringify(p));
}
t('escJs keeps every payload (entity quote, quote, backslash, line separator) inside the string and round-trips it', failed.length === 0, failed.join(' | '));
console.log(fail ? '  FAIL ' + fail : '  4 checks');
process.exit(fail ? 1 : 0);
