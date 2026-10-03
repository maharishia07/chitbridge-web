/* cap-bank.js — BANK on CB Accounts (Daily): a statement file is read, matched to the shop's bank ledger, and the lines the Ledger lacks are added.
 * DECISIONS.md "Bank reconciliation runs on the SHOP'S DEVICE": the engine (CBBankRecon, public/engine/bank-recon.js, adopted at v1.18.0) parses the
 * statement IN THE BROWSER, the page fetches the shop's own bank lines (GET /api/books/ledger/:account) for the statement's dates, the engine matches
 * them and finds what is missing. The owner confirms each missing line in ＋ Entry (enOpen with a preset) and ONLY that confirmed entry goes to the
 * server, through the normal path (POST /events → MJ).
 *
 * ⭐ THE STATEMENT FILE IS NEVER UPLOADED. It is read with File.text(), parsed here, and held in memory. Nothing in this file passes its text, its name or any
 *   of its lines to api() or fetch — the only things that leave the device are the confirmed entries (a date, an amount, a note the owner saw in the preview).
 * ⭐ THE PAGE COMPUTES NO MONEY. Matching, suggestions and the BRS are the engine's; the books' balance is the API's ledger closing figure; every amount is shown
 *   through bkMoney / bkDrCr.
 * ⭐ NO DOUBLE POSTING (until the server keeps a match record): each entry carries client_ref = bank:<file hash>:<line no>, so posting the same line twice answers the
 *   first entry; and once an entry is saved the page fetches the ledger again, so the line is simply matched.
 * Never the word "accounting" on a screen.
 */
'use strict';
const BKB = { acct: '', preset: '', file: null, parsed: null, ledger: null, m: null, rows: [], tab: 'lines', bal: '' };
const bkbE = (v) => esc(v);
const bkbEl = (id) => document.getElementById(id);
const bkbWords = {                                  /* what the engine's proposal means, in the shop's words */
  'expense:bank_charges': 'Bank charge', 'other_income:interest_received': 'Interest received', 'contra:bank>cash': 'Cash drawn from the bank', 'contra:cash>bank': 'Cash paid into the bank',
  payment_received: 'Payment received from a customer', payment_made: 'Payment made to a supplier', cheque_dishonoured: 'Returned cheque',
};
function bkbEventWord(ev) {
  if (!ev) return '';
  const k = ev.type === 'contra' ? 'contra:' + ev.from + '>' + ev.to : ev.type === 'expense' || ev.type === 'other_income' ? ev.type + ':' + ev.class : ev.type;
  return tx(bkbWords[k] || 'Another entry');
}
const bkbStatus = { matched: ['green', 'Matched'], suggested: ['amber', 'Suggested'], 'bank-only': ['red', 'Bank only'], missing: ['blue', 'Not on the statement'], check: ['amber', 'Check'] };
const bkbIsBank = (a, groupCode) => !a.is_group && (a.role === 'bank' || (groupCode != null && a.parent_code === groupCode));
function bkbBanks(accts) {
  const main = accts.filter((a) => a.role === 'bank')[0], g = main ? main.parent_code : null;
  return accts.filter((a) => bkbIsBank(a, g) && a.active !== false);
}
const bkbMinorText = (m) => (Number(m || 0) / Math.pow(10, bkDec())).toFixed(bkDec());

/* ── the file: read and hashed on this device ── */
async function bkbHash(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0; return ('00000000' + (h >>> 0).toString(16)).slice(-8).repeat(8); }
}

