/* manual-entry.cjs — ＋ ENTRY ON THE DAY BOOK, PROVED (docs/design/manual-entry/CLOUD-TASK-web.md · REQUIREMENT.md).
 * Pattern: cb-accounts.cjs — Playwright, a stand-in API answering INSIDE the page; the static server takes a free port from the OS.
 * Nothing here reaches localhost:3000, port 7351 or any live site: every /api/** call is fulfilled by ctx.route, and any other host is aborted.
 * The page computes no money, so the STAND-IN is the engine: it composes the lines from the amount it is sent, names each line's type and
 * rule, and says `balanced`. The page must only show it.
 *
 *  1  the ＋ is on the Day book; it opens a sheet; the grid is the server's events, "Write a journal" is the last tile
 *  2  each event's flow (what → who/what → how much, when, paper → check) ends at the preview's lines (code · ledger · Dr · Cr, TYPE, RULE,
 *     voucher MJ with its kind) and Save posts to THAT event's route, once
 *  3  Save is OFF while the server says the entry does not balance, and while it refuses anything
 *  4  a locked month is refused the moment the date is picked, with its fix button
 *  5  a double tap on Save posts once (one client_ref)
 *  6  Write a journal: free Dr/Cr lines, the server's verdict decides Save
 *  7  Reverse this entry on a Day book row: a plain confirm, then the mirror (POST /entries/:id/reverse) once
 *  8  every warning has its fix button; a refused save says so in plain words with Try again
 *  9  phone: 390 px is document.scrollWidth === 390 at every step; no "accounting" anywhere
 * Screenshots: e2e/shots/manual-entry-{grid,form,preview,saved,locked,journal}-{laptop,phone}.png
 * Playwright is not in the cloud image: `npm i @playwright/test` somewhere outside the repo and run with NODE_PATH=<that>/node_modules.
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = process.env.ME_PUB || path.join(ROOT, 'public');        /* ME_PUB=<dir> runs against another copy (manual-entry-breaks.cjs) */
const SHOTS = path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
const TODAY = new Date().toISOString().slice(0, 10);
const SEC = { dr: 'Dr', cr: 'Cr' };

const F = { amount: { key: 'amount', kind: 'amount' }, date: { key: 'date', kind: 'date' }, paid: { key: 'paid_by', kind: 'paid_by' }, doc: { key: 'doc_no', kind: 'doc_no' }, photo: { key: 'photo', kind: 'photo' }, note: { key: 'narration', kind: 'narration' } };
const EVENTS = [
  { id: 'cash_to_bank', group: 'Money moves', icon: '🏦', label: 'Cash to bank', narration: 'Cash put in the bank', kind_word: 'Contra', route: { m: 'POST', p: '/api/books/entries/contra' }, fields: [{ key: 'bank', kind: 'bank', label: 'Which bank' }, F.amount, F.date, F.doc, F.photo, F.note] },
  { id: 'owner_in', group: 'Owner', icon: '👤', label: 'Put money in', narration: 'Owner put money in', kind_word: 'Receipt', route: { m: 'POST', p: '/api/books/entries/capital' }, fields: [F.amount, F.date, F.paid, F.note] },
  { id: 'rent_paid', group: 'Paid', icon: '🏠', label: 'Rent', narration: 'Rent paid', kind_word: 'Payment', route: { m: 'POST', p: '/api/books/entries/expense' }, fields: [{ key: 'ledger', kind: 'ledger', label: 'Which ledger' }, F.amount, F.date, F.paid, F.doc, F.photo, F.note] },
  { id: 'expense_gst', group: 'Paid', icon: '🧾', label: 'Expense with GST', narration: 'Expense bill', kind_word: 'Payment', route: { m: 'POST', p: '/api/books/entries/expense-gst' }, fields: [{ key: 'party', kind: 'party', side: 'supplier', label: 'Supplier' }, { key: 'ledger', kind: 'ledger' }, F.amount, F.date, F.paid, F.doc, F.note] },
  { id: 'loan_taken', group: 'Loan', icon: '💳', label: 'Loan taken', narration: 'Loan taken', kind_word: 'Receipt', route: { m: 'POST', p: '/api/books/entries/loan' }, fields: [{ key: 'loan', kind: 'loan', options: [{ v: 'L1', l: 'Bank loan' }] }, F.amount, F.date, F.paid, F.note] },
];
const ACCOUNTS = [['1400', 'Cash'], ['1500', 'Bank'], ['1510', 'UPI collections'], ['1300', 'Customers (Sundry Debtors)'], ['2100', 'Suppliers (Sundry Creditors)'], ['3000', 'Capital'], ['4000', 'Sales'], ['6010', 'Rent'], ['6090', 'Bank charges']].map(([code, name]) => ({ code, name, is_group: false }));
const NAME = Object.fromEntries(ACCOUNTS.map((a) => [a.code, a.name]));
const TYPE = (c) => (/^(1300|2100|3)/.test(c) ? 'personal' : /^[456]/.test(c) ? 'nominal' : 'real');
const L = (code, dr, cr, rule) => ({ code, name: NAME[code], dr_minor: dr, cr_minor: cr, type: TYPE(code), rule });

