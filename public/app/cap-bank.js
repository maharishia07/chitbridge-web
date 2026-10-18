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
 *
 * ⭐ BR1 · THE RAIL ALREADY TOLD US (2026-10-13). Each statement line is put against THREE things — the line ↔ the other party's payment chit ↔
 *   the ledger entry (CBBankRecon.explain, engines v1.44.0). GET /api/books/bank/rail brings the advices on my copies (M30) and the bank questions
 *   I asked — the only thing asked of the server is the statement's two dates. States: Settled (their chit + my books: ✓ Accept, one tap) ·
 *   Told (their chit, not in my books: Record — the pay sheet opens with their amount, reference and bills) · In books · Check · Asked ·
 *   Suggested · Needs you. A line nobody explained → ✉ Ask: a message chit to the party ("INR 4,200.00 on 12 Oct, ref R — which bill?"), only
 *   the date, the amount and the reference travel; their advice answers it, for both books. Better than Xero / QBO: they GUESS from amount and
 *   narration; we confirm from a sealed record both sides hold, and ask the payer when nobody did.
 * ⭐ ON THIS DEVICE: the accept marks, notes and the rules learned from what a person confirmed (CBBankRecon.step / learn) live in localStorage,
 *   beside the statement — undo takes an accept back and keeps the notes; a note never blocks accepting; a learned rule is only ever a suggestion,
 *   shown with where it came from. The count of lines that need a person rides to Accounts Home (bankTodoItem) in the same words.
 * CALLED BY accounts.html (Daily › Bank) · app.html (the workshop)
 * // CARD 16-finance/bank-reconciliation-and-bank-rail
 */
'use strict';
const BKB = { acct: '', preset: '', file: null, parsed: null, ledger: null, m: null, rows: [], tab: 'lines', bal: '' };
const bkbE = (v) => esc(v);
const bkbEl = (id) => document.getElementById(id);
const bkbWords = {
  /* what the engine's proposal means, in the shop's words */
  'expense:bank_charges': 'Bank charge',
  'other_income:interest_received': 'Interest received',
  'contra:bank>cash': 'Cash drawn from the bank',
  'contra:cash>bank': 'Cash paid into the bank',
  payment_received: 'Payment received from a customer',
  payment_made: 'Payment made to a supplier',
  cheque_dishonoured: 'Returned cheque'
};
function bkbEventWord(ev) {
  if (!ev) return '';
  const k = ev.type === 'contra' ? 'contra:' + ev.from + '>' + ev.to : ev.type === 'expense' || ev.type === 'other_income' ? ev.type + ':' + ev.class : ev.type;
  return tx(bkbWords[k] || 'Another entry');
}
const bkbStatus = {
  settled: ['green', 'Settled by chit'],
  told: ['blue', 'Party told us'],
  accepted: ['green', 'Accepted'],
  matched: ['green', 'Matched'],
  suggested: ['amber', 'Suggested'],
  'bank-only': ['red', 'Needs you'],
  asked: ['blue', 'Asked'],
  check: ['amber', 'Check'],
  missing: ['blue', 'Not on the statement'],
  'told-only': ['blue', 'Told, not in the bank yet']
};
const BKB_ORDER = ['bank-only', 'check', 'suggested', 'told', 'asked', 'settled', 'matched', 'accepted', 'missing', 'told-only'];
/* ── ON THIS DEVICE: the marks (accept · note · file) of a bank account, and the rules learned — keyed by the shop, never uploaded ── */
const bkbShop = () => {
  try {
    return (typeof SESSION !== 'undefined' && SESSION && SESSION.entityId) || 'shop';
  } catch (_) {
    return 'shop';
  }
};
const bkbKey = (what) => 'cb_bankrec:' + bkbShop() + ':' + what;
function bkbLoad(what, dflt) {
  try {
    const parsed = JSON.parse(localStorage.getItem(bkbKey(what)) || 'null');
    return parsed == null ? dflt : parsed;
  } catch (_) {
    return dflt;
  }
}
function bkbSave(what, v) {
  try {
    localStorage.setItem(bkbKey(what), JSON.stringify(v));
  } catch (_) {}
}
const bkbRec = () => (BKB.rec = BKB.rec || bkbLoad('marks:' + BKB.acct, {}));
const bkbRules = () => (BKB.rules = BKB.rules || bkbLoad('rules', []));
const bkbBy = () => {
  try {
    return (typeof SESSION !== 'undefined' && SESSION && (SESSION.name || SESSION.display_name)) || null;
  } catch (_) {
    return null;
  }
};
function bkbStep(action) {
  const next = CBBankRecon.step(bkbRec(), Object.assign({ at: new Date().toISOString(), by: bkbBy() }, action));
  if (next.why) {
    toast(tx(next.why));
    return false;
  }
  BKB.rec = next;
  bkbSave('marks:' + BKB.acct, next);
  return true;
}
/** a confirmed explanation → a suggestion rule (the newest wins for the same words) */
function bkbLearn(line, x) {
  const r = CBBankRecon.learn(line, x, { at: new Date().toISOString(), by: bkbBy() });
  if (!r.ok) return;
  BKB.rules = bkbRules()
    .filter((y) => y.id !== r.rule.id)
    .concat([r.rule]);
  bkbSave('rules', BKB.rules);
}
const bkbIsBank = (a, groupCode) => !a.is_group && (a.role === 'bank' || (groupCode != null && a.parent_code === groupCode));
function bkbBanks(accts) {
  const main = accts.filter((item) => item.role === 'bank')[0],
    g = main ? main.parent_code : null;
  return accts.filter((item) => bkbIsBank(item, g) && item.active !== false);
}
const bkbMinorText = (m) => bkMinorText(m);
/** the payment mode of the ledger a statement belongs to (its own role: 1520 Card settlements is 'card'); null when the ledger has no mode, so nothing is posted to another account by guess */
function bkbModeOf(accts, code) {
  const a = (accts || []).filter((x) => String(x.code) === String(code))[0];
  return a && /^(cash|bank|upi|card)$/.test(a.role || '') ? a.role : null;
}

