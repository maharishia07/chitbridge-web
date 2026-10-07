/* index-page-breaks.cjs — break each index-page guard once, run the harness, restore FROM A COPY (never git checkout).
 * N18: the index is the shell's Home (index.html + public/app/manifest.json); e2e/index-page.cjs is the harness.   */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const IDX = 'index.html', MAN = 'public/app/manifest.json';
const BREAKS = [
  ['a hand-written card sneaks in', IDX, `<div id="shell"></div>`, `<div id="shell"></div><a class="cbsh-box" href="/till.html">Till</a>`],
  ['a built card links into the workshop', MAN, `"route": "/till.html"`, `"route": "/app.html#/app/till"`],
  ['a workshop chip grows a route', MAN, `"id": "catalogue", "name": "Catalogue", "route": null`, `"id": "catalogue", "name": "Catalogue", "route": "/crm.html"`],
  ['the rail invents a number', IDX, `if (!rail || !rail.facts) return;`, `if (!rail) return; if (!rail.facts) return railPaint({ suppliers: 0, customers: 0 });`],
  ['an alert loses its fix button', IDX, `+ '<a class="fix" href="' + esc(fixHref) + '"' + (fixBlank ? ' target="_blank" rel="noopener"' : '') + '>' + esc(fixText) + '</a></div>' });`, `+ '</div>' });`],
  ['the 404 reaches the screen', IDX, `    if (w) alert_('ledger-waiting', 'warn', '🕗', w + ' waiting for the ledger', '', 'See them', '/accounts.html#waiting');\n  }).catch(function(){});`, `    if (w) alert_('ledger-waiting', 'warn', '🕗', w + ' waiting for the ledger', '', 'See them', '/accounts.html#waiting');\n  }).catch(function(e){ alert_('ledger-err', 'bad', '!', 'Error ' + e.status, '', 'Retry', '/'); });`],
  ['the page mounts the bar, not Home', IDX, `    host: null,`, `    host: { bar: true },`],
  ['the signed-out row grows a second door', IDX, `<button class="fix" data-testid="signed-out-go">Sign in</button>`, `<a class="fix" href="/app.html#/login" data-testid="signed-out-go">Sign in</a>`],
  ['the word accounting reaches the page', IDX, `<h3>The rail</h3>`, `<h3>The rail (accounting)</h3>`],
  ['the rail overflows a phone', IDX, `.rail{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px 20px 16px;`, `.rail{min-width:600px;border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px 20px 16px;`],
];
/* BREAK_ONLY=<text> runs just the breaks whose name contains it */
const ONLY = process.env.BREAK_ONLY || '';
let good = 0, ran = 0;
for (const [name, rel, a, b] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const f = path.join(W, rel), bak = f + '.bak';
  const s = fs.readFileSync(f, 'utf8'); const n = s.split(a).length - 1;
  if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n); continue; }
  fs.copyFileSync(f, bak);
  try {
    fs.writeFileSync(f, s.split(a).join(b));
    const r = cp.spawnSync(process.execPath, ['e2e/index-page.cjs'], { cwd: W, encoding: 'utf8', timeout: 300000 });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0 && xx.length > 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + xx[0].trim() : 'NOT caught (exit ' + r.status + ')'));
  } finally { fs.copyFileSync(bak, f); fs.unlinkSync(bak); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught');
process.exitCode = good === ran ? 0 : 1;
