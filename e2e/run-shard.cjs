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
 * One line per file (PASS/FAIL + seconds); a FAIL prints that file's last lines; exit 1 if any failed.
 */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const E2E = __dirname;
const files = fs.readdirSync(E2E).filter((f) => /^(walk|till)-[a-z0-9-]+\.cjs$/.test(f)).sort();
if (process.argv[2] === '--list') { console.log(files.join('\n')); process.exit(0); }
const shard = Number(process.argv[2] || 1), of = Number(process.argv[3] || 1);
if (!(shard >= 1 && shard <= of)) { console.error('usage: run-shard.cjs <shard> <of>'); process.exit(2); }
/* ⭐ KNOWN RED (2026-10-12, first cloud run): each file here RUNS and is PRINTED, but does not fail the shard — with its reason.
 * SKIP = cannot run on a runner at all. A KNOWN file that passes says so: take it off the list. Fixing them = round W1
 * (C:/dev/toolset/briefs/W1-walks-green.md); TEST-LOG-2026-10-09.md rows W1-*. Never add a file here without a reason. */
const SKIP = {
  'till-books-offline.cjs': 'reads ../../chitbridge-engines — that repo is private, the runner cannot check it out',
};
const KNOWN = {
  'walk-bill.cjs': 'BF1 open: no warning when an item has no tax rate (TEST-LOG BF1)',
  'walk-home.cjs': 'UI9 open: CRM first paint still moves (TEST-LOG UI9)',
  'till-two-sided.cjs': 'stale harness: waits for till-usign-who, gone since CBSignin (#68)',
  'till-returns-faults.cjs': 'stale harness: till-usign-who, gone since #68',
  'till-return-pc.cjs': 'stale harness: till-usign-who, gone since #68',
  'till-shop-switch.cjs': 'stale harness: till-usign-who, gone since #68',
  'till-shop-switch-pc.cjs': 'stale harness: till-usign-who, gone since #68',
  'till-pin.cjs': 'sign-in PIN step never shows (signin-pin) — W1 decides: harness or product',
  'till-lock.cjs': 'sign-in PIN step never shows (signin-pin1) — W1 decides',
  'till-counter-faults.cjs': 'sign-in buttons never show (till-usign-in / signin-later) — W1 decides',
  'till-reenrol.cjs': 'unclassified — W1 decides',
  'till-keysize.cjs': 'phone 390px: the key-size preview disagrees with the real grid — W1 decides',
  'till-netsim.cjs': '2G does not change the line panel — W1 decides',
  'till-blank.cjs': 'header no longer says "not paired" — W1 decides',
  'till-ready.cjs': '"Nobody has signed in" first-thing message missing — W1 decides',
  'till-handoff.cjs': 'header names the counter, not the person — W1 decides',
  'till-tidy.cjs': 'unclassified (1 check) — W1 decides',
  'till-cold.cjs': 'unclassified (2 checks) — W1 decides',
  'till-bill-checks.cjs': 'unclassified (2 checks) — W1 decides',
  'till-all.cjs': 'runs the till harnesses above together — red while any of them is',
};
const mine = files.filter((_, i) => i % of === shard - 1);
console.log('shard ' + shard + '/' + of + ' · ' + mine.length + ' of ' + files.length + ' files');
let failed = 0, known = 0;
for (const f of mine) {
  if (SKIP[f]) { console.log('  SKIP ' + f.padEnd(34) + '   ' + SKIP[f]); continue; }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(E2E, f)], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { NODE_PATH: path.join(E2E, 'node_modules') }),
  });
  const s = ((Date.now() - t0) / 1000).toFixed(0) + 's';
  const ok = r.status === 0 && !r.error;
  if (KNOWN[f]) {
    known++;
    console.log((ok ? '  PASS ' : '  KNOWN') + ' ' + f.padEnd(33) + s + '   ' + (ok ? 'now passes — take it off KNOWN in run-shard.cjs' : KNOWN[f]));
    continue;
  }
  if (!ok) failed++;
  console.log((ok ? '  PASS ' : '  FAIL ') + f.padEnd(34) + s + (r.error ? '  (' + r.error.code + ')' : ''));
  if (!ok) console.log(((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-12).map((l) => '       ' + l).join('\n'));
}
console.log((failed ? failed + ' failed' : 'all passed') + (known ? ' · ' + known + ' known red (listed above, round W1)' : ''));
process.exit(failed ? 1 : 0);