async function bankView(body) {
  let accts = [];
  try { const r = await api('booksAccounts'); accts = (r && r.accounts) || []; } catch (e) { body.innerHTML = '<div class="pe-bad">' + bkErr(e) + '</div>'; return; }
  const banks = bkbBanks(accts);
  if (!banks.length) { body.innerHTML = '<div class="pe-note" data-testid="bank-none">' + bkbE(tx('There is no bank ledger yet. Add one under Shop ledgers.')) + '</div>'; return; }
  if (!banks.some((a) => a.code === BKB.acct)) BKB.acct = banks[0].code;
  const presets = Object.keys((window.CBBankRecon && CBBankRecon.PRESETS) || {});
  body.innerHTML = '<div class="pe-bank"><div class="pe-card" data-testid="bank-form"><div class="pe-form">'
    + peField('bk_acct', 'Bank account', peSel('bk_acct', banks.map((a) => [a.code, a.name]), BKB.acct, ' onchange="BKB.acct=this.value"'))
    + peField('bk_preset', 'Which bank', peSel('bk_preset', [['', 'Find out from the file']].concat(presets.map((k) => [k, CBBankRecon.PRESETS[k].bank])), BKB.preset, ' onchange="BKB.preset=this.value"'))
    + peField('bk_file', 'Statement file (CSV or JSON)', '<input class="inp" type="file" id="bk_file" data-testid="bank-file" accept=".csv,.json,.txt,text/csv,application/json" onchange="bankPick(this)">')
    + '</div><div class="pe-note" data-testid="bank-private">🔒 ' + bkbE(tx('The file is read on this device and is never uploaded.')) + '</div><div id="bk_out" class="pe-slot"></div></div>'
    + '<div id="bk_res" data-testid="bank-res"></div></div>';
  if (BKB.rows.length || BKB.parsed) bankPaint();
}

async function bankPick(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const out = bkbEl('bk_out'); out.innerHTML = '';
  let text;
  try { text = await f.text(); } catch (_) { return peBad('bk_out', tx('That file could not be read.')); }
  const hash = await bkbHash(text);
  const parsed = CBBankRecon.parse(text, { format: 'auto', preset: BKB.preset || undefined });
  if (!parsed || !parsed.ok) { BKB.parsed = null; BKB.rows = []; bkbEl('bk_res').innerHTML = ''; return peBad('bk_out', (parsed && parsed.why) || tx('That file could not be read as a bank statement.')); }
  BKB.file = { name: f.name, hash: hash.slice(0, 16) }; BKB.parsed = parsed; BKB.bal = '';
  const dates = parsed.lines.map((l) => l.date).sort();
  BKB.from = parsed.from || dates[0]; BKB.to = parsed.to || dates[dates.length - 1];
  if (!parsed.lines.length) return peBad('bk_out', tx('There are no transactions in that file.'));
  await bankRun();
}

/** the shop's own bank lines for the statement's dates → the engine's ledger lines */
async function bankLedger() {
  const r = await api('booksLedger', { params: { account: BKB.acct }, query: { from: BKB.from, to: BKB.to } });
  BKB.ledgerRaw = r || {};
  return ((r && r.lines) || []).map((l, i) => ({ id: String(l.ref) + '#' + i, date: l.date, dr_minor: Number(l.dr_minor) || 0, cr_minor: Number(l.cr_minor) || 0,
    ref: (l.source && l.source.how_ref) || null, narration: l.what || '', entry_no: l.ref }));
}
async function bankRun() {
  const res = bkbEl('bk_res'); if (res) res.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + bkbE(tx('Reading…')) + '</div>';
  try { BKB.ledger = await bankLedger(); } catch (e) { if (res) res.innerHTML = ''; return peBad('bk_out', e, tx('Could not read the bank ledger')); }
  const P = BKB.parsed, M = CBBankRecon.match(P.lines.map((l) => l), BKB.ledger, { window_days: 3 });
  BKB.m = M;
  const byLedger = {}; BKB.ledger.forEach((l) => { byLedger[l.id] = l; });
  const rows = [], grouped = {};
  (M.matched || []).forEach((g) => (g.stmt || []).forEach((i) => { grouped[i] = g; }));
  const amb = {}; (M.ambiguous || []).forEach((a) => { amb[a.stmt] = a; });
  const un = {}; (M.unmatched_stmt || []).forEach((s) => { un[s.i] = s; });
  P.lines.forEach((l, i) => {
    const base = { id: 's' + i, i, stmt: l, date: l.date, narration: l.narration, ref: l.ref || l.cheque_no || '', in: (+l.credit_minor || 0) > 0, amount_minor: (+l.credit_minor || 0) || (+l.debit_minor || 0) };
    if (grouped[i]) rows.push(Object.assign(base, { status: 'matched', group: grouped[i], books: (grouped[i].ledger || []).map((id) => byLedger[id]).filter(Boolean) }));
    else if (amb[i]) rows.push(Object.assign(base, { status: 'check', books: (amb[i].candidates || []).map((id) => byLedger[id]).filter(Boolean) }));
    else {
      const sg = CBBankRecon.suggest(un[i] || l, { bank: BKB.preset || undefined });
      rows.push(Object.assign(base, { status: sg && sg.event ? 'suggested' : 'bank-only', sugg: sg }));
    }
  });
  (M.unmatched_ledger || []).forEach((l) => rows.push({ id: 'l' + l.id, status: 'missing', date: l.date, narration: l.narration, ref: l.entry_no, in: (+l.dr_minor || 0) > 0, amount_minor: (+l.dr_minor || 0) || (+l.cr_minor || 0), books: [l] }));
  BKB.rows = rows;
  bankBrs();
  bankPaint();
}

