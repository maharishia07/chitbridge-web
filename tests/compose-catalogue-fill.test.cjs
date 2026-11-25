/**
 * tests/compose-catalogue-fill.test.cjs — public/app/compose-catalogue-fill.js: compose fills the product picker once its modal is open, run as the page runs it (the file evaluated with stubbed host globals).
 * CARD 01-rail-core-the-chit/chit-design-2
 * Run: node tests/compose-catalogue-fill.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const FILE = path.join(__dirname, '..', 'public', 'app', 'compose-catalogue-fill.js');
const source = fs.readFileSync(FILE, 'utf8');
let steps = 0;
const step = async (label, fn) => { await fn(); steps++; console.log('ok - ' + label); };
/** the code without its comments, for what the module itself draws */
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');

/** a fresh page: `loader` is ensureCatalogue (it may throw: the read could not reach the api), `cached` is what STORE.catalogue already holds */
function page(loader, cached, failedFlag) {
  const calls = [];
  const context = {
    UI: {}, STORE: { catalogue: cached }, _catFailed: failedFlag,
    ensureCatalogue: async (fresh) => { calls.push('ensureCatalogue:' + fresh); return loader(); },
    ccCartSync: () => calls.push('ccCartSync'), ccRenderCatPick: () => calls.push('ccRenderCatPick')
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: FILE });
  return { context, calls };
}

(async () => {
  await step('a good read: the picker is ready, the cart is pointed at the products and the picker is painted, in that order', async () => {
    const view = page(async () => {}, [{ id: 'p1' }], false);
    await view.context.composeFillCatalogue();
    assert.strictEqual(view.context.UI._catState, 'ready');
    assert.deepStrictEqual(view.calls, ['ensureCatalogue:true', 'ccCartSync', 'ccRenderCatPick']);
  });
  await step('an empty catalogue is "No items yet" (ready), not a fault: the error words only when the read failed', async () => {
    const empty = page(async () => {}, [], false);
    await empty.context.composeFillCatalogue();
    assert.strictEqual(empty.context.UI._catState, 'ready');
    const failed = page(async () => {}, [], true);
    await failed.context.composeFillCatalogue();
    assert.strictEqual(failed.context.UI._catState, 'error');
  });
  await step('could not read the catalogue (the api is not reachable): a cached list is kept (fell back to it), and with nothing cached the picker says error in words', async () => {
    const kept = page(async () => { throw new Error('offline'); }, [{ id: 'p1' }], false);
    await kept.context.composeFillCatalogue();
    assert.strictEqual(kept.context.UI._catState, 'ready');
    const nothing = page(async () => { throw new Error('offline'); }, [], false);
    await nothing.context.composeFillCatalogue();
    assert.strictEqual(nothing.context.UI._catState, 'error');
    assert.ok(nothing.calls.includes('ccRenderCatPick'), 'the picker is still painted, so the person reads the error state and not a blank');
  });
  await step('theme: the module draws nothing itself, so there is no colour to break in dark or light at 1366 and 390, and no text whose AA contrast it could spoil', async () => {
    assert.ok(!/#[0-9a-fA-F]{3,6}\b|rgb\(|style=|color/.test(codeOnly), 'no colour and no inline style in the code');
  });
  await step('string layer: the module writes no words of its own (the picker text goes through tx / T( in ccRenderCatPick, the locale layer)', async () => {
    assert.ok(!/(['"`])[A-Za-z][A-Za-z ,.'-]{11,}\1/.test(codeOnly), 'no sentence literal in the code');
  });
  console.log('compose-catalogue-fill: ' + steps + ' steps passed');
})().catch((failure) => { console.error(failure); process.exit(1); });
