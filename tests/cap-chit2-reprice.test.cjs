/**
 * tests/cap-chit2-reprice.test.cjs — public/app/cap-chit2-reprice.js: the Price-from-catalogue overlay, run as the page runs it (the file evaluated with stubbed host globals).
 * CARD 06-orders/README
 * Run: node tests/cap-chit2-reprice.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const FILE = path.join(__dirname, '..', 'public', 'app', 'cap-chit2-reprice.js');
const source = fs.readFileSync(FILE, 'utf8');
let steps = 0;
const step = async (label, fn) => { await fn(); steps++; console.log('ok - ' + label); };

/** a fresh page: `reply` is what the api answers to c2Reprice (an Error = the call could not reach the api) */
function page(reply) {
  const shown = [], toasts = [], calls = [];
  const context = {
    C2: { id: 'chit-1' }, MSG: { fail: (what) => 'Could not ' + what }, esc: (value) => String(value), tx: (words) => words,
    txf: (words, parts) => words.replace('{cat}', parts.cat), c2Money: (minor) => String(minor),
    modal: (html) => shown.push(html), closeModal() {}, toast: (words) => toasts.push(words), loadChit2: async () => {},
    api: async (key, request) => { calls.push({ key, request }); if (reply instanceof Error) throw reply; return reply; }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: FILE });
  return { context, shown, toasts, calls };
}

(async () => {
  await step('the preview asks the server for the plan and lists what will change, with the old price struck through', async () => {
    const view = page({ has_catalogue: true, will_price: [{ particulars: 'Rice', matched: 'Rice 1kg', price: 90, to: 100 }], needs_price: [] });
    await view.context.c2RepricePreview();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(view.calls[0].request.body)), { preview: true, only_unpriced: false });
    const sheet = view.shown[view.shown.length - 1];
    assert.match(sheet, /Rice 1kg/);
    assert.match(sheet, /<s style="color:var\(--grey\)">90<\/s>/);
    assert.match(sheet, /Apply 1/);
  });
  await step('could not read the catalogue (the api is not reachable): the overlay says so in words with a Close button, never a blank', async () => {
    const view = page(new Error('offline'));
    await view.context.c2RepricePreview();
    const sheet = view.shown[view.shown.length - 1];
    assert.match(sheet, /offline/);
    assert.match(sheet, /onclick="closeModal\(\)"/);
  });
  await step('no plan message: the fallback sentence says Could not read the catalogue in words', async () => {
    const view = page(Object.assign(new Error(''), { message: '' }));
    await view.context.c2RepricePreview();
    assert.match(view.shown[view.shown.length - 1], /Could not read the catalogue/);
  });
  await step('a failed apply is told in words (the old prices stay) and nothing is claimed as priced', async () => {
    const view = page(new Error('x'));
    await view.context.c2RepriceApply();
    assert.strictEqual(view.toasts.length, 1);
    assert.match(view.toasts[0], /Could not apply the prices/);
  });
  await step('theme: every colour is a theme token, so dark and light at 1366 and 390 follow the theme; the chosen chip pairs the accent with its own on-accent text (AA contrast by token)', async () => {
    const body = source.split('\n').filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line)).join('\n');
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(body), 'no hex colour');
    assert.ok(/background:var\(--blue\);color:var\(--on-accent\)/.test(body), 'accent background carries the on-accent text colour');
  });
  console.log('cap-chit2-reprice: ' + steps + ' steps passed');
})().catch((failure) => { console.error(failure); process.exit(1); });
