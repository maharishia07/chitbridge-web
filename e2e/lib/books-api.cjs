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
const health = (o) => Object.assign({ enabled: true, currency: 'INR', walkin_grain: 'day', last_check: null, engines: ENGINES, waiting: [] }, o || {});
/** GET /api/books/party/:id/statement */
const statement = (partyId, o) => Object.assign({ currency: 'INR', party_id: partyId, from: '2026-04-01', to: '2026-10-03', code: '1300', opening_minor: 0, closing_minor: 0, lines: [] }, o || {});
/** one row of GET /api/books/dues (balance_minor: + they owe you) */
const dueRow = (o) => Object.assign({ party_no: 'P-00001', name: 'Party', party_id: 'pid', side: 'customer', balance_minor: 0, oldest_due: null, disputed_minor: 0, buckets: { not_due: 0, lt_6m: 0, m6_1y: 0, y1_2: 0, y2_3: 0, gt_3y: 0 } }, o || {});
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
Object.assign(module.exports, { source, posted, ledger, assetRow, recRow, todoRow, eventsAnswer, refusal, daybook });
