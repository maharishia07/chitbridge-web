#!/usr/bin/env node
/**
 * e2e/filesize-ratchet.cjs — THE FILE-SIZE RATCHET, BROKEN ONCE ON A FIXTURE (MNT-58, 2026-11-14). Offline: no browser, no server, no install.
 *
 * OWNS      the proof that tools/readability/filesize.cjs bites: a throw-away git repo with a 600-line baseline file, then
 *           · the untouched repo is green · a baseline file that GREW is red · a NEW file of 501 lines is red · a NEW file of 500 is green
 *           · a baseline file that shrank is green and --write lowers its row · --write refuses to raise a row · --rebaseline resets it
 *           · a generated file, a copy under public/engine, a fixtures/ file and an ADOPTED engine copy are not counted
 *           · --ceiling lists a customer-facing file still over 1,000 and exits 1
 * CALLED BY .github/workflows/ci.yml (web check job).
 * FLOW      build the fixture repo ──▶ write the baseline ──▶ edit ──▶ run tools/readability/filesize.cjs ──▶ assert the exit code and the words
 * CARD      qa/readability-guard
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'readability', 'filesize.cjs');
let bad = 0;

function check(cond, what) {
  if (!cond) bad++;
  console.log((cond ? '  ok  ' : '  XX  ') + what);
}

function run(root, flags) {
  const out = spawnSync(process.execPath, [TOOL, '--root', root].concat(flags || []), { encoding: 'utf8' });
  return { code: out.status, text: out.stdout + out.stderr };
}

function lines(count, first) {
  const body = [];
  for (let at = 0; at < count; at++) body.push(at === 0 && first ? first : '// line ' + at);
  return body.join('\n') + '\n';
}

function put(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
}

function buildFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filesize-'));
  spawnSync('git', ['-C', root, 'init', '-q']);
  put(root, 'public/app/big.js', lines(600));
  put(root, 'public/app/small.js', lines(100));
  put(root, 'public/app/screens.js', lines(900));
  put(root, 'public/engine/copy.js', lines(900));
  put(root, 'tests/fixtures/data.js', lines(900));
  put(root, 'lib/adopted.js', lines(900, '/* ADOPTED from chitbridge-engines v1.0.0 · lib/adopted.js · sha256 abc */'));
  put(root, 'filesize.baseline.json', JSON.stringify({ customer: ['public/app/big.js'], files: { 'public/app/big.js': 600 } }));
  return root;
}

function showBites(root) {
  check(run(root).code === 0, 'the untouched repo is green (generated, copy, fixtures and ADOPTED files are not counted)');
  put(root, 'public/app/big.js', lines(601));
  const grown = run(root);
  check(grown.code === 1 && /grew: public\/app\/big\.js 600 -> 601/.test(grown.text), 'a baseline file that grew by one line is RED');
  put(root, 'public/app/big.js', lines(590));
  check(run(root).code === 0, 'a baseline file that shrank is green');
  const written = run(root, ['--write']);
  check(written.code === 0 && /"public\/app\/big\.js": 590/.test(fs.readFileSync(path.join(root, 'filesize.baseline.json'), 'utf8')), '--write lowers the row to 590');
  put(root, 'public/app/big.js', lines(595));
  const refused = run(root, ['--write']);
  check(refused.code === 1 && /REFUSED/.test(refused.text), '--write refuses to raise a row (590 -> 595)');
  check(run(root, ['--rebaseline']).code === 0 && run(root).code === 0, '--rebaseline (the batch stamp) resets the row, then green');
}

function showNewFile(root) {
  put(root, 'public/app/fresh.js', lines(500));
  check(run(root).code === 0, 'a NEW file of exactly 500 lines is green');
  put(root, 'public/app/fresh.js', lines(501));
  const tooBig = run(root);
  check(tooBig.code === 1 && /new file over 500: public\/app\/fresh\.js \(501/.test(tooBig.text), 'a NEW file of 501 lines is RED');
  fs.rmSync(path.join(root, 'public/app/fresh.js'));
}

function showCeiling(root) {
  put(root, 'public/app/big.js', lines(1200));
  run(root, ['--rebaseline']);
  const ceiling = run(root, ['--ceiling']);
  check(ceiling.code === 1 && /public\/app\/big\.js \(1200\)/.test(ceiling.text), '--ceiling lists the customer-facing file over 1,000 and exits 1');
  put(root, 'public/app/big.js', lines(900));
  check(run(root, ['--ceiling']).code === 0, '--ceiling is green once the file is under 1,000');
}

console.log('\nfile-size ratchet · every rule broken once on a fixture (MNT-58)');
const fixture = buildFixture();
showBites(fixture);
showNewFile(fixture);
showCeiling(fixture);
fs.rmSync(fixture, { recursive: true, force: true });
console.log(bad ? '\n' + bad + ' FAILED' : '\nall ok');
process.exit(bad ? 1 : 0);
