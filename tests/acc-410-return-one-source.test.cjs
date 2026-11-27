/* tests/acc-410-return-one-source.test.cjs — ACC-410 (walk AE 27 Nov, P1) + ACC-411: the VAT period and the Emirate are the SHOP's setup answers, so the owner, the adviser and the auditor read the same return.
 * HAND  A shop that holds no VAT period: the return answers `needs: stagger` + the authority's sentence. The firm view then says that sentence (never "Nothing to show here") and draws no net (never "To pay or refund AED 0.00").
 *       The owner's pick "Monthly" is kept as the shop's setup answer period = the pack's monthly key ('4'), Emirate Dubai = region: PUT country-setup { country, currency, fy_start_month, particulars: { period: '4', region: 'Dubai' } }.
 *       The device no longer sends its own stagger or Emirate: the server reads the held ones for any seat. The month that has begun is asked at today (the server ignores a day still to come), so the return opens on the month that holds the entries.
 * Proof of the api half (the same boxes for the owner and the firm seat): chitbridge-api tests/books-returns.test.cjs (ACC-410 block).   CARD 14-accounting/tax-return */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public/app', f), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok   ' + name); });

/* the firm view ---------------------------------------------------------------------------------------------- */
const root = { tx: (s) => s, esc: (s) => String(s == null ? '' : s), shopDay: (d) => 'D' + String(d).slice(0, 10), document: { getElementById: () => null }, location: { search: '' }, Promise, Date, JSON, Math, Object, Array, String, Number };
root.window = root; root.globalThis = root; vm.createContext(root);
vm.runInContext(read('books-grant-reports.js'), root);
const kit = root.CBBooksGrantKit; kit.words = (s) => s; kit.minorWords = (m) => 'AED ' + (m / 100).toFixed(2);
const bas = kit.REPORTS.filter((r) => r.k === 'bas')[0];
const WHY = 'The FTA assigns the Tax Period (ER Art. 62): say which stagger.';
const waiting = { needs: 'stagger', why: WHY, net_minor: 0, boxes: [], periods: [] };
const held = { period: { label: 'Nov 2026', due: '2026-12-28' }, net_minor: -1500, boxes: [{ code: '14', tax_minor: -1500 }] };

(async () => {
  await ok('firm view: a return waiting on the shop draws no net (no "To pay or refund AED 0.00")', () => {
    kit.viewState = { answer: waiting, report: 'bas', day: '' };
    assert.strictEqual(kit.facts(bas), '');
  });
  await ok('firm view: a return the shop has set up still shows the server\'s own net', () => {
    kit.viewState = { answer: held, report: 'bas', day: '' };
    assert.ok(kit.facts(bas).includes('AED -15.00'), kit.facts(bas));
  });
  await ok('firm view: the empty state says what the return waits for (the server\'s sentence), not "Nothing to show here"', () => {
    const src = read('books-grant-list.js');
    assert.ok(/report\.k === 'bas' && grantKit\.viewState\.answer && grantKit\.viewState\.answer\.needs/.test(src));
    assert.ok(/viewState\.answer\.why/.test(src) && /This return is waiting on the shop/.test(src));
  });

  /* the owner's screen ----------------------------------------------------------------------------------------- */
  const src = read('cap-period.js');
  const grab = (name) => { const m = new RegExp(String.raw`(?:async )?function ${name}\([^)]*\) \{[\s\S]*?
\}
`).exec(src); assert.ok(m, name + ' not found'); return m[0]; };
  const calls = [];
  const ctx = { Object, String, Date, JSON, PE_RET: { q: {}, r: null }, tx: (s) => s, bkQuiet: (w, f, fb) => fb, peReturnLoad: async () => ({ reloaded: true }),
    api: async (name, o) => { calls.push([name, o && o.body]); return name === 'countrySetup' ? { country: { code: 'AE' }, currency: 'AED', fy_start_month: 1 } : {}; },
    peBusyDay0: null };
  vm.createContext(ctx);
  vm.runInContext(grab('peSetupKeep'), ctx);
  const staggers = { 1: { tax_year_end: 'Jan' }, 2: { tax_year_end: 'Feb' }, 3: { tax_year_end: 'Mar' }, 4: { monthly: true } };
  await ok('the owner\'s "Monthly" and Emirate Dubai are saved as the shop\'s setup answers (period = the monthly key, region)', async () => {
    const out = await ctx.peSetupKeep({ staggers }, 'monthly', 'Dubai');
    assert.deepStrictEqual(out, { reloaded: true });
    assert.deepStrictEqual(calls.map((c) => c[0]), ['countrySetup', 'countrySetupSave']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[1][1])), { country: 'AE', currency: 'AED', fy_start_month: 1, particulars: { period: '4', region: 'Dubai' } });
  });
  await ok('a pick of nothing writes nothing', async () => {
    calls.length = 0;
    await ctx.peSetupKeep({ staggers }, '', '');
    assert.strictEqual(calls.length, 0);
  });
  await ok('a refused save answers null, so this view still reads the pick and says nothing was kept for the shop', async () => {
    ctx.api = async (name) => { if (name === 'countrySetupSave') throw new Error('Only the owner'); return { country: { code: 'AE' }, currency: 'AED', fy_start_month: 1 }; };
    assert.strictEqual(await ctx.peSetupKeep({ staggers }, '4', ''), null);
  });
  await ok('the device sends no stagger and no Emirate of its own, and does not remember them', () => {
    assert.ok(/delete PE_RET\.q\.stagger;/.test(src) && /delete PE_RET\.q\.emirate;/.test(src));
    assert.ok(!/stagger: PE_RET\.q\.stagger \|\| null/.test(src) && !/emirate: PE_RET\.q\.emirate \|\| null/.test(src));
  });
  await ok('the stagger picker offers the pack\'s own keys, the value the setup holds (so a held "4" shows as Monthly)', () => {
    assert.ok(/item, \/\* the pack's stagger key/.test(src) && !/stg\[item\]\.monthly \? 'monthly' : item/.test(src));
  });
  await ok('ACC-411: the busy month is asked at today when it has not ended (the server ignores a future day)', async () => {
    const c2 = { Object, String, Date, Number, api: async () => ({ periods: [{ period: 11, entries: 7, end_date: '2099-11-30' }] }), bkQuiet: (w, f, fb) => fb };
    vm.createContext(c2); vm.runInContext(grab('peBusyDay'), c2);
    assert.strictEqual(await c2.peBusyDay(), new Date().toISOString().slice(0, 10));
  });
  console.log('\n' + n + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