/* ── the file: read and hashed on this device ── */
async function bkbHash(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((item) => item.toString(16).padStart(2, '0'))
      .join('');
  } catch (_) {
    let h = 5381;
    for (let index = 0; index < text.length; index++) h = ((h << 5) + h + text.charCodeAt(index)) | 0;
    return ('00000000' + (h >>> 0).toString(16)).slice(-8).repeat(8);
  }
}

async function bankView(body) {
  let accts = [];
  try {
    const reply = await api('booksAccounts');
    accts = (reply && reply.accounts) || [];
  } catch (e) {
    body.innerHTML = '<div class="pe-bad">' + bkErr(e) + '</div>';
    return;
  }
  BKB.accts = accts;
  const banks = bkbBanks(accts);
  if (!banks.length) {
    body.innerHTML = '<div class="pe-note" data-testid="bank-none">' + bkbE(tx('There is no bank ledger yet. Add one under Shop ledgers.')) + '</div>';
    return;
  }
  if (!banks.some((item) => item.code === BKB.acct)) BKB.acct = banks[0].code;
  const presets = Object.keys((window.CBBankRecon && CBBankRecon.PRESETS) || {});
  body.innerHTML =
    '<div class="pe-bank"><div class="pe-card" data-testid="bank-form"><div class="pe-form">' +
    peField(
      'bk_acct',
      'Bank account',
      peSel(
        'bk_acct',
        banks.map((item) => [item.code, item.name]),
        BKB.acct,
        ' onchange="BKB.acct=this.value"'
      )
    ) +
    peField(
      'bk_preset',
      'Which bank',
      peSel(
        'bk_preset',
        [['', 'Find out from the file']].concat(presets.map((item) => [item, CBBankRecon.PRESETS[item].bank])),
        BKB.preset,
        ' onchange="BKB.preset=this.value"'
      )
    ) +
    peField(
      'bk_file',
      'Statement file (CSV or JSON)',
      '<input class="inp" type="file" id="bk_file" data-testid="bank-file" accept=".csv,.json,.txt,text/csv,application/json" onchange="bankPick(this)">'
    ) +
    '</div><div class="pe-note" data-testid="bank-private">🔒 ' +
    bkbE(tx('The file is read on this device and is never uploaded.')) +
    '</div><div id="bk_out" class="pe-slot"></div></div>' +
    '<div id="bk_res" data-testid="bank-res"></div></div>';
  if (BKB.rows.length || BKB.parsed) bankPaint();
}

async function bankPick(inp) {
  const f = inp.files && inp.files[0];
  if (!f) return;
  const out = bkbEl('bk_out');
  out.innerHTML = '';
  let text;
  try {
    text = await f.text();
  } catch (_) {
    return peBad('bk_out', tx('That file could not be read.'));
  }
  const hash = await bkbHash(text);
  const parsed = CBBankRecon.parse(text, { format: 'auto', preset: BKB.preset || undefined });
  if (!parsed || !parsed.ok) {
    BKB.parsed = null;
    BKB.rows = [];
    bkbEl('bk_res').innerHTML = '';
    return peBad('bk_out', (parsed && parsed.why) || tx('That file could not be read as a bank statement.'));
  }
  BKB.file = { name: f.name, hash: hash.slice(0, 16) };
  BKB.parsed = parsed;
  BKB.bal = '';
  const dates = parsed.lines.map((item) => item.date).sort();
  BKB.from = parsed.from || dates[0];
  BKB.to = parsed.to || dates[dates.length - 1];
  if (!parsed.lines.length) return peBad('bk_out', tx('There are no transactions in that file.'));
  await bankRun();
}

