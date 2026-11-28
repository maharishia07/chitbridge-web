/* tests/onep2-tb-one-path.test.cjs — ONEP-2 PR 1 (PM/ONE-PATH-AUDIT-2026-11-27 row 9, PM/ONEP-2-PLAN-2026-11-28.md): ONE READ PATH for the trial balance.
 * The owner's screen (cap-books.js bkTB, accounts.html tab tb) is read by the owner, the adviser and the auditor; the firm's view has only a door to it.
 * HAND (values first; the server's answer is the carried total, nothing is added up here):
 *   AU shop, fixture: 1000 Cash Dr 500000 · 4000 Sales Cr 500000 -> total Dr 500000 = total Cr 500000, "balances".
 *   Address to=2026-06-30 -> the call is booksTB {"asOf":"2026-06-30"} for ALL THREE; no address -> {"asOf":<today>} for all three;
 *   a bad address day (2026-13-45, "abc") is no pick -> today; the address is read ONCE per page (a second open asks today).
 *   A seat sends the X-Books-For header and writes nothing (no non-GET, no localStorage).
 * GUARD (the enforcer): no firm / network view file reads a trial balance of its own (names AND content: a Dr/Cr column of its own). 3 mutations go red.
 * CARD 14-accounting/trial-balance */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok   ' + name); });
