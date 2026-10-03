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