/** the shop's own bank lines for the statement's dates → the engine's ledger lines */
async function bankLedger() {
  const reply = await api('booksLedger', { params: { account: BKB.acct }, query: { from: BKB.from, to: BKB.to } });
  BKB.ledgerRaw = reply || {};
  return ((reply && reply.lines) || []).map((item, index) => ({
    id: String(item.ref) + '#' + index,
    date: item.date,
    dr_minor: Number(item.dr_minor) || 0,
    cr_minor: Number(item.cr_minor) || 0,
    ref: (item.source && item.source.how_ref) || null,
    narration: item.what || '',
    entry_no: item.ref,
    chit_id: item.source_chit_id || null
  }));
}
/** BR1: what the other parties already told us for the statement's dates — their advices and my questions. A failure is said, never a blank: the lines still match the books */
async function bankRail() {
  try {
    const r = (await api('booksBankRail', { query: { from: BKB.from, to: BKB.to } })) || {};
    return { chits: r.rail_chits || [], parties: r.parties || [], may: r.may || {}, me: r.me || null, currency: r.currency || null };
  } catch (e) {
    return { chits: [], parties: [], may: {}, failed: true };
  }
}
async function bankRun() {
  const res = bkbEl('bk_res');
  if (res) res.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + bkbE(tx('Reading…')) + '</div>';
  let rail;
  try {
    [BKB.ledger, rail] = await Promise.all([bankLedger(), bankRail()]);
  } catch (e) {
    if (res) res.innerHTML = '';
    return peBad('bk_out', e, tx('Could not read the bank ledger'));
  }
  BKB.rail = rail;
  BKB.rec = null;
  BKB.rules = null;
  bankExplain();
  bankBrs();
  bankPaint();
}
/** the engine puts every line against the party's chit and the books; the page only names the states (no money is computed here) */
function bankExplain() {
  const P = BKB.parsed,
    chits = (BKB.rail.chits || []).map((item) => Object.assign({}, item, { party: item.party && item.party.id ? item.party : null }));
  /* my own advice names its entry: the ledger line of that entry is the third leg (an id join, not a sum) */
  const own = {};
  chits.forEach((item) => {
    const pa = (item.business_json || {}).payment_advice;
    if (item.direction === 'sent' && pa && pa.adviser_entry_no && pa.adviser_payment_id) own[pa.adviser_entry_no] = pa.adviser_payment_id;
  });
  BKB.ledger.forEach((item) => {
    if (own[item.entry_no]) item.payment_id = own[item.entry_no];
  });
  const pays = CBBankRecon.railPayments(chits),
    byChit = {};
  pays.forEach((x) => {
    byChit[x.chit_id] = x;
  });
  const asks = chits
    .filter((item) => item.direction === 'sent' && (item.business_json || {}).kind === 'bank_query' && item.business_json.bank_query)
    .map((item) => ({ key: item.business_json.bank_query.key, chit_id: item.chit_id, party: item.party, at: item.created_at }));
  const M = CBBankRecon.explain(P.lines, BKB.ledger, pays, { window_days: 3, asks, learned: bkbRules(), bank: BKB.preset || undefined });
  BKB.m = {
    unmatched_ledger: M.unmatched_ledger || [],
    unmatched_stmt: M.rows.filter((item) => !item.ledger.length).map((item) => Object.assign({ i: item.i }, P.lines[item.i]))
  };
  const byLedger = {};
  BKB.ledger.forEach((item) => {
    byLedger[item.id] = item;
  });
  const marks = bkbRec().accepted || {},
    rows = [];
  M.rows.forEach((x) => {
    const l = P.lines[x.i],
      st = x.state === 'unexplained' ? 'bank-only' : x.state;
    const status = marks[x.key] && (st === 'settled' || st === 'matched') ? 'accepted' : st;
    rows.push({
      id: 's' + x.i,
      i: x.i,
      key: x.key,
      stmt: l,
      date: l.date,
      narration: l.narration,
      ref: l.ref || l.cheque_no || '',
      in: (+l.credit_minor || 0) > 0,
      amount_minor: +l.credit_minor || 0 || +l.debit_minor || 0,
      status,
      was: st,
      how: x.how,
      x,
      chits: x.chits.map((id) => byChit[id]).filter(Boolean),
      party: x.party || (x.asked && x.asked.party) || null,
      books: (x.state === 'check' ? x.candidates || [] : x.ledger).map((id) => byLedger[id]).filter(Boolean),
      sugg: x.suggestion,
      asked: x.asked
    });
  });
  (M.unmatched_ledger || []).forEach((item) =>
    rows.push({
      id: 'l' + item.id,
      status: 'missing',
      date: item.date,
      narration: item.narration,
      ref: item.entry_no,
      in: (+item.dr_minor || 0) > 0,
      amount_minor: +item.dr_minor || 0 || +item.cr_minor || 0,
      books: [item]
    })
  );
  (M.rail_only || []).forEach((item) =>
    rows.push({
      id: 'r' + item.chit_id,
      status: 'told-only',
      date: item.date,
      narration: item.words || '',
      ref: item.ref || '',
      in: item.side === 'in',
      amount_minor: item.amount_minor,
      chits: [item],
      party: item.party,
      books: []
    })
  );
  BKB.rows = rows;
  BKB.counts = M.counts;
  /* the Home count: what needs a person, from the last statement read on this device */
  bkbSave('todo', { n: M.counts.needs_you, acct: BKB.acct, to: BKB.to });
}

/** the Bank Reconciliation Statement: the books' balance is the API's ledger closing figure; the bank's is the statement's (or typed); the engine states the difference */
function bankBrs() {
  const P = BKB.parsed,
    last = P.lines[P.lines.length - 1] || {};
  let bank = P.closing_minor != null ? P.closing_minor : last.balance_minor != null ? last.balance_minor : null;
  if (bank == null && BKB.bal !== '') {
    const m = bkToMinor(BKB.bal);
    if (!isNaN(m)) bank = m;
  }
  BKB.bankKnown = bank != null;
  if (bank == null) {
    BKB.brs = null;
    return;
  }
  BKB.brs = CBBankRecon.brs({
    asOf: BKB.to,
    bookBalance_minor: Number((BKB.ledgerRaw || {}).closing_minor) || 0,
    bankBalance_minor: bank,
    unmatched_ledger: BKB.m.unmatched_ledger || [],
    unmatched_stmt: BKB.m.unmatched_stmt || []
  });
}

