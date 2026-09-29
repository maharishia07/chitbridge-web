/* books-web.cjs — THE LEDGER, DRIVEN THROUGH ITS CONTROLS (SPEC-books-v2 §4). A stand-in API answers every /api/** call
 * inside the page; nothing reaches a server, live or local.
 *
 *  1  the door is hidden when the shop's Ledger is off (/api/books/health → 404), shown when on
 *  2  a customer row carries party no · balance · the chip; the record shows the statement (opening … closing)
 *  3  a credit sale posted by the counter appears on the statement
 *  4  editing a party: nickname + tax id; a tax id another party holds is WARNED before save; the server's 409 shows
 *  5  receive a payment: the oldest-due proposal, changed, confirmed; the disputed bill cannot take anything
 *  6  trial balance balances; month lock → a payment in that month is refused; opening again needs a reason
 *  7  a pack is built, downloads with its manifest, and is acknowledged
 *  8  opening balances: a bad line refused before sending; shop ledger added under a group
 *  9  the supplier record carries the block too (Pay)
 *  ⚠️ the word "accounting" never appears on any screen it opens
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };

/* ── the stand-in: a shop's parties, open bills, and the books routes of §5 ── */
function standIn() {
  const S = {
    enabled: true, confirms: [], payments: {}, locked: {}, packs: [], opening: null, accounts: [
      { code: '1300', name: 'Debtors', is_group: false }, { code: '1400', name: 'Cash', is_group: false },
      { code: '6000', name: 'Expenses', is_group: true }, { code: '6010', name: 'Rent', is_group: false }],
    customers: [
      { customer_list_id: 'cl1', customer_identity_id: 'c1', display_name: 'Ravi Stores', otp_contact: '9800000001', txn_count: 3, party_no: 'P-00001', nickname: 'Ravi', tax_ids: [{ scheme: 'GSTIN', value: '33AAAAA0000A1Z5' }], credit_days: 30 },
      { customer_list_id: 'cl2', customer_identity_id: 'c2', display_name: 'Meena Traders', otp_contact: '9800000002', txn_count: 1, party_no: 'P-00002', tax_ids: [] }],
    suppliers: [{ supplier_list_id: 'sl1', supplier_entity_id: 's1', display_name: 'Agro Mills', on_rail: false, party_no: 'P-00003', tax_ids: [] }],
    items: {   /* open bills per party, minor units */
      c1: [{ against_ref: 'b1', bill_no: 'INV-1', due_date: '2026-08-01', open_minor: 300000, date: '2026-07-02', chit: 'ch1' },
           { against_ref: 'b2', bill_no: 'INV-2', due_date: '2026-09-01', open_minor: 200000, date: '2026-08-02', chit: 'ch2' },
           { against_ref: 'b9', bill_no: 'INV-9', due_date: '2026-07-15', open_minor: 100000, date: '2026-06-15', chit: 'ch9', disputed: true }],
      c2: [], s1: [{ against_ref: 'p1', bill_no: 'AM-77', due_date: '2026-09-10', open_minor: -250000, date: '2026-08-10', chit: 'pc1' }] },
    receipts: { c1: [], c2: [], s1: [] },
  };
  S.balance = (id) => S.items[id].reduce((a, x) => a + x.open_minor, 0);
  S.statement = (id) => {
    let run = 0; const lines = [];
    const ev = S.items[id].map((x) => ({ date: x.date, what: x.open_minor > 0 ? 'Sale on credit' : 'Purchase', ref: x.bill_no, source_chit_id: x.chit, amt: x.orig || x.open_minor }))
      .concat(S.receipts[id].map((r) => ({ date: r.date, what: 'Payment received', ref: r.ref, amt: -r.amount })))
      .sort((a, b) => a.date < b.date ? -1 : 1);
    ev.forEach((e) => { run += e.amt; lines.push({ date: e.date, what: e.what, ref: e.ref, source_chit_id: e.source_chit_id || null, dr_minor: e.amt > 0 ? e.amt : 0, cr_minor: e.amt < 0 ? -e.amt : 0, running_minor: run }); });
    return { party: { party_id: id }, currency: 'INR', opening_minor: 0, lines, closing_minor: run };
  };
  S.dues = () => ({ currency: 'INR', as_of: '2026-09-29', parties: Object.keys(S.items).map((id) => {
    const open = S.items[id].filter((x) => !x.disputed && x.open_minor);
    const who = S.customers.find((c) => c.customer_identity_id === id) || S.suppliers.find((s) => s.supplier_entity_id === id);
    return { party_id: id, party_no: who.party_no, name: who.display_name, balance_minor: S.balance(id),
      oldest_due: open.map((x) => x.due_date).sort()[0] || null, disputed_minor: S.items[id].filter((x) => x.disputed).reduce((a, x) => a + x.open_minor, 0),
      buckets: { not_due: 0, lt_6m: open.reduce((a, x) => a + x.open_minor, 0) } };
  }) });
  return S;
}
/* BOOKS_SHOTS=<dir> keeps a picture of each screen to LOOK at (not a golden file; nothing compares them) */
const shot = async (p, name) => { if (process.env.BOOKS_SHOTS) await p.screenshot({ path: path.join(process.env.BOOKS_SHOTS, name + '.png') }).catch(() => {}); };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });

async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  let body = {}; try { body = JSON.parse(q.postData() || '{}'); } catch (_) {}
  if (p.startsWith('/api/books')) {
    if (!S.enabled) return J(r, 404, { error: 'Not found' });
    let x;
    if (p === '/api/books/health') return J(r, 200, { enabled: true, last_check: { ok: true } });
    if (p === '/api/books/dues') return J(r, 200, S.dues());
    if ((x = p.match(/^\/api\/books\/party\/([^/]+)\/statement$/))) return J(r, 200, S.statement(x[1]));
    if (p === '/api/books/payments' && m === 'POST') {
      const per = (new Date(body.received_at).getMonth() + 9) % 12 + 1;
      if (S.locked[per]) return J(r, 409, { error: 'That month is locked. Open it again (with a reason) to record this.' });
      const id = 'pay' + (Object.keys(S.payments).length + 1); S.payments[id] = body;
      return J(r, 200, { payment: { payment_id: id, status: body.mode === 'cheque' ? 'cheque_received' : 'recorded' } });
    }
    if ((x = p.match(/^\/api\/books\/payments\/([^/]+)\/propose$/))) {
      const pay = S.payments[x[1]]; let left = pay.amount_minor;
      const proposal = S.items[pay.party_id].filter((i) => i.open_minor > 0).slice().sort((a, b) => a.due_date < b.due_date ? -1 : 1)
        .map((i) => { const a = i.disputed ? 0 : Math.min(left, i.open_minor); left -= a; return { against_ref: i.against_ref, bill_no: i.bill_no, due_date: i.due_date, open_minor: i.open_minor, apply_minor: a, disputed: !!i.disputed }; });
      return J(r, 200, { proposal, on_account_minor: left });
    }
    if ((x = p.match(/^\/api\/books\/payments\/([^/]+)\/confirm$/))) {
      S.confirms.push(body); const pay = S.payments[x[1]];
      for (const a of body.allocations || []) { const it = S.items[pay.party_id].find((i) => i.against_ref === a.against_ref); if (!it || it.disputed) return J(r, 422, { error: 'A disputed bill cannot take a payment.' }); }
      for (const a of body.allocations || []) { const it = S.items[pay.party_id].find((i) => i.against_ref === a.against_ref); it.orig = it.orig || it.open_minor; it.open_minor -= a.amount_minor; }
      S.receipts[pay.party_id].push({ date: '2026-09-29', ref: pay.reference || x[1], amount: pay.amount_minor });
      return J(r, 200, { ok: true });
    }
    if (p === '/api/books/trial-balance' && S.tbOff) return J(r, 200, { currency: 'INR', rows: [{ code: '1300', name: 'Debtors', dr_minor: 600000, cr_minor: 0 }], total_dr_minor: 600000, total_cr_minor: 599999 });
    if (p === '/api/books/trial-balance') return J(r, 200, { currency: 'INR', rows: [{ code: '1300', name: 'Debtors', dr_minor: 600000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 508475 }, { code: '2201', name: 'Output GST', dr_minor: 0, cr_minor: 91525 }], total_dr_minor: 600000, total_cr_minor: 600000 });
    if (p === '/api/books/daybook') return J(r, 200, { currency: 'INR', entries: [{ entry_id: 'e1', entry_no: 'JV/2026-27/000001', posting_date: '2026-07-02', event_type: 'credit_sale', source_chit_id: 'ch1', narration: 'INV-1 · Ravi Stores', lines: [{ code: '1300', name: 'Debtors', party_name: 'Ravi Stores', dr_minor: 300000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 300000 }] }] });
    if (p === '/api/books/pl') return J(r, 200, { currency: 'INR', income: [{ code: '4000', name: 'Sales', amount_minor: 508475 }], expense: [{ code: '6010', name: 'Rent', amount_minor: 100000 }], profit_minor: 408475 });
    if (p === '/api/books/bs') return J(r, 200, { currency: 'INR', assets: [{ code: '1300', name: 'Debtors', amount_minor: 600000 }], liabilities: [{ code: '2201', name: 'Output GST', amount_minor: 91525 }], equity: [{ code: '3900', name: 'Profit', amount_minor: 508475 }], total_assets_minor: 600000, total_liab_equity_minor: 600000 });
    if (p === '/api/books/accounts' && m === 'GET') return J(r, 200, { accounts: S.accounts });
    if (p === '/api/books/accounts' && m === 'POST') { const a = { code: '6011', name: body.name, parent_code: body.parent_code, is_group: false }; S.accounts.push(a); S.addedAccount = body; return J(r, 200, { account: a }); }
    if ((x = p.match(/^\/api\/books\/ledger\/([^/]+)$/))) return J(r, 200, { account: x[1], currency: 'INR', opening_minor: 0, lines: [], closing_minor: 0 });
    if ((x = p.match(/^\/api\/books\/periods\/([^/]+)\/(\d+)\/(lock|unlock)$/))) {
      if (x[3] === 'unlock' && !String(body.reason || '').trim()) return J(r, 422, { error: 'A reason is needed' });
      S.locked[+x[2]] = x[3] === 'lock'; S.lastLock = { fy: x[1], p: +x[2], what: x[3], body };
      return J(r, 200, { period: { status: x[3] === 'lock' ? (body.hard ? 'hard_locked' : 'soft_locked') : 'open' } });
    }
    if (p === '/api/books/packs' && m === 'GET') return J(r, 200, { packs: S.packs });
    if (p === '/api/books/packs' && m === 'POST') { const k = { pack_id: 'pk' + (S.packs.length + 1), kind: body.kind, fiscal_year: body.fiscal_year, period: body.period, created_at: '2026-09-29', sha256: 'ab12cd34ef56ab12cd34ef56' }; S.packs.push(k); return J(r, 200, { pack: k }); }
    if ((x = p.match(/^\/api\/books\/packs\/([^/]+)\/ack$/))) { const k = S.packs.find((z) => z.pack_id === x[1]); k.acknowledged_at = '2026-09-29'; return J(r, 200, { pack: k }); }
    if ((x = p.match(/^\/api\/books\/packs\/([^/]+)$/))) { const k = S.packs.find((z) => z.pack_id === x[1]); return J(r, 200, { pack: k, manifest: { files: [{ name: 'gl.json', sha256: 'aa11bb22cc33dd44', bytes: 1200 }, { name: 'tally.xml', sha256: 'ee55ff66', bytes: 900 }, { name: 'trial-balance.csv', sha256: '0099', bytes: 300 }], controls: { dr: 600000, cr: 600000 } } }); }
    if (p === '/api/books/opening') { S.opening = body; return J(r, 200, { entry_no: 'JV/2026-27/000002', suspense_minor: 0 }); }
    return J(r, 404, { error: 'no stand-in for ' + p });
  }
  if (p === '/api/relationships/customers' && m === 'GET') return J(r, 200, { customers: S.customers });
  if (p === '/api/relationships/suppliers' && m === 'GET') return J(r, 200, S.suppliers);
  let x;
  if ((x = p.match(/^\/api\/relationships\/(customers|suppliers)\/([^/]+)$/)) && m === 'PATCH') {
    S.lastPatch = { kind: x[1], id: x[2], body };
    const dup = (body.tax_ids || []).some((t) => S.customers.concat(S.suppliers).some((c) => (c.customer_list_id || c.supplier_list_id) !== x[2] && (c.tax_ids || []).some((u) => u.scheme === t.scheme && u.value === t.value)));
    if (dup && !body.confirm_duplicate) return J(r, 409, { code: 'DUPLICATE_PARTY', error: 'Another party already has this tax id.' });
    return J(r, 200, { ok: true });
  }
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
    const ctx = await b.newContext({ viewport: { width: width || 1360, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', acceptDownloads: true, serviceWorkers: 'block' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    await ctx.addInitScript(() => { try {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const tok = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-books', identity_type: 'entity', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
      localStorage.setItem('cb_sess', JSON.stringify({ token: tok, role: 'entity', name: 'Books Shop' })); } catch (_) {} });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + '/app.html#/app');
    await p.waitForSelector('[data-testid="nav-customers"]', { timeout: 20000 });
    return { ctx, p };
  }
  const noAccounting = async (p, where) => { const t = await p.evaluate(() => document.body.innerText); ok(!/accounting|books of account/i.test(t), where + ': the word "accounting" is nowhere on screen'); };

  /* 1 · OFF: no door, no party block */
  {
    const S = standIn(); S.enabled = false;
    const { ctx, p } = await open(S);
    await p.waitForTimeout(1200);
    ok(await p.locator('[data-testid="nav-ledger"]').count() === 0, 'off: the Ledger door is not on the menu');
    await p.click('[data-testid="nav-customers"]');
    await p.waitForSelector('[data-testid="cust-row-c1"]', { timeout: 15000 });
    await p.waitForTimeout(600);
    ok(await p.locator('[data-testid^="party-books-"]').count() === 0 && await p.locator('[data-testid^="party-due-"]').count() === 0, 'off: no party block and no due chip on Customers');
    await ctx.close();
  }

  const S = standIn();
  const { ctx, p } = await open(S);
  await p.waitForSelector('[data-testid="nav-ledger"]', { timeout: 15000 });
  ok(true, 'on: the Ledger door appears once /api/books/health answers');

  /* 2 · customers: chip + party block + statement */
  await p.click('[data-testid="nav-customers"]');
  await p.waitForSelector('[data-testid="party-due-c1"]', { timeout: 15000 });
  const chip = await p.textContent('[data-testid="party-due-c1"]');
  ok(/P-00001/.test(chip) && /6,000/.test(chip), 'row chip: party no · balance (' + chip.trim() + ')');
  const chipTitle = await p.getAttribute('[data-testid="party-due-c1"]', 'title');
  ok(/owe you/.test(chipTitle) && /oldest due/.test(chipTitle), 'row chip says who owes whom and the oldest due (' + chipTitle + ')');
  await p.click('[data-testid="cust-row-c1"]');
  await p.waitForSelector('[data-testid="party-books-c1"] [data-testid="stmt-closing"]', { timeout: 15000 });
  const bal = await p.textContent('[data-testid="party-books-c1"] [data-testid="party-balance"]');
  ok(/6,000/.test(bal), 'record: balance ' + bal.trim());
  ok(/0\.00/.test(await p.textContent('[data-testid="stmt-opening"]')) && /6,000/.test(await p.textContent('[data-testid="stmt-closing"]')), 'statement: opening … closing 6,000');

  /* 3 · a credit sale posted by the counter appears on the statement */
  S.items.c1.push({ against_ref: 'b3', bill_no: 'INV-3', due_date: '2026-10-29', open_minor: 150000, date: '2026-09-29', chit: 'ch3' });
  await p.evaluate(() => { BK.stmt = {}; });
  await p.click('[data-testid="nav-suppliers"]'); await p.waitForTimeout(400);
  await p.click('[data-testid="nav-customers"]');
  await p.waitForSelector('[data-testid="party-books-c1"] [data-testid="stmt-closing"]', { timeout: 15000 });
  await p.waitForFunction(() => /7,500/.test((document.querySelector('[data-testid="stmt-closing"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const stmtTxt = await p.textContent('[data-testid="party-statement"]');
  await shot(p, '1-customer-record');
  ok(/INV-3/.test(stmtTxt) && /7,500/.test(await p.textContent('[data-testid="stmt-closing"]')), 'credit sale INV-3 is on the statement; closing 7,500');

  /* 4 · edit the party: nickname + a tax id another party holds → warned, then the server's 409 is shown */
  await p.click('[data-testid="cust-row-c2"]');
  await p.waitForSelector('[data-testid="party-books-c2"] [data-testid="party-edit"]', { timeout: 15000 });
  await p.click('[data-testid="party-books-c2"] [data-testid="party-edit"]');
  await p.fill('[data-testid="pe_nick"]', 'Meena');
  await p.fill('[data-testid="pe_legal"]', 'Meena Traders Pvt Ltd');
  await p.fill('[data-testid="pe_days"]', '15');
  await p.fill('[data-testid="pe_taxid"]', '33aaaaa0000a1z5');
  const warn = await p.textContent('[data-testid="pe_dup"]');
  ok(/Ravi Stores/.test(warn) && /GSTIN/.test(warn), 'duplicate tax id warned before saving (' + warn.trim() + ')');
  await p.click('[data-testid="pe_save"]');
  await p.waitForFunction(() => /already has this tax id/.test((document.querySelector('[data-testid="pe_dup"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/already has this tax id/.test(await p.textContent('[data-testid="pe_dup"]')), 'server 409 DUPLICATE_PARTY shown in the form, not swallowed');
  ok(S.lastPatch && S.lastPatch.id === 'cl2' && S.lastPatch.body.nickname === 'Meena' && S.lastPatch.body.credit_days === 15 && S.lastPatch.body.tax_ids[0].value === '33AAAAA0000A1Z5', 'PATCH carries nickname, credit days, the tax id (upper-cased)');
  await p.fill('[data-testid="pe_taxid"]', '33BBBBB1111B1Z5');
  ok((await p.textContent('[data-testid="pe_dup"]')).trim() === '', 'a fresh tax id clears the warning');
  await p.click('[data-testid="pe_save"]');
  await p.waitForSelector('[data-testid="pe_save"]', { state: 'detached', timeout: 8000 }).catch(() => {});
  ok(await p.locator('[data-testid="pe_save"]').count() === 0, 'saved: the form closes');
  await noAccounting(p, 'customers');

  /* 5 · receive ₹4,000 from Ravi: oldest due first (disputed skipped), changed, confirmed */
  await p.click('[data-testid="cust-row-c1"]');
  await p.waitForSelector('[data-testid="party-books-c1"] [data-testid="party-pay"]', { timeout: 15000 });
  ok(/Receive/.test(await p.textContent('[data-testid="party-books-c1"] [data-testid="party-pay"]')), 'a customer\'s action says Receive');
  await p.click('[data-testid="party-books-c1"] [data-testid="party-pay"]');
  await p.fill('[data-testid="pay_amt"]', '4000');
  await p.click('[data-testid="pay_record"]');
  await p.waitForSelector('[data-testid="alloc-0"]', { timeout: 8000 });
  const rows = await p.$$eval('[data-testid^="alloc-row-"]', (els) => els.map((e) => e.textContent));
  const vals = await p.$$eval('[data-testid^="alloc-"]:not([data-testid^="alloc-row"])', (els) => els.map((e) => ({ v: e.value, d: e.disabled })));
  await shot(p, '2-receive-proposal');
  ok(/INV-9/.test(rows[0]) && vals[0].d === true, 'the disputed bill (oldest) is shown and cannot take anything');
  ok(/INV-1/.test(rows[1]) && vals[1].v === '3000' && /INV-2/.test(rows[2]) && vals[2].v === '1000', 'proposal: oldest due first — INV-1 3,000 then INV-2 1,000');
  /* ⚠️ forcing the disputed box open still cannot send an amount against it */
  await p.evaluate(() => { const e = document.getElementById('alloc_0'); e.disabled = false; e.value = '500'; });
  await p.click('[data-testid="pay_confirm"]');
  ok(S.confirms.length === 0 && /disputed/i.test(await p.textContent('[data-testid="pay_why"]')), 'a disputed bill is refused before anything is sent');
  await p.evaluate(() => { const e = document.getElementById('alloc_0'); e.value = ''; e.disabled = true; });
  await p.fill('[data-testid="alloc-1"]', '5000');
  await p.click('[data-testid="pay_confirm"]');
  ok(S.confirms.length === 0 && /more than that bill/i.test(await p.textContent('[data-testid="pay_why"]')), 'more than a bill has open is refused');
  await p.fill('[data-testid="alloc-1"]', '2000'); await p.fill('[data-testid="alloc-2"]', '2000');
  ok(/0\.00 stays on account/.test(await p.textContent('[data-testid="pay_left"]')), 'changed: 2,000 + 2,000, nothing left on account');
  await p.click('[data-testid="pay_confirm"]');
  await p.waitForSelector('[data-testid="pay_confirm"]', { state: 'detached', timeout: 8000 }).catch(() => {});
  const c0 = S.confirms[0] || {};
  ok(S.confirms.length === 1 && JSON.stringify(c0.allocations) === JSON.stringify([{ against_ref: 'b1', amount_minor: 200000 }, { against_ref: 'b2', amount_minor: 200000 }]), 'confirmed with the CHANGED allocation, in minor units');
  await p.waitForFunction(() => /3,500/.test((document.querySelector('[data-testid="party-books-c1"] [data-testid="party-balance"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/3,500/.test(await p.textContent('[data-testid="party-books-c1"] [data-testid="party-balance"]')), 'balance repainted after the payment: 3,500');

  /* 6 · the Ledger screen */
  await p.click('[data-testid="nav-ledger"]');
  await p.waitForSelector('[data-testid="bk-tab-daybook"]', { timeout: 15000 });
  await p.waitForSelector('[data-testid="db-entry-JV/2026-27/000001"]', { timeout: 8000 });
  ok(true, 'day book lists the entry with its number');
  await p.click('[data-testid="bk-tab-tb"]');
  await p.waitForSelector('[data-testid="tb-balanced"]', { timeout: 8000 });
  ok(/balances/.test(await p.textContent('[data-testid="tb-balanced"]')) && (await p.textContent('[data-testid="tb-dr"]')) === (await p.textContent('[data-testid="tb-cr"]')), 'trial balance: debit total = credit total, and it says so');
  await shot(p, '3-trial-balance');
  S.tbOff = true; await p.click('[data-testid="bk-tab-tb"]');
  await p.waitForFunction(() => /does not/.test((document.querySelector('[data-testid="tb-balanced"]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok(/does not balance/.test(await p.textContent('[data-testid="tb-balanced"]')), 'a trial balance off by one paisa says it does not balance');
  S.tbOff = false;
  await p.click('[data-testid="bk-tab-pl"]'); await p.waitForSelector('[data-testid="pl-profit"]', { timeout: 8000 });
  ok(/Profit/.test(await p.textContent('[data-testid="pl-profit"]')), 'P&L shows the profit line');
  await p.click('[data-testid="bk-tab-bs"]'); await p.waitForSelector('[data-testid="bs-balanced"]', { timeout: 8000 });
  ok(/balances/.test(await p.textContent('[data-testid="bs-balanced"]')), 'balance sheet balances');
  await p.click('[data-testid="bk-tab-dues"]'); await p.waitForSelector('[data-testid="dues-c1"]', { timeout: 8000 });
  await shot(p, '4-dues');
  ok(/1,000/.test(await p.textContent('[data-testid="dues-c1"]')), 'dues: the disputed amount has its own column');
  await noAccounting(p, 'ledger');

  /* month lock blocks a payment in that month; opening again needs a reason */
  await p.click('[data-testid="bk-tab-lock"]'); await p.waitForSelector('[data-testid="lk_lock"]');
  const sep = String((new Date().getMonth() + 9) % 12 + 1);
  await p.selectOption('[data-testid="lk_p"]', sep);
  await p.click('[data-testid="lk_lock"]');
  await p.waitForFunction(() => /Locked/.test(document.querySelector('[data-testid="lk_out"]').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(S.locked[+sep] === true, 'this month locked');
  await p.click('[data-testid="nav-customers"]');
  await p.waitForSelector('[data-testid="party-books-c1"] [data-testid="party-pay"]', { timeout: 15000 });
  await p.click('[data-testid="party-books-c1"] [data-testid="party-pay"]');
  await p.fill('[data-testid="pay_amt"]', '100'); await p.click('[data-testid="pay_record"]');
  await p.waitForFunction(() => /locked/.test((document.querySelector('[data-testid="pay_why"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/locked/.test(await p.textContent('[data-testid="pay_why"]')) && await p.locator('[data-testid="alloc-0"]').count() === 0, 'a payment in a locked month is refused, and the form says why');
  await p.evaluate(() => closeModal());
  await p.click('[data-testid="nav-ledger"]'); await p.click('[data-testid="bk-tab-lock"]'); await p.waitForSelector('[data-testid="lk_unlock"]');
  await p.selectOption('[data-testid="lk_p"]', sep);
  const before = S.lastLock;
  await p.click('[data-testid="lk_unlock"]');
  ok(S.lastLock === before && /Say why/.test(await p.textContent('[data-testid="lk_out"]')), 'opening a month again without a reason is refused before sending');
  await p.fill('[data-testid="lk_why"]', 'late bill from Agro Mills');
  await p.click('[data-testid="lk_unlock"]');
  await p.waitForFunction(() => /Open/.test(document.querySelector('[data-testid="lk_out"]').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(S.locked[+sep] === false && S.lastLock.body.reason === 'late bill from Agro Mills', 'opened again, with the reason sent');

  /* close for good: asks first; Cancel sends nothing, Yes sends hard */
  const b4 = S.lastLock;
  await p.click('[data-testid="lk_hard"]'); await p.waitForSelector('[data-testid="confirm-cancel"]', { timeout: 5000 });
  await p.click('[data-testid="confirm-cancel"]'); await p.waitForTimeout(300);
  ok(S.lastLock === b4, 'close for good: Cancel sends nothing');
  await p.click('[data-testid="lk_hard"]'); await p.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 });
  await p.click('[data-testid="confirm-ok"]');
  await p.waitForFunction(() => /Closed for good/.test(document.querySelector('[data-testid="lk_out"]').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(S.lastLock !== b4 && S.lastLock.body.hard === true, 'close for good: asked, then sent as a hard lock');
  S.locked[+sep] = false;

  /* 7 · packs */
  await p.click('[data-testid="bk-tab-packs"]'); await p.waitForSelector('[data-testid="pk_build"]');
  await p.fill('[data-testid="pk_p"]', '5'); await p.click('[data-testid="pk_build"]');
  await p.waitForSelector('[data-testid="pack-get-pk1"]', { timeout: 8000 });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('[data-testid="pack-get-pk1"]')]);
  const dlPath = await dl.path(); const dlBody = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
  ok(dl.suggestedFilename() === 'pack-pk1.json' && dlBody.manifest && dlBody.manifest.files.length === 3, 'pack downloads with its manifest (3 files)');
  ok(/gl\.json/.test(await p.textContent('[data-testid="pack-manifest"]')), 'the manifest is shown: file names and fingerprints');
  await p.click('[data-testid="pack-ack-pk1"]');
  await p.waitForFunction(() => !document.querySelector('[data-testid="pack-ack-pk1"]'), null, { timeout: 8000 }).catch(() => {});
  ok(!!S.packs[0].acknowledged_at && await p.locator('[data-testid="pack-ack-pk1"]').count() === 0, 'acknowledged: the button becomes the date');

  /* 8 · opening balances + a shop ledger */
  await p.click('[data-testid="bk-tab-opening"]'); await p.waitForSelector('[data-testid="op_csv"]');
  await p.fill('[data-testid="op_csv"]', '1300,P-00001,5000,,INV-0,2026-10-15\n2100,P-00003,100,200,,');
  await p.click('[data-testid="op_go"]');
  ok(S.opening === null && /Line 2/.test(await p.textContent('[data-testid="op_out"]')), 'a line with both debit and credit is refused before sending');
  await p.fill('[data-testid="op_csv"]', '1300,P-00001,5000,,INV-0,2026-10-15\n2100,P-00003,,5000,AM-1,');
  await p.click('[data-testid="op_go"]');
  await p.waitForFunction(() => /Entered/.test(document.querySelector('[data-testid="op_out"]').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(S.opening && S.opening.rows.length === 2 && S.opening.rows[0].dr_minor === 500000 && S.opening.rows[1].cr_minor === 500000, 'opening balances sent in minor units');
  await p.click('[data-testid="bk-tab-accounts"]'); await p.waitForSelector('[data-testid="ac_add"]');
  await p.fill('[data-testid="ac_name"]', 'Shop repairs'); await p.click('[data-testid="ac_add"]');
  await p.waitForTimeout(500);
  ok(S.addedAccount && S.addedAccount.name === 'Shop repairs' && S.addedAccount.parent_code === '6000', 'shop ledger added under its group');

  /* 9 · supplier record: the same block, with Pay */
  await p.click('[data-testid="nav-suppliers"]');
  await p.waitForSelector('[data-testid="party-due-s1"]', { timeout: 15000 });
  ok(/2,500/.test(await p.textContent('[data-testid="party-due-s1"]')) && /You owe/.test(await p.getAttribute('[data-testid="party-due-s1"]', 'title')), 'supplier row: you owe 2,500');
  await p.click('[data-testid="sup-details-sl1"]');
  await p.waitForSelector('[data-testid="party-books-s1"] [data-testid="party-pay"]', { timeout: 15000 });
  await p.waitForTimeout(700); await shot(p, '5-supplier-record');
  ok(/Pay/.test(await p.textContent('[data-testid="party-books-s1"] [data-testid="party-pay"]')), 'a supplier\'s action says Pay');

  const mine = threw.filter((m) => /bk|party|pay|books|ledger/i.test(m));
  ok(mine.length === 0, 'no page error from the Ledger code' + (mine.length ? ' — ' + mine.join(' | ') : ''));
  if (threw.length) console.log('  (other page errors, not the Ledger: ' + threw.length + ' — ' + threw.slice(0, 3).join(' | ').slice(0, 300) + ')');
  await ctx.close(); await b.close(); srv.close();
  console.log('\n  books-web: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
