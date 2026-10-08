/**
 * e2e/lib/books-api.cjs — THE CB ACCOUNTS ANSWERS A STAND-IN SERVES, AS chitbridge-api SENDS THEM (routes/books.js).
 *
 * Every harness that answers a /api/books call with a few fields of its own used to invent the shape (a health with no `currency`, a statement with no
 * `from`). The contract (e2e/fixtures/web-api.contract.json) says what the API really sends; these builders return ALL of it, with the harness's own
 * values on top: books.health({ waiting: [..] }). e2e/lib/contract.cjs holds whatever a harness serves to the contract, builders or not.
 */
'use strict';
const ENGINES = { posting: 'injected', packs: 'injected', receivables: 'injected', ledger: 'injected', bookpack: 'injected', period: 'injected' };

/** GET /api/books/health */
/* only the API's keys: a harness's own bookkeeping on the row (stuck, last_posted_day …) stays in the harness, it is not part of the answer */
const only = (defaults, o) => { const out = Object.assign({}, defaults); Object.keys(o || {}).forEach((k) => { if (k in defaults) out[k] = o[k]; }); return out; };
const health = (o) => only({ enabled: true, currency: 'INR', walkin_grain: 'day', last_check: null, engines: ENGINES, waiting: [] }, o);
/** GET /api/books/party/:id/statement */
const statement = (partyId, o) => { const s = Object.assign({ currency: 'INR', party_id: partyId, from: '2026-04-01', to: '2026-10-03', code: '1300', opening_minor: 0, closing_minor: 0, lines: [] }, o || {}); s.lines = s.lines.map((l) => Object.assign({ ref: null, source_chit_id: null }, l, { source: l.source ? Object.assign({ chit_id: null, ref: null, kind: 'bill', counter: null, by: null, count: null, how: null, how_ref: null, split: null, doc_at: null, recorded_at: '2026-10-03T05:00:00.000Z' }, l.source) : null })); return s; };
/** one row of GET /api/books/dues (balance_minor: + they owe you) */
const dueRow = (o) => Object.assign({ party_no: 'P-00001', name: 'Party', party_id: 'pid', side: 'customer', balance_minor: 0, oldest_due: null, disputed_minor: 0 }, o || {}, { buckets: Object.assign({ not_due: 0, y1_2: 0, y2_3: 0, gt_3y: 0 }, (o && o.side === 'supplier') ? { lt_1y: 0 } : { lt_6m: 0, m6_1y: 0 }, (o && o.buckets) || {}) });
/** GET /api/books/dues */
const dues = (parties, o) => Object.assign({ currency: 'INR', asOf: '2026-10-03', parties: (parties || []).map(dueRow), total_minor: (parties || []).reduce((t, p) => t + (p.balance_minor || 0), 0) }, o || {});
/** one row of GET /api/books/periods */
const periodRow = (fy, period, status) => ({ entity_id: 'ent-M', status: status || 'open', fiscal_year: fy, period, start_date: '2026-04-01', end_date: '2026-04-30' });
/** GET /api/books/periods */
const periods = (rows) => ({ periods: rows || [] });
module.exports = { ENGINES, health, statement, dues, dueRow, periods, periodRow };

/* ── the period-end answers ── */
const DAY = new Date().toISOString().slice(0, 10);
/** what every posting route answers beside its own keys: the entry made (lib/books postEntry → { ok, entry_id, entry_no, posting_date, doc_date, moved, lines, items, note }) */
const posted = (o) => Object.assign({ ok: true, entry_id: 'e1', entry_no: 'MJ/26-27/0001', posting_date: DAY, doc_date: DAY, moved: false, lines: 2, items: 0, note: null }, o || {});
/** the `source` of a day book entry or a ledger line (routes/books.js sourceOf): ALL these keys when there is one, null when the entry has no source chit */
const source = (o) => (o ? Object.assign({ chit_id: null, ref: null, kind: 'bill', counter: null, by: null, count: null, how: null, how_ref: null, split: null, doc_at: null, recorded_at: '2026-10-03T05:00:00.000Z' }, o) : null);
/** GET /api/books/ledger/:account */
const ledger = (code, name, lines, o) => Object.assign({ currency: 'INR', account: { code, name, nature: 'asset' }, party: null, from: '2026-04-01', to: DAY, opening_minor: 0,
  lines: (function () { let run = (o && o.opening_minor) || 0; return (lines || []).map((l) => { run += (l.dr_minor || 0) - (l.cr_minor || 0); return Object.assign({ doc_date: l.date, party_id: null, running_minor: run }, l, { source: source(l.source) }); }); })(), closing_minor: 0 }, o || {});
