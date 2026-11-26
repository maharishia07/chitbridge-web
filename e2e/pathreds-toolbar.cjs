/* pathreds-toolbar.cjs — W4-18: a list toolbar button (Expand all, Columns +1, CSV) never shrinks below its own content: it keeps its size and the toolbar wraps, so no icon is cut at an edge.
 * Static check on the shared list unit; the live proof is the auditor path's A1 at 1366 (overlay run on sit-grund, wt-next/BATCH-1130.md). */
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'list-ctl-css.js'), 'utf8');
const rule = (css.match(/.cbl .cbl-tbtn{[^}]*}/) || [''])[0];
const ok = /flex:0 0 auto/.test(rule);
console.log((ok ? '  ok  ' : '  FAIL ') + 'the toolbar button does not shrink (' + rule.slice(0, 60) + ')');
process.exit(ok ? 0 : 1);
