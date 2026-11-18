/**
 * guard-walk-today.cjs — a walk never reads the runner's clock for a business date (round QW1-TODAY, 2026-10-14).
 *
 * Every walk runs on ONE injected "today" (CB_TODAY, e2e/lib/today.cjs). A zero-argument `new Date()` or a `Date.now()` in
 * e2e/walk-*.cjs or the stand-ins under them (e2e/lib/*.cjs) reads the runner's UTC day — the 12 Oct failure. Use TD.TODAY · TD.now() ·
 * TD.nowIso() · TD.nowMs() · TD.dayPlus(n). A line that truly needs the real clock (a unique suffix, a wait timer) says
 * `clock-ok: <why>` in a comment on the same line. today.cjs itself is the one place that reads it.
 */
'use strict';
const fs = require('fs'), path = require('path');
const files = fs.readdirSync(__dirname).filter((f) => /^walk-.*\.cjs$/.test(f)).map((f) => path.join(__dirname, f))
  .concat(fs.readdirSync(path.join(__dirname, 'lib')).filter((f) => f.endsWith('.cjs') && f !== 'today.cjs').map((f) => path.join(__dirname, 'lib', f)));
const bad = [];
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (/new Date\(\s*\)|Date\.now\(\s*\)/.test(l) && !/clock-ok/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) bad.push(path.relative(path.join(__dirname, '..'), f) + ':' + (i + 1) + '  ' + l.trim().slice(0, 110));
  });
}
if (bad.length) { console.log('guard-walk-today: ' + bad.length + ' raw clock read(s) in a walk — use e2e/lib/today.cjs (or add `clock-ok: why`):\n' + bad.join('\n')); process.exit(1); }
console.log('guard-walk-today: ' + files.length + ' walk files, no raw clock read for a business date');

/* tzsweep (18 Nov 2026): the walks above are covered by the raw-clock rule; the OTHER e2e scripts (e2e/*.cjs, e2e/lib, e2e/flows) must not cut the runner's UTC day
 * out of a clock read either: `new Date().toISOString().slice(0, 10)` is the UTC day, a day BEHIND the shop's from 18:30 to 24:00 UTC (Asia/Kolkata). Use
 * TD.TODAY / TD.todayIn(zone) / TD.dayPlus (e2e/lib/today.cjs). A line that is UTC on purpose says `utc-ok: <why>`. */
const UTC_DAY = /(new Date\(\s*\)|new Date\(\s*Date\.now\(\)[^)]*\)|Date\.now\(\))[^;]*\.toISOString\(\)\s*\.(slice|substr|substring|split)\(\s*(0\s*,\s*(10|7)|'T')/;
const others = fs.readdirSync(__dirname).filter((f) => /\.cjs$/.test(f) && !/^walk-/.test(f)).map((f) => path.join(__dirname, f))
  .concat(fs.readdirSync(path.join(__dirname, 'lib')).filter((f) => /\.cjs$/.test(f) && f !== 'today.cjs').map((f) => path.join(__dirname, 'lib', f)))
  .concat(fs.existsSync(path.join(__dirname, 'flows')) ? fs.readdirSync(path.join(__dirname, 'flows')).filter((f) => /\.(c?js)$/.test(f)).map((f) => path.join(__dirname, 'flows', f)) : []);
const utcBad = [];
for (const f of others) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (UTC_DAY.test(l) && !/utc-ok|clock-ok/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) utcBad.push(path.relative(path.join(__dirname, '..'), f) + ':' + (i + 1) + '  ' + l.trim().slice(0, 110));
  });
}
if (utcBad.length) { console.log('guard-walk-today: ' + utcBad.length + ' UTC day(s) cut from a clock read in an e2e script — use e2e/lib/today.cjs (or add `utc-ok: why`):\n' + utcBad.join('\n')); process.exit(1); }
console.log('guard-walk-today: ' + others.length + ' other e2e files, no UTC day cut from a clock read');
