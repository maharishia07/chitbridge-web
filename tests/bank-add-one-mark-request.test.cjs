'use strict';
/**
 * tests/bank-add-one-mark-request.test.cjs — SPEED (batch 1129): the bank sheet's "Add" accepts every added line with ONE marks request (not one per line) and ONE explain + repaint (not one per line).
 * OWNS    the proof that bankStoreBatch holds the marks of a run and sends them together (at most 200 to a request, the api's limit, in the order made, same words on a failure), that one-at-a-time
 *         appends still send one each (the Bank view's own Accept), and that the sheet's accept loop is wrapped in it and defers the repaint.
 * CALLED BY npm test (tests/*.test.cjs)       CARD    16-finance/bank-reconciliation-and-bank-rails
 * Run: node tests/bank-add-one-mark-request.test.cjs
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'public', 'app');
const read = (name) => fs.readFileSync(path.join(APP, name), 'utf8');
let pass = 0;
const ok = (m) => { pass++; console.log('  ok  ' + m); };

function world(fail) {
  const calls = [];
  const ctx = {
    console, tx: (s) => s, txf: (s) => s, bkbE: String, bkbReadOnly: () => false,
    document: { getElementById: () => null }, Promise,
    api: async (key, opts) => { calls.push({ key, marks: opts.body.marks.length, first: opts.body.marks[0].key, last: opts.body.marks[opts.body.marks.length - 1].key }); if (fail) throw Object.assign(new Error('could not reach'), { status: 500 }); return {}; }
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('cap-bank-store.js'), ctx, { filename: 'cap-bank-store.js' });
  vm.runInContext("bankStoreState.mode = 'server'; bankStoreState.view = { acct: 'A1', stmtAcct: 'A1', file: { hash: 'h1' } };", ctx);
  return { ctx, calls, run: (code) => vm.runInContext(code, ctx), settle: () => vm.runInContext('bankStoreState.chain', ctx) };
}
const accepts = (n) => 'for (let i = 0; i < ' + n + '; i++) bankStoreAppend({ act: "accept", key: "k" + i, chits: [], ledger: ["E" + i] });';

(async () => {
  /* BEFORE: one at a time = one request each (the Bank view's own Accept is still this) */
  const one = world(); one.run(accepts(300)); await one.settle();
  assert.strictEqual(one.calls.length, 300); ok('one at a time: 300 accepts = 300 requests (the old Add did this for a 300-line statement)');

  /* AFTER: in a batch = ceil(n / 200) requests, in the order made */
  const batch = world(); batch.run('bankStoreBatch(() => {' + accepts(300) + '})'); await batch.settle();
  assert.deepStrictEqual(batch.calls.map((c) => c.marks), [200, 100]); ok('in a batch: 300 accepts = 2 requests (200 + 100)');
  assert.deepStrictEqual([batch.calls[0].first, batch.calls[0].last, batch.calls[1].first, batch.calls[1].last], ['k0', 'k199', 'k200', 'k299']); ok('the marks go in the order made');
  assert.ok(batch.calls.every((c) => c.key === 'booksBankMarks')); ok('the same route as before (POST /bank/marks, one insert for the whole batch)');
  assert.strictEqual(batch.run('bankStoreState.held'), null); ok('the hold is let go after the batch');

  const small = world(); small.run('bankStoreBatch(() => {' + accepts(5) + '})'); await small.settle();
  assert.deepStrictEqual(small.calls.map((c) => c.marks), [5]); ok('5 lines = 1 request');
  const none = world(); none.run('bankStoreBatch(() => {})'); await none.settle();
  assert.strictEqual(none.calls.length, 0); ok('nothing accepted = nothing sent');
  const dev = world(); dev.run("bankStoreState.mode = 'device'"); dev.run('bankStoreBatch(() => {' + accepts(5) + '})'); await dev.settle();
  assert.strictEqual(dev.calls.length, 0); ok('device mode (the record is not set up) sends nothing, as before');
  const failed = world(true); failed.run('bankStoreBatch(() => {' + accepts(3) + '})'); await failed.settle();
  assert.strictEqual(failed.run('bankStoreState.mode'), 'error'); assert.strictEqual(failed.run('bankStoreState.say'), 'could not reach'); ok('a failed batch is said, not swallowed (mode error, the server\'s words)');
  const thrown = world(); try { thrown.run('bankStoreBatch(() => { bankStoreAppend({ act: "accept", key: "z", chits: [], ledger: [] }); throw new Error("boom"); })'); } catch (e) { /* the throw passes through */ }
  await thrown.settle(); assert.strictEqual(thrown.run('bankStoreState.held'), null); assert.strictEqual(thrown.calls.length, 1); ok('a throw inside the run still lets go of the hold and sends what was made');

  /* the sheet's accept loop */
  const sheet = read('cap-bank-sheet.js'), rows = read('cap-bank-rows.js');
  const loop = sheet.slice(sheet.indexOf('function bkshAcceptAdded'), sheet.indexOf('/** the sheet closed'));
  assert.ok(/bankStoreBatch\(\(\) => \(bkshBook\(\)\.rows/.test(loop) && (loop.match(/bankAccept\([^;]*, true, true\)/g) || []).length === 2); ok('the sheet accepts every added line inside ONE batch, repaint deferred');
  assert.strictEqual((loop.match(/bankExplain\(\)/g) || []).length, 1); assert.strictEqual((loop.match(/bankPaint\(\)/g) || []).length, 1); ok('and explains and repaints once after the loop');
  assert.ok(/function bankAccept\(line, quiet, deferPaint\)/.test(rows) && /if \(!deferPaint\)/.test(rows)); ok('bankAccept still explains and repaints on its own unless told the caller will');
  console.log('\n  ' + pass + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
