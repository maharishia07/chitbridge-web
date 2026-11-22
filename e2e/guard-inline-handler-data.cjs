// e2e/guard-inline-handler-data.cjs — AV-F-02 / fixAppXSS (2026-11-22): NO NAME, ID OR TEXT FROM DATA INSIDE A QUOTED JS STRING OF AN INLINE on*= HANDLER.
// The census guard (guard-inline-handler-sites.cjs) only freezes the list; this one is the hard rule with no allowlist file: a quoted interpolation
//   onclick="f('${esc(x.name)}')"   or   onclick="f(\'' + c.id + '\')"
// fails when its expression looks like data (an id, a name, a label, a key, a file, esc(..)). The safe shape is a constant handler reading a plain attribute:
//   data-x="${esc(x.name)}" onclick="f(this.dataset.x)"   (esc as an ATTRIBUTE value is complete; as a JS string it is not, the parser decodes &#39; first)
// Only escJs(...) (a real JS-string escape, proved in guard-xss-handlers.cjs) may sit in a quoted handler string. Run: node e2e/guard-inline-handler-data.cjs
'use strict';
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const files = ['app.html'].concat(fs.readdirSync(path.join(pub, 'app')).filter((f) => f.endsWith('.js')).map((f) => 'app/' + f));
const DATA = /(\bid\b|\.id\b|_id\b|esc\(|\.n\b|\.name\b|label|\.key\b|\bkey\b|bridge|\.q\b|_tname|\bgroup\b|file|\bpid\b|\bref\b|\bmonth\b|_tf\b|\.log_id|proposal_id|chit_id|\bcode\b)/;
const bad = [];
for (const f of files) {
  fs.readFileSync(path.join(pub, f), 'utf8').split('\n').forEach((ln, i) => {
    const re = /\bon[a-z]+=(\\?["'])/g;
    let m;
    while ((m = re.exec(ln))) {
      const seg = ln.slice(m.index + m[0].length);
      const end = seg.search(/>\s*['"`+<]|>$|\sdata-/);
      const s = end < 0 ? seg : seg.slice(0, end);
      const quoted = [...s.matchAll(/'\$\{((?:[^{}]|\{[^{}]*\})+)\}'/g)].map((x) => x[1]).concat([...s.matchAll(/\\?'\s*'\s*\+\s*([^+]+?)\s*\+\s*'\\?'/g)].map((x) => x[1]));
      for (const e of quoted) if (!/^escJs\(/.test(e.trim()) && !/\btx\(/.test(e) && DATA.test(e)) bad.push(f + ':' + (i + 1) + '  ' + s.slice(0, 40).replace(/\s+/g, ' ') + ' | ' + e.trim().slice(0, 60));
    }
  });
}
if (bad.length) { console.log('  FAIL ' + bad.length + ' data value(s) inside a quoted inline-handler string (use data-x + this.dataset.x):\n   ' + bad.join('\n   ')); process.exit(1); }
console.log('  ok   no data value sits in a quoted string of an inline handler (app.html + app/*.js)');
