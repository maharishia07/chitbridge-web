'use strict';
// @type: unit
/**
 * bulk-resume.test.cjs — a bulk job survives a restart (Athi 11 Nov; PM/designs/BULK-RESUME-AUDIT.md section c; SEC-140).
 *
 * Each "page" is a fresh sandbox (the real cb-offline.js, ui.js and the saved-job block of app.html) over the SAME localStorage, so a reload is a new page with the old storage.
 * Cases: a job of 25 → the page dies after 12 steps → a fresh page resumes the other 13 and every key is called once (job:<id>:<n>, 200 characters at most);
 * a different entity signed in → its entries are never replayed, the owner's stay; 503 then 200 → retried after 2 s and done, "Server busy, trying again in 2 s"; the four waits then "Stopped";
 * a private window (storage refuses writes) says closing loses the job; a job older than 48 h asks first (Continue resumes, Cancel drops it); a replayed 404 counts as done only after an earlier attempt;
 * status change and categorise say "Keep this tab open" and stay out of the outbox; every state's words, as recorded.
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/ui-action-set
 * Run: node e2e/bulk-resume.test.cjs
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
const html = read('app.html');
const jobBlock = html.slice(html.indexOf('/* ⭐ SAVE AND RESUME'), html.indexOf('\n}\n', html.indexOf('async function bulkResume(')) + 3);
function sourceOf(name) {
  const start = Math.max(html.indexOf('\nasync function ' + name + '('), html.indexOf('\nfunction ' + name + '('));
  if (start < 0) throw new Error('no function ' + name);
  return html.slice(start, html.indexOf('\n}\n', start) + 3);
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ids = (n) => Array.from({ length: n }, (_, i) => 'c' + (i + 1));

/* the device: one localStorage shared by every page; refuseWrites turns it into a private window */
function makeStorage(refuseWrites) {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { if (refuseWrites && k !== '__cb') throw new Error('quota'); if (refuseWrites) throw new Error('private'); map.set(k, String(v)); }, removeItem: (k) => map.delete(k) };
}
/* the server: holds each Idempotency-Key once and answers a replay with the first answer; counts every call per key */
function makeServer() {
  const server = { calls: [], answers: new Map(), archived: new Set(), script: null };
  server.handle = async (ep, options) => {
    const key = options && options.idemKey;
    server.calls.push({ ep, key, id: options && options.params && options.params.id });
    if (server.script) { const scripted = server.script(ep, options, server.calls.filter((c) => c.key === key).length); if (scripted) return scripted(); }
    if (key && server.answers.has(key)) return server.answers.get(key);
    const reply = ep === 'assignBulk' ? { assigned: options.body.chit_ids.length, skipped: [] } : {};
    if (key) server.answers.set(key, reply);
    return reply;
  };
  return server;
}
/* one page: a fresh sandbox, the real files, the shared storage; die(after) makes api hang forever once that many calls were made (the tab died before the next request left) */
function makePage(storage, server, who, options) {
  options = options || {};
  const spoken = [], toasts = [], asks = [], listeners = {};
  let made = 0;
  const sandbox = {
    console, setTimeout, clearTimeout, localStorage: storage, navigator: { onLine: true }, spoken, toasts, asks,
    tx: (t) => t, txf: (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)), esc: (t) => String(t),
    CBAction: { run: (b, fn) => Promise.resolve(fn()) }, SESSION: { token: who ? 'tok-' + who : '' },
    document: { addEventListener() {}, body: { appendChild() {} }, createElement: () => { const el = { attrs: {}, innerHTML: '', className: '', setAttribute() {}, remove() {} }; let said = ''; Object.defineProperty(el, 'textContent', { get: () => said, set: (v) => { said = v; spoken.push(v); } }); return el; }, querySelector: () => null, getElementById: () => null },
    modal() {}, closeModal() {}, addEventListener: (name, handler) => { (listeners[name] = listeners[name] || []).push(handler); }, removeEventListener() {},
    MSG: { fail: (verb, e) => 'Could not ' + verb + ': ' + ((e && e.message) || e) },
    UI: { rows: [], selected: new Set() }, toast: (m) => toasts.push(m), announce: undefined, loadList: async () => {}, loadCatalogue: async () => {},
    cblog: () => {}, confirmAsk: (title, body, ok, onOk, danger, onCancel) => asks.push({ title, body, ok, onOk, onCancel }),
    epOf: (key) => ({ m: key === 'assignBulk' ? 'POST' : 'POST', p: key === 'assignBulk' ? '/api/chits/assign-bulk' : '/api/chits/:id/' + key.toLowerCase() }),
    fill: (p, params) => p.replace(/:(\w+)/g, (m, k) => (params && params[k]) || m),
    api: async (ep, opts) => {
      if (options.dieAfter != null && made >= options.dieAfter) await new Promise(() => {});
      made += 1;
      return server.handle(ep, opts);
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('cb-offline.js'), sandbox);
  vm.runInContext(read('app/ui.js'), sandbox);
  sandbox.CBOffline.configure({ entity: () => who, sleep: (ms) => { (sandbox.waits = sandbox.waits || []).push(ms); return Promise.resolve(); } });
    vm.runInContext(jobBlock, sandbox);
  ['chitNameOf', 'groupRun', 'groupToast', 'tickUndone', 'confirmStatus', 'prodCategoriseSend'].forEach((name) => { try { vm.runInContext(sourceOf(name), sandbox); } catch (e) { /* prodCategoriseSend is cut below */ } });
  sandbox.goOnline = (up) => { sandbox.navigator.onLine = up; if (up) (listeners.online || []).forEach((handler) => handler()); };
  return sandbox;
}
const archive = (page, n) => page.groupJob(ids(n), { ep: 'archive', mount: 'WRK001-U51', speed: 'quick', verb: 'archive', label: 'Archiving records', unit: 'archived' });
const quiet = (p) => p.catch(() => {});

