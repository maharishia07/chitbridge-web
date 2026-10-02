/* chit-sheet.cjs — THE CHIT SHEET, DRIVEN THROUGH ITS CONTROLS (docs/design/chit-sheet/CLOUD-TASK.md).
 * Pattern: books-web.cjs — a stand-in API answers every /api/** call INSIDE the page; the static server takes a free
 * port from the OS. Nothing reaches localhost:3000, port 7351, or the live site.
 *
 *  1  from the Day book, a counter bill opens as a popup: header, lines + offer, GST rows as the chit holds them, total, tender
 *  2  its icon row is Print · Return · Open page — no Dispute, no Accept
 *  3  a received supplier bill: Accept · Dispute · Goods in · Open page; a task: Accept · Dispute · Open page (Done once in hand)
 *  4  Accept calls the status route once; the sheet repaints with the new step and the row changes
 *  5  Esc / Close returns to the Day book, scroll position kept; the page never navigated
 *  6  the to-do "supplier bill to accept": one bill → its sheet over the Day book (no navigation); several → Ledger › Waiting
 *  7  the title is the document (Bill · Supplier bill · Task), never "Chit"; tender parts add up to the total, change is apart
 *  8  scrollWidth === 390 at phone width; no "accounting"; "(owner)" when by == the shop's own name
 *  9  (2026-10-02, web-reads-invoice) a chit carrying a REAL business_json.invoice (CBTax.determine, the C2/26-27/0007 shape: inclusive
 *     prices · 12% + 18% · offers · intra · place of supply 33) → lines, GST rows, round-off and total EQUAL CBTax.moneyOf(invoice) to the paisa;
 *     summary_json.money alone → read from it; neither → "not recorded"
 * 10  Accept on a bill received asks what it is for FIRST (PUT /use, then PUT /status — once each); the step is read from the chit's
 *     state_log bill_step row (the shared status never moves), so the sheet, the to-do and Waiting stop saying "To accept"
 * 11  the popup names the counter as the Day book does (Counter C2); CB Accounts' Bills rows open the sheet and name who accepted
 * 12  #/app/ledger, a remembered cb_nav of 'ledger' and navTo('ledger') land on /accounts.html at the same view; the app's menu has a Bills door
 *  Env CHS_ROOT = a COPY of public/ (used by chit-sheet-breaks.cjs); screenshots to e2e/shots/chit-sheet-*.png
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.CHS_ROOT || path.join(__dirname, '..', 'public');
const SHOTS = process.env.CHS_ROOT ? null : path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
const SHOP = 'Books Shop', TODAY = new Date().toISOString().slice(0, 10);

/* the REAL engine, the real invoice: the adopted tax.js run in a sandbox, CBTax.determine() once, CBTax.moneyOf() to read it */
const vm = require('vm');
const eng = { }; eng.window = eng; eng.self = eng; vm.createContext(eng);
for (const f of ['engine/money.js', 'app/tax.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng);
const LINES = [{ name: 'Rice 5kg', unit: 'piece', qty: 2, unit_price: 97.16, discount: 10, gst_rate: 12 }, { name: 'Soap', unit: 'piece', qty: 3, unit_price: 98.7, discount: 0, gst_rate: 18 },
               { name: 'Oil 1L', unit: 'piece', qty: 1, unit_price: 89.48, discount: 5.25, gst_rate: 12 }, { name: 'Tea', unit: 'piece', qty: 2, unit_price: 54.8, discount: 0, gst_rate: 18 }];
const INV = eng.CBTax.determine({ seller: { Gstin: '33AAAAA0000A1Z5', State: '33', LglNm: SHOP }, buyer: { LglNm: 'Walk-in', State: '', Pos: '33' }, lines: LINES, priceIncludesTax: true });
const EXP = eng.CBTax.moneyOf(INV, 'INR');   /* what every screen must show, to the paisa */
const f2 = (n) => Number(n).toFixed(2);

/* ── the stand-in: three chits (a counter bill, a supplier bill, a task) and the Ledger's day book that points at them ── */
function standIn() {
  const me = { role: 'sender', display_name: SHOP, entity_id: 'ent-books' };
  const S = { statusCalls: [], useCalls: [], calls: [], disputes: 0, chitReads: 0, chits: {} };
  S.chits.ch1 = { header: { chit_id: 'ch1', purpose: 'order', current_status: 'completed', manual_subject: 'Counter sale C2/26-27/0002', created_at: TODAY + 'T05:10:00.000Z',
    all_recipients: [me, { role: 'receiver', display_name: 'self' }],
    summary_json: { currency_code: 'INR', money: { total: 1, tax: 1 } },   /* a header that disagrees: the FROZEN INVOICE wins, so a reader that falls back to the header is caught */
    business_json: { bill_no: 'C2/26-27/0002', billed_at: TODAY + 'T05:10:00.000Z', till: { id: 't2', name: 'Counter 2', by: { name: SHOP } }, customer: { name: 'Walk-in' },
      payment: { mode: 'cash+upi', paid: EXP.total, change: 25.74, parts: [{ how: 'cash', amount: 500 }, { how: 'upi', amount: Math.round((EXP.total - 500) * 100) / 100 }] },
      invoice: INV } },
    detail: { line_items: LINES.map((l, i) => ({ particulars: l.name, quantity: l.qty, unit: l.unit, price: l.unit_price, total: Math.round(l.qty * l.unit_price * 100) / 100,   /* the chit's own line value — the invoice line's total (after offers, tax) is what the sheet must show */
       gst_rate: l.gst_rate, offer: l.discount ? { off: l.discount, label: 'Festival offer' } : undefined })) } };
  /* summary_json.money only (an older chit): the figures are what the header holds, never a sum of the lines */
  S.chits.ch2 = { header: { chit_id: 'ch2', purpose: 'order', current_status: 'completed', manual_subject: 'Counter sale C1/26-27/0003', created_at: TODAY + 'T05:20:00.000Z',
    all_recipients: [me, { role: 'receiver', display_name: 'self' }],
    summary_json: { currency_code: 'INR', money: { total: 1180, tax: 180, taxable: 1000, cgst: 90, sgst: 90, igst: 0, supply: 'intra', by_rate: { 18: { taxable: 1000, cgst: 90, sgst: 90, igst: 0, tax: 180 } } } },
    business_json: { bill_no: 'C1/26-27/0003', till: { id: 't1', name: 'Counter 1' }, customer: { name: 'Walk-in' } } },
    detail: { line_items: [{ particulars: 'Lamp', quantity: 1, unit: 'piece', price: 1180, total: 1180, gst_rate: 18 }] } };
  /* neither: nothing is invented */
  S.chits.nr1 = { header: { chit_id: 'nr1', purpose: 'order', current_status: 'completed', manual_subject: 'Counter sale C1/26-27/0004', created_at: TODAY + 'T05:30:00.000Z',
    all_recipients: [me, { role: 'receiver', display_name: 'self' }], summary_json: { currency_code: 'INR' },
    business_json: { bill_no: 'C1/26-27/0004', till: { id: 't1', name: 'Counter 1' }, customer: { name: 'Walk-in' } } },
    detail: { line_items: [{ particulars: 'Pen', quantity: 1, unit: 'piece', price: 10, total: 10 }] } };
  /* the stored total (999) is NOT the lines' sum (1180): a detail that recomputes would say 1,180 */
  S.chits.dt1 = { header: { chit_id: 'dt1', purpose: 'order', current_status: 'completed', manual_subject: 'Counter sale C1/26-27/0005', created_at: TODAY + 'T05:40:00.000Z',
    all_recipients: [me, { role: 'receiver', display_name: 'self' }],
    summary_json: { currency_code: 'INR', money: { total: 999, tax: 99, savings: 12, taxable: 900, cgst: 49.5, sgst: 49.5, igst: 0, supply: 'intra', by_rate: { 12: { taxable: 900, cgst: 49.5, sgst: 49.5, igst: 0, tax: 99 } } } },
    business_json: { bill_no: 'C1/26-27/0005', till: { id: 't1', name: 'Counter 1' }, customer: { name: 'Walk-in' } } },
    detail: { line_items: [{ particulars: 'Lamp', quantity: 1, unit: 'piece', price: 1180, total: 1180, gst_rate: 18 }] } };
  S.chits.sb1 = { header: { chit_id: 'sb1', purpose: 'invoice', current_status: 'pending', manual_subject: 'AM-81', created_at: TODAY + 'T04:00:00.000Z',
    all_recipients: [{ role: 'sender', display_name: 'Agro Mills', entity_id: 'ent-agro' }, { role: 'receiver', display_name: SHOP, entity_id: 'ent-books' }],
    summary_json: { currency_code: 'INR', bill_received: { from: 'Agro Mills', total: 2500 }, money: { total: 2500, tax: 119.05, taxable: 2380.95, cgst: 59.52, sgst: 59.53, igst: 0, supply: 'intra', by_rate: { 5: { taxable: 2380.95, cgst: 59.52, sgst: 59.53, igst: 0, tax: 119.05 } } } },
    business_json: { bill_no: 'AM-81' } },
    state_log: [{ action: 'status', previous_status: null, new_status: 'pending', mine: false }],
    detail: { line_items: [{ particulars: 'Basmati 25kg', quantity: 10, unit: 'bag', price: 238.095, total: 2380.95, gst_rate: 5 }] } };
  S.chits.tk1 = { header: { chit_id: 'tk1', purpose: 'general', current_status: 'pending', manual_subject: 'Fix the shutter', created_at: TODAY + 'T03:00:00.000Z',
    all_recipients: [{ role: 'sender', display_name: 'Agro Mills', entity_id: 'ent-agro' }, { role: 'receiver', display_name: SHOP, entity_id: 'ent-books' }],
    summary_json: {}, business_json: {} }, detail: { line_items: [{ particulars: 'Shutter repair', quantity: 1, unit: 'job', price: 800, total: 800 }] } };
  const e = (n, id, ref, kind, by, extra) => Object.assign({ entry_id: 'e' + n, entry_no: 'JV/2026-27/00000' + n, posting_date: TODAY, doc_date: TODAY, event_type: 'sale_bill', source_chit_id: id, narration: 'Sale',
    source: { chit_id: id, ref, kind, counter: 'C2', by, count: null, how: 'UPI', how_ref: null, split: null, doc_at: TODAY + 'T05:10:00.000Z', recorded_at: TODAY + 'T05:10:03.000Z' },
    lines: [{ code: '1400', name: 'Cash', dr_minor: 68201, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 68201 }] }, extra || {});
  S.entries = [e(1, 'ch1', 'C2/26-27/0002', 'bill', SHOP), e(2, 'sb1', 'AM-81', 'purchase', 'Mani')];
  for (let i = 3; i < 40; i++) S.entries.push(e(i, null, 'X' + i, 'bill', 'Mani', { source_chit_id: null, source: null }));   /* filler so the Day book scrolls */
  S.waiting = [{ id: 1, chit_id: 'sb1', ref: 'bill:sb1', reason: 'Waiting for you to confirm Agro Mills’ bill AM-81.', tries: 0, since: TODAY + 'T04:00:00Z', stuck: true }];
  return S;
}
async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  let body = {}; try { body = JSON.parse(q.postData() || '{}'); } catch (_) {}
  if (p === '/api/books/status') return J(r, 200, { migrated: true, enabled: true, walkin_grain: 'day' });
  if (p === '/api/books/health') return J(r, 200, { enabled: true, last_check: { ok: true }, waiting: S.waiting });
  if (p === '/api/books/cheques') return J(r, 200, { currency: 'INR', cheques: [] });
  if (p === '/api/books/dues') return J(r, 200, { currency: 'INR', as_of: TODAY, parties: [] });
  if (p === '/api/books/daybook') return J(r, 200, { currency: 'INR', entries: S.entries });
  if (p.startsWith('/api/books')) return J(r, 200, {});
  let x;
  if ((x = p.match(/^\/api\/chits\/([^/]+)\/status$/)) && m === 'PUT') {
    S.statusCalls.push({ id: x[1], body }); S.calls.push('status');
    /* a bill I received: since "bills-private" my step is a bill_step row in MY state_log — the shared status is the seller's and does not move */
    if (S.chits[x[1]].header.purpose === 'invoice') { (S.chits[x[1]].state_log = S.chits[x[1]].state_log || []).push({ action: 'bill_step', code: 'B-2100', step: body.status, mine: true }); S.waiting = S.waiting.filter((w) => w.chit_id !== x[1]); }
    else S.chits[x[1]].header.current_status = body.status;
    return J(r, 200, { ok: true });
  }
  if ((x = p.match(/^\/api\/chits\/([^/]+)\/use$/)) && m === 'PUT') { S.useCalls.push({ id: x[1], body }); S.calls.push('use'); return J(r, 200, { ok: true }); }
  if ((x = p.match(/^\/api\/chits\/([^/]+)\/dispute/)) && m === 'POST') { S.disputes++; return J(r, 200, { ok: true }); }
  if ((x = p.match(/^\/api\/chits\/([^/]+)$/)) && m === 'GET') { S.chitReads++; return S.chits[x[1]] ? J(r, 200, S.chits[x[1]]) : J(r, 404, { error: 'no chit' }); }
  if (p === '/api/folders' && m === 'GET') return J(r, 200, { folders: [
    { folder_id: 'a0000000-0000-5000-8000-000000002100', parent_id: null, name: 'Bills · Received', code: 'B-2100', kind: 'view', system: true, scope: null, side: 'received', count: 2, total: 3 },
    { folder_id: 'a0000000-0000-5000-8000-000000001300', parent_id: null, name: 'Bills · Issued', code: 'B-1300', kind: 'view', system: true, scope: null, side: 'issued', count: 0, total: 0 }] });
  if (p.match(/^\/api\/folders\/[^/]+\/chits$/)) return J(r, 200, { chits: [
    { chit_id: 'sb1', bill_no: 'AM-81', manual_subject: 'Bill AM-81 from Agro Mills', counterparty_name: 'Agro Mills', value: '2500', currency: 'INR', doc_kind: 'bill_received',
      all_recipients: [{ role: 'receiver', display_name: 'Books Shop', handle: 'books-shop' }],
      bill: { step: 'accepted', code: 'B-2100', label: 'Bill accepted', by: 'books-shop', at: TODAY + 'T06:00:00Z', open: true, paid: false } },
    { chit_id: 'sb2', bill_no: 'AM-82', manual_subject: 'Bill AM-82 from Agro Mills', counterparty_name: 'Agro Mills', value: '1200', currency: 'INR', doc_kind: 'bill_received',
      bill: { step: 'received', code: 'B-2100', label: 'Received', by: 'Mani', at: TODAY + 'T06:10:00Z', open: true, paid: false } }] });
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

(async () => {
  const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const threw = [];
  async function open(S, width) {
    const ctx = await b.newContext({ viewport: { width: width || 1360, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    await ctx.addInitScript(([shop]) => { try {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const tok = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-books', identity_type: 'entity', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
      localStorage.setItem('cb_sess', JSON.stringify({ token: tok, role: 'entity', name: shop })); } catch (_) {} }, [SHOP]);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => threw.push(e.message));
    /* the Ledger lives on /accounts.html (the in-app door redirects there) — the sheet is opened from CB Accounts' own Day book */
    await p.goto(base + '/accounts.html#daybook');
    await p.waitForSelector('[data-testid="acc-nav-daybook"]', { timeout: 20000 });
    await p.click('[data-testid="acc-nav-daybook"]');
    await p.waitForSelector('[data-testid="db-entry-JV/2026-27/000001"]', { timeout: 15000 });
    return { ctx, p };
  }
  const acts = (p) => p.$$eval('#chitsheet [data-testid^="cs-act-"]', (els) => els.map((e) => e.getAttribute('data-testid').slice(7)));
  const sheetOpen = (p) => p.evaluate(() => { const d = document.getElementById('chitsheet'); return !!(d && d.open); });
  const waitSheet = (p, no) => p.waitForFunction((n) => { const d = document.getElementById('chitsheet'); return d && d.open && (d.querySelector('[data-testid="cs-no"]') || {}).textContent === n; }, no, { timeout: 8000 }).catch(() => {});
  const noAccounting = async (p, where) => { const t = await p.evaluate(() => document.body.innerText); ok(!/accounting|books of account/i.test(t), where + ': the word "accounting" is nowhere on screen'); };
  const shot = async (p, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };

  /* ── 1 · the counter bill, from the Day book ─────────────────────────────────────────────────────── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    const head1 = await p.textContent('[data-testid="db-entry-JV/2026-27/000001"]');
    ok(/Books Shop \(owner\)/.test(head1), 'by == the shop\'s own name → "Books Shop (owner)" in the source line');
    ok(!/Mani \(owner\)/.test(await p.textContent('[data-testid="db-head-JV/2026-27/000002"]')), 'another person is not marked (owner)');
    /* scroll the page down to a row far from the top, remember where */
    const scroller = await p.evaluateHandle(() => { let e = document.querySelector('[data-testid="db-entry-JV/2026-27/000001"]'); while (e && e !== document.documentElement) { if (e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e; e = e.parentElement; } return document.scrollingElement; });
    await scroller.evaluate((e) => { e.scrollTop = 120; });
    const before = await scroller.evaluate((e) => e.scrollTop);
    const hrefBefore = await p.evaluate(() => location.href);
    await p.click('[data-testid="db-src-JV/2026-27/000001"]');
    await waitSheet(p, 'C2/26-27/0002');
    ok(await sheetOpen(p), 'tapping the bill number opens the sheet (a <dialog>) over the Day book');
    const head = await p.textContent('[data-testid="cs-head"]');
    ok(/Counter bill/.test(head) && /C2\/26-27\/0002/.test(head) && /Counter C2/.test(head) && !/Counter 2/.test(head) && /Books Shop/.test(head), 'header: kind · number · date/time · counter (C2 — the way the Day book says it, not the till\'s "Counter 2") · person — ' + head.replace(/\s+/g, ' ').trim());
    ok(/Counter C2/.test(await p.textContent('[data-testid="db-entry-JV/2026-27/000001"]')), 'the Day book names the same counter: Counter C2');
    /* every figure is CBTax.moneyOf(invoice), to the paisa — read off the DOM cells, compared with the engine's own numbers */
    const nums = async (sel) => (await p.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/[₹,\s]/g, ''))));
    const lineTotals = await nums('#chitsheet tbody tr[data-testid^="cs-line-"] td:last-child');
    ok(lineTotals.length === 4 && lineTotals.every((t, i) => t === f2(EXP.lines[i].total)), 'the popup\'s line totals equal moneyOf(invoice).lines — ' + lineTotals.join(' · '));
    const off0 = (await p.textContent('[data-testid="cs-offer-0"]')).replace(/[₹,\s]/g, '');
    ok(await p.locator('[data-testid="cs-offer-1"]').count() === 0 && /Festivaloffer/.test(off0) && off0.endsWith('−' + f2(EXP.lines[0].discount)), 'line 1\'s offer is the invoice line\'s discount (' + f2(EXP.lines[0].discount) + '), labelled — ' + off0);
    for (const rt of Object.keys(EXP.by_rate)) {
      const c = await nums('[data-testid="cs-gst-' + rt + '"] td'), v = EXP.by_rate[rt];
      ok(c[0] === rt + '%' && c[1] === f2(v.taxable) && c[2] === f2(v.cgst) && c[3] === f2(v.sgst), 'GST ' + rt + '%: taxable ' + f2(v.taxable) + ' · CGST ' + f2(v.cgst) + ' · SGST ' + f2(v.sgst) + ' = moneyOf(invoice).by_rate — ' + c.join(' | '));
    }
    const foot = await nums('[data-testid="cs-gst"] tr.tot td');
    ok(foot[1] === f2(EXP.taxable) && foot[2] === f2(EXP.cgst) && foot[3] === f2(EXP.sgst), 'the GST footing is the invoice\'s own totals (' + foot.join(' | ') + ') — no hand halving, no column sum');
    ok(/GST summary/i.test(await p.textContent('#chitsheet')) && /CGST/.test(await p.textContent('[data-testid="cs-gst"]')) && /SGST/.test(await p.textContent('[data-testid="cs-gst"]')), 'the summary is headed GST summary with CGST / SGST columns');
    ok((await p.textContent('[data-testid="cs-total"]')).replace(/[₹,\s]/g, '') === f2(EXP.total), 'the total is moneyOf(invoice).total — ' + f2(EXP.total));
    ok(EXP.round_off === 0 ? await p.locator('[data-testid="cs-roundoff"]').count() === 0 : (await p.textContent('[data-testid="cs-roundoff"]')).replace(/[₹,\s]/g, '').endsWith(f2(EXP.round_off)), 'round-off ' + f2(EXP.round_off) + (EXP.round_off ? ' shown' : ' — none, no row'));
    const t0 = await p.textContent('[data-testid="cs-tender-0"]'), t1 = await p.textContent('[data-testid="cs-tender-1"]');
    ok(/Cash/.test(t0) && /500/.test(t0) && /UPI/.test(t1) && t1.replace(/[₹,\s]/g, '').endsWith(f2(EXP.total - 500)), 'tender: Cash 500.00 · UPI ' + f2(EXP.total - 500));
    /* as the counter's slip prints it: each tender, then Change when there is some; the tenders add up to the total */
    const tenders = await p.$$eval('#chitsheet [data-testid^="cs-tender-"] b', (els) => els.map((e) => e.textContent));
    const tsum = Math.round(tenders.reduce((a, x) => a + Number(x.replace(/[^0-9.]/g, '')), 0) * 100) / 100;
    ok(tenders.length === 2 && tsum === Number((await p.textContent('[data-testid="cs-total"]')).replace(/[^0-9.]/g, '')), 'tender parts add up to the total (' + tenders.join(' + ') + ' = ' + tsum + ')');
    ok(/25\.74/.test(await p.textContent('[data-testid="cs-change"]')) && (S.chits.ch1.header.business_json.payment.paid === tsum), 'Change 25.74 is its own line, and the chit\'s paid figure is the tenders\' sum');
    ok(await p.textContent('[data-testid="cs-title"]') === 'Bill' && !/\bChit\b/.test(await p.textContent('#chitsheet')), 'the title of a counter bill is "Bill" — "Chit" is nowhere on the sheet');
    ok(/Walk-in/.test(await p.textContent('[data-testid="cs-who"]')) && /Done/.test(await p.textContent('[data-testid="cs-step"]')), 'the customer and the step word (Done)');
    const a = await acts(p);
    ok(JSON.stringify(a) === JSON.stringify(['print', 'return', 'page']), 'cart bill icon row = Print · Return · Open page — got ' + a.join(' · '));
    ok(!a.includes('dispute') && !a.includes('accept'), 'a cart bill has no Dispute (and no Accept)');
    await shot(p, 'chit-sheet-cart'); await shot(p, 'chit-sheet-invoice-laptop');
    await noAccounting(p, 'sheet');
    /* Return is honest: no web return flow exists, so it says where returns are made */
    await p.click('[data-testid="cs-act-return"]');
    ok(/counter/i.test(await p.textContent('[data-testid="cs-note"]')), 'Return says where a return is made');
    ok(!/chit-detail|#\/chit/.test(await p.evaluate(() => location.href)) && await p.evaluate(() => location.href) === hrefBefore, 'opening the sheet did not navigate');
    /* Esc closes; the Day book is exactly where it was */
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    ok(!(await sheetOpen(p)), 'Esc closes the sheet');
    ok(await scroller.evaluate((e) => e.scrollTop) === before && before > 0, 'back on the Day book at the same scroll position (' + before + ')');
    await p.click('[data-testid="db-src-JV/2026-27/000001"]'); await waitSheet(p, 'C2/26-27/0002');
    await p.click('[data-testid="cs-close"]'); await p.waitForTimeout(250);
    ok(!(await sheetOpen(p)) && await scroller.evaluate((e) => e.scrollTop) === before, 'Close does the same');
    await ctx.close();
  }

  /* ── 2 · a received supplier bill: Accept · Dispute · Goods in · Open page ─────────────────────── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.click('[data-testid="db-src-JV/2026-27/000002"]'); await waitSheet(p, 'AM-81');
    const a = await acts(p);
    ok(JSON.stringify(a) === JSON.stringify(['accept', 'dispute', 'goodsin', 'page']), 'supplier bill icon row = Accept · Dispute · Goods in · Open page — got ' + a.join(' · '));
    ok(/Supplier bill/.test(await p.textContent('[data-testid="cs-head"]')) && /Agro Mills/.test(await p.textContent('[data-testid="cs-who"]')) && /To accept/.test(await p.textContent('[data-testid="cs-step"]')), 'a supplier bill: who is Agro Mills, step "To accept"');
    ok(/2,?380\.95/.test(await p.textContent('[data-testid="cs-gst-5"]')) && /59\.52/.test(await p.textContent('[data-testid="cs-gst-5"]')) && /59\.53/.test(await p.textContent('[data-testid="cs-gst-5"]')), 'its GST row is the chit\'s own (taxable 2,380.95 · CGST 59.52 · SGST 59.53)');
    ok(await p.textContent('[data-testid="cs-title"]') === 'Supplier bill', 'the title of a bill received is "Supplier bill"');
    await shot(p, 'chit-sheet-supplier-bill');
    /* Accept on a bill received ASKS what it is for first — nothing is sent until the choice is made */
    await p.click('[data-testid="cs-act-accept"]');
    await p.waitForSelector('[data-testid="bill-use-choice"]', { timeout: 5000 }).catch(() => {});
    ok(await p.locator('[data-testid="bill-use-choice"]').count() === 1 && await p.locator('[data-testid="bill-use-resale"]').count() === 1 && await p.locator('[data-testid="bill-use-use"]').count() === 1 && await p.locator('[data-testid="bill-use-asset"]').count() === 1, 'Accept shows the same choice Goods in shows (billUseChoiceHTML): For resale · For the shop · An asset');
    ok(S.statusCalls.length === 0 && S.useCalls.length === 0 && /To accept/.test(await p.textContent('[data-testid="cs-step"]')), 'nothing was sent by the Accept tap itself — the step is still "To accept"');
    await shot(p, 'chit-sheet-accept-use');
    await p.click('[data-testid="bill-use-resale"]');
    await p.waitForFunction(() => /Accepted/.test((document.querySelector('[data-testid="cs-step"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(S.useCalls.length === 1 && S.useCalls[0].id === 'sb1' && S.useCalls[0].body.use === 'resale' && S.statusCalls.length === 1 && S.statusCalls[0].id === 'sb1' && S.statusCalls[0].body.status === 'accepted' && S.calls.join() === 'use,status', 'the choice → PUT /use {use:"resale"} then PUT /status {status:"accepted"}, once each, in that order');
    ok(S.chits.sb1.header.current_status === 'pending', 'the shared status did not move (the seller\'s) — only my state_log did');
    ok(/Accepted/.test(await p.textContent('[data-testid="cs-step"]')), 'the sheet repainted with the new step, read from the state_log bill_step row');
    const a2 = await acts(p);
    ok(JSON.stringify(a2) === JSON.stringify(['dispute', 'page']), 'once accepted the row is Dispute · Open page — got ' + a2.join(' · '));
    /* the Day book\'s to-do and Waiting stop saying "To accept" for it */
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(await p.locator('[data-testid="todo-accept"]').count() === 0, 'the Day book\'s "supplier bill to accept" to-do is gone');
    await ctx.close();
  }
  /* "Let my catalogue decide": accepted without a /use call */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.click('[data-testid="db-src-JV/2026-27/000002"]'); await waitSheet(p, 'AM-81');
    await p.click('[data-testid="cs-act-accept"]'); await p.click('[data-testid="cs-use-auto"]');
    await p.waitForFunction(() => /Accepted/.test((document.querySelector('[data-testid="cs-step"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(S.useCalls.length === 0 && S.statusCalls.length === 1 && S.statusCalls[0].body.status === 'accepted', '"Let my catalogue decide" → accepted with no /use call');
    await ctx.close();
  }
  /* Goods in asks what the goods are for, then accepts */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.click('[data-testid="db-src-JV/2026-27/000002"]'); await waitSheet(p, 'AM-81');
    await p.click('[data-testid="cs-act-goodsin"]'); await p.click('[data-testid="bill-use-resale"]');
    await p.waitForFunction(() => /Accepted/.test((document.querySelector('[data-testid="cs-step"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(S.useCalls.length === 1 && S.useCalls[0].body.use === 'resale' && S.statusCalls.length === 1 && S.statusCalls[0].body.status === 'accepted', 'Goods in → what it is for (PUT /use) then accepted');
    /* Open page: the one way out — it goes where the link went before */
    await p.evaluate(() => { window.__opened = null; const o = window.openChit; window.openChit = function (id) { window.__opened = id; }; });
    await p.click('[data-testid="cs-act-page"]');
    ok(!(await sheetOpen(p)) && await p.evaluate(() => window.__opened) === 'sb1', 'Open page closes the sheet and opens the existing page (openChit) — the only navigation');
    await ctx.close();
  }
  /* ── 3 · a task, from the Waiting list ──────────────────────────────────────────────────────────── */
  {
    const S = standIn(); S.waiting = [{ id: 9, chit_id: 'tk1', ref: 'chit:tk1', reason: 'Waiting for you to confirm a task.', tries: 0, since: TODAY + 'T04:00:00Z', stuck: true }];
    const { ctx, p } = await open(S);
    await p.evaluate(() => bkTab('waiting')); await p.waitForSelector('[data-testid="wait-0"]', { timeout: 8000 });
    await p.click('[data-testid="wait-0"]'); await waitSheet(p, 'Fix the shutter');
    ok(await p.textContent('[data-testid="cs-title"]') === 'Task' && !/\bChit\b/.test(await p.textContent('#chitsheet')), 'the title of a task is the purpose word, "Task" — never "Chit"');
    const a = await acts(p);
    ok(JSON.stringify(a) === JSON.stringify(['accept', 'dispute', 'page']), 'a task icon row = Accept · Dispute · Open page — got ' + a.join(' · '));
    await p.click('[data-testid="cs-act-accept"]');
    await p.waitForFunction(() => /In hand/.test((document.querySelector('[data-testid="cs-step"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(S.statusCalls.length === 1 && S.statusCalls[0].body.status === 'in_progress', 'a task\'s Accept → in_progress');
    ok(JSON.stringify(await acts(p)) === JSON.stringify(['dispute', 'done', 'page']), 'in hand: Dispute · Done · Open page');
    await p.click('[data-testid="cs-act-done"]');
    await p.waitForFunction(() => /Done/.test((document.querySelector('[data-testid="cs-step"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(S.statusCalls.length === 2 && S.statusCalls[1].body.status === 'completed', 'Done → completed');
    await ctx.close();
  }
  /* ── 3b · the to-do "supplier bill to accept": one → its sheet over the Day book; several → Waiting. Never Intake ── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="todo-accept"]', { timeout: 8000 });
    const href = await p.evaluate(() => location.href), nav = await p.evaluate(() => UI.nav);
    ok(/^1 supplier bill to accept/.test(await p.textContent('[data-testid="todo-accept"]')), 'to-do: 1 supplier bill to accept');
    const reads0 = S.chitReads;
    await p.click('[data-testid="todo-accept"]'); await waitSheet(p, 'AM-81');
    ok(await sheetOpen(p) && await p.evaluate(() => document.getElementById('chitsheet').tagName) === 'DIALOG', 'the one-bill to-do opens the sheet (a <dialog>) for that chit');
    ok(S.chitReads === reads0 + 1 && /AM-81/.test(await p.textContent('[data-testid="cs-no"]')) && await p.evaluate(() => location.href) === href && await p.evaluate(() => UI.nav) === nav && nav !== 'intake', 'it read that chit once and never navigated (not Intake)');
    ok(await p.locator('[data-testid="db-entry-JV/2026-27/000001"]').isVisible(), 'the Day book is still there behind the sheet');
    await shot(p, 'chit-sheet-todo');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await ctx.close();
  }
  {
    const S = standIn(); S.waiting.push({ id: 2, chit_id: 'sb2', ref: 'bill:sb2', reason: 'Waiting for you to confirm Agro Mills’ bill AM-82.', tries: 0, since: TODAY + 'T04:30:00Z', stuck: true });
    const { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="todo-accept"]', { timeout: 8000 });
    ok(/^2 supplier bills to accept/.test(await p.textContent('[data-testid="todo-accept"]')), 'to-do: 2 supplier bills to accept');
    await p.click('[data-testid="todo-accept"]');
    await p.waitForSelector('[data-testid="wait-retry"]', { timeout: 8000 }).catch(() => {});
    ok(!(await sheetOpen(p)) && await p.evaluate(() => UI.nav) !== 'intake' && /Waiting to be recorded/.test(await p.textContent('[data-testid="bk-body"]')), 'the several-bills to-do opens Ledger › Waiting, not a sheet and not Intake');
    await ctx.close();
  }
  /* ── 3d · THE WAITING LIST IS THE TASK TABLE (docs/design/one-table): Supplier · Bill no · Amount · Date · Step; the bill opens in the popup ── */
  {
    const S = standIn();
    S.waiting.push({ id: 7, chit_id: 'ch1', ref: 'bill:ch1', reason: 'September is locked. Open it again to record this bill.', tries: 3, since: TODAY + 'T05:00:00Z' });
    const { ctx, p } = await open(S);
    await p.evaluate(() => bkTab('waiting')); await p.waitForSelector('[data-testid="wait-0"]', { timeout: 8000 });
    await p.waitForFunction(() => /Agro Mills/.test((document.querySelector('[data-testid="wait-0"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    const heads = await p.$$eval('#bk_body .lhead .lhcell', (els) => els.map((x) => x.textContent.replace(/[⇅▲▼]/g, '').trim()));
    ok(JSON.stringify(heads) === JSON.stringify(['Supplier', 'Amount', 'Step']), 'Waiting is the Task table, its top three columns by priority: ' + heads.join(' · '));
    /* the rest are one tick away in the columns chooser (bill no, date) */
    await p.click('[data-testid="cols-btn-waiting"]'); await p.click('[data-testid="cols-waiting-no"]'); await p.click('[data-testid="cols-waiting-date"]'); await p.click('[data-testid="cols-btn-waiting"]');
    const row0 = (await p.textContent('[data-testid="wait-0"]')).replace(/\s+/g, ' ');
    ok(/Agro Mills/.test(row0) && /AM-81/.test(row0) && /2,500\.00/.test(row0) && /To accept/.test(row0), 'a supplier bill row reads supplier · bill no · amount (summary_json.money.total) · step: "' + row0.trim() + '"');
    const body = await p.textContent('#bk_body');
    ok(!/sb1|bill:|\btries\b|\d tries/.test(body), 'no chit id and no "tries" on the list');
    ok(/September is locked/.test(await p.textContent('[data-testid="wait-1"]')) && await p.locator('[data-testid="wait-retry"]').count() === 1, 'a posting that genuinely failed shows its reason in the Step column, and Try again is offered');
    await p.click('[data-testid="wait-0"] [role="button"]');
    await p.waitForSelector('[data-testid="wait-lines-0"]', { timeout: 5000 }).catch(() => {});
    ok(/Basmati 25kg/.test(await p.textContent('[data-testid="wait-lines-0"]')) && !(await sheetOpen(p)), 'the caret opens the next level — the bill\'s lines — and does not open the sheet');
    await shot(p, 'one-table-waiting-laptop');
    await p.click('[data-testid="wait-0"] .lcell:nth-child(2)'); await waitSheet(p, 'AM-81');
    ok(await sheetOpen(p), 'a click on the row opens the bill in the popup');
    await p.click('[data-testid="cs-act-accept"]');
    await p.waitForSelector('[data-testid="cs-use"]', { timeout: 5000 }).catch(() => {});
    ok(/resale|Resale/i.test(await p.textContent('[data-testid="cs-use"]')) && /asset/i.test(await p.textContent('[data-testid="cs-use"]')), 'Accept asks what the goods are for — resale · own use · asset');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(await p.locator('.bkdv-row, .bktab').count() === 0, 'the Waiting screen draws no row or table of its own');
    await ctx.close();
    const S2 = standIn(); const { ctx: c2, p: p2 } = await open(S2, 390);
    await p2.evaluate(() => bkTab('waiting')); await p2.waitForSelector('[data-testid="wait-0"]', { timeout: 8000 });
    await p2.waitForFunction(() => /Agro Mills/.test((document.querySelector('[data-testid="wait-0"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(await p2.evaluate(() => document.documentElement.scrollWidth) === 390 && await p2.evaluate(() => getComputedStyle(document.querySelector('[data-testid="wait-0"]')).display) === 'flex', 'phone: Waiting is one card per row and scrollWidth === 390');
    await shot(p2, 'one-table-waiting-phone');
    await c2.close();
  }
  /* ── 3c · the other two readings: summary_json.money alone · neither (opened from the page, as a link would) ── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.evaluate(() => openChitSheet('ch2')); await waitSheet(p, 'C1/26-27/0003');
    const c = await p.$$eval('[data-testid="cs-gst-18"] td', (els) => els.map((e) => e.textContent.replace(/[₹,\s]/g, '')));
    ok(c.join('|') === '18%|1000.00|90.00|90.00' && (await p.textContent('[data-testid="cs-total"]')).replace(/[₹,\s]/g, '') === '1180.00', 'only summary_json.money: GST 18% row and total are the header\'s own (' + c.join(' | ') + ' · 1180.00)');
    ok(/Counter C1/.test(await p.textContent('[data-testid="cs-head"]')), 'the counter reads "Counter C1" here too');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.evaluate(() => openChitSheet('nr1')); await waitSheet(p, 'C1/26-27/0004');
    ok(/not recorded/i.test(await p.textContent('[data-testid="cs-total"]')) && /not recorded/i.test(await p.textContent('[data-testid="cs-gst-none"]')), 'neither invoice nor money: "not recorded" on the total and on the GST — nothing invented');
    await ctx.close();
  }
  /* ── 3d · CB Accounts: a Bills row opens the sheet (no new tab) and names who accepted by name, not by handle ── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.click('[data-testid="acc-nav-bills"]'); await p.waitForSelector('[data-testid="bills-list"]', { timeout: 8000 });
    await p.click('[data-testid="bill-sb1"] [role="button"]');   /* who took it is the row's next level */
    await p.waitForSelector('[data-testid="bill-next-sb1"]', { timeout: 5000 }).catch(() => {});
    const sub = await p.textContent('[data-testid="bill-next-sb1"]').catch(() => '');
    ok(/Books Shop/.test(sub) && !/books-shop/.test(sub), 'Bills: who accepted is the display name ("Books Shop"), not the handle — ' + sub.replace(/\s+/g, ' ').trim());
    const pages0 = ctx.pages().length;
    await p.click('[data-testid="bill-sb1"]'); await waitSheet(p, 'AM-81');
    ok(await sheetOpen(p) && ctx.pages().length === pages0, 'a Bills row opens the chit sheet in CB Accounts (openChitSheet is defined there), not a new tab');
    ok(/To accept/.test(await p.textContent('[data-testid="cs-step"]')), 'the sheet says the step from the chit\'s own state_log (no bill_step yet → To accept)');
    await ctx.close();
  }
  /* ── 3e · the old Ledger door is closed: it lands on /accounts.html at the same view; the app's menu has a Bills door ── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.goto(base + '/app.html#/app');
    await p.waitForSelector('[data-testid="nav-bills"]', { timeout: 20000 });
    ok(await p.getAttribute('[data-testid="nav-bills"]', 'href') === '/accounts.html#bills' && /Bills/.test(await p.textContent('[data-testid="nav-bills"]')), 'the app\'s menu has a Bills door → /accounts.html#bills (the way CB Accounts is linked)');
    await p.goto(base + '/app.html#/app/ledger'); await p.waitForURL(/\/accounts\.html/, { timeout: 15000 }).catch(() => {});
    ok(/\/accounts\.html(#|$)/.test(p.url()), '#/app/ledger → /accounts.html (' + p.url().replace(base, '') + ')');
    await p.goto(base + '/app.html#/app/ledger/dues'); await p.waitForURL(/accounts\.html#dues/, { timeout: 15000 }).catch(() => {});
    ok(/\/accounts\.html#dues$/.test(p.url()), '#/app/ledger/dues → /accounts.html#dues, the same view (' + p.url().replace(base, '') + ')');
    await p.goto(base + '/app.html#/app'); await p.waitForSelector('[data-testid="nav-bills"]', { timeout: 20000 });
    await p.evaluate(() => { localStorage.setItem(uk('cb_nav'), 'ledger'); });
    await p.reload(); await p.waitForURL(/\/accounts\.html/, { timeout: 15000 }).catch(() => {});
    ok(/\/accounts\.html/.test(p.url()), 'a remembered cb_nav of "ledger" → /accounts.html (' + p.url().replace(base, '') + ')');
    await p.goto(base + '/app.html#/app'); await p.waitForSelector('[data-testid="nav-bills"]', { timeout: 20000 });
    ok(await p.evaluate(() => localStorage.getItem(uk('cb_nav'))) !== 'ledger', 'the remembered "ledger" was forgotten, so Back does not loop');
    await p.evaluate(() => navTo('ledger')); await p.waitForURL(/\/accounts\.html/, { timeout: 15000 }).catch(() => {});
    ok(/\/accounts\.html/.test(p.url()), 'navTo("ledger") → /accounts.html');
    await ctx.close();
  }
  /* ── 3f · THE TASK DETAIL READS THE FROZEN BILL, NEVER RECOMPUTES (Athi, 2026-10-02: "never ever recompute") ─────────────── */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.goto(base + '/app.html#/app'); await p.waitForSelector('[data-testid="nav-bills"]', { timeout: 20000 });
    const tab = async (id, t) => { await p.evaluate(([i, tt]) => { UI.dtab = tt; return openChit(i); }, [id, t]); await p.waitForFunction(() => !(UI.detail && UI.detail._loading), null, { timeout: 15000 }); await p.waitForTimeout(300); };
    const txt = (sel) => p.locator(sel).first().textContent().then((t) => t.replace(/[₹,\s]/g, ''), () => null);
    /* the frozen invoice: the detail's total, GST rows and round-off equal CBTax.moneyOf(invoice) to the paisa */
    await tab('ch1', 'content');
    ok(await txt('[data-testid="chit-total"]') === f2(EXP.total), 'Task detail › Content: the total is the frozen invoice\'s ' + f2(EXP.total) + ' (the header said 1)');
    for (const rt of Object.keys(EXP.by_rate)) { const c = await p.$$eval('[data-testid="chit-money"] [data-testid="cs-gst-' + rt + '"] td', (els) => els.map((e) => e.textContent.replace(/[₹,\s]/g, ''))); ok(c[1] === f2(EXP.by_rate[rt].taxable) && c[2] === f2(EXP.by_rate[rt].cgst), 'Task detail › Content: GST ' + rt + '% rate-wise equals the invoice'); }
    ok(EXP.round_off ? /roundoff|Round/i.test(await p.locator('[data-testid="chit-money"]').first().textContent()) : true, 'Task detail › Content: the round-off is the invoice\'s');
    await tab('ch1', 'summary');
    ok(await txt('[data-testid="chit-summary-grand"]') === f2(EXP.total) && await txt('[data-testid="chit-summary-total"]') === f2(EXP.total), 'Task detail › Summary: the tile and the block both say the frozen total');
    ok(await txt('[data-testid="chit-summary-taxtotal"]') === f2(EXP.tax) && await txt('[data-testid="chit-summary-savings"]') === f2(EXP.savings), 'Task detail › Summary: tax and savings are the invoice\'s own');
    /* a stored total that differs from the lines\' sum: the STORED one is shown */
    await tab('dt1', 'content');
    ok(await txt('[data-testid="chit-total"]') === '999.00' && !/1,?180/.test(await p.locator('[data-testid="chit-money"]').first().textContent()), 'stored total 999.00 shown, not the lines\' 1,180 (Content)');
    await tab('dt1', 'summary');
    ok(await txt('[data-testid="chit-summary-grand"]') === '999.00' && await txt('[data-testid="chit-summary-total"]') === '999.00', 'stored total 999.00 shown, not the lines\' 1,180 (Summary)');
    /* no stored figures: an error line, no number */
    for (const t of ['content', 'summary']) {
      await tab('nr1', t);
      const e = p.locator('[data-testid="chit-money-error"]');
      ok(await e.count() === 1 && /No issued figures for this bill/.test(await e.textContent()) && await p.locator('[data-testid="chit-total"], [data-testid="chit-summary-total"], [data-testid="chit-summary-grand"]').count() === 0, 'no stored figures (' + t + '): "No issued figures for this bill", and no total anywhere');
    }
    await p.evaluate(() => { UI.folder = 'drafts'; }); await tab('nr1', 'content');
    ok(await p.locator('[data-testid="chit-money-none"]').count() === 1 && /Not issued yet/.test(await p.locator('[data-testid="chit-money-none"]').textContent()) && await p.locator('[data-testid="chit-money-error"]').count() === 0, 'a draft says "Not issued yet", not an error');
    await ctx.close();
  }
  /* ── 4 · phone width ────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn(); const { ctx, p } = await open(S, 390);
    await p.click('[data-testid="db-src-JV/2026-27/000001"]'); await waitSheet(p, 'C2/26-27/0002');
    ok(await p.evaluate(() => document.documentElement.scrollWidth) === 390, 'phone: scrollWidth === 390 with the sheet open');
    ok(await p.evaluate(() => { const d = document.getElementById('chitsheet'), r = d.getBoundingClientRect(); return d.scrollWidth <= d.clientWidth + 1 && r.left >= 0 && r.right <= 390; }), 'phone: the sheet fits the 390 screen and nothing in it runs sideways');
    await shot(p, 'chit-sheet-phone'); await shot(p, 'chit-sheet-invoice-phone');
    await ctx.close();
  }

  ok(threw.length === 0, 'no page errors' + (threw.length ? ': ' + threw[0] : ''));
  await b.close(); srv.close();
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
