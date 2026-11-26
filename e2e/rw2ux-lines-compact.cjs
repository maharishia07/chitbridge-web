/* rw2ux-lines-compact.cjs — RW2-11: the list unit carries the compact Lines entry for a narrow list box (a side pane, a phone): a container query on the LIST's box, amount beside the words, account line one row, day band one row. Source check only; the 1366x768 / 390x844 measure is in the batch note. */
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'list-ctl-css.js'), 'utf8');
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) bad++; };
ok(/@container list \(max-width: 700px\)\{\.cbl \.cbl-lines \.cbl-lrec\{padding:2px 10px\}/.test(css), 'a narrow list box tightens the Lines entry (container query on the list, not the viewport)');
ok(/@container list \(min-width: 461px\) and \(max-width: 700px\)\{\.cbl \.cbl-lines \.cbl-lline\{flex-wrap:nowrap/.test(css), 'a pane-wide box keeps the amount beside the words');
ok(/\.cbl-lines \.cbl-lgist\{[^}]*text-overflow:ellipsis/.test(css), 'the account line is one ellipsised row');
ok(!/@media[^{]*\.cbl-lines/.test(css), 'no viewport media query for the Lines entry');
console.log('\n  ' + (bad ? bad + ' failed' : 'all ok')); process.exit(bad ? 1 : 0);
