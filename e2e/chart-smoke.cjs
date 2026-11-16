/**
 * e2e/chart-smoke.cjs — ONE CHART ENGINE, GUARDED (chart engine step 1; CLAUDE.md Rule 5 "no new style"; REQ PM/REQ-CHART-ENGINE-2026-11-16.md, critic points 6 and 7).
 *
 * Three jobs, in order, and the exit code is non-zero if any fails:
 *   1. THE GUARD CAN FAIL. e2e/fixtures/chart-page-drawn.bad.js is a page that draws its own chart (an svg role="img" with computed rects, a computed
 *      polyline, a conic-gradient pie). The scan MUST flag all three; if it does not, the guard is broken and says so. (Rule 5: a check that cannot fail is not a check.)
 *   2. THE TREE HAS NONE. The same scan over public/ and index.html (the engine itself, the barcode and QR drawers — a code, not a chart — and the lab pages
 *      excepted, each by name below) must find no page-drawn chart: every chart is CBDraw's (public/engine/chart-draw.js).
 *   3. THE ENGINE DRAWS SANELY. Every CBDraw form runs outside the browser on real-shaped and hostile data: no NaN / undefined / Infinity in the svg, every x and y
 *      inside its own viewBox (a label outside it is simply not drawn), at most 120 points of a series, and no chart on too little data (no invented shape).
 *
 * Run: node e2e/chart-smoke.cjs            (the tree: public/ and index.html of this checkout)
 *      node e2e/chart-smoke.cjs <root>     (another checkout, e.g. origin/main, to see job 2 red on the code before the fold-in)
 * Red before, green after: on origin/main (fcChart, _misSpark, testing.html drawing their own) job 2 fails with the files named.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'chart-page-drawn.bad.js');
let bad = 0;
const say = (ok, what, extra) => {
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok    ' : 'BAD   ') + what + (extra ? '  ' + extra : ''));
};

/** the files that may hold geometry that is not a chart, each with its reason */
const EXCEPT = {
  'public/engine/chart-draw.js': 'the engine itself',
  'public/engine/qr.js': 'a QR code, not a chart',
  'public/app/barcode.js': 'a barcode, not a chart',
  'public/app/cap-register.js': 'the register is a printed code (QR / barcode), not a chart'
};
/** what a page-drawn chart looks like in source: an svg given role="img" built by string, with geometry computed in the string, or a conic-gradient pie */
const TELLS = [
  /* the two halves are in ONE file, in either order (fcChart built its rects before its svg): a role="img" svg string, and a mark whose geometry is concatenated */
  ['an svg role="img" with computed marks', { test: (text) => /<svg[^>]{0,260}role="img"/.test(text) && /<(?:rect|polyline|circle)\b[^>]*="'\s*\+/.test(text) }],
  ['a computed <polyline', /<polyline\b[^>]*points="'\s*\+/],
  ['a conic-gradient pie', /conic-gradient\(/]
];
/** scan(text) → the names of the tells found in one source text */
function scan(text) {
  return TELLS.filter((tell) => (tell[1].test ? tell[1].test(text) : false)).map((tell) => tell[0]);
}
function walk(dir, found) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!/^(node_modules|lab|vendor|\.git)$/.test(name)) walk(full, found);
    } else if (/\.(js|html|mjs)$/.test(name)) found.push(full);
  }
  return found;
}

console.log('\n  chart smoke test  (root ' + ROOT + ')\n');

/* 1 — the guard can fail */
const fixtureTells = scan(fs.readFileSync(FIXTURE, 'utf8'));
say(fixtureTells.length === TELLS.length, 'the bad fixture is caught, every tell of it', fixtureTells.length + ' of ' + TELLS.length + ' found');

/* 2 — the tree has no page-drawn chart */
const files = walk(path.join(ROOT, 'public'), []).concat(fs.existsSync(path.join(ROOT, 'index.html')) ? [path.join(ROOT, 'index.html')] : []);
const offenders = [];
files.forEach((file) => {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (EXCEPT[rel]) return;
  const tells = scan(fs.readFileSync(file, 'utf8'));
  if (tells.length) offenders.push(rel + ' — ' + tells.join('; '));
});
say(!offenders.length, 'no page draws its own chart (' + files.length + ' files scanned)');
offenders.forEach((line) => console.log('        ' + line));

