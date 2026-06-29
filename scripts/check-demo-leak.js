// check-demo-leak.js — fail the build if a demo constant can reach the LIVE path.
//
// Approach (A) safety net: the demo data lives in app.html alongside the real app, so a
// demo value can only NOT leak if every live read is gated. This scans for demo "sentinel"
// values and flags any that appear OUTSIDE the three demo-only zones (the DEMO object,
// demoApi+stripChit, the Theatre/Player block) and NOT on a `CFG.MODE==='demo'` gated line.
//
// Run:  node scripts/check-demo-leak.js   (exit 1 = a potential leak; wire into CI + pre-deploy)
// This is the interim guarantee until the full demo/dev split (approach B) makes it structural.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '..', 'public', 'app.html');
const src = fs.readFileSync(APP, 'utf8');
const lines = src.split('\n');

// Demo sentinels — values that should ONLY ever exist in demo-only code.
const SENTINELS = [
  /raghavan/i, /saravana/i, /\brt-001\b/, /\bst-001\b/, /\be_demo\b/,
  /\bCB-0001\b/, /demo-owner/, /demo-actor/, /\bPriya\b/, /\bKumar\b/, /\bDevi\b/,
  /raghavan-timber/i, /coassist0\d/
];

// Locate the demo-only zones by stable markers (line indices, 0-based).
const at = (needle) => lines.findIndex(l => l.includes(needle));
const zones = [
  { name: 'DEMO object',        start: at('const DEMO = {'),     end: at('function deepClone') },
  { name: 'demoApi + stripChit', start: at('function demoApi'),  end: at('DEMO THEATRE') },
  { name: 'Theatre / Player',   start: at('DEMO THEATRE'),       end: at('SESSION + ROUTER') }
];
// After the demo is fully stripped from app.html these zones no longer exist — that's the goal.
// Keep only zones that are present; if none, EVERY sentinel is a leak (structural pass = zero sentinels).
const validZones = zones.filter(z => z.start >= 0 && z.end > z.start);
console.log('demo zones present in app.html: ' + validZones.length + (validZones.length ? '' : '  (fully stripped — structural mode)'));
const inDemoZone = (i) => validZones.some(z => i >= z.start && i < z.end);

// A line is "gated" if it only uses the sentinel inside a demo-mode branch.
const isGated = (line) => /MODE\s*===?\s*['"]demo['"]/.test(line) || /STAGES\[[^\]]*\]\.mock/.test(line) || /\bmock\s*:/.test(line);
// Comments are fine (documentation, not executed data).
const isComment = (line) => { const t = line.trim(); return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'); };

const leaks = [];
lines.forEach((line, i) => {
  if (inDemoZone(i) || isGated(line) || isComment(line)) return;
  for (const re of SENTINELS) {
    if (re.test(line)) { leaks.push({ ln: i + 1, hit: (line.match(re) || [''])[0], text: line.trim().slice(0, 90) }); break; }
  }
});

if (leaks.length === 0) {
  console.log('check-demo-leak: PASS — no demo sentinel reaches the live path.');
  process.exit(0);
}
console.log('check-demo-leak: FAIL — ' + leaks.length + ' demo value(s) reachable from the LIVE path:');
for (const l of leaks) console.log('  app.html:' + l.ln + '  [' + l.hit + ']  ' + l.text);
console.log('\nGate each behind CFG.MODE===\'demo\', move it into a demo-only zone, or remove it.');
process.exit(1);
