/* tests/onep1-return-one-path.test.cjs — ONEP-1 (PM/ONE-PATH-AUDIT-2026-11-27 rows 1 and 2): ONE READ PATH, ROLES RESTRICT. The tax return (AU BAS · AE VAT201 · IN rail sentence) is read by ONE screen
 * (cap-period.js peGstView, accounts.html tab gstclose) for the owner, the adviser and the auditor; the firm's network view has no return fetch of its own, only a door to that screen.
 * HAND (values written first; the server's answer is the carried total, nothing is computed here):
 *   AU  BAS     net 365850 · boxes G1 1000000 · 1A 90909      AE  VAT201  net -1500 · box 14 -1500      IN  form null · RETURN_FROM_RAIL · the rail sentence
 *   Owner, adviser and auditor each open it: the SAME api calls (name + query) in the same order and the SAME answer painted; a seat's device picks (stagger, emirate held in localStorage) are never sent
 *   and never written to the client's setup (zero writes); the owner's own pick still reaches the setup (positive control).
 * GUARD (the enforcer): no firm / auditor view file fetches a return (GET /returns, readReturns, perReturn, a 'bas' report). The check runs on the real files and on three MUTATIONS, each of which must go red.
 * CARD 14-accounting/tax-return   */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok   ' + name); });

/* ---- the owner's screen, driven for each seat ---- */
const cap = read('public/app/cap-period.js'), stock = read('public/app/cap-period-stock.js');
const grab = (src, name) => { const m = new RegExp(String.raw`(?:async )?function ${name}\([^)]*\) \{[\s\S]*?\n\}\n`).exec(src); assert.ok(m, name + ' not found'); return m[0]; };
const code = ['const peRetKey = () => "cb_ret_shop";', grab(cap, 'peRetRemember'), grab(cap, 'peRetRecall'), grab(cap, 'peBusyDay'), grab(cap, 'peReturnLoad'), grab(stock, 'peSetupKeep'), grab(cap, 'peGstView')].join('\n');
const ANSWERS = {
  AU: { form: 'BAS', short: 'BAS', net_minor: 365850, boxes: [{ code: 'G1', amount_minor: 1000000 }, { code: '1A', tax_minor: 90909 }] },
  AE: { form: 'VAT201', short: 'VAT return', net_minor: -1500, boxes: [{ code: '14', tax_minor: -1500 }] },
  IN: { form: null, code: 'RETURN_FROM_RAIL', why: 'Your GSTR-1 and GSTR-3B are made from your bills, not from these books.' }
};
async function open(pack, owner, held, answerOverride) {
  const calls = [], painted = [], body = { innerHTML: '' }, store = { cb_ret_shop: held ? JSON.stringify(held) : null };
  const ctx = {
    PE_RET: { r: null, q: {}, api: null, block: '', why: '' }, JSON, Object, String, Number, Date, Promise,
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { calls.push(['localStorage.setItem', k]); store[k] = v; } },
    bkIsOwner: () => owner, tx: (s) => s, esc: (s) => String(s), bkErr: (e) => String(e), bkQuiet: (w, f, fb) => fb,
    peReturnWord: () => {}, peReturnPaint: (r) => painted.push(r), peNoOwner: () => '[owner-only]', peOwnerOnlyCloses: () => '', peEl: () => null,
    api: async (name, o) => {
      calls.push([name, JSON.stringify((o && o.query) || null)]);
      if (name === 'booksPeriods') return { periods: [{ period: 1, entries: 3, end_date: '2026-09-30' }] };
      if (name === 'countrySetup') return { country: { code: pack }, currency: 'X', fy_start_month: 1 };
      if (name === 'countrySetupSave') return {};
      if (name === 'perReturn') return answerOverride || ANSWERS[pack];
      return {};
    }
  };
  ctx.peOwner = () => owner;
  vm.createContext(ctx);
  vm.runInContext(code + '\n;globalThis.__go = peGstView;', ctx);
  await ctx.__go(body);
  return { calls, painted, html: body.innerHTML, why: ctx.PE_RET.why };
}
const gets = (r) => r.calls.filter((c) => ['booksPeriods', 'perReturn', 'countrySetup'].includes(c[0])).map((c) => c.join('|'));
const writes = (r) => r.calls.filter((c) => c[0] === 'countrySetupSave' || c[0] === 'localStorage.setItem');

