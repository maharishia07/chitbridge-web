#!/usr/bin/env node
/* practice-150.cjs — PRAC150 (21 Nov): the firm practice screen is right at 150 clients (the auditor brings ~150). No browser: the page file is loaded against a stub window and a stub api that
 * answers like GET /api/books-grants/practice (whole list with no page words; a page with has_more when it is asked for pages).
 * HAND-COMPUTED  150 clients: 65 books_in + 30 complete + 21 checked + 21 ready + 13 lodged. A server that answers 100 + 50 (pages) must still give the list 150 rows and the head "150 clients".
 * Run: node e2e/practice-150.cjs */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const calls = [];
const root = { Promise, setTimeout() {}, setInterval() {}, clearInterval() {}, Event: function () {}, dispatchEvent() {}, tx: (s) => s, location: { hostname: 'x' }, localStorage: { getItem: (k) => (k === 'cb_sess' ? JSON.stringify({ token: 't' }) : null) }, CB_API: 'http://api', document: { readyState: 'loading', addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, toggle() {} } }, querySelector: () => null, getElementById: () => null } };
let serve = null;
root.fetch = (url) => { calls.push(url); return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(serve(url)) }); };
const sandbox = vm.createContext({ module: { exports: {} }, window: root, globalThis: root, setInterval() {}, setTimeout() {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'engine', 'money.js'), 'utf8'), sandbox, { filename: 'money.js' });
sandbox.CBMoney = sandbox.module.exports;
for (const part of ['helpers.js', 'assign-bar.js', 'books-practice-band.js', 'books-practice-cells.js', 'books-practice.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', part), 'utf8'), sandbox, { filename: part });
const T = root.CBPractice.parts;
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('  ok  ', n); } catch (e) { fail++; console.log('  FAIL', n, '\n      ', e.message); } };
const SEED = [['books_in', 65], ['complete', 30], ['checked', 21], ['ready', 21], ['lodged', 13]];
const ALL = []; for (const [stage, n] of SEED) for (let k = 0; k < n; k++) ALL.push({ entity_id: 'c' + ALL.length, name: 'Client ' + ALL.length, stage });
const band = { bands: [{ key: 'pipeline', first: true, tiles: SEED.map(([key, n]) => ({ key, n })) }] };
const answerOf = (url, max, whole) => {
  const q = new URL(url).searchParams; if (!q.has('page') && !q.has('limit')) return whole ? { band, clients: ALL, total: 150, page: 1, limit: 150, has_more: false } : pageAt(1, 100);
  return pageAt(Number(q.get('page') || 1), Math.min(Number(q.get('limit') || 50), max));
};
const pageAt = (page, limit) => ({ band, clients: ALL.slice((page - 1) * limit, page * limit), total: 150, page, limit, has_more: page * limit < 150 });

(async () => {
  await t('the server answers the whole list: one read, 150 rows, the count 150', async () => {
    calls.length = 0; serve = (u) => answerOf(u, 200, true);
    const a = await T.readAll();
    assert.deepStrictEqual([a.clients.length, calls.length, T.clientCount(a)], [150, 1, 150]);
  });
  await t('the server answers a first page of 100 with has_more: the rest is read, 150 rows in order, no row doubled', async () => {
    calls.length = 0; serve = (u) => answerOf(u, 200, false);
    const a = await T.readAll();
    assert.strictEqual(a.clients.length, 150);
    assert.deepStrictEqual(a.clients.map((c) => c.entity_id), ALL.map((c) => c.entity_id));
    assert.ok(/page=2&limit=100/.test(calls[1]), calls.join(' '));
    assert.strictEqual(a.has_more, false);
  });
  await t('the stage tiles are the server\'s band (65 / 30 / 21 / 21 / 13), not counted from rows, and the head count is the server\'s total', async () => {
    serve = (u) => answerOf(u, 200, false);
    const a = await T.readAll();
    assert.deepStrictEqual(a.band.bands[0].tiles.map((x) => x.n), [65, 30, 21, 21, 13]);
    assert.strictEqual(T.clientCount(Object.assign({}, a, { clients: a.clients.slice(0, 100) })), 150, 'the total, when only 100 rows are in hand');
    assert.strictEqual(T.clientCount({ clients: ALL }), 150, 'no total: the rows');
  });
  await t('a page that fails halfway keeps the rows already read (never an empty practice)', async () => {
    let n = 0; serve = (u) => (n++ ? { clients: [], has_more: false } : pageAt(1, 100));
    const a = await T.readAll();
    assert.strictEqual(a.clients.length, 100);
  });
  console.log('\n' + (pass + fail) + ' checks (' + pass + ' passed, ' + fail + ' failed)');
  process.exit(fail ? 1 : 0);
})();
