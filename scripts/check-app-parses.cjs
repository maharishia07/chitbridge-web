#!/usr/bin/env node
/**
 * check-app-parses.js — does app.html actually RUN?
 *
 * 2026-08-06: a missing comma after an endpoint in the EP registry ran the object literal into the next line, the
 * whole inline <script> failed to parse, and every screen in the app went blank. It shipped because I had
 * parse-checked each new FUNCTION on its own and they were all individually fine — the break was BETWEEN them, in
 * the one place a per-function check cannot look.
 *
 * A syntax error in one inline script takes down everything in that block. There is no partial failure and no
 * console warning a person would see before the deploy: the page is simply empty. So this runs the whole of each
 * inline block through the parser, which finds it in under a second.
 *
 * NOTE .cjs: this package is "type": "module", so a .js file here is an ES module and cannot require().
 * Usage:  node scripts/check-app-parses.cjs [file ...]     (defaults to public/app.html and public/app/*.js)
 * Exit 1 on any parse failure, so it can gate a commit.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function inlineScripts(html) {
  // Inline blocks only — a `src=` script is a separate file and is checked as one.
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push({ code: m[1], line: html.slice(0, m.index).split('\n').length });
  }
  return out;
}

function checkHtml(file) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = inlineScripts(html);
  let bad = 0;
  blocks.forEach((b, i) => {
    try { new vm.Script(b.code, { filename: file }); }
    catch (e) {
      bad++;
      // The offset makes the message point at a line in the FILE, not in the extracted fragment.
      const at = (e.stack && /:(\d+)/.exec(e.stack.split('\n')[0])) || null;
      console.log(`  ✗ ${path.relative(ROOT, file)} · inline block ${i + 1} (from line ${b.line}): ${e.message}`);
    }
  });
  if (!bad) console.log(`  ✓ ${path.relative(ROOT, file)} — ${blocks.length} inline block(s)`);
  return bad;
}

function checkJs(file) {
  try { new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }); console.log(`  ✓ ${path.relative(ROOT, file)}`); return 0; }
  catch (e) { console.log(`  ✗ ${path.relative(ROOT, file)}: ${e.message}`); return 1; }
}

const files = args.length ? args : [
  path.join(ROOT, 'public', 'app.html'),
  ...fs.readdirSync(path.join(ROOT, 'public', 'app')).filter((f) => f.endsWith('.js'))
    .map((f) => path.join(ROOT, 'public', 'app', f)),
];

console.log('\nparse check');
let bad = 0;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(`  ? ${f} — not found`); continue; }
  bad += f.endsWith('.html') ? checkHtml(f) : checkJs(f);
}
console.log(bad ? `\n  ${bad} FAILED — this would be a blank page\n` : '\n  all parse\n');
process.exit(bad ? 1 : 0);