/* the stand-in IS the engine: it composes the journal from what it is sent */
function compose(b, S) {
  const a = b.amount_minor || 0, kind = (EVENTS.find((e) => e.id === b.event) || {}).kind_word || 'Journal';
  let lines;
  if (b.event === 'journal') lines = (b.lines || []).map((l) => L(l.code, l.side === 'dr' ? l.amount_minor : 0, l.side === 'cr' ? l.amount_minor : 0, TYPE(l.code) + ' · by hand'));
  else if (b.event === 'cash_to_bank') lines = [L(b.bank || '1500', a, 0, 'Bank: real, comes in → Dr'), L('1400', 0, a, 'Cash: real, goes out → Cr')];
  else if (b.event === 'owner_in') lines = [L(b.paid_by === 'bank' ? '1500' : '1400', a, 0, 'Cash: real, comes in → Dr'), L('3000', 0, a, 'Capital: personal, the owner gives → Cr')];
  else if (b.event === 'rent_paid') lines = [L(b.ledger || '6010', a, 0, 'Rent: nominal, an expense → Dr'), L(b.paid_by === 'bank' ? '1500' : '1400', 0, a, 'Cash: real, goes out → Cr')];
  else if (b.event === 'expense_gst') lines = [L(b.ledger || '6010', a, 0, 'Expense: nominal → Dr'), L('2100', 0, a, 'Supplier: personal, gives the goods → Cr')];
  else lines = [L('1500', a, 0, 'Bank: real, comes in → Dr'), L('2100', 0, a, 'Lender: personal, gives → Cr')];
  if (S.skew) lines[0].dr_minor += 100;
  const pv = { currency: 'INR', voucher: { series: 'MJ', kind }, narration: b.narration || '', lines, balanced: !S.skew, refusals: [], warnings: [] };
  if (S.skew && !S.quiet) pv.refusals.push({ code: 'UNBALANCED', message: 'Debit and credit are not the same.', fix: { label: 'Change the amount', step: 3, focus: 'amount' } });
  if (S.refuse) pv.refusals.push({ code: 'NOT_ALLOWED', message: 'This ledger cannot take this entry.', fix: { label: 'Change the ledger', step: 2, focus: 'ledger' } });
  if (b.event === 'expense_gst') pv.warnings.push({ code: 'CREDIT_BLOCKED', message: 'GST credit is not allowed on this bill.', fix: { label: 'Change the ledger', step: 2, focus: 'ledger' } });
  return pv;
}
const locked = (d) => String(d || '') < '2025-01-01';
const ENTRIES = [
  { entry_id: 'mj9', entry_no: 'MJ/2026-27/000009', posting_date: TODAY, doc_date: TODAY, event_type: 'manual', source_chit_id: null, narration: 'Rent paid', source: { kind: 'manual', by: 'Mayur' }, lines: [{ code: '6010', name: 'Rent', dr_minor: 1000000, cr_minor: 0 }, { code: '1400', name: 'Cash', dr_minor: 0, cr_minor: 1000000 }] },
  { entry_id: 'je1', entry_no: 'JV/2026-27/000001', posting_date: TODAY, doc_date: TODAY, event_type: 'walkin_day', source_chit_id: null, narration: 'Walk-in sales', source: { kind: 'day', counter: 'C1', count: 11, how: 'Cash', split: [{ how: 'Cash', amount_minor: 124000 }] }, lines: [{ code: '1400', name: 'Cash', dr_minor: 124000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 124000 }] },
];

