#!/usr/bin/env node
/* tools/readability.cjs — READ-1 baseline: how human-readable is our own code? (2026-10-15, read-only)
 *
 * OWNS    six counts per repo over OWN code (R1 cryptic names · R2 uncommented functions · R3 long/deep functions ·
 *         R4 module headers · R5 comment quality · R6 repeated magic values). Reads files, writes nothing but its report.
 * CALLED  by hand: `node tools/readability.cjs --roots web=.,api=../chitbridge-api,engines=../chitbridge-engines [--json out.json] [--detail <repo> R2|R3|R4]`
 *         Needs `acorn` (NOT a dependency of this repo): found via NODE_PATH, ./node_modules, or `npm i acorn` in a temp dir.
 * FLOW    collect files (scope rule below) → parse each JS file / each inline <script> of an HTML page with acorn →
 *         one walk per file collects functions, declarations, comments, literals → aggregate per repo → print.
 *
 *   files ──▶ parse(acorn) ──▶ walk ──▶ per-file facts ──▶ per-repo metrics ──▶ text / --md / --json
 *
 * SCOPE (same rule as MAINT-1): own code only. Excluded: files whose head says "ADOPTED from" (vendored engine copies),
 * public/till.html (vendored from the api master), qr.js, any vendor/ folder, *.min.*, node_modules, tests, e2e, fixtures.
 * The api's tools/tally-connector/till.html is the MASTER, so it counts there.
 * Static only: a name is "used" when an Identifier of that spelling appears in the same file (scope-blind; says so in the report).
 */
'use strict';
const fs = require('fs'), path = require('path');

function loadAcorn() {
  const tries = [() => require('acorn'), () => require(path.join(process.cwd(), 'node_modules', 'acorn')),
    () => require(path.join(__dirname, '..', 'e2e', 'node_modules', 'acorn')), () => require('/tmp/acorn/node_modules/acorn')];
  for (const t of tries) { try { return t(); } catch (_) { /* try the next place */ } }
  console.error('acorn not found — run: mkdir /tmp/acorn && cd /tmp/acorn && npm i acorn  (then NODE_PATH=/tmp/acorn/node_modules)');
  process.exit(2);
}
const acorn = loadAcorn();

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const ROOTS = {};
String(flag('roots', 'web=.,api=../chitbridge-api,engines=../chitbridge-engines')).split(',').forEach(p => { const [k, v] = p.split('='); ROOTS[k] = path.resolve(v); });
const TOP = +flag('top', 30);

// where own code lives, per repo (folders or single files, relative to the root)
const SCOPE = {
  web: ['public', 'scripts', 'tools'],
  api: ['lib', 'routes', 'middleware', 'src', 'scripts', 'tools', 'server.js', 'public'],
  engines: ['src', 'tools', 'index.js']
};
const SKIP_DIR = /^(node_modules|vendor|\.git|tests?|e2e|fixture|fixtures|out|dist|docs|migrations|seed|data)$/;
const SKIP_FILE = /(\.min\.|^qr\.js$)/;

function walkDir(dir, out) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walkDir(p, out); }
    else if (/\.(js|cjs|mjs|html)$/.test(e.name) && !SKIP_FILE.test(e.name)) out.push(p);
  }
}
function collect(repo) {
  const root = ROOTS[repo], out = [], skipped = { adopted: 0, vendoredTill: 0 };
  for (const s of SCOPE[repo]) {
    const p = path.join(root, s);
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) walkDir(p, out); else out.push(p);
  }
  const keep = [];
  for (const f of out) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (repo === 'web' && rel === 'public/till.html') { skipped.vendoredTill++; continue; }
    const head = fs.readFileSync(f, 'utf8').slice(0, 700);
    if (/ADOPTED from chitbridge-engines/.test(head)) { skipped.adopted++; continue; }
    keep.push({ abs: f, rel });
  }
  return { files: keep, skipped };
}

