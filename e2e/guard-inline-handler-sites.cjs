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
      for (const e of exprs) if (!/^(\$\{)?(root\.)?escJs\(/.test(e)) found.push({ line: i + 1, key: handler + '|' + e });
    }
  });
  return found;
}
const census = {};
for (const f of files) census[f] = [...new Set(sites(fs.readFileSync(path.join(pub, f), 'utf8')).map((s) => s.key))].sort();
// One-word reason per allowlisted signature (2026-11-22 sweep): counter (a loop index or number we compute) · server-id (a uuid from our db, id-guard shaped)
// · constant (a developer-written name, literal or option list) · label (translated developer text, outside the handler value) · style (a developer
// colour or state class outside the handler value) · caller (the whole handler string is built by a caller from constants or escJs, reviewed) ·
// escaped (HTML text outside the handler value, esc()'d). Anything else is REVIEW and fails: classify it, or wrap it in escJs / move it to data-*.
function reasonOf(key) {
  const h = key.slice(0, key.indexOf('|')), e = key.slice(key.indexOf('|') + 1).trim();
  if (/^\$?\{?(esc\()?(tx|txn|txf)\(|^(bkhE|bkstE)\(tx\(|^tx\(|^esc\(tx|^esc\(txn/.test(e) || /^\$\{(tx|esc\(tx)/.test(e)) return 'label';
  if (e === 'esc(r)') return 'counter'; // a tax rate from the pack, typeof number
  if (e === 'index + ",\'" + key') return 'constant'; // EN_ITEM field names
  if (/^(\$\{)?(index|i|j|idx|gi|oi|xi|step|page|month|row\.fy|will\.length|sent\.length|atts\.length|nCand|Number\(.*\)( \|\| 0)?)\}?$/.test(e)) return 'counter';
  if (/^(\$\{)?(root\.esc\()?(c\.id|x\.chit|x\.log_id|x\.supplier_list_id|e\.chit_id|round\.proposal_id|view\.chit\.id|chit\.id)\)?\}?$/.test(e)) return 'server-id';
  if (/var\(--|^\(?(canStep|off|can|EN\.items)|disabled|aria-|font-weight|outline|coming soon|^chip |^btn$|^base$|^TEST_BTN|^'style=|^\$\{(bg|col|clr)\}$/.test(e)) return 'style';
  if (/^(esc\(|\$\{esc\()(item\.name|x\.label|item\[1\]|e\.q|a\.n|l\.unit|label|item|col\.label|item\.bridge|bridge|_shortLbl|_tname|permission\.why|where)|^bkhE\(|^bkstE\(|^file\.name|^word|^bkhMonthLong|^\$\{(esc\(item\.name\)|item\.q|x\.unit|cap|_tname|html|opts|funnel|g|col \|\| ''|_typeInfoBtn|ccSendAsOptions\(\)|outsideAttrs\('ai'\))|^outsideAttrs|^esc\(_tname|^\$\{esc\(_tname/.test(e)) return 'escaped';
  if (/^(\$\{)?(click|fn|on|onch|o\.step|js|readCall|nav|run|esc\((hostDoor|retry|node\.onclick|spec\.act|o\.act|opts\.(oninput|onclick|pick)|onclick|s\.invoke)|\(options\.on|ctx|esc\(opts)/.test(e) || /^\(pick \|\||^esc\(item\.invoke|^\(?options\.on/.test(e)) return 'caller';
  if (/^(\$\{)?(k|l|lbl|label|icon|item|m|v|id|key|x\[0\]|item\[0\]|open|here|e|arg|call\('|PRI\[|s\.label|back|funnel|count|msgCount|_fsel|UI\.aggStates|n && n === vis|pos === |item === |acFlt\(\)|\(UI\.|\(sel|\(tab|\(bad|tab ===|_logFilter|page \?|item\.role|\(item|item\.q|\(c\.custPri|c\.custPri|\(open|st !==|reg\.|on \?|word|x\.unit|\$\{)/.test(e) || /^["']/.test(e) || /^\(?(?:es|c)\w*/.test(e) && /^(chip|btn|base)/.test(e)) return 'constant';
  return 'REVIEW';
}
const census2 = {};
for (const f of files) { census2[f] = {}; for (const k of census[f]) census2[f][k] = reasonOf(k); }
if (process.env.GEN_SITES) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, JSON.stringify(Object.fromEntries(Object.entries(census2).filter(([, v]) => Object.keys(v).length)), null, 1) + '\n'); }
const allow = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const bad = [];
for (const [f, rows] of Object.entries(allow)) for (const [k, why] of Object.entries(rows)) if (!/^(counter|server-id|constant|label|style|caller|escaped)$/.test(why)) bad.push(f + '  ' + k + '  reason "' + why + '" is not one of the seven');
for (const f of files) {
  const have = new Set(Object.keys(allow[f] || {}));
  for (const s of sites(fs.readFileSync(path.join(pub, f), 'utf8'))) if (!have.has(s.key)) bad.push(f + ':' + s.line + '  ' + s.key);
}
if (bad.length) { console.log('  FAIL new interpolation inside an inline handler (use data-x + this.dataset.x, or escJs):\n   ' + bad.join('\n   ')); process.exit(1); }
console.log('  ok   every interpolation inside an inline handler in the app is escJs or in the census (' + Object.values(census).reduce((n, a) => n + a.length, 0) + ' signatures)');