/** one asset register row (lib/books-assets) */
const assetRow = (o) => Object.assign({ entity: 'ent-M', asset_id: 'a1', name: 'Asset', asset_class: 'furniture', cost_minor: 0, currency: 'INR', put_to_use: DAY, source_entry_id: 'e1', source_chit_id: null,
  accumulated_minor: 0, last_dep_fy: null, disposed_on: null, disposal_entry_id: null, proceeds_minor: null, created_by: 'u1', wdv_minor: 0 }, o || {});
/** one repeating-entry template (lib/books-recurring) */
const recRow = (o) => Object.assign({ entity: 'ent-M', recurring_id: 'r1', name: 'Template', event: { kind: 'expense', class: 'rent', amount_minor: 100, paid_from: 'bank' }, frequency: 'monthly', next_on: DAY,
  anchor_day: 1, end_on: null, auto: false, active: true, last_done_on: null, created_by: 'u1', due: false }, o || {});
/** GET /api/books/todo rows always carry items and the action's call */
const todoRow = (x) => Object.assign({ items: [] }, x, { action: Object.assign({ call: 'GET /api/books/health' }, x.action || {}) });
/** GET /api/books/events: every event carries preview/post/ledger_group, every field `required` */
const eventsAnswer = (a) => Object.assign({ pending: [], golden: { personal: { dr: 'Dr the receiver', cr: 'Cr the giver' }, real: { dr: 'Dr what comes in', cr: 'Cr what goes out' }, nominal: { dr: 'Dr expenses and losses', cr: 'Cr incomes and gains' } } }, a, {
  events: (a.events || []).map((e) => Object.assign({ preview: true, post: 'POST /events', ledger_group: null, words: e.kind, icon: 'pen', band: 'adjust' }, e, e.fields ? { fields: e.fields.map((f) => Object.assign({ required: false }, f)) } : {})),
  picks: Object.assign({ mode: [], expense_class: [], income_class: [], blocked_credit: [] }, a.picks) });
/** the refusal body of a 4xx the page shows: { error, message } and a code when the API gives one */
const refusal = (msg, code) => Object.assign({ error: msg, message: msg }, code ? { code } : {});
/** GET /api/books/daybook */
const daybook = (entries, o) => Object.assign({ currency: 'INR', from: DAY, to: DAY, entries: entries || [], count: (entries || []).length }, o || {});
/** a day book entry with every key the API sends (a missing doc_date is the posting date, no reversal, a line with no party / counter / rate says so) */
const entry = (e) => Object.assign({ doc_date: e.posting_date, reverses_entry_id: null }, e, { source: source(e.source), lines: (e.lines || []).map((l) => Object.assign({ party_id: null, party_name: null, counter: null, rate: null }, l)) });
/** the period answer of POST /periods/:fy/:p/lock|unlock */
const lockAnswer = (fy, period, status) => ({ ok: true, period: { fiscal_year: fy, period, status } });
Object.assign(module.exports, { entry, lockAnswer, source, posted, ledger, assetRow, recRow, todoRow, eventsAnswer, refusal, daybook });

/* ── the reads of the books ── */
/** one post waiting for the owner (lib/books-hooks waitingRow) */
const waitingRow = (o) => only({ id: 1, chit_id: null, ref: null, reason: 'Waiting', tries: 0, since: '2026-10-03T05:00:00.000Z', job: 'chit', source: { chit_id: null, ref: null, kind: 'chit', counter: null, by: null } }, o);
/** GET /api/books/trial-balance */
const trialBalance = (rows, o) => { const r = (rows || []).map((x) => Object.assign({ group: 'group' }, x)); const dr = r.reduce((t, x) => t + (x.dr_minor || 0), 0), cr = r.reduce((t, x) => t + (x.cr_minor || 0), 0);
  return Object.assign({ currency: 'INR', asOf: DAY, rows: r, total_dr_minor: dr, total_cr_minor: cr, balanced: dr === cr }, o || {}); };