function bankPaint() {
  const res = bkbEl('bk_res');
  if (!res) return;
  const P = BKB.parsed;
  if (!P) {
    res.innerHTML = '';
    return;
  }
  /* the engine's note that a bank's format is not confirmed is for its builders: the shop is told what to do about it */
  const ws = (P.warnings || []).map((item) =>
    /verify against a real file/i.test(item) ? tx('Check the lines against your statement — this bank format is not confirmed yet.') : item
  );
  const warn = ws.length ? '<div class="pe-warn" data-testid="bank-warn">⚠ ' + bkbE(ws.slice(0, 3).join(' · ')) + (ws.length > 3 ? ' …' : '') + '</div>' : '';
  res.innerHTML =
    warn +
    '<div class="tabs" role="tablist">' +
    [
      ['lines', 'Lines'],
      ['brs', 'Statement']
    ]
      .map(
        (item) =>
          '<button type="button" class="pe-tab" role="tab" data-testid="bank-tab-' +
          item[0] +
          '" aria-pressed="' +
          (BKB.tab === item[0]) +
          '" onclick="BKB.tab=\'' +
          item[0] +
          '\';bankPaint()">' +
          bkbE(tx(item[1])) +
          '</button>'
      )
      .join('') +
    '</div>' +
    (BKB.tab === 'brs' ? '<div id="bk_brs" data-testid="bank-brs"></div>' : '<div id="bkl_bank" data-testid="bank-list"></div>');
  if (BKB.tab === 'brs') bankBrsPaint();
  else bankList();
}

