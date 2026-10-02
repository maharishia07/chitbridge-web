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
  booksPackFile:   { m: 'GET',  p: '/api/books/packs/:id/file' },   /* the zip itself — fetched as bytes (bkPackGet), never through api() */
  booksPackAck:    { m: 'POST', p: '/api/books/packs/:id/ack' },
  booksCheques:    { m: 'GET',  p: '/api/books/cheques' },           /* the cheques still held, each with the steps it may take next */
  booksChequeStep: { m: 'POST', p: '/api/books/cheques/:id/status' },
  booksRetry:      { m: 'POST', p: '/api/books/outbox/retry' },
}); }

/**
 * ⚠️⚠️ ONE TAP, ONE RECORD (2026-09-30, review M11). Two taps on Next recorded two payments; opening balances pressed
 * twice doubled every balance. Two halves, both needed:
 *   · bkOnce — the button is dead while its call is out, and a second call with the same key is dropped
 *   · bkRef  — every form that records money carries ONE client_ref from the moment it opens: sent again on a retry
 *              (so the server answers with what it already kept), replaced only after the server said yes
 */
var BK_BUSY = {};
async function bkOnce(key, btn, fn) {
  if (BK_BUSY[key]) return;
  BK_BUSY[key] = true;
  if (btn) btn.disabled = true;
  try { return await fn(); }
  finally { delete BK_BUSY[key]; if (btn && btn.isConnected) btn.disabled = false; }
}
function bkRef() {
  var r = '';
  try { var a = new Uint8Array(8); crypto.getRandomValues(a); r = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  catch (_) { r = Math.floor(Math.random() * 1e12).toString(16); }
  return 'web-' + Date.now().toString(36) + '-' + r;
}

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
    /* the strip's chips: .optchip is inline-flex, which swallows the whitespace between its text and the figure */
    '.bkchip{gap:4px}',
    /* the day's to-do: one card per line on a narrow pane (flex-basis folds them at ~620px), tappable, phone first */
    '.bktodo{flex:1 1 240px;min-width:0;display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:10px 12px;font-size:var(--fs-2);font-weight:600;cursor:pointer;text-align:start;color:inherit}',
    '.bktodo b{font-variant-numeric:tabular-nums;font-size:var(--fs-3);color:var(--warn-2)}',
    '.bktodo .bkgo{margin-inline-start:auto;color:var(--grey)}',
    /* the Day book's toolbar: the Day / Week / Month switch beside list-ctl's search · filters · sort. The ROWS are the Task table (list-ctl.js tbl*) — nothing here draws a row. */
    '.bkdv-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}',
    '.bkdv-segs{display:inline-flex;gap:0}',
    '.bkdv-seg[aria-pressed=true]{background:var(--blue-tint);color:var(--blue-d);border-color:var(--blue-d);font-weight:700}',
    '.bkdv-count{color:var(--grey);font-size:var(--fs-1);margin:6px 0}',
    /* the Ledgers' tree + entries: foldersScreen's two panes (cap-folders.js _folderPanes); on a narrow pane the tree IS the way in and a chosen ledger replaces it, with a way back (cb-design: a container query, not the window's) */
    '#bk_lt{container:lt/inline-size;min-height:0;--ftw:250px}',
    '.lt-crumb{display:none}',
    '@container lt (max-width:620px){.lt-tree{--ftw:100%}#bk_lt.has-sel .lt-tree{display:none}#bk_lt:not(.has-sel) .lt-pane{display:none}#bk_lt.has-sel .lt-crumb{display:flex;margin-bottom:6px}}',
    /* on a phone the tapped view covers the rail — the way back must be visible (cb-design: .dback is desktop-hidden) */
    '#bk_back{display:none}',
    '.appwrap.m .panel.showdetail #bk_back{display:block;padding:10px 13px 0}',
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
/** the /dues answer becomes the party map (party_id → no · name · balance) every screen reads — one place stores it */
function bkDuesStore(r) {
  BK.dues = {}; BK.duesCur = (r && r.currency) || null; BK.duesAt = Date.now();
  ((r && r.parties) || []).forEach(function (p) { BK.dues[p.party_id] = p; });
  return BK.dues;
}
/** ⭐ A ROW NAMES ITS PARTY (Athi, 2026-10-02): "P-0007 · Chola Auto Care" from the dues map; the name alone if there is no number; never the bare id */
function bkPartyLabel(partyId, fallbackName) {
  var d = partyId && BK.dues && BK.dues[partyId];
  var name = (d && d.name) || fallbackName || '', no = d && d.party_no;
  return no && name ? no + ' · ' + name : (name || no || '');
}
/** ⭐ ONE READ for every row's chip: /dues answers all parties at once (stored balances, not a scan) */
async function booksDuesLoad(force) {
  if (!force && BK.dues && Date.now() - BK.duesAt < 30000) return BK.dues;
  try {
    bkDuesStore(await api('booksDues', { query: { asOf: bkToday() } }));
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
/**
 * ⭐ WHERE AN ENTRY CAME FROM (Athi, 2026-10-01, the first real entry: "where is it referenced to the sale record, how do I
 * connect to the sale record, who has done it?"). The server's `source` (routes/books.js sourceOf) becomes the parts after
 * the entry's word: "Bill C2/26-27/0002 · Counter C2 · Athi" — the number is a link that opens the chit; a walk-in day
 * reads "12 bills · Counter C2". A part the server did not know is left out, never guessed. No source → ''.
 */
/** a long payment reference, readable: its first and last four (4421…9931) — the full one is on the chit */
function bkShortRef(r) { var t = String(r == null ? '' : r).trim(); return t.length > 10 ? t.slice(0, 4) + '…' + t.slice(-4) : t; }
var BK_SRC_WORD = { bill: 'Bill', purchase: 'Bill', receipt: 'Receipt', payment: 'Payment', credit_note: 'Credit note', expense: 'Expense', income: 'Income' };
/** the person who serviced it IS the shop itself (an owner, not a counter hand) — the shop's own name, as the session knows it */
function bkIsShopName(n) {
  if (typeof SESSION === 'undefined') return false;
  var shop = SESSION.entity || (SESSION.role === 'entity' ? SESSION.name : '');
  return !!shop && String(n || '').trim() === String(shop).trim();
}
/** the bill's number as a link that opens the chit sheet, with its time — "Bill C2/26-27/0002 12:30" (the word is the caller's) */
function bkBillPart(s, tid) {
  if (!s || !(s.ref || s.chit_id)) return '';
  var no = s.ref ? '<span class="mono">' + esc(s.ref) + '</span>' : esc(tx('Open'));
  var link = s.chit_id ? '<a href="#" data-testid="' + esc(tid) + '" onclick="event.stopPropagation();openChitSheet(\'' + esc(s.chit_id) + '\');return false">' + no + '</a>' : no;
  return link + (s.doc_at ? ' <span data-testid="' + esc(tid) + '-at">' + esc(bkTime(s.doc_at)) + '</span>' : '');
}
/* ⭐ HOW IT WAS PAID (Athi, 2026-10-01: "clearly segregate credit, cash, UPI") — a day: each tender with its amount */
function bkHowPart(s, tid, cur) {
  if (!s) return '';
  if (s.kind === 'day' && s.split && s.split.length) return s.split.map(function (x) { return esc(tx(x.how)) + ' ' + esc(bkMoney(x.amount_minor, cur)); }).join(' · ');
  if (s.how) return '<span data-testid="' + esc(tid) + '-how">' + esc(tx(s.how)) + (s.how_ref ? ' <span class="mono">' + esc(bkShortRef(s.how_ref)) + '</span>' : '') + '</span>';
  return '';
}
/* ⭐ the person who rang it up is NOT the party (2026-10-02: a 1300 row read as if the shop owed itself) — "rung by", and last */
function bkRungPart(s) { return s && s.by ? esc(tx('rung by')) + ' ' + esc(s.by) + (bkIsShopName(s.by) ? ' ' + esc(tx('(owner)')) : '') : ''; }
function bkSourceParts(s, tid, cur) {
  if (!s) return [];
  var out = [];
  if (s.kind === 'day') { if (s.count != null) out.push(esc(txf(s.count === 1 ? '{n} bill' : '{n} bills', { n: s.count }))); }
  else if (s.ref || s.chit_id) out.push((BK_SRC_WORD[s.kind] ? esc(tx(BK_SRC_WORD[s.kind])) + ' ' : '') + bkBillPart(s, tid));
  var how = bkHowPart(s, tid, cur); if (how) out.push(how);
  if (s.counter) out.push(esc(counterWord(s.counter)));
  var rung = bkRungPart(s); if (rung) out.push(rung);
  return out;
}
/** the entry's own word, then its source: "Sale · Bill … · Counter C2 · Athi" — a walk-in day says "Walk-in day" */
function bkEntryHead(e, tid, cur, party) {
  var s = e && e.source;
  var head = s && s.kind === 'day' ? esc(tx('Walk-in day')) : s && s.kind === 'receipt' ? esc(tx('Received')) : esc((e && (e.narration || e.what || e.event_type)) || '');
  return [head].concat(party ? [esc(party)] : [], bkSourceParts(s, tid, cur)).join(' · ') + bkRecordedHTML(e, tid);
}
/** the bill's own time of day, in the shop's zone (CBLocale.time) — "beside the bill number" */
function bkTime(ts) { try { return CBLocale.time(ts) || ''; } catch (_) { return ''; } }
/**
 * ⭐ BOTH TIMES (Athi, 2026-10-01: "the time the bill was made or the time the entry was accepted? both should be there").
 * The row is the bill's (its date, its time beside the number); when the ledger took it on ANOTHER day — a late bill, a
 * buyer's acceptance days after the invoice — "recorded 01 Oct" follows, muted. Same day → nothing more to say.
 */
function bkRecordedHTML(e, tid) {
  if (!e) return '';
  var s = e.source || {}, doc = e.doc_date || null, post = e.posting_date || e.date || null, rec = s.recorded_at || null;
  var day = function (v, o) { try { return CBLocale.date(v, o); } catch (_) { return String(v).slice(0, 10); } };
  var late = (doc && post && doc !== post) || (doc && rec && day(rec) !== day(doc));
  if (!late) return '';
  return ' <span data-testid="' + esc(tid) + '-rec" style="color:var(--grey);font-weight:400">' + esc(txf('recorded {date}', { date: day(rec || post, { day: '2-digit', month: 'short' }) })) + '</span>';
}
/** opening · each movement with its running balance · closing — the shape every statement has */
function statementHTML(r, partyId) {
  var c = r && r.currency;
  var rows = ((r && r.lines) || []).map(function (l, i) {
    return '<tr' + (l.source_chit_id ? ' style="cursor:pointer" onclick="openChitSheet(\'' + esc(l.source_chit_id) + '\')"' : '') + '><td>' + esc(bkDate(l.date)) + '</td><td data-testid="stmt-what-' + i + '">' + bkEntryHead(l, 'stmt-src-' + i, c, bkPartyLabel(l.party_id || partyId || (r && r.party_id), l.party_name)) + (l.ref ? ' <span class="mono">' + esc(l.ref) + '</span>' : '') + '</td>'
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
  PAY = { kind: kind, partyId: partyId, name: r.nickname || r.display_name || '', ref: bkRef() };   /* one ref per opened form */
  modal('<div class="mhd"><div class="t">' + esc(kind === 'supplier' ? tx('Pay') : tx('Receive')) + ' · ' + esc(PAY.name) + '</div></div><div class="mbody" id="pay_body" style="display:flex;flex-direction:column;gap:8px">'
    + '<label>' + tx('Amount') + '<input class="inp" id="pay_amt" data-testid="pay_amt" inputmode="decimal" style="width:100%"></label>'
    + '<label>' + tx('How') + '<select class="inp" id="pay_mode" data-testid="pay_mode" onchange="payModePaint()"><option value="cash">' + tx('Cash') + '</option><option value="upi">UPI</option><option value="bank">' + tx('Bank') + '</option><option value="card">' + tx('Card') + '</option><option value="cheque">' + tx('Cheque') + '</option></select></label>'
    + '<label>' + tx('Reference') + '<input class="inp" id="pay_ref" data-testid="pay_ref" style="width:100%"></label>'
    + '<div id="pay_chq" hidden style="display:flex;gap:6px"><input class="inp" id="pay_chqno" data-testid="pay_chqno" placeholder="' + esc(tx('Cheque no')) + '"><input class="inp" id="pay_bank" placeholder="' + esc(tx('Bank')) + '"><input class="inp" id="pay_chqdate" type="date"></div>'
    + '<div id="pay_why" data-testid="pay_why" style="color:var(--warn-2);font-size:var(--fs-1)"></div>'
    + '</div><div class="mfoot" id="pay_foot"><button onclick="closeModal()">' + tx('Cancel') + '</button><button class="pri" data-testid="pay_record" onclick="payRecord()">' + tx('Next') + '</button></div>');
}
function payModePaint() { var c = document.getElementById('pay_chq'); if (c) c.hidden = (document.getElementById('pay_mode') || {}).value !== 'cheque'; }
function payRecord() {
  /* ⚠️ M11: the button is dead while the call is out; a payment already recorded is never recorded again — a second
     press after the record only asks for the proposal; and every attempt from this form carries the SAME client_ref */
  return bkOnce('pay', document.querySelector('[data-testid="pay_record"]'), async function () {
    var why = document.getElementById('pay_why');
    try {
      if (!PAY.id) {
        var amt = bkToMinor((document.getElementById('pay_amt') || {}).value);
        if (!(amt > 0)) { if (why) why.textContent = tx('Type the amount'); return; }
        var mode = (document.getElementById('pay_mode') || {}).value;
        var body = { party_id: PAY.partyId, direction: PAY.kind === 'supplier' ? 'out' : 'in', amount_minor: amt, currency: bkCur(),
          mode: mode, reference: (document.getElementById('pay_ref') || {}).value || null, received_at: new Date().toISOString(),
          cheque: mode === 'cheque' ? { number: (document.getElementById('pay_chqno') || {}).value || null, bank: (document.getElementById('pay_bank') || {}).value || null, date: (document.getElementById('pay_chqdate') || {}).value || null } : null,
          client_ref: PAY.ref };
        var r = await api('booksPayRecord', { body: body });
        PAY.id = r && r.payment && r.payment.payment_id; PAY.amount = amt;
        /* ⭐ C3: a cheque counts on CLEARING — nothing to match yet, and it says so; its steps are offered right here */
        if (r && r.payment && r.payment.status === 'cheque_received') {
          bkChequeKeep({ payment_id: PAY.id, party_id: PAY.partyId, name: PAY.name, amount_minor: amt, cheque_no: body.cheque.number, cheque_bank: body.cheque.bank, cheque_date: body.cheque.date, status: 'received' });
          PAY.cheque = true;
          document.getElementById('pay_body').innerHTML = '<p data-testid="pay_cheque_note">' + tx('Counts against bills when the cheque clears') + '</p>'
            + '<div id="pay_chq_steps" data-testid="pay_chq_steps">' + bkChequeStepsHTML(BK.cheques[PAY.id]) + '</div><div id="chq_out" data-testid="chq_out" style="color:var(--warn-2);font-size:var(--fs-1)"></div>';
          document.getElementById('pay_foot').innerHTML = '<button class="pri" onclick="closeModal();booksAfterPay()">' + tx('Done') + '</button>';
          return;
        }
      }
      if (PAY.cheque) return;
      var p = await api('booksPayPropose', { params: { id: PAY.id } });
      PAY.proposal = p;
      payProposalPaint();
    } catch (e) { if (why) why.textContent = bkWhy(e, tx('Could not record it')); }
  });
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
  await bkOnce('payconfirm', document.querySelector('[data-testid="pay_confirm"]'), async function () {
    try {
      await api('booksPayConfirm', { params: { id: PAY.id }, body: { allocations: a.filter(function (x) { return x.amount_minor > 0; }).map(function (x) { return { against_ref: x.against_ref, amount_minor: x.amount_minor }; }) } });
      closeModal(); toast(tx('Saved')); booksAfterPay();
    } catch (e) { if (why) why.textContent = bkWhy(e, tx('Could not confirm')); }
  });
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
  ['bs', '🏛️', 'Balance sheet'], ['dues', '⏳', 'Dues'], ['cheques', '🧾', 'Cheques'], ['waiting', '🕗', 'Waiting'],
  ['lock', '🔒', 'Month lock'], ['packs', '📦', 'Packs'],
  ['opening', '📥', 'Opening balances'], ['accounts', '🗂️', 'Shop ledgers'],
];
function ledgerScreen() {
  var list = '<div class="list"><div class="lh"><div style="font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-3)">📒 ' + tx('Ledger') + '</div></div><div class="rows" id="bk_tabs">'
    + BK_TABS.map(function (t) { return '<div class="row ' + (BK.tab === t[0] ? 'sel' : '') + '" data-testid="bk-tab-' + t[0] + '" onclick="bkTab(\'' + t[0] + '\')"><div class="main2"><div class="l1"><span class="code">' + t[1] + ' ' + tx(t[2]) + '</span></div></div><div class="rowgo" aria-hidden="true">›</div></div>'; }).join('')
    + '</div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  setTimeout(function () { bkTab(BK.tab, true); if (BK.tab !== 'waiting' && BK.tab !== 'cheques') bkHealthLoad().catch(function () {}); }, 0);   /* the Waiting count, on the list itself */
  return '<div class="panel" id="panel" style="--lw:' + UI.lw + 'px">' + list + divider + '<div class="detail" id="detailpane"><div id="bk_back"><button class="supback" data-testid="bk-back" onclick="bkBack()">‹ ' + tx('Ledger') + '</button></div><div class="db" id="bk_body" data-testid="bk-body">' + tx('Reading…') + '</div></div></div>';
}
function bkBack() { UI.mdetail = false; var p = document.getElementById('panel'); if (p) p.classList.remove('showdetail'); }
function bkTab(t, silent) {
  BK.tab = t;
  /* ⭐ a host page that is not the app's Ledger screen (accounts.html — CB Accounts) paints its own chrome and may own a view:
     BK.onTab(t) is told which tab opened, BK.views[t] replaces a view's painter. Both are absent in the app, so it is unchanged. */
  if (BK.onTab) BK.onTab(t);
  /* on a phone the tapped view replaces the rail (the way selectCust does it — cap-admin's helper may not be loaded) */
  if (!silent && UI.vp === 'mob') { UI.mdetail = true; var pn = document.getElementById('panel'); if (pn) pn.classList.add('showdetail'); }
  var tabs = document.getElementById('bk_tabs');
  if (tabs) Array.prototype.forEach.call(tabs.children, function (el) { el.classList.toggle('sel', el.getAttribute('data-testid') === 'bk-tab-' + t); });
  var body = document.getElementById('bk_body'); if (!body) return;
  body.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + tx('Reading…') + '</div>';
  var f = (BK.views && BK.views[t]) || { daybook: bkDaybook, ledgers: bkLedgers, tb: bkTB, pl: bkPL, bs: bkBS, dues: bkDues, cheques: bkChequesView, waiting: bkWaitingView, lock: bkLockView, packs: bkPacks, opening: bkOpeningView, accounts: bkAccounts }[t];
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
/**
 * ══ THE LEDGER'S LISTS ARE THE TASK TABLE ═══════════════════════════════════════════════════════════════════════════
 * Athi, 2026-10-02: *"the same task header style has to be used in other places … if you expand the header show the next
 * level of information"*. Waiting, the Day book, Dues and the ledgers are drawn by list-ctl.js's `tbl*` (the code the Task
 * list is drawn by) and controlled by its `listCtl*` (search · filters · sort · count · lazy rows). THIS file declares each
 * list's columns and says what a row's next level holds; it draws no row, card or expander of its own (e2e/books-web-breaks).
 */
var BK_OPEN = {};   /* 'list:id' → its next level is open */
function bkIsOpen(list, id) { return !!BK_OPEN[list + ':' + id]; }
function bkRepaint(list) { var c = listCtlS(list).cfg; if (c && c.repaint) c.repaint(); }
function bkToggle(list, id) { var k = list + ':' + id; if (BK_OPEN[k]) delete BK_OPEN[k]; else BK_OPEN[k] = true; bkRepaint(list); }
/** the caret of a row — Task's Group sum draws ▸ / ▾ the same way (tblCaretHTML) */
function bkCaret(list, id) {
  var open = bkIsOpen(list, id);
  return '<span role="button" aria-label="' + esc(tx(open ? 'Collapse' : 'Expand')) + '" aria-expanded="' + open + '" style="cursor:pointer;display:inline-block;width:14px;color:var(--grey)" onclick="event.stopPropagation();bkToggle(\'' + list + '\',\'' + esc(id) + '\')">' + tblCaretHTML(open) + '</span>';
}
/** a money figure the server holds in MAJOR units (a chit's frozen total) — through the same formatter the chit sheet uses */
function bkMajor(n, cur) {
  if (n == null || n === '' || isNaN(Number(n))) return '';
  try { return fmtMoney(Number(n), cur || bkCur()); } catch (_) { return bkMoney(Math.round(Number(n) * Math.pow(10, bkDec(cur))), cur); }
}
/** the pane's width for fitting columns: a card per row (no fitting) below 560px, else what the box holds */
function bkAvail(id) { var el = document.getElementById(id) || document.getElementById('bk_body'); var w = el ? el.clientWidth : 900; return w <= 560 ? 9999 : w - 24; }
/** a declared list's markup: its controls, its count, and the box its table is painted into (bkListPaint) */
function bkListHTML(key, extra) {
  return listCtlToolbarHTML(key) + (extra || '') + '<div class="bkdv-count" id="bkc_' + key + '" data-testid="' + key + '-count"></div><div id="bkl_' + key + '" data-testid="' + key + '-list"></div>';
}
function bkListPaint(key) {
  var c = listCtlS(key).cfg, box = document.getElementById('bkl_' + key); if (!c || !box) return;
  box.innerHTML = c.paint();
  var n = document.getElementById('bkc_' + key); if (n) n.innerHTML = listCtlCountHTML(key);
}
/** declare a list once: the screen's rows, text, sorts, filters, and `paint()` (its table); the repaint is the same for all */
function bkDeclare(key, cfg) {
  cfg.repaint = cfg.repaint || function () { bkListPaint(key); };
  return listCtl(key, cfg);
}
/* a table's fitted columns, its header and its hover peek (the peek shows every column, the fitted ones and the folded) */
var BK_PEEK = {};
function bkFit(key, cols, prio, boxId) { BK_PEEK[key] = { cols: cols, by: {} }; return tblFit(cols, bkAvail(boxId), prio || cols.map(function (c) { return c.key; })); }
function bkHead(key, fit) {
  var s = listCtlS(key), sorts = (s.cfg && s.cfg.sorts) || [], cur = sorts[s.sort] || sorts[0] || {};
  return tblHeaderHTML(fit, { sort: cur.key, dir: s.rev ? 'desc' : 'asc', onSort: 'tblSortBy', arg: key });
}
function bkPeek(ev, key, id) { var p = BK_PEEK[key], row = p && p.by[id]; if (p && row) tblPeekShow(ev, p.cols, row); }
/** one row of list `key`: the Task row, its hover peek, and (open) its next level under it */
function bkRow(key, fit, row, id, o, next) {
  o = o || {}; BK_PEEK[key].by[id] = row;
  return tblRowHTML(fit, row, { cls: o.cls, tid: o.tid, labels: true, click: o.click,
    attrs: ' data-id="' + esc(id) + '" onmouseenter="bkPeek(event,\'' + key + '\',\'' + esc(id) + '\')" onmouseleave="tblPeekHide()"' + (o.attrs || '') })
    + (bkIsOpen(key, id) && next ? (typeof next === 'function' ? next() : next) : '');
}

/**
 * ⭐ THE DAY'S STRIP (Athi, 2026-10-01: "in the daybook, you should be able to see the total sale in different
 * counters, sellers' pending invoices and so on, so you can act one by one"). ONE function adds up the day's sales;
 * the per-counter row and the by-tender row both read ITS answer — never the entries a second way. A walk-in day
 * entry counts `source.count` bills with its `split`; a per-bill entry counts 1 with its `how` and the entry's own
 * total (the server's lines, summed once — not a second opinion, the same figure the entry already shows).
 */
function bkDaySales(entries, day) {
  var counters = {}, tenders = {}, corder = [], torder = [], hasDay = false;
  (entries || []).forEach(function (e) {
    if (day && String(e.posting_date || '').slice(0, 10) !== day) return;
    var s = e.source; if (!s) return;
    if (s.kind === 'day') hasDay = true;                      /* the counter closed its day — walk-ins are in */
    if (s.kind !== 'day' && s.kind !== 'bill') return;        /* sales only: a bill, or a walk-in day */
    var total = s.kind === 'day'
      ? (s.split || []).reduce(function (a, x) { return a + Number(x.amount_minor || 0); }, 0)
      : (e.lines || []).reduce(function (a, l) { return a + Number(l.dr_minor || 0); }, 0);
    var bills = s.kind === 'day' ? Number(s.count || 0) : 1;
    var c = s.counter || '—';
    if (!counters[c]) { counters[c] = { counter: c, amount_minor: 0, bills: 0 }; corder.push(c); }
    counters[c].amount_minor += total; counters[c].bills += bills;
    var add = function (how, amt) { if (!tenders[how]) { tenders[how] = { how: how, amount_minor: 0 }; torder.push(how); } tenders[how].amount_minor += amt; };
    if (s.kind === 'day') (s.split || []).forEach(function (x) { add(x.how, Number(x.amount_minor || 0)); });
    else if (s.how) add(s.how, total);
  });
  corder.sort();
  return { counters: corder.map(function (k) { return counters[k]; }), tenders: torder.map(function (k) { return tenders[k]; }), day_closed: hasDay };
}
function bkStripHTML(r, day) {
  var c = r && r.currency;
  var t = bkDaySales((r && r.entries) || [], day);
  var row1 = t.counters.map(function (x) {
    return '<span class="optchip bkchip" data-testid="strip-counter-' + esc(x.counter) + '">' + esc(x.counter) + ' <b>' + esc(bkMoney(x.amount_minor, c)) + '</b> · ' + esc(txf(x.bills === 1 ? '{n} bill' : '{n} bills', { n: x.bills })) + '</span>';
  }).join('');
  var row2 = t.tenders.map(function (x) {
    return '<span class="optchip bkchip" data-testid="strip-tender-' + esc(x.how) + '">' + esc(tx(x.how)) + ' <b>' + esc(bkMoney(x.amount_minor, c)) + '</b></span>';
  }).join('');
  /* ⚠️ walk-in cash/UPI/card reach the Day book only at day close — no walk-in day entry for this day means the
     strip is not the whole day yet, and says so, muted (the counter holds the fix; this screen cannot close a day) */
  var note = t.day_closed ? '' : '<div data-testid="strip-noclose" style="color:var(--grey);font-size:var(--fs-1)">' + tx('Walk-ins not closed yet — close the day on the counter') + '</div>';
  if (!row1 && !note) return '';
  return '<div id="bk_strip" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">'
    + (row1 ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + row1 + '</div>' : '')
    + (row2 ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + row2 + '</div>' : '')
    + note + '</div>';
}
/**
 * ⭐ THE TO-DO — what waits on you, one line each, a tap away. Only a count above zero earns a row (SYSTEM rule 1);
 * all quiet collapses into one line. Every count is the server's: /health waiting[] (a received supplier bill waits
 * as "Waiting for you to confirm …" — one opens its sheet, several open Waiting; the rest are the ledger's to record), /dues (a
 * customer with any bucket past "Not due"), /cheques (a held cheque with a step still open).
 */
function bkTodoCounts(dues, cheques, health) {
  var waiting = (health && health.waiting) || [];
  var confirm = waiting.filter(function (w) { return /^Waiting for you to confirm/.test(String(w.reason || w.why || '')); });
  var overdue = ((dues && dues.parties) || []).filter(function (p) {
    if (bkDuesSide(p) !== 'rcv') return false;
    var b = p.buckets || {};
    return Object.keys(b).some(function (k) { return k !== 'not_due' && Number(b[k] || 0); });
  });
  var chq = ((cheques && cheques.cheques) || []).filter(function (x) { return bkChequeNext({ status: bkChequeStatus(x.status), next: Array.isArray(x.next) ? x.next : null }).length > 0; });
  return { accept: confirm.length, acceptIds: confirm.map(function (w) { return w.chit_id; }).filter(Boolean), overdue: overdue.length, cheques: chq.length, waiting: waiting.length - confirm.length };
}
function bkTodoHTML(n) {
  var card = function (tid, count, label, go) {
    return '<button class="bktodo" data-testid="' + tid + '" onclick="' + go + '"><b>' + count + '</b> ' + esc(label) + '<span class="bkgo" aria-hidden="true">›</span></button>';
  };
  var items = [];
  if (n.accept) items.push(card('todo-accept', n.accept, tx(n.accept === 1 ? 'supplier bill to accept' : 'supplier bills to accept'),
    /* one bill → its sheet over the Day book; several → the Waiting list, whose rows open the sheet. Never Intake. */
    (n.accept === 1 && (n.acceptIds || []).length === 1) ? "openChitSheet('" + esc(n.acceptIds[0]) + "')" : "bkTab('waiting')"));
  if (n.overdue) items.push(card('todo-overdue', n.overdue, tx(n.overdue === 1 ? 'customer overdue' : 'customers overdue'), "bkTab('dues')"));
  if (n.cheques) items.push(card('todo-cheques', n.cheques, tx(n.cheques === 1 ? 'cheque to deposit / clear' : 'cheques to deposit / clear'), "bkTab('cheques')"));
  if (n.waiting) items.push(card('todo-waiting', n.waiting, tx('waiting to be recorded'), "bkTab('waiting')"));
  if (!items.length) return '<div data-testid="todo-none" style="color:var(--grey);font-size:var(--fs-1);margin-bottom:10px">' + tx('Nothing waiting on you') + '</div>';
  return '<div id="bk_todo" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px">' + items.join('') + '</div>';
}
/**
 * ⭐ THE DAY BOOK, THE WAY A DAY BOOK READS (Athi, 2026-10-01: "expand all, collapse all, search, filter, daily view,
 * weekly view … do we need these many lines per sale? … the gist can be showcased as a summary."). ONE row per entry,
 * its GIST under it — the entry's own lines merged by ledger (GST = 2200–2212 together), each figure a sum of those
 * lines, never recomputed — and the rate-wise lines on a tap. Search, chips, Day / Week / Month heads and the CSV all
 * read the SAME shown list (bkDvShown); nothing here adds to a figure the server did not send.
 */
var BK_KINDS = ['Sales', 'Receipts', 'Purchases', 'Payments', 'Expenses', 'Returns', 'Other'];
function bkDvKind(e) {
  var t = String((e && e.event_type) || ''), k = String((e && e.source && e.source.kind) || '');
  if (/return|credit_note|debit_note/.test(t) || k === 'credit_note') return 'Returns';
  if (/purchase/.test(t)) return 'Purchases';
  if (/expense/.test(t) || k === 'expense') return 'Expenses';
  if (k === 'day' || /sale|walkin/.test(t)) return 'Sales';
  if (/received|receipt/.test(t) || k === 'receipt') return 'Receipts';
  if (/payment/.test(t) || k === 'payment') return 'Payments';
  return k === 'bill' ? 'Sales' : 'Other';
}
/** the same-ledger lines merged, credit side first (Sales · GST · Debtors); GST = the 2200–2212 lines together */
function bkDvGist(e) {
  var m = {}, order = [];
  ((e && e.lines) || []).forEach(function (l) {
    var gst = /^22(0\d|1[0-2])$/.test(String(l.code)), key = gst ? 'GST' : String(l.code);
    if (!m[key]) { m[key] = { name: gst ? 'GST' : l.name, amt: 0, cr: 0 }; order.push(key); }
    m[key].amt += Number(l.dr_minor || 0) + Number(l.cr_minor || 0);
    m[key].cr += Number(l.cr_minor || 0) - Number(l.dr_minor || 0);
  });
  var all = order.map(function (k) { return m[k]; });
  return all.filter(function (x) { return x.cr > 0; }).concat(all.filter(function (x) { return x.cr <= 0; }));
}
function bkDvTotal(e) { return ((e && e.lines) || []).reduce(function (a, l) { return a + Number(l.dr_minor || 0); }, 0); }
function bkDvParty(e) { var l = ((e && e.lines) || []).filter(function (x) { return x.party_name || x.party_id; })[0]; return l ? bkPartyLabel(l.party_id, l.party_name) : ''; }
function bkDvTenders(e) {
  var s = e && e.source; if (!s) return [];
  if (s.kind === 'day' && s.split && s.split.length) return s.split.map(function (x) { return x.how; });
  return s.how ? [s.how] : [];
}
/** the chips' four questions, and what each entry answers to them */
var BK_DV_DIMS = [['kind', 'Kind'], ['how', 'Tender'], ['counter', 'Counter'], ['by', 'Person']];
function bkDvVals(e, dim) {
  var s = (e && e.source) || {};
  if (dim === 'kind') return [bkDvKind(e)];
  if (dim === 'how') return bkDvTenders(e);
  return s[dim] ? [s[dim]] : [];
}
function bkDvFmt(day, o) { try { return CBLocale.date(day, o); } catch (_) { return String(day).slice(0, 10); } }
/** Day = the date · Week = Mon–Sun with the ISO week number · Month = its name */
function bkDvGroupOf(date, mode) {
  var day = String(date || '').slice(0, 10), t = new Date(day + 'T00:00:00Z');
  if (mode === 'month') return { key: day.slice(0, 7), label: bkDvFmt(day, { month: 'long', year: 'numeric' }) };
  if (mode === 'week') {
    var mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 864e5), thu = new Date(mon.getTime() + 3 * 864e5), sun = new Date(mon.getTime() + 6 * 864e5);
    var wk = Math.ceil(((thu - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7), iso = function (x) { return x.toISOString().slice(0, 10); }, o = { day: '2-digit', month: 'short' };
    return { key: iso(mon), label: txf('Week {n}', { n: wk }) + ' · ' + bkDvFmt(iso(mon), o) + ' – ' + bkDvFmt(iso(sun), o) };
  }
  return { key: day, label: bkDvFmt(day, { weekday: 'short', day: '2-digit', month: 'short' }) };
}
function bkDvGroups(list, mode) {
  var out = [], by = {};
  list.forEach(function (e) {
    var g = bkDvGroupOf(e.posting_date, mode);
    if (!by[g.key]) { by[g.key] = { key: g.key, label: g.label, entries: [] }; out.push(by[g.key]); }
    by[g.key].entries.push(e);
  });
  return out;
}
/** the shown rows as a CSV — client-side, one line per row; a cell that starts like a formula is quoted as text */
function bkDvCsv(list, c) {
  var pow = Math.pow(10, bkDec(c)), amt = function (m) { return (Number(m || 0) / pow).toFixed(bkDec(c)); };
  var cell = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var rows = [['date', 'no', 'kind', 'party', 'ref', 'how', 'counter', 'by', 'dr', 'cr', 'gist']];
  list.forEach(function (e) {
    var s = e.source || {}, cr = (e.lines || []).reduce(function (a, l) { return a + Number(l.cr_minor || 0); }, 0);
    rows.push([String(e.posting_date).slice(0, 10), e.entry_no, bkDvKind(e), bkDvParty(e), s.ref || '', bkDvTenders(e).join(' · '), s.counter || '', s.by || '',
      '#' + amt(bkDvTotal(e)), '#' + amt(cr), bkDvGist(e).map(function (x) { return x.name + ' ' + amt(x.amt); }).join('; ')]);
  });
  return rows.map(function (r, i) { return r.map(function (v) { return i && typeof v === 'string' && v.charAt(0) === '#' ? v.slice(1) : cell(v); }).join(','); }).join('\r\n') + '\r\n';
}
function bkDvDownload() {
  var d = BK.dv; if (!d) return;
  var blob = new Blob(['﻿' + bkDvCsv(bkDvShown(), d.r.currency)], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'day-book-' + d.range.from + '-' + d.range.to + '.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
/** what the search looks in: the entry, its bill, its party (by name AND by number — "P0007"), its lines, and its amounts the way they are read */
function bkDvText(e, c) {
  var tot = bkDvTotal(e), pow = Math.pow(10, bkDec(c));
  return [e.entry_no, e.source && e.source.ref, e.narration, bkDvParty(e), bkDvKind(e)].concat((e.lines || []).map(function (l) { return [l.name, l.party_name, bkPartyLabel(l.party_id, l.party_name)].join(' '); }),
    [(tot / pow).toFixed(bkDec(c)), String(Math.floor(tot / pow)), bkMoney(tot, c)], bkDvGist(e).map(function (x) { return (x.amt / pow).toFixed(bkDec(c)); })).join(' ');
}
function bkDvShown() { return listCtlView('daybook').matched; }
/** the group row's words: how many entries, Dr, Cr, Sales and each tender — every figure a sum of the server's own lines */
function bkDvGroupSummary(g, c) {
  var dr = 0, cr = 0, sales = 0;
  g.entries.forEach(function (e) {
    (e.lines || []).forEach(function (l) { dr += Number(l.dr_minor || 0); cr += Number(l.cr_minor || 0); });
    if (bkDvKind(e) === 'Sales') (e.lines || []).forEach(function (l) { if (/^4/.test(String(l.code))) sales += Number(l.cr_minor || 0) - Number(l.dr_minor || 0); });
  });
  var tn = bkDaySales(g.entries, null).tenders;
  var parts = [esc(txf(g.entries.length === 1 ? '{n} entry' : '{n} entries', { n: g.entries.length })), esc(tx('Dr')) + ' ' + esc(bkMoney(dr, c)), esc(tx('Cr')) + ' ' + esc(bkMoney(cr, c))];
  if (sales) parts.push(esc(tx('Sales')) + ' ' + esc(bkMoney(sales, c)));
  tn.forEach(function (x) { parts.push(esc(tx(x.how)) + ' ' + esc(bkMoney(x.amount_minor, c))); });
  return parts.join(' · ');
}
/** Day / Week / Month heads are the Task table's group rows: one row across, a caret, the group's name and its sums */
function bkDvGroupRow(g, c) {
  var shut = BK.dv.gcol[g.key];
  return tblRowHTML([{ key: 'g', label: '', w: '1fr', cell: function () {
      return '<span aria-hidden="true" style="display:inline-block;width:14px;color:var(--grey)">' + (shut ? '▸' : '▾') + '</span><b>' + esc(g.label) + '</b> · <span data-testid="db-gsum-' + esc(g.key) + '" style="white-space:normal">' + bkDvGroupSummary(g, c) + '</span>'; } }],
    g, { tpl: '1fr', click: "bkDvGroupToggle('" + esc(g.key) + "')", tid: 'db-ghead-' + g.key,
      attrs: ' role="button" tabindex="0" aria-expanded="' + (shut ? 'false' : 'true') + '" data-g="' + esc(g.key) + '"' });
}
function bkDvGroupToggle(k) { if (!BK.dv) return; BK.dv.gcol[k] = !BK.dv.gcol[k]; bkDvPaint(); }
/** what the Day book says about an entry — one fact a column (Athi, 2026-10-02: date · entry no · kind · party · bill · tender · counter · amount) */
function bkDvCols(c) {
  var dash = '<span style="color:var(--grey)">—</span>';
  var no = function (e) { return esc(e.entry_no); };
  return [
    { key: 'date', label: tx('Date'), sort: 'date', w: '96px', cell: function (e) { return bkCaret('daybook', e.entry_no) + ' <span class="bkdv-dt">' + esc(bkDvFmt(String(e.posting_date).slice(0, 10), { day: '2-digit', month: 'short' })) + '</span>'; } },
    { key: 'no', label: tx('Entry'), sort: 'no', w: 'minmax(104px,1fr)', cell: function (e) { return '<span class="mono">' + no(e) + '</span>'; } },
    { key: 'kind', label: tx('Kind'), sort: 'kind', w: '88px', cell: function (e) { return esc(tx(bkDvKind(e))); } },
    { key: 'party', label: tx('Party'), sort: 'party', w: 'minmax(130px,1.6fr)', cell: function (e) { return esc(bkDvParty(e)) || dash; } },
    { key: 'bill', label: tx('Bill'), w: 'minmax(140px,1.5fr)', tid: function (e) { return 'db-head-' + e.entry_no; }, cell: function (e) {
        var s = e.source || {}, t = 'db-src-' + e.entry_no;
        if (s.kind === 'day') return esc(tx('Walk-in day')) + (s.count != null ? ' · ' + esc(txf(s.count === 1 ? '{n} bill' : '{n} bills', { n: s.count })) : '');
        if (s.ref || s.chit_id) return bkBillPart(s, t) + bkRecordedHTML(e, t);
        return esc(s.kind === 'receipt' ? tx('Received') : (e.narration || e.what || e.event_type || '')) + bkRecordedHTML(e, t) || dash;
      } },
    { key: 'how', label: tx('Tender'), w: 'minmax(90px,1fr)', cell: function (e) { return bkHowPart(e.source, 'db-src-' + e.entry_no, c) || dash; } },
    { key: 'counter', label: tx('Counter'), w: 'minmax(130px,1.5fr)', cell: function (e) {
        var s = e.source || {}, cw = s.counter ? esc(counterWord(s.counter)) : '', by = bkRungPart(s);
        /* the cashier and the counter are NOT the party: secondary text, never in the Party column */
        return (cw + (cw && by ? ' · ' : '') + (by ? '<span style="color:var(--grey)">' + by + '</span>' : '')) || dash; } },
    { key: 'amount', label: tx('Amount'), sort: 'amount', align: 'right', w: '112px', cell: function (e) { return '<b data-testid="db-total-' + no(e) + '">' + esc(bkMoney(bkDvTotal(e), c)) + '</b>'; } },
  ];
}
/** its next level: the gist (the lines merged by ledger), then the Dr/Cr lines — each tax and sales line with its rate, as the line carries it */
function bkDvNext(e, c) {
  var no = esc(e.entry_no);
  var gist = bkDvGist(e).map(function (x) { return esc(x.name) + ' ' + esc(bkMoney(x.amt, c)); }).join(' · ');
  /* ⭐ THE RATE (Athi, 2026-10-02): "Output CGST 6%", "Sales @12%" — as the line (the frozen invoice's) carries it, never worked out here */
  var rate = function (l) { var r = l.rate != null ? l.rate : l.rate_pct; return r != null && r !== '' && !/%/.test(String(l.name)) ? (/^4/.test(String(l.code)) ? ' @' : ' ') + esc(String(r)) + '%' : ''; };
  var grey = 'color:var(--grey);font-size:var(--fs-1);text-transform:uppercase';
  return tblNextHTML('<div data-testid="db-gist-' + no + '" style="color:var(--grey);font-size:var(--fs-1);padding:2px 0 4px">' + gist + '</div>'
    + '<div style="' + grey + '">' + tblNextRow([esc(tx('Code')) + ' · ' + esc(tx('Ledger')), esc(tx('Debit')), esc(tx('Credit'))], [110, 110]) + '</div>'
    + (e.lines || []).map(function (l) {
        return tblNextRow(['<span class="mono">' + esc(l.code) + '</span> ' + esc(l.name) + rate(l) + (l.party_name ? ' · ' + esc(bkPartyLabel(l.party_id, l.party_name)) : ''),
          l.dr_minor ? esc(bkMoney(l.dr_minor, c)) : '', l.cr_minor ? esc(bkMoney(l.cr_minor, c)) : ''], [110, 110]);
      }).join(''), 'db-lines-' + no);
}
function bkDvPaint() {
  var box = document.getElementById('bk_dvlist'); if (!box || !BK.dv) return;
  var d = BK.dv, c = d.r && d.r.currency, list = bkDvShown(), cols = bkDvCols(c);
  var fit = bkFit('daybook', cols, ['date', 'amount', 'party', 'bill', 'kind', 'no', 'how', 'counter'], 'bk_dvlist'), flat = [];
  bkDvGroups(list, d.group).forEach(function (g) { flat.push({ g: g }); if (!d.gcol[g.key]) g.entries.forEach(function (e) { flat.push({ e: e }); }); });
  box.innerHTML = list.length ? tblWrapHTML(fit, bkHead('daybook', fit) + lazyWrap('daybook', flat, function (it) {
    if (it.g) return bkDvGroupRow(it.g, c);
    var e = it.e;
    return bkRow('daybook', fit, e, e.entry_no, { tid: 'db-entry-' + e.entry_no, cls: d.hl === e.entry_no ? 'sel' : '', click: "bkDvToggle('" + esc(e.entry_no) + "')",
      attrs: ' data-no="' + esc(e.entry_no) + '" aria-expanded="' + bkIsOpen('daybook', e.entry_no) + '"' }, bkDvNext(e, c));
  }, ''), { id: 'bkt_daybook' }) : emptyState('🔍', tx('Nothing matches'), '');
  var n = document.getElementById('bkc_daybook'); if (n) n.innerHTML = listCtlCountHTML('daybook');
  Array.prototype.forEach.call(document.querySelectorAll('[data-testid^="db-group-"]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-testid') === 'db-group-' + d.group)); });
}
function bkDvOpenAll(on) {
  var d = BK.dv; if (!d) return;
  if (on) bkDvShown().forEach(function (e) { BK_OPEN['daybook:' + e.entry_no] = true; }); else Object.keys(BK_OPEN).forEach(function (k) { if (k.indexOf('daybook:') === 0) delete BK_OPEN[k]; });
  bkDvPaint();
}
function bkDvGroupBy(m) { if (!BK.dv) return; BK.dv.group = m; BK.dv.gcol = {}; bkDvPaint(); }
function bkDvToggle(no) { var d = BK.dv; if (!d) return; d.hl = no; bkToggle('daybook', no); }
/* keys: ↑ ↓ move the highlighted row, Enter opens it (its next level); Esc is the sheet's, never swallowed here */
function bkDvOn() { return !!(BK.dv && document.getElementById('bk_dvlist')); }
document.addEventListener('keydown', function (ev) {
  if (!bkDvOn()) return;
  if (ev.key === 'Escape') return;   /* the sheet's own dialog closes on Esc — this screen must not swallow it */
  var typing = /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test((ev.target && ev.target.tagName) || '');
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#bk_dvlist .lrow[data-no]')); if (!rows.length) return;
    var at = rows.map(function (r) { return r.getAttribute('data-no'); }).indexOf(BK.dv.hl);
    at = ev.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
    BK.dv.hl = rows[at].getAttribute('data-no'); ev.preventDefault();
    rows.forEach(function (r, i) { r.classList.toggle('sel', i === at); });
    if (rows[at].scrollIntoView) rows[at].scrollIntoView({ block: 'nearest' });
  } else if (ev.key === 'Enter' && !typing && BK.dv.hl) { ev.preventDefault(); bkDvToggle(BK.dv.hl); }
  else if (ev.key === 'Enter' && ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-g')) { ev.target.click(); }
});
/** declare the Day book's list once per read: its text, its four filters (Kind · Tender · Counter · Person), its sorts */
function bkDvDeclare() {
  var d = BK.dv, c = d.r.currency, ents = d.r.entries || [], st = listCtlS('daybook');
  var filters = BK_DV_DIMS.map(function (x) {
    var seen = [];
    ents.forEach(function (e) { bkDvVals(e, x[0]).forEach(function (v) { if (seen.indexOf(v) < 0) seen.push(v); }); });
    if (x[0] === 'kind') seen.sort(function (a, b) { return BK_KINDS.indexOf(a) - BK_KINDS.indexOf(b); }); else seen.sort();
    if (st.f && st.f[x[0]] && seen.indexOf(st.f[x[0]]) < 0) st.f[x[0]] = '';   /* a choice the new range does not have is dropped, not left hiding everything */
    return { key: x[0], label: tx(x[1]), all: tx(x[1]), match: function (e, v) { return bkDvVals(e, x[0]).indexOf(v) >= 0; },
      options: seen.map(function (v) { return { v: v, label: x[0] === 'counter' ? tx('Counter') + ' ' + v : x[0] === 'by' ? v + (bkIsShopName(v) ? ' ' + tx('(owner)') : '') : tx(v) }; }) };
  });
  var by = function (f, num) { return function (a, b) { var x = f(a), y = f(b); return num ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }); }; };
  bkDeclare('daybook', {
    rows: function () { return d.r.entries || []; }, noun: 'entry', plural: 'entries', repaint: bkDvPaint, filters: filters, text: function (e) { return bkDvText(e, c); },
    sorts: [
      { key: 'rec', label: tx('As recorded'), cmp: function () { return 0; } },
      { key: 'date', label: tx('Date'), cmp: function (a, b) { return String(a.posting_date).localeCompare(String(b.posting_date)) || String(a.entry_no).localeCompare(String(b.entry_no), undefined, { numeric: true }); } },
      { key: 'no', label: tx('Entry'), cmp: by(function (e) { return e.entry_no; }) },
      { key: 'kind', label: tx('Kind'), cmp: by(function (e) { return BK_KINDS.indexOf(bkDvKind(e)); }, true) },
      { key: 'party', label: tx('Party'), cmp: by(function (e) { return bkDvParty(e); }) },
      { key: 'amount', label: tx('Amount'), cmp: by(bkDvTotal, true) },
    ],
  });
}
async function bkDaybook(body) {
  var q = bkRange('db');
  try {
    /* the strip and the to-do read routes that already exist — the day book's own, dues, cheques, health — together */
    var rr = await Promise.all([api('booksDaybook', { query: q }), api('booksDues', { query: { asOf: bkToday() } }), bkChequesLoad(), bkHealthLoad()]);
    var r = rr[0]; bkDuesStore(rr[1]);   /* the same read names each entry's party (bkPartyLabel) */
    var was = BK.dv || {};
    BK.dv = { r: r, range: q, group: was.group || 'day', gcol: {}, hl: null };
    bkDvDeclare();
    var seg = function (m, l) { return '<button type="button" class="bkdv-seg" data-testid="db-group-' + m + '" onclick="bkDvGroupBy(\'' + m + '\')">' + esc(tx(l)) + '</button>'; };
    /* the strip and the to-do sit above the entries; the strip reads the range's LAST day — today, by default */
    body.innerHTML = bkRangeHTML('db', "bkTab('daybook')") + bkStripHTML(r, q.to) + bkTodoHTML(bkTodoCounts(rr[1], rr[2], rr[3]))
      + ((r && r.entries && r.entries.length)
        ? '<div id="bk_dv">' + listCtlToolbarHTML('daybook') + '<div class="bkdv-bar supacts">'
          + '<span class="bkdv-segs" role="group" aria-label="' + esc(tx('Group by')) + '">' + seg('day', 'Day') + seg('week', 'Week') + seg('month', 'Month') + '</span>'
          + '<button type="button" data-testid="db-expand-all" onclick="bkDvOpenAll(true)">' + tx('Expand all') + '</button><button type="button" data-testid="db-collapse-all" onclick="bkDvOpenAll(false)">' + tx('Collapse all') + '</button>'
          + '<button type="button" data-testid="db-csv" onclick="bkDvDownload()">' + tx('Download CSV') + '</button></div>'
          + '<div class="bkdv-count" id="bkc_daybook" data-testid="db-count"></div><div id="bk_dvlist" data-testid="db-list"></div></div>'
        : emptyState('📖', tx('Nothing in these dates'), ''));
    bkDvPaint();
  } catch (e) { body.innerHTML = bkErr(e); }
}

/**
 * ══ THE LEDGERS ARE A FOLDER TREE AND THE TASK TABLE ═══════════════════════════════════════════════════════════════
 * Athi, 2026-10-02 (live): *"i couldn't see the folder for each of the ledger, how do i open the folders, no folder symbol or
 * something to see it as a folder, or a tree structure"*. So: on the left the tree Folders already draws (cap-folders.js
 * `_folderNode` / `_folderPanes` — the same node, the same two panes) — four bands (People · Things you hold · Income and
 * expenses · Your capital) as top folders, their groups (Cash & bank, Duties & taxes …), each ledger a leaf with its balance;
 * Customers (Sundry Debtors) and Suppliers (Sundry Creditors) are FOLDERS whose leaves are the PARTIES — "P0007 · Chola Auto
 * Care", ordered by party no, one balance each from the one /dues read. On the right, the chosen ledger's entries in the
 * Task table (list-ctl.js tbl*): one row an entry, its journal's Dr/Cr lines the next level, a bill number opens the sheet.
 * The classification is by CODE and decided HERE once (accounts.html no longer keeps a second copy); every figure is the server's.
 */
var BK_LT_BANDS = [
  { id: 'people', title: 'People', blurb: 'personal — customers and suppliers' },
  { id: 'things', title: 'Things you hold', blurb: 'real — cash, bank, stock, and what you owe on them' },
  { id: 'income', title: 'Income and expenses', blurb: 'nominal' },
  { id: 'capital', title: 'Your capital', blurb: 'what the owner has put in' },
];
/* [band, group, the codes it takes] — a code none of them claims lands in "Other" of its band, never nowhere */
var BK_LT_GROUPS = [
  ['things', 'Cash & bank', /^1[45]\d\d/], ['things', 'Stock & advances', /^(12|17|24)\d\d/], ['things', 'Duties & taxes', /^22[01]\d/], ['things', 'Taxes & suspense', /^(222|29)\d/],
  ['capital', "Owner's equity", /^3\d\d\d/],
  ['income', 'Income', /^4\d\d\d/], ['income', 'Direct costs', /^5\d\d\d/], ['income', 'Operating expenses', /^6[01]\d\d/], ['income', 'Adjustments', /^6[89]\d\d/],
];
/** the two control accounts open into one ledger per party: which side of /dues each takes, and its words */
var BK_CTRL = { '1300': { side: 'rcv', by: 'By customer', all: 'All customers' }, '2100': { side: 'pay', by: 'By supplier', all: 'All suppliers' } };
BK.lt = { open: {}, sel: null, model: null, bal: null, r: null, day: null };
function bkLtBand(code) {
  var c = String(code == null ? '' : code);
  if (/^(1300|2100)/.test(c)) return 'people';
  if (/^3/.test(c)) return 'capital';
  if (/^[456]/.test(c)) return 'income';
  return 'things';
}
/** the accounts become bands → groups → ledgers. The per-party sub-accounts (1300-P…, 2100-P…) are NOT leaves: a party is read from /dues */
function bkLtModel(accounts) {
  var bands = BK_LT_BANDS.map(function (b) { return { id: b.id, title: b.title, blurb: b.blurb, groups: [], ctrl: [] }; });
  var order = BK_LT_GROUPS.map(function (g) { return g[1]; });
  (accounts || []).filter(function (a) { return !a.is_group && !/^(1300|2100)-/.test(String(a.code)); }).forEach(function (a) {
    var code = String(a.code), bid = bkLtBand(code), band = bands.filter(function (b) { return b.id === bid; })[0];
    if (BK_CTRL[code]) { band.ctrl.push({ code: code, name: String(a.name || '') }); return; }
    var g = BK_LT_GROUPS.filter(function (x) { return x[2].test(code); })[0], title = g ? g[1] : 'Other';
    var grp = band.groups.filter(function (x) { return x.title === title; })[0];
    if (!grp) { grp = { title: title, accts: [] }; band.groups.push(grp); }
    grp.accts.push({ code: code, name: String(a.name || '') });
  });
  bands.forEach(function (b) {
    b.groups.sort(function (x, y) { return (order.indexOf(x.title) + 100 * (x.title === 'Other')) - (order.indexOf(y.title) + 100 * (y.title === 'Other')); });
    b.groups.forEach(function (g) { g.accts.sort(function (x, y) { return String(x.code).localeCompare(String(y.code), 'en', { numeric: true }); }); });
    b.ctrl.sort(function (x, y) { return String(x.code).localeCompare(String(y.code)); });
  });
  return bands;
}
/** ⭐ ONE read of the trial balance gives every ledger's balance — never one read per row */
async function bkBalances() {
  var r = await api('booksTB', { query: { asOf: bkToday() } }), map = {};
  ((r && r.rows) || []).forEach(function (x) { map[String(x.code)] = Number(x.dr_minor || 0) - Number(x.cr_minor || 0); });
  return { map: map, cur: r && r.currency };
}
function bkLtBal(code) {
  var b = BK.lt.bal; if (!b) return '';
  var v = b.map[code];
  if (v === undefined) return '<span data-testid="bal-' + esc(code) + '" title="' + esc(tx('Not on the trial balance')) + '">—</span>';
  return '<span data-testid="bal-' + esc(code) + '">' + esc(bkMoney(Math.abs(v), b.cur)) + (v ? ' <span style="color:var(--grey)">' + (v > 0 ? 'Dr' : 'Cr') + '</span>' : '') + '</span>';
}
/** the parties of a control account, from the one /dues read, ordered by party no (the ledger's key on screen) */
function bkLtParties(ctrl) {
  return Object.keys(BK.dues || {}).map(function (k) { return BK.dues[k]; }).filter(function (p) { return bkDuesSide(p) === BK_CTRL[ctrl].side; })
    .sort(function (a, b) { return String(a.party_no || '').localeCompare(String(b.party_no || ''), undefined, { numeric: true }); });
}
function bkLtOpenQ() { return !!String(listCtlS('ledgers').q || '').trim(); }
function bkLtIsOpen(id) { return bkLtOpenQ() || !!BK.lt.open[id]; }
function bkLtToggle(id) { if (BK.lt.open[id]) delete BK.lt.open[id]; else BK.lt.open[id] = true; bkLtTreePaint(); }
function bkLtTreeHTML() {
  var q = String(listCtlS('ledgers').q || '').trim().toLowerCase(), sel = BK.lt.sel, tall = 'min-height:36px';
  var hit = function () { return !q || Array.prototype.slice.call(arguments).join(' ').toLowerCase().indexOf(q) >= 0; };
  var out = '';
  (BK.lt.model || []).forEach(function (b) {
    var inner = '', n = 0;
    b.ctrl.forEach(function (c) {
      var parties = bkLtParties(c.code).filter(function (p) { return hit(p.party_no, p.name, bkPartyLabel(p.party_id, p.name)); });
      if (q && !hit(c.code, c.name) && !parties.length) return;
      n++;
      var open = bkLtIsOpen('ctrl:' + c.code);
      inner += _folderNode({ depth: 1, tid: 'lg-acc-' + c.code, sel: !!(sel && sel.code === c.code && !sel.party), icon: open ? '📂' : '📁', onclick: "bkLtPickCtrl('" + c.code + "')", style: tall,
        label: esc(c.code) + ' · ' + esc(c.name), tail: bkLtBal(c.code) });
      if (open) inner += parties.map(function (p) {
        var v = Number(p.balance_minor || 0);
        return _folderNode({ depth: 2, tid: 'lg-party-' + p.party_id, sel: !!(sel && sel.party === p.party_id), icon: '📒', onclick: "bkLtPickParty('" + esc(p.party_id) + "','" + c.code + "')", style: tall,
          label: esc(bkPartyLabel(p.party_id, p.name)), tail: v ? esc(bkMoney(Math.abs(v), BK.duesCur)) + ' <span style="color:var(--grey)">' + (v > 0 ? 'Dr' : 'Cr') + '</span>' : esc(tx('settled')) });
      }).join('');
    });
    b.groups.forEach(function (g) {
      var accts = g.accts.filter(function (a) { return hit(a.code, a.name); });
      if (!accts.length) return;
      n += accts.length;
      var gid = 'group:' + b.id + '/' + b.groups.indexOf(g), open = bkLtIsOpen(gid);
      inner += _folderNode({ depth: 1, tid: 'lt-group-' + g.title, icon: open ? '📂' : '📁', onclick: "bkLtToggle('" + gid + "')", style: tall, label: esc(tx(g.title)), tail: String(accts.length) });
      if (open) inner += accts.map(function (a) {
        return _folderNode({ depth: 2, tid: 'lg-acc-' + a.code, sel: !!(sel && sel.code === a.code && !sel.party), icon: '📒', onclick: "bkLtPick('" + a.code + "')", style: tall, label: esc(a.code) + ' · ' + esc(a.name), tail: bkLtBal(a.code) });
      }).join('');
    });
    if (!inner) return;
    var open = bkLtIsOpen('band:' + b.id);
    out += _folderNode({ depth: 0, tid: 'lt-band-' + b.id, icon: open ? '📂' : '📁', onclick: "bkLtToggle('band:" + b.id + "')", style: tall, label: '<b>' + esc(tx(b.title)) + '</b>', tail: String(n) }) + (open ? inner : '');
  });
  return out || '<div style="color:var(--grey);font-size:var(--fs-2);padding:8px 6px">' + esc(q ? tx('Nothing matches') : tx('No ledgers yet')) + '</div>';
}
function bkLtTreePaint() { var t = document.getElementById('lt_tree'); if (t) t.innerHTML = bkLtTreeHTML(); }
function bkLtPaneHTML() {
  var sel = BK.lt.sel;
  if (!sel) return emptyState('📒', tx('Pick a ledger'), esc(tx('Open a group on the left, then a ledger, to see its entries.')));
  return '<div style="padding:12px 14px"><div class="lt-crumb"><button type="button" data-testid="lt-back" onclick="bkLtBack()">‹ ' + esc(tx('Ledgers')) + '</button></div>'
    + '<div data-testid="lg-title" style="font-weight:700;margin-bottom:6px">' + esc(sel.title || '') + '</div>'
    + (sel.party ? '' : bkRangeHTML('lg', 'bkLtLoad()')) + '<div id="lg_out" data-testid="lg_out"></div></div>';
}
function bkLtBack() { BK.lt.sel = null; var el = document.getElementById('bk_lt'); if (el) el.classList.remove('has-sel'); bkLtTreePaint(); var p = document.getElementById('lt_pane'); if (p) p.innerHTML = bkLtPaneHTML(); }
function bkLtOpen(sel) {
  BK.lt.sel = sel; BK.lt.r = null; BK.lt.day = null;
  Object.keys(BK_OPEN).forEach(function (k) { if (k.indexOf('ledger:') === 0) delete BK_OPEN[k]; });   /* an open row belongs to the ledger it was opened in */
  var el = document.getElementById('bk_lt'); if (el) el.classList.add('has-sel');
  bkLtTreePaint(); var p = document.getElementById('lt_pane'); if (p) p.innerHTML = bkLtPaneHTML();
  bkLtLoad();
}
function bkLtAcct(code) { var f = null; (BK.lt.model || []).forEach(function (b) { b.ctrl.concat(b.groups.reduce(function (a, g) { return a.concat(g.accts); }, [])).forEach(function (a) { if (a.code === code) f = a; }); }); return f; }
function bkLtPick(code) { var a = bkLtAcct(code); BK.lgAcc = code; bkLtOpen({ code: code, title: code + ' · ' + (a ? a.name : '') }); }
/** a control account: its folder opens (its parties appear) and its own ledger shows — total of the parties beside its closing */
function bkLtPickCtrl(code) { BK.lt.open['ctrl:' + code] = true; BK.lt.open['band:people'] = true; bkLtPick(code); }
function bkLtPickParty(id, ctrl) { BK.lgAcc = ctrl; delete BK.stmt[id]; bkLtOpen({ code: ctrl, party: id, title: bkPartyLabel(id) }); }
async function bkLtLoad() {
  var sel = BK.lt.sel, out = document.getElementById('lg_out'); if (!sel || !out) return;
  out.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + tx('Reading…') + '</div>';
  try {
    var r, ctrl = BK_CTRL[sel.code];
    if (sel.party) { r = await api('booksStatement', { params: { id: sel.party } }); BK.stmt[sel.party] = r; }
    else { var rr = await Promise.all([api('booksLedger', { params: { account: sel.code }, query: bkRange('lg') }), ctrl ? booksDuesLoad(true) : null]); r = rr[0]; if (ctrl) { bkLtTreePaint(); } }
    if (BK.lt.sel !== sel) return;
    BK.lt.r = r; BK.lt.day = null; BK.lgR = r;
    bkLgDeclare(r); bkLtEntriesPaint();
  } catch (e) { var o = document.getElementById('lg_out'); if (o) o.innerHTML = bkErr(e); }
}
/** the Task table for a ledger's entries (rows = the server's statement lines); its journal is read when a row first opens */
function bkLgCols(c) {
  var dash = '<span style="color:var(--grey)">—</span>', money = function (v) { return v ? esc(bkMoney(v, c)) : ''; };
  var idx = function (l) { return (BK.lt.r && BK.lt.r.lines || []).indexOf(l); };
  return [
    { key: 'date', label: tx('Date'), sort: 'date', w: '84px', cell: function (l) { return bkCaret('ledger', idx(l)) + ' ' + esc(bkDate(l.date)); } },
    { key: 'what', label: tx('What'), sort: 'what', w: 'minmax(170px,3fr)', tid: function (l) { return 'stmt-what-' + idx(l); }, cell: function (l) {
        /* the entry's word, then where it came from — its bill (a link to the sheet), how it was paid, the counter, who rang it: all secondary, never where the party goes */
        var parts = bkSourceParts(l.source, 'stmt-src-' + idx(l), c);
        return bkEntryWord(l) + (parts.length ? ' <span style="color:var(--grey)">· ' + parts.join(' · ') + '</span>' : '') + bkRecordedHTML(l, 'stmt-src-' + idx(l)) + (l.ref ? ' <span class="mono">' + esc(l.ref) + '</span>' : ''); } },
    { key: 'party', label: tx('Party'), sort: 'party', w: 'minmax(110px,1.3fr)', cell: function (l) { var pl = l.party_id ? bkPartyLabel(l.party_id, l.party_name) : (l.party_name || ''); return pl ? esc(pl) : dash; } },
    { key: 'dr', label: tx('Debit'), sort: 'dr', align: 'right', w: '92px', cell: function (l) { return money(l.dr_minor); } },
    { key: 'cr', label: tx('Credit'), sort: 'cr', align: 'right', w: '92px', cell: function (l) { return money(l.cr_minor); } },
    { key: 'bal', label: tx('Balance'), align: 'right', w: '100px', cell: function (l) { return '<b>' + esc(bkMoney(l.running_minor, c)) + '</b>'; } },
  ];
}
function bkEntryWord(e) {
  var s = e && e.source;
  return s && s.kind === 'day' ? esc(tx('Walk-in day')) : s && s.kind === 'receipt' ? esc(tx('Received')) : esc((e && (e.narration || e.what || e.event_type)) || '');
}
function bkLgDeclare(r) {
  var by = function (f, num) { return function (a, b) { var x = f(a), y = f(b); return num ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }); }; };
  bkDeclare('ledger', {
    rows: function () { return (BK.lt.r && BK.lt.r.lines) || []; }, noun: 'entry', plural: 'entries', paint: bkLgPaint, repaint: bkLtEntriesPaint,
    text: function (l) { var s = l.source || {}; return [l.date, l.what, l.narration, l.ref, l.party_name, bkPartyLabel(l.party_id, l.party_name), s.ref, s.how, s.counter, s.by, (Number(l.dr_minor || l.cr_minor || 0) / Math.pow(10, bkDec(r.currency))).toFixed(bkDec(r.currency))].join(' '); },
    sorts: [{ key: 'rec', label: tx('As recorded'), cmp: function () { return 0; } }, { key: 'date', label: tx('Date'), cmp: by(function (l) { return l.date; }) },
      { key: 'what', label: tx('What'), cmp: by(function (l) { return l.what || l.narration || ''; }) }, { key: 'party', label: tx('Party'), cmp: by(function (l) { return bkPartyLabel(l.party_id, l.party_name); }) },
      { key: 'dr', label: tx('Debit'), cmp: by(function (l) { return l.dr_minor || 0; }, true) }, { key: 'cr', label: tx('Credit'), cmp: by(function (l) { return l.cr_minor || 0; }, true) }],
  });
}
/** a ledger line's journal: the day-book entry it belongs to (by its entry number, else its chit and date) — read once, on the first open */
function bkLgEntry(l) {
  var es = (BK.lt.day && BK.lt.day.entries) || [], d = String(l.date || '').slice(0, 10);
  return es.filter(function (e) { return (l.entry_no && e.entry_no === l.entry_no) || (l.entry_id && e.entry_id === l.entry_id) || (!l.entry_no && !l.entry_id && (l.source_chit_id || (l.source && l.source.chit_id)) && (e.source_chit_id || (e.source && e.source.chit_id)) === (l.source_chit_id || (l.source && l.source.chit_id)) && String(e.posting_date).slice(0, 10) === d); })[0];
}
async function bkLgJournal() {
  if (BK.lt.day || BK.lt.dayBusy) return;
  var ls = (BK.lt.r && BK.lt.r.lines) || [], ds = ls.map(function (l) { return String(l.date || '').slice(0, 10); }).filter(Boolean).sort();
  BK.lt.dayBusy = true;
  try { BK.lt.day = await api('booksDaybook', { query: { from: ds[0] || bkRange('lg').from, to: ds[ds.length - 1] || bkToday() } }); } catch (_) { BK.lt.day = { entries: [], failed: true }; }
  BK.lt.dayBusy = false; bkRepaint('ledger');
}
function bkLgNext(l, c) {
  if (!BK.lt.day) { bkLgJournal(); return tblNextHTML('<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Reading the journal…')) + '</div>', 'stmt-lines-' + (BK.lt.r.lines || []).indexOf(l)); }
  var e = bkLgEntry(l);
  if (!e) return tblNextHTML('<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('The journal lines of this entry are not on this page.')) + '</div>', 'stmt-lines-' + (BK.lt.r.lines || []).indexOf(l));
  return bkDvNext(e, c);
}
function bkLgPaint() {
  var r = BK.lt.r, c = r.currency || BK.duesCur, cols = bkLgCols(c), fit = bkFit('ledger', cols, ['date', 'what', 'party', 'dr', 'cr', 'bal'], 'bkl_ledger');
  return tblWrapHTML(fit, bkHead('ledger', fit) + lazyWrap('ledger', listCtlView('ledger').matched, function (l) {
    var i = r.lines.indexOf(l);
    return bkRow('ledger', fit, l, String(i), { tid: 'stmt-row-' + i, click: "bkToggle('ledger','" + i + "')" }, function () { return bkLgNext(l, c); });
  }, emptyState('🔍', tx('Nothing matches'), '')), { id: 'bkt_ledger' });
}
/** the ledger's right-hand pane: balance carried at the top, then the entries — and for a control account both figures that must agree */
function bkLtEntriesPaint() {
  var out = document.getElementById('lg_out'), r = BK.lt.r, sel = BK.lt.sel; if (!out || !r || !sel) return;
  var c = r.currency || BK.duesCur, ctrl = !sel.party && BK_CTRL[sel.code], sign = ctrl && ctrl.side === 'pay' ? -1 : 1, top = '';
  top = '<div class="bkdv-count" style="display:flex;gap:14px;flex-wrap:wrap;margin:4px 0 8px"><span>' + esc(tx('Opening')) + ' <b data-testid="stmt-opening">' + esc(bkMoney(r.opening_minor, c)) + '</b></span>'
    + '<span>' + esc(tx('Closing')) + ' <b data-testid="stmt-closing">' + esc(bkMoney(r.closing_minor, c)) + '</b></span></div>';
  if (ctrl) {
    var list = bkLtParties(sel.code), total = list.reduce(function (a, p) { return a + Number(p.balance_minor || 0); }, 0), closing = Number(r.closing_minor || 0);
    top += '<div data-testid="lg-parties" style="display:flex;gap:14px;flex-wrap:wrap;margin:0 0 8px;font-size:var(--fs-1)"><span>' + esc(tx('Total of the parties')) + ' <b data-testid="lg-parties-total">' + esc(bkMoney(sign * total, c)) + '</b></span>'
      + '<span>' + esc(tx('Ledger closing')) + ' <b data-testid="lg-parties-closing">' + esc(bkMoney(sign * closing, c)) + '</b></span></div>'
      + (total === closing ? '' : '<div data-testid="lg-parties-diff" style="color:var(--warn-2);font-size:var(--fs-1);margin:6px 0">'
        + esc(txf('The parties add up to {a} but the ledger closes at {b} — {d} apart.', { a: bkMoney(sign * total, c), b: bkMoney(sign * closing, c), d: bkMoney(Math.abs(total - closing), c) })) + '</div>');
  }
  out.innerHTML = top + ((r.lines || []).length ? bkListHTML('ledger') : emptyState('📒', tx('No entries in these dates'), ''));
  if ((r.lines || []).length) bkListPaint('ledger');
}
async function bkLedgers(body) {
  try {
    var rr = await Promise.all([api('booksAccounts'), bkBalances().catch(function () { return null; }), booksDuesLoad(true)]);
    BK.lt.model = bkLtModel((rr[0] && rr[0].accounts) || []); BK.lt.bal = rr[1];
    listCtl('ledgers', { rows: function () { return []; }, text: function () { return ''; }, repaint: bkLtTreePaint });
    var search = '<div data-testid="lt-search">' + listCtlToolbarHTML('ledgers') + '</div>';
    body.innerHTML = '<div style="height:100%;min-height:60vh">' + _folderPanes(search + '<div id="lt_tree" data-testid="lt-tree">' + bkLtTreeHTML() + '</div>', bkLtPaneHTML(), { id: 'bk_lt', cls: BK.lt.sel ? 'has-sel' : '', treeCls: 'lt-tree', paneCls: 'lt-pane', paneId: 'lt_pane' }) + '</div>';
    if (BK.lt.sel) bkLtLoad();
  } catch (e) { body.innerHTML = bkErr(e); }
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
/** ⚠️ what the shop OWES is aged differently (Schedule III, payables): not due · under a year · 1–2 · 2–3 · over 3 years */
var BK_BUCKETS_PAY = [['not_due', 'Not due'], ['lt_1y', '< 1 year'], ['y1_2', '1–2 years'], ['y2_3', '2–3 years'], ['gt_3y', '> 3 years']];
/**
 * ⚠️⚠️ THE SERVER'S BUCKETS DECIDE THE COLUMNS (2026-09-30, review F11). One table with the six receivable columns
 * showed a supplier's `lt_1y` amount nowhere but under Balance. So: two tables — what customers owe you, what you owe
 * suppliers — each with the columns of its own side, and any bucket the server sends that has no column here lands in
 * "Other" rather than vanishing (a named list of columns must never be a silent filter).
 */
function bkDuesSide(p) {
  if (p.side === 'supplier') return 'pay';
  if (p.side === 'customer') return 'rcv';
  var b = p.buckets || {};
  if (p.side !== 'both' && ('lt_1y' in b) && !('lt_6m' in b) && !('m6_1y' in b)) return 'pay';
  return Number(p.balance_minor) < 0 ? 'pay' : 'rcv';
}
/** the bills a party's statement holds — read once, on the first time its row opens (the party's own statement route) */
async function bkStmtRead(pid, list) {
  if (BK.stmt[pid] || (BK.stmtBusy || {})[pid]) return;
  BK.stmtBusy = BK.stmtBusy || {}; BK.stmtBusy[pid] = true;
  try { BK.stmt[pid] = await api('booksStatement', { params: { id: pid } }); } catch (_) { BK.stmt[pid] = { lines: [], failed: true }; }
  delete BK.stmtBusy[pid]; bkRepaint(list);
}
function bkDuesCols(c) {
  var dash = '<span style="color:var(--grey)">—</span>', amt = function (p, v) { return esc(bkMoney(bkDuesSide(p) === 'pay' ? -Number(v) : Number(v), c)); };
  return [
    { key: 'party', label: tx('Party'), sort: 'party', w: 'minmax(160px,2.4fr)', cell: function (p) { return bkCaret('dues', p.party_id) + ' ' + esc(bkPartyLabel(p.party_id, p.name)); } },
    { key: 'due', label: tx('Total due'), sort: 'due', align: 'right', w: '120px', cell: function (p) { return '<b data-b="balance">' + amt(p, p.balance_minor) + '</b>'; } },
    { key: 'oldest', label: tx('Oldest due'), sort: 'oldest', w: '110px', cell: function (p) { return p.oldest_due ? esc(bkDate(p.oldest_due)) : dash; } },
  ];
}
/** its next level: the age buckets (the server's, Schedule III) and the bills on the party's statement */
function bkDuesNext(p, c) {
  var side = bkDuesSide(p), cols = side === 'pay' ? BK_BUCKETS_PAY : BK_BUCKETS, known = cols.map(function (k) { return k[0]; }), b = p.buckets || {};
  var amt = function (v) { return esc(bkMoney(side === 'pay' ? -Number(v) : Number(v), c)); };
  var other = Object.keys(b).filter(function (k) { return known.indexOf(k) < 0; }).reduce(function (s, k) { return s + Number(b[k] || 0); }, 0);
  var rows = cols.filter(function (k) { return b[k[0]]; }).map(function (k) { return tblNextRow(['<span data-b="' + k[0] + '">' + esc(tx(k[1])) + '</span>', amt(b[k[0]])], [120]); }).join('')
    + (other ? tblNextRow(['<span data-b="other">' + esc(tx('Other')) + '</span>', amt(other)], [120]) : '')
    + (p.disputed_minor ? tblNextRow(['<span data-b="disputed">' + esc(tx('Disputed')) + '</span>', amt(p.disputed_minor)], [120]) : '');
  var st = BK.stmt[p.party_id], bills = '';
  if (!st) { bkStmtRead(p.party_id, 'dues'); bills = '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Reading the bills…')) + '</div>'; }
  else {
    var ls = (st.lines || []).filter(function (l) { return l.source && (l.source.kind === 'bill' || l.source.kind === 'purchase'); });
    bills = ls.length ? ls.map(function (l, i) { return tblNextRow([esc(bkDate(l.date)) + ' ' + bkBillPart(l.source, 'dues-bill-' + p.party_id + '-' + i), amt(l.dr_minor || l.cr_minor || 0)], [120]); }).join('')
      : '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('No bills on the statement')) + '</div>';
  }
  return tblNextHTML('<div style="color:var(--grey);font-size:var(--fs-1);text-transform:uppercase;padding:2px 0">' + esc(tx('Age')) + '</div>' + (rows || '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Nothing is overdue')) + '</div>')
    + '<div style="color:var(--grey);font-size:var(--fs-1);text-transform:uppercase;padding:6px 0 2px">' + esc(tx('Bills')) + '</div>' + bills, 'dues-next-' + esc(p.party_id));
}
function bkDuesPaint() {
  var c = BK.duesCur, cols = bkDuesCols(c), fit = bkFit('dues', cols, ['party', 'due', 'oldest'], 'bkl_dues'), flat = [], by = { rcv: [], pay: [] };
  listCtlView('dues').matched.forEach(function (p) { by[bkDuesSide(p)].push(p); });
  [['rcv', 'They owe you'], ['pay', 'You owe']].forEach(function (s) {
    if (!by[s[0]].length) return;
    flat.push({ side: s[0], label: s[1], n: by[s[0]].length });
    by[s[0]].forEach(function (p) { flat.push({ p: p }); });
  });
  return flat.length ? tblWrapHTML(fit, bkHead('dues', fit) + lazyWrap('dues', flat, function (it) {
    if (it.side) return tblRowHTML([{ key: 'g', label: '', w: '1fr', cell: function () { return '<b>' + esc(tx(it.label)) + '</b> · ' + esc(txf(it.n === 1 ? '{n} party' : '{n} parties', { n: it.n })); } }], it, { tpl: '1fr', tid: 'dues-side-' + it.side });
    var p = it.p;
    return bkRow('dues', fit, p, p.party_id, { tid: 'dues-' + p.party_id, click: "bkToggle('dues','" + esc(p.party_id) + "')" }, function () { return bkDuesNext(p, c); });
  }, ''), { id: 'bkt_dues' }) : emptyState('🔍', tx('Nothing matches'), '');
}
async function bkDues(body) {
  try {
    var r = await api('booksDues', { query: { asOf: bkToday() } }); var c = r && r.currency; bkDuesStore(r);
    var open = ((r && r.parties) || []).filter(function (p) { return Number(p.balance_minor); });
    var num = function (f) { return function (a, b) { return Number(f(a)) - Number(f(b)); }; };
    bkDeclare('dues', {
      rows: function () { return open; }, noun: 'party', plural: 'parties', paint: bkDuesPaint,
      text: function (p) { return [p.party_no, p.name, bkPartyLabel(p.party_id, p.name), p.balance_minor ? (Math.abs(p.balance_minor) / Math.pow(10, bkDec(c))).toFixed(bkDec(c)) : ''].join(' '); },
      sorts: [
        { key: 'party', label: tx('Party no'), cmp: function (a, b) { return String(a.party_no || '').localeCompare(String(b.party_no || ''), undefined, { numeric: true }); } },
        { key: 'name', label: tx('Name'), cmp: function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); } },
        { key: 'due', label: tx('Total due'), cmp: num(function (p) { return Math.abs(p.balance_minor || 0); }) },
        { key: 'oldest', label: tx('Oldest due'), cmp: function (a, b) { return String(a.oldest_due || '9999').localeCompare(String(b.oldest_due || '9999')); } },
      ],
      filters: [{ key: 'side', label: tx('Side'), all: tx('Both sides'), options: [{ v: 'rcv', label: tx('They owe you') }, { v: 'pay', label: tx('You owe') }], match: function (p, v) { return bkDuesSide(p) === v; } }],
    });
    body.innerHTML = open.length ? bkListHTML('dues') : emptyState('⏳', tx('Nothing is due'), '');
    if (open.length) bkListPaint('dues');
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
/**
 * ⚠️⚠️ A PACK IS ITS FILE (2026-09-30, review M10). Download saved the manifest — a list of names and fingerprints —
 * and "We have it" then told the server the shop holds its ledger files, which is the fact that later allows old
 * detail to be summarised away. So: Download fetches the real zip; "We have it" exists only for a pack that HAS a
 * file, and unless that file came down in this session the owner is asked first; a pack with no file says so and
 * offers neither.
 * ⭐ ONE reader of "has it a file": has_file when the server says it (on the row, or on GET /packs/:id beside `file`),
 * else the older `stored` / `download`. null = the row does not say — GET /packs/:id is asked before anything is offered.
 */
