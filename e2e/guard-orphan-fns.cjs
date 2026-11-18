#!/usr/bin/env node
// @type: static
/**
 * e2e/guard-orphan-fns.cjs — A FUNCTION NOBODY CALLS (the split's quietest fault: a part keeps its function, the call to it is lost).
 *
 * Athi, 17 Nov: the size split leaves faults no check sees (bank preview addChoices was never called, so the "What is this" panel never drew). Every
 * `function name(` under public/ and index.html is counted against every other mention of `name`; a function with NO other mention anywhere is an
 * ORPHAN. The orphans standing today are in e2e/guard-orphan-fns.baseline.json (dead since a redesign: janitor's list, not this guard's); a NEW orphan
 * fails, so a split that drops a call (or a new part nobody calls) is caught the day it is written. The list may only SHRINK: `--write` records it.
 *
 *   node e2e/guard-orphan-fns.cjs            check · node e2e/guard-orphan-fns.cjs --write   after an orphan was wired in or deleted
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), BASE = path.join(__dirname, 'guard-orphan-fns.baseline.json');
function files() {
  const out = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (/vendor|node_modules|shots/.test(f.name)) continue; walk(p); } else if (/\.(js|html)$/.test(f.name) && !/\.min\./.test(f.name)) out.push(p); } };
  walk(path.join(ROOT, 'public')); out.push(path.join(ROOT, 'index.html')); return out;
}
const texts = files().map((f) => [path.relative(ROOT, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8')]);
const count = Object.create(null), decl = Object.create(null);
texts.forEach(([file, text]) => {
  for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) count[m[0]] = (count[m[0]] || 0) + 1;
  for (const m of text.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) (decl[m[1]] = decl[m[1]] || []).push(file);
});
const orphans = Object.keys(decl).filter((n) => count[n] - decl[n].length <= 0).map((n) => n + ' ' + decl[n][0]).sort();
if (process.argv.includes('--write')) { fs.writeFileSync(BASE, JSON.stringify({ _: 'functions declared and never mentioned again (dead since a redesign). A new one fails e2e/guard-orphan-fns.cjs; this list may only shrink.', orphans }, null, 1) + '\n'); console.log('baseline written: ' + orphans.length); process.exit(0); }
const known = new Set(JSON.parse(fs.readFileSync(BASE, 'utf8')).orphans);
const fresh = orphans.filter((o) => !known.has(o)), gone = Array.from(known).filter((o) => orphans.indexOf(o) < 0);
console.log('orphan functions: ' + orphans.length + ' (baseline ' + known.size + ') · new ' + fresh.length);
fresh.forEach((o) => console.log('  NEW  ' + o + '  — declared, never called: restore the call (a split dropped it) or delete the function'));
if (gone.length) console.log('  ' + gone.length + ' baseline orphan(s) now called or deleted — run with --write to lower the baseline: ' + gone.join(', '));
process.exit(fresh.length ? 1 : 0);
