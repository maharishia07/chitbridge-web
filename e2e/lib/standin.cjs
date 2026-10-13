/* standin.cjs — the walks' stand-in API (a shop with the Ledger on, nothing waiting, a closed walk-in day, three parties), answered INSIDE the page.
 * Moved out of kural-footer.cjs so frame-every-width.cjs serves the same answers (one stand-in, not two).
 * WX-L2C (2026-10-13): WIDENED, not copied, with the L2C routes (leads · calls · outcome · stage · the record · timeline · follow-ups · Log) as a small
 * state machine that mirrors chitbridge-api's rules (routes/crm.js · lib/crm-calls.js OUTCOMES · lib/crm.js isLead): standIn({ l2c: l2cState() }).
 * A walk without `l2c` is answered exactly as before. */
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

/* ═══ L2C — the server's rules, in the page (lib/crm-calls.js OUTCOMES: the days and the stage each outcome moves to; lib/memberships KINDS) ═══ */
const STAGES = ['lead', 'demo', 'trial', 'parked', 'lost'];
const OUTCOMES = [
  { key: 'no_answer', label: 'No answer', days: 1, stage: null, then: 'Ring again' },
  { key: 'call_back', label: 'Call back', days: null, stage: null, then: 'Ring back', ask: true, presets: { today: 0, tomorrow: 1, '3days': 3 } },
  { key: 'interested', label: 'Interested', days: 2, stage: null, then: 'Follow up' },
  { key: 'demo_booked', label: 'Demo booked', days: null, stage: 'demo', then: 'Demo', ask: true, presets: { tomorrow: 1, '3days': 3 } },
  { key: 'not_now', label: 'Not now', days: 30, stage: 'parked', then: 'Ring again' },
  { key: 'wrong_number', label: 'Wrong number', days: null, stage: 'lost', then: null },
];
const NOT_READY = 'Lead stages arrive after the next update.';
const localDay = (d) => { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const today = () => localDay(new Date());
const addDays = (day, n) => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return localDay(d); };
/** a day → the instant the api stores for it: the SHOP's midnight (Asia/Kolkata, the walks' browser zone), never the runner's (the page shows the day, not "12:00 am") */
const dayAt = (day) => new Date(day + 'T00:00:00+05:30').toISOString();
const uuid = (n) => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');

/** the mutable world one walk writes into: leads, their stage history, calls (interactions) and follow-ups */
function l2cState(o) {
  const L = { leads: [], seq: 0, fu: [], ix: [], stages: [], migrated: true, listFails: 0 };
  /* { seed: true }: one untouched lead already there (a view-only login has something to look at, and nothing to do) */
  if (o && o.seed) L.leads.push({ n: 1, party_id: uuid(1), party_no: 'P-0101', name: 'Seed Lead Selvi', phone: '9800000001', stage: 'lead', since: new Date(Date.now() - 86400e3).toISOString(), txn: 0, last_txn_at: null });
  return L;
}
const errBody = (msg, code) => ({ code, error: msg, message: msg });

