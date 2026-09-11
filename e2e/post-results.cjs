/**
 * post-results.cjs — push a Playwright run onto the test board.
 *
 *   npx playwright test
 *   node post-results.cjs <token> [--kind t1] [--layer web] [--label "nightly"]
 *
 * ⭐⭐ THE POINT OF THIS FILE IS THAT IT IS SHORT. It reads `test-results/junit.xml`, which Playwright writes
 * because of one line in playwright.config.js, and posts it verbatim. There is no format of ours in between —
 * JUnit XML is the de-facto interchange, and the server parses it. If we ever move to Kiwi TCMS or TestRail, the
 * same file goes there instead and nothing has to be re-implemented.
 *
 * ⭐ WHY THE AUTOMATED RESULTS BELONG ON THE SAME BOARD AS THE MANUAL ONES. A case is often provable at two
 * levels — the offer arithmetic by a unit test AND by a person at the counter — and those are different evidence.
 * Kept apart on two boards, a green suite hides a red counter. Kept together, the case shows both.
 *
 * ⚠ A spec has to carry its case key in brackets: `test('[CTR-05] a single click chooses', …)`. Tests without one
 * are LISTED BACK, never silently dropped — a board that quietly ignores half a report is worse than no board.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const API = process.env.CB_API || 'https://chitbridge-api-production.up.railway.app';
const args = process.argv.slice(2);
const token = args.filter((a) => !a.startsWith('--'))[0];
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };

if (!token) {
  console.error('\n  node post-results.cjs <token> [--kind t1] [--layer web] [--label "nightly"]');
  console.error('  Token: open the app signed in, F12, then  JSON.parse(localStorage.cb_sess).token\n');
  process.exit(1);
}

const file = path.join(__dirname, flag('file', 'test-results/junit.xml'));
if (!fs.existsSync(file)) {
  console.error('\n  No report at ' + file);
  console.error('  Run the suite first:  npx playwright test\n');
  process.exit(1);
}

(async () => {
  const xml = fs.readFileSync(file, 'utf8');
  const r = await fetch(API + '/api/testing/results/junit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      xml,
      run_kind: flag('kind', 't1'),
      layer: flag('layer', 'web'),
      run_label: flag('label', 'playwright ' + new Date().toISOString().slice(0, 16).replace('T', ' ')),
      build: flag('build', null),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('  ' + r.status + ' ' + (j.message || j.error || '')); process.exit(1); }

  console.log('\n  recorded  ' + j.recorded + (j.skipped ? '   (' + j.skipped + ' already on this run)' : ''));
  if ((j.unmatched || []).length) {
    /* ⚠ SAID OUT LOUD, EVERY TIME. These are tests that ran and whose result is nowhere — the board is that much
       less complete than it looks, and the fix is a case key in the spec title. */
    console.log('\n  ' + j.unmatched.length + ' test(s) carry no case key, so their result is NOT on the board:');
    j.unmatched.slice(0, 12).forEach((n) => console.log('    · ' + n));
    if (j.unmatched.length > 12) console.log('    … and ' + (j.unmatched.length - 12) + ' more');
    console.log('  Add one to the title:  test(\'[CTR-05] a single click chooses\', …)');
  }
  console.log('\n  https://chitbridge-web.vercel.app/testing.html\n');
})().catch((e) => { console.error('  ' + e.message); process.exit(1); });
