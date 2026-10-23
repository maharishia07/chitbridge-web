/**
 * tools/graph/apifeed.cjs — FEEDGRAPH: the api's own generated registers become graph facts (KG-FEED, 2026-10-23).
 *
 * Athi, 2026-10-23: "create feedgraph and the other one and will see which one should be useful". This is candidate A: the KG1 graph
 * (graph.cjs) widened, never a second graph. graph.cjs calls feed() once, after the route nodes exist and before the graph is written.
 * Everything here is READ from generated files; nothing is typed by hand.
 *
 *   api docs/api-register.json                    route nodes gain `reg`: status · 13 columns · human sign-off · owner_area · declared statuses
 *   api docs/contracts/api-error-tests.json       route → test (the api-problem sweep that names the route's file)  via `error-tests`
 *   api docs/contracts/api-contract-results.json  route → tests/api-contract.test.cjs                                 via `contract`
 *   api docs/contracts/api-hardening-evidence*.json  route → the evidence writer's test                              via `evidence`
 *                                                 (the -areas file arrives with api #337: absent = said in meta.notes, not an error)
 *   api docs/error-codes.json                     `errcode` nodes · route → errcode `returns` when the route's own text names the code
 *   HOME docs/29-…/tests/TEST-LIBRARY.json        test nodes gain level · type · runner · owner
 *   HOME PM/API-LESSONS-AUDIT-*.md                `lesson` nodes (status ADDRESSED / RULE ONLY / NOT ADDRESSED) → `enforced-by` the check it
 *                                                 names (a file that exists) — or `gap` when nothing fails if the lesson is forgotten
 *
 * Static and offline. A route listed in a register that the scan cannot find (or the reverse) is counted in meta.apiFeed, never dropped.
 *
 * OWNS      the join between the api registers / lessons audit and the graph nodes
 * CALLED BY tools/graph/graph.cjs build (step 10b) · e2e/knowledge-graph.cjs
 * CARD      qa/knowledge-graph
 */
'use strict';
const fs = require('fs');
const path = require('path');

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
};
const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch (_) {
    return false;
  }
};

/** the audit's markdown table → [{ id, ledger, text, status, how, by }] ; status is the FIRST verdict word group */
function parseLessons(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*(\d+[a-z]?|defect)\s*\|/.exec(line);
    if (!m) continue;
    const cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells.length < 5) continue;
    const status = cells[3];
    const cls = /^NOT ADDRESSED/.test(status) ? 'not-addressed' : /^RULE ONLY/.test(status) ? 'rule-only' : /^ADDRESSED/.test(status) ? 'addressed' : 'unknown';
    out.push({ id: cells[0], ledger: cells[1], text: cells[2], status, cls, partial: cls === 'addressed' && /\(partly\)|\/ RULE ONLY|RULE ONLY \(/.test(status), by: cells.slice(4).join('|') });
  }
  return out;
}

