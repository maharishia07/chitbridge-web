'use strict';
// @type: unit
/**
 * cashier-home-no-refused-call.test.cjs - walk 28 Nov (screen watch, sit-au, Counter-staff seat): Home asked GET /api/books-grants/practice and GET /api/books-grants on EVERY visit and was refused (403).
 *
 * OWNS      the proof that a staff seat's Home makes NO refused call: the one seat answer (CBBooksGrantApi.readsClients, read from the one /me announcement cb:me) gates BOTH firm reads on Home
 *           (books-practice.js tick: the practice list; books-clients-door.js tick: the Your-clients door). No browser, no api: the real files run in a vm with a recording fetch that answers 403 to every
 *           firm read for a staff seat, as the api does (lib/role-matrix OWNER_AND_FIRM_SEATS: staff deny).
 * CALLED BY CI (offline guards) · by hand: node e2e/cashier-home-no-refused-call.test.cjs
 * CARD      04-network/ACC-176B-ADVISER-REQUIREMENT
 * Seats: the owner, a firm person, a whole-business actor and a manager still ask; a plain staff actor of a shop asks nothing; before /me answers nothing is asked yet.
 * Mutation: the one seat answer forced to "ask" must make the cashier's Home call the refused reads again (the guard goes red without the fix).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const app = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** a permissive DOM stand-in: any property read answers another stand-in, any call answers one (Home's drawing is not under test, the calls are) */
function stub() {
  const fn = function () { return stub(); };
  return new Proxy(fn, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'then' ? undefined : k === 'style' ? {} : k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains: () => false } : stub()),
    set: () => true,
    apply: () => stub()
  });
}
const SRC = { api: app('books-grant-api.js'), practice: app('books-practice.js'), door: app('books-clients-door.js') };
/** one Home load of a seat: the three real files in a vm; `apiSrc` lets the mutation swap the seat answer */
function page(seat, apiSrc) {
  const calls = [], listeners = {}, store = { cb_sess: JSON.stringify({ token: 'tok-' + seat.name + '-0123456789' }) };
  const doc = { readyState: 'complete', documentElement: stub(), head: stub(), body: stub(), addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); }, createElement: () => stub(), querySelector: () => null, getElementById: () => null, querySelectorAll: () => [] };
  const root = { document: doc, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, console, Promise, JSON, Date, Math, Object, Array, String, Number, Error, parseInt, parseFloat, isFinite,
    setTimeout, clearTimeout, setInterval: (f) => setInterval(f, 100), clearInterval, Event: function () {}, CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; }, dispatchEvent() {}, tx: (s) => s,
    fetch: (url) => {
      const p = String(url).replace(/^.*?(\/api\/)/, '/api/'), firm = /^\/api\/books-grants/.test(p), refuse = firm && seat.refused;
      calls.push({ p, status: refuse ? 403 : 200 });
      return Promise.resolve({ status: refuse ? 403 : 200, ok: !refuse, headers: { get: () => null }, json: () => Promise.resolve(refuse ? { code: 'BOOKS_GRANT_NOT_FOR_YOU' } : { clients: [], given: [], received: [] }) });
    } };
  root.window = root; root.CB_API = 'https://api.example.com'; root.CBApiBase = { get: () => root.CB_API };
  vm.createContext(root);
  vm.runInContext(apiSrc || SRC.api, root);
  vm.runInContext(SRC.practice, root);
  vm.runInContext(SRC.door, root);
  return { calls, announce: (detail) => (listeners['cb:me'] || []).forEach((f) => f({ detail })) };
}
const me = (actor, whole, hat, practice) => ({ country: 'AU', ledger_on: true, is_practice: practice, seat: { actor, whole_entity: whole, hat } });
const SEATS = [
  { name: 'owner', me: me(false, false, null, false), asks: true },
  { name: 'firm', me: me(false, false, null, true), asks: true },
  { name: 'whole', me: me(true, true, 'act', false), asks: true },
  { name: 'manager', me: me(true, false, 'manager', false), asks: true },
  { name: 'cashier', me: me(true, false, 'act', false), asks: false, refused: true }
];
const firmCalls = (p) => p.calls.filter((c) => /^\/api\/books-grants/.test(c.p));
(async () => {
  check(SRC.api.includes('? true : meSeat;'), 'the one seat answer is in books-grant-api.js (readsClients)');
  check(SRC.api.includes('SEAT_WAIT_MS'), 'a /me that never answers does not hide a firm Home for ever (the page asks after the wait)');
  for (const seat of SEATS) {
    const p = page(seat);
    await wait(600);
    check(firmCalls(p).length === 0, seat.name + ': before /me answers, no firm read is made (the page waits for the seat)');
    p.announce(seat.me);
    await wait(800);
    const firm = firmCalls(p);
    if (seat.asks) check(firm.length > 0, seat.name + ': still asks the firm reads: ' + firm.map((c) => c.p).join(' '));
    else check(firm.length === 0, seat.name + ': Counter staff asks NO firm read on Home (' + firm.length + ' calls)');
    check(p.calls.filter((c) => c.status >= 400).length === 0 || seat.asks, seat.name + ': zero 4xx calls');
  }
  const mutated = page(SEATS[4], SRC.api.replace('? true : meSeat;', '? true : true;'));
  await wait(800);
  check(firmCalls(mutated).filter((c) => c.status === 403).length > 0, 'mutation: with the seat answer forced to "ask" the cashier Home calls the refused reads (the guard goes red without the fix)');
  console.log(failures ? failures + ' failed' : 'all passed');
  process.exit(failures ? 1 : 0);
})();
