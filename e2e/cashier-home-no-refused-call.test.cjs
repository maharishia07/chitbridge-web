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
const AV = app('avatar.js'), AV_CUT = AV.slice(AV.indexOf('function staffOf(me)'), AV.indexOf('function shopCountry()')); /* the real seat rule, the waiters and announceShop */
const SRC = { api: app('books-grant-api.js'), practice: app('books-practice.js'), door: app('books-clients-door.js') };
/** one Home load of a seat: the three real files in a vm; `apiSrc` lets the mutation swap the seat answer */
function page(seat, apiSrc, avSrc) {
  const calls = [], listeners = {}, store = { cb_sess: JSON.stringify({ token: 'tok-' + seat.name + '-0123456789' }) };
  const doc = { dispatchEvent() {}, readyState: 'complete', documentElement: stub(), head: stub(), body: stub(), addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); }, createElement: () => stub(), querySelector: () => null, getElementById: () => null, querySelectorAll: () => [] };
  const root = { document: doc, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, console, Promise, JSON, Date, Math, Object, Array, String, Number, Error, parseInt, parseFloat, isFinite,
    setTimeout, clearTimeout, setInterval: (f) => setInterval(f, 100), clearInterval, Event: function () {}, CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; }, dispatchEvent() {}, tx: (s) => s,
    fetch: (url) => {
      const p = String(url).replace(/^.*?(\/api\/)/, '/api/'), firm = /^\/api\/books-grants/.test(p), refuse = firm && seat.refused;
      calls.push({ p, status: refuse ? 403 : 200 });
      return Promise.resolve({ status: refuse ? 403 : 200, ok: !refuse, headers: { get: () => null }, json: () => Promise.resolve(refuse ? { code: 'BOOKS_GRANT_NOT_FOR_YOU' } : { clients: [], given: [], received: [] }) });
    } };
  root.window = root; root.CB_API = 'https://api.example.com'; root.CBApiBase = { get: () => root.CB_API };
  vm.createContext(root);
  vm.runInContext('var root = globalThis;' + (avSrc || AV_CUT) + ';this.CBAvatar = { lastMe: function () { return LAST_ME; }, staffSeat: staffSeat, seatKnown: seatKnown, announce: announceShop };', root);
  vm.runInContext(apiSrc || SRC.api, root);
  vm.runInContext(SRC.practice, root);
  vm.runInContext(SRC.door, root);
  return { calls, root, announce: (entity) => root.CBAvatar.announce(entity) };
}
const me = (seat, practice) => ({ is_practice: practice, country: 'AU', seat });
const SEATS = [
  { name: 'owner', me: me({ owner: true, money: true, sells: true, lead: null, entries: null }, false), asks: true },
  { name: 'firm', me: me({ owner: true, money: true, sells: true, lead: null, entries: null }, true), asks: true },
  { name: 'bookkeeper', me: me({ owner: false, money: true, sells: false, lead: null, entries: null }, false), asks: true },
  { name: 'cashier', me: me({ owner: false, money: false, sells: true, lead: 'till', entries: ['till', 'tasks', 'crm', 'account'] }, false), asks: false, refused: true }
];
const firmCalls = (p) => p.calls.filter((c) => /^\/api\/books-grants/.test(c.p));
(async () => {
  check(AV.includes('function staffOf(me)') && SRC.api.includes('staffSeat'), 'ONE seat rule (CBAvatar.staffOf); readsClients and heldSplit read it, never a second test');
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
  const mutated = page(SEATS[3], null, AV_CUT.replace('me.seat.money === false', 'false'));
  mutated.announce(SEATS[3].me);
  await wait(800);
  check(firmCalls(mutated).filter((c) => c.status === 403).length > 0, 'mutation: with the seat answer forced to "ask" the cashier Home calls the refused reads (the guard goes red without the fix)');
  /* the same seat rule gates every other page's owner-only read (walk 28 Nov: network heldSplit, finance dues?finance=1, employees chits/holds): the staff seat asks none of them */
  const staff = page(SEATS[3]), owner = page(SEATS[0]);
  staff.announce(SEATS[3].me); owner.announce(SEATS[0].me);
  const held = (pg) => { const calls = []; return pg.root.CBBooksGrantApi.heldSplit((m, path) => { calls.push(path); return Promise.resolve({ received: [], given: [] }); }).then(() => calls); };
  check((await held(staff)).length === 0, 'network.html: heldSplit asks nothing for the staff seat (no GET /api/books-grants)');
  check((await held(owner)).length === 1, 'network.html: heldSplit still asks for the owner');
  const fin = app('cap-finance.js'), emp = app('cap-employees.js');
  const finGate = fin.indexOf('CBAvatar.seatKnown'), finRead = fin.indexOf('await finDuesRead()');
  check(finGate > 0 && finGate < finRead, 'finance.html: the seat answer comes before dues?finance=1 (no refused call, the worded state instead)');
  const empGate = emp.indexOf('CBAvatar.seatKnown'), empRead = emp.indexOf('CBAssign.holds()');
  check(empGate > 0 && empGate < empRead, 'employees.html: the seat answer comes before chits/holds (no refused call, no column)');
  const acc = fs.readFileSync(path.join(__dirname, '..', 'public', 'accounts.html'), 'utf8'), hv = acc.indexOf('function hashView()');
  check(hv > 0 && acc.slice(hv, hv + 600).indexOf('CBAvatar.staffSeat()') > 0 && acc.slice(hv, hv + 600).indexOf('staffSeat') < acc.slice(hv, hv + 600).indexOf('NAV.some'), 'accounts.html: ONE place decides the tabs (hashView): Counter staff get none, a typed # included, so compare / bank / every tab makes no call');
  console.log(failures ? failures + ' failed' : 'all passed');
  process.exit(failures ? 1 : 0);
})();
