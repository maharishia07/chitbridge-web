/**
 * e2e/net-42-supplier-list-fresh.test.cjs — NET-42 (proof 2026-11-15): after "Add supplier" the list shows the new supplier without a reload.
 * @type regression
 * OWNS      the proof, by running the shipped functions (extracted from public/app/core.js and public/app.html, no browser): (1) api(key, { fresh: true }) never joins a read
 *           already in flight, so a read that began BEFORE the add cannot hand back the old answer (a plain api(key) still joins, the control); (2) loadSuppliers() paints
 *           only the NEWEST read: the older answer, arriving late with the supplier missing, is dropped and the list keeps the new supplier.
 * MUTATION  NET42_MUTATE=1 removes `if (o.fresh) return apiOnce(key, opts);` and the newest-read guard in memory (the pre-fix state); the test must then FAIL.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 * CARD      12-suppliers-and-procurement/supplier-list
 *   node e2e/net-42-supplier-list-fresh.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const PUB = path.join(__dirname, '..', 'public');
const mutate = process.env.NET42_MUTATE === '1';
let fail = 0;
const ok = (name, cond, info) => { if (!cond) fail++; console.log((cond ? '   ok   ' : '   FAIL ') + name + (!cond && info ? '\n          ' + info : '')); };
/** one top-level function: from its head to the first line that is just "}" */
const fnText = (src, head) => { const i = src.indexOf(head); if (i < 0) throw new Error('not found: ' + head); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 3); };

let apiSrc = fnText(fs.readFileSync(path.join(PUB, 'app', 'core.js'), 'utf8'), 'function api(key, opts) {');
let loadSrc = fnText(fs.readFileSync(path.join(PUB, 'app.html'), 'utf8'), 'async function loadSuppliers() {');
if (mutate) {
  apiSrc = apiSrc.replace('if (o.fresh) return apiOnce(key, opts);', '');
  loadSrc = loadSrc.replace('if (readNumber !== UI._supSeq) return;', '');
}
const defer = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

(async () => {
  // (1) api(): fresh never joins an in-flight read
  const reads = [];
  const ctx1 = { _apiInflight: {}, _apiCopy: (v) => v, epOf: () => ({ m: 'GET' }), apiOnce: () => { const d = defer(); reads.push(d); return d.promise; } };
  vm.createContext(ctx1); vm.runInContext(apiSrc + '\nthis.api = api;', ctx1);
  ctx1.api('supList'); ctx1.api('supList');
  const joined = reads.length;
  reads.length = 0; ctx1._apiInflight = {};
  ctx1.api('supList'); ctx1.api('supList', { fresh: true });
  const afterFresh = reads.length;
  ok('control: two plain reads of the same list share one request', joined === 1, 'requests ' + joined);
  ok('a fresh read starts its own request even while a plain read is in flight', afterFresh === 2, 'requests ' + afterFresh);

  // (2) loadSuppliers(): only the newest read paints
  const answers = [defer(), defer()]; let n = 0; const painted = [];
  const UI = { vp: 'desk', _supSeq: 0 };
  const ctx2 = {
    UI, document: { getElementById: () => ({ innerHTML: '' }) },
    api: () => answers[n++].promise,
    paintSupList: () => painted.push((UI.sups || []).map((s) => s.name).join(',')),
    booksDuesAfterList: () => {}, supCartRelease: () => {}, selectSupplier: () => {}, paintSupDetail: () => {}, scrErr: () => 'err'
  };
  vm.createContext(ctx2); vm.runInContext(loadSrc + '\nthis.loadSuppliers = loadSuppliers;', ctx2);
  const first = ctx2.loadSuppliers();   // began before the add landed
  const second = ctx2.loadSuppliers();  // the repaint after the add
  answers[1].resolve([{ supplier_list_id: 'a', name: 'Old Co' }, { supplier_list_id: 'b', name: 'New Co' }]);
  await second;
  answers[0].resolve([{ supplier_list_id: 'a', name: 'Old Co' }]); // the stale answer arrives late
  await first;
  ok('the newest read painted the list with the new supplier', painted[0] === 'Old Co,New Co', JSON.stringify(painted));
  ok('the older answer arriving late did not repaint (the new supplier stays)', painted.length === 1 && UI.sups.length === 2, JSON.stringify(painted) + ' sups ' + UI.sups.length);
  ok('loadSuppliers asks for a fresh read', /api\('supList', \{ fresh: true \}\)/.test(loadSrc));
  console.log(fail ? '\n' + fail + ' failed' : '\nall ok');
  process.exit(fail ? 1 : 0);
})();
