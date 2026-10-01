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
    /* ── the 2026-09-30 fix pass (review M10–M12, F11): what the stand-in now keeps, as the server does ── */
    payPosts: [], byRef: {}, openingPosts: [], openingByRef: {}, chequeSteps: [], retries: 0, fileGets: 0, acks: [],
    /* /health names what could not be recorded, each with its reason sentence (routes/books.js GET /health).
       The three "Waiting for you to confirm …" rows are received supplier bills — the Day book's to-do counts them
       as "supplier bills to accept" (they wait on a person, so retry keeps them: stuck) and the other two as
       "waiting to be recorded". */
    waiting: [{ id: 1, chit_id: 'ch7', ref: 'bill:ch7', why: 'Paid by Points — there is no ledger for Points yet.', tries: 3, since: '2026-09-28T10:00:00Z' },
              { id: 2, chit_id: 'ch8', ref: 'chit:ch8', why: 'September is locked. Open it again to record this bill.', tries: 1, since: '2026-09-29T09:00:00Z', stuck: true },
              { id: 3, chit_id: 'sb1', ref: 'bill:sb1', why: 'Waiting for you to confirm Agro Mills’ bill AM-81.', tries: 0, since: '2026-09-30T08:00:00Z', stuck: true },
              { id: 4, chit_id: 'sb2', ref: 'bill:sb2', why: 'Waiting for you to confirm Agro Mills’ bill AM-82.', tries: 0, since: '2026-09-30T09:00:00Z', stuck: true },
              { id: 5, chit_id: 'sb3', ref: 'bill:sb3', why: 'Waiting for you to confirm a counter bill from Meena Traders.', tries: 0, since: '2026-09-30T10:00:00Z', stuck: true }],
    /* a cheque the server itself lists as held (recorded at the counter, or in an earlier session) — and one already
       cleared (`next` empty), which the to-do must NOT count */
    chequeLists: 0, serverCheques: [{ payment_id: 'chq9', party_id: 'c2', name: 'Meena Traders', amount_minor: 50000, cheque_no: '778899', cheque_bank: 'SBI', status: 'cheque_received' },
      { payment_id: 'chq8', party_id: 'c1', name: 'Ravi Stores', amount_minor: 10000, cheque_no: '112233', cheque_bank: 'SBI', status: 'cleared', next: [] }],
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
    /* ⚠️ as routes/books.js sends it: a supplier's buckets are the PAYABLE ones (not_due · lt_1y · y1_2 · y2_3 · gt_3y),
       signed minus (you owe them); a customer's are the six receivable ones. `side` says which. */
    const sup = !!who.supplier_entity_id, sum = open.reduce((a, x) => a + x.open_minor, 0);
    return { party_id: id, party_no: who.party_no, name: who.display_name, side: sup ? 'supplier' : 'customer', balance_minor: S.balance(id),
      oldest_due: open.map((x) => x.due_date).sort()[0] || null, disputed_minor: S.items[id].filter((x) => x.disputed).reduce((a, x) => a + x.open_minor, 0),
      buckets: sup ? { not_due: 0, lt_1y: sum } : { not_due: 0, lt_6m: sum } };
  }) });
  return S;
}
/* BOOKS_SHOTS=<dir> keeps a picture of each screen to LOOK at (not a golden file; nothing compares them) */
const shot = async (p, name) => { if (process.env.BOOKS_SHOTS) await p.screenshot({ path: path.join(process.env.BOOKS_SHOTS, name + '.png') }).catch(() => {}); };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
/* the bytes of "the pack" — what Download must bring down (a zip's first four bytes, then a marker) */
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('stand-in ledger pack', 'utf8')]);
/* "today" the way the page computes it (bkToday: toISOString) — the strip reads the range's last day */
const TODAY = new Date().toISOString().slice(0, 10);

