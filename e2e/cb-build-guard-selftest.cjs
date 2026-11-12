'use strict';
/**
 * cb-build-guard-selftest.cjs — PROVES e2e/cb-build-guard.cjs BITES, on a scratch git repo (REL-24, 13 Nov).
 *
 * OWNS      four cases of the cache-buster rule, each built as real commits and judged by the real guard
 *           (CB_BUILD_GUARD_ROOT aims it at the scratch repo). CALLED BY .github/workflows/ci.yml (web job).
 * CARD      a guard that has only ever been green proves nothing (the guard's own header): here each case is
 *           red or green on purpose, including the one the commit-time tests wrongly passed.
 *
 *   1. a fresh cap change, no bump                         → RED
 *   2. a BACK-DATED cap commit, merged after main bumped   → RED   (the batch case: cut before, merged after)
 *   3. a cap change WITH a bump                            → GREEN
 *   4. no cap change                                       → GREEN
 *
 * Run: node e2e/cb-build-guard-selftest.cjs      exit 1 when a case does not come out as stated
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const GUARD = path.join(__dirname, 'cb-build-guard.cjs');
const D = (day) => '2026-11-' + day + 'T10:00:00';

function mk() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbg-'));
  const run = (args, date) => execFileSync('git', ['-C', dir].concat(args), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { GIT_AUTHOR_DATE: date || D('01'), GIT_COMMITTER_DATE: date || D('01'),
      GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }),
  }).trim();
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  const shell = (v) => 'const CB_BUILD =\n  \'' + v + '\'; /* stamp */\n';
  const commit = (msg, date) => { run(['add', '-A'], date); run(['commit', '-q', '-m', msg], date); };
  run(['init', '-q', '-b', 'main']);
  run(['config', 'core.autocrlf', 'false']);
  put('public/app.html', shell('A'));
  put('public/app/cap-x.js', '// x\n');
  put('README.md', 'r\n');
  commit('c0', D('01'));
  return { dir, run, put, shell, commit };
}

/** the guard's verdict in the scratch repo: exit code */
function verdict(dir) {
  const r = spawnSync(process.execPath, [GUARD], { encoding: 'utf8', env: Object.assign({}, process.env, { CB_BUILD_GUARD_ROOT: dir }) });
  return { code: r.status, out: r.stdout + r.stderr };
}

let bad = 0;
function expect(name, got, wantRed) {
  const ok = wantRed ? got.code === 1 : got.code === 0;
  console.log('  ' + (ok ? 'ok  ' : 'XX  ') + name + ' → exit ' + got.code + ' (wanted ' + (wantRed ? 'red' : 'green') + ')');
  if (!ok) { bad++; console.log(got.out.split('\n').map((l) => '      ' + l).join('\n')); }
}

function pointMainAt(s, ref) { s.run(['update-ref', 'refs/remotes/origin/main', ref]); }

{ // 1. fresh change, no bump
  const s = mk(); pointMainAt(s, 'HEAD');
  s.put('public/app/cap-x.js', '// x changed\n'); s.commit('cap change', D('05'));
  expect('1. a fresh cap-*.js change with no bump', verdict(s.dir), true);
}
{ // 2. back-dated commit, main bumped after the branch was cut, merged after
  const s = mk();
  s.run(['checkout', '-q', '-b', 'feature']);
  s.put('public/app/cap-x.js', '// x changed on a branch\n'); s.commit('cap change (old date)', D('02'));
  s.run(['checkout', '-q', 'main']);
  s.put('public/app.html', s.shell('B')); s.commit('main bumps', D('04'));
  pointMainAt(s, 'main');
  s.run(['checkout', '-q', 'feature']);
  s.run(['merge', '-q', '--no-ff', '-m', 'merge main', 'main'], D('06'));
  const v = verdict(s.dir);
  // red by the NEW test (ancestry), not the time tests, which pass here: that is the gap this closes
  if (v.out.indexOf('ok  CB_BUILD was bumped after the last capability change') < 0) { bad++; console.log('  XX  2. the time test was expected to pass here'); }
  expect('2. a back-dated cap commit merged after main bumped, no bump of its own', v, true);
}
{ // 3. change with a bump
  const s = mk(); pointMainAt(s, 'HEAD');
  s.put('public/app/cap-x.js', '// x changed\n'); s.put('public/app.html', s.shell('B')); s.commit('cap change + bump', D('05'));
  expect('3. a cap-*.js change with a bump', verdict(s.dir), false);
}
{ // 4. no cap change
  const s = mk(); pointMainAt(s, 'HEAD');
  s.put('README.md', 'changed\n'); s.commit('docs only', D('05'));
  expect('4. no cap-*.js change', verdict(s.dir), false);
}

console.log('\n  ' + (bad ? bad + ' case(s) wrong' : 'all 4 cases come out as stated'));
process.exit(bad ? 1 : 0);
