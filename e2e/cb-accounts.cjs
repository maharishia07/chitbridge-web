/* cb-accounts.cjs — CB ACCOUNTS, THE LEDGER AS ITS OWN PAGE, PROVED (docs/design/cb-accounts/CLOUD-TASK.md · docs/design/SYSTEM.md §4).
 * Pattern: books-web.cjs + index-page.cjs — Playwright, a stand-in API answering INSIDE the page; the static server takes a
 * free port from the OS. Nothing here reaches localhost:3000, port 7351 or the live site: every /api/** call is fulfilled by
 * ctx.route before it can leave the browser (and the page is made to refuse any other host).
 *
 *  1  the page loads signed in; the sidebar lists every view (the designer's twelve, Bills after Dues) and each opens its screen
 *  2  Ledgers: the three sections, their groups (decided by CODE), search with highlight, class chips with counts, Expand /
 *     Collapse all, a Dr/Cr balance from ONE trial-balance read (never one read per row), a click opens that ledger
 *  3  Bills: the two system folders as two tabs, the server's step chip on each bill, a bill opens in a new tab
 *  4  the avatar menu: Profile → the app's profile · Sign out ends the session; ⌂ Home → /
 *  5  Ledger off: one card; the owner's Switch on → confirm → POST enable ONCE → the page fills; a co-assist is told to ask the owner
 *  6  the one-shop gate: another shop's fingerprint stops the page before any read; a session replaced by another shop signs it out
 *  7  phone: 390 px is an icon rail and document.scrollWidth === 390 on every view; a table is one card per row
 *  +  the page's own source: no alert(), no "accounting" / "books of account"; no page error; the designer's pairs read at AA
 * Screenshots: e2e/shots/cb-accounts-{laptop,phone,ledgers,off}.png
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = process.env.CBA_PUB || path.join(ROOT, 'public');        /* CBA_PUB=<dir> runs against another copy (cb-accounts-breaks.cjs) */
const SHOTS = path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
const TODAY = new Date().toISOString().slice(0, 10);

/* the designer's twelve views, Bills after Dues — [tab id, label, a test id that only that screen paints] */
const VIEWS = [
  ['daybook', 'Day book', '[data-testid^="db-entry-"]'], ['ledgers', 'Ledgers', '[data-testid="acc-sec-people"]'],
  ['tb', 'Trial balance', '[data-testid="tb-balanced"]'], ['pl', 'P&L', '[data-testid="pl-profit"]'],
  ['bs', 'Balance sheet', '[data-testid="bs-balanced"]'], ['dues', 'Dues', '[data-testid="dues-side-rcv"]'],
  ['bills', 'Bills', '[data-testid="bills-list"]'], ['cheques', 'Cheques', '[data-testid="chq-chq9"]'],
  ['waiting', 'Waiting', '[data-testid="wait-0"]'], ['lock', 'Month lock', '[data-testid="lk_fy"]'],
  ['packs', 'Packs', '[data-testid="pk_fy"]'], ['opening', 'Opening balances', '[data-testid="op_csv"]'],
  ['accounts', 'Shop ledgers', '[data-testid="ac_name"]'],
];

/* the control accounts' own statements: every line carries its party_id; the cashier (`by`) is the owner, never the party */
const LINE = (id, date, no, party, dr, cr, run, kind, by) => ({ date, what: kind === 'purchase' ? 'Purchase' : 'Sale', narration: kind === 'purchase' ? 'Purchase' : 'Sale', ref: null, party_id: party, source_chit_id: id, dr_minor: dr, cr_minor: cr, running_minor: run,
  source: { kind: kind || 'bill', ref: no, chit_id: id, how: kind === 'purchase' ? null : 'On credit', counter: kind === 'purchase' ? null : 'C2', by } });
const L1 = LINE('k1', '2026-09-05', 'C2/26-27/0016', 'c1', 300000, 0, 300000, 'bill', 'Mayur Bhavan');
const L2 = LINE('k2', '2026-09-06', 'C2/26-27/0017', 'c2', 300000, 0, 600000, 'bill', 'Mayur Bhavan');
const P1 = LINE('k3', '2026-09-03', 'AM-81', 's1', 0, 150000, -150000, 'purchase', 'Ravi');
const P2 = LINE('k4', '2026-09-04', 'KV-12', 's2', 0, 100000, -250000, 'purchase', 'Ravi');
const CONTROL = {
  '1300': { account: { code: '1300', name: 'Customers (Sundry Debtors)' }, currency: 'INR', opening_minor: 0, closing_minor: 600000, lines: [L1, L2] },
  '2100': { account: { code: '2100', name: 'Suppliers (Sundry Creditors)' }, currency: 'INR', opening_minor: 0, closing_minor: -250000, lines: [P1, P2] },
};
const PARTY_LINES = { c1: [Object.assign({}, L1, { running_minor: 300000 })], c2: [Object.assign({}, L2, { running_minor: 300000 })], s1: [P1], s2: [Object.assign({}, P2, { running_minor: -100000 })] };