async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  let body = {}; try { body = JSON.parse(q.postData() || '{}'); } catch (_) {}
  if (p.startsWith('/api/books')) {
    /* routes/books.js: only GET /status and POST /enable (the owner's switch) answer while off */
    if (p === '/api/books/status' && m === 'GET') return J(r, 200, { migrated: true, enabled: !!S.enabled, walkin_grain: S.enabled ? 'day' : null });
    if (p === '/api/books/enable' && m === 'POST') { S.enables = (S.enables || 0) + 1; S.enabled = true; return J(r, 200, { ok: true, accounts_added: 80, fiscal_year: '2026-27', parties_numbered: 3 }); }
    if (!S.enabled) return J(r, 404, { error: 'Not found' });
    let x;
    if (p === '/api/books/health') return J(r, 200, { enabled: true, last_check: { ok: true }, waiting: S.waiting.map((w) => ({ id: w.id, chit_id: w.chit_id, ref: w.ref, reason: w.why, tries: w.tries, since: w.since, job: 'chit' })) });   /* routes/books.js GET /health: the sentence is `reason`; cheques are NOT here */
    if (p === '/api/books/cheques' && m === 'GET') { S.chequeLists++; return J(r, 200, { currency: 'INR', cheques: S.serverCheques.map((c) => Object.assign({ next: ['deposited'] }, c)) }); }   /* GET /cheques: the held ones, each with the steps the engine accepts now */
    if (p === '/api/books/outbox/retry' && m === 'POST') { S.retries++; const n = S.waiting.length; S.waiting = S.waiting.filter((w) => w.stuck); return J(r, 200, { ok: true, tried: n, posted: n - S.waiting.length }); }
    if ((x = p.match(/^\/api\/books\/cheques\/([^/]+)\/status$/)) && m === 'POST') {
      S.chequeSteps.push({ id: x[1], body });
      if (S.refuseCheque) return J(r, 422, { error: 'A cleared cheque cannot be bounced here.' });
      return J(r, 200, { ok: true });
    }
    if (p === '/api/books/dues') return J(r, 200, S.dues());
    if ((x = p.match(/^\/api\/books\/party\/([^/]+)\/statement$/))) return J(r, 200, S.statement(x[1]));
    if (p === '/api/books/payments' && m === 'POST') {
      S.payPosts.push(body);                                  /* every POST that ARRIVED, a repeat included */
      const per = (new Date(body.received_at).getMonth() + 9) % 12 + 1;
      if (S.locked[per]) return J(r, 409, { error: 'That month is locked. Open it again (with a reason) to record this.' });
      /* the server keeps a client_ref ONCE (the unique index): a repeat is answered with the payment it already has */
      if (body.client_ref && S.byRef[body.client_ref]) { const was = S.byRef[body.client_ref]; return J(r, 200, { payment: { payment_id: was, status: S.payments[was].mode === 'cheque' ? 'cheque_received' : 'recorded', duplicate: true } }); }
      const id = 'pay' + (Object.keys(S.payments).length + 1); S.payments[id] = body;
      if (body.client_ref) S.byRef[body.client_ref] = id;
      return J(r, 200, { payment: { payment_id: id, status: body.mode === 'cheque' ? 'cheque_received' : 'recorded' } });
    }
    if ((x = p.match(/^\/api\/books\/payments\/([^/]+)\/propose$/))) {
      if (S.failProposeOnce) { S.failProposeOnce = false; return J(r, 500, { error: 'Try again in a moment.' }); }
      if (S.slowPropose) await new Promise((res) => setTimeout(res, S.slowPropose));
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
    /* ⭐ each entry carries `source` (routes/books.js sourceOf, 2026-10-01): a bill names its number, counter and seller; a
       walk-in day its count; an entry with no chit has source null */
    if (p === '/api/books/daybook') return J(r, 200, { currency: 'INR', entries: [
      { entry_id: 'e1', entry_no: 'JV/2026-27/000001', posting_date: '2026-07-02', doc_date: '2026-07-02', event_type: 'sale_bill', source_chit_id: 'ch1', narration: 'Sale',
        source: { chit_id: 'ch1', ref: 'C2/26-27/0002', kind: 'bill', counter: 'C2', by: 'Athi', count: null, how: 'On credit', how_ref: null, split: null,
          doc_at: '2026-07-02T08:42:00.000Z', recorded_at: '2026-07-02T08:42:05.000Z' },
        lines: [{ code: '1300', name: 'Debtors', party_name: 'Ravi Stores', dr_minor: 300000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 300000 }] },
      { entry_id: 'e2', entry_no: 'JV/2026-27/000002', posting_date: '2026-07-02', event_type: 'walkin_day', source_chit_id: null, narration: 'Walk-in sales, counter C2, 2026-07-02 (12 bills)',
        source: { chit_id: null, ref: null, kind: 'day', counter: 'C2', by: null, count: 12, how: 'Cash · UPI · Card', how_ref: null,
          split: [{ how: 'Cash', amount_minor: 124000 }, { how: 'UPI', amount_minor: 86000 }, { how: 'Card', amount_minor: 30000 }] },
        lines: [{ code: '1400', name: 'Cash', dr_minor: 141600, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 141600 }] },
      { entry_id: 'e3', entry_no: 'JV/2026-27/000003', posting_date: '2026-07-03', event_type: 'payment_received', source_chit_id: null, narration: 'Payment received', source: null,
        lines: [{ code: '1400', name: 'Cash', dr_minor: 50000, cr_minor: 0 }, { code: '1300', name: 'Debtors', party_name: 'Ravi Stores', dr_minor: 0, cr_minor: 50000 }] },
      /* a LATE one: received on 3 Jul, taken into the ledger on 1 Oct — the row says both */
      { entry_id: 'e4', entry_no: 'JV/2026-27/000004', posting_date: '2026-07-03', doc_date: '2026-07-03', event_type: 'payment_received', source_chit_id: 'ch4', narration: 'Payment received',
        source: { chit_id: 'ch4', ref: 'R/C2/0001', kind: 'receipt', counter: 'C2', by: 'Athi', count: null, how: 'UPI', how_ref: '4421000000009931', split: null,
          doc_at: '2026-07-03T06:00:00.000Z', recorded_at: '2026-10-01T05:00:00.000Z' },
        lines: [{ code: '1510', name: 'UPI collections', dr_minor: 20000, cr_minor: 0 }, { code: '1300', name: 'Debtors', party_name: 'Ravi Stores', dr_minor: 0, cr_minor: 20000 }] }].concat(S.noToday ? [] : [
      /* ⭐ TODAY's sales, for the strip: a closed walk-in day and a credit bill on C1, a UPI bill on C2.
         C1 = 1,240 + 860 + 300 (the day's split) + 1,880 (the bill) = ₹4,280.00 · 11 + 1 = 12 bills; C2 = ₹6,909.00 · 1 bill.
         Tenders: Cash 1,240 · UPI 860 + 6,909 = 7,769 · Card 300 · On credit 1,880. */
      { entry_id: 'e5', entry_no: 'JV/2026-27/000005', posting_date: TODAY, event_type: 'walkin_day', source_chit_id: null, narration: 'Walk-in sales, counter C1, ' + TODAY + ' (11 bills)',
        source: { chit_id: null, ref: null, kind: 'day', counter: 'C1', by: null, count: 11, how: 'Cash · UPI · Card', how_ref: null,
          split: [{ how: 'Cash', amount_minor: 124000 }, { how: 'UPI', amount_minor: 86000 }, { how: 'Card', amount_minor: 30000 }] },
        lines: [{ code: '1400', name: 'Cash', dr_minor: 240000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 240000 }] },
      { entry_id: 'e6', entry_no: 'JV/2026-27/000006', posting_date: TODAY, doc_date: TODAY, event_type: 'sale_bill', source_chit_id: 'ch6', narration: 'Sale',
        source: { chit_id: 'ch6', ref: 'C1/26-27/0031', kind: 'bill', counter: 'C1', by: 'Mani', count: null, how: 'On credit', how_ref: null, split: null,
          doc_at: TODAY + 'T05:10:00.000Z', recorded_at: TODAY + 'T05:10:04.000Z' },
        lines: [{ code: '1300', name: 'Debtors', party_name: 'Ravi Stores', dr_minor: 188000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 188000 }] },
      { entry_id: 'e7', entry_no: 'JV/2026-27/000007', posting_date: TODAY, doc_date: TODAY, event_type: 'sale_bill', source_chit_id: 'ch71', narration: 'Sale',
        source: { chit_id: 'ch71', ref: 'C2/26-27/0045', kind: 'bill', counter: 'C2', by: 'Athi', count: null, how: 'UPI', how_ref: '9988776655443322', split: null,
          doc_at: TODAY + 'T06:20:00.000Z', recorded_at: TODAY + 'T06:20:03.000Z' },
        lines: [{ code: '1510', name: 'UPI collections', dr_minor: 690900, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 690900 }] }]) });
    if (p === '/api/books/ledger/1300') return J(r, 200, { account: { code: '1300', name: 'Debtors' }, currency: 'INR', opening_minor: 0, closing_minor: 250000, lines: [
      { date: '2026-07-02', doc_date: '2026-07-02', what: 'Sale', ref: 'JV/2026-27/000001', source_chit_id: 'ch1', source: { chit_id: 'ch1', ref: 'C2/26-27/0002', kind: 'bill', counter: 'C2', by: 'Athi', count: null, how: 'On credit', how_ref: null, split: null,
        doc_at: '2026-07-02T08:42:00.000Z', recorded_at: '2026-10-01T05:00:00.000Z' }, dr_minor: 300000, cr_minor: 0, running_minor: 300000 },
      { date: '2026-07-03', what: 'Payment received', ref: 'JV/2026-27/000003', source_chit_id: null, source: null, dr_minor: 0, cr_minor: 50000, running_minor: 250000 }] });
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
    /* ⚠️ a pack row says whether it HAS a file (has_file); `hide` = an older list that does not say, so GET /packs/:id is asked */
    if (p === '/api/books/packs' && m === 'GET') return J(r, 200, { packs: S.packs.map((k) => { const o = Object.assign({}, k); delete o.hide; if (k.hide) delete o.has_file; return o; }) });
    if (p === '/api/books/packs' && m === 'POST') { const k = { pack_id: 'pk' + (S.packs.length + 1), kind: body.kind, fiscal_year: body.fiscal_year, period: body.period, created_at: '2026-09-29', sha256: 'ab12cd34ef56ab12cd34ef56', has_file: !S.nextPackNoFile, hide: !!S.nextPackHide }; S.packs.push(k); return J(r, 200, { pack: k }); }
    if ((x = p.match(/^\/api\/books\/packs\/([^/]+)\/ack$/))) { const k = S.packs.find((z) => z.pack_id === x[1]); S.acks.push(x[1]); k.acknowledged_at = '2026-09-29'; return J(r, 200, { pack: k }); }
    /* the pack ITSELF: the zip, as bytes — 409 when it was made while storage was not connected (routes/books.js) */
    if ((x = p.match(/^\/api\/books\/packs\/([^/]+)\/file$/))) {
      const k = S.packs.find((z) => z.pack_id === x[1]); S.fileGets++;
      if (!k || !k.has_file) return J(r, 409, { error: 'This pack was built while storage was not connected — build it again to download it.' });
      return r.fulfill({ status: 200, contentType: 'application/zip', headers: { 'content-disposition': 'attachment; filename="ledger-pack-' + k.kind + '-' + k.fiscal_year + '-' + k.period + '.zip"', 'access-control-expose-headers': 'Content-Disposition' }, body: ZIP });
    }
    if ((x = p.match(/^\/api\/books\/packs\/([^/]+)$/))) { const k = S.packs.find((z) => z.pack_id === x[1]); return J(r, 200, { pack: k, has_file: !!k.has_file, file: k.has_file ? '/api/books/packs/' + k.pack_id + '/file' : null, manifest: { files: [{ name: 'gl.json', sha256: 'aa11bb22cc33dd44', bytes: 1200 }, { name: 'tally.xml', sha256: 'ee55ff66', bytes: 900 }, { name: 'trial-balance.csv', sha256: '0099', bytes: 300 }], controls: { dr: 600000, cr: 600000 } } }); }
    if (p === '/api/books/opening') {
      S.openingPosts.push(body);
      if (S.failOpeningOnce) { S.failOpeningOnce = false; return J(r, 500, { error: 'Try again in a moment.' }); }
      if (body.client_ref && S.openingByRef[body.client_ref]) return J(r, 200, { entry_no: S.openingByRef[body.client_ref], suspense_minor: 0, duplicate: true });
      S.opening = body; const no = 'JV/2026-27/00000' + (1 + S.openingPosts.length);
      if (body.client_ref) S.openingByRef[body.client_ref] = no;
      return J(r, 200, { entry_no: no, suspense_minor: 0 });
    }
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
    /* the switch (Athi, 2026-10-01): Settings › Your business › Ledger — owner only, read from /status, one confirm */
    await p.evaluate(() => navTo('settings')); await p.waitForSelector('[data-testid="set-sec-business"]', { timeout: 15000 }); await p.click('[data-testid="set-sec-business"]');
    await p.waitForSelector('[data-testid="biz-ledger-on"]', { timeout: 10000 }).catch(() => {});
    ok(/Off/.test(await p.textContent('[data-testid="biz-ledger-state"]').catch(() => '')) && await p.locator('[data-testid="biz-ledger-on"]').count() === 1, 'Settings › Your business: the Ledger card says Off and offers Switch on');
    await p.click('[data-testid="biz-ledger-on"]');
    await p.waitForSelector('[data-testid="confirm-cancel"]', { timeout: 4000 }).catch(() => {});
    await p.click('[data-testid="confirm-cancel"]', { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(300);
    ok(!S.enables && !S.enabled, 'Switch on asks first — Cancel sends nothing');
    await p.click('[data-testid="biz-ledger-on"]');
    await p.waitForSelector('[data-testid="confirm-ok"]', { timeout: 4000 }).catch(() => {});
    await p.click('[data-testid="confirm-ok"]', { timeout: 2000 }).catch(() => {});
    await p.waitForSelector('[data-testid="nav-ledger"]', { timeout: 15000 }).catch(() => {});
    ok(S.enables === 1 && await p.locator('[data-testid="nav-ledger"]').count() === 1, 'confirmed → POST /api/books/enable once; the Ledger door appears on the menu without a reload');
    await p.evaluate(() => navTo('settings')); await p.waitForSelector('[data-testid="set-sec-business"]', { timeout: 15000 }); await p.click('[data-testid="set-sec-business"]');
    await p.waitForFunction(() => /On/.test((document.querySelector('[data-testid="biz-ledger-state"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    ok(/On/.test(await p.textContent('[data-testid="biz-ledger-state"]').catch(() => '')) && await p.locator('[data-testid="biz-ledger-off"]').count() === 1, 'the card now says On (per day) and offers Switch off');
    /* ⚠️ the switch is the OWNER's. The break 'switch shown to an actor' (books-web-breaks.cjs) flips the role
       gate in businessSettingsHTML and, until 2026-10-01, NOTHING here looked — the harness only ever opens as
       the entity, so the broken gate sailed through green. This asks the painter itself, as an actor. */
    const actorCard = await p.evaluate(() => {
      var was = SESSION.role; SESSION.role = 'actor';
      var html = ''; try { html = businessSettingsHTML({}); } catch (e) { html = 'threw: ' + e.message; }
      SESSION.role = was;
      return /biz-ledger/.test(html) ? 'offered' : (/^threw/.test(html) ? html : 'not offered');
    });
    ok(actorCard === 'not offered', 'an actor is never offered the Ledger switch (' + actorCard + ')');
    await shot(p, '0-ledger-switch');
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
  /* ⚠️⚠️ review M11 — ONE TAP, ONE PAYMENT. The record lands, the proposal read fails, the form still says Next:
     a second press must ask for the proposal again and must NOT record the payment a second time. */
  S.failProposeOnce = true;
  await p.click('[data-testid="pay_record"]');
  await p.waitForFunction(() => ((document.querySelector('[data-testid="pay_why"]') || {}).textContent || '').trim() !== '', null, { timeout: 8000 }).catch(() => {});
  ok(S.payPosts.length === 1 && Object.keys(S.payments).length === 1 && await p.locator('[data-testid="alloc-0"]').count() === 0, 'recorded once; the proposal could not be read, and the form says so');
  ok(/^web-[a-z0-9]+-[0-9a-f]+$/.test(String(S.payPosts[0].client_ref || '')), 'the payment carries a client_ref made when the form opened (' + S.payPosts[0].client_ref + ')');
  S.slowPropose = 900;
  await p.click('[data-testid="pay_record"]');
  await p.waitForTimeout(250);
  const deadNow = await p.evaluate(() => { const b = document.querySelector('[data-testid="pay_record"]'); return !!(b && b.disabled); });
  await p.evaluate(() => { payRecord(); });                  /* a third press, while that call is still out */
  ok(deadNow, 'the button is dead while its call is out');
  await p.waitForSelector('[data-testid="alloc-0"]', { timeout: 8000 });
  S.slowPropose = 0;
  ok(S.payPosts.length === 1 && Object.keys(S.payments).length === 1, '⚠️⚠️ pressing Next again did NOT record the payment again (' + S.payPosts.length + ' POST, ' + Object.keys(S.payments).length + ' payment)');
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

  /* 5b · ⚠️⚠️ review M12 — a cheque: held, and its steps are offered the moment it is recorded */
  await p.click('[data-testid="party-books-c1"] [data-testid="party-pay"]');
  await p.fill('[data-testid="pay_amt"]', '500');
  await p.selectOption('[data-testid="pay_mode"]', 'cheque');
  await p.fill('[data-testid="pay_chqno"]', '004512');
  await p.click('[data-testid="pay_record"]');
  await p.waitForSelector('[data-testid="pay_cheque_note"]', { timeout: 8000 }).catch(() => {});
  const chqId = Object.keys(S.payments).find((k) => S.payments[k].mode === 'cheque');
  ok(!!chqId && S.payPosts[S.payPosts.length - 1].client_ref !== S.payPosts[0].client_ref, 'a new form has a NEW client_ref, so the cheque is its own payment');
  ok(await p.locator('[data-testid="chq-deposited-' + chqId + '"]').count() === 1 && await p.locator('[data-testid="chq-bounced-' + chqId + '"]').count() === 0
    && await p.locator('[data-testid="chq-cleared-' + chqId + '"]').count() === 0, 'a cheque just received offers Deposited only — it is deposited before it can clear or bounce (engines v1.8.1)');
  await p.click('[data-testid="chq-deposited-' + chqId + '"]');
  await p.waitForSelector('[data-testid="chq-cleared-' + chqId + '"]', { timeout: 8000 }).catch(() => {});
  const st0 = S.chequeSteps[0] || {};
  ok(S.chequeSteps.length === 1 && st0.id === chqId && JSON.stringify(st0.body) === JSON.stringify({ status: 'deposited' }), 'Deposited → POST /api/books/cheques/' + chqId + '/status {status:"deposited"}');
  ok(/Deposited/.test(await p.textContent('[data-testid="chq-status-' + chqId + '"]').catch(() => '')), 'and the form now says Deposited, with Cleared offered');
  await noAccounting(p, 'cheque form');
  await p.evaluate(() => { closeModal(); booksAfterPay(); });

  /* the rail's Ledger item is ONE link to its own page now (2026-10-01, CB Accounts); the in-app screen stays reachable by URL / navTo */
  ok(await p.getAttribute('[data-testid="nav-ledger"]', 'href') === '/accounts.html' && /CB Accounts/.test(await p.textContent('[data-testid="nav-ledger"]')), 'the rail\'s Ledger item is the link "CB Accounts ↗" → /accounts.html (same tab)');
  /* 6 · the Ledger screen */
  await p.evaluate(() => navTo('ledger'));
  await p.waitForSelector('[data-testid="bk-tab-daybook"]', { timeout: 15000 });
  await p.waitForSelector('[data-testid="db-entry-JV/2026-27/000001"]', { timeout: 8000 });
  ok(true, 'day book lists the entry with its number');
  /* ⭐ WHERE IT CAME FROM (Athi, 2026-10-01: "how do I connect to the sale record, who has done it?") */
  /* the bidi marks CBLocale wraps dates and times in are not text a reader sees — dropped before comparing */
  const headOf = async (tid) => ((await p.textContent('[data-testid="' + tid + '"]').catch(() => '')) || '').replace(/[‎‏⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  const h1 = await headOf('db-head-JV/2026-27/000001'), h2 = await headOf('db-head-JV/2026-27/000002'), h3 = await headOf('db-head-JV/2026-27/000003');
  const t1 = await headOf('db-src-JV/2026-27/000001-at');
  ok(/\d{1,2}:\d{2}/.test(t1) && h1 === 'Sale · Bill C2/26-27/0002 ' + t1 + ' · On credit · Counter C2 · Athi', 'day book: a bill entry says which bill and its time, how it was paid, which counter, who sold it ("' + h1 + '")');
  ok(!/recorded/.test(h1) && await p.locator('[data-testid="db-src-JV/2026-27/000001-rec"]').count() === 0, 'day book: recorded the same day as the bill → no "recorded" note');
  ok(/^Walk-in day · 12 bills · Cash \S*1,240\.00 · UPI \S*860\.00 · Card \S*300\.00 · Counter C2$/.test(h2), 'day book: a walk-in day says how many bills, its cash / UPI / card split, which counter ("' + h2 + '")');
  ok(h3 === 'Payment received', 'day book: an entry with no chit shows its own word only ("' + h3 + '")');
  const h4 = await headOf('db-head-JV/2026-27/000004');
  const t4 = await headOf('db-src-JV/2026-27/000004-at');
  ok(/\d{1,2}:\d{2}/.test(t4) && h4 === 'Received · Receipt R/C2/0001 ' + t4 + ' · UPI 4421…9931 · Counter C2 · Athi recorded 01 Oct', 'day book: money received says Received, its number and time, UPI and its reference, counter, who — and, taken in late, "recorded 01 Oct" ("' + h4 + '")');
  const opened = await p.evaluate(async () => {
    const was = window.openChit, got = []; window.openChit = function (id) { got.push(id); };
    try { const a = document.querySelector('[data-testid="db-src-JV/2026-27/000001"]'); if (!a) return 'no link'; a.click(); return got.join(','); } finally { window.openChit = was; }
  });
  ok(opened === 'ch1', 'day book: the bill number is a link that opens that chit, once (' + opened + ')');
  ok(await p.locator('[data-testid="db-src-JV/2026-27/000002"]').count() === 0, 'day book: a walk-in day has no single bill to link');

  /* ⭐ 6b · THE STRIP — today's sales per counter and by tender, both rows from ONE function (bkDaySales) */
  const stripC1 = await headOf('strip-counter-C1'), stripC2 = await headOf('strip-counter-C2');
  ok(/4,280\.00/.test(stripC1) && /12 bills/.test(stripC1), 'strip: C1 adds the walk-in day and the credit bill — 4,280.00 · 12 bills ("' + stripC1 + '")');
  ok(/6,909\.00/.test(stripC2) && /1 bill$/.test(stripC2), 'strip: C2 — 6,909.00 · 1 bill, singular ("' + stripC2 + '")');
  const tCash = await headOf('strip-tender-Cash'), tUpi = await headOf('strip-tender-UPI'), tCard = await headOf('strip-tender-Card'), tCred = await headOf('strip-tender-On credit');
  ok(/1,240\.00/.test(tCash) && /300\.00/.test(tCard), 'strip: the day\'s split — Cash 1,240.00 · Card 300.00 ("' + tCash + '" · "' + tCard + '")');
  ok(/7,769\.00/.test(tUpi), 'strip: UPI adds the day\'s split AND the per-bill sale — 7,769.00 ("' + tUpi + '")');
  ok(/1,880\.00/.test(tCred), 'strip: On credit carries the bill\'s total ("' + tCred + '")');
  ok(await p.locator('[data-testid="strip-noclose"]').count() === 0, 'a walk-in day entry for today → no "not closed yet" note');

  /* ⭐ 6c · THE TO-DO — a count and a verb each; each line counted from its own route */
  const todoAccept = await headOf('todo-accept'), todoOver = await headOf('todo-overdue'), todoChq = await headOf('todo-cheques'), todoWait = await headOf('todo-waiting');
  ok(/^3 supplier bills to accept/.test(todoAccept), 'to-do: 3 supplier bills to accept — the health rows "Waiting for you to confirm …" ("' + todoAccept + '")');
  ok(/^1 customer overdue/.test(todoOver), 'to-do: 1 customer overdue — a bucket past "Not due", customers only ("' + todoOver + '")');
  ok(/^1 cheque to deposit \/ clear/.test(todoChq), 'to-do: 1 cheque to deposit / clear — held, with a step still open; the cleared one not counted ("' + todoChq + '")');
  ok(/^2 waiting to be recorded/.test(todoWait), 'to-do: 2 waiting to be recorded — the health rows that are not supplier bills ("' + todoWait + '")');
  ok(await p.locator('[data-testid="todo-none"]').count() === 0, 'something waits → no quiet line');
  await noAccounting(p, 'day book strip and to-do');
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  await p.screenshot({ path: path.join(__dirname, 'shots', 'daybook-todo-laptop.png') });

  /* ⭐ 6d · each line is a TAP to the screen that does it */
  await p.click('[data-testid="todo-overdue"]');
  await p.waitForSelector('[data-testid="dues-side-pay"]', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('[data-testid="dues-side-pay"]').count() === 1, 'tap: customers overdue opens Ledger › Dues');
  await p.click('[data-testid="bk-tab-daybook"]'); await p.waitForSelector('[data-testid="todo-cheques"]', { timeout: 8000 });
  await p.click('[data-testid="todo-cheques"]');
  await p.waitForSelector('[data-testid="chq-chq9"]', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('[data-testid="chq-chq9"]').count() === 1, 'tap: cheques opens Ledger › Cheques');
  await p.click('[data-testid="bk-tab-daybook"]'); await p.waitForSelector('[data-testid="todo-waiting"]', { timeout: 8000 });
  await p.click('[data-testid="todo-waiting"]');
  await p.waitForSelector('[data-testid="wait-retry"]', { timeout: 8000 }).catch(() => {});
  ok(/Waiting to be recorded/.test(await p.textContent('[data-testid="bk-body"]')), 'tap: waiting opens Ledger › Waiting');
  await p.click('[data-testid="bk-tab-daybook"]'); await p.waitForSelector('[data-testid="todo-accept"]', { timeout: 8000 });
  await p.click('[data-testid="todo-accept"]');
  await p.waitForFunction(() => UI.nav === 'intake', null, { timeout: 8000 }).catch(() => {});
  ok(await p.evaluate(() => UI.nav) === 'intake', 'tap: supplier bills opens Intake (the rail folder)');
  await p.evaluate(() => navTo('ledger'));
  await p.waitForSelector('[data-testid="strip-counter-C1"]', { timeout: 15000 });

  await p.click('[data-testid="bk-tab-ledgers"]');
  await p.click('[data-testid="lg-acc-1300"]');
  await p.waitForSelector('[data-testid="stmt-what-0"]', { timeout: 8000 }).catch(() => {});
  const l0 = await headOf('stmt-what-0'), l1 = await headOf('stmt-what-1');
  const lt0 = await headOf('stmt-src-0-at');
  ok(/\d{1,2}:\d{2}/.test(lt0) && l0 === 'Sale · Bill C2/26-27/0002 ' + lt0 + ' · On credit · Counter C2 · Athi recorded 01 Oct JV/2026-27/000001' && l1 === 'Payment received JV/2026-27/000003', 'ledger: each line names its bill, counter and seller ("' + l0 + '" · "' + l1 + '")');
  const opened2 = await p.evaluate(async () => {
    const was = window.openChit, got = []; window.openChit = function (id) { got.push(id); };
    try { const a = document.querySelector('[data-testid="stmt-src-0"]'); if (!a) return 'no link'; a.click(); return got.join(','); } finally { window.openChit = was; }
  });
  ok(opened2 === 'ch1', 'ledger: the bill number opens that chit (' + opened2 + ')');
  await noAccounting(p, 'day book and ledger sources');
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
  /* ⚠️ review F11 — a supplier's buckets are the payable ones; the amount must sit under ITS column, not only Balance */
  const cellOf = (row, b) => p.evaluate(({ row, b }) => { const e = document.querySelector('[data-testid="' + row + '"] [data-b="' + b + '"]'); return e ? e.textContent.trim() : null; }, { row, b });
  ok(/2,500/.test(String(await cellOf('dues-s1', 'lt_1y'))) && await p.locator('[data-testid="dues-side-pay"]').count() === 1, 'dues: what you owe a supplier sits under "< 1 year" in its own table (' + await cellOf('dues-s1', 'lt_1y') + ')');
  ok(String(await cellOf('dues-c1', 'lt_6m') || '').length > 0 && await cellOf('dues-c1', 'lt_1y') === null, 'dues: a customer keeps the six receivable columns');
  await noAccounting(p, 'ledger');

  /* ⚠️⚠️ review M12 — the cheques held, and their steps */
  ok(/5/.test(await p.textContent('[data-testid="bk-tab-waiting"]')), 'the Waiting view says how many are waiting, on the list itself (' + (await p.textContent('[data-testid="bk-tab-waiting"]')).trim() + ')');
  await p.click('[data-testid="bk-tab-cheques"]');
  await p.waitForSelector('[data-testid="chq-' + chqId + '"]', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('[data-testid="chq-' + chqId + '"]').count() === 1 && /Deposited/.test(await p.textContent('[data-testid="chq-status-' + chqId + '"]').catch(() => '')), 'Cheques: the one recorded here is listed, Deposited');
  ok(await p.locator('[data-testid="chq-chq9"]').count() === 1 && /Received/.test(await p.textContent('[data-testid="chq-status-chq9"]').catch(() => '')), 'Cheques: one the server lists as held is there too, Received');
  await p.click('[data-testid="chq-cleared-' + chqId + '"]').catch(() => {});
  await p.waitForFunction((id) => /Cleared/.test((document.querySelector('[data-testid="chq-status-' + id + '"]') || {}).textContent || ''), chqId, { timeout: 8000 }).catch(() => {});
  const st1 = S.chequeSteps[1] || {};
  ok(st1.id === chqId && JSON.stringify(st1.body) === JSON.stringify({ status: 'cleared' }) && /Cleared/.test(await p.textContent('[data-testid="chq-status-' + chqId + '"]').catch(() => '')), 'Cleared → POST …/cheques/' + chqId + '/status {status:"cleared"}; the row says Cleared');
  /* a cleared cheque offers no step at all — a later dishonour is an owner reversal, not a step (engines v1.8.1) */
  ok(await p.locator('[data-testid^="chq-"][data-testid$="-' + chqId + '"]:is(button)').count() === 0, 'a cleared cheque offers no further step');
  /* the server refuses a step: its words are shown, the row does not move (the button offered came from the server\'s `next`) */
  S.refuseCheque = true;
  await p.click('[data-testid="chq-deposited-chq9"]').catch(() => {});
  await p.waitForFunction(() => ((document.querySelector('[data-testid="chq_out"]') || {}).textContent || '').trim() !== '', null, { timeout: 8000 }).catch(() => {});
  ok(/cannot be/.test(await p.textContent('[data-testid="chq_out"]').catch(() => '')) && /Received/.test(await p.textContent('[data-testid="chq-status-chq9"]').catch(() => '')), 'a refused step shows the server\'s words and the row stays Received');
  S.refuseCheque = false;
  /* the held one from the server: only Deposited is offered (the server\'s `next`), then Cleared or Bounced */
  ok(await p.locator('[data-testid="chq-bounced-chq9"]').count() === 0 && await p.locator('[data-testid="chq-deposited-chq9"]').count() === 1, 'a received cheque offers Deposited only — the steps come from the server');
  await p.click('[data-testid="chq-deposited-chq9"]').catch(() => {});
  await p.waitForFunction(() => /Deposited/.test((document.querySelector('[data-testid="chq-status-chq9"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  /* Bounced asks first: Cancel sends nothing, Yes sends it */
  const nSteps = S.chequeSteps.length;
  await p.click('[data-testid="chq-bounced-chq9"]').catch(() => {});
  await p.waitForSelector('[data-testid="confirm-cancel"]', { timeout: 4000 }).catch(() => {});
  await p.click('[data-testid="confirm-cancel"]', { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(300);
  ok(S.chequeSteps.length === nSteps, 'Bounced asks first — Cancel sends nothing');
  await p.click('[data-testid="chq-bounced-chq9"]').catch(() => {});
  await p.waitForSelector('[data-testid="confirm-ok"]', { timeout: 4000 }).catch(() => {});
  await p.click('[data-testid="confirm-ok"]', { timeout: 2000 }).catch(() => {});
  await p.waitForFunction(() => /Bounced/.test((document.querySelector('[data-testid="chq-status-chq9"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const st2 = S.chequeSteps[S.chequeSteps.length - 1] || {};
  ok(S.chequeSteps.length === nSteps + 1 && st2.id === 'chq9' && st2.body.status === 'bounced' && await p.locator('[data-testid^="chq-"][data-testid$="-chq9"]:is(button)').count() === 0, 'Bounced, confirmed → sent; a bounced cheque offers no further step');
  ok(S.chequeLists >= 1, 'the Cheques view reads GET /api/books/cheques (' + S.chequeLists + ' reads)');
  await shot(p, '4b-cheques');
  await noAccounting(p, 'cheques');

  /* ⚠️⚠️ review M12 — what could not be recorded is ON A SCREEN, in the server's words, with Try again */
  await p.click('[data-testid="bk-tab-waiting"]');
  await p.waitForSelector('[data-testid="wait-retry"]', { timeout: 8000 }).catch(() => {});
  const waitTxt = await p.textContent('[data-testid="bk-body"]');
  ok(/Waiting to be recorded/.test(waitTxt) && /Paid by Points — there is no ledger for Points yet\./.test(waitTxt) && /September is locked\. Open it again to record this bill\./.test(waitTxt), 'Waiting to be recorded: each one with the server\'s own sentence');
  await shot(p, '4c-waiting');
  await p.click('[data-testid="wait-retry"]').catch(() => {});
  await p.waitForFunction(() => /still waiting|All recorded/.test((document.querySelector('[data-testid="wait_out"]') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(S.retries === 1 && /1 recorded · 4 still waiting/.test(await p.textContent('[data-testid="wait_out"]').catch(() => '')) && await p.locator('[data-testid="wait-4"]').count() === 0 && await p.locator('[data-testid="wait-3"]').count() === 1,
    'Try again → POST /api/books/outbox/retry; the list is read again: 1 recorded, 4 still waiting (the supplier bills wait on a person, not a retry)');
  await noAccounting(p, 'waiting');

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
  /* M11: pressing Next again on the SAME form is a retry — it carries the same client_ref, so the server can answer with what it kept */
  const nPosts = S.payPosts.length;
  await p.click('[data-testid="pay_record"]');
  for (let i = 0; i < 40 && S.payPosts.length === nPosts; i++) await p.waitForTimeout(100);
  ok(S.payPosts.length === nPosts + 1 && S.payPosts[nPosts].client_ref && S.payPosts[nPosts].client_ref === S.payPosts[nPosts - 1].client_ref, 'a retry from the same form sends the SAME client_ref');
  await p.evaluate(() => closeModal());
  await p.evaluate(() => navTo('ledger')); await p.click('[data-testid="bk-tab-lock"]'); await p.waitForSelector('[data-testid="lk_unlock"]');
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
  /* ⚠️⚠️ review M10 — "We have it" before anything came down in this session: the owner is asked; Cancel sends nothing */
  await p.click('[data-testid="pack-ack-pk1"]');
  await p.waitForSelector('[data-testid="confirm-cancel"]', { timeout: 4000 }).catch(() => {});
  const asked = await p.locator('[data-testid="confirm-cancel"]').count() === 1;
  await p.click('[data-testid="confirm-cancel"]', { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(300);
  ok(asked && S.acks.length === 0 && !S.packs[0].acknowledged_at, '"We have it" with nothing downloaded asks first — Cancel acknowledges nothing');
  let dl = null, dlBytes = Buffer.alloc(0);
  try { [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('[data-testid="pack-get-pk1"]')]); dlBytes = fs.readFileSync(await dl.path()); } catch (_) {}
  /* MOVED (2026-09-30): this asserted that Download saved the MANIFEST as pack-pk1.json — the fault itself (M10).
     Download now brings the pack FILE from /api/books/packs/:id/file; the manifest is still shown on the screen (next line). */
  ok(!!dl && /\.zip$/.test(dl.suggestedFilename()) && dlBytes.equals(ZIP) && S.fileGets === 1, 'Download brings the pack FILE — the zip at /api/books/packs/pk1/file, byte for byte (' + (dl ? dl.suggestedFilename() : 'no download') + ')');
  ok(/gl\.json/.test(await p.textContent('[data-testid="pack-manifest"]').catch(() => '')), 'the manifest is shown: file names and fingerprints');
  await p.click('[data-testid="pack-ack-pk1"]');
  await p.waitForFunction(() => !document.querySelector('[data-testid="pack-ack-pk1"]'), null, { timeout: 8000 }).catch(() => {});
  ok(!!S.packs[0].acknowledged_at && await p.locator('[data-testid="pack-ack-pk1"]').count() === 0, 'acknowledged: the button becomes the date');
  ok(S.acks.length === 1 && await p.locator('[data-testid="confirm-ok"]').count() === 0, 'after the download in this session, "We have it" is a plain yes — no question');
  await p.evaluate(() => { try { closeModal(); } catch (_) {} });
  /* a pack made while storage was not connected has NO file: it says so, and offers neither Download nor We have it */
  S.nextPackNoFile = true;
  await p.fill('[data-testid="pk_p"]', '6'); await p.click('[data-testid="pk_build"]');
  await p.waitForSelector('[data-testid="pack-pk2"]', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('[data-testid="pack-nofile-pk2"]').count() === 1 && await p.locator('[data-testid="pack-get-pk2"]').count() === 0 && await p.locator('[data-testid="pack-ack-pk2"]').count() === 0,
    'a pack with no file says "' + (await p.textContent('[data-testid="pack-nofile-pk2"]').catch(() => '—')).trim() + '" and offers neither button');
  /* an older list that does not say: the question is asked of GET /packs/:id before anything is acknowledged */
  S.nextPackHide = true;
  await p.fill('[data-testid="pk_p"]', '7'); await p.click('[data-testid="pk_build"]');
  await p.waitForSelector('[data-testid="pack-ack-pk3"]', { timeout: 8000 }).catch(() => {});
  await p.click('[data-testid="pack-ack-pk3"]').catch(() => {});
  await p.waitForSelector('[data-testid="pack-nofile-pk3"]', { timeout: 8000 }).catch(() => {});
  ok(S.acks.indexOf('pk3') < 0 && await p.locator('[data-testid="pack-nofile-pk3"]').count() === 1 && await p.locator('[data-testid="pack-get-pk3"]').count() === 0 && await p.locator('[data-testid="confirm-ok"]').count() === 0,
    'a pack whose row does not say: GET /packs/:id answers has_file false → not acknowledged, the row says so');
  await p.evaluate(() => { try { closeModal(); } catch (_) {} });
  S.nextPackNoFile = false; S.nextPackHide = false;
  await shot(p, '6-packs');
  await noAccounting(p, 'packs');

  /* 8 · opening balances + a shop ledger */
  await p.click('[data-testid="bk-tab-opening"]'); await p.waitForSelector('[data-testid="op_csv"]');
  await p.fill('[data-testid="op_csv"]', '1300,P-00001,5000,,INV-0,2026-10-15\n2100,P-00003,100,200,,');
  await p.click('[data-testid="op_go"]');
  ok(S.opening === null && /Line 2/.test(await p.textContent('[data-testid="op_out"]')), 'a line with both debit and credit is refused before sending');
  await p.fill('[data-testid="op_csv"]', '1300,P-00001,5000,,INV-0,2026-10-15\n2100,P-00003,,5000,AM-1,');
  /* ⚠️⚠️ review M11 — the first press fails on the way; the second is a RETRY and carries the same client_ref */
  S.failOpeningOnce = true;
  await p.click('[data-testid="op_go"]');
  for (let i = 0; i < 40 && S.openingPosts.length < 1; i++) await p.waitForTimeout(100);
  await p.waitForFunction(() => { const b = document.querySelector('[data-testid="op_go"]'); return b && !b.disabled && (document.querySelector('[data-testid="op_out"]').textContent || '').trim() !== ''; }, null, { timeout: 8000 }).catch(() => {});
  await p.click('[data-testid="op_go"]');
  await p.waitForFunction(() => /Entered/.test(document.querySelector('[data-testid="op_out"]').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(S.opening && S.opening.rows.length === 2 && S.opening.rows[0].dr_minor === 500000 && S.opening.rows[1].cr_minor === 500000, 'opening balances sent in minor units');
  const oRef = (S.openingPosts[0] || {}).client_ref;
  ok(S.openingPosts.length === 2 && /^web-/.test(String(oRef || '')) && S.openingPosts[1].client_ref === oRef, 'opening balances carry a client_ref, and the retry sends the SAME one');
  /* pressed again after it went in: nothing is sent a second time */
  await p.click('[data-testid="op_go"]'); await p.waitForTimeout(500);
  ok(S.openingPosts.length === 2 && /at least one line/.test(await p.textContent('[data-testid="op_out"]')), '⚠️⚠️ a second press after it went in sends NOTHING (the box was emptied): ' + S.openingPosts.length + ' POSTs');
  await p.fill('[data-testid="op_csv"]', '1400,,250,,,');
  await p.click('[data-testid="op_go"]');
  for (let i = 0; i < 40 && S.openingPosts.length < 3; i++) await p.waitForTimeout(100);
  ok(S.openingPosts.length === 3 && S.openingPosts[2].client_ref && S.openingPosts[2].client_ref !== oRef, 'the next entry, after a yes, has a NEW client_ref');
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

  /* 10 · phone first: the Day book at 390 — the tapped view replaces the rail, nothing scrolls sideways */
  {
    const S2 = standIn();
    const { ctx: c2, p: p2 } = await open(S2, 390);
    await p2.evaluate(() => navTo('ledger'));
    await p2.waitForSelector('[data-testid="bk-tab-daybook"]', { timeout: 15000 });
    await p2.click('[data-testid="bk-tab-daybook"]');
    await p2.waitForSelector('[data-testid="strip-counter-C1"]', { timeout: 15000 }).catch(() => {});
    ok(await p2.locator('[data-testid="strip-counter-C1"]').isVisible().catch(() => false) && await p2.locator('[data-testid="todo-accept"]').isVisible().catch(() => false), 'phone: tapping Day book shows the strip and the to-do (the detail replaces the rail)');
    ok(await p2.evaluate(() => document.documentElement.scrollWidth) === 390, 'document.scrollWidth === 390 at phone width');
    ok(await p2.locator('[data-testid="bk-back"]').isVisible().catch(() => false), 'phone: the view carries a visible way back to the Ledger\'s list');
    await p2.screenshot({ path: path.join(__dirname, 'shots', 'daybook-todo-phone.png') });
    await p2.click('[data-testid="bk-back"]', { timeout: 3000 }).catch(() => {});
    ok(await p2.locator('[data-testid="bk-tab-daybook"]').isVisible().catch(() => false), 'phone: back shows the list again');
    await c2.close();
  }

  /* 11 · the zero day: no sales today, nothing waiting — one quiet line, and the walk-in note */
  {
    const S0 = standIn();
    S0.noToday = true; S0.waiting = []; S0.serverCheques = []; S0.items.c1 = [];
    const { ctx: c0, p: p0 } = await open(S0);
    await p0.waitForSelector('[data-testid="nav-ledger"]', { timeout: 15000 });
    await p0.evaluate(() => navTo('ledger'));
    await p0.waitForSelector('[data-testid="db-entry-JV/2026-27/000001"]', { timeout: 15000 });
    await p0.waitForSelector('[data-testid="todo-none"]', { timeout: 8000 }).catch(() => {});
    ok(/Nothing waiting on you/.test(await p0.textContent('[data-testid="todo-none"]').catch(() => '')), 'all zero → one quiet line: Nothing waiting on you');
    ok(await p0.locator('[data-testid="todo-accept"]').count() === 0 && await p0.locator('[data-testid="todo-overdue"]').count() === 0
      && await p0.locator('[data-testid="todo-cheques"]').count() === 0 && await p0.locator('[data-testid="todo-waiting"]').count() === 0, 'a count at zero earns no row');
    ok(await p0.locator('[data-testid^="strip-counter-"]').count() === 0, 'no sales today → no counter chips');
    ok(await p0.locator('[data-testid="strip-noclose"]').count() === 1 && /close the day on the counter/.test(await p0.textContent('[data-testid="strip-noclose"]').catch(() => '')),
      'no walk-in day entry for today → the muted sentence: Walk-ins not closed yet');
    await p0.screenshot({ path: path.join(__dirname, 'shots', 'daybook-todo-empty.png') });
    await noAccounting(p0, 'day book, zero day');
    await c0.close();
  }

  const mine = threw.filter((m) => /bk|party|pay|books|ledger/i.test(m));
  ok(mine.length === 0, 'no page error from the Ledger code' + (mine.length ? ' — ' + mine.join(' | ') : ''));
  if (threw.length) console.log('  (other page errors, not the Ledger: ' + threw.length + ' — ' + threw.slice(0, 3).join(' | ').slice(0, 300) + ')');
  await ctx.close(); await b.close(); srv.close();
  console.log('\n  books-web: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
