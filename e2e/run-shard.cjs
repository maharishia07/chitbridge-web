#!/usr/bin/env node
/**
 * e2e/run-shard.cjs — run ONE SHARD of the browser walks + screen harnesses (e2e/walk-*.cjs · e2e/till-*.cjs).
 *
 * ⭐ WHY (2026-10-11, the governance review): the walks ran on Athi's laptop — RAM pressure, Chrome hangs, the page server
 * killed for low memory mid-tour. They are fixture walks (the site served from this checkout, the API a stand-in inside the
 * page), so they need no database and no secret: GitHub's machines run them for free on this PUBLIC repo, on every PR.
 * The laptop keeps only the one walk being worked on.
 *
 *   node e2e/run-shard.cjs <shard> <of>      e.g. 1 6  → files 1, 7, 13 … of the sorted list
 *   node e2e/run-shard.cjs --list            print the whole list (what CI shares out)
 *   node e2e/run-shard.cjs --repeat <n>      run each file on the REPEAT list n times in a row (the walks.yml "steady" job)
 * One line per file (PASS/FAIL + seconds); a FAIL prints that file's FAIL lines, then its last lines; exit 1 if any failed.
 */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const E2E = __dirname;
const files = fs.readdirSync(E2E).filter((f) => /^(walk|till)-[a-z0-9-]+\.cjs$/.test(f)).sort();   /* SHELL-ONE: walk-shell-frame.cjs (every page wears the frame) runs with the walks; visual-tour.cjs is VTOUR's local-stack tour (its own workflow) */
if (process.argv[2] === '--list') { console.log(files.join('\n')); process.exit(0); }
/**
 * ⭐ REPEAT (K2b, 2026-10-14): a file that once flaked runs this many times INSIDE its shard, every run must pass — and
 * `--repeat <n>` runs the same list n times in its own job, so "fixed" is shown, never a re-run habit. Each entry: times · why.
 */
const REPEAT = {
  'till-scale.cjs': [3, 'K2b: seeded before the boot load() ended and read CART before the async add landed (TEST-LOG W2-1, web #160)'],
};
const REP_N = process.argv[2] === '--repeat' ? Number(process.argv[3]) : 0;
if (process.argv[2] === '--repeat' && !(REP_N >= 1)) { console.error('usage: run-shard.cjs --repeat <n>'); process.exit(2); }
const shard = REP_N ? 1 : Number(process.argv[2] || 1), of = REP_N ? 1 : Number(process.argv[3] || 1);
if (!(shard >= 1 && shard <= of)) { console.error('usage: run-shard.cjs <shard> <of>'); process.exit(2); }
/* ⭐ KNOWN RED (2026-10-12, first cloud run): each file here RUNS and is PRINTED, but does not fail the shard — with its reason.
 * SKIP = cannot run on a runner at all. A KNOWN file that passes says so: take it off the list. Fixing them = round W1
 * (C:/dev/toolset/briefs/W1-walks-green.md); TEST-LOG-2026-10-09.md rows W1-*. Never add a file here without a reason.
 * ⭐ Round W1 (2026-10-12) took 18 files off: 13 stale harnesses re-pointed at the current controls (e2e/lib/signin.cjs drives the
 * ONE sign-in window), 8 product fixes in till.html / signin-ui.js (see that PR). What is left is below, each with its row. */