(async () => {
  for (const pack of ['AU', 'AE']) {
    await ok(pack + ': owner, adviser and auditor read the SAME return through the SAME calls', async () => {
      const own = await open(pack, true), adv = await open(pack, false), aud = await open(pack, false);
      assert.deepStrictEqual(gets(adv), gets(own)); assert.deepStrictEqual(gets(aud), gets(own));
      assert.deepStrictEqual(adv.painted, own.painted); assert.deepStrictEqual(aud.painted, own.painted);
      assert.strictEqual(own.painted[0].net_minor, ANSWERS[pack].net_minor);
    });
  }
  await ok('a seat holding picks on its own device asks the same query as the owner (picks never ride) and writes nothing', async () => {
    const own = await open('AE', true), seat = await open('AE', false, { stagger: 'monthly', emirate: 'Dubai', frequency: 'monthly' });
    assert.deepStrictEqual(gets(seat), gets(own));
    assert.deepStrictEqual(writes(seat), []);
  });
  await ok('a seat on a return waiting for the stagger never writes the client\'s setup; the owner still does (positive control)', async () => {
    const waiting = Object.assign({}, ANSWERS.AE, { needs: 'stagger', staggers: { 4: { monthly: true } } });
    const seat = await open('AE', false, { stagger: 'monthly', emirate: 'Dubai' }, waiting);
    assert.deepStrictEqual(writes(seat), [], JSON.stringify(seat.calls));
    const own = await open('AE', true, { stagger: 'monthly', emirate: 'Dubai' }, waiting);
    assert.ok(own.calls.some((c) => c[0] === 'countrySetupSave'), JSON.stringify(own.calls));
  });
  await ok('IN: a seat gets the rail sentence and the owner-only line, never an empty tab; it writes nothing', async () => {
    const seat = await open('IN', false);
    assert.strictEqual(seat.why, ANSWERS.IN.why);
    assert.ok(seat.html.includes(ANSWERS.IN.why) && seat.html.includes('[owner-only]'), seat.html);
    assert.deepStrictEqual(writes(seat), []);
  });

  /* ---- the guard ---- */
  const dir = path.join(__dirname, '..', 'public/app');
  const VIEW_FILES = fs.readdirSync(dir).filter((f) => /^books-grant-.*\.js$|^books-practice.*\.js$|^network.*\.js$/.test(f));
  /* books-grant-words.js names GET /returns in the activity-log sentence (what the seat did, not a fetch); books-practice.js 'bas' is the portfolio's Due column (a summary, no return read) */
  const EXEMPT = { 'books-grant-words.js': /GET \/returns/, 'books-practice.js': /'bas'/ };
  const BAN = [/readReturns/, /\/api\/books\/returns/, /perReturn/, /k: 'bas'/, /\/returns\b/];
  function offenders(files) {
    const out = [];
    Object.keys(files).forEach((f) => {
      let text = files[f];
      if (EXEMPT[f]) text = text.split('\n').filter((l) => !EXEMPT[f].test(l)).join('\n');
      BAN.forEach((re) => { if (re.test(text)) out.push(f + ' ~ ' + re); });
    });
    return out;
  }
  const real = {}; VIEW_FILES.forEach((f) => { real[f] = read('public/app/' + f); });
  await ok('GUARD: no firm / auditor view file fetches a return of its own (' + VIEW_FILES.length + ' files read)', () => assert.deepStrictEqual(offenders(real), []));
  await ok('GUARD: the door opens the owner\'s gstclose screen in the seat, and the adviser may open it', () => {
    const view = real['books-grant-view.js'], acting = read('public/app/books-acting.js');
    assert.ok(/auditAddressOf\(.*'gstclose'/.test(view) && /id="bv_return"/.test(view) && /value: '_return'/.test(view));
    assert.ok(/tab === 'gstclose'\) && !!context && context\.role === 'adviser'/.test(acting));
  });
  const mutate = (file, fn) => Object.assign({}, real, { [file]: fn(real[file]) });
  await ok('MUTATION 1: re-adding the bas report entry goes red', () => assert.ok(offenders(mutate('books-grant-reports.js', (s) => s.replace('  ];', "    { k: 'bas', label: 'Tax return' }\n  ];"))).length > 0));
  await ok('MUTATION 2: re-adding readReturns to the reads goes red', () => assert.ok(offenders(mutate('books-grant-api.js', (s) => s.replace('var READS = {', "var READS = { readReturns: '/api/books/returns',"))).length > 0));
  await ok('MUTATION 3: a new firm file calling the return by its api name goes red', () => assert.ok(offenders(Object.assign({}, real, { 'books-grant-return.js': "api('perReturn', {})" })).length > 0));
  console.log('\n' + n + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