/** the Bank Reconciliation Statement: the books' balance is the API's ledger closing figure; the bank's is the statement's (or typed); the engine states the difference */
function bankBrs() {
  const P = BKB.parsed, last = P.lines[P.lines.length - 1] || {};
  let bank = P.closing_minor != null ? P.closing_minor : (last.balance_minor != null ? last.balance_minor : null);
  if (bank == null && BKB.bal !== '') { const m = bkToMinor(BKB.bal); if (!isNaN(m)) bank = m; }
  BKB.bankKnown = bank != null;
  if (bank == null) { BKB.brs = null; return; }
  BKB.brs = CBBankRecon.brs({ asOf: BKB.to, bookBalance_minor: Number((BKB.ledgerRaw || {}).closing_minor) || 0, bankBalance_minor: bank,
    unmatched_ledger: (BKB.m.unmatched_ledger || []), unmatched_stmt: (BKB.m.unmatched_stmt || []) });
}

function bankPaint() {
  const res = bkbEl('bk_res'); if (!res) return;
  const P = BKB.parsed; if (!P) { res.innerHTML = ''; return; }
  /* the engine's note that a bank's format is not confirmed is for its builders: the shop is told what to do about it */
  const ws = (P.warnings || []).map((w) => /verify against a real file/i.test(w) ? tx('Check the lines against your statement — this bank format is not confirmed yet.') : w);
  const warn = ws.length ? '<div class="pe-warn" data-testid="bank-warn">⚠ ' + bkbE(ws.slice(0, 3).join(' · ')) + (ws.length > 3 ? ' …' : '') + '</div>' : '';
  res.innerHTML = warn + '<div class="tabs" role="tablist">' + [['lines', 'Lines'], ['brs', 'Statement']].map((t) => '<button type="button" class="pe-tab" role="tab" data-testid="bank-tab-' + t[0] + '" aria-pressed="' + (BKB.tab === t[0]) + '" onclick="BKB.tab=\'' + t[0] + '\';bankPaint()">' + bkbE(tx(t[1])) + '</button>').join('') + '</div>'
    + (BKB.tab === 'brs' ? '<div id="bk_brs" data-testid="bank-brs"></div>' : '<div id="bkl_bank" data-testid="bank-list"></div>');
  if (BKB.tab === 'brs') bankBrsPaint(); else bankList();
}