/** GET /api/books/pl */
const pl = (income, expense, o) => { const inc = (income || []).map((x) => Object.assign({ line: 'Revenue from operations' }, x)), exp = (expense || []).map((x) => Object.assign({ line: 'Other expenses' }, x));
  const ti = inc.reduce((t, x) => t + x.amount_minor, 0), te = exp.reduce((t, x) => t + x.amount_minor, 0);
  return Object.assign({ currency: 'INR', from: '2026-04-01', to: DAY, income: inc, expense: exp, total_income_minor: ti, total_expense_minor: te, profit_minor: ti - te, by_line: { income: [], expense: [] } }, o || {}); };
/** GET /api/books/bs */
const bs = (assets, liabilities, equity, o) => { const a = (assets || []).map((x) => Object.assign({ line: 'Trade receivables' }, x)), l = (liabilities || []).map((x) => Object.assign({ line: 'Trade payables' }, x)), e = (equity || []).map((x) => Object.assign({ line: 'Reserves and surplus' }, x));
  const ta = a.reduce((t, x) => t + x.amount_minor, 0), tl = l.concat(e).reduce((t, x) => t + x.amount_minor, 0);
  return Object.assign({ currency: 'INR', asOf: DAY, assets: a, liabilities: l, equity: e, total_assets_minor: ta, total_liab_equity_minor: tl, profit_to_date_minor: 0, balanced: ta === tl, by_line: { assets: [], liabilities: [] },
    schedule_iii: { equity_and_liabilities: { heads: [], total_minor: tl }, assets: { heads: [], total_minor: ta }, balanced: ta === tl, difference_minor: ta - tl } }, o || {}); };
/** POST /api/books/enable */
const enable = (o) => Object.assign({ ok: true, accounts_added: 80, fiscal_year: '2026-27', parties_numbered: null }, o || {});
/** one account of GET /api/books/accounts */
const accountRow = (o) => Object.assign({ account_id: 'acc', code: '1000', name: 'Account', is_group: false, tally_group: 'Group', nature: 'asset', role: null, parent_code: null, active: true }, o || {});
Object.assign(module.exports, { waitingRow, trialBalance, pl, bs, enable, accountRow });

/* ── payments (M26, chitbridge-api #57): the preview, the one-call record, the 409 ── */
const rs = (minor) => { const v = minor / 100; return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); };
/** the oldest-due-first proposal: bills = [{ against_ref, bill_no, due_date, open_minor, disputed }] (open ones), amount_minor → { proposal, apply_minor, on_account_minor, open_minor } */
const payProposal = (bills, amount_minor) => {
  let left = amount_minor;
  const open = (bills || []).filter((b) => b.open_minor > 0).slice().sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)) || String(a.against_ref).localeCompare(String(b.against_ref)));
  const proposal = open.map((b) => { const a = b.disputed ? 0 : Math.min(left, b.open_minor); left -= a; return { against_ref: b.against_ref, bill_no: b.bill_no, due_date: b.due_date, open_minor: b.open_minor, apply_minor: a, disputed: !!b.disputed }; });
  return { proposal, apply_minor: amount_minor - left, on_account_minor: left, open_minor: open.reduce((t, b) => t + b.open_minor, 0) };
};
/**
 * POST /api/books/payments/preview — as lib/books.js duplicateWarnings answers it:
 *   W1 nothing_owed  open == 0 AND the body means to settle bills (allocate 'oldest_first' or allocations) — owner 2026-10-08: not otherwise
 *   W2 excess        amount > open, unless allocate 'none'        W3/W4: pass them in o.extra (they read the shop's last 24 h, which only the harness knows)
 */
