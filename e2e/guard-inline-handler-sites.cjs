// e2e/guard-inline-handler-sites.cjs — AV-F-02 (2026-11-22): NO USER TEXT IN AN INLINE on*= HANDLER, by an allowlist that only shrinks.
// esc() writes ' as &#39;, which the HTML parser turns back into ' BEFORE the JS runs; so  onclick="f('${esc(name)}')"  with name = ');alert(1);//
// runs the payload (OWASP XSS Prevention Cheat Sheet rule #3: JS-escape data placed in a JS value; an attribute holding JS is two nested contexts).
// The safe shape needs no escaping decision: data-x="${esc(text)}" onclick="f(this.dataset.x)" — a CONSTANT handler reading a plain attribute.
// WHAT FAILS: any interpolation inside an on*= value of public/app.html and public/app/*.js that is neither escJs(...) nor already listed in
// e2e/fixtures/inline-handler-sites.json (the 2026-11-22 census: developer-written function names, counters and our own ids). The shipped census has
// every user-text site removed (parties' and suppliers' names, categories, bill numbers); a new site must use data-* or justify its row in review.
// The till (public/till.html) is a vendored copy of the api master; its guard is chitbridge-api tests/till-inline-handler-xss.test.cjs.
// Run: node e2e/guard-inline-handler-sites.cjs   (offline; reads source). Regenerate the census only after review: GEN_SITES=1 node e2e/guard-inline-handler-sites.cjs
'use strict';
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const FIX = path.join(__dirname, 'fixtures', 'inline-handler-sites.json');
const files = ['app.html'].concat(fs.readdirSync(path.join(pub, 'app')).filter((f) => f.endsWith('.js')).map((f) => 'app/' + f));
function sites(src) {
  const found = [];
  src.split('\n').forEach((ln, i) => {
    const re = /\bon[a-z]+=(\\?["'])/g;
    let m;
    while ((m = re.exec(ln))) {
      const seg = ln.slice(m.index + m[0].length);
      const end = seg.search(/>\s*['"`+<]|>$|\sdata-/);
      const s = end < 0 ? seg : seg.slice(0, end);
      const handler = (s.match(/^[^'"(]*\(?/) || [''])[0].replace(/[^A-Za-z0-9_.;(]/g, '').slice(0, 40);
      const exprs = [...s.matchAll(/'\s*\+\s*(.+?)\s*\+\s*'/g)].map((x) => x[1].trim()).concat([...s.matchAll(/\$\{([^}]+)\}/g)].map((x) => '${' + x[1] + '}'));
      for (const e of exprs) if (!/^(\$\{)?escJs\(/.test(e)) found.push({ line: i + 1, key: handler + '|' + e });
    }
  });
  return found;
}
const census = {};
for (const f of files) census[f] = [...new Set(sites(fs.readFileSync(path.join(pub, f), 'utf8')).map((s) => s.key))].sort();
if (process.env.GEN_SITES) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, JSON.stringify(census, null, 1) + '\n'); }
const allow = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const bad = [];
for (const f of files) {
  const have = new Set(allow[f] || []);
  for (const s of sites(fs.readFileSync(path.join(pub, f), 'utf8'))) if (!have.has(s.key)) bad.push(f + ':' + s.line + '  ' + s.key);
}
if (bad.length) { console.log('  FAIL new interpolation inside an inline handler (use data-x + this.dataset.x, or escJs):\n   ' + bad.join('\n   ')); process.exit(1); }
console.log('  ok   every interpolation inside an inline handler in the app is escJs or in the census (' + Object.values(census).reduce((n, a) => n + a.length, 0) + ' signatures)');