/** a lead as GET /parties?view=leads sends it: a MINTED party (kind local — with a bridge_id, as the mint gives one) on the customer list, added_via lead */
function leadRow(L, l) {
  const stage = l.txn > 0 ? 'customer' : l.stage;
  return { party_id: l.party_id, display_name: l.name, user_id: '~mayur.cus-' + String(l.n).padStart(4, '0'), bridge_id: 'CBL' + String(l.n).padStart(7, '0'), email: null, phone: l.phone, otp_contact: l.phone, gstn: null, city: null, status: 'active',
    kind: 'local', on_chitbridge: false, may_trade: { ok: false, why: 'local' }, roles: { customer: true, supplier: false }, party_no: l.party_no, last_activity: l.last_at || null,
    customer: { list_id: 'cl-' + l.party_id, segment: 'new', segment_override: null, txn_count: l.txn, last_txn_at: l.txn ? l.last_txn_at : null, groups: [], customer_type: 'entity', added_via: 'lead' },
    lead: { stage, since: l.since }, legal_name: null, nickname: null, state_code: null, tax_ids: [], terms: { customer: { credit_days: null, credit_limit_minor: null } },
    dues: { balance_minor: 0, oldest_due: null, side: 'customer', overdue: false }, gstin: { value: null, source: null, theirs: null, differs: false }, name: l.name };
}
const findLead = (L, id) => L.leads.find((l) => l.party_id === id || l.party_no === id);
const isLead = (l) => l.txn === 0;
function fuRows(L) { return L.fu.map((f) => { const l = findLead(L, f.party_id); return Object.assign({ party_no: l && l.party_no, party_name: l && l.name }, f); }); }
/** the timeline the record reads: calls and notes (interaction), follow-ups made and done — never a stage move (the api sends none; the walk reports it) */
function tlEntries(L, id) {
  const out = [];
  L.ix.filter((x) => x.party_id === id).forEach((x) => out.push({ kind: 'interaction', at: x.at, interaction_id: x.interaction_id, interaction_kind: x.kind, direction: x.direction, body: x.body }));
  L.fu.filter((f) => f.party_id === id).forEach((f) => { out.push({ kind: 'followup', at: f.created_at, followup_id: f.followup_id, what: f.what, due_at: f.due_at }); if (f.done_at) out.push({ kind: 'followup_done', at: f.done_at, followup_id: f.followup_id, what: f.what }); });
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
function addFu(L, party_id, what, day, source) { const f = { followup_id: 'fu-' + (++L.seq), party_id, what, due_at: dayAt(day), assignee_user_id: null, source: source || 'manual', done_at: null, created_at: new Date().toISOString() }; L.fu.push(f); return f; }
function addIx(L, party_id, kind, direction, body) { const x = { interaction_id: 'ix-' + (++L.seq), party_id, kind, direction, body, at: new Date().toISOString(), by_user_id: 'u1' }; L.ix.push(x); return x; }
function setStage(L, l, stage) { l.stage = stage; l.since = new Date().toISOString(); L.stages.push({ party_id: l.party_id, stage, at: l.since }); return { stage, since: l.since }; }

/** the walk's "counter bills the lead": txn_count 1 — the server's rule (isLead: txn_count 0) ends the lead */
function l2cBill(L, name) { const l = L.leads.find((x) => x.name === name); if (!l) return { status: 404, no: '—' }; l.txn = 1; l.last_txn_at = new Date().toISOString(); return { status: 201, no: 'FX/' + l.n, total: 100 }; }
/** the walk's bare POST stage (what the server answers, no page involved) */
function l2cStage(L, name, stage) { const l = L.leads.find((x) => x.name === name); if (!l) return { status: 404, code: 'NOT_FOUND' }; if (!isLead(l)) return { status: 409, code: 'IS_CUSTOMER' }; setStage(L, l, stage); return { status: 200, code: '' }; }
/** a view-only co-assist's session (hat view_only in the token, as lib/access signs it) */
function viewerSession() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'act-2', identity_type: 'actor', parent_entity_id: 'ent-walk', parent_entity_name: 'Mayur Bhavan', display_name: 'Vel', hat: 'view_only', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
  return JSON.stringify({ token, role: 'actor', hat: 'view_only', name: 'Vel', entity: 'Mayur Bhavan', bridgeId: 'CBWALK0001' });
}

