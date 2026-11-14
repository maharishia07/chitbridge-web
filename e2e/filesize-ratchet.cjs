#!/usr/bin/env node
/**
 * e2e/filesize-ratchet.cjs — THE FILE-SIZE RATCHET, BROKEN ONCE ON A FIXTURE (MNT-58, 2026-11-14). Offline: no browser, no server, no install.
 *
 * OWNS      the proof that tools/readability/filesize.cjs bites: a throw-away git repo (branch main, a 600-line baseline file in lib/), then
 *           · the untouched repo is green · a baseline file that GREW is red · a NEW file of 501 lines is red · a NEW file of 500 is green
 *           · a shrunk file is green and --write lowers its row · --write refuses to raise a row and to add a new 900-line file
 *           · a hand-added baseline row for that 900-line file is red against main (a PR cannot hide growth) · a hand-raised row is red
 *           · --rebaseline on a feature branch is refused, with the batch stamp env it resets the rows · --ceiling lists a customer file over 1,000
 *           · tests count; a copy (ADOPTED header), a fixtures/ file and the generated and vendored web paths do not
 * CALLED BY .github/workflows/ci.yml (web check job).
 * FLOW      build the fixture repo on main ──▶ branch ──▶ edit ──▶ run tools/readability/filesize.cjs --against main ──▶ assert exit code and words
 * CARD      qa/readability-guard
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'readability', 'filesize.cjs');
const { isExcluded } = require(TOOL);
const QUIET_ENV = ['CI', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF', 'FILESIZE_BASE', 'CB_FILESIZE_STAMP'];
let bad = 0;

function check(cond, what) {
  if (!cond) bad++;
  console.log((cond ? '  ok  ' : '  XX  ') + what);
}

function run(root, flags, extraEnv) {
  const env = Object.assign({}, process.env);
  QUIET_ENV.forEach((key) => delete env[key]);
  const out = spawnSync(process.execPath, [TOOL, '--root', root, '--against', 'main'].concat(flags || []), { encoding: 'utf8', env: Object.assign(env, extraEnv) });
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

function git(root, gitArgs) {
  return spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t'].concat(gitArgs), { encoding: 'utf8' });
}

function baselineText(root) {
  return fs.readFileSync(path.join(root, 'filesize.baseline.json'), 'utf8');
}

function buildFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filesize-'));
  git(root, ['init', '-q', '-b', 'main']);
  put(root, 'lib/big.js', lines(600));
  put(root, 'lib/small.js', lines(100));
  put(root, 'tests/fixtures/data.js', lines(900));
  put(root, 'lib/adopted.js', lines(900, '/* ADOPTED from chitbridge-engines v1.0.0 · lib/adopted.js · sha256 abc */'));
  put(root, 'tests/big.test.cjs', lines(550));
  put(root, 'filesize.baseline.json', '{\n  "files": {\n    "lib/big.js": 600,\n    "tests/big.test.cjs": 550\n  }\n}\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'base']);
  git(root, ['checkout', '-q', '-b', 'feature/x']);
  return root;
}

function showGrowth(root) {
  check(run(root).code === 0, 'the untouched repo is green (copy, fixtures/ not counted)');
  put(root, 'lib/big.js', lines(601));
  const grown = run(root);
  check(grown.code === 1 && /grew: lib\/big\.js 600 -> 601/.test(grown.text), 'a baseline file that grew by one line is RED');
  put(root, 'tests/big.test.cjs', lines(551));
  check(/grew: tests\/big\.test\.cjs 550 -> 551/.test(run(root).text), 'a test file that grew is RED too (tests are in scope)');
  put(root, 'tests/big.test.cjs', lines(550));
  put(root, 'lib/big.js', lines(590));
  check(run(root).code === 0, 'a baseline file that shrank is green');
  check(run(root, ['--write']).code === 0 && /"lib\/big\.js": 590/.test(baselineText(root)), '--write lowers the row to 590');
  put(root, 'lib/big.js', lines(595));
  const refused = run(root, ['--write']);
  check(refused.code === 1 && /REFUSED/.test(refused.text), '--write refuses to raise a row (590 -> 595)');
  put(root, 'lib/big.js', lines(590));
}

function showNewFile(root) {
  put(root, 'lib/fresh.js', lines(500));
  check(run(root).code === 0, 'a NEW file of exactly 500 lines is green');
  put(root, 'lib/fresh.js', lines(501));
  const tooBig = run(root);
  check(tooBig.code === 1 && /new file over 500: lib\/fresh\.js \(501/.test(tooBig.text), 'a NEW file of 501 lines is RED');
  fs.rmSync(path.join(root, 'lib/fresh.js'));
}

function showHiddenGrowth(root) {
  put(root, 'lib/new900.js', lines(900));
  const refused = run(root, ['--write']);
  check(refused.code === 1 && /REFUSED[^\n]*lib\/new900\.js/.test(refused.text), '--write refuses to ADD a row for a new 900-line file');
  const rows = JSON.parse(baselineText(root)).files;
  rows['lib/new900.js'] = 900;
  fs.writeFileSync(path.join(root, 'filesize.baseline.json'), JSON.stringify({ files: rows }, null, 2));
  const hidden = run(root);
  check(hidden.code === 1 && /baseline row added or raised: lib\/new900\.js/.test(hidden.text), 'the same row added by hand is RED against main (a PR cannot hide growth)');
  fs.rmSync(path.join(root, 'lib/new900.js'));
  fs.writeFileSync(path.join(root, 'filesize.baseline.json'), JSON.stringify({ files: { 'lib/big.js': 700, 'tests/big.test.cjs': 550 } }, null, 2));
  put(root, 'lib/big.js', lines(650));
  check(/baseline row added or raised: lib\/big\.js 600 -> 700/.test(run(root).text), 'a row raised by hand (600 -> 700) is RED against main');
}

function showRebaseline(root) {
  put(root, 'lib/big.js', lines(1200));
  const refused = run(root, ['--rebaseline']);
  check(refused.code === 1 && /REFUSED: --rebaseline runs only at a batch stamp/.test(refused.text), '--rebaseline on a feature branch is REFUSED');
  const stamped = run(root, ['--rebaseline'], { CB_FILESIZE_STAMP: '1' });
  check(stamped.code === 0 && /"lib\/big\.js": 1200/.test(baselineText(root)), '--rebaseline with the batch stamp resets the rows');
  check(run(root, [], { CB_FILESIZE_STAMP: '1' }).code === 0, 'and a stamp may raise rows against main');
  const ceiling = run(root, ['--ceiling']);
  check(ceiling.code === 1 && /lib\/big\.js \(1200\)/.test(ceiling.text), '--ceiling lists the customer-facing file over 1,000 and exits 1');
}

function showExclusions() {
  const skipped = ['public/app/screens.js', 'public/app/strings-hi.js', 'public/engine/tax.js', 'public/till.html', 'vendor/x.js', 'a/node_modules/b.js', 'public/x.min.js', 'tests/fixtures/y.js'];
  check(skipped.every(isExcluded) && !isExcluded('tests/x.test.cjs') && !isExcluded('public/app/cart.js'), 'generated, copied, vendored, minified and fixture paths are not counted; tests and app files are');
}

console.log('\nfile-size ratchet · every rule broken once on a fixture (MNT-58)');
const fixture = buildFixture();
showGrowth(fixture);
showNewFile(fixture);
showHiddenGrowth(fixture);
showRebaseline(fixture);
showExclusions();
fs.rmSync(fixture, { recursive: true, force: true });
console.log(bad ? '\n' + bad + ' FAILED' : '\nall ok');
process.exit(bad ? 1 : 0);