function standIn() {
  return { calls: [], saves: [], reverses: [], previews: [], skew: false, quiet: false, refuse: false, failSave: false, delay: 0 };
}
async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  S.calls.push(m + ' ' + p);
  const body = () => { try { return JSON.parse(q.postData() || '{}'); } catch (_) { return {}; } };
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR' } });
  if (p === '/api/folders') return J(r, 200, { folders: [] });
  if (!p.startsWith('/api/books')) return J(r, m === 'GET' ? 200 : 200, m === 'GET' ? {} : { ok: true });
  if (p === '/api/books/health') return J(r, 200, { enabled: true, last_posted_day: TODAY, waiting: [] });
  if (p === '/api/books/accounts') return J(r, 200, { accounts: ACCOUNTS });
  if (p === '/api/books/events') return J(r, 200, { events: EVENTS });
  if (p === '/api/books/preview') { const b = body(); S.previews.push(b); const pv = compose(b, S); if (locked(b.date)) { pv.balanced = false; pv.refusals.push({ code: 'PERIOD_LOCKED', message: 'This month is locked. Open it again (with a reason), or pick another date.', fix: { label: 'Pick another date', step: 3, focus: 'date' } }); } if (b.check === 'date') return J(r, 200, { refusals: pv.refusals.filter((x) => x.code === 'PERIOD_LOCKED') }); return J(r, 200, pv); }
  let x;
  if (p === '/api/books/entries' || p.startsWith('/api/books/entries/')) {
    if ((x = p.match(/^\/api\/books\/entries\/([^/]+)\/reverse$/))) { S.reverses.push({ id: x[1], body: body() }); await new Promise((z) => setTimeout(z, S.delay)); return J(r, 200, { entry_id: 'mj10', entry_no: 'MJ/2026-27/000010' }); }
    if (m === 'POST') { S.saves.push({ path: p, body: body() }); await new Promise((z) => setTimeout(z, S.delay)); if (S.failSave) return J(r, 500, { error: 'Server error' }); return J(r, 200, { entry_id: 'mj' + S.saves.length, entry_no: 'MJ/2026-27/00000' + S.saves.length }); }
  }
  if (p === '/api/books/daybook') return J(r, 200, { currency: 'INR', entries: ENTRIES });
  if (p === '/api/books/dues') return J(r, 200, { currency: 'INR', as_of: TODAY, parties: [
    { party_id: 'c1', party_no: 'P-00001', name: 'Ravi Stores', side: 'customer', balance_minor: 300000, oldest_due: '2026-08-01', disputed_minor: 0, buckets: { lt_6m: 300000 } },
    { party_id: 's1', party_no: 'P-00003', name: 'Agro Mills', side: 'supplier', balance_minor: -150000, oldest_due: '2026-09-03', disputed_minor: 0, buckets: { not_due: -150000 } }] });
  if (p === '/api/books/cheques') return J(r, 200, { currency: 'INR', cheques: [] });
  if (p === '/api/books/periods') return J(r, 200, { periods: [] });
  return J(r, 404, { error: 'no stand-in for ' + p });
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
  const b = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
  const threw = [], offHost = [];
  const tokFor = (c) => { const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x'; };
  const OWNER = { token: tokFor({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan' };

  async function open(S, o) {
    o = o || {};
    const ctx = await b.newContext({ viewport: o.viewport || { width: 1360, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { offHost.push(r.request().url()); return r.abort(); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, OWNER);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + '/accounts.html');
    await p.waitForSelector('[data-testid="db-add"]', { timeout: 15000 });
    return { ctx, p };
  }
  const sw = (p) => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, dlg: (document.getElementById('en_body') || {}).scrollWidth || 0, dcw: (document.getElementById('en_body') || {}).clientWidth || 0 }));
  const shot = (p, n, tag) => p.screenshot({ path: path.join(SHOTS, 'manual-entry-' + n + '-' + tag + '.png') });
  const t = (p, id) => p.locator('[data-testid="' + id + '"]');
  const VAL = { bank: '1500', ledger: '6010', party: 's1', loan: 'L1', paid_by: 'cash', amount: '1500', date: TODAY, doc_no: 'BILL-77', narration: null, photo: null };
  /* fill whatever the event asks, the way a person would: only the fields the event lists */
  async function fillStep(p, ev, step) {
    for (const f of ev.fields) {
      const stepOf = ({ party: 2, ledger: 2, bank: 2, asset_class: 2, loan: 2, lines: 2 })[f.kind] || 3;
      if (stepOf !== step) continue; const v = VAL[f.kind]; if (v == null) continue;
      const el = t(p, 'en-f-' + f.key);
      if (f.kind === 'amount' || f.kind === 'doc_no' || f.kind === 'text') await el.fill(v);
      else if (f.kind === 'date') await el.fill(v);
      else await el.selectOption(v);
    }
  }
  async function flow(p, ev, o) {
    o = o || {};
    await t(p, 'en-event-' + ev.id).click();
    const has2 = ev.fields.some((f) => ['party', 'ledger', 'bank', 'asset_class', 'loan'].includes(f.kind));
    if (has2) { await t(p, 'en-step-2').waitFor(); await fillStep(p, ev, 2); ok(!/\[object|undefined|NaN/.test(await p.evaluate(() => document.getElementById('en_body').innerText)), ev.id + ': step 2 prints no stray [object Object] / undefined / NaN'); if (o.shot) await shot(p, 'form', o.tag); await t(p, 'en-next').click(); }
    await t(p, 'en-step-3').waitFor(); await fillStep(p, ev, 3);
    ok(!/\[object|undefined|NaN/.test(await p.evaluate(() => document.getElementById('en_body').innerText)), ev.id + ': step 3 prints no stray [object Object] / undefined / NaN');
    if (!has2 && o.shot) await shot(p, 'form', o.tag);
    await t(p, 'en-next').click();
    await t(p, 'en-step-4').waitFor(); await p.waitForSelector('[data-testid^="en-pline-"]');
  }

  /* ── the page's own source ── */
  {
    const src = fs.readFileSync(path.join(PUB, 'app/cap-entry.js'), 'utf8');
    ok(!/\balert\s*\(/.test(src), 'no alert() in cap-entry.js');
    ok(!/accounting|books of account/i.test(src.replace(/^\/\*[\s\S]*?\*\//, '')), 'cap-entry.js paints neither forbidden string');
  }

  /* ── 1 · the door, the grid ───────────────────────────────────────────────────────────────────── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    ok(await t(p, 'db-add').isVisible(), 'the ＋ Entry is on the Day book');
    await t(p, 'db-add').click(); await p.waitForSelector('[data-testid^="en-event-"]');
    const ids = await p.$$eval('[data-testid^="en-event-"]', (e) => e.map((x) => x.getAttribute('data-testid').slice(9)));
    ok(JSON.stringify(ids) === JSON.stringify(EVENTS.map((e) => e.id).concat('journal')), 'the grid is the server\'s events, then Write a journal LAST: ' + ids.join(' · '));
    ok(/^\s*\S+\s+Cash to bank\s*$/.test(await t(p, 'en-event-cash_to_bank').innerText()) || /Cash to bank/.test(await t(p, 'en-event-cash_to_bank').innerText()), 'a tile is an icon and its words');
    ok(S.calls.some((c) => c === 'GET /api/books/events'), 'the events came from GET /api/books/events');
    await shot(p, 'grid', 'laptop');
    ok(await p.evaluate(() => !!document.querySelector('.cbl')) && !(await p.evaluate(() => /Write a journal/.test(document.body.innerText) === false)), 'the Day book under it is still a CBList mount');

    /* ── 2 · each event ends at the preview, the right route is called once ── */
    await t(p, 'en-close').click();
    for (const ev of EVENTS) {
      await t(p, 'db-add').click(); await p.waitForSelector('[data-testid="en-event-' + ev.id + '"]');
      await flow(p, ev, { shot: ev.id === 'rent_paid', tag: 'laptop' });
      const rows = await p.$$eval('[data-testid^="en-pline-"]', (e) => e.map((x) => x.innerText));
      ok(rows.length === 2 && rows.every((r) => /\d{4}/.test(r)), ev.id + ': the preview shows two lines, each with its code and ledger (' + rows.length + ')');
      ok(rows.every((r) => r.includes('1,500.00')) && rows.filter((r) => r.includes('1,500.00')).length === 2, ev.id + ': every figure is the one the server sent (₹1,500.00 on each line)');
      ok(await p.$$eval('[data-testid^="en-ptype-"]', (e) => e.every((x) => /personal|real|nominal/.test(x.textContent))), ev.id + ': every line names its type (personal / real / nominal)');
      ok(await p.$$eval('[data-testid^="en-prule-"]', (e) => e.every((x) => /→ (Dr|Cr)/.test(x.textContent))), ev.id + ': every line names the golden rule that placed it');
      ok(/^MJ · /.test(await t(p, 'en-voucher').innerText()) && (await t(p, 'en-voucher').innerText()).includes(ev.kind_word), ev.id + ': the voucher is MJ with its kind (' + (await t(p, 'en-voucher').innerText()) + ')');
      ok(await t(p, 'en-balanced').count() === 1 && await t(p, 'en-save').isEnabled(), ev.id + ': the server said balanced, Save is on');
      if (ev.id === 'rent_paid') await shot(p, 'preview', 'laptop');
      const n0 = S.saves.length; await t(p, 'en-save').click(); await t(p, 'en-saved').waitFor();
      ok(S.saves.length === n0 + 1 && S.saves[S.saves.length - 1].path === ev.route.p, ev.id + ': Save posted once to ' + ev.route.p);
      const sv = S.saves[S.saves.length - 1].body;
      ok(sv.event === ev.id && sv.amount_minor === 150000 && /^web-/.test(sv.client_ref || ''), ev.id + ': the body carries the event, the amount in minor units (150000) and one client_ref');
      if (ev.id === 'rent_paid') await shot(p, 'saved', 'laptop');
      ok(/MJ\/2026-27\//.test(await t(p, 'en-saved-no').innerText()), ev.id + ': the saved entry shows its MJ number');
      await t(p, 'en-done').click();
    }
    const pv = S.previews.filter((x) => x.event === 'cash_to_bank' && !x.check)[0];
    ok(pv && pv.bank === '1500' && pv.narration === 'Cash put in the bank', 'the narration is prefilled from the event and sent with the bank picked');
    ok(!S.calls.some((c) => /localhost:3000|:7351/.test(c)), 'nothing left the stand-in');

    /* ── 8 · a warning has its fix ── */
    await t(p, 'db-add').click(); await flow(p, EVENTS.find((e) => e.id === 'expense_gst'), {});
    const w = await p.$$eval('[data-testid^="en-warning-"]', (e) => e.map((x) => !!x.querySelector('button')));
    ok(w.length === 1 && w.every(Boolean), 'a GST warning is shown and it has its fix button');
    await t(p, 'en-wfix-CREDIT_BLOCKED').click(); await t(p, 'en-step-2').waitFor();
    ok(true, 'the fix button takes the person back to the ledger step');
    await t(p, 'en-close').click();
    await ctx.close();
  }

  /* ── 3 · not balanced → Save off ── */
  {
    const S = standIn(); S.skew = true; const { ctx, p } = await open(S);
    await t(p, 'db-add').click(); await flow(p, EVENTS[0], {});
    ok(await t(p, 'en-unbalanced').count() === 1 && await t(p, 'en-save').isDisabled(), 'unbalanced: the server says so and Save is OFF');
    ok(await t(p, 'en-fix-UNBALANCED').count() === 1, 'the refusal has its fix button');
    await t(p, 'en-save').click({ force: true, timeout: 1500 }).catch(() => {});
    ok(S.saves.length === 0, 'unbalanced: nothing was posted');
    await ctx.close();
  }
  /* the server may say "not balanced" WITHOUT a refusal, or refuse a balanced journal: either one alone keeps Save off */
  {
    const S = standIn(); S.skew = true; S.quiet = true; const { ctx, p } = await open(S);
    await t(p, 'db-add').click(); await flow(p, EVENTS[0], {});
    ok(await t(p, 'en-unbalanced').count() === 1 && await t(p, 'en-save').isDisabled(), 'unbalanced with no refusal named: Save is still OFF');
    await ctx.close();
  }
  {
    const S = standIn(); S.refuse = true; const { ctx, p } = await open(S);
    await t(p, 'db-add').click(); await flow(p, EVENTS[0], {});
    ok(await t(p, 'en-balanced').count() === 1 && await t(p, 'en-save').isDisabled() && await t(p, 'en-fix-NOT_ALLOWED').count() === 1, 'balanced but refused: Save is OFF and the refusal has its fix button');
    await ctx.close();
  }

  /* ── 4 · locked month ── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await t(p, 'db-add').click(); await t(p, 'en-event-owner_in').click(); await t(p, 'en-step-3').waitFor();
    await t(p, 'en-f-amount').fill('500'); await t(p, 'en-f-paid_by').selectOption('cash'); await t(p, 'en-f-date').fill('2020-01-15');
    await t(p, 'en-refusal-PERIOD_LOCKED').waitFor();
    ok(await t(p, 'en-next').isDisabled(), 'a locked month is refused as soon as the date is picked (Next is off)');
    ok(S.previews.some((x) => x.check === 'date' && x.date === '2020-01-15') && S.previews.every((x) => !x.lines), 'the refusal came from the server, at the date, not from the page');
    ok(/Pick another date/.test(await t(p, 'en-fix-PERIOD_LOCKED').innerText()), 'the refusal has its fix button');
    await shot(p, 'locked', 'laptop');
    await t(p, 'en-fix-PERIOD_LOCKED').click();
    await t(p, 'en-f-date').fill(TODAY); await p.waitForFunction(() => !document.querySelector('[data-testid="en-refusal-PERIOD_LOCKED"]'));
    ok(await t(p, 'en-next').isEnabled(), 'a good date lifts the refusal and Next is on again');
    await ctx.close();
  }

  /* ── 5 · double tap posts once ── */
  {
    const S = standIn(); S.delay = 500; const { ctx, p } = await open(S);
    await t(p, 'db-add').click(); await flow(p, EVENTS[1], {});
    /* two taps in the same instant — the button's own disabling must not be the only thing standing in the way */
    await p.evaluate(() => { const b = document.querySelector('[data-testid="en-save"]'); b.click(); b.click(); }); await t(p, 'en-saved').waitFor();
    ok(S.saves.length === 1, 'a double tap on Save posted once (' + S.saves.length + ')');
    /* a failed save says so, and Try again posts with the SAME client_ref */
    await t(p, 'en-done').click();
    S.failSave = true; S.delay = 0; await t(p, 'db-add').click(); await flow(p, EVENTS[1], {});
    await t(p, 'en-save').click(); await t(p, 'en-refusal-SAVE').waitFor();
    ok(/Could not|Server|try/i.test(await t(p, 'en-refusal-SAVE').innerText()) && await t(p, 'en-fix-SAVE').count() === 1, 'a failed save is said in plain words with Try again');
    S.failSave = false; await t(p, 'en-fix-SAVE').click(); await p.waitForSelector('[data-testid="en-save"]:not([disabled])'); await t(p, 'en-save').click(); await t(p, 'en-saved').waitFor();
    const refs = S.saves.slice(1).map((x) => x.body.client_ref);
    ok(refs.length === 2 && refs[0] === refs[1], 'Try again sends the same client_ref, so the server answers with what it already kept');
    await ctx.close();
  }

  /* ── 6 · Write a journal ── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await t(p, 'db-add').click(); await t(p, 'en-event-journal').click(); await t(p, 'en-step-2').waitFor();
    ok(await t(p, 'en-next').isDisabled(), 'journal: Next is off until every line has a ledger and an amount');
    await t(p, 'en-line-code-0').selectOption('6090'); await t(p, 'en-line-amt-0').fill('250'); await t(p, 'en-line-side-0').selectOption('dr');
    await t(p, 'en-line-code-1').selectOption('1500'); await t(p, 'en-line-amt-1').fill('250'); await t(p, 'en-line-side-1').selectOption('cr');
    await t(p, 'en-line-add').click(); ok(await p.locator('[data-testid^="en-line-code-"]').count() === 3, 'journal: lines can be added');
    await t(p, 'en-line-del-2').click();
    await shot(p, 'journal', 'laptop');
    await t(p, 'en-next').click(); await t(p, 'en-step-3').waitFor(); await t(p, 'en-next').click(); await t(p, 'en-step-4').waitFor(); await p.waitForSelector('[data-testid^="en-pline-"]');
    const jb = S.previews.filter((x) => x.event === 'journal' && x.lines).pop();
    ok(jb && jb.lines.length === 2 && jb.lines[0].amount_minor === 25000 && jb.lines[0].side === 'dr' && jb.lines[1].side === 'cr', 'journal: the lines go to the server as typed (Dr 25000 · Cr 25000)');
    ok(await t(p, 'en-save').isEnabled(), 'journal: balanced by the server, Save is on');
    await t(p, 'en-back').click(); await t(p, 'en-back').click(); await t(p, 'en-line-amt-1').fill('240'); S.skew = true;
    await t(p, 'en-next').click(); await t(p, 'en-next').click(); await t(p, 'en-unbalanced').waitFor();
    ok(await t(p, 'en-save').isDisabled(), 'journal: when the server says it does not balance, Save is OFF');
    await ctx.close();
  }

  /* ── 7 · Reverse this entry ── */
  {
    const S = standIn(); S.delay = 300; const { ctx, p } = await open(S);
    await t(p, 'db-expand-all').click();   /* a row's details open the way every Day book row's do */
    await p.waitForSelector('[data-testid="db-reverse"]');
    const n = await p.locator('[data-testid="db-reverse"]').count();
    ok(n >= 1, 'a Day book row offers Reverse this entry (' + n + ')');
    await p.locator('[data-testid="db-reverse"]').first().click();
    await t(p, 'confirm').waitFor();
    ok(/Reverse this entry\?/.test(await t(p, 'confirm').innerText()) && S.reverses.length === 0, 'a plain confirm asks first; nothing is posted yet');
    await t(p, 'confirm-ok').click(); await p.waitForFunction(() => true); await p.waitForTimeout(600);
    ok(S.reverses.length === 1 && S.reverses[0].id === 'mj9' && /^web-/.test(S.reverses[0].body.client_ref || ''), 'Reverse posts the mirror once, to /entries/mj9/reverse, with a client_ref');
    ok(await p.evaluate(() => /MJ\/2026-27\/000010/.test(document.body.innerText)), 'the new entry number is told');
    await ctx.close();
  }

  /* ── 9 · phone: 390 px at every step ── */
  {
    const S = standIn(); const { ctx, p } = await open(S, { viewport: { width: 390, height: 844 } });
    let w = await sw(p); ok(w.sw === 390, 'phone: the Day book itself is 390 px (' + w.sw + ')');
    await t(p, 'db-add').click(); await p.waitForSelector('[data-testid^="en-event-"]'); await p.waitForTimeout(150);
    w = await sw(p); ok(w.sw === 390 && w.dlg <= w.dcw + 1, 'phone: the grid, scrollWidth === 390 (' + w.sw + ', sheet body ' + w.dlg + '/' + w.dcw + ')');
    ok(await p.$$eval('[data-testid^="en-event-"]', (e) => e.every((x) => x.getBoundingClientRect().height >= 44 && x.getBoundingClientRect().right <= 390)), 'phone: every tile is a 44 px+ target inside the screen');
    await shot(p, 'grid', 'phone');
    await t(p, 'en-event-rent_paid').click(); await t(p, 'en-step-2').waitFor(); w = await sw(p); ok(w.sw === 390, 'phone: step 2, scrollWidth === 390');
    await t(p, 'en-f-ledger').selectOption('6010'); await shot(p, 'form', 'phone'); await t(p, 'en-next').click();
    await t(p, 'en-step-3').waitFor(); w = await sw(p); ok(w.sw === 390, 'phone: step 3, scrollWidth === 390');
    await t(p, 'en-f-amount').fill('1500'); await t(p, 'en-f-paid_by').selectOption('cash'); await t(p, 'en-f-date').fill('2020-02-02'); await t(p, 'en-refusal-PERIOD_LOCKED').waitFor();
    await shot(p, 'locked', 'phone'); await t(p, 'en-f-date').fill(TODAY); await p.waitForFunction(() => !document.querySelector('[data-testid="en-refusal-PERIOD_LOCKED"]'));
    await t(p, 'en-next').click(); await t(p, 'en-step-4').waitFor(); await p.waitForSelector('[data-testid^="en-pline-"]'); w = await sw(p); ok(w.sw === 390 && w.dlg <= w.dcw + 1, 'phone: the preview, scrollWidth === 390 (' + w.sw + ')');
    await shot(p, 'preview', 'phone');
    await t(p, 'en-save').click(); await t(p, 'en-saved').waitFor(); w = await sw(p); ok(w.sw === 390, 'phone: saved, scrollWidth === 390'); await shot(p, 'saved', 'phone');
    await t(p, 'en-done').click();
    await t(p, 'db-add').click(); await t(p, 'en-event-journal').click(); await t(p, 'en-step-2').waitFor();
    await t(p, 'en-line-add').click(); w = await sw(p); ok(w.sw === 390 && w.dlg <= w.dcw + 1, 'phone: the journal lines, scrollWidth === 390 (' + w.sw + ')'); await shot(p, 'journal', 'phone');
    ok(!/accounting|books of account/i.test(await p.evaluate(() => document.body.innerText)), 'phone: "accounting" appears nowhere');
    await ctx.close();
  }

  ok(threw.length === 0, 'no page error' + (threw.length ? ': ' + threw[0] : ''));
  ok(offHost.length === 0, 'nothing tried to leave for another host' + (offHost.length ? ': ' + offHost[0] : ''));
  await b.close(); srv.close();
  console.log('\nmanual-entry: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
