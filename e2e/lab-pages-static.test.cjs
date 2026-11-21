'use strict';
// @type: unit
/**
 * lab-pages-static.test.cjs — the two static lab pages (design-mock.html · screen-gallery.html) read nothing from the server, and keep to AA contrast.
 *
 * OWNS      static proof on the real public/design-mock.html and public/screen-gallery.html (no browser): (1) neither page calls the api or fetch, so no read can fail
 *           and there is no "could not read" sentence to word (the pages show sample content only); (2) every literal text colour that sits beside a literal background
 *           in the same rule or style meets AA 4.5:1 (e2e/lib/contrast.cjs, the one WCAG maths), and screen-gallery.html writes no hex colour at all (tokens only).
 *           NOT claimed here: a walk of either page, and a string layer (the pages carry no tx() strings): those minimums stay open for the tool's owner.
 * CALLED BY ci.yml (the unit checks): node e2e/lab-pages-static.test.cjs
 * FLOW      read the page → count api/fetch calls → pair each literal ink with its literal ground → ratio() ≥ 4.5 → exit 1 on a miss
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/themes-contrast-accessibility
 */
const fs = require('fs'),
  path = require('path'),
  assert = require('assert');
const { ratio } = require('./lib/contrast.cjs');
const page = (name) => fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
let bad = 0;
const ok = (cond, what) => {
  if (!cond) bad++;
  console.log((cond ? '  ok  ' : '  ✗   ') + what);
};

/** the literal ink/ground pairs of a page: each rule block and style attribute that holds both */
function pairsOf(html) {
  const blocks = [...html.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).concat([...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]));
  const pairs = [];
  blocks.forEach((block) => {
    const ink = (block.match(/(?:^|[;\s])color:\s*(#[0-9a-fA-F]{3,6})\b/) || [])[1];
    const ground = (block.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,6})\b/) || [])[1];
    if (ink && ground) pairs.push([ink, ground]);
  });
  return pairs;
}

for (const name of ['design-mock.html', 'screen-gallery.html']) {
  const html = page(name);
  const reads = (html.match(/\bfetch\(|\bapi\(|XMLHttpRequest/g) || []).length;
  ok(reads === 0, 'public/' + name + ': no api read or fetch (' + reads + '), so nothing here could not be read: sample content only');
  const pairs = pairsOf(html);
  const low = pairs.filter(([ink, ground]) => !(ratio(ink, ground) >= 4.5));
  ok(low.length === 0, 'public/' + name + ': AA contrast, ' + pairs.length + ' literal ink-on-ground pairs measured, ' + low.length + ' below 4.5:1');
}
ok(!/#[0-9a-fA-F]{6}\b/.test(page('screen-gallery.html')), 'public/screen-gallery.html: no hex colour, tokens only (follows the cream and dark theme)');

assert.strictEqual(bad, 0, bad + ' check(s) failed');
console.log('\n  ✓ lab page checks passed');
