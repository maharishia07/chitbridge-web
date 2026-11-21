/* batch 1128 fixSpeed: a page that writes <script type="cb-late"> tags must load app/late-scripts.js BEFORE the first of them (the browser never fetches a type it does not know),
   every late tag carries a group, and a screen that waits on CBLate (cap-finance.js, chit-sheet.js) only waits on what the page defers. */
const fs = require('fs'), path = require('path'), assert = require('assert');
const pub = path.join(__dirname, '..', 'public');
let n = 0;
for (const page of ['accounts.html', 'finance.html']) {
  const html = fs.readFileSync(path.join(pub, page), 'utf8');
  const loader = html.indexOf('<script src="/app/late-scripts.js">'), firstLate = html.indexOf('type="cb-late"');
  assert(loader > 0 && firstLate > loader, page + ': late-scripts.js loads before the first late tag');
  const tags = html.match(/<script type="cb-late"[^>]*>/g) || [];
  assert(tags.length > 5, page + ': late tags present');
  for (const t of tags) {
    assert(/data-late-group="[a-z]+"/.test(t), page + ': a group on ' + t);
    const src = (/src="([^"]+)"/.exec(t) || [])[1];
    assert(fs.existsSync(path.join(pub, src)), page + ': ' + src + ' exists');
  }
  n += tags.length;
}
/* the first screen's own code stays blocking: shell, core, cap-books / cap-finance and the Collect tab */
const acc = fs.readFileSync(path.join(pub, 'accounts.html'), 'utf8'), fin = fs.readFileSync(path.join(pub, 'finance.html'), 'utf8');
for (const must of ['/app/core.js', '/app/cap-books.js', '/app/shell.js', '/app/accounts-shell.js']) assert(!new RegExp('type="cb-late"[^>]*src="' + must + '"').test(acc), must + ' stays blocking');
assert(!/cb-late"[^>]*src="\/app\/cap-finance(-terms)?\.js"/.test(fin), 'Finance: the Collect tab and the tab switch stay blocking');
console.log('late-scripts.test: ok (' + n + ' late tags)');
