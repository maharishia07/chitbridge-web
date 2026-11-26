'use strict';
/* REP-74 (1131): "How we are doing" sales chart follows the period picker. Fails on the parent (it drew months whatever was picked).
   week -> 12 weeks, mtd -> 12 months, quarter -> 8 quarters, ytd -> 5 years; the title follows; the running bucket is hatched; an empty bucket stays a tick;
   the compare switch has "Same time last year" ready and "Recent average" greyed (no second sum in a page); a refused read leaves the month picture.
   Run: node tests/rep74-overview-follows-picker.test.cjs */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const ok = (m) => { n++; console.log('  ok  ' + m); };
const ctx = { console, window: { addEventListener() {} }, document: { getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, EP: { tillTrend: {} } };
ctx.tx = (s) => s; ctx.esc = (s) => String(s); ctx.bkMoney = (m) => '$' + m; ctx.CBLocale = { date: () => 'X' };
ctx.CBDraw = { bars: (pts, o) => '<svg data-n="' + pts.length + '" data-hatch="' + pts.filter((p) => p.hatch).length + '" aria-label="' + o.aria + '"></svg>' };
vm.createContext(ctx);
vm.runInContext(read('public/app/mis-charts.js'), ctx); // sets root.MC (globalThis in the context)
ctx.MC = ctx.MC || ctx.window.MC;
vm.runInContext(read('public/app/cap-books-overview.js') + '\nthis.ov = { OVERVIEW, OV_TREND, ovSalesCards, ovCmpSelect };', ctx);
const { OVERVIEW, ovSalesCards, ovCmpSelect } = ctx.ov;
ctx.ovWidth = () => 600; ctx.ovHigh = () => 200;
const slotsOf = (period, count) => Array.from({ length: count }, (_, i) => {
  const key = period === 'month' ? '2026-' + String((i % 12) + 1).padStart(2, '0') : period === 'week' ? '2026-W' + String((i % 52) + 1).padStart(2, '0') : period === 'quarter' ? '2026-Q' + ((i % 4) + 1) : String(2020 + i);
  return { key, gross_minor: i === 2 ? 0 : 1000 + i, last_year: { gross_minor: 900 }, coverage: { partial: i === count - 1 } };
});
const a = { bars: [{ from: '2026-05-01', sold_minor: 5 }], weekdays: [] };
const cases = [['week', 'week', 12, 52, 'Sales by week'], ['mtd', 'month', 12, 24, 'Sales by month'], ['quarter', 'quarter', 8, 12, 'Sales by quarter'], ['ytd', 'year', 5, 7, 'Sales by year']];
for (const [picked, engine, shown, have, title] of cases) {
  OVERVIEW.period = picked; OVERVIEW.trend = { period: picked, answer: { slots: slotsOf(engine, have) } };
  const html = ovSalesCards(a);
  assert(html.includes('data-n="' + shown + '"'), picked + ' draws ' + shown + ' buckets: ' + html.slice(0, 200));
  assert(html.includes('data-hatch="1"'), picked + ': the running bucket is hatched');
  assert(html.includes('<h3>' + title), picked + ' title follows: ' + title);
  ok(picked + ' -> ' + shown + ' ' + engine + 's, titled "' + title + '", running bucket hatched');
}
OVERVIEW.period = 'mtd'; OVERVIEW.trend = null;
assert(ovSalesCards(a).includes('Sales by month, tax in'), 'a refused trend read keeps the overview months'); ok('no series read: the overview months stay');
ctx.OVERVIEW = OVERVIEW; const sw = ovCmpSelect();
assert(/value="last_year"[^>]*>Same time last year/.test(sw) && /value="average" disabled/.test(sw), 'average greyed'); ok('compare switch: last year ready, recent average greyed with its sentence');
assert(!/reduce\(|\/ *slots\.length|sum\(/.test(read('public/app/cap-books-overview.js')), 'no sum or average in the page'); ok('no second sum in the page');
console.log('\n  ' + n + ' passed'); 
