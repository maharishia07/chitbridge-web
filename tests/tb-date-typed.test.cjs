'use strict';
/* YE-F-02 (21 Nov 2026): the owner's Trial balance showed only today. Show repainted the tab (the date box was gone) and bkTB then read the box and fell back to today.
   Now Show puts the typed day in BK.tbDay first, and the quick picks use the shop's FY. The request's asOf must equal the typed day.
   Run: node tests/tb-date-typed.test.cjs */
const fs = require('fs'), assert = require('assert'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../public/app/cap-books.js', 'utf8');
const slice = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); assert(a > 0 && b > a, 'found ' + from); return src.slice(a, b); };
const asked = [];
let box = { value: '2026-11-21' }; /* the date box on screen; the repaint replaces it, as bkTab does */
const body = { set innerHTML(v) { box = /tb_asof/.test(v) ? { value: (/value="([^"]*)"/.exec(v) || [])[1] } : null; }, get innerHTML() { return ''; } };
const ctx = {
  BK: {}, bkToday: () => '2026-11-21', esc: (v) => String(v), tx: (v) => v, bkMountAttribute: () => '', bkFyFrom: () => '2026-07-01', bkQuiet() {},
  document: { getElementById: (id) => (id === 'tb_asof' ? box : id === 'bk_body' ? body : null) },
  bkTab(t) { box = null; ctx.bkTB(body); }, /* the repaint: the old box is gone before bkTB runs */
  api: async (name, o) => { asked.push(o.query.asOf); throw new Error('stop'); },
  bkErr: () => '', bkRefused: () => ''
};
vm.createContext(ctx);
vm.runInContext(slice('function bkTbShow', '/** the bar over the trial balance') + slice('async function bkTB', 'var currency = reply') + '} catch (e) {} }', ctx);
(async () => {
  ctx.bkTbShow; 
  box = { value: '2026-06-30' }; ctx.bkTbShow(); await new Promise((r) => setTimeout(r, 5));
  assert.strictEqual(asked.pop(), '2026-06-30', 'typed 2026-06-30, Show: the request carries it, not today');
  ctx.bkTbPick('prior-end'); await new Promise((r) => setTimeout(r, 5));
  assert.strictEqual(asked.pop(), '2026-06-30', 'End of last year = the day before the FY starts');
  ctx.bkTbPick('year-start'); await new Promise((r) => setTimeout(r, 5));
  assert.strictEqual(asked.pop(), '2026-07-01', 'Start of this year = the FY start');
  box = { value: '' }; ctx.bkTbShow(); await new Promise((r) => setTimeout(r, 5));
  assert.strictEqual(asked.pop(), '2026-11-21', 'an empty box still reads today');
  console.log('  ok  Trial balance: typed day, End of last year, Start of this year reach the request');
})().catch((e) => { console.error(e); process.exit(1); });
