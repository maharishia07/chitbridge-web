/* cap-books.js — THE LEDGER: parties, statements, payments, day book, trial balance, P&L, balance sheet, dues, month
 * lock, handover packs. Loaded on demand (ensureCap('books')). Contract: C:\dev\SPEC-books-v2.md §4–§5.
 *
 * ⚠️⚠️ STANDING RULE (Athi, 2026-09-28): this is NEVER called "accounting" or "books of account" on a screen. The door
 * says Ledger; the tabs say Day book, Ledgers, Trial balance, P&L, Balance sheet, Dues, Month lock, Packs.
 * ⭐ Every figure is the SERVER's (routes/books.js reads stored balances); this file never adds up entries itself —
 * a second opinion about what somebody owes is exactly what must not exist. Money arrives in integer MINOR units
 * and is shown through CBMoney.decimals + CBLocale.money, never rounded here.
 * ⭐ The two panels Athi named are the way in for parties (Customers / Suppliers): partyBooksHTML and
 * partyDueChipHTML are called from app.html's own row and detail painters, only once this file has loaded.
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  booksAccounts:   { m: 'GET',  p: '/api/books/accounts' },
  booksAccountAdd: { m: 'POST', p: '/api/books/accounts' },
  booksDaybook:    { m: 'GET',  p: '/api/books/daybook' },
  booksLedger:     { m: 'GET',  p: '/api/books/ledger/:account' },
  booksTB:         { m: 'GET',  p: '/api/books/trial-balance' },
  booksPL:         { m: 'GET',  p: '/api/books/pl' },
  booksBS:         { m: 'GET',  p: '/api/books/bs' },
  booksPayRecord:  { m: 'POST', p: '/api/books/payments' },
  booksPayPropose: { m: 'POST', p: '/api/books/payments/:id/propose' },
  booksPayConfirm: { m: 'POST', p: '/api/books/payments/:id/confirm' },
  booksLock:       { m: 'POST', p: '/api/books/periods/:fy/:p/lock' },
  booksUnlock:     { m: 'POST', p: '/api/books/periods/:fy/:p/unlock' },
  booksOpening:    { m: 'POST', p: '/api/books/opening' },
  booksPacks:      { m: 'GET',  p: '/api/books/packs' },
  booksPackBuild:  { m: 'POST', p: '/api/books/packs' },
  booksPackGet:    { m: 'GET',  p: '/api/books/packs/:id' },
  booksPackAck:    { m: 'POST', p: '/api/books/packs/:id/ack' },
}); }

/* the tables' look, once, the way cap-categories does it (cbcatCss) */
function bkCss() {
  if (typeof document === 'undefined' || document.getElementById('bk_css')) return;
  var s = document.createElement('style'); s.id = 'bk_css';
  s.textContent = [
    '.bktab th{font-size:var(--fs-1);color:var(--grey);font-weight:600;text-transform:uppercase;text-align:start;padding:5px 7px;border-bottom:1px solid var(--line)}',
    '.bktab td{padding:5px 7px;border-bottom:1px dashed var(--line);vertical-align:top}',
    '.bktab .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.bktab tfoot td{border-top:1px solid var(--ink);border-bottom:0}',
    '.bktab tr.bkentry td{border-top:1px solid var(--line);font-weight:600}',
    '#bk_body input[type=date].inp,#bk_body select.inp,#bk_body .supacts .inp{width:auto}',
  ].join('\n');
  document.head.appendChild(s);
}
bkCss();

/* ── money and dates: through the engines, never by hand ── */
function bkCur(c) { return c || (typeof SESSION !== 'undefined' && SESSION.currency) || 'INR'; }
function bkDec(c) { try { return CBMoney.decimals(bkCur(c)); } catch (_) { return 2; } }
function bkMoney(minor, c) {
  var n = Number(minor || 0) / Math.pow(10, bkDec(c));
  try { return CBLocale.money(n, bkCur(c)); } catch (_) { return n.toFixed(bkDec(c)); }
}
function bkToMinor(v, c) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? Math.round(n * Math.pow(10, bkDec(c))) : NaN; }
function bkDate(d) { if (!d) return '—'; try { return CBLocale.date(d); } catch (_) { return String(d).slice(0, 10); } }
function bkToday() { return new Date().toISOString().slice(0, 10); }
/** ⭐ ONE door for a failure's words: the app's verdict table (friendlyErr, app.html) first, the screen's own fallback
 *  when the server said nothing — never a second table here, never a raw message pasted into a pane. */
function bkWhy(e, fallback) {
  var m = (e && e.message) || '';
  if (!m) return fallback || tx('Could not be read');
  return typeof friendlyErr === 'function' ? friendlyErr(e) : m;
}
function bkErr(e) { return esc(bkWhy(e, tx('Could not be read'))); }

