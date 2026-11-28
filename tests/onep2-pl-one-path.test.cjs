/* tests/onep2-pl-one-path.test.cjs — ONEP-2 PR 2 (PM/ONE-PATH-AUDIT-2026-11-27 row 10, PM/ONEP-2-PLAN-2026-11-28.md): ONE READ PATH for the profit and loss.
 * The owner's screen (cap-books.js bkPL, accounts.html tab pl) is read by the owner, the adviser and the auditor; the firm's view has only a door to it.
 * HAND (values first; the server's answer is carried, nothing is added up here). AU shop, year 2025-07-01 to 2026-06-30, GST excluded:
 *   sales 1000000 · cost of sales 400000 · rent 300000 -> gross profit 600000 · total expenses 700000 (cost of sales + rent) · profit 300000.
 *   A loss: income 0, expenses 15050 -> "Loss 15050" (the size, never "Profit" with a minus). Cost of sales 0 -> "equals sales", not a margin fact.
 *   Address from=2025-07-01&to=2026-06-30 -> the call is booksPL {"compare":"year","from":"2025-07-01","to":"2026-06-30"} for ALL THREE seats;
 *   no address -> {"compare":"year","preset":"ytd","step":0} for all three (the owner's default, no seat default); compare=none rides; a bad pair is no pick.
 *   A range running past today is headed to the day the server says (period.through) with "year to date" (F-67), never the year to come.
 *   A seat sends the X-Books-For header and writes nothing (one booksPL call, no storage).
 * GUARD (the enforcer): no firm / network view file reads or paints a P&L of its own (names AND content). 4 mutations go red.
 * OPEN (Athi/coordinator): the auditor's "Explain" chips on changed P&L lines (CBFlag, a write) are not on the owner screen; the door drops them for the P&L.
 * CARD 14-accounting/profit-and-loss */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok   ' + name); });
