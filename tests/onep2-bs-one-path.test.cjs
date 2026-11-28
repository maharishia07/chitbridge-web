/* tests/onep2-bs-one-path.test.cjs — ONEP-2 PR 3 (PM/ONE-PATH-AUDIT-2026-11-27 row 3, PM/ONEP-2-PLAN-2026-11-28.md): ONE READ PATH for the balance sheet.
 * The owner's screen (cap-books.js bkBS, accounts.html tab bs) is read by the owner, the adviser and the auditor; the firm's view has only a door to it.
 * HAND (values first; the server's answer is carried, nothing is added up here). AU shop, day 2026-06-30, year from 2025-07-01:
 *   assets: Cash 600000 + Stock 200000 = 800000 · liabilities: Loans 300000 · equity: Capital 300000 + Net profit to date 200000 = 500000
 *   -> liabilities + equity 800000 = assets 800000, "balances"; net assets 500000. A fixture the server calls balanced:false (800000 vs 799999) says "does not balance".
 *   The profit line carries its period: "Net profit 2025-07-01 – 2026-06-30"; a loss keeps the server's word: "Net loss 2025-07-01 – 2026-06-30".
 *   Address to=2026-06-30 -> the call is booksBS {"asOf":"2026-06-30"} for ALL THREE seats; no address -> {"kind":"today","step":0} for all three; a bad day is no pick; read ONCE per page.
 *   A year still running: asOf 2027-06-30, shown_as_at 2026-11-28 -> headed "as at 2026-11-28 · year to date", never the year to come.
 *   A seat sends X-Books-For and writes nothing.
 * GUARD (the enforcer): no firm / network view file reads or paints a balance sheet of its own (names AND content). 5 mutations go red.
 * CARD 14-accounting/balance-sheet */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok   ' + name); });