(async () => {
  console.log('a job of 25: the page dies after 12 steps, a fresh page finishes it');
  {
    const storage = makeStorage(), server = makeServer();
    const first = makePage(storage, server, 'alice', { dieAfter: 12 });
    quiet(archive(first, 25));
    await wait(120);
    const stored = JSON.parse(storage.getItem('cb.outbox.v1'));
    check(stored.length === 13 && stored.every((e) => /^job:[0-9a-f]{32}:\d+$/.test(e.id) && e.id.length <= 200 && e.entity === 'alice'), 'the first page stored all 25 steps before step 1, 12 answered and gone, 13 left, each with its own job key and its entity');
    check(server.calls.length === 12, 'the server saw 12 calls');
    const second = makePage(storage, server, 'alice');
    await second.bulkResume();
    await wait(200);
    const perKey = {};
    server.calls.forEach((c) => { perKey[c.key] = (perKey[c.key] || 0) + 1; });
    check(Object.keys(perKey).length === 25 && Object.values(perKey).every((n) => n === 1), 'all 25 keys called, none twice (no double call per key)');
    check(!storage.getItem('cb.outbox.v1') || JSON.parse(storage.getItem('cb.outbox.v1')).length === 0, 'nothing left in the outbox');
    check(second.toasts.some((t) => /^25 done/.test(t)), 'the resumed page says "25 done": ' + second.toasts.join(' | '));
  }

  console.log('a step in flight when the tab died is sent again with the SAME key');
  {
    const storage = makeStorage(), server = makeServer();
    const first = makePage(storage, server, 'alice');
    server.script = (ep, o, nth) => (nth === 1 && o.params.id === 'c3' ? () => new Promise(() => {}) : null);
    quiet(archive(first, 5));
    await wait(80);
    server.script = null;
    const second = makePage(storage, server, 'alice');
    await second.bulkResume();
    await wait(150);
    const c3 = server.calls.filter((c) => c.id === 'c3');
    check(c3.length === 2 && c3[0].key === c3[1].key, 'c3 was sent twice with one key, so the server applies it once');
  }

  console.log('SEC-140: a different entity signed in never replays someone else\'s queue');
  {
    const storage = makeStorage(), server = makeServer();
    const alice = makePage(storage, server, 'alice', { dieAfter: 2 });
    quiet(archive(alice, 6));
    await wait(80);
    storage.setItem('cb.outbox.v1', JSON.stringify(JSON.parse(storage.getItem('cb.outbox.v1')).concat([{ id: 'plain1', method: 'POST', path: '/api/x', entity: 'alice', tries: 0 }, { id: 'legacy', method: 'POST', path: '/api/y', tries: 0 }])));
    const before = server.calls.length;
    const bob = makePage(storage, server, 'bob');
    let fetched = 0;
    bob.fetch = async () => { fetched += 1; return { status: 200, clone: () => ({ json: async () => ({}) }) }; };
    await bob.bulkResume();
    await wait(100);
    const left = JSON.parse(storage.getItem('cb.outbox.v1'));
    check(server.calls.length === before && fetched === 0, 'bob replayed nothing (no api call, no plain replay)');
    check(left.length === 4 + 2 && left.every((e) => e.id === 'legacy' || e.entity === 'alice'), 'all of alice\'s entries and the unstamped one are still there, untouched');
    check(bob.CBOffline.jobs().length === 0 && bob.CBOffline.pending() === 6, 'bob sees no job of his own');
    const alice2 = makePage(storage, server, 'alice');
    alice2.fetch = bob.fetch;
    await alice2.bulkResume();
    await wait(150);
    check(fetched === 1, 'alice back: her plain entry goes (once), not the unstamped one');
    check(alice2.CBOffline.jobs().length === 0, 'and her job finished');
  }

  console.log('503 then 200: retried with back-off; the four waits, then stop and name what is left');
  {
    const storage = makeStorage(), server = makeServer();
    const page = makePage(storage, server, 'alice');
    server.script = (ep, o, nth) => (o.params.id === 'c2' && nth === 1 ? () => Promise.reject(Object.assign(new Error('busy'), { status: 503 })) : null);
    const result = await archive(page, 3);
    check(result.done.length === 3 && result.failed.length === 0 && JSON.stringify(page.waits) === '[2000]', '503 then 200: all three done after one 2 s wait');
    const key = server.calls.filter((c) => c.id === 'c2').map((c) => c.key);
    check(key.length === 2 && key[0] === key[1], 'the retry carries the same key');

    const storage2 = makeStorage(), server2 = makeServer();
    const page2 = makePage(storage2, server2, 'alice');
    server2.script = (ep, o) => (o.params.id === 'c2' ? () => Promise.reject(Object.assign(new Error('busy'), { status: 429 })) : null);
    const stopped = await archive(page2, 4);
    check(JSON.stringify(page2.waits) === '[2000,5000,15000,30000]', 'the waits are 2, 5, 15, 30 s: ' + JSON.stringify(page2.waits));
    check(stopped.done.length === 1 && stopped.left === 3 && stopped.failed.length === 0, 'then it stops and names what is left: 1 done, 3 not done, none called failed');
    const heard = page2.ui.progress.batch.noteWords('busy', { seconds: 15 });
    check(heard === 'Server busy, trying again in 15 s', 'the busy words');
  }

  console.log('offline: the job waits for the connection, then goes on');
  {
    const storage = makeStorage(), server = makeServer();
    const page = makePage(storage, server, 'alice');
    page.goOnline(false);
    const running = archive(page, 3);
    await wait(60);
    check(server.calls.length === 0, 'nothing is sent while offline');
    page.goOnline(true);
    const result = await running;
    check(result.done.length === 3 && server.calls.length === 3, 'back online: all three go');
  }

  console.log('a private window: the device keeps nothing, and the job says so');
  {
    const storage = makeStorage(true), server = makeServer();
    const page = makePage(storage, server, 'alice');
    check(page.CBOffline.durable() === false, 'durable() is false');
    const result = await archive(page, 2);
    check(result.done.length === 2, 'the job still runs in the tab');
    check(page.spoken.includes("This browser can't keep the job. Closing this tab loses it."), 'the box says closing loses the job');
    const kept = makePage(makeStorage(), makeServer(), 'alice');
    await archive(kept, 2);
    check(kept.spoken.includes('Saved on this device. Safe to keep working or close.') && !kept.spoken.some((w) => /loses it/.test(w)), 'a device that keeps it says Saved on this device');
  }

  console.log('a job older than 48 h asks before it resumes');
  {
    const storage = makeStorage(), server = makeServer();
    const first = makePage(storage, server, 'alice', { dieAfter: 0 });
    quiet(archive(first, 3));
    await wait(60);
    const entries = JSON.parse(storage.getItem('cb.outbox.v1'));
    entries.forEach((e) => { e.job.at = Date.now() - 3 * 86400000; });
    storage.setItem('cb.outbox.v1', JSON.stringify(entries));
    const second = makePage(storage, server, 'alice');
    await second.bulkResume();
    await wait(60);
    check(second.asks.length === 1 && server.calls.length === 0 && /3 days ago/.test(second.asks[0].body), 'it asked ("saved 3 days ago") and sent nothing');
    second.asks[0].onCancel();
    check(JSON.parse(storage.getItem('cb.outbox.v1')).length === 0, 'Cancel drops the rest of it');
    const third = makePage(storage, server, 'alice', { dieAfter: 0 });
    quiet(archive(third, 2));
    await wait(40);
    const again = JSON.parse(storage.getItem('cb.outbox.v1'));
    again.forEach((e) => { e.job.at = Date.now() - 49 * 3600000; });
    storage.setItem('cb.outbox.v1', JSON.stringify(again));
    const fourth = makePage(storage, server, 'alice');
    await fourth.bulkResume();
    fourth.asks[0].onOk();
    await wait(150);
    check(server.calls.length === 2, 'Continue resumes it');
  }

  console.log('a replayed step that answers 404');
  {
    const storage = makeStorage(), server = makeServer();
    const first = makePage(storage, server, 'alice', { dieAfter: 0 });
    quiet(archive(first, 2));
    await wait(40);
    const entries = JSON.parse(storage.getItem('cb.outbox.v1'));
    entries[0].attempts = 1; /* the first attempt was made, its answer never came */
    storage.setItem('cb.outbox.v1', JSON.stringify(entries));
    server.script = () => () => Promise.reject(Object.assign(new Error('already archived'), { status: 404 }));
    const second = makePage(storage, server, 'alice');
    let result = null;
    second.ui.progress.batch.run = ((run) => (...args) => run(...args).then((r) => (result = r)))(second.ui.progress.batch.run);
    await second.bulkResume();
    await wait(150);
    check(result && result.done.length === 1 && result.failed.length === 1, 'tried before: 404 counts as done; never tried: 404 is a failure (1 done, 1 failed)');
  }

  console.log('status change and categorise stay in the open tab and say so');
  {
    const page = makePage(makeStorage(), makeServer(), 'alice');
    const batch = page.ui.progress.batch;
    check(batch.resumable('status') === false && batch.resumable('prodBulkUpdate') === false && batch.resumable('archive') === true && batch.resumable('prodStatusBulk') === true, 'the resumable map: status and categorise no, archive and product status yes');
    let refused = '';
    try { batch.resumable('somethingNew'); } catch (e) { refused = e.message; }
    check(/no resume setting/.test(refused), 'an action with no setting is refused, so none is left unclassified');
    let wrong = '';
    try { page.groupRun(['c1'], { action: 'archive', mount: 'WRK001-U57', speed: 'quick', verb: 'x', label: 'x', unit: 'x' }, async () => {}); } catch (e) { wrong = e.message; }
    check(/can resume/.test(wrong), 'a resumable action is not run through the in-tab path');
    check(batch.noteWords('keepopen') === "Keep this tab open. This action can't continue after a restart.", 'the keep-tab-open words');
    const src = html.slice(html.indexOf('async function prodCategoriseSend('), html.indexOf('\n}\n', html.indexOf('async function prodCategoriseSend(')));
    check(src.includes("keepTabOpenNote(step, 'prodBulkUpdate')") && html.includes("if (!ui.progress.batch.resumable(action)) batchJob.note('keepopen')"), 'categorise puts the words on its box');
    check(!sourceOf('confirmStatus').includes('groupJob'), 'status change stays on the in-tab path (groupRun); #527 makes it resumable');
  }

  console.log('every state, in the recorded words');
  {
    const page = makePage(makeStorage(), makeServer(), 'alice');
    const words = (kind, values) => page.ui.progress.batch.noteWords(kind, values);
    const expected = {
      saving: 'Saving the job on this device…',
      saved: 'Saved on this device. Safe to keep working or close.',
      busy: 'Server busy, trying again in 15 s',
      offline: 'Offline. Will continue when back online',
      resumed: 'Continuing your job: 12 of 40 done',
      keepopen: "Keep this tab open. This action can't continue after a restart.",
      doneAll: '40 done',
      doneFailed: '38 done · 2 failed',
      stopped: 'Stopped: 20 done · 20 not done (still ticked)',
      seeWhich: 'See which'
    };
    const values = { seconds: 15, done: 12, total: 40 };
    Object.keys(expected).forEach((kind) => {
      const v = kind === 'doneAll' ? { done: 40 } : kind === 'doneFailed' ? { done: 38, failed: 2 } : kind === 'stopped' ? { done: 20, left: 20 } : values;
      check(words(kind, v) === expected[kind], kind + ': ' + expected[kind]);
    });
    check(page.ui.components.batchnote.code === 'CMP032' && page.ui.components.batchnote.nonButton, 'CMP032 is registered, not a button');
    let missing = '';
    ['ar', 'fr', 'hi', 'ta'].forEach((lang) => { const pack = read('app/strings-' + lang + '.js'); page.ui.progress.batch.noteKinds.concat('label').forEach((kind) => { if (!pack.includes("'CMP032." + kind + "'")) missing += lang + ':' + kind + ' '; }); });
    check(!missing, 'each state is a standard text key in all four packs ' + missing);
  }

  const core = read('app/core.js');
  console.log('core.js: the step names its own key');
  check(core.includes('idemKey: stepKey') && core.includes('if (stepKey) return stepKey'), 'api() takes opts.idemKey (the same hunk as #527)');
  check(/'prodStatusBulk'/.test(core.slice(core.indexOf('const OUTBOX_KEYS'), core.indexOf('const OUTBOX_KEYS') + 2500)), 'prodStatusBulk is an outbox name');
  check(/entity: cbMeId/.test(html), 'app.html configures the outbox with the signed-in entity (cbMeId)');

  console.log(failures ? failures + ' FAILED' : 'all passed');
  process.exit(failures ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