function bkPackHasFile(k, r) {
  var pick = function (o) { return !o ? null : typeof o.has_file === 'boolean' ? o.has_file : typeof o.stored === 'boolean' ? o.stored : null; };
  var v = pick(r); if (v == null && r) v = pick(r.pack);
  if (v == null && r && ('file' in r || 'download' in r)) v = !!(r.file || r.download);
  if (v == null) v = pick(k);
  return v;
}
async function bkPacks(body) {
  try {
    var r = await api('booksPacks');
    BK.packRows = {}; BK.packGot = BK.packGot || {};
    var rows = ((r && r.packs) || []).map(function (k) {
      BK.packRows[k.pack_id] = k;
      var has = bkPackHasFile(k, null), id = esc(k.pack_id);
      var ack = k.acknowledged_at ? '✓ ' + esc(bkDate(k.acknowledged_at))
        : has === false ? '<span data-testid="pack-nofile-' + id + '" style="color:var(--warn-2)">' + tx('No file · make it again') + '</span>'
        : '<div class="supacts" style="margin:0"><button data-testid="pack-ack-' + id + '" onclick="bkPackAck(\'' + id + '\')">' + tx('We have it') + '</button></div>';
      var get = has === false ? '' : '<div class="supacts" style="margin:0"><button data-testid="pack-get-' + id + '" onclick="bkPackGet(\'' + id + '\')">' + tx('Download') + '</button></div>';
      return '<tr data-testid="pack-' + id + '"><td>' + esc(tx({ month: 'Month', year: 'Year', exit: 'Exit' }[k.kind] || k.kind || '')) + '</td><td>' + esc(k.fiscal_year || '') + (k.period ? ' · ' + esc(k.period) : '') + '</td><td>' + esc(bkDate(k.created_at)) + '</td>'
        + '<td class="mono" title="' + esc(k.sha256 || '') + '">' + esc(String(k.sha256 || '').slice(0, 10)) + '</td>'
        + '<td>' + ack + '</td><td>' + get + '</td></tr>';
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
/** the one sentence for a pack with nothing to download — said, and the row stops offering Download / We have it */
function bkPackNoFile(id) {
  if (BK.packRows && BK.packRows[id]) BK.packRows[id].has_file = false;
  var out = document.getElementById('pk_out');
  if (out) out.innerHTML = '<span data-testid="pack-nofile-said" style="color:var(--warn-2)">' + esc(tx('No file for this pack · make it again')) + '</span>';
  var tr = document.querySelector('[data-testid="pack-' + id + '"]');
  if (tr && !tr.querySelector('[data-testid^="pack-nofile-"]')) {   /* flip the ROW, never the whole list */
    tr.children[4].innerHTML = '<span data-testid="pack-nofile-' + esc(id) + '" style="color:var(--warn-2)">' + tx('No file · make it again') + '</span>';
    tr.children[5].innerHTML = '';
  }
}
/**
 * ⭐ THE PACK ITSELF comes down — the zip at /packs/:id/file, as bytes, with the session (api() speaks JSON only). The
 * manifest is still shown beside it: the file list and fingerprints are what make the zip checkable.
 */
async function bkPackGet(id) {
  var out = document.getElementById('pk_out');
  await bkOnce('packget:' + id, document.querySelector('[data-testid="pack-get-' + id + '"]'), async function () {
    try {
      var r = await api('booksPackGet', { params: { id: id } });
      if (bkPackHasFile(BK.packRows && BK.packRows[id], r) === false) { bkPackNoFile(id); return; }
      var base = (typeof CFG !== 'undefined' && CFG.API_BASE) || '';
      var res = await fetch(base + EP.booksPackFile.p.replace(':id', encodeURIComponent(id)), { cache: 'no-store', headers: SESSION.token ? { Authorization: 'Bearer ' + SESSION.token } : {} });
      if (res.status === 409 || res.status === 404) { bkPackNoFile(id); return; }   /* made while storage was not connected */
      if (!res.ok) throw new Error('');
      var blob = await res.blob();
      if (!blob || !blob.size) { bkPackNoFile(id); return; }
      var cd = ''; try { cd = res.headers.get('Content-Disposition') || ''; } catch (_) {}
      var m = /filename="?([^";]+)"?/.exec(cd);
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (m && m[1]) || ('ledger-pack-' + id + '.zip'); a.setAttribute('data-testid', 'pack-download-link'); document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      BK.packGot = BK.packGot || {}; BK.packGot[id] = true;   /* this session holds the file — "We have it" is now a plain yes */
      var files = (r && r.manifest && r.manifest.files) || [];
      if (out) out.innerHTML = '<div data-testid="pack-manifest"><b>' + esc(tx('Manifest')) + '</b> · ' + files.length + ' ' + tx('files') + '<br>' + files.map(function (f) { return '<span class="mono">' + esc(f.name) + ' · ' + esc(String(f.sha256 || '').slice(0, 12)) + '</span>'; }).join('<br>') + '</div>';
    } catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not download it')); }
  });
}
async function bkPackAck(id) {
  await bkOnce('packack:' + id, document.querySelector('[data-testid="pack-ack-' + id + '"]'), async function () {
    try {
      if (!(BK.packGot && BK.packGot[id])) {
        /* not downloaded in this session: is there a file at all? then the owner says so themselves */
        var r = await api('booksPackGet', { params: { id: id } });
        if (bkPackHasFile(BK.packRows && BK.packRows[id], r) !== true) { bkPackNoFile(id); return; }
        var yes = await new Promise(function (res) { confirmAsk(tx('Saved this pack?'), esc(tx('Download it first if you have not')), tx('We have it'), function () { res(true); }, false, function () { res(false); }); });
        if (!yes) return;
      }
      await api('booksPackAck', { params: { id: id }, body: {} }); bkTab('packs');
    } catch (e) { toast(bkWhy(e, tx('Could not record it'))); }
  });
}
function bkOpeningView(body) {
  BK.openingRef = BK.openingRef || bkRef();   /* one ref for this form until the server has said yes (M11) */
  body.innerHTML ='<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:6px">' + tx('Per line: code, party no, debit, credit, bill, due date') + '</div>'
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
  if (!rows.length) { if (out) out.textContent = tx('Type at least one line'); return; }
  /* ⚠️ M11: pressed twice, every balance doubled. The button is dead while the call is out; a retry carries the SAME
     client_ref; and once the server has said yes the box is emptied and the ref replaced — the next press is a new entry */
  await bkOnce('opening', document.querySelector('[data-testid="op_go"]'), async function () {
    try {
      BK.openingRef = BK.openingRef || bkRef();
      var r = await api('booksOpening', { body: { rows: rows, client_ref: BK.openingRef } });
      BK.openingRef = bkRef();
      var box = document.getElementById('op_csv'); if (box) box.value = '';
      if (out) out.textContent = txf('Entered as {no}.', { no: (r && r.entry_no) || '' }) + (r && r.suspense_minor ? ' ' + txf('{amt} did not balance — held in Suspense', { amt: bkMoney(r.suspense_minor) }) : '');
    } catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not enter them')); }
  });
}

/* ══ 4 · CHEQUES AND WHAT IS WAITING — the two things that were on no screen (2026-09-30, review M12) ═════════ */
/**
 * ⚠️⚠️ A CHEQUE COULD NEVER CLEAR. Both screens record one, the server holds it correctly until it clears — and no
 * screen ever called the step, so the customer's balance never moved. The steps are offered wherever a held cheque
 * is listed: in the Receive form the moment it is recorded, and on the Ledger's Cheques view.
 * ⭐ The server decides every step (a refusal is shown in its own words); this only remembers what it was told.
 * ⚠️ WHAT IS LISTED: GET /api/books/cheques (the cheques still held, from any session or the counter), plus the ones
 * recorded in this session. Each server row carries `next` — the steps the engine accepts NOW; BK_CHQ_NEXT is only
 * the fallback for a row that came without it, and says what the engine says: received → deposited → cleared or
 * bounced; a cleared cheque later dishonoured is an owner reversal, not a step (engines v1.8.1).
 */
BK.cheques = BK.cheques || {};
var BK_CHQ_WORD = { received: 'Received', deposited: 'Deposited', cleared: 'Cleared', bounced: 'Bounced' };
var BK_CHQ_NEXT = { received: ['deposited'], deposited: ['cleared', 'bounced'], cleared: [], bounced: [] };
function bkChequeStatus(s) { s = String(s || '').replace(/^cheque_/, ''); return BK_CHQ_WORD[s] ? s : 'received'; }
function bkChequeNext(c) { return c && Array.isArray(c.next) ? c.next : (BK_CHQ_NEXT[c && c.status] || []); }
function bkChequeKeep(c) {
  var id = c && (c.payment_id || c.id); if (!id) return null;
  var was = BK.cheques[id] || {};
  BK.cheques[id] = { payment_id: id, party_id: c.party_id || was.party_id || null, name: c.name || c.party_name || was.name || '',
    amount_minor: c.amount_minor != null ? c.amount_minor : was.amount_minor, currency: c.currency || was.currency || null,
    cheque_no: c.cheque_no || c.number || was.cheque_no || '', cheque_bank: c.cheque_bank || c.bank || was.cheque_bank || '',
    cheque_date: c.cheque_date || c.date || was.cheque_date || null, status: bkChequeStatus(c.status || was.status),
    next: Array.isArray(c.next) ? c.next : (c.status ? null : (was.next || null)) };
  return BK.cheques[id];
}
function bkChequeStepsHTML(c) {
  if (!c) return '';
  var id = esc(c.payment_id), next = bkChequeNext(c);
  return '<span data-testid="chq-status-' + id + '" style="font-weight:600">' + tx(BK_CHQ_WORD[c.status]) + '</span>'
    + (next.length ? ' <span class="supacts" style="display:inline-flex;gap:6px;margin:0 0 0 8px">' + next.map(function (s) {
        return '<button data-testid="chq-' + s + '-' + id + '" onclick="bkChequeStep(\'' + id + '\',\'' + s + '\')">' + tx(BK_CHQ_WORD[s]) + '</button>'; }).join('') + '</span>' : '');
}
async function bkChequeStep(id, to) {
  var c = BK.cheques[id]; if (!c || bkChequeNext(c).indexOf(to) < 0) return;
  /* a bounce puts the debt back (and reverses a cleared one) — asked first */
  var inForm = !!document.getElementById('pay_chq_steps');
  if (to === 'bounced') {
    var yes = await new Promise(function (res) { confirmAsk(tx('Cheque bounced?'), esc(tx('They owe this amount again')), tx('Bounced'), function () { res(true); }, true, function () { res(false); }); });
    if (inForm) booksAfterPay();   /* the question took the Receive form's place — repaint the party behind it */
    if (!yes) return;
  }
  await bkOnce('chq:' + id, null, async function () {
    var say = function (t) { var o = document.getElementById('chq_out'); if (o) o.textContent = t; else if (t) toast(t); };
    document.querySelectorAll('[data-testid^="chq-"][data-testid$="-' + id + '"]').forEach(function (b) { if (b.tagName === 'BUTTON') b.disabled = true; });
    try {
      await api('booksChequeStep', { params: { id: id }, body: { status: to } });
      c.status = to; c.next = null; say('');   /* the next steps are the engine's to say — the fallback table until the list is read again */
      if (to === 'cleared' || to === 'bounced') { delete BK.stmt[c.party_id]; booksDuesLoad(true); }
    } catch (e) { say(bkWhy(e, tx('Could not change it'))); }
    bkChequeRepaint(id);
  });
}
/** flip the ROW (and the Receive form's line) — never the whole view */
function bkChequeRepaint(id) {
  var c = BK.cheques[id]; if (!c) return;
  var cell = document.querySelector('[data-testid="chq-steps-' + id + '"]'); if (cell) cell.innerHTML = bkChequeStepsHTML(c);
  var inForm = document.getElementById('pay_chq_steps'); if (inForm && PAY && PAY.id === id) inForm.innerHTML = bkChequeStepsHTML(c);
}
/** ONE read of /health: what is waiting (each row's `reason` is the server's sentence) */
async function bkHealthLoad() {
  var r = await api('booksHealth');
  BK.waiting = (r && r.waiting) || [];
  bkWaitingCount();
  return r;
}
/** the cheques still held, from any session or the counter — the server's row wins over what this session remembers */
async function bkChequesLoad() {
  var r = await api('booksCheques');
  ((r && r.cheques) || []).forEach(bkChequeKeep);
  return r;
}
function bkWaitingCount() {
  var el = document.querySelector('[data-testid="bk-tab-waiting"] .code'); if (!el) return;
  var n = (BK.waiting || []).length;
  el.textContent = '🕗 ' + tx('Waiting') + (n ? ' · ' + n : '');
}
async function bkChequesView(body) {
  try {
    await bkChequesLoad();
    var list = Object.keys(BK.cheques).map(function (k) { return BK.cheques[k]; });
    var rows = list.map(function (c) {
      var id = esc(c.payment_id);
      return '<tr data-testid="chq-' + id + '"><td>' + esc(c.name || '') + '</td><td class="mono">' + esc(c.cheque_no || '') + (c.cheque_bank ? ' · ' + esc(c.cheque_bank) : '') + '</td><td>' + (c.cheque_date ? esc(bkDate(c.cheque_date)) : '') + '</td>'
        + '<td class="num">' + esc(bkMoney(c.amount_minor, c.currency)) + '</td><td data-testid="chq-steps-' + id + '">' + bkChequeStepsHTML(c) + '</td></tr>';
    }).join('');
    body.innerHTML = '<div id="chq_out" data-testid="chq_out" style="color:var(--warn-2);font-size:var(--fs-1);margin-bottom:6px"></div>'
      + (rows ? bkTable([{ t: tx('Party') }, { t: tx('Cheque') }, { t: tx('Dated') }, { t: tx('Amount'), num: 1 }, { t: tx('Status') }], rows) : emptyState('🧾', tx('No cheques held'), ''));
  } catch (e) { body.innerHTML = bkErr(e); }
}
/**
 * ⚠️⚠️ A SALE THE LEDGER COULD NOT RECORD WAS VISIBLE ONLY TO SOMEONE CALLING THE API BY HAND. /health has always
 * named them (`waiting[]`, each with the reason). Athi, 2026-10-02: the list is the Task table — Supplier · Bill no · Amount ·
 * Date · Step — no chit id, no "tries". A supplier bill waits on a person: its row opens the bill in the popup, where Accept asks
 * what the goods are for (resale · own use · asset). A posting that genuinely FAILED shows its reason in the Step column, and
 * the one control that helps — Try again. Supplier, bill number and step are the chit's own (CBSheet.model); the amount is
 * `summary_json.money.total`, READ from the chit, never summed here.
 */
function bkWaitId(w) { return String(w.chit_id || w.id || w.ref || ''); }
function bkWaitFailed(w) { return !/^Waiting for you to confirm/.test(String(w.reason || w.why || '')); }
function bkWaitModel(w) { var r = w && w.chit_id && BK.wchit && BK.wchit[w.chit_id]; try { return r && window.CBSheet ? CBSheet.model(r) : null; } catch (_) { return null; } }
function bkWaitCols() {
  var dash = '<span style="color:var(--grey)">—</span>';
  return [
    { key: 'who', label: tx('Supplier'), sort: 'who', w: 'minmax(140px,2fr)', cell: function (w) { var m = bkWaitModel(w); return bkCaret('waiting', bkWaitId(w)) + ' ' + (m && m.who ? esc(m.who) : dash); } },
    { key: 'no', label: tx('Bill no'), sort: 'no', w: 'minmax(110px,1.2fr)', cell: function (w) { var m = bkWaitModel(w); return m && m.no ? '<span class="mono">' + esc(m.no) + '</span>' : dash; } },
    { key: 'amount', label: tx('Amount'), sort: 'amount', align: 'right', w: '112px', cell: function (w) { var m = bkWaitModel(w), t = m && m.money && m.money.total; return t != null ? esc(bkMajor(t, m.cur)) : dash; } },
    { key: 'date', label: tx('Date'), sort: 'date', w: '92px', cell: function (w) { var m = bkWaitModel(w); return esc(bkDate((m && m.at) || w.since)); } },
    { key: 'step', label: tx('Step'), sort: 'step', w: 'minmax(130px,1.4fr)', cell: function (w) {
        var i = (BK.waiting || []).indexOf(w), m = bkWaitModel(w);
        /* a posting that failed says why, in the server's words; a bill waiting on a person says which step it is at */
        if (bkWaitFailed(w)) return '<span data-testid="wait-why-' + i + '" style="color:var(--warn-2)">' + esc(w.reason || w.why || tx('No reason given')) + '</span>';
        return m ? esc(CBSheet.stepWord(m)) : dash;
      } },
  ];
}
function bkWaitDate(w) { var m = bkWaitModel(w); return String((m && m.at) || w.since || ''); }
function bkWaitNext(w) {
  var m = bkWaitModel(w), pre = '';
  if (!m) return tblNextHTML('<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx(w.chit_id ? 'Reading the bill…' : 'No bill attached')) + '</div>', 'wait-lines-' + (BK.waiting || []).indexOf(w));
  var ml = (m.money && m.money.lines) || [];
  var lines = (m.lines || []).map(function (l, i) {
    var f = ml[i], tot = f ? f.total : (l.total != null ? l.total : l.net), q = l.quantity != null ? l.quantity : (l.qty != null ? l.qty : '');
    return tblNextRow([esc(l.particulars || l.name || ''), esc(String(q) + (l.unit && l.unit !== 'piece' ? ' ' + l.unit : '')), esc(bkMajor(tot, m.cur))], [90, 110]);
  }).join('');
  return tblNextHTML(lines || '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('No lines on this bill')) + '</div>', 'wait-lines-' + (BK.waiting || []).indexOf(w));
}
function bkWaitPaint() {
  var list = BK.waiting || [], cols = bkWaitCols(), fit = bkFit('waiting', cols, ['who', 'amount', 'step', 'no', 'date'], 'bkl_waiting'), view = listCtlView('waiting').matched;
  return tblWrapHTML(fit, bkHead('waiting', fit) + lazyWrap('waiting', view, function (w) {
    var i = list.indexOf(w), id = bkWaitId(w);
    return bkRow('waiting', fit, w, id, { tid: 'wait-' + i, click: w.chit_id ? "openChitSheet('" + esc(w.chit_id) + "')" : '' }, function () { return bkWaitNext(w); });
  }, emptyState('🔍', tx('Nothing matches'), '')), { id: 'bkt_waiting' });
}
/** one chit read per waiting row (four at a time); each row paints again when its bill arrives — the list never waits for them */
async function bkWaitReads() {
  BK.wchit = BK.wchit || {};
  var todo = (BK.waiting || []).filter(function (w) { return w.chit_id && !(w.chit_id in BK.wchit); });
  todo.forEach(function (w) { BK.wchit[w.chit_id] = null; });
  var next = 0;
  async function worker() {
    while (next < todo.length) {
      var w = todo[next++];
      try { BK.wchit[w.chit_id] = await api('chit', { params: { id: w.chit_id } }); } catch (_) { BK.wchit[w.chit_id] = false; }
      if (BK.tab === 'waiting') bkRepaint('waiting');
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
}
async function bkWaitingView(body) {
  try {
    await bkHealthLoad();
    var list = BK.waiting || [];
    bkDeclare('waiting', {
      rows: function () { return BK.waiting || []; }, noun: 'bill', plural: 'bills', paint: bkWaitPaint,
      text: function (w) { var m = bkWaitModel(w); return [m && m.who, m && m.no, m && m.money && m.money.total, w.reason, w.why].join(' '); },
      sorts: [
        { key: 'date', label: tx('Oldest first'), cmp: function (a, b) { return bkWaitDate(a) < bkWaitDate(b) ? -1 : bkWaitDate(a) > bkWaitDate(b) ? 1 : 0; } },
        { key: 'who', label: tx('Supplier'), cmp: function (a, b) { return String((bkWaitModel(a) || {}).who || '').localeCompare(String((bkWaitModel(b) || {}).who || '')); } },
        { key: 'no', label: tx('Bill no'), cmp: function (a, b) { return String((bkWaitModel(a) || {}).no || '').localeCompare(String((bkWaitModel(b) || {}).no || ''), undefined, { numeric: true }); } },
        { key: 'amount', label: tx('Amount'), cmp: function (a, b) { var f = function (w) { var m = bkWaitModel(w); return Number(m && m.money && m.money.total) || 0; }; return f(a) - f(b); } },
        { key: 'step', label: tx('Step'), cmp: function (a, b) { return Number(bkWaitFailed(b)) - Number(bkWaitFailed(a)); } },
      ],
      filters: [{ key: 'what', label: tx('Step'), all: tx('Every step'), options: [{ v: 'confirm', label: tx('To accept') }, { v: 'failed', label: tx('Could not be recorded') }],
        match: function (w, v) { return v === 'failed' ? bkWaitFailed(w) : !bkWaitFailed(w); } }],
    });
    var failed = list.some(bkWaitFailed);
    body.innerHTML = '<div class="sec">' + tx('Waiting to be recorded') + '</div>'
      + (list.length ? (failed ? '<div class="supacts" style="display:flex;gap:7px;margin-bottom:9px"><button class="supact-pri" data-testid="wait-retry" onclick="bkWaitingRetry()">' + tx('Try again') + '</button></div>' : '')
          + '<div id="wait_out" data-testid="wait_out" style="font-size:var(--fs-1);margin-bottom:6px"></div>' + bkListHTML('waiting')
        : '<div id="wait_out" data-testid="wait_out" style="font-size:var(--fs-1);margin-bottom:6px"></div>' + emptyState('✓', tx('Nothing is waiting'), ''));
    if (list.length) { bkListPaint('waiting'); bkWaitReads(); }
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkWaitingRetry() {
  await bkOnce('retry', document.querySelector('[data-testid="wait-retry"]'), async function () {
    var before = (BK.waiting || []).length;
    try {
      await api('booksRetry', { body: {} });
      var body = document.getElementById('bk_body'); if (body && BK.tab === 'waiting') await bkWaitingView(body);
      var left = (BK.waiting || []).length, out = document.getElementById('wait_out');
      if (out) out.textContent = left ? txf('{n} recorded · {m} still waiting', { n: Math.max(0, before - left), m: left }) : tx('All recorded');
    } catch (e) { var o = document.getElementById('wait_out'); if (o) o.textContent = bkWhy(e, tx('Could not try again')); }
  });
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
