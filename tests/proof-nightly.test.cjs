/* OWNS: QA-143, the nightly proof run (Athi 11 Nov): proof.yml runs once a night on main, and a scheduled run (which has no inputs)
   still names a web ref, an api ref, the packs and the widths through its `||` fallback. CALLED BY: ci.yml (static checks). */
'use strict';
const fs = require('fs'), path = require('path');
const y = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'proof.yml'), 'utf8');
let fails = 0;
const check = (name, ok) => { console.log((ok ? '  ok   ' : '  FAIL ') + name); if (!ok) fails++; };
check('a nightly schedule exists (30 16 * * * = 22:00 IST)', /schedule:\s*\n\s*- cron: "30 16 \* \* \*"/.test(y));
check('it can still be run by hand', /workflow_dispatch:/.test(y));
for (const k of ['web_ref', 'api_ref', 'packs', 'widths'])
  check('every use of inputs.' + k + ' has a fallback', !new RegExp('inputs\.' + k + ' \}\}').test(y));
check('the nightly packs are a11y and keyboard', /inputs\.packs \|\| 'a11y,keyboard'/.test(y));
check('the runner image is pinned (ubuntu-24.04)', /runs-on: ubuntu-24.04/.test(y));
check('the browser install retries (3 tries)', /for try in 1 2 3/.test(y));
check('the browser is cached', /ms-playwright/.test(y));
check('no secret is read (localhost stack only)', !/secrets\./.test(y));
if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('proof-nightly: ok');