// ── parse: a JS file is one chunk; an HTML page is one chunk per inline <script> (padded so line numbers are the page's)
function chunks(file) {
  const src = fs.readFileSync(file.abs, 'utf8');
  if (!/\.html$/.test(file.rel)) return [{ code: src, lineOff: 0 }];
  const res = [], re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(src))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const t = /type\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
    if (t && !/javascript|module/i.test(t[1])) continue;
    const start = m.index + m[0].indexOf('>') + 1;
    res.push({ code: m[2], lineOff: src.slice(0, start).split('\n').length - 1 });
  }
  return res;
}
function parse(code, comments) {
  const o = { ecmaVersion: 'latest', locations: true, allowReturnOutsideFunction: true, allowHashBang: true, onComment: comments };
  try { return acorn.parse(code, Object.assign({ sourceType: 'script' }, o)); }
  catch (e1) { comments.length = 0; try { return acorn.parse(code, Object.assign({ sourceType: 'module' }, o)); } catch (_) { throw e1; } }
}

// ── per-file walk
const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const NEST = new Set(['IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'SwitchStatement', 'TryStatement']);
const TRIVIAL_NUM = new Set([100, 1000]);   // and every |n| <= 10 (indexes, small limits)
const TRIVIAL_STR = /^(function|object|string|number|boolean|undefined|click|change|input|none|block|flex|GET|POST|PUT|DELETE|utf8|utf-8|use strict|default|submit|keydown|keyup|error|true|false|null|px|auto|hidden|text|value|class|style|id|div|span|button|checkbox|Content-Type|application\/json|Authorization|Bearer )$/;

function idsOfPattern(p, out) {
  if (!p) return;
  if (p.type === 'Identifier') out.push(p);
  else if (p.type === 'ObjectPattern') p.properties.forEach(q => idsOfPattern(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach(q => idsOfPattern(q, out));
  else if (p.type === 'AssignmentPattern') idsOfPattern(p.left, out);
  else if (p.type === 'RestElement') idsOfPattern(p.argument, out);
}

function analyse(file, facts) {
  const rel = file.rel;
  let first = true;
  for (const ch of chunks(file)) {
    const comments = [];
    let ast;
    try { ast = parse(ch.code, comments); } catch (e) { facts.parseFail.push({ file: rel, err: String(e.message).slice(0, 80) }); continue; }
    const L = n => n.loc.start.line + ch.lineOff, E = n => n.loc.end.line + ch.lineOff;
    const lines = ch.code.split('\n');
    const decls = [];                      // {name, line, kind}
    const idUse = Object.create(null);     // name → count of Identifier nodes in this file chunk
    const fns = [];
    const lits = [];                       // {kind:'num'|'str', v, line}
    const commentEndLines = new Map();     // end line → comment
    comments.forEach(c => commentEndLines.set(c.loc.end.line, c));

    // ancestors stack to find statement start for a function value
    const stack = [];
    function visit(node, fnCtx, depth, forInit) {
      if (!node || typeof node.type !== 'string') return;
      const parent = stack[stack.length - 1];
      stack.push(node);
      let ctx = fnCtx, d = depth;
      const isProp = parent && ((parent.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
        ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed && !parent.shorthand));
      if (node.type === 'Identifier' && !isProp) idUse[node.name] = (idUse[node.name] || 0) + 1;
      if (FN.has(node.type)) {
        // name of the function and the statement start the comment should sit above
        let name = node.id ? node.id.name : null, stmt = node;
        if (!name && parent) {
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') name = parent.id.name;
          else if (parent.type === 'AssignmentExpression') name = parent.left.type === 'Identifier' ? parent.left.name : (parent.left.type === 'MemberExpression' && parent.left.property.name) || null;
          else if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key) name = parent.key.name || parent.key.value || null;
        }
        // climb to the enclosing statement / property so `var f = function` and `a.b = function` look above the statement
        for (let i = stack.length - 2; i >= 0; i--) {
          const a = stack[i];
          if (/Statement$|Declaration$/.test(a.type) || a.type === 'Property' || a.type === 'MethodDefinition' || a.type === 'PropertyDefinition') { stmt = a; break; }
          if (FN.has(a.type) || a.type === 'CallExpression' || a.type === 'ArrayExpression') { stmt = node; break; }
        }
        if (stmt.type === 'VariableDeclaration' || stmt.type === 'ExportNamedDeclaration') { /* ok */ }
        const startLine = L(stmt), lineN = E(node) - L(node) + 1;
        // comment directly above: ends on the line before (or the same line trailing is NOT counted)
        const above = commentEndLines.get(stmt.loc.start.line - 1);
        const wrapper = node.type !== 'FunctionDeclaration' && parent && ((parent.type === 'CallExpression' && parent.callee === node) ||
          (parent.type === 'MemberExpression' && parent.object === node)) && stack.length <= 6 && (E(node) - L(node)) > 150;
        const f = { wrapper, name, anon: !name, line: L(node), len: lineN, hasAbove: !!above, depth: 0, file: rel, stmtLine: startLine };
        fns.push(f);
        ctx = f; d = 0;
        node.params.forEach(p => { const o = []; idsOfPattern(p, o); o.forEach(i => decls.push({ name: i.name, line: L(i), kind: 'param' })); });
        if (node.id && node.type === 'FunctionDeclaration') decls.push({ name: node.id.name, line: L(node.id), kind: 'function' });
        else if (name && parent && parent.type === 'VariableDeclarator') { /* declared as var below */ }
      } else if (NEST.has(node.type) && ctx) {
        // `else if` is not a deeper level
        const elseIf = node.type === 'IfStatement' && parent && parent.type === 'IfStatement' && parent.alternate === node;
        if (!elseIf) { d = depth + 1; if (d > ctx.depth) ctx.depth = d; }
      }
      if (node.type === 'VariableDeclarator') {
        const o = []; idsOfPattern(node.id, o);
        const inFor = parent && parent.type === 'VariableDeclaration' && stack[stack.length - 3] && /^For(In|Of)?Statement$/.test(stack[stack.length - 3].type) && stack[stack.length - 3].init === parent || (parent && stack[stack.length - 3] && /^For(In|Of)Statement$/.test(stack[stack.length - 3].type) && stack[stack.length - 3].left === parent);
        o.forEach(i => decls.push({ name: i.name, line: L(i), kind: inFor ? 'forvar' : 'var', init: node.init ? ch.code.slice(node.init.start, Math.min(node.init.end, node.init.start + 60)).replace(/\s+/g, ' ') : '' }));
      }
      if (node.type === 'CatchClause' && node.param) { const o = []; idsOfPattern(node.param, o); o.forEach(i => decls.push({ name: i.name, line: L(i), kind: 'catch' })); }
      if (node.type === 'ClassDeclaration' && node.id) decls.push({ name: node.id.name, line: L(node.id), kind: 'class' });
      // literals (R6) — skip require args, property keys, import paths, template parts
      if (node.type === 'Literal') {
        const inRequire = parent && parent.type === 'CallExpression' && parent.callee && parent.callee.name === 'require';
        const isKey = parent && (parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed;
        const isImport = parent && /^(Import|Export)/.test(parent.type);
        const isCase = parent && parent.type === 'SwitchCase';
        if (!inRequire && !isKey && !isImport) {
          if (typeof node.value === 'number') { if (Math.abs(node.value) > 10 && !TRIVIAL_NUM.has(node.value) && !isCase) lits.push({ kind: 'num', v: String(node.value), line: L(node) }); }
          else if (typeof node.value === 'string' && node.value.length >= 4 && !/[<>{}]/.test(node.value) && !/\s{2,}/.test(node.value) && !TRIVIAL_STR.test(node.value) && !/^\d{4}-\d{2}-\d{2}/.test(node.value) && !/^\.{0,2}\//.test(node.value)) lits.push({ kind: 'str', v: node.value, line: L(node) });
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
        const v = node[k];
        if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && visit(c, ctx, d));
        else if (v && typeof v.type === 'string') visit(v, ctx, d);
      }
      stack.pop();
    }
    visit(ast, null, 0);

    // ── gather into facts
    for (const dcl of decls) {
      if (dcl.kind === 'catch' || dcl.kind === 'forvar') continue;
      const n = dcl.name;
      if (n.length > 3 || n.length < 1) continue;
      if (n === '_' || n === '$' || n === 'e' || n === 'err') continue;
      if (/^(x|y)$/.test(n)) continue;                       // geometry (not told apart from other x/y — said in the doc)
      const key = n;
      const r = facts.names[key] || (facts.names[key] = { decl: 0, uses: 0, files: new Set(), kinds: {}, inits: [], first: null });
      r.decl++; r.kinds[dcl.kind] = (r.kinds[dcl.kind] || 0) + 1; r.files.add(rel);
      if (!r.first) r.first = rel + ':' + dcl.line;
      if (dcl.init && r.inits.length < 3) r.inits.push(dcl.init);
    }
    // loop counters i,j,k declared in a for header are excluded above; a stray `var i` outside a for header still counts
        const seen = new Set(decls.map(d => d.name));
    for (const n of seen) if (facts.names[n]) facts.names[n].uses += (idUse[n] || 0);
    for (const f of fns) facts.fns.push(f);
    for (const c of comments) { c.file = rel; }
    // R5 — comment lines and blocks
    const blocks = [];
    let cur = null;
    for (const c of comments) {
      const sl = c.loc.start.line, el = c.loc.end.line;
      const text = c.value;
      const prose = text.split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).filter(Boolean);
      const own = lines[sl - 1].slice(0, c.loc.start.column).trim() === '';   // a trailing `code; // note` never joins a block
      if (!own) { cur = null; blocks.push({ type: c.type, start: sl + ch.lineOff, end: el, lines: prose }); continue; }
      if (c.type === 'Line' && cur && cur.type === 'Line' && cur.end === sl - 1) { cur.end = el; cur.lines.push(...prose); }
      else { cur = { type: c.type, start: sl + ch.lineOff, end: el, lines: prose }; if (c.type === 'Line') cur.end = el; blocks.push(cur); }
      if (c.type === 'Line') cur.end = el;
    }
    for (const b of blocks) {
      const n = b.lines.length, story = /[⭐⚠]/.test(b.lines.join(' '));
      const codeish = n > 0 && b.lines.filter(s => /[;{}]\s*$|^\s*(var|let|const|if|for|return)\b/.test(s)).length >= Math.max(1, Math.ceil(n * 0.6));
      facts.cm.lines += n; facts.cm.blocks++; if (story) facts.cm.story += n;
      if (codeish) facts.cm.code += n;
      else if (n > 3 || story) { facts.cm.narrative += n; facts.cm.narBlocks++; facts.cm.longest.push({ file: rel, line: b.start, n, story }); }
      else facts.cm.short += n;
    }
    // R4 header: the comment that opens the file (first chunk only); for HTML the first comment of the first script or a top <!-- -->
    if (first) {
      first = false;
      let hdr = '';
      const firstCode = ast.body.length ? ast.body[0].loc.start.line : Infinity;
      const lead = comments.filter(c => c.loc.start.line <= Math.min(firstCode, 80)).slice(0, 12);
      hdr = lead.map(c => c.value).join('\n');
      if (/\.html$/.test(rel)) { const m = /<!--([\s\S]*?)-->/.exec(fs.readFileSync(file.abs, 'utf8').slice(0, 6000)); if (m) hdr = m[1] + '\n' + hdr; }
      const h = {
        file: rel, has: hdr.trim().length > 0, lines: hdr.split('\n').length,
        owns: /\b(owns?|ownership|what it does|purpose|responsib|one place for)\b/i.test(hdr),
        callers: /(called (by|from)|callers?\b|used (by|from)|consumed by|who calls|required by|loaded by|imported by)/i.test(hdr),
        flow: /(\bflow\b|initiali[sz]|init order|load order|startup|sequence|mermaid|──>|-->|──▶|─▶|→)/i.test(hdr),
        loc: ast.body.length ? ast.body[ast.body.length - 1].loc.end.line : 0
      };
      facts.headers.push(h);
    }
    for (const l of lits) { const k = l.kind + ':' + l.v; (facts.lits[k] || (facts.lits[k] = [])).push(rel + ':' + l.line); }
  }
}

// ── aggregate
function newFacts() { return { names: {}, fns: [], headers: [], cm: { lines: 0, blocks: 0, short: 0, narrative: 0, narBlocks: 0, code: 0, story: 0, longest: [] }, lits: {}, parseFail: [] }; }
const CONV = new Set(['id','req','res','key','out','ok','el','fn','cb','db','url','app','ctx','msg','str','num','obj','arr','len','idx','min','max','sum','tmp','ids','map','set','row','opt','ref','pos','div','tag','dir','buf','env','arg','now','div','all','any','row','sql','log','rec','res','err','ts','uid','pid','ms','tr','td','th','ul','li','btn','bar','box','cfg','doc','win','url','api','pg','no','yes','on','is','to','by','of','at','in','or','and','not','new','old','top','end','row','col']);
const NAME_HINT = {};   // proposals live in the report doc (hand-written from the top-30 with their initialisers); kept out of the counter

function metrics(repo) {
  const { files, skipped } = collect(repo), facts = newFacts();
  for (const f of files) analyse(f, facts);
  const wrappers = facts.fns.filter(f => f.wrapper).length;
  const fnsAll = facts.fns.filter(f => !f.wrapper);
  const named = fnsAll.filter(f => !f.anon);
  const r2 = named.filter(f => f.len > 10 && !f.hasAbove);
  const r2base = named.filter(f => f.len > 10);
  const r3a = fnsAll.filter(f => f.len > 40), r3b = fnsAll.filter(f => f.len > 80), r3d = fnsAll.filter(f => f.depth > 4);
  const hs = facts.headers;
  const namesAll = Object.entries(facts.names).map(([n, r]) => ({ name: n, decl: r.decl, uses: r.uses, files: r.files.size, kinds: r.kinds, first: r.first, inits: r.inits })).sort((a, b) => b.uses - a.uses);
  const names = namesAll.filter(r => !CONV.has(r.name) && !CONV.has(r.name.toLowerCase()));
  const litRows = Object.entries(facts.lits).filter(([, v]) => v.length > 2 && new Set(v).size > 2).map(([k, v]) => ({ k, n: v.length, at: v.slice(0, 3) })).sort((a, b) => b.n - a.n);
  const fmt = f => `${f.file}:${f.line} ${f.name || '(anon)'} ${f.len}L${f.depth > 4 ? ' depth' + f.depth : ''}`;
  const top = (arr, key, n) => arr.slice().sort((a, b) => b[key] - a[key]).slice(0, n || 10).map(fmt);
  const cm = facts.cm;
  return {
    repo, files: files.length, module_wrappers_excluded: wrappers, skipped, parseFail: facts.parseFail, functions: fnsAll.length, namedFunctions: named.length,
    R1: { cryptic_declarations: names.reduce((s, r) => s + r.decl, 0), distinct: names.length, incl_conventional_declarations: namesAll.reduce((s, r) => s + r.decl, 0), conventional_dropped: Array.from(new Set(namesAll.filter(r => CONV.has(r.name) || CONV.has(r.name.toLowerCase())).map(r => r.name))).join(' '), top: names.slice(0, TOP) },
    R2: { named_over_10: r2base.length, without_comment: r2.length, share: r2base.length ? +(r2.length / r2base.length * 100).toFixed(1) : 0, worst: r2.sort((a, b) => b.len - a.len).slice(0, 10).map(fmt) },
    R3: { over_40: r3a.length, over_80: r3b.length, depth_over_4: r3d.length, longest: top(fnsAll, 'len', 10), deepest: top(fnsAll, 'depth', 10) },
    R4: { files: hs.length, no_header: hs.filter(h => !h.has).length, owns: hs.filter(h => h.owns).length, callers: hs.filter(h => h.callers).length, flow: hs.filter(h => h.flow).length, all_three: hs.filter(h => h.owns && h.callers && h.flow).length,
      biggest_without: hs.filter(h => !(h.owns && h.callers && h.flow)).sort((a, b) => b.loc - a.loc).slice(0, 12).map(h => h.file + ' (' + h.loc + ' lines' + (h.has ? '' : ', NO header') + ')'), noHeaderFiles: hs.filter(h => !h.has).map(h => h.file) },
    R5: { comment_lines: cm.lines, short: cm.short, narrative: cm.narrative, commented_out_code: cm.code, narrative_share: cm.lines ? +(cm.narrative / cm.lines * 100).toFixed(1) : 0, narrative_blocks: cm.narBlocks, story_lines: cm.story, longest: cm.longest.sort((a, b) => b.n - a.n).slice(0, 8).map(l => `${l.file}:${l.line} ${l.n} lines${l.story ? ' ⭐/⚠️' : ''}`) },
    R6: { repeated_values: litRows.length, numbers: litRows.filter(r => r.k.startsWith('num:')).length, strings: litRows.filter(r => r.k.startsWith('str:')).length, top: litRows.slice(0, 25) },
    _headers: hs, _fns: fnsAll
  };
}

const out = {};
for (const repo of Object.keys(ROOTS)) { if (!fs.existsSync(ROOTS[repo])) { console.error('skip ' + repo + ' (no dir ' + ROOTS[repo] + ')'); continue; } out[repo] = metrics(repo); }

const json = flag('json');
if (json && json !== true) {
  const slim = JSON.parse(JSON.stringify(out, (k, v) => (k === '_headers' || k === '_fns') ? undefined : v));
  fs.writeFileSync(json, JSON.stringify(slim, null, 1));
}
if (flag('detail')) {      // --detail <repo>: every offender file:line for a metric, for the doc's top lists
  const r = out[flag('detail')];
  const metric = args[args.indexOf('--detail') + 2] || 'R3';
  const rows = metric === 'R2' ? r._fns.filter(f => !f.anon && f.len > 10 && !f.hasAbove) : metric === 'R4' ? r._headers.filter(h => !(h.owns && h.callers && h.flow)) : r._fns.filter(f => f.len > 40);
  rows.forEach(f => console.log(f.file + (f.line ? ':' + f.line : '') + ' ' + (f.name || '') + ' ' + (f.len || '')));
  process.exit(0);
}
for (const [repo, m] of Object.entries(out)) {
  console.log(`\n== ${repo} · ${m.files} files (${m.skipped.adopted} adopted + ${m.skipped.vendoredTill} vendored till skipped) · ${m.functions} functions · parse failures ${m.parseFail.length}`);
  console.log(`R1 cryptic names: ${m.R1.cryptic_declarations} declarations · ${m.R1.distinct} distinct (+ conventional [${m.R1.conventional_dropped}] → ${m.R1.incl_conventional_declarations} total)`);
  m.R1.top.slice(0, TOP).forEach(r => console.log(`   ${r.name.padEnd(4)} uses ${String(r.uses).padStart(5)} decl ${String(r.decl).padStart(4)} files ${String(r.files).padStart(3)}  ${JSON.stringify(r.kinds)}  e.g. ${r.first}  = ${(r.inits[0] || '').slice(0, 50)}`));
  console.log(`R2 named fns >10 lines: ${m.R2.named_over_10}, with no comment above: ${m.R2.without_comment} (${m.R2.share}%)`); m.R2.worst.forEach(s => console.log('   ' + s));
  console.log(`R3 >40 lines: ${m.R3.over_40} · >80 lines: ${m.R3.over_80} · nesting >4: ${m.R3.depth_over_4}`); m.R3.longest.forEach(s => console.log('   long ' + s)); m.R3.deepest.forEach(s => console.log('   deep ' + s));
  console.log(`R4 header: ${m.R4.files} files · none ${m.R4.no_header} · owns ${m.R4.owns} · callers ${m.R4.callers} · flow ${m.R4.flow} · all three ${m.R4.all_three}`);
  m.R4.biggest_without.forEach(s => console.log('   ' + s));
  console.log(`R5 comment lines ${m.R5.comment_lines}: short ${m.R5.short} · narrative ${m.R5.narrative} (${m.R5.narrative_share}%) in ${m.R5.narrative_blocks} blocks · commented-out code ${m.R5.commented_out_code}`); m.R5.longest.forEach(s => console.log('   ' + s));
  console.log(`R6 values repeated >2 places: ${m.R6.repeated_values} (numbers ${m.R6.numbers}, strings ${m.R6.strings})`); m.R6.top.slice(0, 15).forEach(r => console.log(`   ${String(r.n).padStart(4)}x ${r.k.slice(0, 50)}  ${r.at.join(' ')}`));
  m.parseFail.slice(0, 8).forEach(p => console.log('   PARSE FAIL ' + p.file + ' ' + p.err));
}
