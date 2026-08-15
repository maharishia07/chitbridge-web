#!/usr/bin/env node
'use strict';
/**
 * guard-static.cjs — the checks a parser will never make for you.
 *
 * Athi, 2026-08-15: *"go one by one, check industry standard and provide a best outcome."*
 *
 * Every defect below cost real time today and EVERY ONE OF THEM PASSED `node -c`. That is the point of this file:
 * syntax checking proves a file parses, not that it means what it says.
 *
 *   1. DUPLICATE OBJECT KEYS — `EP` declared `restore` and `entitySearch` twice. An object literal silently keeps
 *      the last, so one definition never existed at runtime. Same class as the `MSG` collision that made a
 *      finished screen render as "on the build roadmap".
 *   2. GLOBAL COLLISIONS ACROSS FILES — a `var X` in a cap-*.js that app.html already declares as `const X`
 *      throws at load; the script tag still fires onload, CAP_LOADED says true, and the screen falls through to
 *      a stub with nothing anywhere saying why.
 *   3. A `.btn` INSIDE A FLEX ROW — global CSS sets `.btn { width:100% }`, which swallows the row and squeezes
 *      the field beside it to nothing. Found three times by eye before it was found by cause.
 *   4. TEXT BELOW 11px — the legibility floor.
 *
 * Run:  node e2e/guard-static.cjs        (exit 1 on any hard failure)
 */
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'public');
const APP = path.join(WEB, 'app.html');
const CAPS = fs.readdirSync(path.join(WEB, 'app')).filter((f) => f.endsWith('.js'));

let hard = 0, soft = 0;
const fail = (m) => { hard++; console.log('  ✗ ' + m); };
const warn = (m) => { soft++; console.log('  ⚠ ' + m); };
const pass = (m) => console.log('  ✓ ' + m);

const app = fs.readFileSync(APP, 'utf8');

// ── 1 · duplicate keys in EP ─────────────────────────────────────────────────────────────────────────────────
console.log('\n1 · duplicate EP keys');
{
  const m = app.match(/const EP = \{[\s\S]*?\n\};/);
  const keys = m ? [...m[0].matchAll(/^\s{2}([A-Za-z_][\w]*)\s*:/gm)].map((x) => x[1]) : [];
  const seen = {}, dup = [];
  keys.forEach((k) => { if (seen[k]) dup.push(k); seen[k] = 1; });
  if (dup.length) fail('EP declares these twice — the later silently wins: ' + [...new Set(dup)].join(', '));
  else pass(keys.length + ' EP keys, all unique');
}

// ── 2 · global collisions between app.html and any cap-*.js ─────────────────────────────────────────────────
console.log('\n2 · global name collisions');
{
  const declOf = (src) => new Set([...src.matchAll(/^(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/gm)].map((x) => x[1]));
  const appDecl = declOf(app);
  let clashes = 0;
  CAPS.forEach((f) => {
    const src = fs.readFileSync(path.join(WEB, 'app', f), 'utf8');
    [...declOf(src)].forEach((n) => {
      /* ⚠️ Only a TOP-LEVEL redeclaration throws, and only for const/let. A `function` or `var` reassignment is
         legal-but-suspicious, so it warns rather than fails. */
      const asConst = new RegExp('^(?:const|let)\\s+' + n + '\\b', 'm');
      if (appDecl.has(n)) {
        if (asConst.test(app) || asConst.test(src)) { fail(f + ' declares `' + n + '`, which app.html also declares — this throws at load'); clashes++; }
        else { warn(f + ' redeclares `' + n + '` from app.html (legal, but one of them is dead)'); clashes++; }
      }
    });
  });
  if (!clashes) pass('no cap-*.js global collides with app.html');
}

// ── 3 · .btn inside a flex row without the width override ───────────────────────────────────────────────────
console.log('\n3 · .btn in a flex row');
{
  let found = 0;
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      src.split('\n').forEach((line, i) => {
        if (!/class=\\?"btn/.test(line)) return;
        if (/width:\s*auto/.test(line)) return;                       // overridden — fine
        if (!/flex|display:\s*flex/.test(line) && !/wlBtn|cbAttachButton/.test(line)) return;
        found++; warn(name + ':' + (i + 1) + ' — .btn in a flex context without width:auto (it will eat the row)');
      });
    });
  if (!found) pass('no unguarded .btn inside a flex row');
}

// ── 4 · text below the legibility floor ─────────────────────────────────────────────────────────────────────
console.log('\n4 · font-size floor (11px)');
{
  const tiny = {};
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      const hits = [...src.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].filter((m) => parseFloat(m[1]) < 11);
      if (hits.length) tiny[name] = hits.length;
    });
  const total = Object.values(tiny).reduce((a, b) => a + b, 0);
  /* ⚠️ A WARNING, NOT A FAILURE, and deliberately so: there are hundreds today. Failing the build on a number
     nobody can fix in one sitting turns the guard into something people disable. It reports and it does not
     grow — tighten this to a hard fail once the count is down. */
  if (total) warn(total + ' inline font-sizes below 11px — ' + Object.entries(tiny).map(([k, v]) => k + ':' + v).join(', '));
  else pass('nothing below 11px');
}

console.log('\n== GUARD ==  ' + hard + ' failure(s) · ' + soft + ' warning(s)');
process.exit(hard ? 1 : 0);