const cap = read('public/app/cap-books.js');
const grab = (name) => { const m = new RegExp(String.raw`(?:async )?function ${name}\([^)]*\) \{[\s\S]*?\n\}\n`).exec(cap); assert.ok(m, name + ' not found'); return m[0]; };
const FIX = { currency: 'AUD', rows: [{ code: '1000', name: 'Cash', dr_minor: 500000 }, { code: '4000', name: 'Sales', cr_minor: 500000 }], total_dr_minor: 500000, total_cr_minor: 500000 };
async function open(seat, search, state) {
  const calls = [], body = { innerHTML: '' };
  const ctx = {
    BK: state || { tbDay: '' }, URLSearchParams, JSON, Date, Number, Promise, isNaN, Object,
    window: {}, location: { search }, document: { getElementById: () => null },
    bkToday: () => '2026-11-28', esc: String, tx: (s) => s, bkStmtCss: () => '', bkTbBarHTML: (d, good) => '[bar ' + d + (good ? ' balances' : ' off') + ']',
    bkTbRowHTML: (x) => '[' + x.code + ' ' + (x.dr_minor || '') + '|' + (x.cr_minor || '') + ']', bkTbTotalRowHTML: (r) => '[total ' + r.total_dr_minor + '/' + r.total_cr_minor + ']',
    bkTable: (h, rows, tot) => rows + tot, bkOverNote: () => '', bkRefused: (e) => 'REFUSED ' + e, bkTbBankOptions: () => ({}),
    api: async (name, o) => { calls.push([name, JSON.stringify((o && o.query) || null), seat ? 'X-Books-For' : '-']); return FIX; }
  };
  vm.createContext(ctx);
  vm.runInContext(grab('bkCarriedDay') + grab('bkTbSeedDay') + grab('bkTbDay') + grab('bkTB') + '\n;globalThis.__go = bkTB;', ctx);
  await ctx.__go(body);
  return { calls, html: body.innerHTML };
}
const q = (r) => r.calls.filter((c) => c[0] === 'booksTB').map((c) => c[0] + c[1]);
(async () => {
  await ok('owner, adviser, auditor open the TB with to=2026-06-30: the SAME call, the SAME figures (500000 = 500000)', async () => {
    const own = await open(false, '?acting=x&to=2026-06-30'), adv = await open(true, '?acting=x&role=adviser&to=2026-06-30'), aud = await open(true, '?acting=x&role=auditor&to=2026-06-30');
    assert.deepStrictEqual(q(own), ['booksTB{"asOf":"2026-06-30"}']);
    assert.deepStrictEqual(q(adv), q(own)); assert.deepStrictEqual(q(aud), q(own));
    assert.strictEqual(adv.html, own.html); assert.strictEqual(aud.html, own.html);
    assert.ok(own.html.includes('[total 500000/500000]') && own.html.includes('balances'), own.html);
  });
  await ok('no address: all three ask today, no seat default of its own', async () => {
    for (const seat of [false, true]) assert.deepStrictEqual(q(await open(seat, '')), ['booksTB{"asOf":"2026-11-28"}']);
  });
  await ok('a bad address day is no pick (today stays)', async () => {
    for (const bad of ['?to=2026-13-45', '?to=abc', '?to=']) assert.deepStrictEqual(q(await open(true, bad)), ['booksTB{"asOf":"2026-11-28"}'], bad);
  });
  await ok('the address is read ONCE per page: a second open asks today', async () => {
    const st = { tbDay: '' };
    assert.deepStrictEqual(q(await open(true, '?to=2026-06-30', st)), ['booksTB{"asOf":"2026-06-30"}']);
    assert.deepStrictEqual(q(await open(true, '?to=2026-06-30', st)), ['booksTB{"asOf":"2026-11-28"}']);
  });
  await ok('a typed day (BK.tbDay) beats the address', async () => assert.deepStrictEqual(q(await open(true, '?to=2026-06-30', { tbDay: '2026-03-31' })), ['booksTB{"asOf":"2026-03-31"}']));
  await ok('a seat sends its header and makes no other call', async () => {
    const aud = await open(true, '?to=2026-06-30');
    assert.ok(aud.calls.every((c) => c[0] === 'booksTB' && c[2] === 'X-Books-For'), JSON.stringify(aud.calls));
  });
  /* ---- the guard ---- */
  const dir = path.join(__dirname, '..', 'public/app');
  const VIEW = fs.readdirSync(dir).filter((f) => /^books-grant-.*\.js$|^books-practice.*\.js$|^network.*\.js$/.test(f));
  const BAN = [/readTB/, /\/api\/books\/trial-balance/, /booksTB/, /k: 'tb'/, /CBBankTbLine/, /CBTbChange/, /total_dr_minor/];
  const offenders = (files) => { const out = []; Object.keys(files).forEach((f) => BAN.forEach((re) => { if (re.test(files[f])) out.push(f + ' ~ ' + re); })); return out; };
  const real = {}; VIEW.forEach((f) => { real[f] = read('public/app/' + f); });
  await ok('GUARD: no firm / network view file reads or paints a trial balance of its own (' + VIEW.length + ' files)', () => assert.deepStrictEqual(offenders(real), []));
  await ok('GUARD: the door opens tab tb in the seat; the auditor and the adviser may open it', () => {
    const view = real['books-grant-view.js'], acting = read('public/app/books-acting.js');
    assert.ok(/auditAddressOf\(/.test(view) && /door: 'tb', id: 'bv_tb'/.test(view) && /_tb: 'tb'/.test(view));
    assert.ok(/AUDITOR_TABS = \[[^\]]*'gstclose', (?:'daybook', )?'tb'/.test(acting));
  });
  const mutate = (file, fn) => Object.assign({}, real, { [file]: fn(real[file]) });
  await ok('MUTATION 1: re-adding the tb report entry goes red', () => assert.ok(offenders(mutate('books-grant-reports.js', (s) => s.replace('  ];', "    { k: 'tb', label: 'Trial balance' }\n  ];"))).length > 0));
  await ok('MUTATION 2: re-adding readTB to the reads goes red', () => assert.ok(offenders(mutate('books-grant-api.js', (s) => s.replace('var READS = {', "var READS = { readTB: '/api/books/trial-balance',"))).length > 0));
  await ok('MUTATION 3: a renamed copy painting the trial balance totals goes red (content rule)', () => assert.ok(offenders(Object.assign({}, real, { 'books-grant-ledger.js': 'x = figures.total_dr_minor' })).length > 0));
  console.log('\n' + n + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
