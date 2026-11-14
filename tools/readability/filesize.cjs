#!/usr/bin/env node
/* tools/readability/filesize.cjs — THE FILE-SIZE RATCHET for web, api and engines (MNT-58, 2026-11-14).
 *
 * OWNS      the line count of every tracked code file and <repo>/filesize.baseline.json: no file grows past its baseline row, a file with no
 *           row (NEW, or one that never passed 500) is at most 500 lines, a row only falls. The 1,000-line ceiling is enforced on the customer-facing
 *           list (the baseline's "customer" array, from PM/LEAN-PLAN.md §9): reported by --ceiling, reached file by file by MNT-59.
 * CALLED BY by hand and CI: web e2e/filesize-ratchet.cjs (the fixtures) and ci.yml; the api's tests/filesize-ratchet.test.cjs and the engines
 *           test.yml run THIS file from the web checkout beside them (one scanner, no copy per repo; engines has no tools/readability).
 * FLOW      git ls-files -co ──▶ drop the excluded ──▶ count lines ──▶ compare with the baseline ──▶ list the grown / the new-over-500 ──▶ exit 1
 * CARD      qa/readability-guard
 *
 *   node tools/readability/filesize.cjs [--repo web|api|engines] [--root DIR]   check (exit 1 on a grown file or a new file over 500)
 *   node tools/readability/filesize.cjs ... --write         lower rows to today's size, drop rows now at or under 500; refuses to raise one
 *   node tools/readability/filesize.cjs ... --rebaseline    set every row to today's size: ONLY at a batch stamp, after the batch merged
 *   node tools/readability/filesize.cjs ... --ceiling       the customer-facing files still over 1,000 (exit 1 while any is)
 *
 * EXCLUDED, each judged where it is made, not where it is copied:
 *   generated  web public/app/screens.js, assets.js, strings-*.js — judged at the generator in the docs repo
 *   copies     web public/engine/* (master: chitbridge-engines src/) · web public/till.html (master: api tools/tally-connector/till.html)
 *              · any file whose line 1 is the ADOPTED header (an engines copy; master: chitbridge-engines), the same rule as the api's fn-size
 *   vendor     vendor/ and node_modules/ · *.min.* · fixtures (a fixtures/ or fixture/ folder)
 * Counted: .js .cjs .mjs .html .css (data and docs are not code).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASELINE_FILE = 'filesize.baseline.json';
const NEW_FILE_MAX = 500;
const CEILING = 1000;
const COUNTED = /\.(c?js|mjs|html|css)$/;
const ADOPTED = /^\/\* ADOPTED from chitbridge-engines v\S+ · /;
const EXCLUDED = [
  /(^|\/)(node_modules|vendor|fixtures?)\//,
  /\.min\.[a-z]+$/,
  /^public\/app\/(screens|assets)\.js$/,
  /^public\/app\/strings-[^/]*\.js$/,
  /^public\/engine\//,
  /^public\/till\.html$/
];

/** is this tracked path one of the excluded kinds (generated, copy, vendor, fixture)? */
function isExcluded(rel) {
  return !COUNTED.test(rel) || EXCLUDED.some((pattern) => pattern.test(rel));
}

/** the number of lines in a text: a final line without a newline still counts */
function countLines(text) {
  if (!text) return 0;
  const breaks = text.split('\n').length - 1;
  return text.endsWith('\n') ? breaks : breaks + 1;
}

/** the tracked and new (not ignored) files under root, as forward-slash paths */
function listFiles(root) {
  const out = spawnSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (out.status !== 0) throw new Error('git ls-files failed in ' + root + ': ' + out.stderr);
  return out.stdout.split(/\r?\n/).filter(Boolean);
}

/** today's size of every counted file over 0 lines, by path (adopted engine copies skipped) */
function measure(root) {
  const sizes = {};
  for (const rel of listFiles(root)) {
    if (isExcluded(rel) || !fs.existsSync(path.join(root, rel))) continue;
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    if (ADOPTED.test(text.split('\n', 1)[0])) continue;
    sizes[rel] = countLines(text);
  }
  return sizes;
}

function readBaseline(root) {
  const file = path.join(root, BASELINE_FILE);
  if (!fs.existsSync(file)) return { customer: [], files: {} };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { customer: data.customer || [], files: data.files || {} };
}

