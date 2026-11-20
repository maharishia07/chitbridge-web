'use strict';
/* B7 (ERR-13) guard: counts the screens (files under public/) that still say a GENERIC refusal in their own words instead of the one path
   (core.js api() error -> scrErr card / toast with detail + hint). The shared files that OWN the path are exempt. The count may only fall.
   Run: node e2e/guard-refusal-path.cjs [--count]   exit 1 when the count rises above e2e/refusal-path.baseline.json */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'public');
const SHARED = new Set(['app/core.js', 'app/helpers.js', 'app/ui.js', 'app/accounts-shell.js', 'app.html']);
const GENERIC = /Something went wrong|Server error — please try again|Server error, try again|did not load|Could not load/i;
function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!/^(vendor|fonts|engine|pics|docs|data|cmdb)$/.test(f.name)) walk(p, out); }
    else if (/\.(js|html)$/.test(f.name)) out.push(p);
  }
  return out;
}
function count() {
  const hits = [];
  for (const p of walk(root, [])) {
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (SHARED.has(rel)) continue;
    if (GENERIC.test(fs.readFileSync(p, 'utf8'))) hits.push(rel);
  }
  return hits;
}
if (require.main === module) {
  const hits = count();
  const basePath = path.join(__dirname, 'refusal-path.baseline.json');
  console.log('screens still using generic refusal text: ' + hits.length);
  if (process.argv.includes('--count')) process.exit(0);
  const base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')).count : hits.length;
  if (hits.length > base) { console.log('FAIL: above baseline ' + base); process.exit(1); }
  console.log('ok (baseline ' + base + ')');
}
module.exports = { count };
