/**
 * dup-functions.cjs — two top-level functions with one name is a feature deleted in silence.
 *
 * ⚠️⚠️ WHY THIS EXISTS. On 2026-09-02 the ERP and Tax panels arrived carrying their own `catsetFaceLoad`, while
 * the Variants panel had used one of that name since long before. Function declarations HOIST, so the second
 * definition won and the first vanished — its variable was never assigned, and the Variants renderer's
 *
 *     if (CATSET_FACE === undefined) { catsetFaceLoad().then(catsetPaintDetail); … }
 *
 * re-entered on every paint: load → repaint → still undefined → load. **An infinite repaint loop — a frozen
 * tab**, reported by Athi as *"declare variants chip, when clicked page become unresponsive."*
 *
 * ⭐⭐ AND NOTHING COULD HAVE CAUGHT IT. A duplicate top-level function is legal JavaScript. `node --check`
 * passes. html-syntax, guard-static, token-check, theme-literals and the panel-render guard all passed — the
 * panel rendered fine, it just never stopped rendering. The only symptom is a screen that stops answering, and
 * the only reliable moment to notice is before it ships.
 *
 * ⚠️ IT IS ALSO A STANDING RULE ALREADY BROKEN. "No duplicate functions" is written down; what was missing was
 * anything that ENFORCES it. A rule nobody can accidentally comply with is a rule that gets broken by the
 * person who wrote it — which is what happened here.
 *
 * ⚠️ SCOPE: top-level declarations only. A nested helper of the same name in two functions is ordinary and
 * harmless; two at file scope in the SAME loaded file, or across files that share the global scope, is the
 * hazard — every one of these is loaded into one window.
 *
 * Run: node e2e/dup-functions.cjs        (exit 1 on any duplicate)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'public');
const FILES = ['app.html'].concat(
  fs.readdirSync(path.join(WEB, 'app')).filter((f) => f.endsWith('.js')).map((f) => 'app/' + f)
);

/**
 * ⚠️ COLUMN ZERO IS THE WHOLE TEST. An indented `function foo(){}` is nested inside something and is scoped to
 * it; one at the start of a line is global to the window every one of these files shares. Matching both would
 * report every local helper in the codebase and the report would be ignored, which is worse than no report.
 */
const DECL = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;

const seen = new Map();          // name → [{file, line}]
for (const rel of FILES) {
  const lines = fs.readFileSync(path.join(WEB, rel), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = DECL.exec(lines[i]);
    if (!m) continue;
    const at = seen.get(m[1]) || [];
    at.push({ file: rel, line: i + 1 });
    seen.set(m[1], at);
  }
}

const dupes = [...seen.entries()].filter(([, at]) => at.length > 1);

console.log('\n══ DUPLICATE FUNCTIONS ══');
console.log('  ' + seen.size + ' top-level function(s) across ' + FILES.length + ' file(s)\n');
for (const [name, at] of dupes) {
  console.log('  ✗ ' + name + '  declared ' + at.length + ' times');
  at.forEach((a) => console.log('      ' + a.file + ':' + a.line));
  console.log('      the LAST one wins — every earlier definition is silently discarded\n');
}
if (!dupes.length) console.log('  ✓ every top-level function is declared once\n');
process.exit(dupes.length ? 1 : 0);
