#!/usr/bin/env node
/**
 * e2e/helper-scope.cjs — a LOCAL helper used where it is not defined is a ReferenceError at RENDER time, not at parse.
 *
 * ⚠️ WHY. `grey()` and `none()` are locals of prodOutcomeHTML; ptabWrap has its own `grey()`. On 2026-09-04 the new
 * Lifecycle/History tabs called `grey(...)` at top level of their own functions — parse clean, boot clean — and the
 * product detail pane threw on the first product opened, on production, in front of Athi. The parse check cannot
 * see it; this can: for every top-level `function name(...)` in app.html, if its body calls one of the KNOWN LOCAL
 * helpers and neither defines it nor is one of the functions that own it, fail.
 *
 *   node e2e/helper-scope.cjs          → exit 1 on any finding
 */
const fs = require('fs'); const path = require('path');
const APP = path.join(__dirname, '..', 'public', 'app.html');
const s = fs.readFileSync(APP, 'utf8');
const LOCAL = ['grey', 'none', 'kv', 'row', 'code', 'sw', 'M'];   // helpers that exist only inside some functions
const GLOBAL = new Set();                                          // names that ARE defined at top level
const fnRe = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm; let m;
const starts = [];
while ((m = fnRe.exec(s))) { GLOBAL.add(m[1]); starts.push({ name: m[1], at: m.index }); }
const constRe = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm; while ((m = constRe.exec(s))) GLOBAL.add(m[1]);
let bad = 0;
for (let i = 0; i < starts.length; i++) {
  const raw = s.slice(starts[i].at, i + 1 < starts.length ? starts[i + 1].at : s.length);
  /* a parameter IS a definition; text inside plain string literals is not code */
  const params = (raw.match(/^[^(]*(([^)]*))/) || ['', ''])[1];
  const body = raw.replace(/'(?:[^'\
]|\.)*'|"(?:[^"\
]|\.)*"/g, '""');
  for (const h of LOCAL) {
    if (GLOBAL.has(h)) continue;                                   // a real global — nothing to check
    const uses = new RegExp('[^\\w$.\'"`]' + h + '\\(', 'g');
    const defines = new RegExp('(?:const|let|var|function)\\s+' + h + '\\b|\\b' + h + '\\s*=\\s*(?:function|\\()');
    const n = (body.match(uses) || []).length;
    const isParam = new RegExp('(?:^|[,\s])' + h + '(?:[,\s=]|$)').test(params);
    if (n && !defines.test(body) && !isParam) { bad++; console.log(`  ✗ ${starts[i].name}() calls ${h}() ${n}× but does not define it`); }
  }
}
console.log(bad ? `helper-scope: ${bad} finding(s)` : 'helper-scope: clean');
process.exit(bad ? 1 : 0);