const cap = read('public/app/cap-books.js');
const grab = (name) => { const m = new RegExp(String.raw`(?:async )?function ${name}\([^)]*\) \{[\s\S]*?\n\}\n`).exec(cap); assert.ok(m, name + ' not found'); return m[0]; };
const FN = ['bkCarriedDay', 'bkBsSeed', 'bkBsShownDay', 'bkBsLineName', 'bkSpan', 'bkBsSide', 'bkBsRange', 'bkBsBalancedChip', 'bkBsHasChange', 'bkBsWas', 'bkBsLeadHTML', 'bkBS'].map(grab).join('');
const REPLY = (over) => Object.assign({
  currency: 'AUD', asOf: '2026-06-30', shown_as_at: '2026-06-30', fy_from: '2025-07-01', as_at: {}, compare: {}, groups: {},
  assets: [{ code: '1000', name: 'Cash', amount_minor: 600000 }, { code: '1200', name: 'Stock', amount_minor: 200000 }],
  liabilities: [{ code: '2000', name: 'Loans', amount_minor: 300000 }],
  equity: [{ code: '3000', name: 'Capital', amount_minor: 300000 }, { code: null, name: 'Net profit', role: 'profit_to_date', amount_minor: 200000 }],
  total_assets_minor: 800000, total_liabilities_minor: 300000, total_equity_minor: 500000, total_liab_equity_minor: 800000, net_assets_minor: 500000, balanced: true
}, over || {});
async function open(seat, search, over, state) {
  const calls = [], body = { innerHTML: '' };
  const ctx = {
    BK: state || {}, URLSearchParams, JSON, Date, Number, Promise, isNaN, Object, Array, String,
    location: { search }, document: { getElementById: () => null },
    esc: String, tx: (s) => s, bkStmtCss: () => '', bkMountAttribute: () => '', bkRefused: (e) => 'REFUSED ' + e, bkOverNote: () => '',
    bkMoney: (v, c) => c + ':' + v, bkFig: (v, c) => (v == null ? '-' : c + ':' + v), bkPct: (v) => 'pct' + v, bkChange: (v) => 'chg' + v, bkDate: (d) => d, bkFyFrom: () => '2025-07-01', bkToday: () => '2026-11-28',
    bkStRow: (cls, label, cells) => '[row ' + label + ' ' + cells.map((c) => c.v).join('/') + ']', bkDrillLink: (code, name) => name,
    bkPeriodBar: (o) => '[bar ' + o.cur + ' ' + o.range + ' ' + o.dates + ' ' + o.extra + ']'
  };
  vm.createContext(ctx);
  vm.runInContext("var BK_BS = { kind: 'today', step: 0, asOf: '' };" + FN + '\n;globalThis.__go = bkBS;', ctx);
  ctx.api = async (name, o) => { calls.push([name, JSON.stringify((o && o.query) || null), seat ? 'X-Books-For' : '-']); return REPLY(over); };
  await ctx.__go(body);
  return { calls, html: body.innerHTML, ctx };
}
const q = (r) => r.calls.filter((c) => c[0] === 'booksBS').map((c) => c[0] + c[1]);
const DAY = 'booksBS{"asOf":"2026-06-30"}', TODAY = 'booksBS{"kind":"today","step":0}';
(async () => {
  await ok('owner, adviser, auditor open the balance sheet with to=2026-06-30: the SAME call, the SAME figures (assets 800000 = liabilities + equity 800000)', async () => {
    const own = await open(false, '?acting=x&to=2026-06-30'), adv = await open(true, '?acting=x&role=adviser&to=2026-06-30'), aud = await open(true, '?acting=x&role=auditor&to=2026-06-30');
    assert.deepStrictEqual(q(own), [DAY]); assert.deepStrictEqual(q(adv), q(own)); assert.deepStrictEqual(q(aud), q(own));
    assert.strictEqual(adv.html, own.html); assert.strictEqual(aud.html, own.html);
    ['Total assets AUD:800000', 'Total liabilities AUD:300000', 'Total equity AUD:500000', 'Total liabilities and equity AUD:800000'].forEach((w) => assert.ok(own.html.includes(w), w + ' ' + own.html));
    assert.ok(own.html.includes('✓ balances') && own.html.includes('Net assets AUD:500000'), own.html);
  });
  await ok('the profit line carries its period (server name + fy_from to the heading day); a loss keeps the server word; no fy_from leaves the row as it is', async () => {
    const own = await open(false, '?to=2026-06-30');
    assert.ok(own.html.includes('Net profit 2025-07-01 – 2026-06-30'), own.html);
    const loss = await open(true, '?to=2026-06-30', { equity: [{ code: null, name: 'Net loss', role: 'profit_to_date', amount_minor: -50000 }] });
    assert.ok(loss.html.includes('Net loss 2025-07-01 – 2026-06-30') && !loss.html.includes('Net profit'), loss.html);
    const noFy = await open(true, '?to=2026-06-30', { fy_from: '' });
    assert.ok(noFy.html.includes('Net profit') && !noFy.html.includes('Net profit 20'), noFy.html);
  });
  await ok('no address: all three ask the owner default (today), no seat default of its own', async () => {
    for (const seat of [false, true]) assert.deepStrictEqual(q(await open(seat, '')), [TODAY]);
  });
  await ok('a bad address day is no pick', async () => {
    for (const bad of ['?to=2026-13-45', '?to=abc', '?to=']) assert.deepStrictEqual(q(await open(true, bad)), [TODAY], bad);
  });
  await ok('the address is read ONCE per page: a second open keeps the owner default', async () => {
    const first = await open(true, '?to=2026-06-30');
    const st = first.ctx.BK;
    assert.deepStrictEqual(q(first), [DAY]);
    assert.strictEqual(st.bsSeeded, true);
  });
  await ok('the chip is the SERVER verdict: balanced:false (800000 vs 799999) says it does not balance', async () => {
    const bad = await open(true, '?to=2026-06-30', { total_liab_equity_minor: 799999, balanced: false });
    assert.ok(bad.html.includes('⚠ does not balance') && !bad.html.includes('✓ balances'), bad.html);
  });
  await ok('a running year is headed to the day the server says (shown_as_at) with year to date; the day box says the same day', async () => {
    const r = await open(true, '?to=2027-06-30', { asOf: '2027-06-30', shown_as_at: '2026-11-28' });
    assert.ok(r.html.includes('as at 2026-11-28 · year to date') && !r.html.includes('2027-06-30'), r.html);
  });
  await ok('a seat sends its header, makes ONE call and touches no storage (none in scope: a touch would throw)', async () => {
    const aud = await open(true, '?to=2026-06-30');
    assert.deepStrictEqual(aud.calls.map((c) => c[0] + '|' + c[2]), ['booksBS|X-Books-For']);
  });
  /* ---- the guard ---- */
  const dir = path.join(__dirname, '..', 'public/app');
  const VIEW = fs.readdirSync(dir).filter((f) => /^books-grant-.*\.js$|^books-practice.*\.js$|^network.*\.js$/.test(f));
  const BAN = [/readBS/, /\/api\/books\/bs\b/, /booksBS/, /k: 'bs'/, /profitRow/, /total_assets_minor/, /total_liab_equity_minor/];
  const offenders = (files) => { const out = []; Object.keys(files).forEach((f) => BAN.forEach((re) => { if (re.test(files[f])) out.push(f + ' ~ ' + re); })); return out; };
  const real = {}; VIEW.forEach((f) => { real[f] = read('public/app/' + f); });
  await ok('GUARD: no firm / network view file reads or paints a balance sheet of its own (' + VIEW.length + ' files)', () => assert.deepStrictEqual(offenders(real), []));
  await ok('GUARD: the door opens tab bs in the seat; the auditor and the adviser may open it; one seed helper called from bkBS', () => {
    const view = real['books-grant-view.js'], acting = read('public/app/books-acting.js');
    assert.ok(/door: 'bs', id: 'bv_bs'/.test(view) && /_bs: 'bs'/.test(view) && /\['daybook', 'tb', 'pl', 'bs'\]\.forEach/.test(view) && /auditAddressOf\(/.test(view));
    assert.ok(/AUDITOR_TABS = \[[^\]]*'pl', 'bs'\]/.test(acting) && /var TABS = \[[^\]]*'bs'/.test(acting));
    assert.ok(/async function bkBS\(body\) \{\n  bkBsSeed\(\);/.test(cap) && /function bkBsSeed\(\) \{\n  var day = bkCarriedDay\('bsSeeded'\)/.test(cap));
  });
  const mutate = (file, fn) => Object.assign({}, real, { [file]: fn(real[file]) });
  await ok('MUTATION 1: re-adding the bs report entry goes red', () => assert.ok(offenders(mutate('books-grant-reports.js', (s) => s.replace('  ];', "    { k: 'bs', label: 'Balance sheet' }\n  ];"))).length > 0));
  await ok('MUTATION 2: re-adding readBS to the reads goes red', () => assert.ok(offenders(mutate('books-grant-api.js', (s) => s.replace('var READS = {', "var READS = { readBS: '/api/books/bs',"))).length > 0));
  await ok('MUTATION 3: a renamed copy painting the balance sheet totals goes red (content rule)', () => assert.ok(offenders(Object.assign({}, real, { 'books-grant-ledger.js': 'x = figures.total_assets_minor' })).length > 0));
  await ok('MUTATION 4: re-adding the profit line painter profitRow goes red', () => assert.ok(offenders(mutate('books-grant-reports.js', (s) => s + '\n function profitRow(r) {}')).length > 0));
  await ok('MUTATION 5: a chip that is always true (the server verdict dropped) goes red', () => {
    const has = (src) => /ok = reply\.balanced != null \? !!reply\.balanced/.test(src);
    assert.ok(has(cap)); assert.ok(!has(cap.replace('reply.balanced != null ? !!reply.balanced', 'true')));
  });
  console.log('\n' + n + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
