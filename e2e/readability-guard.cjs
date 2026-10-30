#!/usr/bin/env node
/**
 * e2e/readability-guard.cjs — EVERY §6 RULE, BROKEN ONCE ON A FIXTURE (READ-GUARD, 2026-10-15). Offline: no browser, no server, no install.
 *
 * tools/readability.cjs --changed judges only what a change touched. This builds a throw-away git repo (a base commit, then the
 * head edits), writes the ratchet from the base, and asserts what the guard says about each edit:
 *   · ct → counter passes · `const q =` fails · a NEW 90-line function fails · a legacy long function touched but not grown WARNS ·
 *     a legacy long function that grew FAILS · a function that CROSSED 80 lines fails · complexity > 15 fails · nesting > 4 fails ·
 *     a new empty catch (both forms) fails · a module with no header fails · a header with no CARD line fails ·
 *     a module with no test row in trace.json fails · missing §7 minimums WARN before 2026-10-22 and FAIL after ·
 *     a file whose score rose above its ratchet row fails · --write lowers a row and refuses to raise one · a docs-only change judges nothing
 *   · tools/graph/trace.cjs on the KG1 fixture gives the fixture's api route module a row with its test and its route
 *
 * Run: node e2e/readability-guard.cjs        (CI: web check job)
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOOL = path.join(ROOT, 'tools/readability.cjs');
const TRACE_TOOL = path.join(ROOT, 'tools/graph/trace.cjs');
const GRAPH_TOOL = path.join(ROOT, 'tools/graph/graph.cjs');
const KG_FIXTURE = path.join(ROOT, 'tools/graph/fixture');
const MINIMUMS_FAIL_FROM = require(path.join(ROOT, 'tools/readability/guard.cjs')).MINIMUMS_FAIL_FROM;

let bad = 0;
const ok = (cond, what) => { if (cond) console.log('  ✓ ' + what); else { bad++; console.log('  ✗ ' + what); } };
const run = (args, cwd) => spawnSync(process.execPath, args, { encoding: 'utf8', cwd: cwd || ROOT, maxBuffer: 64 << 20 });
const git = (cwd, args) => { const r = spawnSync('git', ['-C', cwd].concat(args), { encoding: 'utf8' }); if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + r.stderr); return r.stdout.trim(); };

/* ── the fixture texts ─────────────────────────────────────────────────────────────────────────────────────────── */
const HEADER = (name) => `/* public/app/${name}.js — a fixture module.\n * OWNS the ${name} numbers. CALLED BY the test. FLOW read → paint. CARD qa/fixture-${name}\n */\n`;
const NO_CARD_HEADER = '/* a fixture module. OWNS nothing much. CALLED BY the test. FLOW read → paint. */\n';
/** a function of exactly `lines` lines (header line + body + closing brace), complexity 1 */
function longFunction(name, lines) {
  const body = []; for (let i = 0; i < lines - 2; i++) body.push('  total += ' + (i + 1) + ';');
  return `// ${name}: adds up a fixed list (fixture)\nfunction ${name}(total) {\n${body.join('\n')}\n  return total;\n}\n`;
}
function complexFunction(name, branches) {
  const body = []; for (let i = 0; i < branches; i++) body.push(`  if (value === ${i + 11}) total += 1;`);
  return `// ${name}: one branch per value (fixture)\nfunction ${name}(value, total) {\n${body.join('\n')}\n  return total;\n}\n`;
}
const NESTED = `// deepOne: five levels of nesting (fixture)\nfunction deepOne(rows) {\n  let total = 0;\n  for (const row of rows) {\n    if (row) {\n      for (const cell of row) {\n        if (cell) {\n          while (total < 100) { total += cell; }\n        }\n      }\n    }\n  }\n  return total;\n}\n`;

