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
const mine = files.filter((_, i) => i % of === shard - 1);
console.log('shard ' + shard + '/' + of + ' · ' + mine.length + ' of ' + files.length + ' files');
let failed = 0;
for (const f of mine) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(E2E, f)], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { NODE_PATH: path.join(E2E, 'node_modules') }),
  });
  const s = ((Date.now() - t0) / 1000).toFixed(0) + 's';
  const ok = r.status === 0 && !r.error;
  if (!ok) failed++;
  console.log((ok ? '  PASS ' : '  FAIL ') + f.padEnd(34) + s + (r.error ? '  (' + r.error.code + ')' : ''));
  if (!ok) console.log(((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-12).map((l) => '       ' + l).join('\n'));
}
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
