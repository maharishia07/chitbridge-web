'use strict';
// @type: unit
/**
 * qa130-categorise.test.cjs — bulk categorise sends "add / remove a category" per product, in steps, and is safe to repeat (QA-130, 11 Nov).
 *
 * Cases (a stand-in api, the real ui.js and the real app.html prodCategoriseApply / groupRunSteps cut out by name):
 * it calls prodBulkCategories (never prodBulkUpdate) with ids, add and remove only, no item_data; 12 ids on the slow class → 3 calls of at most 5;
 * a product the server says is unchanged counts done and is said ("already so"); a refused one is named, counted failed and stays ticked;
 * a refusal of the whole step (a thrown 403) stops the run and says why; the screen is never locked; an empty pick is refused in words.
 * CARD      06-catalogue-pim/categories-and-fields
 * Run: node e2e/qa130-categorise.test.cjs
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let toasts = [], busyCalls = 0;
const calls = [];
let answer = null; /* (name, options) => the stand-in's answer or a throw */
const state = { rows: [], selected: new Set(), prods: [], prodPicked: new Set(), prodPick: true, _catgBulk: null };
const sandbox = {
  console, tx: (t) => t, txn: (one, other, n) => (n === 1 ? one : other).replace('{count}', n), esc: (t) => String(t),
  CBAction: { run: (b, fn) => Promise.resolve(fn()) },
  document: { addEventListener() {}, body: { appendChild() {} }, createElement: () => ({ attrs: {}, innerHTML: '', className: '', setAttribute() {}, remove() {} }), querySelector: () => null, getElementById: (id) => (id === 'bulk_err' ? sandbox.__err : null) },
  setTimeout, clearTimeout, modal() {}, closeModal() {}, addEventListener() {}, removeEventListener() {},
  MSG: { fail: (verb, e) => 'Could not ' + verb + ': ' + ((e && e.message) || e) },
  STORE: { actors: [] }, UI: state, toast: (message) => { toasts.push(message); }, announce() {}, showBusy: () => { busyCalls += 1; }, hideBusy() {},
  loadCatalogue: async () => {}, renderApp() {}, chitPos: () => null, cap: (t) => t,
  prodId: (p) => p.id, pData: (p) => p, CBCAT_UI: null,
  api: async (name, options) => { calls.push({ name, body: options && options.body }); await wait(5); return answer(name, options); }
};
vm.createContext(sandbox);
sandbox.window = sandbox;
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'ui.js'), 'utf8'), sandbox);
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');
/* a top-level function of app.html, cut out by its name (it ends at the first closing brace in column 0) */
function sourceOf(name) {
  const start = Math.max(html.indexOf('\nasync function ' + name + '('), html.indexOf('\nfunction ' + name + '('));
  if (start < 0) throw new Error('no function ' + name);
  return html.slice(start, html.indexOf('\n}\n', start) + 3);
}
['chitNameOf', 'groupRunSteps', 'tickUndone', 'prodCategoriseApply'].forEach((name) => vm.runInContext(sourceOf(name), sandbox));
const ids = (n) => Array.from({ length: n }, (_, i) => 'p' + (i + 1));
const reset = (n, add, remove) => {
  calls.length = 0; toasts = []; busyCalls = 0; sandbox.__err = { textContent: '' };
  state.prods = ids(n).map((id) => ({ id, name: 'Product ' + id }));
  state.prodPicked = new Set(ids(n)); state.prodPick = true;
  state._catgBulk = { ids: ids(n), add: new Set(add), remove: new Set(remove) };
};
/** the server's own answer: p3 is not found, p4 and p5 already carry the category */
const serverAnswer = (name, options) => ({ results: options.body.ids.map((id) => ({ id, result: id === 'p3' ? 'refused' : id === 'p4' || id === 'p5' ? 'unchanged' : 'done' })) });

(async () => {
  console.log('the request: ids and the category words only, never the record');
  reset(12, ['cat-fruit'], ['cat-old']);
  answer = (name, options) => ({ results: options.body.ids.map((id) => ({ id, result: 'done' })) });
  await sandbox.prodCategoriseApply();
  check(calls.length === 3 && calls.every((c) => c.name === 'prodBulkCategories'), '12 ids on the slow class → 3 calls of prodBulkCategories (not prodBulkUpdate)');
  check(JSON.stringify(calls.map((c) => c.body.ids.length)) === '[5,5,2]', 'steps of at most 5 (the slow class)');
  check(calls.every((c) => JSON.stringify(Object.keys(c.body).sort()) === '["add","ids","remove"]' && c.body.add[0] === 'cat-fruit' && c.body.remove[0] === 'cat-old'), 'each body is { ids, add, remove } and nothing else: no item_data, so no other field can be overwritten');
  check(/^12 updated$/.test(toasts[toasts.length - 1]) && busyCalls === 0 && state.prodPicked.size === 0 && state.prodPick === false, 'the toast counts 12; the screen is never locked; the ticks clear');

  console.log('unchanged and refused are told apart');
  reset(5, ['cat-fruit'], []);
  answer = serverAnswer;
  await sandbox.prodCategoriseApply();
  check(/^2 updated · 2 already so · 1 could not be saved$/.test(toasts[toasts.length - 1]), '2 changed, 2 already so, 1 refused, all said');
  check(state.prodPicked.size === 1 && state.prodPicked.has('p3') && state.prodPick === true, 'the refused one stays ticked so the person can run it again');

  console.log('a refused step stops the run and says why');
  reset(12, ['cat-fruit'], []);
  answer = () => { throw new Error('Your access does not include cost or price'); };
  await sandbox.prodCategoriseApply();
  check(calls.length === 1 && /5 could not be saved/.test(toasts[toasts.length - 1]) && /7 not done/.test(toasts[toasts.length - 1]), 'the first step fails, the run stops, 5 not saved · 7 not done');
  check(state.prodPicked.size === 12, 'every product stays ticked for another go');

  console.log('nothing picked');
  reset(3, [], []);
  await sandbox.prodCategoriseApply();
  check(calls.length === 0 && /Pick a category/.test(sandbox.__err.textContent), 'no call; the sentence is shown in the dialog');

  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
