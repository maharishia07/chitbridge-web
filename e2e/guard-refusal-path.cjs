'use strict';
/* B7 (ERR-13) guard: counts the screens (files under public/) that still say a GENERIC refusal in their own words instead of the one path
   (core.js api() error -> scrErr card / toast with detail + hint). The shared files that OWN the path are exempt. The count may only fall.
   Run: node e2e/guard-refusal-path.cjs [--count]   exit 1 when the count rises above e2e/refusal-path.baseline.json */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'public');
const SHARED = new Set(['app/core.js', 'app/helpers.js', 'app/ui.js', 'app/accounts-shell.js', 'app.html']);
const GENERIC = /Something went wrong|Server error — please try again|Server error, try again|did not load|Could not load/i;
/* WHAT THIS DOES NOT COUNT (each is not a screen telling a shopkeeper about a refused or failed reply):
   - comments (a line that is only a comment, or a // tail): they are notes, never shown;
   - strings-*.js: translation keys, the catalogue's own entries;
   - a line that is not a string literal holding the phrase;
   - an asset / engine / register / library that "did not load" (dev pages, labs, the till's engine checks: a missing file, not a refused reply, and they name the file);
   - the dev showcase pages (*-lab.html, illustrations/, screen-gallery.html): not a shopkeeper screen;
   - app/list-ctl.js: the shared list's own four states (its words are the one component's, themed per list);
   - a literal with no failure path near it (no catch / onFail / error / fail / refus / reject / !ok / === null in the 8 lines before it). */
const IGNORE_FILE = /^app\/strings-[a-z]+\.js$|^app\/list-ctl\.js$|-lab(-next)?\.html$|^illustrations\/|^screen-gallery\.html$/;
const ASSET = /\b(engine|engines|asset|register|manifest|library|faces|parts|app list|roadmap|screens?\.js|shell-facts|\.js|\.json|category names|currency)\b[^'"`]{0,30}did not load|did not load (the|its) (returns|expenses)|did not load\.? ?(Every|so there|so this|reload)|did not load, so/i;
const FAILURE_NEAR = /catch|onFail|error|fail|refus|reject|!\s*r\.ok|\.ok\)|state\s*===?\s*'failed'|===\s*null/i;
function stripComment(line) {
  const trimmed = line.trim();
  if (/^(\/\/|\/\*|\*|<!--)/.test(trimmed)) return '';
  return line.replace(/\s\/\/ .*$/, '').replace(/\/\*.*?\*\//g, '');
}
/** the lines of one file that are a failure-path string literal carrying a generic refusal phrase */
function hitsIn(text) {
  const lines = text.split('\n');
  return lines.filter((raw, i) => {
    const line = stripComment(raw);
    if (!GENERIC.test(line) || ASSET.test(line)) return false;
    if (!/['"`].*(Something went wrong|Server error|did not load|Could not load)/i.test(line)) return false; /* the phrase sits after an opening quote: a string literal */
    return FAILURE_NEAR.test(lines.slice(Math.max(0, i - 8), i + 1).join('\n'));
  });
}
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
    if (SHARED.has(rel) || IGNORE_FILE.test(rel)) continue;
    if (hitsIn(fs.readFileSync(p, 'utf8')).length) hits.push(rel);
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