/* ══ 1 · THE PANELS' HALF — a chip on each row, a block in each detail pane ═══════════════════════════════════ */
var BK = { dues: null, duesAt: 0, stmt: {}, tab: 'daybook' };
/** ⭐ ONE READ for every row's chip: /dues answers all parties at once (stored balances, not a scan) */
async function booksDuesLoad(force) {
  if (!force && BK.dues && Date.now() - BK.duesAt < 30000) return BK.dues;
  try {
    var r = await api('booksDues', { query: { asOf: bkToday() } });
    BK.dues = {}; BK.duesCur = (r && r.currency) || null; BK.duesAt = Date.now();
    ((r && r.parties) || []).forEach(function (p) { BK.dues[p.party_id] = p; });
  } catch (_) { BK.dues = BK.dues || {}; }
  try { if (typeof paintCustList === 'function' && document.getElementById('cu_rows')) paintCustList(); } catch (_) {}
  try { if (typeof paintSupList === 'function' && document.getElementById('sup_rows')) paintSupList(); } catch (_) {}
  /* the open party block was painted before the balances arrived — repaint that pane (never a modal) */
  try {
    if (document.querySelector('#detailpane [data-testid^="party-books-"]') && typeof paintCustDetail === 'function' && UI.nav === 'customers') paintCustDetail();
    if (document.querySelector('#supslide [data-testid^="party-books-"]') && typeof paintSupSlide === 'function') paintSupSlide();
  } catch (_) {}
  return BK.dues;
}
/** the row chip: what this party owes you (or you them), and the oldest due date */
function partyDueChipHTML(partyId) {
  var d = BK.dues && BK.dues[partyId]; if (!d) return '';
  var b = Number(d.balance_minor || 0); if (!b) return '<span class="optchip" data-testid="party-due-' + esc(partyId) + '" style="color:var(--grey)">' + esc(d.party_no || '') + ' · ' + tx('settled') + '</span>';
  var owes = b > 0;
  return '<span class="optchip" data-testid="party-due-' + esc(partyId) + '" title="' + esc(owes ? tx('They owe you') : tx('You owe them')) + (d.oldest_due ? ' · ' + esc(tx('oldest due')) + ' ' + esc(bkDate(d.oldest_due)) : '') + '"'
    + ' style="' + (owes ? 'background:var(--warn-tint);color:var(--warn-2);border-color:var(--warn-2)' : 'background:var(--blue-tint);color:var(--blue-d);border-color:var(--blue-d)') + '">'
    + esc(d.party_no || '') + ' · ' + (owes ? '↓ ' : '↑ ') + esc(bkMoney(Math.abs(b), BK.duesCur)) + '</span>';
}
/**
 * ⭐ THE PARTY BLOCK in the Customer detail and the Supplier record: who they are for the ledger (party no, legal
 * name, nickname, tax ids, credit terms), what stands between you (balance, oldest due), their statement, and the
 * one action — Receive (a customer) / Pay (a supplier).
 */
function partyBooksHTML(kind, partyId, row) {
  if (!partyId) return '';
  var d = (BK.dues && BK.dues[partyId]) || {};
  var r = row || {};
  var kv = function (l, v) { return '<div class="kv" style="display:flex;gap:8px;padding:9px 13px;border-bottom:1px dashed var(--line);font-size:var(--fs-2)"><b style="min-width:112px;color:var(--grey);font-weight:600;font-size:var(--fs-1);text-transform:uppercase">' + l + '</b><span style="font-weight:600;flex:1">' + (v == null || v === '' ? '—' : v) + '</span></div>'; };
  var tax = (r.tax_ids || []).map(function (t) { return esc(t.scheme) + ' <span class="mono">' + esc(t.value) + '</span>'; }).join(' · ');
  var b = Number(d.balance_minor || 0);
  var act = kind === 'supplier' ? tx('Pay') : tx('Receive');
  setTimeout(function () { partyStatementLoad(partyId); }, 0);
  return '<div class="sec">' + tx('Ledger') + '</div>'
    + '<div class="itab" data-testid="party-books-' + esc(partyId) + '" style="border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:12px">'
    + kv(tx('Party no'), '<span class="mono" data-testid="party-no">' + esc(d.party_no || r.party_no || '—') + '</span>')
    + kv(tx('Legal name'), esc(r.legal_name || ''))
    + kv(tx('Nickname'), esc(r.nickname || ''))
    + kv(tx('Tax ids'), tax)
    + kv(tx('Credit'), (r.credit_days != null ? txf('{n} days', { n: r.credit_days }) : '—') + (r.credit_limit_minor != null ? ' · ' + tx('limit') + ' ' + esc(bkMoney(r.credit_limit_minor)) : ''))
    + kv(tx('Balance'), b ? '<b data-testid="party-balance">' + esc(bkMoney(Math.abs(b), BK.duesCur)) + '</b> <span style="color:var(--grey)">' + (b > 0 ? tx('they owe you') : tx('you owe them')) + '</span>' : '<span data-testid="party-balance" style="color:var(--grey)">' + tx('settled') + '</span>')
    + kv(tx('Oldest due'), d.oldest_due ? esc(bkDate(d.oldest_due)) : '—')
    + '<div class="supacts" style="display:flex;gap:7px;padding:9px 13px;flex-wrap:wrap">'
    + '<button data-testid="party-edit" onclick="partyEditOpen(\'' + kind + '\',\'' + esc(partyId) + '\')">' + tx('Edit') + '</button>'
    + '<button class="supact-pri" data-testid="party-pay" onclick="payOpen(\'' + kind + '\',\'' + esc(partyId) + '\')">' + act + '</button></div>'
    + '<div id="bk_stmt_' + esc(partyId) + '" data-testid="party-statement" style="padding:9px 13px;font-size:var(--fs-1);color:var(--grey)">' + tx('Reading…') + '</div>'
    + '</div>';
}
async function partyStatementLoad(partyId) {
  var box = document.getElementById('bk_stmt_' + partyId); if (!box || box.getAttribute('data-done') === '1') return;
  box.setAttribute('data-done', '1');
  if (BK.stmt[partyId]) { box.style.color = ''; box.innerHTML = statementHTML(BK.stmt[partyId]); return; }
  try {
    var r = await api('booksStatement', { params: { id: partyId } });
    BK.stmt[partyId] = r;
    box = document.getElementById('bk_stmt_' + partyId); if (!box) return;
    box.style.color = ''; box.innerHTML = statementHTML(r);
  } catch (e) { box = document.getElementById('bk_stmt_' + partyId); if (box) box.innerHTML = bkErr(e); }
}
/** opening · each movement with its running balance · closing — the shape every statement has */
function statementHTML(r) {
  var c = r && r.currency;
  var rows = ((r && r.lines) || []).map(function (l) {
    return '<tr' + (l.source_chit_id ? ' style="cursor:pointer" onclick="openChit(\'' + esc(l.source_chit_id) + '\')"' : '') + '><td>' + esc(bkDate(l.date)) + '</td><td>' + esc(l.what || '') + (l.ref ? ' <span class="mono">' + esc(l.ref) + '</span>' : '') + '</td>'
      + '<td class="num">' + (l.dr_minor ? esc(bkMoney(l.dr_minor, c)) : '') + '</td><td class="num">' + (l.cr_minor ? esc(bkMoney(l.cr_minor, c)) : '') + '</td><td class="num"><b>' + esc(bkMoney(l.running_minor, c)) + '</b></td></tr>';
  }).join('');
  return '<table class="bktab" style="width:100%;border-collapse:collapse;font-size:var(--fs-1)"><thead><tr><th>' + tx('Date') + '</th><th>' + tx('What') + '</th><th class="num">' + tx('Debit') + '</th><th class="num">' + tx('Credit') + '</th><th class="num">' + tx('Balance') + '</th></tr></thead><tbody>'
    + '<tr><td></td><td><i>' + tx('Opening') + '</i></td><td></td><td></td><td class="num" data-testid="stmt-opening">' + esc(bkMoney(r && r.opening_minor, c)) + '</td></tr>'
    + rows
    + '<tr><td></td><td><b>' + tx('Closing') + '</b></td><td></td><td></td><td class="num" data-testid="stmt-closing"><b>' + esc(bkMoney(r && r.closing_minor, c)) + '</b></td></tr></tbody></table>';
}