const payWarnings = (prop, body, name, o) => {
  const W = [], allocating = body.allocate === 'oldest_first' || (Array.isArray(body.allocations) && body.allocations.length > 0), out = body.direction === 'out';
  if (prop.open_minor === 0) { if (allocating) W.push({ code: 'nothing_owed', words: 'Nothing is owed ' + (out ? 'to ' : 'by ') + name + '.' }); }
  else if (body.allocate !== 'none' && body.amount_minor > prop.open_minor)
    W.push({ code: 'excess', words: rs(body.amount_minor) + ' is more than the ' + rs(prop.open_minor) + ' open — ' + rs(body.amount_minor - prop.open_minor) + (out ? ' would stay with ' + name + ' as an advance.' : ' would be kept as an advance from ' + name + '.') });
  return W.concat((o && o.extra) || []);
};
const payPreview = (bills, body, name, o) => {
  const prop = payProposal(bills, body.amount_minor), n = prop.proposal.filter((p) => p.apply_minor > 0).length, parts = [];
  if (n) parts.push(rs(prop.apply_minor) + ' settles ' + n + (n === 1 ? ' bill' : ' bills'));
  if (prop.on_account_minor > 0) parts.push(rs(prop.on_account_minor) + (body.direction === 'out' ? ' stays with ' + name + ' as an advance' : ' is kept as an advance from ' + name));
  return { currency: 'INR', party: { party_id: body.party_id, name }, open_minor: prop.open_minor, proposal: prop.proposal, apply_minor: prop.apply_minor, on_account_minor: prop.on_account_minor,
    skipped: [], why: null, warnings: payWarnings(prop, body, name, o), words: parts.join(' · ') || 'Nothing to settle' };
};
/** the 409 a warning not named in acknowledge[] gets (nothing written) */
const alreadyPaid = (warnings, body) => ({ code: 'ALREADY_PAID', error: 'Already paid?', message: 'Already paid? ' + warnings.map((w) => w.words).join(' ')
  + (warnings.some((w) => w.code === 'nothing_owed' || w.code === 'excess') ? ' ' + (body.direction === 'out' ? 'Pay ' : 'Receive ') + rs(body.amount_minor) + ' again as an advance?' : ''), warnings });
/** the 200 of POST /payments: allocations = the list the body gave, else oldest first (allocate 'oldest_first'), else none. entry_no/payment_id/balance_minor from the harness. */
const payRecorded = (bills, body, name, o) => {
  o = o || {};
  const cheque = body.mode === 'cheque', noBills = cheque || body.allocate === 'none';
  const list = noBills ? [] : (Array.isArray(body.allocations) && body.allocations.length ? body.allocations
    : payProposal(bills, body.amount_minor).proposal.filter((p) => p.apply_minor > 0).map((p) => ({ against_ref: p.against_ref, amount_minor: p.apply_minor })));
  const no = (ref) => ((bills || []).find((b) => b.against_ref === ref) || {}).bill_no || null;
  const settled = list.map((a) => ({ against_ref: a.against_ref, bill_no: no(a.against_ref), amount_minor: a.amount_minor })), applied = settled.reduce((t, s) => t + s.amount_minor, 0);
  const on_account = cheque ? 0 : body.amount_minor - applied, out = body.direction === 'out', HOW = { cash: 'cash', upi: 'by UPI', bank: 'by bank', card: 'by card', cheque: 'by cheque' };
  let words = (out ? 'Paid ' : 'Received ') + rs(body.amount_minor) + ' ' + HOW[body.mode] + (out ? ' to ' : ' from ') + name + '.';
  if (cheque) words += ' Held until it clears — the bills are chosen then.';
  else if (settled.length) words += ' Settled ' + settled.length + (settled.length === 1 ? ' bill' : ' bills') + ' (' + rs(applied) + ').';
  if (on_account > 0) words += ' ' + rs(on_account) + (out ? ' left with ' + name + ' as an advance — they owe you this.' : ' kept as an advance from ' + name + ' — you owe them this.');
  const bal = o.balance_minor == null ? 0 : o.balance_minor;
  return { ok: true, payment: { payment_id: o.payment_id || 'pay1', status: cheque ? 'cheque_received' : 'recorded', duplicate: false },
    posted: posted({ entry_no: o.entry_no || 'PY/2026-27/000001' }), allocation: settled.length ? { settled: list, ok: true, items: settled.length * 2, allocated_minor: applied } : null,
    outcome: { words, settled, applied_minor: applied, on_account_minor: on_account, balance_minor: bal, balance_words: bal ? (bal > 0 ? 'they owe you ' : 'you owe ') + rs(Math.abs(bal)) : 'settled' } };
};
Object.assign(module.exports, { rs, payProposal, payWarnings, payPreview, alreadyPaid, payRecorded });