/* ── the stand-in: one shop's chart, its trial balance, its two bills folders ───────────────────────────────── */
function standIn(over) {
  return Object.assign({
    calls: [], enabled: true, enables: 0, healthStatus: null,
    accounts: [
      { code: '1300', name: 'Customers (Sundry Debtors)', is_group: false }, { code: '1300-P00001', name: 'Ravi Stores', is_group: false },
      { code: '2100', name: 'Suppliers (Sundry Creditors)', is_group: false }, { code: '2100-P00003', name: 'Agro Mills', is_group: false },
      { code: '1400', name: 'Cash', is_group: false }, { code: '1500', name: 'Bank', is_group: false }, { code: '1510', name: 'UPI collections', is_group: false },
      { code: '1200', name: 'Stock-in-hand', is_group: false }, { code: '2200', name: 'Output CGST', is_group: false }, { code: '2210', name: 'Input CGST', is_group: false },
      { code: '2220', name: 'TDS payable', is_group: false }, { code: '2900', name: 'Suspense', is_group: false },
      { code: '3000', name: 'Capital', is_group: false }, { code: '3900', name: 'Profit and loss (retained)', is_group: false },
      { code: '4000', name: 'Sales', is_group: false }, { code: '4200', name: 'Interest received', is_group: false },
      { code: '5000', name: 'Purchases', is_group: false }, { code: '6000', name: 'Expenses', is_group: true }, { code: '6010', name: 'Rent', is_group: false },
      { code: '6090', name: 'Bank charges', is_group: false }, { code: '6900', name: 'Round off', is_group: false },
      { code: '7777', name: 'A code the design never named', is_group: false },
    ],
    tb: [
      { code: '1300', name: 'Customers (Sundry Debtors)', dr_minor: 600000, cr_minor: 0 }, { code: '2100', name: 'Suppliers (Sundry Creditors)', dr_minor: 0, cr_minor: 250000 },
      { code: '1400', name: 'Cash', dr_minor: 1240000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 1590000 },
      { code: '6010', name: 'Rent', dr_minor: 100000, cr_minor: 0 }, { code: '1510', name: 'UPI collections', dr_minor: 0, cr_minor: 0 },
    ],
    folders: [
      { folder_id: 'a0000000-0000-5000-8000-000000002100', parent_id: null, name: 'Bills · Received', code: 'B-2100', kind: 'view', system: true, scope: null, side: 'received', count: 2, total: 3 },
      { folder_id: 'a0000000-0000-5000-8000-000000001300', parent_id: null, name: 'Bills · Issued', code: 'B-1300', kind: 'view', system: true, scope: null, side: 'issued', count: 1, total: 2 },
      { folder_id: 'a0000000-0000-5000-8000-000000001400', parent_id: null, name: 'Receipts', code: 'R-1400', kind: 'view', system: true, scope: null, side: null, count: 1, total: 1 },
      { folder_id: 'c0000000-0000-4000-8000-00000000000b', parent_id: null, name: 'Urgent', scope: 'task', kind: 'filed', count: 1 },
    ],
    bills: {
      'a0000000-0000-5000-8000-000000002100': [
        { chit_id: 'rb1', bill_no: 'AM-81', manual_subject: 'Bill AM-81 from Agro Mills', counterparty_name: 'Agro Mills', value: '481.65', currency: 'INR', doc_kind: 'bill_received',
          bill: { step: 'goods_checked', code: 'B-2100', label: 'Goods checked', by: 'chola-ravi', at: '2026-10-01T08:50:00Z', open: true, paid: false } },
        { chit_id: 'rb2', bill_no: 'AM-82', manual_subject: 'Bill AM-82 from Agro Mills', counterparty_name: 'Agro Mills', value: '1200', currency: 'INR', doc_kind: 'bill_received',
          bill: { step: 'disputed', code: 'DSP', label: 'Bill refused', by: 'chola-ravi', at: '2026-10-02T04:30:00Z', open: true, paid: false } }],
      'a0000000-0000-5000-8000-000000001300': [
        { chit_id: 'ib1', bill_no: 'C1/26-27/0041', manual_subject: 'Bill C1/26-27/0041 to Ravi Stores', counterparty_name: 'Ravi Stores', value: '1880', currency: 'INR', doc_kind: 'bill_issued',
          bill: { step: 'issued', code: 'B-1300', label: 'Issued — waiting on payment', by: 'mani', at: '2026-10-01T05:10:00Z', open: true, paid: false } }],
    },
    waiting: [{ id: 1, chit_id: 'ch7', ref: 'bill:ch7', why: 'Paid by Points — there is no ledger for Points yet.', tries: 3, since: '2026-09-28T10:00:00Z' }],
    last: null,
  }, over || {});
}
const claims = (h) => { try { return JSON.parse(Buffer.from(String(h || '').replace(/^Bearer /, '').split('.')[1], 'base64').toString()); } catch (_) { return {}; } };
async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  S.calls.push(m + ' ' + p + u.search);
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR' } });
  if (p === '/api/folders' && m === 'GET') return J(r, 200, { folders: S.folders });
  let x;
  if ((x = p.match(/^\/api\/folders\/([^/]+)\/chits$/))) return J(r, 200, { chits: S.bills[x[1]] || [] });
  if (p.startsWith('/api/books')) {
    if (p === '/api/books/enable' && m === 'POST') { S.enables++; S.enabled = true; return J(r, 200, { ok: true, accounts_added: 80 }); }
    if (!S.enabled) return J(r, 404, { error: 'Not found' });
    if (p === '/api/books/health') { if (S.healthStatus) return J(r, S.healthStatus, { error: 'down' }); return J(r, 200, { enabled: true, last_posted_day: '2026-09-26', waiting: S.waiting.map((w) => ({ id: w.id, chit_id: w.chit_id, ref: w.ref, reason: w.why, tries: w.tries, since: w.since })) }); }
    if (p === '/api/books/accounts' && m === 'GET') return J(r, 200, { accounts: S.accounts });
    if (p === '/api/books/trial-balance') { S.last = u.searchParams.get('asOf'); return J(r, 200, { currency: 'INR', rows: S.tb, total_dr_minor: 1940000, total_cr_minor: 1840000 }); }
    if ((x = p.match(/^\/api\/books\/party\/([^/]+)\/statement$/))) { const pl = PARTY_LINES[x[1]] || []; return J(r, 200, { currency: 'INR', party_id: x[1], opening_minor: 0, closing_minor: pl.length ? pl[pl.length - 1].running_minor : 0, lines: pl }); }
    if ((x = p.match(/^\/api\/books\/ledger\/([^/]+)$/)) && CONTROL[x[1]]) return J(r, 200, Object.assign({}, CONTROL[x[1]], S.closing && S.closing[x[1]] != null ? { closing_minor: S.closing[x[1]] } : {}));
    if ((x = p.match(/^\/api\/books\/ledger\/([^/]+)$/))) return J(r, 200, { account: { code: x[1], name: 'Cash' }, currency: 'INR', opening_minor: 0, closing_minor: 1240000,
      lines: [{ date: '2026-09-02', what: 'Sale', ref: 'JV/2026-27/000001', source_chit_id: null, source: null, dr_minor: 1240000, cr_minor: 0, running_minor: 1240000 }] });
    if (p === '/api/books/daybook') return J(r, 200, { currency: 'INR', entries: [{ entry_id: 'e1', entry_no: 'JV/2026-27/000001', posting_date: TODAY, event_type: 'walkin_day', source_chit_id: null, narration: 'Walk-in sales',
      source: { kind: 'day', counter: 'C1', count: 11, how: 'Cash', split: [{ how: 'Cash', amount_minor: 124000 }] }, lines: [{ code: '1400', name: 'Cash', dr_minor: 124000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 124000 }] }] });
    if (p === '/api/books/dues') return J(r, 200, { currency: 'INR', as_of: TODAY, parties: [
      { party_id: 'c1', party_no: 'P-00001', name: 'Ravi Stores', side: 'customer', balance_minor: 300000, oldest_due: '2026-08-01', disputed_minor: 0, buckets: { not_due: 0, lt_6m: 300000 } },
      { party_id: 'c2', party_no: 'P-00002', name: 'Chola Auto Care', side: 'customer', balance_minor: 300000, oldest_due: '2026-09-06', disputed_minor: 0, buckets: { not_due: 0, lt_6m: 300000 } },
      { party_id: 's1', party_no: 'P-00003', name: 'Agro Mills', side: 'supplier', balance_minor: -150000, oldest_due: '2026-09-03', disputed_minor: 0, buckets: { not_due: -150000 } },
      { party_id: 's2', party_no: 'P-00004', name: 'Kavi Traders', side: 'supplier', balance_minor: -100000, oldest_due: '2026-09-04', disputed_minor: 0, buckets: { not_due: -100000 } }] });
    if (p === '/api/books/cheques') return J(r, 200, { currency: 'INR', cheques: [{ payment_id: 'chq9', party_id: 'c2', name: 'Meena Traders', amount_minor: 50000, cheque_no: '778899', cheque_bank: 'SBI', status: 'cheque_received', next: ['deposited'] }] });
    if (p === '/api/books/pl') return J(r, 200, { currency: 'INR', income: [{ code: '4000', name: 'Sales', amount_minor: 1590000 }], expense: [{ code: '6010', name: 'Rent', amount_minor: 100000 }], profit_minor: 1490000 });
    if (p === '/api/books/bs') return J(r, 200, { currency: 'INR', assets: [{ code: '1300', name: 'Debtors', amount_minor: 600000 }], liabilities: [], equity: [], total_assets_minor: 600000, total_liab_equity_minor: 600000 });
    if (p === '/api/books/packs') return J(r, 200, { packs: [] });
    return J(r, 404, { error: 'no stand-in for ' + p });
  }
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if (((!f.startsWith(PUB)) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const threw = [], offHost = [];

  const tokFor = (c) => { const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x'; };
  const OWNER = { token: tokFor({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan' };
  const RAVI = { token: tokFor({ identity_id: 'act-1', identity_type: 'actor', parent_entity_id: 'ent-M', parent_entity_name: 'Mayur Bhavan', display_name: 'Ravi' }), role: 'actor', name: 'Ravi', entity: 'Mayur Bhavan' };

  async function open(S, o) {
    o = o || {};
    const ctx = await b.newContext({ viewport: o.viewport || { width: 1360, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    /* Playwright runs the LAST-registered matching route first: the catch-all goes in first so the stand-in below wins for /api/**
       (the page resolves its API base to localhost:3000 on a 127.0.0.1 page — the stand-in answers it; nothing is ever sent) */
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { offHost.push(r.request().url()); return r.abort(); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    if (o.session !== null) await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, o.session || OWNER);
    if (o.seed) await ctx.addInitScript(o.seed);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + (o.path || '/accounts.html'));
    if (process.env.CBA_DEBUG) { await p.waitForTimeout(1500); console.log('DEBUG', threw, (await p.evaluate(() => document.body.innerText)).slice(0, 300)); }
    return { ctx, p };
  }
  const bad = async (p, where) => {
    const t = await p.evaluate(() => document.body.innerText);
    ok(!/accounting|books of account/i.test(t), where + ': "accounting" / "books of account" appear nowhere');
  };
  const nav = (p, id) => p.click('[data-testid="acc-nav-' + id + '"]');
  const width = (p) => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));

  /* ── the page's own source ── */
  {
    const src = fs.readFileSync(path.join(PUB, 'accounts.html'), 'utf8');
    ok(!/\balert\s*\(/.test(src), 'no alert() anywhere in the page');
    ok(!/accounting|books of account/i.test(src), 'the source carries neither forbidden string');
    ok(/<title>CB Accounts<\/title>/.test(src), 'the page is named CB Accounts');
    ok(/CBOnePerson\.attach\(/.test(src), 'the one-shop gate is attached');
    ok(/CBLedger\.run\(/.test(src) && !/booksEnable/.test(src.replace(/CB_BOOKS_EP/g, '')), 'the Switch on goes through CBLedger — the page holds no copy of the enable call');
  }

  /* ── 1 · SIGNED IN, THE LEDGER ON (laptop) ─────────────────────────────────────────────────────────────── */
  {
    const S = standIn();
    const { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="acc-nav-daybook"]', { timeout: 15000 });
    await p.waitForTimeout(500);
    ok(/CB Accounts/.test(await p.textContent('.brand')), 'the brand says CB Accounts');
    ok(await p.locator('[data-testid="shop-name"]').textContent() === 'Mayur Bhavan', 'the pinned header names the shop');
    const labels = await p.$$eval('#nav .nav-btn', (b) => b.map((x) => x.getAttribute('aria-label')));
    ok(JSON.stringify(labels) === JSON.stringify(VIEWS.map((v) => v[1])), 'the sidebar lists every view, Bills after Dues: ' + labels.join(' · '));
    ok(await p.evaluate(() => document.querySelector('.top') && getComputedStyle(document.querySelector('.top')).position === 'sticky'), 'the header is pinned');

    for (const [id, label, sel] of VIEWS) {
      await nav(p, id);
      const seen = await p.waitForSelector(sel, { timeout: 8000 }).then(() => true, () => false);
      ok(seen, 'the sidebar opens ' + label + ' — its own screen paints (' + sel + ')');
      ok(await p.evaluate((l) => document.querySelector('.nav-btn.active').getAttribute('aria-label') === l, label), label + ' is the one lit in the sidebar');
      await bad(p, label);
      ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), label + ': no horizontal scroll at 1360');
    }
    ok(S.calls.filter((c) => /booksAccounts|\/api\/books\/accounts/.test(c)).length >= 1, 'the Ledgers view read the accounts');

    /* ── 2 · LEDGERS ── */
    S.calls.length = 0;
    await nav(p, 'ledgers');
    await p.waitForSelector('[data-testid="acc-sec-people"]');
    await p.waitForSelector('[data-testid="bal-1300"]');
    const secs = await p.$$eval('.section', (s) => s.map((x) => x.getAttribute('data-testid')));
    ok(JSON.stringify(secs) === JSON.stringify(['acc-sec-people', 'acc-sec-real', 'acc-sec-nominal']), 'three sections: Personal · Real · Nominal');
    const rules = await p.$$eval('.sec-rule', (s) => s.map((x) => x.textContent));
    ok(rules.length === 3 && /receiver/.test(rules[0]) && /comes in/.test(rules[1]) && /expenses/.test(rules[2]), 'each section carries its rule line');
    const groups = await p.$$eval('.group-title', (s) => s.map((x) => x.textContent));
    ok(JSON.stringify(groups) === JSON.stringify(['PARTIES', 'CASH & BANK', 'STOCK & ADVANCES', 'GST', 'TAXES & SUSPENSE', "OWNER'S EQUITY", 'OTHER', 'INCOME', 'DIRECT COSTS', 'OPERATING EXPENSES', 'ADJUSTMENTS']),
      'groups are decided by code, in the designer\'s order (' + groups.join(' · ') + ')');
    ok(await p.locator('[data-testid="acc-group-PARTIES"] .acct').count() === 4, 'Parties holds the control lines and the parties under them (1300, 2100 and their parties)');
    const partyCodes = await p.$$eval('[data-testid="acc-group-PARTIES"] .code', (s) => s.map((x) => x.textContent));
    ok(partyCodes[0] === '1300' && partyCodes[1] === '2100', 'the control lines come first (' + partyCodes.join(', ') + ')');
    ok(await p.locator('[data-testid="lg-acc-7777"]').count() === 1, 'a code the design never named still appears (Other), never nowhere');
    ok(await p.locator('[data-testid="lg-acc-6000"]').count() === 0, 'a ledger group (6000) is not a ledger row');
    const chips = await p.$$eval('.chip', (s) => s.map((x) => x.textContent));
    ok(chips.length === 4 && chips[0].startsWith('All') && /Personal4/.test(chips[1]) && /Real11/.test(chips[2]) && /Nominal6/.test(chips[3]), 'class chips with counts: ' + chips.join(' · '));
    ok(/21 ledgers in 3 classes/.test(await p.textContent('#summary')), 'the summary counts the ledgers');

    /* the balances: Dr / Cr, from ONE trial-balance read */
    ok(/Dr/.test(await p.textContent('[data-testid="bal-1300"]')) && /6,000/.test(await p.textContent('[data-testid="bal-1300"]')), 'Customers: ₹6,000 Dr');
    ok(/Cr/.test(await p.textContent('[data-testid="bal-2100"]')) && /2,500/.test(await p.textContent('[data-testid="bal-2100"]')), 'Suppliers: ₹2,500 Cr');
    ok(/Cr/.test(await p.textContent('[data-testid="bal-4000"]')), 'Sales: a Cr balance');
    ok((await p.textContent('[data-testid="bal-4200"]')).trim() === '—', 'a ledger the trial balance does not list says "—", not a made-up nil');
    const tbReads = S.calls.filter((c) => /\/api\/books\/trial-balance/.test(c)).length;
    ok(tbReads === 1, 'ONE trial-balance read for the whole list (' + tbReads + ')');
    ok(S.calls.filter((c) => /\/api\/books\/ledger\//.test(c)).length === 0, 'no per-row balance read');

    /* chips filter, search highlights and opens everything, Expand / Collapse all */
    await p.click('[data-testid="acc-chip-nominal"]');
    ok(await p.locator('.section').count() === 1 && await p.locator('[data-testid="acc-sec-nominal"]').count() === 1, 'the Nominal chip shows only that class');
    await p.click('[data-testid="acc-chip-all"]');
    await p.click('#collapseAll');
    ok(await p.locator('.section.open').count() === 0, 'Collapse all closes every section');
    await p.click('#expandAll');
    ok(await p.locator('.section.open').count() === 3, 'Expand all opens every section');
    await p.click('#collapseAll');
    await p.fill('#q', '6010');
    ok(await p.locator('.section.open').count() === 1 && await p.locator('.acct').count() === 1, 'searching 6010 opens its section and shows only it');
    ok(await p.locator('.acct mark').first().textContent() === '6010', 'the match is highlighted');
    ok(/1 of 21 ledgers/.test(await p.textContent('#summary')), 'the summary says 1 of 21 while searching');
    await p.fill('#q', 'bank');
    ok(await p.locator('.acct').count() === 2 && await p.locator('.acct mark').count() === 2, 'a name search matches Bank and Bank charges, highlighted');
    await p.fill('#q', 'zzzz');
    ok(/No ledgers match/.test(await p.textContent('.empty')) && await p.locator('#clear').count() === 1, 'no match → one line and the button that clears it');
    await p.click('#clear');
    ok(await p.locator('.acct').count() === 21, 'Clear search brings every ledger back');
    await p.click('#expandAll');
    await p.screenshot({ path: path.join(SHOTS, 'cb-accounts-ledgers.png'), fullPage: true });

    /* a click opens that ledger — the app's own ledger view */
    await p.click('#expandAll');
    await p.click('[data-testid="lg-acc-1400"]');
    await p.waitForSelector('[data-testid="lg_out"] table, [data-testid="lg_out"] .bktab, [data-testid="lg_out"] *', { timeout: 8000 });
    await p.waitForTimeout(400);
    ok(S.calls.some((c) => /\/api\/books\/ledger\/1400/.test(c)), 'clicking Cash reads that ledger (GET /api/books/ledger/1400)');
    ok(await p.locator('[data-testid="acc-open-code"]').textContent() === '1400' && /Sale/.test(await p.textContent('[data-testid="lg_out"]')), 'the ledger opens with its statement');
    await p.click('[data-testid="acc-back"]');
    await p.waitForSelector('[data-testid="acc-sec-people"]');
    ok(true, 'the back button returns to the list');

    /* ── 2b · PARTY LEDGERS: 1300 and 2100 open into one ledger per party (docs/design/party-ledgers/CLOUD-TASK.md) ── */
    await p.click('#expandAll');
    const stmtText = async () => p.$$eval('[data-testid^="stmt-what-"]', (t) => t.map((x) => x.textContent));
    const dueReads = () => S.calls.filter((c) => /\/api\/books\/dues/.test(c)).length;
    const partyReads = () => S.calls.filter((c) => /\/api\/books\/party\//.test(c)).length;
    S.calls.length = 0;
    await p.click('[data-testid="lg-acc-1300"]');
    await p.waitForSelector('[data-testid="lg-party-c1"]');
    await p.waitForSelector('[data-testid^="stmt-what-"]');
    const rowsOf = async () => p.$$eval('[data-testid^="lg-party-c"], [data-testid^="lg-party-s"]', (r) => r.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    let pr = await rowsOf();
    ok(pr.length === 2 && /P-00001.*Ravi Stores.*3,000/.test(pr[0]) && /P-00002.*Chola Auto Care.*3,000/.test(pr[1]), '1300 lists one row per customer — party no · name · balance, by party no (' + pr.join(' | ') + ')');
    ok(/By customer/.test(await p.textContent('[data-testid="lg-parties"]')) && /All entries/.test(await p.textContent('[data-testid="lg-all-entries"]')), '"By customer" above, the combined statement under "All entries"');
    ok(await p.locator('[data-testid="lg-party-c1"] td').nth(3).textContent().then((t) => /Aug/.test(t)), 'each customer row carries the oldest due');
    const tot = (await p.textContent('[data-testid="lg-parties-total"]')).trim(), clo = (await p.textContent('[data-testid="lg-parties-closing"]')).trim();
    ok(tot === clo && /6,000/.test(tot), 'the parties add up to the 1300 closing (' + tot + ' = ' + clo + ')');
    ok(await p.locator('[data-testid="lg-parties-diff"]').count() === 0, 'no difference line while they agree');
    ok(dueReads() === 1, 'ONE /api/books/dues request draws the table (' + dueReads() + ')');
    ok(partyReads() === 0, 'no statement fetched per party row (' + partyReads() + ')');
    let rt = await stmtText();
    ok(rt.length === 2 && rt.every((t) => /^Sale · P-0000[12] · (Ravi Stores|Chola Auto Care) · /.test(t)), 'every 1300 row names its party first, right after "Sale" (' + rt.join(' || ') + ')');
    ok(rt.every((t) => !/^Sale · (Mayur|Counter)/.test(t)), 'no row puts the owner or the counter where the party goes');
    ok(rt.every((t) => /Counter C2 · rung by Mayur Bhavan \(owner\)\s*$/.test(t)), 'the cashier reads "rung by Mayur Bhavan (owner)", last, after the counter');
    await p.screenshot({ path: path.join(SHOTS, 'party-ledgers-debtors.png'), fullPage: true });
    S.calls.length = 0;
    await p.click('[data-testid="lg-party-c1"]');
    await p.waitForSelector('[data-testid="party-statement"] [data-testid="stmt-closing"]');
    const one = await p.textContent('[data-testid="party-statement"]');
    ok(partyReads() === 1 && S.calls.some((c) => /\/party\/c1\/statement/.test(c)), 'clicking a party reads that one party\'s statement, once');
    ok(/C2\/26-27\/0016/.test(one) && !/0017/.test(one) && !/Chola/.test(one), 'only that party\'s bills');
    ok(/3,000/.test(await p.textContent('[data-testid="stmt-closing"]')) && /0\.00|^\s*₹?\s*0/.test(await p.textContent('[data-testid="stmt-opening"]')), 'opening 0 and closing ₹3,000 for the party');
    ok((await p.textContent('[data-testid="lg-party-name"]')).trim() === 'P-00001 · Ravi Stores', 'the party is named by no · name above its ledger');
    ok(await p.locator('[data-testid="lg-parties"]').count() === 0 && dueReads() === 0, 'the party view re-reads no dues');
    await p.screenshot({ path: path.join(SHOTS, 'party-ledgers-one-party.png'), fullPage: true });
    ok(/All customers/.test(await p.textContent('[data-testid="lg-parties-back"]')), 'a "‹ All customers" link sits above the party\'s ledger');
    await p.click('[data-testid="lg-parties-back"]');
    await p.waitForSelector('[data-testid="lg-party-c2"]');
    ok(await p.locator('[data-testid="lg-party-c2"]').count() === 1, 'the link returns to the table');
    await p.click('[data-testid="acc-back"]');
    await p.waitForSelector('[data-testid="acc-sec-people"]');
    S.calls.length = 0;
    await p.click('[data-testid="lg-acc-2100"]');
    await p.waitForSelector('[data-testid="lg-party-s1"]');
    await p.waitForSelector('[data-testid^="stmt-what-"]');
    pr = await rowsOf();
    ok(pr.length === 2 && /P-00003.*Agro Mills.*1,500/.test(pr[0]) && /P-00004.*Kavi Traders.*1,000/.test(pr[1]), '2100 lists one row per supplier (' + pr.join(' | ') + ')');
    ok(/By supplier/.test(await p.textContent('[data-testid="lg-parties"]')), '"By supplier"');
    const tot2 = (await p.textContent('[data-testid="lg-parties-total"]')).trim(), clo2 = (await p.textContent('[data-testid="lg-parties-closing"]')).trim();
    ok(tot2 === clo2 && /2,500/.test(tot2), 'the suppliers add up to the 2100 closing (' + tot2 + ' = ' + clo2 + ')');
    ok(dueReads() === 1 && partyReads() === 0, 'one dues request, no per-row statement (' + dueReads() + ' / ' + partyReads() + ')');
    rt = await stmtText();
    ok(rt.length === 2 && rt.every((t) => /^Purchase · P-0000[34] · (Agro Mills|Kavi Traders) · /.test(t)) && rt.every((t) => /rung by Ravi\s*$/.test(t)), '2100 rows name the supplier first and end "rung by Ravi" (' + rt.join(' || ') + ')');
    await p.screenshot({ path: path.join(SHOTS, 'party-ledgers-creditors.png'), fullPage: true });
    await p.click('[data-testid="lg-party-s2"]');
    await p.waitForSelector('[data-testid="party-statement"] [data-testid="stmt-closing"]');
    ok(/All suppliers/.test(await p.textContent('[data-testid="lg-parties-back"]')), 'a "‹ All suppliers" link sits above the supplier\'s ledger');
    ok(/KV-12/.test(await p.textContent('[data-testid="party-statement"]')) && !/AM-81/.test(await p.textContent('[data-testid="party-statement"]')) && /1,000/.test(await p.textContent('[data-testid="stmt-closing"]')), 'a supplier opens only its own bills, closing ₹1,000');
    /* a control account that does not equal its parties is said in words, never hidden */
    await p.click('[data-testid="acc-back"]');
    await p.waitForSelector('[data-testid="acc-sec-people"]');
    S.closing = { '1300': 650000 };
    await p.click('[data-testid="lg-acc-1300"]');
    await p.waitForSelector('[data-testid="lg-parties-diff"]');
    ok(/₹6,000\.00.*₹6,500\.00.*₹500\.00 apart/.test(await p.textContent('[data-testid="lg-parties-diff"]')), 'when the parties and the ledger differ, the difference is said in words');
    S.closing = null;
    await p.click('[data-testid="acc-back"]');
    await p.waitForSelector('[data-testid="acc-sec-people"]');

    /* ── 3 · BILLS ── */
    await nav(p, 'bills');
    await p.waitForSelector('[data-testid="bills-list"]');
    const tabs = await p.$$eval('.tab', (s) => s.map((x) => x.textContent));
    ok(JSON.stringify(tabs) === JSON.stringify(['Received2', 'Issued1']), 'two tabs from the system folders, with the open counts: ' + tabs.join(' · '));
    ok(await p.locator('[data-testid="bills-tab-B-2100"]').getAttribute('aria-pressed') === 'true', 'Received is the first tab');
    ok(await p.locator('.bill').count() === 2, 'the Received tab lists its two bills');
    ok(/Goods checked/.test(await p.textContent('[data-testid="bill-step-rb1"]')) && await p.getAttribute('[data-testid="bill-step-rb1"]', 'data-step') === 'goods_checked', 'a bill carries the server\'s step chip — "Goods checked"');
    ok(/Bill refused/.test(await p.textContent('[data-testid="bill-step-rb2"]')) && /red/.test(await p.getAttribute('[data-testid="bill-step-rb2"]', 'class')), 'a disputed bill\'s chip is red, in the server\'s words');
    ok(/481\.65/.test(await p.textContent('[data-testid="bill-rb1"]')), 'the amount is shown through the locale layer');
    ok(!/B-1300|Issued — waiting/.test(await p.textContent('[data-testid="bills-list"]')), 'the Issued bills are not on the Received tab');
    ok(S.calls.some((c) => /\/api\/folders\/a0000000-0000-5000-8000-000000002100\/chits/.test(c)), 'the Received folder\'s chits were read');
    await p.click('[data-testid="bills-tab-B-1300"]');
    await p.waitForSelector('[data-testid="bill-ib1"]');
    ok(/Issued — waiting on payment/.test(await p.textContent('[data-testid="bill-step-ib1"]')), 'the Issued tab shows its bill and its chip');
    const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('[data-testid="bill-ib1"]')]);
    ok(/\/app\.html#\/app\/chit\/ib1$/.test(pop.url()), 'a bill opens in a new tab on the app (' + pop.url().replace(base, '') + ')');
    await pop.close();

    /* ── 4 · THE AVATAR MENU, HOME ── */
    await p.click('[data-testid="avatar"]');
    ok(await p.locator('[data-testid="avatar-menu"]').isVisible(), 'the avatar opens the menu');
    ok(await p.getAttribute('[data-testid="nav-profile"]', 'href') === '/app.html#/app/profile', 'Profile → the app\'s profile (app.html#/app/profile)');
    ok(await p.locator('[data-testid="nav-signout"]').isVisible(), 'Sign out is in the menu');
    await p.keyboard.press('Escape');
    ok(!(await p.locator('[data-testid="avatar-menu"]').isVisible()), 'Escape closes the menu');
    await p.screenshot({ path: path.join(SHOTS, 'cb-accounts-laptop.png') });
    ok(await p.getAttribute('[data-testid="acc-home"]', 'href') === '/', '⌂ Home links to /');
    await Promise.all([p.waitForURL(base + '/'), p.click('[data-testid="acc-home"]')]);
    ok(new URL(p.url()).pathname === '/', 'Home goes to /');
    await p.goBack();
    await p.waitForSelector('[data-testid="acc-nav-daybook"]');
    await p.click('[data-testid="avatar"]');
    await Promise.all([p.waitForURL(/app\.html#\/login/), p.click('[data-testid="nav-signout"]')]);
    ok(await p.evaluate(() => localStorage.getItem('cb_sess')) === null, 'Sign out removes the app\'s session (cb_sess)');
    ok(/\/app\.html#\/login$/.test(p.url()), 'Sign out lands on the app\'s sign-in');
    await ctx.close();
  }

  /* ── 5 · LEDGER OFF ──────────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn({ enabled: false });
    const { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="acc-off"]');
    ok(/CB Accounts is not switched on/.test(await p.textContent('[data-testid="acc-off"]')), 'off → one card: "CB Accounts is not switched on"');
    ok(await p.locator('[data-testid="acc-card"]').count() === 1 && await p.locator('#nav .nav-btn').count() === 0, 'one card, and no menu to wander into');
    ok(await p.locator('[data-testid="acc-switch-on"]').isVisible(), 'the owner sees Switch on');
    await bad(p, 'ledger off');
    await p.screenshot({ path: path.join(SHOTS, 'cb-accounts-off.png') });
    await p.click('[data-testid="acc-switch-on"]');
    await p.waitForSelector('[data-testid="confirm-ok"]');
    ok(/Switch the Ledger on\?/.test(await p.textContent('[data-testid="confirm"]')) && /From today every bill/.test(await p.textContent('[data-testid="confirm"]')), 'a confirm says what switching on means (the Settings card\'s words)');
    ok(S.enables === 0, 'nothing is sent before the owner confirms');
    await p.click('[data-testid="confirm-cancel"]');
    await p.waitForTimeout(200);
    ok(S.enables === 0 && await p.locator('[data-testid="acc-off"]').count() === 1, 'Cancel changes nothing');
    await p.click('[data-testid="acc-switch-on"]');
    await p.waitForSelector('[data-testid="confirm-ok"]');
    await Promise.all([p.waitForSelector('[data-testid="acc-nav-daybook"]', { timeout: 10000 }), p.click('[data-testid="confirm-ok"]')]);
    await p.waitForSelector('[data-testid="acc-nav-daybook"]');
    ok(S.enables === 1, 'confirming sent POST /api/books/enable exactly once (' + S.enables + ')');
    ok(await p.locator('#nav .nav-btn').count() === 13, 'the page fills: the full menu is there');
    await ctx.close();
  }
  {
    const S = standIn({ enabled: false });
    const { ctx, p } = await open(S, { session: RAVI });
    await p.waitForSelector('[data-testid="acc-off"]');
    ok(/Ask the owner to switch it on/.test(await p.textContent('[data-testid="acc-ask-owner"]')), 'a co-assist sees "Ask the owner to switch it on"');
    ok(await p.locator('[data-testid="acc-switch-on"]').count() === 0, 'a co-assist is not offered Switch on');
    ok(S.enables === 0, 'and nothing was sent');
    await ctx.close();
  }
  {
    const S = standIn({ healthStatus: 500 });
    const { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="acc-retry"]');
    ok(!/error|500|down/i.test(await p.textContent('[data-testid="acc-card"]')), 'a failed read says what happened in its own words, never the server\'s');
    ok(await p.locator('[data-testid="acc-switch-on"]').count() === 0, 'a read that failed is not mistaken for a Ledger that is off');
    await ctx.close();
  }
  {
    const { ctx, p } = await open(standIn(), { session: null });
    await p.waitForSelector('[data-testid="signin-door"]');
    ok(await p.getAttribute('[data-testid="signin-door"]', 'href') === '/app.html#/login', 'signed out → the one door in, and no reads');
    await ctx.close();
  }

  /* ── 6 · THE ONE-SHOP GATE ───────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn();
    /* another shop's unsent work is still in this browser (cb_owner says whose; a draft is tagged by cb.draft.*) */
    const { ctx, p } = await open(S, { seed: () => { try { localStorage.setItem('cb_owner', JSON.stringify({ ent: 'ent-OTHER', name: 'Alpha Timers', ids: ['act-9'] })); localStorage.setItem('cb.draft.msg.c1', JSON.stringify({ at: Date.now(), data: 'half a message' })); } catch (_) {} } });
    await p.waitForSelector('[data-testid="close-first"]', { timeout: 10000 });
    ok(/Alpha Timers/.test(await p.textContent('[data-testid="close-first"]')), 'another shop\'s fingerprint → the page says whose, and stops');
    await p.waitForTimeout(600);
    ok(S.calls.filter((c) => /\/api\/books/.test(c)).length === 0, 'no Ledger read happens while another shop is here (' + S.calls.filter((c) => /\/api\/books/.test(c)).length + ')');
    ok(await p.locator('[data-testid="close-first-go"]').isVisible() && await p.locator('#nav .nav-btn').count() === 0, 'one button fixes it, and there is no menu behind it');
    await p.click('[data-testid="close-first-go"]');
    await p.waitForSelector('[data-testid="acc-nav-daybook"]', { timeout: 15000 });
    ok(await p.evaluate(() => localStorage.getItem('cb.draft.msg.c1')) === null, 'cleared → the other shop\'s draft is gone');
    ok(S.calls.some((c) => /\/api\/books\/health/.test(c)), 'and then CB Accounts opens and reads');
    /* a second shop signs in elsewhere while this page is open → this page leaves */
    const other = await ctx.newPage();                       /* the `storage` event reaches OTHER documents: a second tab does the sign-in */
    await other.goto(base + '/no-such-page');
    await other.evaluate((t) => { localStorage.setItem('cb_sess', JSON.stringify({ token: t, role: 'entity', name: 'Tally', entity: 'Tally Test' })); }, tokFor({ identity_id: 'ent-T', identity_type: 'entity' }));
    await p.waitForSelector('[data-testid="signin-door"]', { timeout: 8000 });
    ok(/Tally Test opened in another tab/.test(await p.textContent('[data-testid="acc-card"]')), 'a second shop signing in elsewhere signs this page out, and says why');
    await ctx.close();
  }

  /* ── 6b · THE GATE IS ATTACHED: when another shop's clear-out tells this shop's tabs to leave, this page leaves — to the home page ── */
  {
    const S = standIn();
    const { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="acc-nav-daybook"]', { timeout: 15000 });
    const other = await ctx.newPage();
    await other.goto(base + '/no-such-page');
    await other.addScriptTag({ url: base + '/app/one-person.js' });
    await other.evaluate(() => CBOnePerson.clearOut({ ent: 'ent-M', name: 'Mayur Bhavan', tabs: 1, uids: [] }, 'Tally Test'));
    await p.waitForURL(/\/\?left=Tally/, { timeout: 8000 }).catch(() => {});
    ok(/\/\?left=Tally/.test(p.url()), 'a clear-out of this shop sends the page to the home page, naming who did it (' + p.url().replace(base, '') + ')');
    await ctx.close();
  }

  /* ── the designer's own pairs, read at WCAG AA (the page's tokens, the way lib/contrast.cjs measures them) ── */
  {
    const { ratio } = require('./lib/contrast.cjs');
    const PAIRS = [['#6f6450', '#fbf6ec', 'muted on the page'], ['#6f6450', '#fffdf8', 'muted on a card'], ['#5c5240', '#f4ecdc', 'the quiet nav text on the sidebar'], ['#3d3527', '#f4ecdc', 'nav text on the sidebar'],
      ['#1f5f5b', '#e6d9bd', 'the active menu item'], ['#1f5f5b', '#fffdf8', 'codes and links on a card'], ['#fbf6ec', '#1f5f5b', 'the primary button'], ['#fbf6ec', '#2a2418', 'a pressed chip'],
      ['#e9dfc8', '#2a2418', 'a pressed chip\'s count'], ['#6f6450', '#f3ead7', 'muted on hover'], ['#7A5205', '#FDF3DC', 'the Waiting count']];
    const low = PAIRS.filter(([f, b]) => (ratio(f, b) || 0) < 4.5);
    ok(low.length === 0, 'the designer\'s text pairs all read at AA 4.5:1' + (low.length ? ' — failing: ' + low.map((x) => x[2]).join(', ') : ''));
  }

  /* ── 7 · PHONE ───────────────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn();
    const { ctx, p } = await open(S, { viewport: { width: 390, height: 844 } });
    await p.waitForSelector('[data-testid="acc-nav-daybook"]');
    await p.waitForTimeout(400);
    const side = await p.evaluate(() => ({ w: document.getElementById('side').getBoundingClientRect().width, labels: Array.from(document.querySelectorAll('.side .label')).filter((l) => getComputedStyle(l).display !== 'none').length }));
    ok(side.w === 64 && side.labels === 0, 'at 390 px the sidebar is an icon rail (' + side.w + ' px wide, ' + side.labels + ' labels)');
    for (const [id, label] of VIEWS) {
      await nav(p, id);
      await p.waitForTimeout(350);
      const w = await width(p);
      ok(w.sw === 390 && w.iw === 390, label + ' at 390 px: document.scrollWidth === 390 (' + w.sw + ')');
      /* ⚠️ the app shell clips the document itself, so the page's own scroller is where a sideways overflow would live */
      const m = await p.evaluate(() => { const e = document.querySelector('.main'); return { sw: e.scrollWidth, cw: e.clientWidth }; });
      ok(m.sw <= m.cw, label + ' at 390 px: nothing scrolls sideways inside the page either (' + m.sw + ' ≤ ' + m.cw + ')');
    }
    await nav(p, 'ledgers');
    await p.waitForSelector('[data-testid="bal-1300"]');
    const w2 = await width(p);
    ok(w2.sw === 390, 'Ledgers with every section open: scrollWidth === 390');
    /* ⚠️ a section clips what overflows it (overflow:hidden) — so scrollWidth alone cannot see a group pushed past its card */
    const clipped = await p.evaluate(() => Array.from(document.querySelectorAll('.group')).filter((g) => { const sec = g.closest('.section').getBoundingClientRect(), r = g.getBoundingClientRect(); return r.right > sec.right + 0.5 || r.left < sec.left - 0.5; }).length);
    ok(clipped === 0, 'at 390 px no group is pushed past its section (' + clipped + ' clipped)');
    await p.screenshot({ path: path.join(SHOTS, 'cb-accounts-phone.png'), fullPage: false });
    /* the party table is ONE LINE a party (name · balance) */
    await nav(p, 'ledgers');
    await p.waitForSelector('[data-testid="bal-1300"]');
    await p.click('[data-testid="lg-acc-1300"]');
    await p.waitForSelector('[data-testid="lg-party-c1"]');
    await p.waitForTimeout(300);
    const pl = await p.evaluate(() => { const tr = document.querySelector('[data-testid="lg-party-c1"]'); const v = Array.from(tr.children).filter((td) => getComputedStyle(td).display !== 'none').map((td) => td.textContent.trim()); return { h: tr.getBoundingClientRect().height, v, sw: document.documentElement.scrollWidth }; });
    ok(pl.v.length === 2 && /Ravi Stores/.test(pl.v[0]) && /3,000/.test(pl.v[1]) && pl.h < 60, 'at 390 px a party is one line — name · balance (' + pl.v.join(' · ') + ', ' + Math.round(pl.h) + ' px high)');
    ok(pl.sw === 390, 'the party table at 390 px: document.scrollWidth === 390 (' + pl.sw + ')');
    await p.screenshot({ path: path.join(SHOTS, 'party-ledgers-phone.png'), fullPage: false });
    /* a table is one card per row below 620 px, each cell named by its column */
    await nav(p, 'tb');
    await p.waitForSelector('table.bktab');
    const card = await p.evaluate(() => { const tr = document.querySelector('table.bktab tbody tr'); const cs = getComputedStyle(tr); return { disp: cs.display, labelled: tr.querySelectorAll('td[data-l]').length, head: getComputedStyle(document.querySelector('table.bktab thead')).display }; });
    ok(card.disp === 'block' && card.labelled >= 3 && card.head === 'none', 'a table is one card per row at 390 px, each cell labelled (' + card.labelled + ' labelled cells)');
    await ctx.close();
  }

  /* ── no page error, nothing left the machine ── */
  ok(threw.length === 0, 'no page error from CB Accounts' + (threw.length ? ': ' + threw.slice(0, 3).join(' | ') : ''));
  ok(offHost.filter((u) => !/fonts\.g|cdnjs\.cloudflare\.com\/ajax\/libs\/qrcode-generator/.test(u)).length === 0, 'nothing but the stand-in was reachable (the fonts and the QR script of the app page that Sign out opens, are refused)' + (offHost.length ? ' — refused: ' + offHost.join(' ') : ''));
  await b.close(); srv.close();
  console.log('\n  cb-accounts: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); console.log('  XX  the harness stopped: ' + e.message); console.log('\n  cb-accounts: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
