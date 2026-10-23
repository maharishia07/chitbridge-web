'use strict';
/* tools/graph/apifeed.cjs (FEEDGRAPH): every source joins what it says it joins, on the knowledge-graph fixture where the truth is known.
 * Unit level: feed() gets a hand-made context (no scan of the repos), so a break names the one source that broke.
 * Run: node tests/graph-apifeed.test.cjs */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { feed, parseLessons } = require('../tools/graph/apifeed.cjs');

const FIXTURE = path.join(__dirname, '..', 'tools', 'graph', 'fixture');
const API = path.join(FIXTURE, 'api');
const HOME = path.join(FIXTURE, 'home');
let passed = 0;
const ok = (cond, what) => {
  assert(cond, what);
  passed++;
  console.log('  ok  ' + what);
};

/** a graph context over the fixture: the four register routes, one pay test, the pay lib file, and recorders for nodes and edges */
function makeContext(overrides) {
  const nodes = new Map();
  const edges = [];
  const route = (routePath, start, end) => ({ id: 'route:api:routes/books.js GET ' + routePath, method: 'GET', path: '/api/books' + routePath, tail: routePath, file: 'routes/books.js', start, end });
  const payment = Object.assign(route('/payments', 0, 100), { method: 'POST', id: 'route:api:routes/books.js POST /payments' });
  const routes = [payment, route('/status', 100, 200), route('/never', 200, 300), route('/orphan', 300, 400)];
  payment.fileRec = { scan: { strings: [{ start: 10, text: 'PAY_REFUSED' }, { start: 150, text: 'NEVER_USED' }] } };
  const byId = new Map([['test:api:tests/pay.test.cjs', {}], ['file:api:lib/pay.js', {}]]);
  const ctx = {
    A: API,
    HOME,
    node: (id, fields) => nodes.set(id, Object.assign(nodes.get(id) || { id }, fields)),
    edge: (from, to, kind, via) => edges.push({ from, to, kind, via }),
    byId,
    routes,
    files: [{ repo: 'api', rel: 'lib/pay.js', id: 'file:api:lib/pay.js', kind: 'lib' }],
    norm: (value) => value,
    meta: { notes: [] },
    present: { api: true }
  };
  return Object.assign(ctx, overrides || {}, { nodes, edges });
}
const hasEdge = (ctx, from, to, kind, via) => ctx.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === kind && (via === undefined || edge.via === via));

/* 1 · parseLessons reads the audit table */
const lessons = parseLessons(fs.readFileSync(path.join(HOME, 'PM', 'API-LESSONS-AUDIT-fixture.md'), 'utf8'));
ok(lessons.length === 3 && lessons.map((lesson) => lesson.verdict).join() === 'addressed,rule-only,not-addressed', 'parseLessons: three rows, verdicts addressed / rule-only / not-addressed');
ok(parseLessons('| 4 | 1 | text | ADDRESSED (partly) | `x.js` |')[0].partial === true && parseLessons('not a table row').length === 0, 'parseLessons: a "(partly)" verdict is flagged, a non-row line is skipped');

/* 2 · the whole feed on the fixture */
const ctx = makeContext();
feed(ctx);
const stats = ctx.meta.apiFeed;
ok(stats.routesJoined === 4 && stats.registerNotInScan === 0 && stats.scanNotInRegister === 0, 'feed: all four register rows join the four scanned routes');
ok(ctx.nodes.get('route:api:routes/books.js POST /payments').reg.signed === true && ctx.nodes.get('route:api:routes/books.js GET /never').reg.status === 'not started', 'feed: the register status and sign-off land on the route node');
ok(hasEdge(ctx, 'route:api:routes/books.js GET /status', 'check:api:docs/contracts/api-error-tests.json', 'tested-by', 'error-tests'), 'feed: an error-tests row becomes a tested-by edge when no sweep names the file');
ok(hasEdge(ctx, 'route:api:routes/books.js GET /orphan', 'check:api:tools/api-contract-tests.cjs', 'tested-by', 'contract') && ctx.nodes.get('route:api:routes/books.js GET /orphan').contractCases === 2, 'feed: a contract-results row becomes a tested-by edge with its case count');
ok(stats.testedByFeed === 2 && stats.evidenceRows === 0, 'feed: two proofs counted, no evidence rows in the fixture');
ok(hasEdge(ctx, 'route:api:routes/books.js POST /payments', 'errcode:PAY_REFUSED', 'returns', 'literal') && !hasEdge(ctx, 'route:api:routes/books.js POST /payments', 'errcode:NEVER_USED', 'returns') && ctx.nodes.has('errcode:NEVER_USED'), 'feed: a route returns only the code its own text names; an unused code is still a node');
ok(ctx.nodes.get('test:api:tests/pay.test.cjs').level === 'T1' && stats.libraryMatched === 1, 'feed: the test library gives the known test its level');
ok(hasEdge(ctx, 'lesson:api:1', 'file:api:lib/pay.js', 'enforced-by') && ctx.nodes.get('lesson:api:2').gap === true && ctx.nodes.get('lesson:api:3').verdict === 'not-addressed', 'feed: lesson 1 is enforced by lib/pay.js, lessons 2 and 3 are gaps');
ok(stats.lessons === 3 && ctx.nodes.get('lesson:api:1').checksFound === 1, 'feed: three lessons counted, lesson 1 found its one check');
ok(ctx.meta.notes.some((note) => /api-hardening-evidence-areas\.json is absent/.test(note)), 'feed: the absent areas-evidence file is SAID in the notes, not an error');

/* 3 · when the api repo is absent nothing is joined and the counts say zero */
const absent = makeContext({ present: { api: false } });
feed(absent);
ok(absent.meta.apiFeed.routesJoined === 0 && absent.nodes.size === 0 && absent.edges.length === 0, 'feed: api absent → zero counts, no node, no edge');

/* 4 · a register that is not there, or does not parse, is said (with the reason) and the routes carry no register columns */
const emptyApi = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-apifeed-'));
fs.mkdirSync(path.join(emptyApi, 'docs'));
fs.writeFileSync(path.join(emptyApi, 'docs', 'api-register.json'), '{ not json');
const broken = makeContext({ A: emptyApi, HOME: emptyApi });
feed(broken);
ok(broken.meta.notes.some((note) => /could not read .*api-register\.json/.test(note)) && broken.meta.notes.some((note) => /api-register\.json is missing or unreadable/.test(note)), 'feed: an unreadable register says why and what the reader gets instead');
ok(broken.meta.notes.some((note) => /error-codes\.json is missing/.test(note)) && broken.meta.notes.some((note) => /TEST-LIBRARY\.json not found/.test(note)) && broken.meta.notes.some((note) => /API-LESSONS-AUDIT/.test(note)), 'feed: every missing source is named in the notes');
ok(!broken.nodes.has('route:api:routes/books.js GET /never') || broken.nodes.get('route:api:routes/books.js GET /never').reg === undefined, 'feed: no register → no register columns on any route');
fs.rmSync(emptyApi, { recursive: true, force: true });

console.log(passed + ' passed');