const BASE = {
  'public/app/rename.js': HEADER('rename') + 'function paintTotals(rows) {\n  var ct = rows.length;\n  return ct;\n}\n',
  'public/app/cryptic.js': HEADER('cryptic') + 'function countRows(rows) {\n  return rows.length;\n}\n',
  'public/app/long.js': HEADER('long') + longFunction('legacyStays', 85) + longFunction('legacyGrows', 85) + longFunction('crossesLimit', 79) + 'function shortOne(total) {\n  return total + 1;\n}\n',
  'public/app/complex.js': HEADER('complex') + 'function plainOne(total) {\n  return total;\n}\n',
  'public/app/nested.js': HEADER('nested') + 'function flatOne(total) {\n  return total;\n}\n',
  'public/app/catch.js': HEADER('catch') + 'function readSafely(reader) {\n  return reader();\n}\n',
  'public/app/header.js': HEADER('header') + 'function paintHeader(rows) {\n  return rows.length;\n}\n',
  'public/app/nocard.js': HEADER('nocard') + 'function paintNoCard(rows) {\n  return rows.length;\n}\n',
  'public/app/untouched.js': HEADER('untouched') + 'function neverTouched(rows) {\n  var q = rows.length;\n  return q;\n}\n',
  'public/app/notest.js': HEADER('notest') + 'function paintNoTest(rows) {\n  return rows.length;\n}\n',
  'public/app/minimums.js': HEADER('minimums') + 'function paintMinimums(rows) {\n  return rows.length;\n}\n',
  'public/app/worse.js': HEADER('worse') + 'function paintWorse(rows) {\n  return rows.length;\n}\n',
  'public/app/better.js': HEADER('better') + longFunction('getsShorter', 45),
  'docs/notes.md': '# notes\n'
};
const HEAD = {
  'public/app/rename.js': HEADER('rename') + 'function paintTotals(rows) {\n  var counter = rows.length;\n  return counter;\n}\n',
  'public/app/cryptic.js': HEADER('cryptic') + 'function countRows(rows) {\n  const q = rows.length;\n  return q;\n}\n',
  'public/app/long.js': HEADER('long') + longFunction('legacyStays', 85).replace('total += 3;', 'total += 30;') + longFunction('legacyGrows', 86) + longFunction('crossesLimit', 81) + longFunction('freshLong', 90) + 'function shortOne(total) {\n  return total + 1;\n}\n',
  'public/app/complex.js': HEADER('complex') + 'function plainOne(total) {\n  return total;\n}\n' + complexFunction('branchy', 16),
  'public/app/nested.js': HEADER('nested') + 'function flatOne(total) {\n  return total;\n}\n' + NESTED,
  'public/app/catch.js': HEADER('catch') + 'function readSafely(reader) {\n  try { return reader(); } catch (_) {}\n}\nfunction readLater(promise) {\n  return promise.catch(function () {});\n}\n',
  'public/app/header.js': 'function paintHeader(rows) {\n  return rows.length + 1;\n}\n',
  'public/app/nocard.js': NO_CARD_HEADER + 'function paintNoCard(rows) {\n  return rows.length + 1;\n}\n',
  'public/app/untouched.js': BASE['public/app/untouched.js'],
  'public/app/notest.js': HEADER('notest') + 'function paintNoTest(rows) {\n  return rows.length + 1;\n}\n',
  'public/app/minimums.js': HEADER('minimums') + 'function paintMinimums(rows) {\n  return rows.length + 1;\n}\n',
  'public/app/worse.js': HEADER('worse') + 'function paintWorse(rows) {\n  return rows.length;\n}\n' + longFunction('nowLong', 45),
  'public/app/better.js': HEADER('better') + longFunction('getsShorter', 20),
  'docs/notes.md': '# notes\n\nmore words\n'
};
const TRACE = { generated: '2026-10-15', repo: 'web', modules: {} };
for (const file of Object.keys(BASE)) if (/^public\//.test(file)) TRACE.modules[file] = { card: 'qa/fixture', layer: 'ui', tests: [{ file: 'e2e/fixture.cjs', via: ['reads'], steps: [] }], walks: [], minimums: { layer: 'ui', have: ['walk'], missing: [] } };
TRACE.modules['public/app/notest.js'].tests = [];
TRACE.modules['public/app/minimums.js'].minimums = { layer: 'ui', have: ['walk'], missing: ['aa-contrast', 'cream-and-dark-1366-390'] };

/* ── build the throw-away repo ─────────────────────────────────────────────────────────────────────────────────── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-readability-'));
const writeAll = (files) => { for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.join(tmp, path.dirname(file)), { recursive: true }); fs.writeFileSync(path.join(tmp, file), text); } };
writeAll(BASE);
git(tmp, ['init', '-q']); git(tmp, ['config', 'user.email', 'fixture@example']); git(tmp, ['config', 'user.name', 'fixture']);
git(tmp, ['add', '-A']); git(tmp, ['commit', '-q', '-m', 'base']);
const baseSha = git(tmp, ['rev-parse', 'HEAD']);

console.log('\n1 · the ratchet is written from the base (lower only)');
const wrote = run([TOOL, '--repo', 'web', '--root', tmp, '--write']);
ok(wrote.status === 0 && fs.existsSync(path.join(tmp, 'readability.ratchet.json')), 'readability --write writes readability.ratchet.json' + (wrote.status ? '\n' + wrote.stdout + wrote.stderr : ''));
const ratchet0 = JSON.parse(fs.readFileSync(path.join(tmp, 'readability.ratchet.json'), 'utf8'));
ok(ratchet0['public/app/worse.js'] && ratchet0['public/app/worse.js'].score === 0, 'worse.js starts at score 0 (' + JSON.stringify(ratchet0['public/app/worse.js']) + ')');
ok(ratchet0['public/app/better.js'] && ratchet0['public/app/better.js'].long40 === 1, 'better.js starts with one function over 40 lines');
ok(!ratchet0['docs/notes.md'], 'a doc has no ratchet row');

/* the engines repo has no tool of its own: --repo engines writes its ratchet from here (src/ and tools/ are its own code) */
const engTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-readability-eng-'));
fs.mkdirSync(path.join(engTmp, 'src'));
fs.writeFileSync(path.join(engTmp, 'src/rule.js'), '// OWNS  a fixture rule.\nmodule.exports = (a) => a;\n');
const wroteEng = run([TOOL, '--repo', 'engines', '--root', engTmp, '--write']);
const engRows = fs.existsSync(path.join(engTmp, 'readability.ratchet.json')) ? JSON.parse(fs.readFileSync(path.join(engTmp, 'readability.ratchet.json'), 'utf8')) : {};
ok(wroteEng.status === 0 && engRows['src/rule.js'] && typeof engRows['src/rule.js'].score === 'number', '--repo engines --write writes the engines ratchet, one row per own-code file' + (wroteEng.status ? '\n' + wroteEng.stdout + wroteEng.stderr : ''));
const wroteEng2 = run([TOOL, '--repo', 'engines', '--root', engTmp, '--write']);
ok(wroteEng2.status === 0 && /0 lowered · 0 refused/.test(wroteEng2.stdout), '--repo engines --write again changes nothing (lower only)');

console.log('\n2 · the head edits, judged against the base');
writeAll(HEAD);
fs.writeFileSync(path.join(tmp, 'trace.json'), JSON.stringify(TRACE));
const out = path.join(tmp, 'result.json');
const judged = run([TOOL, '--changed', '--repo', 'web', '--root', tmp, '--base', baseSha, '--ratchet', '--md', '--today', '2026-10-16', '--json', out]);
ok(judged.status === 1, 'the guard exits 1 on the broken fixture' + (judged.status === 1 ? '' : '\n' + judged.stdout + judged.stderr));
const result = JSON.parse(fs.readFileSync(out, 'utf8'));
const findings = (rule, file) => result.findings.filter((finding) => finding.rule === rule && finding.text.includes(file));
const fails = (rule, file) => findings(rule, file).filter((finding) => finding.level === 'fail');
const warns = (rule, file) => findings(rule, file).filter((finding) => finding.level === 'warn');
const noFindings = (file) => result.findings.filter((finding) => finding.text.includes(file) && finding.level === 'fail').length === 0;

ok(noFindings('rename.js'), 'ct → counter passes (rename.js: no failure)');
ok(fails('cryptic-name', 'cryptic.js').length === 1 && /`q`/.test(fails('cryptic-name', 'cryptic.js')[0].text), '`const q =` fails as a new cryptic name');
ok(fails('hard-limit', 'freshLong').length === 1, 'a NEW 90-line function fails the hard limit');
ok(warns('hard-limit', 'legacyStays').length === 1 && fails('hard-limit', 'legacyStays').length === 0, 'a legacy long function touched but not grown only WARNS');
ok(fails('hard-limit', 'legacyGrows').length === 1 && /WORSE/.test(fails('hard-limit', 'legacyGrows')[0].text), 'a legacy long function that grew by one line FAILS');
ok(fails('hard-limit', 'crossesLimit').length === 1 && /crossed/.test(fails('hard-limit', 'crossesLimit')[0].text), 'a function that crossed 80 lines FAILS');
ok(fails('hard-limit', 'branchy').length === 1 && /c1[6-9]|c2\d/.test(fails('hard-limit', 'branchy')[0].text), 'complexity over 15 fails');
ok(fails('hard-limit', 'deepOne').length === 1 && /depth5/.test(fails('hard-limit', 'deepOne')[0].text), 'nesting over 4 fails');
ok(fails('empty-catch', 'catch.js').length === 1 && /0 → 2/.test(fails('empty-catch', 'catch.js')[0].text) && /catch \{\}/.test(fails('empty-catch', 'catch.js')[0].text) && /\.catch\(fn\)/.test(fails('empty-catch', 'catch.js')[0].text), 'a new `catch (_) {}` and a new `.catch(function () {})` both fail');
ok(fails('module-header', 'header.js').length === 1 && /no header comment at all/.test(fails('module-header', 'header.js')[0].text), 'a touched module with no header fails');
ok(fails('card-line', 'nocard.js').length === 1 && fails('module-header', 'nocard.js').length === 0, 'a header without a CARD line fails the CARD rule only');
ok(result.findings.every((finding) => !finding.text.includes('untouched.js')), 'an untouched file is not judged (its `q` stays)');
ok(fails('trace-row', 'notest.js').length === 1, 'a module with no test row in trace.json fails');
ok(warns('test-minimums', 'minimums.js').length === 1 && /aa-contrast/.test(warns('test-minimums', 'minimums.js')[0].text), 'missing §7 minimums WARN before ' + MINIMUMS_FAIL_FROM);
ok(fails('ratchet', 'worse.js').length === 1 && /long40 0 → 1/.test(fails('ratchet', 'worse.js')[0].text), 'a file whose score rose above its ratchet row fails, naming the counter');
ok(result.findings.some((finding) => finding.rule === 'ratchet' && finding.level === 'info' && finding.text.includes('better.js')), 'a file whose score dropped is told to tighten the ratchet');
ok(!result.files.some((file) => file.file === 'docs/notes.md'), 'a doc is not an own-code file');
ok(/Pass 1 · shrink: lines \d+ → \d+ · complexity \d+ → \d+/.test(result.markdown) && /Pass 2 · humanify: cryptic names \d+ → \d+/.test(result.markdown) && /- \[ \] Guard green/.test(result.markdown), 'the --md checklist carries before → after numbers and an unticked Guard green');
ok(/\[cryptic-name\]/.test(judged.stdout) && /§6 checklist/.test(judged.stdout), 'the report and the checklist are printed');

console.log('\n3 · minimums fail after the first week; --write tightens only downward');
const late = run([TOOL, '--changed', '--repo', 'web', '--root', tmp, '--base', baseSha, '--today', '2026-10-30', '--json', out]);
const lateResult = JSON.parse(fs.readFileSync(out, 'utf8'));
ok(late.status === 1 && lateResult.findings.some((finding) => finding.rule === 'test-minimums' && finding.level === 'fail' && finding.text.includes('minimums.js')), 'missing §7 minimums FAIL on ' + '2026-10-30');
const tightened = run([TOOL, '--changed', '--repo', 'web', '--root', tmp, '--base', baseSha, '--ratchet', '--write', '--today', '2026-10-16']);
const ratchet1 = JSON.parse(fs.readFileSync(path.join(tmp, 'readability.ratchet.json'), 'utf8'));
ok(ratchet1['public/app/better.js'].score < ratchet0['public/app/better.js'].score, '--write lowered better.js (' + ratchet0['public/app/better.js'].score + ' → ' + ratchet1['public/app/better.js'].score + ')');
ok(ratchet1['public/app/worse.js'].score === 0 && /refused public\/app\/worse\.js/.test(tightened.stdout), '--write refused to raise worse.js (lower only)');

console.log('\n4 · a docs-only change judges nothing and passes');
git(tmp, ['add', '-A']); git(tmp, ['commit', '-q', '-m', 'head']);
fs.writeFileSync(path.join(tmp, 'docs/notes.md'), '# notes\n\nonly docs now\n');
const docsOnly = run([TOOL, '--changed', '--repo', 'web', '--root', tmp, '--base', 'HEAD', '--ratchet']);
ok(docsOnly.status === 0 && /0 own-code file/.test(docsOnly.stdout), 'docs-only: 0 own-code files, exit 0');

console.log('\n5 · trace.json from KG1 on the graph fixture (tools/graph/trace.cjs over tools/graph/graph.cjs)');
const traceOut = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-trace-'));
const built = spawnSync(process.execPath, [GRAPH_TOOL, 'build', '--roots', 'web=' + path.join(KG_FIXTURE, 'web') + ',api=' + path.join(KG_FIXTURE, 'api') + ',engines=' + path.join(KG_FIXTURE, 'engines'), '--out', traceOut], { encoding: 'utf8' });
ok(built.status === 0, 'the graph builds on the fixture');
const traced = spawnSync(process.execPath, [TRACE_TOOL, '--repo', 'api', '--no-build', '--stdout', '--out', traceOut], { encoding: 'utf8', env: Object.assign({}, process.env, { CB_GRAPH_ROOTS: 'web=' + path.join(KG_FIXTURE, 'web') + ',api=' + path.join(KG_FIXTURE, 'api') + ',engines=' + path.join(KG_FIXTURE, 'engines') }), cwd: ROOT, maxBuffer: 64 << 20 });
let trace = null;
try { trace = JSON.parse(traced.stdout); } catch (error) { console.log('    trace.cjs gave no JSON: ' + (traced.stderr || '').slice(-300)); }
ok(trace && trace.repo === 'api' && trace.modules['routes/books.js'], 'the fixture api has a row for routes/books.js' + (trace ? '' : '\n' + traced.stdout.slice(0, 300)));
const booksRow = trace && trace.modules['routes/books.js'];
ok(booksRow && booksRow.layer === 'route' && booksRow.tests.some((test) => test.file === 'tests/pay.test.cjs'), 'its layer is route and tests/pay.test.cjs reaches it');
ok(booksRow && booksRow.routesServed.some((route) => /POST \/api\/books\/payments/.test(route)), 'it serves POST /api/books/payments');
ok(booksRow && Array.isArray(booksRow.minimums.missing) && booksRow.minimums.have.includes('one-success-path'), 'its §7 minimums are evidenced from its tests (one-success-path present)');
const libRow = trace && trace.modules['lib/pay.js'];
ok(libRow && libRow.layer === 'lib' && libRow.calledBy.some((file) => /routes\/books\.js/.test(file)), 'lib/pay.js is called by routes/books.js');

console.log('\n6 · the modules behind the tool, one unit each');
const measure = require('../tools/readability/measure.cjs');
const facts = measure.factsFromText('public/app/unit.js', HEADER('unit') + 'function readShop(shop) {\n  var q = shop.id;\n  try { return q; } catch (_) {}\n}\n' + complexFunction('manyBranches', 4));
ok(facts.functions.length === 2 && facts.functions[0].name === 'readShop' && facts.functions[1].complexity === 5, 'measure: two functions, manyBranches has complexity 5 (' + facts.functions.map((fn) => fn.name + ' c' + fn.complexity).join(', ') + ')');
ok(facts.cryptic.length === 1 && facts.cryptic[0].name === 'q' && facts.emptyCatches.length === 1 && facts.header.card === 'qa/fixture-unit', 'measure: one cryptic name, one empty catch, the CARD line read');
ok(measure.inScope('web', 'public/app/x.js') && !measure.inScope('web', 'public/till.html') && !measure.inScope('web', 'e2e/x.cjs') && !measure.inScope('api', 'lib/money.js', '/* ADOPTED from chitbridge-engines v1 · money */'), 'measure: scope — own code in, the vendored till / a test / an adopted copy out');
/* INT7b: a route handler pairs with its own route when the file grows above it; a function with no route pairs as before */
const ROUTES = (pad) => "/* api fixture */\nconst router = {};\n" + pad + "router.get('/a', async (req, res) => {\n  return 1;\n});\n" +
  "router.post('/b', auth, async (req, res) => {\n  if (req.x) return 2;\n  if (req.y) return 3;\n  return 4;\n});\nfunction helper(rows) {\n  return rows;\n}\n";
const routeBase = measure.factsFromText('routes/fixture.js', ROUTES('')).functions;
const routeHead = measure.factsFromText('routes/fixture.js', ROUTES('\n'.repeat(9))).functions;
const { matchBase } = require('../tools/readability/guard.cjs');
const routePairs = matchBase(routeHead, routeBase);
const pairedRoute = (route) => { const head = routeHead.find((fn) => fn.route === route); const base = routePairs.get(head); return base && base.route; };
ok(routeHead[0].route === 'GET /a' && routeHead[1].route === 'POST /b' && !routeHead[2].route, 'measure: a handler passed to router.<verb>(\'path\', …) carries its route; a plain function carries none');
ok(pairedRoute('GET /a') === 'GET /a' && pairedRoute('POST /b') === 'POST /b', 'guard: a handler moved 9 lines down still pairs with its own route (INT7b)');
ok(routePairs.get(routeHead[2]) === routeBase[2], 'guard: a function with no route pairs by name + params, as before');
const ratchet = require('../tools/readability/ratchet.cjs');
const merged = ratchet.tighten({ 'a.js': { score: 3 }, 'b.js': { score: 1 } }, { 'a.js': { score: 1 }, 'b.js': { score: 5 }, 'c.js': { score: 0 } });
ok(merged.rows['a.js'].score === 1 && merged.rows['b.js'].score === 1 && merged.rows['c.js'].score === 0 && merged.refused.length === 1 && merged.lowered.length === 1, 'ratchet: tighten lowers a.js, refuses b.js, adds c.js');
ok(ratchet.score(facts).score === 2 && ratchet.risen({ score: 0, cryptic: 0, emptyCatch: 0 }, ratchet.score(facts)).join(',') === 'cryptic 0 → 1,emptyCatch 0 → 1', 'ratchet: the score is the sum of the breakdown, and risen() names what rose');
const diffReader = require('../tools/readability/changed.cjs');
const parsed = diffReader.parseDiff('diff --git a/x.js b/x.js\n--- a/x.js\n+++ b/x.js\n@@ -3,0 +4,2 @@\n+a\n+b\n@@ -10 +12 @@\n-c\n+d\ndiff --git a/new.js b/new.js\n--- /dev/null\n+++ b/new.js\n@@ -0,0 +1,3 @@\ndiff --git a/gone.js b/gone.js\n--- a/gone.js\n+++ /dev/null\n');
ok(parsed.length === 3 && parsed[0].status === 'modified' && JSON.stringify(parsed[0].ranges) === '[[4,5],[12,12]]' && parsed[1].status === 'added' && parsed[2].status === 'deleted', 'changed: the diff grammar — modified ranges, an added file, a deleted file');
const baselineReport = require('../tools/readability/baseline.cjs');
const metrics = baselineReport.metrics('web', tmp, 5);
ok(metrics.files === 13 && metrics.R3.over_80 === 4 && metrics.R1.cryptic_declarations >= 2, 'baseline: R1–R6 over the fixture (13 files, 4 functions over 80 lines)');

console.log('\n7 · pr-checklist (tools/pr-checklist.cjs): the body must carry the five lines with numbers; bots and docs-only skip');
const checklist = require('../tools/pr-checklist.cjs');
const filledBody = lateResult.markdown.replace(/`<doc>`/g, 'n/a').replace('`<word>` → reused/widened `<name>` (or "nothing exists")', '`readability` → widened `tools/readability.cjs`');
ok(checklist.problems(filledBody).length === 0, 'the tool\'s own --md output, with Pass 0 and the docs filled, passes');
ok(checklist.problems(fs.readFileSync(path.join(ROOT, '.github/pull_request_template.md'), 'utf8')).length === 4, 'the untouched template fails on its four placeholder lines');
ok(checklist.problems('no checklist at all').length === 5, 'a body with no checklist is missing all five lines');
ok(checklist.skipReason('dependabot[bot]', ['package.json']) && checklist.skipReason('me', ['docs/a.md', 'README.md']) && !checklist.skipReason('me', ['docs/a.md', 'lib/x.js']), 'skips: a dependency bot · docs-only; a code change never skips');

fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(traceOut, { recursive: true, force: true });
console.log(bad ? '\n✗ ' + bad + ' FAILED — the readability guard no longer judges what it claims to' : '\n✓ every §6 rule bites once, and passes once');
process.exit(bad ? 1 : 0);
