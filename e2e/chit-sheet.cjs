/* chit-sheet.cjs — THE CHIT SHEET, DRIVEN THROUGH ITS CONTROLS (docs/design/chit-sheet/CLOUD-TASK.md).
 * Pattern: books-web.cjs — a stand-in API answers every /api/** call INSIDE the page; the static server takes a free
 * port from the OS. Nothing reaches localhost:3000, port 7351, or the live site.
 *
 *  1  from the Day book, a counter bill opens as a popup: header, lines + offer, GST rows as the chit holds them, total, tender
 *  2  its icon row is Print · Return · Open page — no Dispute, no Accept
 *  3  a received supplier bill: Accept · Dispute · Goods in · Open page; a task: Accept · Dispute · Open page (Done once in hand)
 *  4  Accept calls the status route once; the sheet repaints with the new step and the row changes
 *  5  Esc / Close returns to the Day book, scroll position kept; the page never navigated
 *  6  scrollWidth === 390 at phone width; no "accounting"; "(owner)" when by == the shop's own name
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

/* ── the stand-in: three chits (a counter bill, a supplier bill, a task) and the Ledger's day book that points at them ── */
function standIn() {
  const me = { role: 'sender', display_name: SHOP, entity_id: 'ent-books' };
  const S = { statusCalls: [], useCalls: [], disputes: 0, chitReads: 0, chits: {} };
  S.chits.ch1 = { header: { chit_id: 'ch1', purpose: 'order', current_status: 'completed', manual_subject: 'Counter sale C2/26-27/0002', created_at: TODAY + 'T05:10:00.000Z',
    all_recipients: [me, { role: 'receiver', display_name: 'self' }],
    summary_json: { currency_code: 'INR', money: { total: 682.01, tax: 82.01 } },
    business_json: { bill_no: 'C2/26-27/0002', billed_at: TODAY + 'T05:10:00.000Z', till: { id: 't2', name: 'Counter 2', by: { name: SHOP } }, customer: { name: 'Walk-in' },
      payment: { mode: 'cash+upi', paid: 700, change: 17.99, parts: [{ how: 'cash', amount: 500 }, { how: 'upi', amount: 182.01 }] },
      by_rate: { 5: { base: 200, tax: 10.01, cgst: 5.00 }, 18: { base: 390, tax: 70.2, cgst: 35.1 } }, total: 682.01, supply: 'intra' } },
    detail: { line_items: [{ particulars: 'Rice 5kg', quantity: 2, unit: 'piece', price: 105, total: 200, gst_rate: 5, offer: { off: 10, label: 'Festival offer' } },
                           { particulars: 'Soap', quantity: 3, unit: 'piece', price: 130, total: 390, gst_rate: 18 }] } };
  S.chits.sb1 = { header: { chit_id: 'sb1', purpose: 'invoice', current_status: 'pending', manual_subject: 'AM-81', created_at: TODAY + 'T04:00:00.000Z',
    all_recipients: [{ role: 'sender', display_name: 'Agro Mills', entity_id: 'ent-agro' }, { role: 'receiver', display_name: SHOP, entity_id: 'ent-books' }],
    summary_json: { currency_code: 'INR', bill_received: { from: 'Agro Mills', total: 2500 }, money: { total: 2500, tax: 119.05 } },
    business_json: { bill_no: 'AM-81', by_rate: { 5: { base: 2380.95, tax: 119.05, cgst: 59.52 } }, total: 2500 } },
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
    S.statusCalls.push({ id: x[1], body }); S.chits[x[1]].header.current_status = body.status; return J(r, 200, { ok: true });
  }
  if ((x = p.match(/^\/api\/chits\/([^/]+)\/use$/)) && m === 'PUT') { S.useCalls.push({ id: x[1], body }); return J(r, 200, { ok: true }); }
  if ((x = p.match(/^\/api\/chits\/([^/]+)\/dispute/)) && m === 'POST') { S.disputes++; return J(r, 200, { ok: true }); }
  if ((x = p.match(/^\/api\/chits\/([^/]+)$/)) && m === 'GET') { S.chitReads++; return S.chits[x[1]] ? J(r, 200, S.chits[x[1]]) : J(r, 404, { error: 'no chit' }); }
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
    await p.goto(base + '/app.html#/app');
    await p.waitForSelector('[data-testid="nav-ledger"]', { timeout: 20000 });
    await p.evaluate(() => navTo('ledger'));
    await p.waitForSelector('[data-testid="bk-tab-daybook"]', { timeout: 15000 });
    await p.click('[data-testid="bk-tab-daybook"]');
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
    const head1 = await p.textContent('[data-testid="db-head-JV/2026-27/000001"]');
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
    ok(/Counter bill/.test(head) && /C2\/26-27\/0002/.test(head) && /Counter 2/.test(head) && /Books Shop/.test(head), 'header: kind · number · date/time · counter · person — ' + head.replace(/\s+/g, ' ').trim());
    ok(await p.locator('[data-testid="cs-line-0"]').count() === 1 && await p.locator('[data-testid="cs-line-1"]').count() === 1, 'both lines are painted');
    ok(/Festival offer/.test(await p.textContent('[data-testid="cs-offer-0"]')) && /10/.test(await p.textContent('[data-testid="cs-offer-0"]')), 'the line\'s offer is shown with its label');
    const g5 = await p.textContent('[data-testid="cs-gst-5"]'), g18 = await p.textContent('[data-testid="cs-gst-18"]');
    ok(/200\.00/.test(g5) && /5\.00/.test(g5) && /5\.01/.test(g5) && g5.indexOf('5.00') < g5.indexOf('5.01'), 'GST 5%: taxable 200.00 · CGST 5.00 (the chit\'s own, not half of 10.01) · SGST 5.01 — ' + g5.replace(/\s+/g, ' '));
    ok(/390\.00/.test(g18) && /35\.10/.test(g18), 'GST 18%: taxable 390.00 · CGST 35.10 · SGST 35.10 — ' + g18.replace(/\s+/g, ' '));
    ok(/GST summary/i.test(await p.textContent('#chitsheet')) && /CGST/.test(await p.textContent('[data-testid="cs-gst"]')) && /SGST/.test(await p.textContent('[data-testid="cs-gst"]')), 'the summary is headed GST summary with CGST / SGST columns');
    ok(/682\.01/.test(await p.textContent('[data-testid="cs-total"]')), 'the total is the chit\'s own 682.01');
    const t0 = await p.textContent('[data-testid="cs-tender-0"]'), t1 = await p.textContent('[data-testid="cs-tender-1"]');
    ok(/Cash/.test(t0) && /500/.test(t0) && /UPI/.test(t1) && /182\.01/.test(t1), 'tender: Cash 500.00 · UPI 182.01');
    ok(/Walk-in/.test(await p.textContent('[data-testid="cs-who"]')) && /Done/.test(await p.textContent('[data-testid="cs-step"]')), 'the customer and the step word (Done)');
    const a = await acts(p);
    ok(JSON.stringify(a) === JSON.stringify(['print', 'return', 'page']), 'cart bill icon row = Print · Return · Open page — got ' + a.join(' · '));
    ok(!a.includes('dispute') && !a.includes('accept'), 'a cart bill has no Dispute (and no Accept)');
    await shot(p, 'chit-sheet-cart');
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
    await shot(p, 'chit-sheet-supplier-bill');
    await p.click('[data-testid="cs-act-accept"]');
    await p.waitForFunction(() => /Accepted/.test((document.querySelector('[data-testid="cs-step"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(S.statusCalls.length === 1 && S.statusCalls[0].id === 'sb1' && S.statusCalls[0].body.status === 'accepted', 'Accept → PUT /api/chits/sb1/status {status:"accepted"} exactly once');
    ok(/Accepted/.test(await p.textContent('[data-testid="cs-step"]')), 'the sheet repainted with the new step');
    const a2 = await acts(p);
    ok(JSON.stringify(a2) === JSON.stringify(['dispute', 'page']), 'once accepted the row is Dispute · Open page — got ' + a2.join(' · '));
    await ctx.close();
  }
  /* Goods in asks what the goods are for, then accepts */
  {
    const S = standIn(); const { ctx, p } = await open(S);
    await p.click('[data-testid="db-src-JV/2026-27/000002"]'); await waitSheet(p, 'AM-81');
    await p.click('[data-testid="cs-act-goodsin"]'); await p.click('[data-testid="cs-use-resale"]');
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
  /* ── 4 · phone width ────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn(); const { ctx, p } = await open(S, 390);
    await p.click('[data-testid="db-src-JV/2026-27/000001"]'); await waitSheet(p, 'C2/26-27/0002');
    ok(await p.evaluate(() => document.documentElement.scrollWidth) === 390, 'phone: scrollWidth === 390 with the sheet open');
    ok(await p.evaluate(() => { const d = document.getElementById('chitsheet'), r = d.getBoundingClientRect(); return d.scrollWidth <= d.clientWidth + 1 && r.left >= 0 && r.right <= 390; }), 'phone: the sheet fits the 390 screen and nothing in it runs sideways');
    await shot(p, 'chit-sheet-phone');
    await ctx.close();
  }

  ok(threw.length === 0, 'no page errors' + (threw.length ? ': ' + threw[0] : ''));
  await b.close(); srv.close();
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
