/**
 * token-check.cjs — every `var(--x)` must resolve to something.
 *
 * ⚠️ AN UNDEFINED TOKEN IS INVISIBLE TEXT, not a wrong colour. `color: var(--nope)` with no fallback makes the
 * declaration invalid, so the property falls back to INHERITED — which on a themed card is very often the same
 * colour as the ground. The text does not go grey; it goes away. And nothing throws, nothing logs, and the
 * contrast tool cannot see it, because it measures tokens that exist.
 *
 * ⚠️ A FALLBACK MAKES IT LEGAL: `var(--maybe, #333)` is fine by design and is how a theme-optional token is
 * meant to be written. So this only reports BARE uses of a token nothing defines.
 *
 * Run: node e2e/token-check.cjs        (exit 1 if any bare use of an undefined token exists)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'public');
const app = fs.readFileSync(path.join(WEB, 'app.html'), 'utf8');
const FILES = ['app.html'].concat(
  fs.readdirSync(path.join(WEB, 'app')).filter((f) => f.endsWith('.js')).map((f) => 'app/' + f)
);

/* Everything :root or a theme defines. ⚠️ Themes are read too — a token that only exists inside one theme is
   still "defined", but it is a different (and reportable) risk: it resolves to nothing in the other fourteen. */
const defined = new Set();
{
  const css = app.slice(0, app.indexOf('</style>'));
  let m; const re = /(--[a-z0-9-]+)\s*:/gi;
  while ((m = re.exec(css))) defined.add(m[1]);
  const at = app.indexOf('var THEMES = {');
  if (at > 0) {
    let d = 0, i = app.indexOf('{', at), e = -1;
    for (; i < app.length; i++) { if (app[i] === '{') d++; else if (app[i] === '}') { d--; if (!d) { e = i + 1; break; } } }
    const themes = app.slice(at, e);
    let mm; const r2 = /'(--[a-z0-9-]+)'\s*:/g;
    while ((mm = r2.exec(themes))) defined.add(mm[1]);
  }
  /* Tokens written at runtime by the appearance module (the --fs scale) count as defined. */
  const fsb = /var FS_BASE = \{([^}]*)\}/.exec(app);
  if (fsb) { let mm; const r3 = /'(--[a-z0-9-]+)'/g; while ((mm = r3.exec(fsb[1]))) defined.add(mm[1]); }
}

/**
 * ⚠️ A TOKEN CAN BE DEFINED SOMEWHERE THIS TOOL DOES NOT LOOK, and my first run reported four false positives
 * for exactly that reason. Three are declared inside stylesheets a capability INJECTS at runtime
 * (`':root{--note:#5a7290}'` as a string in cap-catsetup.js), and one is set on a parent ELEMENT
 * (`style="--coltpl:${colTemplate()}"`) so its children inherit it. Both are correct CSS and neither appears
 * in app.html's <style>.
 *
 * A checker that reports correct code as broken is one people learn to ignore — and then it misses the real
 * one. So every file is scanned for a definition in any position, not just the main stylesheet.
 */
FILES.forEach((f) => {
  const src = fs.readFileSync(path.join(WEB, f), 'utf8');
  let m; const re = /(--[a-z0-9-]+)\s*:/g;
  while ((m = re.exec(src))) {
    /* Skip `var(--x)` itself — the colon there belongs to a fallback, not a definition. */
    const before = src.slice(Math.max(0, m.index - 5), m.index);
    if (/var\(\s*$/.test(before)) continue;
    defined.add(m[1]);
  }
});

const bare = {};      // token -> [file:line]
FILES.forEach((f) => {
  const src = fs.readFileSync(path.join(WEB, f), 'utf8');
  const re = /var\(\s*(--[a-z0-9-]+)\s*([,)])/g;
  let m;
  while ((m = re.exec(src))) {
    const tok = m[1], hasFallback = m[2] === ',';
    if (defined.has(tok) || hasFallback) continue;
    const line = src.slice(0, m.index).split('\n').length;
    (bare[tok] = bare[tok] || []).push(f + ':' + line);
  }
});

const names = Object.keys(bare);
console.log('\n══ TOKEN CHECK ══');
console.log('  ' + defined.size + ' tokens defined · ' + names.length + ' referenced bare and never defined\n');
names.forEach((t) => console.log('  ✗ ' + t.padEnd(24) + bare[t].length + '×   ' + bare[t].slice(0, 3).join('  ')));
if (!names.length) console.log('  ✓ every bare var(--x) resolves to a defined token');
console.log('');
process.exit(names.length ? 1 : 0);