function bankList() {
  const host = bkbEl('bkl_bank'); if (!host) return;
  const own = peOwner(), count = (s) => BKB.rows.filter((r) => r.status === s).length;
  CBList.reset && CBList.reset('bank');
  CBList.mount(host, {
    key: 'bank', t: tx, rows: () => BKB.rows, id: (r) => r.id, rowTid: (r) => 'bank-row-' + r.id,
    head: () => ({ chips: ['matched', 'suggested', 'bank-only', 'missing', 'check'].filter((s) => count(s)).map((s) => ({ tid: 'bank-count-' + s, text: tx(bkbStatus[s][1]) + ' ' + count(s) })),
      notices: (count('suggested') + count('bank-only') + count('check')) ? [{ cls: 'warn', tid: 'bank-notice', text: txf('{n} lines are not in your books', { n: count('suggested') + count('bank-only') + count('check') }) }] : [] }),
    columns: [
      { key: 'status', label: tx('Status'), prio: 1, sort: 'status', w: 190, html: true, cell: (r) => '<span class="step ' + bkbStatus[r.status][0] + '" data-testid="bank-chip-' + bkbE(r.id) + '" data-status="' + r.status + '">' + bkbE(tx(bkbStatus[r.status][1])) + '</span>' },
      { key: 'line', label: tx('Line'), prio: 2, sort: 'line', w: 360, html: true, cell: (r) => '<div>' + bkbE(r.narration || '') + '</div><div style="color:var(--muted);font-size:var(--fs-1)">' + bkbE(bkDate(r.date)) + (r.ref ? ' · <span class="mono">' + bkbE(r.ref) + '</span>' : '') + '</div>' },
      { key: 'amount', label: tx('Amount'), prio: 3, sort: 'amount', num: true, w: 170, html: true, cell: (r) => bkbE(bkMoney(r.amount_minor) + ' ' + tx(r.in ? 'Dr' : 'Cr')) },
      { key: 'entry', label: tx('In your books'), prio: 4, sort: 'entry', w: 180, html: true, cell: (r) => (r.books || []).length ? '<span class="mono">' + bkbE(r.books.map((b) => b.entry_no).join(', ')) + '</span>' : '—' },
    ],
    filters: [{ key: 'status', label: tx('Status'), all: tx('Every status'), options: Object.keys(bkbStatus).map((k) => ({ v: k, label: tx(bkbStatus[k][1]) })), match: (r, v) => r.status === v }],
    search: (r) => [r.narration, r.ref, r.date, bkbStatus[r.status][1], bkMoney(r.amount_minor)].join(' '),
    sorts: [{ key: 'date', label: tx('Date'), cmp: (a, b) => String(a.date).localeCompare(String(b.date)) }, { key: 'status', label: tx('Status'), cmp: (a, b) => String(a.status).localeCompare(String(b.status)) },
      { key: 'amount', label: tx('Amount'), cmp: (a, b) => a.amount_minor - b.amount_minor }],
    next: (r) => bankNext(r),
    actions: own ? [
      { id: 'add', icon: '＋', label: 'Add missing', tid: 'bank-add', when: (r) => (r.status === 'suggested' || r.status === 'bank-only' || r.status === 'check') && !bankIsParty(r), run: (r) => bankAdd(r) },
      { id: 'dues', icon: '₹', label: 'Record it in Dues', tid: 'bank-dues', when: (r) => bankIsParty(r), run: () => bkTab('dues') },
    ] : [],
    empty: { title: tx('Nothing in that file') },
  });
}
const bankIsParty = (r) => !!(r.sugg && r.sugg.event && /^(payment_received|payment_made|cheque_dishonoured)$/.test(r.sugg.event.type));

function bankNext(r) {
  const row = (k, v) => '<div style="display:flex;gap:10px;padding:2px 0"><span style="color:var(--muted);min-width:110px">' + bkbE(tx(k)) + '</span><span>' + v + '</span></div>';
  let h = '<div data-testid="bank-next-' + bkbE(r.id) + '">';
  if (r.status === 'matched') h += (r.books || []).map((b) => row('In your books', '<span class="mono">' + bkbE(b.entry_no) + '</span> · ' + bkbE(bkDate(b.date)) + ' · ' + bkbE(bkMoney(b.dr_minor || b.cr_minor)) + ' · ' + bkbE(b.narration))).join('')
    + row('Matched by', bkbE(tx({ ref: 'the same reference', 'amount+date': 'the same amount and date', many: 'several entries together' }[(r.group || {}).how] || 'a rule'))) ;
  else if (r.status === 'suggested') h += row('Looks like', bkbE(bkbEventWord(r.sugg.event))) + row('Why', bkbE(r.sugg.why || '')) + (bankIsParty(r) ? row('Next', bkbE(tx('Record it as a payment in Dues, so the bill is settled'))) : row('Next', bkbE(tx('Add missing opens the entry for you to check'))));
  else if (r.status === 'check') h += row('Why', bkbE(tx('More than one entry fits this line'))) + (r.books || []).map((b) => row('Could be', '<span class="mono">' + bkbE(b.entry_no) + '</span> · ' + bkbE(bkMoney(b.dr_minor || b.cr_minor)))).join('');
  else if (r.status === 'missing') h += row('Why', bkbE(tx('In your books but not on this statement yet — a cheque not presented, or a later date')));
  else h += row('Why', bkbE((r.sugg && r.sugg.why) ? tx(r.sugg.why) : tx('Nothing in your books matches it'))) + row('Next', bkbE(tx('Add missing opens the entry; you choose what it was')));
  return h + '</div>';
}