/* ── the party's own fields, edited where the party is shown ── */
var TAX_SCHEMES = ['GSTIN', 'PAN', 'TAN', 'VAT', 'TRN'];
function partyRowOf(kind, partyId) {
  if (kind === 'supplier') return (UI.sups || []).find(function (s) { return s.supplier_entity_id === partyId; });
  return (UI.custs || []).find(function (c) { return c.customer_identity_id === partyId; });
}
function partyEditOpen(kind, partyId) {
  var r = partyRowOf(kind, partyId) || {};
  var tid = (r.tax_ids && r.tax_ids[0]) || {};
  var inp = function (id, v, ph, extra) { return '<input class="inp" id="' + id + '" data-testid="' + id + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '" style="width:100%" ' + (extra || '') + '>'; };
  modal('<div class="mhd"><div class="t">' + esc(tx('Party')) + ' · ' + esc(r.display_name || r.nickname || '') + '</div></div><div class="mbody" style="display:flex;flex-direction:column;gap:8px">'
    + '<label>' + tx('Legal name') + inp('pe_legal', r.legal_name, tx('as on their tax registration')) + '</label>'
    + '<label>' + tx('Nickname') + inp('pe_nick', r.nickname, tx('what you call them')) + '</label>'
    + '<label>' + tx('Tax id') + '<div class="supacts" style="display:flex;gap:6px"><select class="inp" id="pe_scheme" data-testid="pe_scheme" style="width:auto">' + TAX_SCHEMES.map(function (s) { return '<option' + (tid.scheme === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' + inp('pe_taxid', tid.value, '', 'oninput="partyDupCheck(\'' + kind + '\',\'' + esc(partyId) + '\')"') + '</div></label>'
    + '<div id="pe_dup" data-testid="pe_dup" style="font-size:var(--fs-1);color:var(--warn-2)"></div>'
    + '<div style="display:flex;gap:8px"><label style="flex:1">' + tx('Credit days') + inp('pe_days', r.credit_days, '30', 'inputmode="numeric"') + '</label>'
    + '<label style="flex:1">' + tx('Credit limit') + inp('pe_limit', r.credit_limit_minor != null ? (r.credit_limit_minor / Math.pow(10, bkDec())) : '', '', 'inputmode="decimal"') + '</label></div>'
    + '<label>' + tx('State code') + inp('pe_state', r.state_code, '33') + '</label>'
    + '</div><div class="mfoot"><button onclick="closeModal()">' + tx('Cancel') + '</button><button class="pri" data-testid="pe_save" onclick="partyEditSave(\'' + kind + '\',\'' + esc(partyId) + '\')">' + tx('Save') + '</button></div>');
  partyDupCheck(kind, partyId);
}
/** ⚠️ duplicate parties come from free text with no tax-id check — warn before saving (the research's failure 5) */
function partyDupCheck(kind, partyId) {
  var box = document.getElementById('pe_dup'); if (!box) return;
  var v = String((document.getElementById('pe_taxid') || {}).value || '').trim().toUpperCase();
  var sc = (document.getElementById('pe_scheme') || {}).value;
  if (!v) { box.textContent = ''; return; }
  var all = (UI.custs || []).map(function (c) { return { id: c.customer_identity_id, name: c.display_name, tax: c.tax_ids }; })
    .concat((UI.sups || []).map(function (s) { return { id: s.supplier_entity_id, name: s.display_name || s.nickname, tax: s.tax_ids }; }));
  var hit = all.filter(function (p) { return p.id !== partyId && (p.tax || []).some(function (t) { return t.scheme === sc && String(t.value).toUpperCase() === v; }); })[0];
  box.textContent = hit ? txf('{name} already has this {scheme}', { name: hit.name || '', scheme: sc }) : '';
}
async function partyEditSave(kind, partyId) {
  var g = function (id) { return String((document.getElementById(id) || {}).value || '').trim(); };
  var r = partyRowOf(kind, partyId) || {};
  var listId = kind === 'supplier' ? r.supplier_list_id : r.customer_list_id;
  var lim = g('pe_limit'), days = g('pe_days');
  var body = { legal_name: g('pe_legal') || null, nickname: g('pe_nick') || null, state_code: g('pe_state') || null,
    credit_days: days === '' ? null : parseInt(days, 10), credit_limit_minor: lim === '' ? null : bkToMinor(lim),
    tax_ids: g('pe_taxid') ? [{ scheme: g('pe_scheme'), value: g('pe_taxid').toUpperCase() }] : [] };
  if (body.credit_days != null && !(body.credit_days >= 0)) { toast(tx('Credit days: a whole number')); return; }
  if (body.credit_limit_minor != null && !(body.credit_limit_minor >= 0)) { toast(tx('Credit limit: an amount')); return; }
  try {
    await api(kind === 'supplier' ? 'supPatch' : 'custGroup', { params: { id: listId }, body: body });
    Object.assign(r, body);
    closeModal(); toast(tx('Saved'));
    if (kind === 'supplier') { if (typeof paintSupSlide === 'function') paintSupSlide(); } else if (typeof paintCustDetail === 'function') paintCustDetail();
  } catch (e) {
    /* the server's own duplicate check (409 DUPLICATE_PARTY) says the same as the warning, with authority */
    var box = document.getElementById('pe_dup'); if (box) box.textContent = bkWhy(e, tx('Could not save'));
  }
}

/* ══ 2 · RECEIVE / PAY — record, see the proposal, change it if you want, confirm ═════════════════════════════ */
var PAY = null;
function payOpen(kind, partyId) {
  var r = partyRowOf(kind, partyId) || {};
  PAY = { kind: kind, partyId: partyId, name: r.nickname || r.display_name || '' };
  modal('<div class="mhd"><div class="t">' + esc(kind === 'supplier' ? tx('Pay') : tx('Receive')) + ' · ' + esc(PAY.name) + '</div></div><div class="mbody" id="pay_body" style="display:flex;flex-direction:column;gap:8px">'
    + '<label>' + tx('Amount') + '<input class="inp" id="pay_amt" data-testid="pay_amt" inputmode="decimal" style="width:100%"></label>'
    + '<label>' + tx('How') + '<select class="inp" id="pay_mode" data-testid="pay_mode" onchange="payModePaint()"><option value="cash">' + tx('Cash') + '</option><option value="upi">UPI</option><option value="bank">' + tx('Bank') + '</option><option value="card">' + tx('Card') + '</option><option value="cheque">' + tx('Cheque') + '</option></select></label>'
    + '<label>' + tx('Reference') + '<input class="inp" id="pay_ref" data-testid="pay_ref" style="width:100%"></label>'
    + '<div id="pay_chq" hidden style="display:flex;gap:6px"><input class="inp" id="pay_chqno" data-testid="pay_chqno" placeholder="' + esc(tx('Cheque no')) + '"><input class="inp" id="pay_bank" placeholder="' + esc(tx('Bank')) + '"><input class="inp" id="pay_chqdate" type="date"></div>'
    + '<div id="pay_why" data-testid="pay_why" style="color:var(--warn-2);font-size:var(--fs-1)"></div>'
    + '</div><div class="mfoot" id="pay_foot"><button onclick="closeModal()">' + tx('Cancel') + '</button><button class="pri" data-testid="pay_record" onclick="payRecord()">' + tx('Next') + '</button></div>');
}
function payModePaint() { var c = document.getElementById('pay_chq'); if (c) c.hidden = (document.getElementById('pay_mode') || {}).value !== 'cheque'; }
async function payRecord() {
  var why = document.getElementById('pay_why');
  var amt = bkToMinor((document.getElementById('pay_amt') || {}).value);
  if (!(amt > 0)) { if (why) why.textContent = tx('Type the amount'); return; }
  var mode = (document.getElementById('pay_mode') || {}).value;
  var body = { party_id: PAY.partyId, direction: PAY.kind === 'supplier' ? 'out' : 'in', amount_minor: amt, currency: bkCur(),
    mode: mode, reference: (document.getElementById('pay_ref') || {}).value || null, received_at: new Date().toISOString(),
    cheque: mode === 'cheque' ? { number: (document.getElementById('pay_chqno') || {}).value || null, bank: (document.getElementById('pay_bank') || {}).value || null, date: (document.getElementById('pay_chqdate') || {}).value || null } : null };
  try {
    var r = await api('booksPayRecord', { body: body });
    PAY.id = r && r.payment && r.payment.payment_id; PAY.amount = amt;
    /* ⭐ C3: a cheque counts on CLEARING — nothing to match yet, and it says so */
    if (r && r.payment && r.payment.status === 'cheque_received') {
      document.getElementById('pay_body').innerHTML = '<p data-testid="pay_cheque_note">' + tx('Counts against bills when the cheque clears') + '</p>';
      document.getElementById('pay_foot').innerHTML = '<button class="pri" onclick="closeModal();booksAfterPay()">' + tx('Done') + '</button>';
      return;
    }
    var p = await api('booksPayPropose', { params: { id: PAY.id } });
    PAY.proposal = p;
    payProposalPaint();
  } catch (e) { if (why) why.textContent = bkWhy(e, tx('Could not record it')); }
}
/** ⭐ D1: the rule PROPOSES (oldest due first); the person changes it if they want; a disputed bill cannot take anything */
function payProposalPaint() {
  var p = PAY.proposal || {}, rows = p.proposal || [];
  var body = document.getElementById('pay_body'); if (!body) return;
  body.innerHTML = '<div style="font-size:var(--fs-1);color:var(--grey)">' + txf('{amt}, oldest due first — change any amount', { amt: bkMoney(PAY.amount) }) + '</div>'
    + '<table class="bktab" style="width:100%;font-size:var(--fs-1)"><thead><tr><th>' + tx('Bill') + '</th><th>' + tx('Due') + '</th><th class="num">' + tx('Open') + '</th><th class="num">' + tx('Apply') + '</th></tr></thead><tbody>'
    + rows.map(function (it, i) {
        return '<tr data-testid="alloc-row-' + i + '"><td class="mono">' + esc(it.bill_no || it.against_ref) + (it.disputed ? ' <span class="optchip" style="color:var(--warn-2)">' + tx('disputed') + '</span>' : '') + '</td><td>' + esc(bkDate(it.due_date)) + '</td><td class="num">' + esc(bkMoney(it.open_minor)) + '</td>'
          + '<td class="num"><input class="inp" data-testid="alloc-' + i + '" id="alloc_' + i + '" style="width:110px;text-align:end" inputmode="decimal" ' + (it.disputed ? 'disabled title="' + esc(tx('In dispute · settle it first')) + '"' : '') + ' value="' + esc(it.apply_minor ? (it.apply_minor / Math.pow(10, bkDec())) : '') + '" oninput="payLeftPaint()"></td></tr>';
      }).join('') + '</tbody></table>'
    + '<div data-testid="pay_left" id="pay_left" style="font-size:var(--fs-1)"></div><div id="pay_why" data-testid="pay_why" style="color:var(--warn-2);font-size:var(--fs-1)"></div>';
  document.getElementById('pay_foot').innerHTML = '<button onclick="closeModal()">' + tx('Later') + '</button><button class="pri" data-testid="pay_confirm" onclick="payConfirm()">' + tx('Confirm') + '</button>';
  payLeftPaint();
}
function payAllocs() {
  return ((PAY.proposal && PAY.proposal.proposal) || []).map(function (it, i) {
    var v = (document.getElementById('alloc_' + i) || {}).value; var m = v === '' || v == null ? 0 : bkToMinor(v);
    return { against_ref: it.against_ref, amount_minor: m, disputed: !!it.disputed, open_minor: it.open_minor };
  });
}
function payLeftPaint() {
  var a = payAllocs(), used = a.reduce(function (s, x) { return s + (x.amount_minor > 0 ? x.amount_minor : 0); }, 0);
  var left = PAY.amount - used, box = document.getElementById('pay_left'); if (!box) return;
  box.textContent = left >= 0 ? txf('{amt} stays on account', { amt: bkMoney(left) }) : txf('{amt} more than was paid', { amt: bkMoney(-left) });
  box.style.color = left < 0 ? 'var(--warn-2)' : 'var(--grey)';
}
async function payConfirm() {
  var why = document.getElementById('pay_why');
  var a = payAllocs();
  /* the same refusals the engine makes (check), said before the round trip — the server still decides */
  var bad = a.filter(function (x) { return x.amount_minor < 0 || !isFinite(x.amount_minor) || x.amount_minor > x.open_minor || (x.disputed && x.amount_minor > 0); })[0];
  var used = a.reduce(function (s, x) { return s + (x.amount_minor > 0 ? x.amount_minor : 0); }, 0);
  if (bad) { if (why) why.textContent = bad.disputed ? tx('A disputed bill takes nothing') : tx('More than that bill has open'); return; }
  if (used > PAY.amount) { if (why) why.textContent = tx('More applied than paid'); return; }
  try {
    await api('booksPayConfirm', { params: { id: PAY.id }, body: { allocations: a.filter(function (x) { return x.amount_minor > 0; }).map(function (x) { return { against_ref: x.against_ref, amount_minor: x.amount_minor }; }) } });
    closeModal(); toast(tx('Saved')); booksAfterPay();
  } catch (e) { if (why) why.textContent = bkWhy(e, tx('Could not confirm')); }
}
function booksAfterPay() {
  if (PAY) { delete BK.stmt[PAY.partyId]; }
  booksDuesLoad(true).then(function () {
    try { if (PAY && PAY.kind === 'supplier') { if (typeof paintSupSlide === 'function') paintSupSlide(); } else if (typeof paintCustDetail === 'function') paintCustDetail(); } catch (_) {}
  });
}

/* ══ 3 · THE LEDGER SCREEN — the house layout: a list of views on the left, the view on the right ═════════════ */
var BK_TABS = [
  ['daybook', '📖', 'Day book'], ['ledgers', '📒', 'Ledgers'], ['tb', '⚖️', 'Trial balance'], ['pl', '📈', 'P&L'],
  ['bs', '🏛️', 'Balance sheet'], ['dues', '⏳', 'Dues'], ['lock', '🔒', 'Month lock'], ['packs', '📦', 'Packs'],
  ['opening', '📥', 'Opening balances'], ['accounts', '🗂️', 'Shop ledgers'],
];
function ledgerScreen() {
  var list = '<div class="list"><div class="lh"><div style="font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-3)">📒 ' + tx('Ledger') + '</div></div><div class="rows" id="bk_tabs">'
    + BK_TABS.map(function (t) { return '<div class="row ' + (BK.tab === t[0] ? 'sel' : '') + '" data-testid="bk-tab-' + t[0] + '" onclick="bkTab(\'' + t[0] + '\')"><div class="main2"><div class="l1"><span class="code">' + t[1] + ' ' + tx(t[2]) + '</span></div></div><div class="rowgo" aria-hidden="true">›</div></div>'; }).join('')
    + '</div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  setTimeout(function () { bkTab(BK.tab, true); }, 0);
  return '<div class="panel" id="panel" style="--lw:' + UI.lw + 'px">' + list + divider + '<div class="detail" id="detailpane"><div class="db" id="bk_body" data-testid="bk-body">' + tx('Reading…') + '</div></div></div>';
}
function bkTab(t, silent) {
  BK.tab = t;
  var tabs = document.getElementById('bk_tabs');
  if (tabs) Array.prototype.forEach.call(tabs.children, function (el) { el.classList.toggle('sel', el.getAttribute('data-testid') === 'bk-tab-' + t); });
  var body = document.getElementById('bk_body'); if (!body) return;
  body.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + tx('Reading…') + '</div>';
  var f = { daybook: bkDaybook, ledgers: bkLedgers, tb: bkTB, pl: bkPL, bs: bkBS, dues: bkDues, lock: bkLockView, packs: bkPacks, opening: bkOpeningView, accounts: bkAccounts }[t];
  if (f) f(body);
}
function bkRange(id) {
  var from = (document.getElementById(id + '_from') || {}).value, to = (document.getElementById(id + '_to') || {}).value;
  var d = new Date(); var fyStart = (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1) + '-04-01';
  return { from: from || fyStart, to: to || bkToday() };
}
function bkRangeHTML(id, again) {
  var r = bkRange(id);
  return '<div class="supacts" style="display:flex;gap:6px;align-items:center;margin-bottom:9px;flex-wrap:wrap"><input type="date" class="inp" id="' + id + '_from" value="' + r.from + '"><span>→</span><input type="date" class="inp" id="' + id + '_to" value="' + r.to + '"><button onclick="' + again + '">' + tx('Show') + '</button></div>';
}
function bkTable(head, rows, foot) {
  return '<table class="bktab" style="width:100%;border-collapse:collapse;font-size:var(--fs-1)"><thead><tr>' + head.map(function (h) { return '<th' + (h.num ? ' class="num"' : '') + '>' + h.t + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table>';
}
async function bkDaybook(body) {
  var q = bkRange('db');
  try {
    var r = await api('booksDaybook', { query: q }); var c = r && r.currency;
    var rows = ((r && r.entries) || []).map(function (e) {
      return '<tr class="bkentry" data-testid="db-entry-' + esc(e.entry_no) + '"' + (e.source_chit_id ? ' style="cursor:pointer" onclick="openChit(\'' + esc(e.source_chit_id) + '\')"' : '') + '><td>' + esc(bkDate(e.posting_date)) + '</td><td class="mono">' + esc(e.entry_no) + '</td><td colspan="3">' + esc(e.narration || e.event_type || '') + '</td></tr>'
        + (e.lines || []).map(function (l) { return '<tr><td></td><td class="mono">' + esc(l.code) + '</td><td>' + esc(l.name) + (l.party_name ? ' · ' + esc(l.party_name) : '') + '</td><td class="num">' + (l.dr_minor ? esc(bkMoney(l.dr_minor, c)) : '') + '</td><td class="num">' + (l.cr_minor ? esc(bkMoney(l.cr_minor, c)) : '') + '</td></tr>'; }).join('');
    }).join('');
    body.innerHTML = bkRangeHTML('db', "bkTab('daybook')") + (rows ? bkTable([{ t: tx('Date') }, { t: tx('No') }, { t: tx('Ledger') }, { t: tx('Debit'), num: 1 }, { t: tx('Credit'), num: 1 }], rows) : emptyState('📖', tx('Nothing in these dates'), ''));
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkLedgers(body) {
  try {
    var r = await api('booksAccounts'); var acc = ((r && r.accounts) || []).filter(function (a) { return !a.is_group; });
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px"><select class="inp" id="lg_acc" data-testid="lg_acc">' + acc.map(function (a) { return '<option value="' + esc(a.code) + '"' + (BK.lgAcc === a.code ? ' selected' : '') + '>' + esc(a.code + ' · ' + a.name) + '</option>'; }).join('') + '</select></div>'
      + bkRangeHTML('lg', 'bkLedgerShow()') + '<div id="lg_out" data-testid="lg_out"></div>';
    bkLedgerShow();
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkLedgerShow() {
  var out = document.getElementById('lg_out'); if (!out) return;
  BK.lgAcc = (document.getElementById('lg_acc') || {}).value; if (!BK.lgAcc) { out.innerHTML = ''; return; }
  try {
    var q = bkRange('lg'); var r = await api('booksLedger', { params: { account: BK.lgAcc }, query: q });
    out.innerHTML = statementHTML(r);
  } catch (e) { out.innerHTML = bkErr(e); }
}
async function bkTB(body) {
  var asOf = (document.getElementById('tb_asof') || {}).value || bkToday();
  try {
    var r = await api('booksTB', { query: { asOf: asOf } }); var c = r && r.currency;
    var rows = ((r && r.rows) || []).map(function (x) { return '<tr><td class="mono">' + esc(x.code) + '</td><td>' + esc(x.name) + '</td><td class="num">' + (x.dr_minor ? esc(bkMoney(x.dr_minor, c)) : '') + '</td><td class="num">' + (x.cr_minor ? esc(bkMoney(x.cr_minor, c)) : '') + '</td></tr>'; }).join('');
    var ok = Number(r.total_dr_minor) === Number(r.total_cr_minor);
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;align-items:center;margin-bottom:9px"><input type="date" class="inp" id="tb_asof" value="' + asOf + '"><button onclick="bkTab(\'tb\')">' + tx('Show') + '</button>'
      + '<span class="optchip" data-testid="tb-balanced" style="margin-inline-start:auto;' + (ok ? 'color:var(--ok-2);border-color:var(--ok-2)' : 'color:var(--warn-2);border-color:var(--warn-2)') + '">' + (ok ? tx('✓ balances') : tx('⚠ does not balance')) + '</span></div>'
      + bkTable([{ t: tx('Code') }, { t: tx('Ledger') }, { t: tx('Debit'), num: 1 }, { t: tx('Credit'), num: 1 }], rows,
          '<tr><td></td><td><b>' + tx('Total') + '</b></td><td class="num" data-testid="tb-dr"><b>' + esc(bkMoney(r.total_dr_minor, c)) + '</b></td><td class="num" data-testid="tb-cr"><b>' + esc(bkMoney(r.total_cr_minor, c)) + '</b></td></tr>');
  } catch (e) { body.innerHTML = bkErr(e); }
}
function bkSideHTML(title, rows, c, total) {
  return '<div class="sec">' + title + '</div>' + bkTable([{ t: tx('Ledger') }, { t: tx('Amount'), num: 1 }],
    (rows || []).map(function (x) { return '<tr><td>' + esc(x.code ? x.code + ' · ' : '') + esc(x.name) + '</td><td class="num">' + esc(bkMoney(x.amount_minor, c)) + '</td></tr>'; }).join(''),
    total != null ? '<tr><td><b>' + tx('Total') + '</b></td><td class="num"><b>' + esc(bkMoney(total, c)) + '</b></td></tr>' : '');
}
async function bkPL(body) {
  var q = bkRange('pl');
  try {
    var r = await api('booksPL', { query: q }); var c = r && r.currency;
    body.innerHTML = bkRangeHTML('pl', "bkTab('pl')") + bkSideHTML(tx('Income'), r.income, c) + bkSideHTML(tx('Expenses'), r.expense, c)
      + '<div style="padding:9px 0;font-size:var(--fs-3)" data-testid="pl-profit"><b>' + (Number(r.profit_minor) >= 0 ? tx('Profit') : tx('Loss')) + ' ' + esc(bkMoney(Math.abs(r.profit_minor || 0), c)) + '</b></div>';
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkBS(body) {
  var asOf = (document.getElementById('bs_asof') || {}).value || bkToday();
  try {
    var r = await api('booksBS', { query: { asOf: asOf } }); var c = r && r.currency;
    var ok = Number(r.total_assets_minor) === Number(r.total_liab_equity_minor);
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;align-items:center;margin-bottom:9px"><input type="date" class="inp" id="bs_asof" value="' + asOf + '"><button onclick="bkTab(\'bs\')">' + tx('Show') + '</button>'
      + '<span class="optchip" data-testid="bs-balanced" style="margin-inline-start:auto;' + (ok ? 'color:var(--ok-2)' : 'color:var(--warn-2)') + '">' + (ok ? tx('✓ balances') : tx('⚠ does not balance')) + '</span></div>'
      + bkSideHTML(tx('Assets'), r.assets, c, r.total_assets_minor) + bkSideHTML(tx('Liabilities'), r.liabilities, c) + bkSideHTML(tx('Owner'), r.equity, c, r.total_liab_equity_minor);
  } catch (e) { body.innerHTML = bkErr(e); }
}
/** ⭐ Schedule III: not due, then less than 6 months, 6–12 months, 1–2 years, 2–3 years, more than 3 years — disputed apart */
var BK_BUCKETS = [['not_due', 'Not due'], ['lt_6m', '< 6 months'], ['m6_1y', '6–12 months'], ['y1_2', '1–2 years'], ['y2_3', '2–3 years'], ['gt_3y', '> 3 years']];
async function bkDues(body) {
  try {
    var r = await api('booksDues', { query: { asOf: bkToday() } }); var c = r && r.currency;
    var rows = ((r && r.parties) || []).filter(function (p) { return Number(p.balance_minor); }).map(function (p) {
      var b = p.buckets || {};
      return '<tr data-testid="dues-' + esc(p.party_id) + '"><td class="mono">' + esc(p.party_no || '') + '</td><td>' + esc(p.name || '') + '</td>'
        + BK_BUCKETS.map(function (k) { return '<td class="num">' + (b[k[0]] ? esc(bkMoney(b[k[0]], c)) : '') + '</td>'; }).join('')
        + '<td class="num">' + (p.disputed_minor ? esc(bkMoney(p.disputed_minor, c)) : '') + '</td><td class="num"><b>' + esc(bkMoney(p.balance_minor, c)) + '</b></td></tr>';
    }).join('');
    body.innerHTML = rows ? bkTable([{ t: tx('No') }, { t: tx('Party') }].concat(BK_BUCKETS.map(function (k) { return { t: tx(k[1]), num: 1 }; })).concat([{ t: tx('Disputed'), num: 1 }, { t: tx('Balance'), num: 1 }]), rows)
      : emptyState('⏳', tx('Nothing is due'), '');
  } catch (e) { body.innerHTML = bkErr(e); }
}
function bkFyNow() { var d = new Date(); var y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return y + '-' + String((y + 1) % 100).padStart(2, '0'); }
var BK_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
/** the period's status is a server enum — it becomes a word here, never shown raw */
var BK_PERIOD_WORD = { open: 'Open', soft_locked: 'Locked', hard_locked: 'Closed for good' };
function bkLockView(body) {
  var months = BK_MONTHS;
  body.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;max-width:420px">'
    + '<label>' + tx('Year') + '<input class="inp" id="lk_fy" data-testid="lk_fy" value="' + bkFyNow() + '"></label>'
    + '<label>' + tx('Month') + '<select class="inp" id="lk_p" data-testid="lk_p">' + months.map(function (m, i) { return '<option value="' + (i + 1) + '">' + tx(m) + '</option>'; }).join('') + '</select></label>'
    + '<label>' + tx('Reason') + '<input class="inp" id="lk_why" data-testid="lk_why"></label>'
    + '<div class="supacts" style="display:flex;gap:7px;flex-wrap:wrap"><button class="supact-pri" data-testid="lk_lock" onclick="bkLockDo(\'lock\')" title="' + esc(tx('Stops entries · reopens with a reason')) + '">🔒 ' + tx('Lock') + '</button>'
    + '<button data-testid="lk_unlock" onclick="bkLockDo(\'unlock\')">🔓 ' + tx('Open again') + '</button>'
    + '<button data-testid="lk_hard" onclick="bkLockDo(\'hard\')" title="' + esc(tx('Year end only · never opens again')) + '">⛔ ' + tx('Close for good') + '</button></div>'
    + '<div id="lk_out" data-testid="lk_out" style="font-size:var(--fs-1)"></div></div>';
}
async function bkLockDo(what) {
  var fy = (document.getElementById('lk_fy') || {}).value, p = (document.getElementById('lk_p') || {}).value, why = (document.getElementById('lk_why') || {}).value || '';
  var out = document.getElementById('lk_out');
  if (what !== 'lock' && !why.trim()) { if (out) out.textContent = tx('Say why — the reason is kept'); return; }
  if (what === 'hard' && !(await new Promise(function (res) { confirmAsk(tx('Close for good?'), esc(tx('This month never opens again')), tx('Close for good'), function () { res(true); }, true, function () { res(false); }); }))) return;
  try {
    var r = await api(what === 'unlock' ? 'booksUnlock' : 'booksLock', { params: { fy: fy, p: p }, body: { reason: why, hard: what === 'hard' } });
    var st = r && r.period && r.period.status;
    if (out) out.textContent = txf('{m} {fy} · {s}', { m: BK_MONTHS[parseInt(p, 10) - 1] || p, fy: fy, s: tx(BK_PERIOD_WORD[st] || 'Done') });
  } catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not change it')); }
}
async function bkPacks(body) {
  try {
    var r = await api('booksPacks');
    var rows = ((r && r.packs) || []).map(function (k) {
      return '<tr data-testid="pack-' + esc(k.pack_id) + '"><td>' + esc(tx({ month: 'Month', year: 'Year', exit: 'Exit' }[k.kind] || k.kind || '')) + '</td><td>' + esc(k.fiscal_year || '') + (k.period ? ' · ' + esc(k.period) : '') + '</td><td>' + esc(bkDate(k.created_at)) + '</td>'
        + '<td class="mono" title="' + esc(k.sha256 || '') + '">' + esc(String(k.sha256 || '').slice(0, 10)) + '</td>'
        + '<td>' + (k.acknowledged_at ? '✓ ' + esc(bkDate(k.acknowledged_at)) : '<div class="supacts" style="margin:0"><button data-testid="pack-ack-' + esc(k.pack_id) + '" onclick="bkPackAck(\'' + esc(k.pack_id) + '\')">' + tx('We have it') + '</button></div>') + '</td>'
        + '<td><div class="supacts" style="margin:0"><button data-testid="pack-get-' + esc(k.pack_id) + '" onclick="bkPackGet(\'' + esc(k.pack_id) + '\')">' + tx('Download') + '</button></div></td></tr>';
    }).join('');
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px"><input class="inp" id="pk_fy" data-testid="pk_fy" value="' + bkFyNow() + '" style="width:90px"><input class="inp" id="pk_p" data-testid="pk_p" placeholder="' + esc(tx('month 1–12')) + '" style="width:90px"><button class="supact-pri" data-testid="pk_build" onclick="bkPackBuild()">' + tx('Make a pack') + '</button></div>'
      + '<div id="pk_out" data-testid="pk_out" style="font-size:var(--fs-1)"></div>'
      + (rows ? bkTable([{ t: tx('Kind') }, { t: tx('Period') }, { t: tx('Made') }, { t: tx('Fingerprint') }, { t: tx('Handed over') }, { t: '' }], rows) : emptyState('📦', tx('No packs yet'), tx('Lock a month first')));
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkPackBuild() {
  var out = document.getElementById('pk_out');
  var fy = (document.getElementById('pk_fy') || {}).value, p = parseInt((document.getElementById('pk_p') || {}).value, 10);
  try { await api('booksPackBuild', { body: { kind: p ? 'month' : 'year', fiscal_year: fy, period: p || null } }); bkTab('packs'); }
  catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not make it')); }
}
/** ⭐ the pack comes down with its manifest — the file list and fingerprints are what make it checkable */
async function bkPackGet(id) {
  var out = document.getElementById('pk_out');
  try {
    var r = await api('booksPackGet', { params: { id: id } });
    var files = (r && r.manifest && r.manifest.files) || [];
    if (out) out.innerHTML = '<div data-testid="pack-manifest"><b>' + esc(tx('Manifest')) + '</b> · ' + files.length + ' ' + tx('files') + '<br>' + files.map(function (f) { return '<span class="mono">' + esc(f.name) + ' · ' + esc(String(f.sha256 || '').slice(0, 12)) + '</span>'; }).join('<br>') + '</div>';
    var blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pack-' + id + '.json'; a.setAttribute('data-testid', 'pack-download-link'); document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not download it')); }
}
async function bkPackAck(id) { try { await api('booksPackAck', { params: { id: id }, body: {} }); bkTab('packs'); } catch (e) { toast(bkWhy(e, tx('Could not record it'))); } }
function bkOpeningView(body) {
  body.innerHTML = '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:6px">' + tx('Per line: code, party no, debit, credit, bill, due date') + '</div>'
    + '<textarea class="inp" id="op_csv" data-testid="op_csv" rows="8" style="width:100%;font-family:var(--mono)" placeholder="1300,P-00001,5000,,INV-12,2026-10-15"></textarea>'
    + '<div class="supacts" style="display:flex;gap:7px;margin-top:7px"><button class="supact-pri" data-testid="op_go" onclick="bkOpeningGo()">' + tx('Enter opening balances') + '</button></div><div id="op_out" data-testid="op_out" style="font-size:var(--fs-1);margin-top:6px"></div>';
}
async function bkOpeningGo() {
  var out = document.getElementById('op_out');
  var lines = String((document.getElementById('op_csv') || {}).value || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  var rows = [], bad = [];
  lines.forEach(function (l, i) {
    var c = l.split(',').map(function (x) { return x.trim(); });
    var dr = c[2] ? bkToMinor(c[2]) : 0, cr = c[3] ? bkToMinor(c[3]) : 0;
    if (!c[0] || !isFinite(dr) || !isFinite(cr) || (dr && cr) || (!dr && !cr)) bad.push(i + 1);
    else rows.push({ code: c[0], party_no: c[1] || null, dr_minor: dr, cr_minor: cr, bill_ref: c[4] || null, due_date: c[5] || null });
  });
  if (bad.length) { if (out) out.textContent = txf('Line {n}: one amount, debit or credit.', { n: bad.join(', ') }); return; }
  try {
    var r = await api('booksOpening', { body: { rows: rows } });
    if (out) out.textContent = txf('Entered as {no}.', { no: (r && r.entry_no) || '' }) + (r && r.suspense_minor ? ' ' + txf('{amt} did not balance — held in Suspense', { amt: bkMoney(r.suspense_minor) }) : '');
  } catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not enter them')); }
}
async function bkAccounts(body) {
  try {
    var r = await api('booksAccounts'); var acc = (r && r.accounts) || [];
    var groups = acc.filter(function (a) { return a.is_group; });
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px"><input class="inp" id="ac_name" data-testid="ac_name" placeholder="' + esc(tx('New ledger name')) + '"><select class="inp" id="ac_parent" data-testid="ac_parent">' + groups.map(function (g) { return '<option value="' + esc(g.code) + '">' + esc(g.code + ' · ' + g.name) + '</option>'; }).join('') + '</select><button class="supact-pri" data-testid="ac_add" onclick="bkAccountAdd()">' + tx('Add') + '</button></div><div id="ac_out" style="font-size:var(--fs-1)"></div>'
      + bkTable([{ t: tx('Code') }, { t: tx('Ledger') }, { t: tx('Group') }], acc.map(function (a) { return '<tr' + (a.is_group ? ' style="font-weight:700"' : '') + '><td class="mono">' + esc(a.code) + '</td><td>' + esc(a.name) + '</td><td>' + esc(a.tally_group || '') + '</td></tr>'; }).join(''));
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkAccountAdd() {
  var n = String((document.getElementById('ac_name') || {}).value || '').trim(), p = (document.getElementById('ac_parent') || {}).value;
  var out = document.getElementById('ac_out');
  if (!n) { if (out) out.textContent = tx('Type a name'); return; }
  try { var r = await api('booksAccountAdd', { body: { name: n, parent_code: p } }); toast(txf('Added as {code}', { code: (r && r.account && r.account.code) || '' })); bkTab('accounts'); }
  catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not add it')); }
}
