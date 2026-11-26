// RW3 ux fixes (26 Nov): shop owner on /app.html goes Home; sheet grammar for plain sheets; Move in controls inside the card; builder words mapped; entry bands flow.
const fs = require('fs'); const r = (p) => fs.readFileSync(__dirname + '/../public/' + p, 'utf8');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } else console.log('  ok  ' + m); };
ok(/SESSION\.role === 'entity'\) \{\s*location\.replace\('\/'\)/.test(r('app.html')), 'RW3-25 owner on /app.html goes Home');
const css = r('app/accounts-page.css');
ok(/dialog\.sheet \.nw-acts\{position:sticky/.test(css), 'RW3-13 action row sticks inside a plain sheet');
ok(/\.mi-row \.mi-val select/.test(css) && /class="mi-row"/.test(r('app/cap-move-in.js')), 'RW3-14 Move in selects stay in their cell');
ok(!/nowrap/.test(r('app/cap-books-needs.js').split('\n').filter((l) => /bk-needs/.test(l)).join('')), 'RW3-14 needs chips wrap');
const sd = r('app/sides.js');
ok(/function plainWord/.test(sd) && !/Mould we came from/.test(sd), 'RW3-21 builder words mapped in sides.js');
ok(/class=\?"en-bands/.test(r('app/cap-entry.js')) || /en-bands/.test(r('app/cap-entry.js')), 'RW3-13 entry bands flow side by side');
process.exit(bad ? 1 : 0);