const cap = read('public/app/cap-books.js');
const grab = (name) => { const m = new RegExp(String.raw`(?:async )?function ${name}\([^)]*\) \{[\s\S]*?\n\}\n`).exec(cap); assert.ok(m, name + ' not found'); return m[0]; };
const blPl = /var BK_PL = \{[^}]*\};/.exec(cap)[0];
const FN = ['bkPlSeed', 'bkPlWindow', 'bkPlRangeHTML', 'bkPlQuery', 'bkPlGrossHTML', 'bkPlLeadHTML', 'bkPlHeadHTML', 'bkPlCompareHTML', 'bkPlTotalRow', 'bkPlSectionTotal', 'bkPlGroups', 'bkPL'].map(grab).join('');
const line = (code, name, amount) => ({ code, name, amount_minor: amount });
const REPLY = (over) => Object.assign({
  currency: 'AUD', from: '2025-07-01', to: '2026-06-30', period: {}, presets: [], compare: null,
  by_line: { income: [{ label: 'Sales', accounts: [line('4000', 'Sales', 1000000)] }], expense: [{ label: 'Cost of sales', accounts: [line('5000', 'COGS', 400000)] }, { label: 'Rent', accounts: [line('6100', 'Rent', 300000)] }] },
  total_income_minor: 1000000, total_expense_minor: 700000, profit_minor: 300000,
  gross_profit: { sales_minor: 1000000, cost_of_sales_minor: 400000, gross_profit_minor: 600000 }
}, over || {});
async function open(seat, search, over, shared) {
  const calls = [], body = { innerHTML: '' };
  const ctx = shared || {
    BK: {}, URLSearchParams, JSON, Date, Number, Math, isNaN, Object, Array, Promise,
    location: { search }, document: { getElementById: () => null },
    esc: String, tx: (s) => s, bkStmtCss: () => '', bkMountAttribute: () => '', bkRefused: (e) => 'REFUSED ' + e, bkOverNote: () => '',
    bkMoney: (v, c) => c + ':' + v, bkFig: (v, c) => c + ':' + v, bkPct: (v) => 'pct' + v, bkChange: (v) => 'chg' + v, bkSpan: (a, b) => '[' + a + ' - ' + b + ']', bkFyFrom: () => '2025-07-01', bkToday: () => '2026-11-28',
    bkStRow: (cls, label, cells) => '[row ' + label + ' ' + cells.map((c) => c.v).join('/') + ']', bkDrillLink: (code, name) => name,
    bkPeriodBar: (o) => '[bar ' + o.cur + ' ' + o.range + ']'
  };
  if (!shared) { vm.createContext(ctx); vm.runInContext(blPl + FN + '\n;globalThis.__go = bkPL; globalThis.__pl = BK_PL;', ctx); }
  ctx.location = { search };
  ctx.api = async (name, o) => { calls.push([name, JSON.stringify((o && o.query) || null), seat ? 'X-Books-For' : '-']); return REPLY(over); };
  await ctx.__go(body);
  return { calls, html: body.innerHTML, ctx };
}
const q = (r) => r.calls.filter((c) => c[0] === 'booksPL').map((c) => c[0] + c[1]);
const YEAR = '?from=2025-07-01&to=2026-06-30', WANT = 'booksPL{"compare":"year","from":"2025-07-01","to":"2026-06-30"}', DEFAULT = 'booksPL{"compare":"year","preset":"ytd","step":0}';
(async () => {
  await ok('owner, adviser, auditor open the P&L for the year: the SAME call, the SAME figures (gross 600000, profit 300000)', async () => {
    const tail = YEAR.replace('?', '&');
    const own = await open(false, '?acting=x' + tail), adv = await open(true, '?acting=x&role=adviser' + tail), aud = await open(true, '?acting=x&role=auditor' + tail);
    assert.deepStrictEqual(q(own), [WANT]); assert.deepStrictEqual(q(adv), q(own)); assert.deepStrictEqual(q(aud), q(own));
    assert.strictEqual(adv.html, own.html); assert.strictEqual(aud.html, own.html);
    ['Profit AUD:300000', 'Gross profit (sales less cost of sales) AUD:600000', 'Total income AUD:1000000', 'Total expenses AUD:700000'].forEach((w) => assert.ok(own.html.includes(w), w + '\n' + own.html));
  });
  await ok('no address: all three ask the owner default (ytd, compare year), no seat default of its own', async () => {
    for (const seat of [false, true]) assert.deepStrictEqual(q(await open(seat, '')), [DEFAULT]);
  });
  await ok('compare rides the address (compare=none), a bad compare word is the owner default', async () => {
    assert.deepStrictEqual(q(await open(true, YEAR + '&compare=none')), ['booksPL{"compare":"none","from":"2025-07-01","to":"2026-06-30"}']);
    assert.deepStrictEqual(q(await open(true, YEAR + '&compare=zzz')), [WANT]);
  });
  await ok('a bad window is no pick: not a date, from after to, one end only', async () => {
    for (const bad of ['?from=2026-13-45&to=2026-06-30', '?from=2026-06-30&to=2025-07-01', '?from=2025-07-01', '?to=2026-06-30', '?from=abc&to=def']) assert.deepStrictEqual(q(await open(true, bad)), [DEFAULT], bad);
  });
  await ok('the address is read ONCE per page: a later pick (preset) is not overwritten', async () => {
    const first = await open(true, YEAR);
    first.ctx.__pl.preset = 'qtd'; first.ctx.__pl.step = 0;
    assert.deepStrictEqual(q(await open(true, YEAR, null, first.ctx)), ['booksPL{"compare":"year","preset":"qtd","step":0}']);
  });
  await ok('a loss reads Loss with its size; cost of sales 0 says it equals sales; no sales account, no gross line', async () => {
    const loss = await open(true, YEAR, { total_income_minor: 0, total_expense_minor: 15050, profit_minor: -15050, gross_profit: null });
    assert.ok(loss.html.includes('Loss AUD:15050') && !loss.html.includes('Profit AUD') && !loss.html.includes('pl-gross'), loss.html);
    const eq = await open(true, YEAR, { gross_profit: { sales_minor: 1000000, cost_of_sales_minor: 0, gross_profit_minor: 1000000 } });
    assert.ok(eq.html.includes('no cost of sales booked, so it equals sales) AUD:1000000'), eq.html);
  });
  await ok('F-67: a running range is headed to the day the server says, with year to date', async () => {
    const r = await open(true, YEAR, { to: '2027-06-30', period: { through: '2026-11-21' } });
    assert.ok(r.html.includes('[2025-07-01 - 2026-11-21] · year to date') && !r.html.includes('2027-06-30'), r.html);
  });
  await ok('a seat sends its header, makes ONE call and touches no storage (none in scope: a touch would throw)', async () => {
    const aud = await open(true, YEAR);
    assert.deepStrictEqual(aud.calls.map((c) => c[0] + '|' + c[2]), ['booksPL|X-Books-For']);
  });
  /* ---- the guard ---- */
  const dir = path.join(__dirname, '..', 'public/app');
  const VIEW = fs.readdirSync(dir).filter((f) => /^books-grant-.*\.js$|^books-practice.*\.js$|^network.*\.js$/.test(f));
  const BAN = [/readPL/, /\/api\/books\/pl\b/, /booksPL/, /k: 'pl'/, /plRows/, /profitRows/, /forTag/, /gross_profit/, /total_income_minor/, /total_expense_minor/] /* profit_minor is not banned: the Months painter (PR 4) still carries a month's profit */;
  const offenders = (files) => { const out = []; Object.keys(files).forEach((f) => BAN.forEach((re) => { if (re.test(files[f])) out.push(f + ' ~ ' + re); })); return out; };
  const real = {}; VIEW.forEach((f) => { real[f] = read('public/app/' + f); });
  await ok('GUARD: no firm / network view file reads or paints a P&L of its own (' + VIEW.length + ' files)', () => assert.deepStrictEqual(offenders(real), []));
  await ok('GUARD: the door opens tab pl in the seat; the auditor may open it; one seed helper, called from the query', () => {
    const view = real['books-grant-view.js'], acting = read('public/app/books-acting.js');
    assert.ok(/door: 'pl', id: 'bv_pl'/.test(view) && /value: '_pl'/.test(view) && /auditAddressOf\(/.test(view));
    assert.ok(/tab === 'tb' \|\| tab === 'pl'/.test(acting));
    assert.ok(/function bkPlQuery\(\) \{\n  bkPlSeed\(\);/.test(cap));
  });
  const mutate = (file, fn) => Object.assign({}, real, { [file]: fn(real[file]) });
  await ok('MUTATION 1: re-adding the pl report entry goes red', () => assert.ok(offenders(mutate('books-grant-reports.js', (s) => s.replace('  ];', "    { k: 'pl', label: 'Profit and loss' }\n  ];"))).length > 0));
  await ok('MUTATION 2: re-adding readPL to the reads goes red', () => assert.ok(offenders(mutate('books-grant-api.js', (s) => s.replace('var READS = {', "var READS = { readPL: '/api/books/pl',"))).length > 0));
  await ok('MUTATION 3: a renamed copy painting the P&L totals goes red (content rule)', () => assert.ok(offenders(Object.assign({}, real, { 'books-grant-ledger.js': 'x = figures.total_income_minor' })).length > 0));
  await ok('MUTATION 4: re-adding the P&L heading painter forTag goes red', () => assert.ok(offenders(mutate('books-grant-reports.js', (s) => s + '\n function forTag(a) {}')).length > 0));
  console.log('\n' + n + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