/** one entry per line, sorted: a merge by union and a diff that shows each file's row */
function writeBaseline(root, baseline) {
  const keys = Object.keys(baseline.files).sort();
  const rows = keys.map((key) => '    ' + JSON.stringify(key) + ': ' + baseline.files[key]);
  const customer = baseline.customer.slice().sort().map((key) => '    ' + JSON.stringify(key));
  const about = 'MNT-58 file-size ratchet: a file may be smaller than its row, never larger; a file with no row is at most 500 lines. '
    + 'Rows fall with --write; they are reset only at a batch stamp (--rebaseline). "customer" = PM/LEAN-PLAN.md section 9, ceiling 1,000 (--ceiling). Tool: web tools/readability/filesize.cjs';
  const text = '{\n  "_about": ' + JSON.stringify(about) + ',\n  "customer": [\n' + customer.join(',\n') + '\n  ],\n  "files": {\n' + rows.join(',\n') + '\n  }\n}\n';
  fs.writeFileSync(path.join(root, BASELINE_FILE), text);
}

/** the red findings: files that grew past their row, and files with no row over 500 */
function judge(sizes, baseline) {
  const grown = [];
  const tooBig = [];
  for (const [rel, lines] of Object.entries(sizes)) {
    const held = baseline.files[rel];
    if (held === undefined && lines > NEW_FILE_MAX) tooBig.push({ rel, lines });
    if (held !== undefined && lines > held) grown.push({ rel, lines, held });
  }
  return { grown, tooBig };
}

/** the baseline rows for today: every file over 500, at the lower of its row and its size (or at its size when forced) */
function nextRows(sizes, baseline, force) {
  const files = {};
  const raised = [];
  for (const [rel, lines] of Object.entries(sizes)) {
    if (lines <= NEW_FILE_MAX) continue;
    const held = baseline.files[rel];
    if (force || held === undefined || !Object.keys(baseline.files).length) files[rel] = lines;
    else if (lines > held) raised.push(rel);
    else files[rel] = lines;
  }
  return { files, raised };
}

/** the customer-facing files still over the ceiling, by today's size */
function overCeiling(sizes, baseline) {
  return baseline.customer.filter((rel) => (sizes[rel] || 0) > CEILING).map((rel) => ({ rel, lines: sizes[rel] }));
}

function argValue(args, flag) {
  const at = args.indexOf(flag);
  return at === -1 ? null : args[at + 1];
}

/** the repo root: --root wins; else the checkout this tool sits in */
function rootOf(args) {
  return path.resolve(argValue(args, '--root') || path.join(__dirname, '..', '..'));
}

function runWrite(root, sizes, baseline, force) {
  const next = nextRows(sizes, baseline, force || !Object.keys(baseline.files).length);
  if (next.raised.length) {
    console.log('REFUSED: --write never raises a row (these grew): ' + next.raised.join(', '));
    return 1;
  }
  writeBaseline(root, { customer: baseline.customer, files: next.files });
  console.log('filesize baseline written: ' + Object.keys(next.files).length + ' files over ' + NEW_FILE_MAX + ' lines');
  return 0;
}

function runCeiling(sizes, baseline) {
  const over = overCeiling(sizes, baseline);
  over.forEach((row) => console.log('  over ' + CEILING + ': ' + row.rel + ' (' + row.lines + ')'));
  console.log('customer-facing files over ' + CEILING + ': ' + over.length + ' of ' + baseline.customer.length + ' listed');
  return over.length ? 1 : 0;
}

function runCheck(sizes, baseline) {
  const verdict = judge(sizes, baseline);
  verdict.grown.forEach((row) => console.log('  FAIL grew: ' + row.rel + ' ' + row.held + ' -> ' + row.lines + ' (a file may not grow past its baseline)'));
  verdict.tooBig.forEach((row) => console.log('  FAIL new file over ' + NEW_FILE_MAX + ': ' + row.rel + ' (' + row.lines + ' lines; split it, or make room by shrinking)'));
  const held = Object.keys(baseline.files).length;
  const customerOver = overCeiling(sizes, baseline).length;
  const red = verdict.grown.length + verdict.tooBig.length;
  console.log('filesize ratchet: ' + (red ? red + ' red' : 'green') + ' · ' + held + ' files held over ' + NEW_FILE_MAX + ' · customer-facing over ' + CEILING + ': ' + customerOver + ' of ' + baseline.customer.length);
  return red ? 1 : 0;
}

function main(args) {
  const root = rootOf(args);
  const sizes = measure(root);
  const baseline = readBaseline(root);
  if (args.includes('--write') || args.includes('--rebaseline')) return runWrite(root, sizes, baseline, args.includes('--rebaseline'));
  if (args.includes('--ceiling')) return runCeiling(sizes, baseline);
  return runCheck(sizes, baseline);
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { measure, judge, countLines, isExcluded, NEW_FILE_MAX, CEILING };