const SKIP = {
  'till-books-offline.cjs': 'reads ../../chitbridge-engines — that repo is private, the runner cannot check it out',
  /* W1: a runner of runners — it spawns till-books-offline (SKIP above, so it can never go green here) and ~70 harnesses in one
     240 s slot (it needs ~25 min). Every harness on its list already runs on its own in this shard, so running it again proves
     nothing the shard does not. On a dev PC `node e2e/till-all.cjs` is still the one number. */
  'till-all.cjs': 'runs till-books-offline (SKIP) and ~70 harnesses in one slot — each member runs on its own in this shard',
  /* W1: it EDITS the chitbridge-api master till.html and re-vendors it over public/ (scripts/vendor-till.cjs) — on a runner the api
     checkout is read-only and the vendor step has no engines repo to copy from, so the breaks never reach the page. It only read
     "4/4 caught" in the first cloud run because till-two-sided itself was red. A dev PC with both repos runs it. */
  'till-two-sided-breaks.cjs': 'edits the api master and re-vendors — read-only api checkout on a runner (dev PC only)',
};
const KNOWN = {
  'walk-bill.cjs': 'BF1 open: the walk wants "Poori has no tax rate" on screen; M40 puts the names behind Fix › — Athi decides (TEST-LOG BF1)',
  'walk-home.cjs': 'UI9 round: L-Home-390 the kural band overlaps its own lines; L-CRM-957/1366/1568 the header-filter rail overlaps the column heads (UI9-crm itself is green since W1)',
};
/**
 * what a red file prints (F3b, 2026-10-13: shard 6 showed only the last 12 lines of walk-finance-cash — all PASS — and the one FAIL, C3, was above the
 * cut): first every line that says FAIL / ✗ / FAILED (up to 15, in order), then the last 12 lines, so the failing check is always in the CI log.
 */
function failLines(out) {
  const lines = out.trim().split('\n'), tail = lines.slice(-12);
  const red = lines.filter((l) => /\bFAIL(ED)?\b|✗/.test(l)).slice(0, 15);
  const pad = (ls) => ls.map((l) => '       ' + l).join('\n');
  return (red.length ? '       -- failing lines (' + red.length + ') --\n' + pad(red) + '\n       -- last lines --\n' : '') + pad(tail);
}
const mine = REP_N ? Object.keys(REPEAT).filter((f) => files.includes(f)) : files.filter((_, i) => i % of === shard - 1);
console.log(REP_N ? ('repeat ×' + REP_N + ' · ' + mine.join(' · '))
  : ('shard ' + shard + '/' + of + ' · ' + mine.length + ' of ' + files.length + ' files'));
let failed = 0, known = 0;
const runs = [];
for (const f of mine) for (let k = 1, n = REP_N || (REPEAT[f] ? REPEAT[f][0] : 1); k <= n; k++) runs.push([f, k, n]);
for (const [f, k, n] of runs) {
  if (SKIP[f]) { console.log('  SKIP ' + f.padEnd(34) + '   ' + SKIP[f]); continue; }
  if (k === 1 && n > 1) console.log('  ×' + n + '  ' + f + '   ' + (REPEAT[f] ? REPEAT[f][1] : 'repeat'));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(E2E, f)], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { NODE_PATH: path.join(E2E, 'node_modules') }),
  });
  const s = ((Date.now() - t0) / 1000).toFixed(0) + 's';
  /* SEC1: exit 78 = the harness SKIPPED itself (a missing secret, said in its output) — counted as SKIP, never PASS, never FAIL */
  if (r.status === 78) { console.log('  SKIP ' + f.padEnd(34) + '   skipped itself: ' + (String(r.stdout || '').split('\n').filter((l) => /SKIP|missing/.test(l)).slice(-1)[0] || '')); continue; }
  const ok = r.status === 0 && !r.error;
  if (KNOWN[f]) {
    known++;
    console.log((ok ? '  PASS ' : '  KNOWN') + ' ' + f.padEnd(33) + s + '   ' + (ok ? 'now passes — take it off KNOWN in run-shard.cjs' : KNOWN[f]));
    continue;
  }
  if (!ok) failed++;
  const name = n > 1 ? f + ' ' + k + '/' + n : f;
  console.log((ok ? '  PASS ' : '  FAIL ') + name.padEnd(34) + s + (r.error ? '  (' + r.error.code + ')' : ''));
  if (!ok) console.log(failLines((r.stdout || '') + (r.stderr || '')));
}
console.log((failed ? failed + ' failed' : 'all passed') + (known ? ' · ' + known + ' known red (listed above, round W1)' : ''));
process.exit(failed ? 1 : 0);