function feed(ctx) {
  const { A, HOME, node, edge, byId, routes, files, norm, meta } = ctx;
  const note = (s) => meta.notes.push(s);
  const stats = (meta.apiFeed = { register: null, routesJoined: 0, registerNotInScan: 0, scanNotInRegister: 0, testedByFeed: 0, errcodes: 0, lessons: 0, libraryRows: 0, libraryMatched: 0 });
  if (!ctx.present.api) return;

  /* ── register → route nodes ─────────────────────────────────────────────────────────────────────────────────── */
  const regPath = path.join(A, 'docs', 'api-register.json');
  const REG = readJson(regPath);
  const idx = new Map(); // METHOD norm(path) -> [route]
  for (const r of routes) {
    const k = r.method + ' ' + norm(r.path);
    (idx.get(k) || idx.set(k, []).get(k)).push(r);
  }
  const taken = new Set(); // routes some register row owns; the tail fallback never steals one
  if (REG && Array.isArray(REG.routes)) for (const row of REG.routes) for (const c of idx.get(row.method + ' ' + norm(row.path)) || []) if (c.file === row.file) taken.add(c.id);
  const joined = new Map(); // register key -> route record
  if (!REG || !Array.isArray(REG.routes)) note('api docs/api-register.json is missing or unreadable: route nodes carry no register columns, status or sign-off');
  else {
    stats.register = { stage: REG.stage, routes: REG.routes.length, machine: REG.machine_columns, human: REG.human_columns };
    for (const row of REG.routes) {
      const cands = idx.get(row.method + ' ' + norm(row.path)) || [];
      const r = cands.find((c) => c.file === row.file) || cands[0];
      /* a router file mounted twice (catalogue.js at /api/catalogue and /api/network) keeps one mount in the scan: fall back to file + method + the tail */
      const viaTail = r ? null : routes.find((c) => c.file === row.file && c.method === row.method && !taken.has(c.id) && norm(row.path).endsWith(norm(c.tail)) && norm(c.tail) !== '/');
      if (!r && !viaTail) {
        stats.registerNotInScan++;
        continue;
      }
      const hit = r || viaTail;
      joined.set(row.key, hit);
      stats.routesJoined++;
      const columns = {};
      Object.keys(row.columns || {}).forEach((c) => {
        columns[c] = !!row.columns[c];
      });
      const human = row.human || {};
      node(hit.id, {
        reg: {
          key: row.key,
          status: row.status,
          owner_area: row.owner_area,
          signed: !!human.signed_off_by_date,
          signedBy: human.signed_off_by_date || undefined,
          columns,
          columnsPassing: Object.values(columns).filter(Boolean).length,
          columnsTotal: Object.keys(columns).length,
          human,
          declared: row.declared || [],
          notes: row.notes || [],
          stale: row.stale_since || undefined
        }
      });
    }
    const joinedIds = new Set([...joined.values()].map((r) => r.id));
    stats.scanNotInRegister = routes.filter((r) => !joinedIds.has(r.id)).length;
    if (stats.registerNotInScan || stats.scanNotInRegister)
      note(
        'api register ↔ scanned routes: ' + stats.registerNotInScan + ' register rows not found in the scan, ' + stats.scanNotInRegister +
          ' scanned routes not in the register (mount-prefix guesses, dynamic paths — counted, not dropped)'
      );
  }

  /* ── tests: route → test edges from the generated proofs ────────────────────────────────────────────────────── */
  const testNode = (rel) => (byId.has('test:api:' + rel) ? 'test:api:' + rel : null);
  const checkNode = (rel) => {
    const id = 'check:api:' + rel;
    node(id, { kind: 'check', repo: 'api', file: rel });
    return id;
  };
  const sweepTests = files.filter((f) => f.repo === 'api' && f.kind === 'test' && /(^|\/)api-problem-[a-z-]+\.test\.cjs$/.test(f.rel));
  const sweepText = new Map(sweepTests.map((f) => [f.rel, fs.readFileSync(f.abs, 'utf8')]));
  const sweepFor = (routeFile) => sweepTests.filter((f) => sweepText.get(f.rel).includes(routeFile)).map((f) => f.id);
  const kit = testNode('tests/lib/problem-sweep-kit.cjs');

  const errTests = readJson(path.join(A, 'docs', 'contracts', 'api-error-tests.json'));
  if (!errTests) note('api docs/contracts/api-error-tests.json is missing: no error-tests proofs');
  else
    for (const [key, statuses] of Object.entries(errTests)) {
      const r = joined.get(key);
      if (!r) continue;
      const via = sweepFor(r.file);
      const targets = via.length ? via : [kit || checkNode('docs/contracts/api-error-tests.json')];
      targets.forEach((t) => edge(r.id, t, 'tested-by', 'error-tests'));
      node(r.id, { errorTestStatuses: statuses });
      stats.testedByFeed++;
    }

  const contract = readJson(path.join(A, 'docs', 'contracts', 'api-contract-results.json'));
  if (!contract) note('api docs/contracts/api-contract-results.json is missing: no schema-contract proofs');
  else {
    const t = testNode('tests/api-contract.test.cjs') || checkNode('tools/api-contract-tests.cjs');
    for (const [key, res] of Object.entries(contract.routes || {})) {
      const r = joined.get(key);
      if (!r) continue;
      edge(r.id, t, 'tested-by', 'contract');
      node(r.id, { contractCases: res.cases, contractFailed: res.failed });
      stats.testedByFeed++;
    }
  }

  /* evidence: the two columns a static read cannot prove. api-hardening-evidence-areas.json arrives with api #337 — handle its absence */
  const evFiles = ['api-hardening-evidence.json', 'api-hardening-evidence-areas.json'];
  const writer = testNode('tests/lib/foreign-id-world.cjs') || checkNode('docs/contracts/api-hardening-evidence.json');
  let evRows = 0;
  for (const name of evFiles) {
    const j = readJson(path.join(A, 'docs', 'contracts', name));
    if (!j) {
      if (name !== evFiles[0]) note('api docs/contracts/' + name + ' is absent (it arrives with api #337): areas evidence not joined');
      continue;
    }
    for (const [key, flags] of Object.entries(j.routes || {})) {
      const r = joined.get(key);
      if (!r || !flags) continue;
      evRows++;
      node(r.id, { evidence: Object.keys(flags).filter((f) => flags[f]) });
      edge(r.id, writer, 'tested-by', 'evidence');
      stats.testedByFeed++;
    }
  }
  stats.evidenceRows = evRows;

  /* ── error codes ────────────────────────────────────────────────────────────────────────────────────────────── */
  const EC = readJson(path.join(A, 'docs', 'error-codes.json'));
  if (!EC || !Array.isArray(EC.codes)) note('api docs/error-codes.json is missing: no errcode nodes');
  else {
    const codes = new Set();
    for (const c of EC.codes) {
      codes.add(c.code);
      node('errcode:' + c.code, { kind: 'errcode', code: c.code, status: c.status, title: c.title, owner_area: c.owner_area, since: c.since });
      stats.errcodes++;
    }
    /* a route "returns" a code when a string literal inside the route's own text is that code (lib helpers that raise it are not seen) */
    for (const r of routes) {
      if (!joined.size || !r.fileRec || !r.fileRec.scan) continue;
      for (const s of r.fileRec.scan.strings)
        if (s.start >= r.start && s.start < r.end && codes.has(s.text)) edge(r.id, 'errcode:' + s.text, 'returns', 'literal');
    }
  }

  /* ── test library: enrich the test nodes ────────────────────────────────────────────────────────────────────── */
  const lib = readJson(path.join(HOME, 'docs', '29-qa-test-tooling-ux-locale-and-design-system', 'tests', 'TEST-LIBRARY.json'));
  if (!lib || !Array.isArray(lib.rows)) note('TEST-LIBRARY.json not found under ' + HOME + ': test nodes carry no level/type/owner');
  else {
    stats.libraryRows = lib.rows.length;
    for (const row of lib.rows) {
      const id = 'test:' + row.repo + ':' + row.file;
      if (!byId.has(id)) continue;
      stats.libraryMatched++;
      node(id, { level: row.level, testType: row.type, runner: row.runner, testOwner: row.owner });
    }
  }

  /* ── lessons ────────────────────────────────────────────────────────────────────────────────────────────────── */
  const base = new Map();
  for (const f of files) if (f.repo === 'api') (base.get(path.basename(f.rel)) || base.set(path.basename(f.rel), []).get(path.basename(f.rel))).push(f.id);
  const pmDir = path.join(HOME, 'PM');
  let audit = null;
  try {
    audit = fs.readdirSync(pmDir).filter((n) => /^API-LESSONS-AUDIT-.*\.md$/.test(n)).sort().pop();
  } catch (_) {}
  if (!audit) note('PM/API-LESSONS-AUDIT-*.md not found under ' + HOME + ': no lesson nodes');
  else {
    const lessons = parseLessons(fs.readFileSync(path.join(pmDir, audit), 'utf8'));
    stats.lessons = lessons.length;
    stats.lessonSource = audit;
    for (const L of lessons) {
      const id = 'lesson:api:' + L.id;
      const enforces = L.cls === 'addressed';
      node(id, { kind: 'lesson', repo: 'api', n: L.id, ledger: L.ledger, text: L.text.slice(0, 200), verdict: L.cls, partial: L.partial || undefined, gap: !enforces || undefined });
      let found = 0;
      const re = /`([^`]+)`/g;
      let m;
      while ((m = re.exec(L.by))) {
        const rel = m[1].replace(/:\d+(?:-\d+)?(?=\s|$|\W)/g, '').split(/[\s,]/)[0].replace(/^\.\//, '');
        if (!/[./]/.test(rel) || /\s/.test(rel)) continue;
        let target = null;
        if (byId.has('test:api:' + rel)) target = 'test:api:' + rel;
        else if (byId.has('file:api:' + rel)) target = 'file:api:' + rel;
        else if (isFile(path.join(A, rel))) target = checkNode(rel);
        else if (isFile(path.join(HOME, rel))) {
          target = 'check:home:' + rel;
          node(target, { kind: 'check', repo: 'home', file: rel });
        }
        if (!target && !rel.includes('/') && base.has(rel) && base.get(rel).length === 1) target = base.get(rel)[0];
        if (!target) continue;
        found++;
        edge(id, target, enforces ? 'enforced-by' : 'mentions');
      }
      node(id, { checksFound: found });
    }
  }
}

module.exports = { feed, parseLessons };