function bankList() {
  const host = bkbEl('bkl_bank');
  if (!host) return;
  const own = peOwner(),
    count = (st) => BKB.rows.filter((item) => item.status === st).length,
    need = (BKB.counts || {}).needs_you || 0;
  const may = (BKB.rail && BKB.rail.may && BKB.rail.may.ask) || { ok: false, say: tx('Asking starts after an update') };
  const notices = [];
  if (need) notices.push({ cls: 'warn', tid: 'bank-notice', text: txn('{count} line needs you', '{count} lines need you', need) });
  if (BKB.rail && BKB.rail.failed)
    notices.push({ cls: 'warn', tid: 'bank-rail-failed', text: tx('Could not read what parties told you. Lines are matched to your books only.') });
  CBList.reset && CBList.reset('bank');
  CBList.mount(host, {
    key: 'bank',
    t: tx,
    rows: () =>
      BKB.rows
        .slice()
        .sort((first, second) => BKB_ORDER.indexOf(first.status) - BKB_ORDER.indexOf(second.status) || String(first.date).localeCompare(String(second.date))),
    id: (r) => r.id,
    rowTid: (r) => 'bank-row-' + r.id,
    head: () => ({
      chips: BKB_ORDER.filter((item) => count(item)).map((item) => ({ tid: 'bank-count-' + item, text: tx(bkbStatus[item][1]) + ' ' + count(item) })),
      notices
    }),
    columns: [
      {
        key: 'status',
        label: tx('Status'),
        prio: 1,
        sort: 'status',
        w: 190,
        html: true,
        cell: (r) =>
          '<span class="step ' +
          bkbStatus[r.status][0] +
          '" data-testid="bank-chip-' +
          bkbE(r.id) +
          '" data-status="' +
          r.status +
          '">' +
          bkbE(tx(bkbStatus[r.status][1])) +
          '</span>'
      },
      {
        key: 'line',
        label: tx('Line'),
        prio: 2,
        sort: 'line',
        w: 340,
        html: true,
        cell: (r) =>
          '<div>' +
          bkbE(r.narration || '') +
          '</div><div style="color:var(--muted);font-size:var(--fs-1)">' +
          bkbE(bkDate(r.date)) +
          (r.ref ? ' · <span class="mono">' + bkbE(r.ref) + '</span>' : '') +
          '</div>'
      },
      {
        key: 'amount',
        label: tx('Amount'),
        prio: 3,
        sort: 'amount',
        num: true,
        w: 160,
        html: true,
        cell: (r) => bkbE(tx(r.in ? 'In' : 'Out') + ' ' + bkMoney(r.amount_minor))
      },
      {
        key: 'party',
        label: tx('Told by'),
        prio: 4,
        w: 170,
        html: true,
        cell: (r) =>
          r.chits && r.chits.length
            ? bkbE(
                r.chits
                  .map((item) => (item.party && item.party.name) || tx('A party'))
                  .filter((item, index, a) => a.indexOf(item) === index)
                  .join(', ')
              )
            : r.asked
              ? bkbE(txf('Asked {party}', { party: (r.asked.party && r.asked.party.name) || tx('the party') }))
              : '—'
      },
      {
        key: 'entry',
        label: tx('In your books'),
        prio: 5,
        sort: 'entry',
        w: 170,
        html: true,
        cell: (r) =>
          (r.books || []).length && r.status !== 'check' ? '<span class="mono">' + bkbE(r.books.map((item) => item.entry_no).join(', ')) + '</span>' : '—'
      }
    ],
    filters: [
      {
        key: 'status',
        label: tx('Status'),
        all: tx('Every status'),
        options: BKB_ORDER.map((item) => ({ v: item, label: tx(bkbStatus[item][1]) })),
        match: (r, v) => r.status === v
      }
    ],
    search: (r) => [r.narration, r.ref, r.date, bkbStatus[r.status][1], bkMoney(r.amount_minor), (r.party && r.party.name) || ''].join(' '),
    sorts: [
      { key: 'date', label: tx('Date'), cmp: (a, b) => String(a.date).localeCompare(String(b.date)) },
      { key: 'status', label: tx('Status'), cmp: (a, b) => BKB_ORDER.indexOf(a.status) - BKB_ORDER.indexOf(b.status) },
      { key: 'amount', label: tx('Amount'), cmp: (a, b) => a.amount_minor - b.amount_minor }
    ],
    next: (r) => bankNext(r),
    actions: [
      {
        id: 'accept',
        icon: '✓',
        label: 'Accept',
        tid: 'bank-accept',
        when: (r) => r.status === 'settled' || r.status === 'matched',
        run: (r) => bankAccept(r)
      },
      {
        id: 'record',
        icon: '₹',
        label: 'Record from the chit',
        tid: 'bank-record',
        when: (r) => r.status === 'told',
        why: () => (may.ok ? '' : may.say),
        run: (r) => bankRecord(r)
      },
      {
        id: 'ask',
        icon: '✉',
        label: 'Ask the party',
        tid: 'bank-ask',
        when: (r) => r.status === 'bank-only' || r.status === 'suggested' || r.status === 'check',
        why: () =>
          !may.ok ? may.say : !((BKB.rail && BKB.rail.parties) || []).length ? tx('Nobody on the network to ask. Add it in your books instead.') : '',
        run: (r) => bankAsk(r)
      },
      {
        id: 'add',
        icon: '＋',
        label: 'Add missing',
        tid: 'bank-add',
        when: (r) => own && (r.status === 'suggested' || r.status === 'bank-only' || r.status === 'check') && !bankIsParty(r),
        run: (r) => bankAdd(r)
      },
      {
        id: 'dues',
        icon: '₹',
        label: 'Record it in Dues',
        tid: 'bank-dues',
        when: (r) => own && r.status !== 'told' && bankIsParty(r),
        run: () => bkTab('dues')
      },
      { id: 'undo', icon: '↶', label: 'Undo', tid: 'bank-undo', when: (r) => r.status === 'accepted', run: (r) => bankUndo(r) },
      { id: 'note', icon: '✎', label: 'Note', tid: 'bank-note', when: (r) => !!r.key, run: (r) => bankNote(r) },
      {
        id: 'forget',
        icon: '⨯',
        label: 'Forget this rule',
        tid: 'bank-forget',
        when: (r) => !!(r.sugg && r.sugg.rule === 'learned'),
        run: (r) => bankForget(r)
      }
    ],
    empty: { title: tx('Nothing in that file') }
  });
}
const bankIsParty = (r) => !!(r.sugg && r.sugg.event && /^(payment_received|payment_made|cheque_dishonoured)$/.test(r.sugg.event.type));