/** ＋ Entry with the engine's suggestion filled in; the owner confirms in its preview, and the entry is posted through the API */
function bankAdd(r) {
  const s = r.stmt, ev = (r.sugg && r.sugg.event) || null, v = { date: s.date, amount: bkbMinorText(r.amount_minor), narration: (ev && ev.narration) || ('Bank statement ' + s.date + ': ' + String(s.narration || '').slice(0, 120)) };
  let kind = null;
  if (ev && ev.type === 'expense') { kind = 'expense'; v.class = ev.class; v.paid_from = 'bank'; }
  else if (ev && ev.type === 'other_income') { kind = 'other_income'; v.class = ev.class; v.into = 'bank'; }
  else if (ev && ev.type === 'contra') { kind = 'contra'; v.from = ev.from; v.to = ev.to; }
  if (typeof enOpen !== 'function') return toast(tx('This starts after an update'));
  enOpen({ kind, v, ref: 'bank:' + BKB.file.hash + ':' + (s.row != null ? s.row : s.i + 1) });
}
/* a saved entry → fetch the bank ledger again, so the line is matched (the guard against posting it twice) */
if (typeof BK !== 'undefined') BK.onEntrySaved = () => { if (BK.tab === 'bank' && BKB.parsed) bankRun().catch(() => {}); };

function bankBrsPaint() {
  const host = bkbEl('bk_brs'); if (!host) return;
  if (!BKB.brs) {
    host.innerHTML = '<div class="pe-card" data-testid="bank-bal-ask"><div class="pe-note">' + bkbE(tx('The file does not say the bank\'s closing balance. Type it from the statement.')) + '</div><div class="pe-form">'
      + peField('bk_bal', 'Balance as per the statement', peAmt('bk_bal', BKB.bal)) + '</div><div class="supacts">' + peBtn('bank-bal-go', 'Show the statement', 'BKB.bal=peVal(\'bk_bal\');bankBrs();bankPaint()') + '</div></div>';
    return;
  }
  const b = BKB.brs;
  if (!b.ok) { host.innerHTML = '<div class="pe-bad" data-testid="bank-brs-bad">' + bkbE(b.why) + '</div>'; return; }
  const items = (title, list, tid) => list.length ? '<div class="pe-sub">' + bkbE(tx(title)) + '</div><div class="pe-rows" data-testid="' + tid + '">' + list.map((x) => '<div class="pe-row"><span>' + bkbE(bkDate(x.date)) + ' · ' + bkbE(x.name || '') + (x.ref ? ' · ' + bkbE(x.ref) : '') + '</span><span class="mono">' + bkbE(bkMoney(x.amount_minor)) + '</span></div>').join('') + '</div>' : '';
  host.innerHTML = '<div class="pe-card" data-testid="bank-brs-card"><div class="pe-sub">' + bkbE(txf('Bank statement as at {d}', { d: bkDate(b.asOf) })) + '</div><div class="pe-rows">'
    + b.rows.map((x, i) => '<div class="pe-row" data-testid="brs-row-' + i + '"><span>' + bkbE(tx(x.label)) + '</span><span class="mono">' + bkbE(x.sign === '+' || x.sign === '-' ? bkMoney(Math.abs(x.minor)) : bkDrCr(x.minor)) + '</span></div>').join('') + '</div>'
    + (b.tied ? '<div class="pe-ok" data-testid="brs-tied">✓ ' + bkbE(tx('The books reconcile to the bank: every difference is a named item.')) + '</div>'
      : '<div class="pe-warn" data-testid="brs-untied">⚠ ' + bkbE(b.note || '') + '</div>')
    + items('Cheques issued, not yet presented', b.issued_not_presented || [], 'brs-issued') + items('Cheques deposited, not yet credited', b.deposited_not_credited || [], 'brs-deposited')
    + items('Credits by the bank not in your books', b.bank_credits_not_in_books || [], 'brs-bankcr') + items('Debits by the bank not in your books', b.bank_debits_not_in_books || [], 'brs-bankdr') + '</div>';
}