/** the L2C routes; null = not one of them (the plain answers below take over) */
function l2cRoute(L, r, q, u, p, m, body) {
  let x;
  if (p === '/api/crm/parties' && m === 'GET' && u.searchParams.get('view') === 'leads') {
    const rows = L.leads.filter(isLead).map((l) => leadRow(L, l));
    return J(r, 200, { parties: L.migrated ? rows : [], walk_ins: [], count: L.migrated ? rows.length : 0, truncated: false, alerts: { dues_overdue: 0 }, leads_migrated: L.migrated });
  }
  if (p === '/api/crm/parties' && m === 'GET') {
    const base = crmApi.list(fx.list, { records: fx.records });   /* the golden parties, plus every lead that has traded (a customer now) */
    const grown = L.leads.filter((l) => !isLead(l)).map((l) => leadRow(L, l));
    return J(r, 200, Object.assign({}, base, { parties: base.parties.concat(grown), count: base.count + grown.length }));
  }
  if (p === '/api/crm/leads' && m === 'POST') {
    if (!L.migrated) return J(r, 503, errBody(NOT_READY, 'LEADS_NOT_MIGRATED'));
    const name = String((body || {}).name || '').replace(/\s+/g, ' ').trim();
    if (!name) return J(r, 400, errBody('Give the lead a name.', 'BAD_NAME'));
    if (L.leads.some((l) => l.name.toLowerCase() === name.toLowerCase())) return J(r, 409, errBody('That name is already on your list.', 'EXISTS'));
    const stage = (body || {}).stage || 'lead'; if (STAGES.indexOf(stage) < 0) return J(r, 400, errBody('That is not one of the stages.', 'BAD_GROUP'));
    const n = L.leads.length + 1, l = { n, party_id: uuid(n), party_no: 'P-01' + String(n).padStart(2, '0'), name, phone: (body || {}).phone || null, stage, since: new Date().toISOString(), txn: 0, last_txn_at: null };
    L.leads.push(l); L.stages.push({ party_id: l.party_id, stage, at: l.since });
    return J(r, 201, { party: { party_id: l.party_id, display_name: name, party_no: l.party_no, kind: 'local', on_chitbridge: false, lead: { stage, since: l.since } } });
  }
  if (p === '/api/crm/calls' && m === 'GET') {
    const t = today(), calls = [];
    L.fu.filter((f) => !f.done_at && f.due_at.slice(0, 10) <= new Date().toISOString().slice(0, 10) && localDay(new Date(f.due_at)) <= t).forEach((f) => { const l = findLead(L, f.party_id); if (!l) return; const d = localDay(new Date(f.due_at)); const last = L.ix.filter((x) => x.party_id === l.party_id && x.kind === 'call').slice(-1)[0];
      calls.push({ party_id: l.party_id, party_name: l.name, phone: l.phone, stage: isLead(l) ? l.stage : 'lead', followup_id: f.followup_id, what: f.what, due_day: d, assignee_user_id: null, new: false, last_outcome: last ? last.body : null, last_at: last ? last.at : null, late: d < t, today: d === t }); });
    L.leads.filter((l) => isLead(l) && !L.ix.some((x) => x.party_id === l.party_id) && !L.fu.some((f) => f.party_id === l.party_id && !f.done_at)).forEach((l) => calls.push({ party_id: l.party_id, party_name: l.name, phone: l.phone, stage: l.stage, followup_id: null, what: null, due_day: null, assignee_user_id: null, new: true, last_outcome: null, last_at: null, late: false, today: false }));
    return J(r, 200, { calls, count: calls.length, late: calls.filter((c) => c.late).length, today: calls.filter((c) => c.today).length,
      outcomes: OUTCOMES.map((o) => ({ key: o.key, label: o.label, ask: !!o.ask, presets: o.presets ? Object.keys(o.presets) : [], moves: o.stage || null })), may: L.migrated ? { ok: true } : { ok: false, why: NOT_READY } });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/outcome$/)) && m === 'POST') {
    const l = findLead(L, decodeURIComponent(x[1])), b = body || {}, o = OUTCOMES.find((k) => k.key === b.outcome);
    if (!o) return J(r, 400, errBody('Pick what happened on the call.', 'BAD_OUTCOME'));
    if (o.stage && !L.migrated) return J(r, 503, errBody(NOT_READY, 'LEADS_NOT_MIGRATED'));
    if (!l) return J(r, 404, errBody('Not your party.', 'NOT_FOUND'));
    const t = today(); let day = null;
    if (o.key !== 'wrong_number') {
      if (o.ask) {
        if (b.due_at) { day = String(b.due_at).slice(0, 10); if (day < t) return J(r, 400, errBody('Pick a day from today.', 'BAD_DUE')); }
        else { const pick = b.after == null || b.after === '' ? (o.key === 'call_back' ? 'tomorrow' : null) : String(b.after); if (pick == null) return J(r, 400, errBody('When is the demo?', 'NEED_DAY')); if (!(pick in o.presets)) return J(r, 400, errBody('Pick today, tomorrow or 3 days.', 'BAD_AFTER')); day = addDays(t, o.presets[pick]); }
      } else day = addDays(t, o.days);
    }
    L.fu.filter((f) => f.party_id === l.party_id && !f.done_at).forEach((f) => { f.done_at = new Date().toISOString(); });
    const interaction = addIx(L, l.party_id, 'call', 'out', o.label);
    const followup = day ? crmApi.followupOne(addFu(L, l.party_id, o.then, day, 'interaction')) : null;
    const stage = o.stage && isLead(l) ? setStage(L, l, o.stage) : null;
    return J(r, 201, { interaction, followup, stage, suggest: null });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/stage$/)) && m === 'POST') {
    if (!L.migrated) return J(r, 503, errBody(NOT_READY, 'LEADS_NOT_MIGRATED'));
    const l = findLead(L, decodeURIComponent(x[1])), stage = String((body || {}).stage || '');
    if (STAGES.indexOf(stage) < 0) return J(r, 400, errBody('That is not one of the stages.', 'BAD_GROUP'));
    if (!l) return J(r, 404, errBody('Not one of your leads.', 'NOT_FOUND'));
    if (!isLead(l)) return J(r, 409, errBody('They are a customer now.', 'IS_CUSTOMER'));
    return J(r, 200, { ok: true, party_id: l.party_id, lead: setStage(L, l, stage) });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/interactions$/)) && m === 'POST') {
    const l = findLead(L, decodeURIComponent(x[1])); if (!l) return J(r, 404, errBody('Not your party.', 'NOT_FOUND'));
    const b = body || {}; return J(r, 201, { interaction: addIx(L, l.party_id, b.kind, b.direction || null, b.body) });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/timeline$/)) && m === 'GET') {
    const l = findLead(L, decodeURIComponent(x[1])); if (!l) return null;
    const es = tlEntries(L, l.party_id), limit = Math.max(1, Math.min(100, Number(u.searchParams.get('limit')) || 30));
    return J(r, 200, { party_id: l.party_id, entries: es.slice(0, limit), next_before: es.length > limit ? es[limit - 1].at : null, migrated: true });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)$/)) && m === 'GET') {
    const l = findLead(L, decodeURIComponent(x[1])); if (!l) return null;
    const row = leadRow(L, l), stage = row.lead.stage;
    row.lead = Object.assign({}, row.lead, { moves: STAGES.filter((g) => g !== stage), may: L.migrated ? { ok: true } : { ok: false, why: NOT_READY } });
    return J(r, 200, Object.assign(row, { merged_from: null, relationship: null, points: null, migrated: true, followups: fuRows(L).filter((f) => f.party_id === l.party_id && !f.done_at).map((f) => crmApi.followupOne(f)) }));
  }
  if (p === '/api/crm/followups' && m === 'GET') {
    const done = u.searchParams.get('done') === '1';
    return J(r, 200, crmApi.followups(fuRows(L).filter((f) => !!f.done_at === done)));
  }
  if (p === '/api/crm/followups' && m === 'POST') {
    const b = body || {}, l = findLead(L, b.party_id); if (!l) return J(r, 404, errBody('Not your party.', 'NOT_FOUND'));
    return J(r, 201, { followup: crmApi.followupOne(addFu(L, l.party_id, b.what, String(b.due_at).slice(0, 10), b.source)) });
  }
  if ((x = p.match(/^\/api\/crm\/followups\/([^/]+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const f = L.fu.find((y) => y.followup_id === decodeURIComponent(x[1])); if (!f) return J(r, 404, errBody('Not your follow-up.', 'NOT_FOUND'));
    if (m === 'DELETE') { L.fu = L.fu.filter((y) => y !== f); return J(r, 200, { ok: true }); }
    const b = body || {}; if (b.done === true) f.done_at = new Date().toISOString(); if (b.due_at) f.due_at = b.due_at; if (b.assignee_user_id !== undefined) f.assignee_user_id = b.assignee_user_id;
    return J(r, 200, { followup: crmApi.followupOne(Object.assign({}, fuRows(L).find((y) => y.followup_id === f.followup_id))) });
  }
  return null;
}

async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  S.calls.push(m + ' ' + p);
  if (S.l2c) { let body = null; try { body = q.postDataJSON(); } catch (_) {} const done = l2cRoute(S.l2c, r, q, u, p, m, body); if (done) return done; }
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
exports.l2cState = l2cState; exports.l2cBill = l2cBill; exports.l2cStage = l2cStage; exports.viewerSession = viewerSession;
