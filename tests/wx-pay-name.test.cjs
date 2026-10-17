'use strict';
/* WX-O2C (2026-10-13): Receive from Receivables / CB Finance › Collections named nobody ("Receive · ") — those pages do not load the party lists
   payOpen looked the name up in. The row hands its own name (third argument); the lists still win when loaded. Run: node tests/wx-pay-name.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const books = fs.readFileSync(__dirname + '/../public/app/cap-books.js', 'utf8'), fin = fs.readFileSync(__dirname + '/../public/app/cap-finance.js', 'utf8');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
/* INT5b: the third argument is `pre` (main's bank-rec prefill object) or the row's name (a string) */
ok(/function payOpen\(kind, partyId, pre\)/.test(books) && /nm = typeof pre === 'string' \? pre : ''/.test(books) && /name: r\.nickname \|\| r\.display_name \|\| d\.name \|\| nm \|\| ''/.test(books), 'payOpen takes the row\'s name, after the party lists');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
[['Receivables (Dues)', books, /data-testid="dues-pay-' \+ id \+ '" onclick="([^"]*)"/], ['Finance', fin, /data-testid="fin-receive-' \+ id \+ '" onclick="([^"]*)"/]].forEach(([where, src, re]) => {
  const m = re.exec(src); ok(m && /esc\(JSON\.stringify\(String\(p\.name \|\| ''\)\)\)/.test(m[1]), where + ' hands p.name to payOpen');
  /* the attribute as the browser decodes it is valid JS that passes the name — even a name with quotes */
  const name = "Ravi \"R\" O'Brien Stores";
  const attr = "event.stopPropagation();payOpen('customer','P1'," + esc(JSON.stringify(name)) + ')';
  const decoded = attr.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  let got = null; vm.runInNewContext(decoded, { event: { stopPropagation() {} }, payOpen: (k, id, nm) => { got = nm; } });
  ok(got === name, where + ': a name with quotes reaches payOpen whole');
});
console.log(n + ' checks passed');
