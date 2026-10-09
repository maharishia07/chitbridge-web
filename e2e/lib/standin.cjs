/* standin.cjs — the walks' stand-in API (a shop with the Ledger on, nothing waiting, a closed walk-in day, three parties), answered INSIDE the page.
 * Moved out of kural-footer.cjs so frame-every-width.cjs serves the same answers (one stand-in, not two). */
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./contract.cjs'), crmApi = require('./crm-api.cjs'), books = require('./books-api.cjs');
const J = C.json;
const TODAY = new Date().toISOString().slice(0, 10);
const FIX = path.join(__dirname, '..', 'fixtures', 'golden-parties.json');
/* the stand-in: a shop with the Ledger on, nothing waiting, a closed walk-in day (so no notice is on screen), three parties */
const fx = JSON.parse(fs.readFileSync(FIX, 'utf8'));
function standIn(over) {
  return Object.assign({ noClose: false, calls: [] }, over || {});
}
async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  S.calls.push(m + ' ' + p);
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR' } });
  if (p === '/api/books/health') return J(r, 200, books.health());
  if (p === '/api/books/todo') return J(r, 200, []);
  if (p === '/api/books/accounts') return J(r, 200, { accounts: [{ code: '1300', name: 'Customers (Sundry Debtors)', is_group: false }, { code: '1400', name: 'Cash', is_group: false }, { code: '4000', name: 'Sales', is_group: false }].map((a) => books.accountRow(Object.assign({ account_id: 'acc-' + a.code }, a))) });
  if (p === '/api/books/trial-balance') return J(r, 200, books.trialBalance([]));
  if (p === '/api/books/dues') return J(r, 200, books.dues([], { asOf: TODAY }));
  if (p === '/api/books/cheques') return J(r, 200, { currency: 'INR', cheques: [] });
  if (p === '/api/books/daybook') return J(r, 200, books.daybook((S.noClose ? [] : [{ entry_id: 'e1', entry_no: 'JV/1', posting_date: TODAY, event_type: 'walkin_day', narration: 'Walk-in sales',
    source: { kind: 'day', counter: 'C1', count: 11, how: 'Cash', split: [{ how: 'Cash', amount_minor: 124000 }] }, lines: [{ code: '1400', name: 'Cash', dr_minor: 124000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 124000 }] }]).map(books.entry)));
  if (p === '/api/books/pl') return J(r, 200, books.pl([], []));
  if (p === '/api/books/periods') return J(r, 200, books.periods([]));
  if (p === '/api/crm/parties' && m === 'GET') return J(r, 200, crmApi.list(fx.list, { records: fx.records }));
  if (p === '/api/crm/followups') return J(r, 200, crmApi.followups([]));
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}
exports.standIn = standIn; exports.route = route;