/* ── the actions: device marks (accept · undo · note), the ONE books writer (record), the rail (ask) ── */
function bankAccept(r) {
  if (
    !bkbStep({
      act: 'accept',
      key: r.key,
      how: r.how,
      chits: (r.chits || []).map((item) => item.chit_id),
      ledger: (r.books || []).map((item) => item.entry_no)
    })
  )
    return;
  const c = (r.chits || [])[0];
  if (c && c.party && c.party.id) bkbLearn(r.stmt, { party: c.party.id, party_name: c.party.name });
  bankExplain();
  bankPaint();
  toast(tx('Accepted. Undo keeps your notes.'));
}
function bankUndo(r) {
  if (!bkbStep({ act: 'undo', key: r.key })) return;
  bankExplain();
  bankPaint();
  toast(tx('Accept taken back. Your notes stay.'));
}
function bankForget(r) {
  const id = r.sugg && r.sugg.learned_id;
  BKB.rules = bkbRules().filter((y) => y.id !== id);
  bkbSave('rules', BKB.rules);
  bankExplain();
  bankPaint();
  toast(tx('Rule forgotten.'));
}
/** their chit says what was paid and for which bills → the pay sheet opens with it placed; the person presses Record (POST /payments) */
function bankRecord(r) {
  const c = (r.chits || [])[0];
  if (!c || !c.party || !c.party.id) return toast(tx('This chit names no party.'));
  if (typeof payOpen !== 'function') return toast(tx('This starts after an update'));
  bkbLearn(r.stmt, { party: c.party.id, party_name: c.party.name });
  payOpen(r.in ? 'customer' : 'supplier', c.party.id, {
    amount_minor: r.amount_minor,
    mode: bkbModeOf(BKB.accts, BKB.acct) || 'bank',
    reference: c.ref || r.ref || '',
    name: c.party.name || '',
    bills: [].concat.apply(
      [],
      (r.chits || []).map((x) => x.bills || [])
    )
  });
}
function bankNote(r) {
  modal(
    '<div class="mhd"><div class="t">' +
      bkbE(tx('Note on this line')) +
      '</div></div><div class="mbody" style="display:flex;flex-direction:column;gap:8px">' +
      '<div class="pe-note">' +
      bkbE(bkDate(r.date) + ' · ' + tx(r.in ? 'In' : 'Out') + ' ' + bkMoney(r.amount_minor)) +
      '</div>' +
      '<textarea class="inp" id="bk_note" data-testid="bank-note-text" rows="3" style="width:100%" maxlength="500"></textarea>' +
      '<div class="pe-note">' +
      bkbE(tx('Kept on this device. A note never stops you accepting.')) +
      '</div></div>' +
      '<div class="mfoot"><button type="button" onclick="closeModal()">' +
      bkbE(tx('Cancel')) +
      '</button><button type="button" class="pri" data-testid="bank-note-save" onclick="bankNoteSave(\'' +
      bkbE(r.id) +
      '\')">' +
      bkbE(tx('Save note')) +
      '</button></div>'
  );
}
function bankNoteSave(id) {
  const r = BKB.rows.filter((x) => x.id === id)[0],
    t = peVal('bk_note');
  if (!r) return closeModal();
  if (!bkbStep({ act: 'note', key: r.key, text: t })) return;
  closeModal();
  bankPaint();
  toast(tx('Note kept.'));
}
/** ✉ Ask: the engine composes the question (date · amount · reference only); CBAdvice.sendBody sends it (POST /api/chits/send); their advice answers it */
function bankAsk(r) {
  const parties = (BKB.rail && BKB.rail.parties) || [],
    pre = (r.sugg && r.sugg.event && r.sugg.event.party) || '';
  BKB.asking = r.id;
  modal(
    '<div class="mhd"><div class="t" data-testid="bank-ask-title">' +
      bkbE(tx('Ask the party about this line')) +
      '</div></div><div class="mbody" style="display:flex;flex-direction:column;gap:8px">' +
      peField(
        'bk_askto',
        'Who to ask',
        peSel(
          'bk_askto',
          [['', 'Choose a party']].concat(parties.map((item) => [item.party_id, item.name || item.party_id])),
          parties.some((item) => item.party_id === pre) ? pre : '',
          ' onchange="bankAskWords()"'
        )
      ) +
      '<div class="pe-note" data-testid="bank-ask-words" id="bk_askwords"></div>' +
      '<div class="pe-note">' +
      bkbE(tx('Only the date, the amount and the reference are sent. Their payment advice settles it in both books.')) +
      '</div><div id="bk_askout" class="pe-slot"></div></div>' +
      '<div class="mfoot"><button type="button" onclick="closeModal()">' +
      bkbE(tx('Cancel')) +
      '</button><button type="button" class="pri" data-testid="bank-ask-send" onclick="bankAskSend(this)">' +
      bkbE(tx('Send')) +
      '</button></div>'
  );
  bankAskWords();
}
function bankAskBody() {
  const r = BKB.rows.filter((x) => x.id === BKB.asking)[0],
    to = peVal('bk_askto'),
    p = ((BKB.rail && BKB.rail.parties) || []).filter((x) => x.party_id === to)[0];
  if (!r) return { ok: false, why: tx('That line is gone') };
  return CBBankRecon.ask(r.stmt, {
    party: p ? { id: p.party_id, name: p.name } : null,
    currency: (BKB.rail && BKB.rail.currency) || bkCur(),
    me: BKB.rail && BKB.rail.me,
    key: r.key
  });
}
function bankAskWords() {
  const a = bankAskBody(),
    el = bkbEl('bk_askwords');
  if (el) el.textContent = a.ok ? a.words : tx('Choose who to ask.');
}
function bankAskSend(btn) {
  const a = bankAskBody(),
    r = BKB.rows.filter((x) => x.id === BKB.asking)[0];
  if (!a.ok) return peBad('bk_askout', tx('Choose who to ask.'));
  /* the rail's one send of a composed body (rail-advice.js CBAdvice.sendBody) — never a second mint */
  return CBAction.run(btn, () => CBAdvice.sendBody(a.body), {
    key: 'bankask:' + a.key,
    busy: tx('Sending…'),
    failed: tx('Not sent. Try again.'),
    outcome: (chit_id) => {
      const p = ((BKB.rail && BKB.rail.parties) || []).filter((x) => x.party_id === peVal('bk_askto'))[0] || {};
      BKB.rail.chits = (BKB.rail.chits || []).concat([
        {
          chit_id: chit_id || 'local:' + a.key,
          direction: 'sent',
          party: { id: p.party_id, name: p.name },
          created_at: new Date().toISOString(),
          business_json: a.body.business_json,
          line_items: []
        }
      ]);
      if (r) bkbStep({ act: 'note', key: r.key, text: txf('Asked {party}', { party: p.name || '' }) });
      closeModal();
      bankExplain();
      bankPaint();
      toast(txf('Asked {party}. Their payment advice will settle this line.', { party: p.name || tx('the party') }));
    },
    onFail: (words) => peBad('bk_askout', words)
  });
}

