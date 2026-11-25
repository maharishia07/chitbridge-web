'use strict';
/* DECISIONS 22 Nov item 5(b): the Add staff label picker says in one line what the picked label can do (the server's own why), and sends the hat the label pins
   (Bookkeeper = manager) through the same body as before. By source, offline. Run: node tests/add-staff-label-line.test.cjs */
const fs = require('fs'), assert = require('assert');
let n = 0;
const ok = (cond, what) => { assert(cond, what); n++; console.log('  ok  ' + what); };
const src = fs.readFileSync(__dirname + '/../public/app/cap-employees.js', 'utf8');
const copy = fs.readFileSync(__dirname + '/../public/app/cap-employees-copy.js', 'utf8'); /* the watcher lives in the sibling (web split 1129) */
ok(/id="emp_l"[\s\S]{0,400}id="emp_lw" data-testid="emp-add-levelwhy"/.test(src), 'the Add form has one line under the picker for what the label can do');
ok(/Copy\.watchLevel\(\$\('emp_l'\), \$\('emp_lw'\), E\.choices\)/.test(src) && /select\.onchange = show;\s*show\(\);/.test(copy) && /pick\.why \|\| ''/.test(copy), 'it shows the picked label\'s server words, now and on every change');
ok(/hat: c\.hat \|\| HAT_OF\[c\.level\] \|\| 'act' \/\* a pinned seat \(Bookkeeper\) carries its own hat \*\/,\s*whole_entity: !!c\.whole_entity/.test(src), 'the create body carries the hat the label pins');
console.log(n + ' checks passed');
