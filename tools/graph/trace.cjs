#!/usr/bin/env node
/* tools/graph/trace.cjs — trace.json per repo: every module's TRACE row, GENERATED from KG1 (READ-GUARD, DISCIPLINES §6 Pass 3 · §7).
 *
 * OWNS      the trace row of each own-code module: its CARD line · layer · the tests that reach it (+ their steps) · the walks it takes
 *           part in · what it calls and who calls it · api routes served / called · tables owned (written) / read · flow steps ·
 *           the §7 minimums its tests evidence. Written to <repo>/trace.json (gitignored — regenerated, never typed).
 * CALLED BY tools/readability.cjs (the --changed guard builds it fresh when no trace.json sits at the root), the card generator on the
 *           owner's PC (C:/dev/tools/area-docs.cjs reads <repo>/trace.json), by hand.
 * FLOW      graph.build() (or tools/graph/out/graph.json with --no-build) ──▶ index edges ──▶ for each file node of the repo:
 *           row(module) ──▶ minimums(layer, tests) ──▶ { generated, repo, modules } ──▶ <root>/trace.json | --stdout
 * CARD      qa/readability-guard
 *
 *   node tools/graph/trace.cjs                         web + api (when ../chitbridge-api is beside) → each repo's trace.json
 *   node tools/graph/trace.cjs --repo api --root DIR   one repo; --stdout prints the JSON instead of writing; --no-build reuses out/graph.json
 * ⚠️ The minimums are EVIDENCE BY KEYWORD over the tests that reach a module (and an explicit `MIN <name>` line in a test) — a guide for
 *    the TRACE table, said as such in every row (`minimums.how`).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const WEB_ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf('--' + name);
  if (at < 0) return fallback;
  const next = argv[at + 1];
  return next && !next.startsWith('--') ? next : true;
};
const HEAD_BYTES = 6000;
const CARD_LINE = /\bCARD\s+([\w.-]+\/[\w.-]+)/;
const MAX_STEPS = 40;
const MIN_STEP_WORDS = 12;

// ── layers (§7) and what each layer's tests must evidence
const LAYER_RULES = [
  { repo: 'api', test: /^routes\//, layer: 'route' },
  { repo: 'api', test: /^tools\/tally-connector\//, layer: 'counter' },
  { repo: 'api', test: /^(tools|scripts)\//, layer: 'tool' },
  { repo: 'api', test: /./, layer: 'lib' },
  { repo: 'web', test: /^public\//, layer: 'ui' },
  { repo: 'web', test: /./, layer: 'tool' },
  { repo: 'engines', test: /^src\//, layer: 'engine' },
  { repo: 'engines', test: /./, layer: 'tool' }
];
/** the bare minimums per layer (DISCIPLINES §7) and the keyword evidence that counts for each */
const MINIMUMS = {
  route: {
    'one-success-path': /./,
    contract: /contract/i,
    'auth-refused': /\b(401|403|anonymous|unauthori[sz]ed|forbidden|OWNER_ONLY)\b/,
    'bad-input-4xx': /\b(400|409|422|BAD_REQUEST|validation|malformed|refused in words)\b/i,
    'idempotent-replay': /\b(idempot\w*|replay|twice|once|duplicate)\b/i,
    'error-never-leaks': /\b(safeErr|leak|e\.message|500)\b/
  },
  lib: {
    'unit-per-rule': /./,
    'refusal-path': /\b(refus\w*|throw\w*|reject\w*|401|403|cannot|never)\b/i,
    'fail-closed': /\b(closed|down|unavailable|refuse\w*|503)\b/i
  },
  ui: {
    walk: /walk/i,
    'cream-and-dark-1366-390': /\b(dark|390|1366|theme)\b/i,
    'aa-contrast': /\b(contrast|a11y|AA)\b/,
    'could-not-read-words': /\b(could not|unreadable|not reach\w*|in words|fell back)\b/i,
    'string-layer': /\b(locale|string layer|T\()/
  },
  counter: {
    walk: /walk|till/i,
    'offline-sync-once': /\b(offline|sync\w*)\b/i,
    'country-bill': /\b(country|AU|AE|IN)\b/,
    'vendored-byte-equal': /\b(vendor\w*|byte)\b/i
  },
  engine: {
    'unit-per-function': /./,
    'edge-values': /\b(zero|negative|rounding|precision|edge)\b/i,
    'country-packs': /\b(IN|AU|AE|pack\w*)\b/,
    'property-invariant': /\b(property|invariant|balance\w*|never negative)\b/i
  },
  tool: { 'unit-test': /./ }
};

// ── the graph
function loadGraph() {
  const graph = require('./graph.cjs');
  if (flag('no-build')) return graph.loadGraph();
  const quiet = console.log;
  console.log = (...parts) => console.error(...parts); /* the build narrates on stdout; --stdout needs it clean */
  try {
    return graph.loadGraph(graph.build());
  } finally {
    console.log = quiet;
  }
}

/** out/in edge lists per node, and the nodes of one repo grouped by file */
function index(graph) {
  const byFile = new Map(); // repo:file -> { file, screen, functions[], routes[] }
  const slot = (repo, file) =>
    byFile.get(repo + ':' + file) || byFile.set(repo + ':' + file, { file, functions: [], routes: [], node: null, screen: null }).get(repo + ':' + file);
  for (const node of graph.nodes.values()) {
    if (node.kind === 'file') slot(node.repo, node.file).node = node;
    else if (node.kind === 'screen' && node.screen === 'page') slot(node.repo, node.file).screen = node;
    else if (node.kind === 'function') slot(node.repo, node.file).functions.push(node);
    else if (node.kind === 'route') slot(node.repo, node.file).routes.push(node);
  }
  return byFile;
}

const fileOf = (id) =>
  String(id)
    .replace(/^(fn|file|screen|route|test):(web|api|engines):/, '')
    .replace(/#.*$/, '')
    .replace(/ (GET|POST|PUT|PATCH|DELETE|ALL) .*$/, '');
const repoOf = (id) => (/^(?:fn|file|screen|route|test):(web|api|engines):/.exec(String(id)) || [])[1];

/** the check labels inside a test file: the strings on its ok( / t( / check( / it( / test( lines */
function stepsOf(absPath) {
  if (!fs.existsSync(absPath)) return [];
  const labels = [];
  for (const line of fs.readFileSync(absPath, 'utf8').split('\n')) {
    if (!/\b(ok|t|check|it|test|assert|expect|pass|fail)\s*\(/.test(line)) continue;
    const match = /(['"`])((?:(?!\1)[^\\]|\\.){12,}?)\1/.exec(line);
    if (match && match[2].length >= MIN_STEP_WORDS) labels.push(match[2].slice(0, 120));
    if (labels.length >= MAX_STEPS) break;
  }
  return labels;
}

function cardOf(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const head = fs.readFileSync(absPath, 'utf8').slice(0, HEAD_BYTES);
  const match = CARD_LINE.exec(head);
  return match ? match[1] : null;
}

const layerOf = (repo, file) => (LAYER_RULES.find((rule) => rule.repo === repo && rule.test.test(file)) || { layer: 'tool' }).layer;

/** which §7 minimums the module's tests evidence (keywords over their text + explicit `MIN <name>` lines) */
function minimumsOf(layer, tests, roots) {
  const rules = MINIMUMS[layer] || MINIMUMS.tool;
  const text = tests
    .map((test) => {
      const absPath = path.join(roots[test.repo] || '', test.file);
      return (fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8') : '') + '\n' + test.file;
    })
    .join('\n');
  const explicit = new Set([...text.matchAll(/\bMIN[: ]+([\w-]+)/g)].map((match) => match[1]));
  const have = [],
    missing = [];
  for (const [name, pattern] of Object.entries(rules)) (tests.length && (explicit.has(name) || pattern.test(text)) ? have : missing).push(name);
  return { layer, have, missing, how: 'keyword evidence over the tests that reach the module; a `MIN <name>` line in a test is explicit' };
}

/** every test that reaches the module (its file/screen node, its functions, its routes), with how and its steps */
function testsOf(graph, entry, roots) {
  const seeds = [entry.node, entry.screen]
    .filter(Boolean)
    .concat(entry.functions, entry.routes)
    .map((node) => node.id);
  const tests = new Map();
  for (const id of seeds)
    for (const edge of graph.out.get(id) || []) {
      if (edge.kind !== 'tested-by') continue;
      const repo = repoOf(edge.to),
        file = fileOf(edge.to);
      if (!tests.has(edge.to)) tests.set(edge.to, { repo, file, via: new Set(), steps: stepsOf(path.join(roots[repo] || '', file)) });
      tests.get(edge.to).via.add(edge.via || 'reaches');
    }
  return [...tests.values()].map((test) => Object.assign(test, { via: [...test.via].sort() })).sort((left, right) => (left.file < right.file ? -1 : 1));
}

/** the neighbours of a module over one edge kind, as files (what it calls · who calls it · tables · steps) */
function neighbours(graph, entry, kind, direction) {
  const ownIds = new Set(
    [entry.node, entry.screen]
      .filter(Boolean)
      .concat(entry.functions, entry.routes)
      .map((node) => node.id)
  );
  const found = new Set();
  for (const id of ownIds)
    for (const edge of (direction === 'out' ? graph.out : graph.inn).get(id) || []) {
      if (edge.kind !== kind) continue;
      const other = direction === 'out' ? edge.to : edge.from;
      if (!ownIds.has(other)) found.add(other);
    }
  return [...found];
}

const routeLabel = (graph, id) => {
  const node = graph.nodes.get(id);
  return node ? node.method + ' ' + node.path : id;
};
const tableName = (id) => String(id).replace(/^table:/, '');

/** one module's TRACE row */
function rowOf(graph, repo, entry, roots) {
  const tests = testsOf(graph, entry, roots);
  const layer = layerOf(repo, entry.file);
  const filesOf = (ids) => [...new Set(ids.filter((id) => /^(fn|file|screen|route):/.test(id)).map((id) => repoOf(id) + ':' + fileOf(id)))].sort();
  return {
    card: cardOf(path.join(roots[repo], entry.file)),
    layer,
    tests: tests.filter((test) => !/(^|\/)walk-/.test(test.file)),
    walks: tests.filter((test) => /(^|\/)walk-/.test(test.file)),
    calls: filesOf(neighbours(graph, entry, 'calls', 'out')),
    calledBy: filesOf(neighbours(graph, entry, 'calls', 'in')),
    routesServed: entry.routes.map((node) => node.method + ' ' + node.path).sort(),
    routesCalled: neighbours(graph, entry, 'calls', 'out')
      .filter((id) => id.startsWith('route:'))
      .map((id) => routeLabel(graph, id))
      .sort(),
    tablesOwned: neighbours(graph, entry, 'writes', 'out').map(tableName).sort(),
    tablesRead: neighbours(graph, entry, 'reads', 'out').map(tableName).sort(),
    flowSteps: neighbours(graph, entry, 'implements', 'in')
      .filter((id) => id.startsWith('step:'))
      .map((id) => id.replace(/^step:/, ''))
      .sort(),
    minimums: minimumsOf(layer, tests, roots)
  };
}

/** the trace of one repo: a row per own-code module (file nodes and page screens; tests and adopted copies excluded) */
function traceOf(graph, repo, roots) {
  const modules = {};
  for (const entry of index(graph).values()) {
    const node = entry.node || entry.screen;
    if (!node || node.repo !== repo || (entry.node && entry.node.adopted)) continue;
    modules[entry.file] = rowOf(graph, repo, entry, roots);
  }
  const sorted = {};
  for (const file of Object.keys(modules).sort()) sorted[file] = modules[file];
  return {
    generated: new Date().toISOString().slice(0, 10),
    repo,
    how: 'node tools/graph/trace.cjs (KG1 tested-by · calls · reads/writes · implements edges)',
    modules: sorted
  };
}

/** the command line: which repos, which root; one trace per repo to <root>/trace.json or --stdout */
function main() {
  const repoFlag = String(flag('repo', 'all'));
  const root = flag('root');
  if (typeof root === 'string' && repoFlag !== 'all') process.env.CB_GRAPH_ROOTS = repoFlag + '=' + path.resolve(root);
  const graph = loadGraph();
  const roots = require('./graph.cjs').ROOTS;
  const repos = repoFlag === 'all' ? ['web', 'api'].filter((repo) => graph.meta.present[repo]) : [repoFlag];
  for (const repo of repos) {
    const trace = traceOf(graph, repo, roots);
    if (flag('stdout')) {
      process.stdout.write(JSON.stringify(trace));
      continue;
    }
    const target = path.join(roots[repo], 'trace.json');
    fs.writeFileSync(target, JSON.stringify(trace, null, 1) + '\n');
    const rows = Object.values(trace.modules);
    console.error(
      `  ${repo}: ${rows.length} modules → ${path.relative(process.cwd(), target)} · with a test row ${rows.filter((row) => row.tests.length || row.walks.length).length} · with a CARD line ${rows.filter((row) => row.card).length}`
    );
  }
}

if (require.main === module) main();
module.exports = { WEB_ROOT };