function bankNext(r) {
  const row = (k, v) =>
    '<div style="display:flex;flex-wrap:wrap;gap:4px 10px;padding:2px 0"><span style="color:var(--muted);min-width:110px">' +
    bkbE(tx(k)) +
    '</span><span style="min-width:0;overflow-wrap:anywhere">' +
    v +
    '</span></div>';
  const HOW = {
    ref: 'the same reference',
    'amount+date': 'the same amount and date',
    'one-to-many': 'several together',
    'many-to-one': 'several lines together'
  };
  const books = () =>
    (r.books || [])
      .map((item) =>
        row(
          'In your books',
          '<span class="mono">' +
            bkbE(item.entry_no) +
            '</span> · ' +
            bkbE(bkDate(item.date)) +
            ' · ' +
            bkbE(bkMoney(item.dr_minor || item.cr_minor)) +
            ' · ' +
            bkbE(item.narration)
        )
      )
      .join('');
  /* the party's own chit: who, what they said, the bills it settles — the chit opens in the one popup */
  const told = () =>
    (r.chits || [])
      .map(
        (item) =>
          row(
            'Told by',
            bkbE((item.party && item.party.name) || tx('A party')) +
              (item.words ? ' · ' + bkbE(item.words) : '') +
              ' <button type="button" class="cbl-btn" data-testid="bank-open-chit-' +
              bkbE(item.chit_id) +
              '" onclick="openChitSheet(\'' +
              bkbE(item.chit_id) +
              '\')">' +
              bkbE(tx('Open the chit')) +
              '</button>'
          ) +
          ((item.bills || []).length
            ? row(
                'Bills',
                (item.bills || [])
                  .map(
                    (item) =>
                      '<span class="mono">' +
                      bkbE(item.bill_no || item.ref_chit_id) +
                      '</span>' +
                      (item.applied_minor != null ? ' ' + bkbE(bkMoney(item.applied_minor)) : '')
                  )
                  .join(' · ')
              )
            : '')
      )
      .join('');
  let h = '<div data-testid="bank-next-' + bkbE(r.id) + '">';
  if (r.status === 'settled' || (r.status === 'accepted' && r.was === 'settled'))
    h += told() + books() + row('Next', bkbE(tx('Their chit and your books agree. Accept it.')));
  else if (r.status === 'told') h += told() + row('Next', bkbE(tx('Not in your books yet. Record from the chit fills in their amount and bills.')));
  else if (r.status === 'told-only') h += told() + row('Why', bkbE(tx('Their chit says it was paid, but it is not on this statement yet.')));
  else if (r.status === 'matched' || r.status === 'accepted')
    h += books() + row('Matched by', bkbE(tx(HOW[r.how] || 'a rule'))) + row('Told by', bkbE(tx('Nobody sent a chit for it')));
  else if (r.status === 'asked')
    h += row(
      'Asked',
      bkbE(
        txf('{party} on {d}. Their payment advice will settle it.', {
          party: (r.asked.party && r.asked.party.name) || tx('The party'),
          d: bkDate(String(r.asked.at || '').slice(0, 10))
        })
      )
    );
  else if (r.status === 'suggested')
    h +=
      row('Looks like', bkbE(bkbEventWord(r.sugg.event))) +
      row('Why', bkbE(r.sugg.why || '')) +
      (r.sugg.rule === 'learned' && r.sugg.source
        ? row('Learned from', bkbE(txf('{n} on {d}', { n: r.sugg.source.narration || '', d: bkDate(r.sugg.source.date) })))
        : '') +
      (bankIsParty(r)
        ? row('Next', bkbE(tx('Record it as a payment in Dues, or ask the party which bill.')))
        : row('Next', bkbE(tx('Add missing opens the entry for you to check.'))));
  else if (r.status === 'check')
    h +=
      row('Why', bkbE(tx('More than one entry fits this line'))) +
      (r.books || [])
        .map((item) => row('Could be', '<span class="mono">' + bkbE(item.entry_no) + '</span> · ' + bkbE(bkMoney(item.dr_minor || item.cr_minor))))
        .join('');
  else if (r.status === 'missing') h += row('Why', bkbE(tx('In your books but not on this statement yet — a cheque not presented, or a later date')));
  else
    h +=
      row('Why', bkbE(r.sugg && r.sugg.why ? tx(r.sugg.why) : tx('Nobody told you about it and nothing in your books matches it'))) +
      row('Next', bkbE(tx('Ask the party which bill, or add it in your books.')));
  const notes = r.key ? (bkbRec().notes || {})[r.key] || [] : [];
  if (notes.length)
    h +=
      '<div data-testid="bank-notes-' +
      bkbE(r.id) +
      '">' +
      notes.map((item) => row('Note', bkbE(item.text) + (item.at ? ' · ' + bkbE(bkDate(String(item.at).slice(0, 10))) : ''))).join('') +
      '</div>';
  return h + '</div>';
}

