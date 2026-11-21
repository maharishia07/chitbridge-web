'use strict';
// @type: unit
/**
 * cap-network-theme.test.cjs — the Network screen's code keeps to the theme and fits 390 wide, and the tints it prints on are measured for contrast.
 *
 * OWNS      static proof on the real public/app/cap-network.js (no browser, no Playwright): (1) cream and dark theme: every literal text colour sits beside a
 *           background of its own (an island readable in both grounds, theme-literals.cjs' own rule), and node e2e/theme-literals.cjs passes; (2) 1366 and 390: no
 *           fixed layout width in the code is wider than 320px, so a 390 phone does not scroll sideways; (3) AA contrast: the ink-on-tint pairs the file prints that
 *           e2e/a11y-contrast.cjs measures are all measured, and that tool passes in every theme. The pairs it does NOT measure are printed, never claimed.
 * CALLED BY ci.yml (the unit checks): node e2e/cap-network-theme.test.cjs
 * FLOW      read public/app/cap-network.js → strip comments → literal colours · fixed widths · tint pairs → run theme-literals.cjs and a11y-contrast.cjs → exit 1 on a miss
 * CARD      04-network/network-app-member-view
 */
const fs = require('fs'),
  path = require('path'),
  assert = require('assert'),
  cp = require('child_process');
const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const code = read('public/app/cap-network.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const run = (script) => cp.spawnSync(process.execPath, [path.join(root, 'e2e', script)], { encoding: 'utf8', timeout: 120000 });
let bad = 0;
const ok = (cond, what) => {
  if (!cond) bad++;
  console.log((cond ? '  ok  ' : '  ✗   ') + what);
};

/* 1 · cream and dark theme: a literal text colour needs a background beside it */
const styles = [...code.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
const lonely = styles.filter((s) => /(?:^|[;\s])color:\s*#[0-9a-fA-F]{3,6}\b/.test(s) && !/background/.test(s));
ok(lonely.length === 0, 'cap-network.js: no literal text colour without a background beside it (it would vanish on the dark theme): ' + lonely.length);
ok(run('theme-literals.cjs').status === 0, 'theme-literals.cjs passes (no critical literal in cream or dark)');

/* 2 · 1366 and 390: no fixed layout width over 320px */
const widths = [...code.matchAll(/(?:^|[^-a-z])width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(widths.length > 0 && Math.max(...widths) <= 320, 'cap-network.js: the widest fixed width is ' + Math.max(0, ...widths) + 'px, at most 320 (390 wide has room; 1366 uses flex/max-width)');

/* 3 · AA contrast: the tint pairs the file prints, against the pairs a11y-contrast.cjs measures */
const measured = read('e2e/a11y-contrast.cjs');
const used = new Set([...code.matchAll(/background:var\((--[a-z-]*tint[a-z-]*)\)[^"']{0,160}?color:var\((--[a-z0-9-]+)\)/g)].map((m) => m[1] + '|' + m[2]));
const unmeasured = [...used].filter((pair) => !measured.includes("['" + pair.split('|')[0] + "', '" + pair.split('|')[1] + "']"));
const counted = used.size - unmeasured.length;
ok(counted >= 2, 'AA contrast: ' + counted + ' of the ' + used.size + ' tint pairs this file prints are in a11y-contrast.cjs (ink on its own tint)');
if (unmeasured.length) console.log('  note  not measured by a11y-contrast.cjs, so not claimed here: ' + unmeasured.join(' · '));
ok(run('a11y-contrast.cjs').status === 0, 'a11y-contrast.cjs passes: every theme meets the AA level it claims');

assert.strictEqual(bad, 0, bad + ' check(s) failed');
console.log('\n  ✓ cap-network theme checks passed');
