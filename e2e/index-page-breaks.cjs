/* index-page-breaks.cjs — */ // break each index-page guard once, run the harness, restore FROM A COPY (never git checkout)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const IDX = 'index.html', APP = 'public/app.html', CAP = 'public/app/cap-books.js';
const BREAKS = [
  ['the ledger becomes the books', IDX, `the ledger records it`, `the books of account record it`],
  ['empty alerts still draw a box', IDX, `.alerts:empty{display:none;margin:0;border:0}`, ``],
  ['the two no-cost figures split', IDX, `labFact('st_prod', none + ' without a cost', 'dn');`, `labFact('st_prod', (none + 1) + ' without a cost', 'dn');`],
  ['an alert loses its fix button', IDX, `+ '<a class="fix" href="' + esc(fixHref) + '"' + (fixBlank ? ' target="_blank" rel="noopener"' : '') + '>' + esc(fixText) + '</a></div>' });`, `+ '</div>' });`],
  ['the page overflows a phone', IDX, `.wrap{max-width:1080px;margin:0 auto;padding:26px 22px 60px}`, `.wrap{width:1080px;margin:0 auto;padding:26px 22px 60px}`],
  ['the till opens in the same tab', IDX, `href="/till.html" target="_blank" rel="noopener"`, `href="/till.html"`],
  ['tax lab pretends its page exists', IDX, `<div class="lab" data-testid="lab-tax">`, `<a class="lab" data-testid="lab-tax" href="tax-lab.html">`],
  ['the labs lose their tint', IDX, `.labs{background:var(--panel);`, `.labs{background:var(--page);`],
  ['the sign-in door goes elsewhere', IDX, `href="app.html#/login"`, `href="app.html"`],
  ['the 404 reaches the screen', IDX, `if (e && e.status === 404) factLine('f_bk', 'Not switched on', 'dn');`, `if (e && e.status === 404) factLine('f_bk', 'Error 404', 'dn');`],
  ['a paragraph sneaks onto the page', IDX, `One shop, one set of numbers.`, `One shop, one set of numbers. ` + new Array(80).fill('ChitBridge is a modern point of sale for the modern shop').join(' ') + `.`],
  ['the deep link is dropped', APP, `var _deep = /^#\\/app\\/([a-z][a-z0-9-]*)$/.exec(h);`, `var _deep = null;`],
  ['home leaves the top bar', APP, `<a data-testid="nav-home" href="/"`, `<a data-testid="nav-home-gone" href="/"`],
  ['people band takes everything', CAP, `if (/^(1300|2100)/.test(c)) return 'people';`, `if (false) return 'people';`],
  ['the results band vanishes', CAP, `      + '<div class="sec" data-testid="bk-band-results">' + tx('Results') + '</div>'\n`, ``],
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