/** ＋ Entry with the engine's suggestion filled in; the owner confirms in its preview, and the entry is posted through the API */
function bankAdd(r) {
  const s = r.stmt,
    ev = (r.sugg && r.sugg.event) || null,
    v = {
      date: s.date,
      amount: bkbMinorText(r.amount_minor),
      narration: (ev && ev.narration) || 'Bank statement ' + s.date + ': ' + String(s.narration || '').slice(0, 120)
    };
  let kind = null;
  const mode = bkbModeOf(BKB.accts, BKB.acct); /* the statement's own ledger, never a fixed Bank */
  if (ev && ev.type === 'expense' && mode) {
    kind = 'expense';
    v.class = ev.class;
    v.paid_from = mode;
  } else if (ev && ev.type === 'other_income' && mode) {
    kind = 'other_income';
    v.class = ev.class;
    v.into = mode;
  } else if (ev && ev.type === 'contra' && mode) {
    kind = 'contra';
    v.from = ev.from === 'bank' ? mode : ev.from;
    v.to = ev.to === 'bank' ? mode : ev.to;
  }
  if (typeof enOpen !== 'function') return toast(tx('This starts after an update'));
  BKB.teach = ev && kind ? { line: s, x: { event: ev, label: bkbEventWord(ev) } } : null; /* learned once the entry is SAVED (BK.onEntrySaved) */
  enOpen({ kind, v, ref: 'bank:' + BKB.file.hash + ':' + (s.row != null ? s.row : s.i + 1) });
}
/* a saved entry → fetch the bank ledger again, so the line is matched (the guard against posting it twice) */
if (typeof BK !== 'undefined')
  BK.onEntrySaved = () => {
    if (BK.tab === 'bank' && BKB.parsed) {
      if (BKB.teach) {
        bkbLearn(BKB.teach.line, BKB.teach.x);
        BKB.teach = null;
      }
      bankRun().catch(() => {});
    }
  };
/** BR1 · the Accounts Home to-do row for the bank: the count of lines that need a person, from the last statement read ON THIS DEVICE (the statement never
 *  reaches the server, so the server's To-do cannot count it). Drawn by the Home's own todoRow — the same look, the same words. null when nothing waits. */
function bankTodoItem() {
  const t = bkbLoad('todo', null),
    n = (t && Number(t.n)) || 0;
  if (!n) return null;
  return {
    kind: 'bank',
    count: n,
    words: txn('bank line needs you — from the last statement read on this device', 'bank lines need you — from the last statement read on this device', n),
    action: { screen: 'bank', label: tx('Open Bank') }
  };
}

function bankBrsPaint() {
  const host = bkbEl('bk_brs');
  if (!host) return;
  if (!BKB.brs) {
    host.innerHTML =
      '<div class="pe-card" data-testid="bank-bal-ask"><div class="pe-note">' +
      bkbE(tx("The file does not say the bank's closing balance. Type it from the statement.")) +
      '</div><div class="pe-form">' +
      peField('bk_bal', 'Balance as per the statement', peAmt('bk_bal', BKB.bal)) +
      '</div><div class="supacts">' +
      peBtn('bank-bal-go', 'Show the statement', "BKB.bal=peVal('bk_bal');bankBrs();bankPaint()") +
      '</div></div>';
    return;
  }
  const b = BKB.brs;
  if (!b.ok) {
    host.innerHTML = '<div class="pe-bad" data-testid="bank-brs-bad">' + bkbE(b.why) + '</div>';
    return;
  }
  const items = (title, list, tid) =>
    list.length
      ? '<div class="pe-sub">' +
        bkbE(tx(title)) +
        '</div><div class="pe-rows" data-testid="' +
        tid +
        '">' +
        list
          .map(
            (x) =>
              '<div class="pe-row"><span>' +
              bkbE(bkDate(x.date)) +
              ' · ' +
              bkbE(x.name || '') +
              (x.ref ? ' · ' + bkbE(x.ref) : '') +
              '</span><span class="mono">' +
              bkbE(bkMoney(x.amount_minor)) +
              '</span></div>'
          )
          .join('') +
        '</div>'
      : '';
  host.innerHTML =
    '<div class="pe-card" data-testid="bank-brs-card"><div class="pe-sub">' +
    bkbE(txf('Bank statement as at {d}', { d: bkDate(b.asOf) })) +
    '</div><div class="pe-rows">' +
    b.rows
      .map(
        (x, index) =>
          '<div class="pe-row" data-testid="brs-row-' +
          index +
          '"><span>' +
          bkbE(tx(x.label)) +
          '</span><span class="mono">' +
          bkbE(x.sign === '+' || x.sign === '-' ? bkMoney(Math.abs(x.minor)) : bkDrCr(x.minor)) +
          '</span></div>'
      )
      .join('') +
    '</div>' +
    (b.tied
      ? '<div class="pe-ok" data-testid="brs-tied">✓ ' + bkbE(tx('The books reconcile to the bank: every difference is a named item.')) + '</div>'
      : '<div class="pe-warn" data-testid="brs-untied">⚠ ' + bkbE(b.note || '') + '</div>') +
    items('Cheques issued, not yet presented', b.issued_not_presented || [], 'brs-issued') +
    items('Cheques deposited, not yet credited', b.deposited_not_credited || [], 'brs-deposited') +
    items('Credits by the bank not in your books', b.bank_credits_not_in_books || [], 'brs-bankcr') +
    items('Debits by the bank not in your books', b.bank_debits_not_in_books || [], 'brs-bankdr') +
    '</div>';
}