/* 3 — the engine, on real-shaped and hostile data */
const CBDraw = require(path.join(ROOT, 'public', 'engine', 'chart-draw.js'));
const viewBoxOk = (svg) => {
  const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!box) return 'no viewBox';
  const W = +box[1],
    H = +box[2];
  const xs = [...svg.matchAll(/\bx="(-?[\d.]+)"/g)].map((m) => +m[1]);
  const ys = [...svg.matchAll(/\by="(-?[\d.]+)"/g)].map((m) => +m[1]);
  if (xs.length && Math.max(...xs) > W) return 'x ' + Math.max(...xs) + ' beyond ' + W;
  if (ys.length && Math.max(...ys) > H) return 'y ' + Math.max(...ys) + ' beyond ' + H;
  return '';
};
const sane = (what, out) => {
  const nan = /NaN|undefined|Infinity/.test(out);
  const box = out.startsWith('<svg') ? viewBoxOk(out) : '';
  say(!nan && !box, what.padEnd(36), (nan ? 'NaN/undefined in the output ' : '') + box);
};
if (!CBDraw.stackRows) {
  say(false, 'this checkout has no CBDraw.stackRows: job 3 not run');
} else {
  const days = Array.from({ length: 30 }, (_, i) => ({ key: '2026-10-' + String(i + 1).padStart(2, '0'), label: String(i + 1), value: (i % 7 === 3 ? -1 : 1) * (i * 311 + 40), title: 't' + i }));
  sane('bars: a month of a running balance', CBDraw.bars(days, { tid: 'fc', mark: { index: 3, text: 'low', tid: 'm' } }));
  sane('bars: one point', CBDraw.bars([days[0]], {}));
  sane('bars: a null (no record) and a hatch', CBDraw.bars([{ key: 'a', label: 'a', value: null }, { key: 'b', label: 'b', value: 5, hatch: true, line: 4 }], {}));
  sane('bars: hostile figures', CBDraw.bars([{ key: 'a', value: NaN }, { key: 'b', value: 'x' }, { key: 'c', value: Infinity }], {}));
  sane('spark: a normal series', CBDraw.spark([1, 4, 2, 8], {}));
  sane('spark: fluid with an inset', CBDraw.spark([1, 4, 2, 8], { width: 300, height: 56, fluid: true, inset: { left: 6, right: 6, top: 8, bottom: 6 } }));
  const AREAS = [
    { name: 'CTR', total: 10, note: '4/10', parts: [{ value: 4, fill: 'var(--ok)' }, { value: 2, fill: 'var(--bad)' }, { value: 4, fill: 'var(--line)' }] },
    { name: 'AVERYLONGMODULENAMEINDEED', total: 5, note: '5/5', parts: [{ value: 5, fill: 'var(--ok)' }] }
  ];
  sane('stackRows: a long name', CBDraw.stackRows(AREAS, {}));
  sane('stackColumns: three sittings', CBDraw.stackColumns([1, 2, 3].map((n) => ({ label: 'd' + n, parts: [{ value: n * 3, fill: 'var(--ok)' }, { value: n, fill: 'var(--bad)' }] })), {}));
  say(CBDraw.spark([5], {}) === '' && CBDraw.stackColumns([{ parts: [] }], {}) === '' && CBDraw.bars([], {}) === '', 'too little data draws nothing (no invented shape)');
  const many = Array.from({ length: 500 }, (_, i) => ({ key: 'k' + i, label: String(i), value: i + 1 }));
  say((CBDraw.bars(many, { tid: 'big' }).match(/data-testid="big-bar-/g) || []).length === CBDraw.MAX_POINTS, 'bars: 500 points draw only ' + CBDraw.MAX_POINTS);
  const stackHtml = CBDraw.stackBar([{ n: 3, label: 'Open', fill: 'var(--blue)', on: 'var(--on-accent)' }, { n: 0, label: 'Closed', fill: 'var(--ok)', on: 'var(--on-ok)' }], { total: 3 });
  say(/color:var\(--on-accent\)/.test(stackHtml) && !/width:0/.test(stackHtml) && /Closed/.test(stackHtml), 'stackBar: each fill names its text colour; a zero part has no segment, but is in the key');
}

console.log('\n  ' + bad + ' problem' + (bad === 1 ? '' : 's') + '\n');
process.exitCode = bad ? 1 : 0;
