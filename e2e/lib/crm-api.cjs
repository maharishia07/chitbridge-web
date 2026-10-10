/**
 * e2e/lib/crm-api.cjs — THE GOLDEN PARTIES, AS chitbridge-api SENDS THEM.
 *
 * e2e/fixtures/golden-parties.json is the designer's seed (docs/design/crm/PLAN.md "golden-parties"): a flat row per party with the design's field names.
 * The API's answers are shaped differently (lib/crm.js assemble · routes/crm.js · lib/crm-followups.js shape): roles an OBJECT, dues one nested object, the
 * customer / supplier sides nested, may_trade { ok, why }, walk-ins in their own list, follow-ups with late / today / due_day / party_listed, a timeline of
 * kind-specific entries. The stand-in used to serve the design's rows as they were, so the page was written to a shape the API never sends (found live
 * 2026-10-03). These builders turn the seed into what the API sends; e2e/contract.cjs holds their output to the contract, and each harness holds
 * everything it serves to it (e2e/lib/contract.cjs). What the API does NOT send (unread counts, contact preferences, mail bounces, per-kind counts, the
 * "late dues" flag, next follow-up on the list) is simply not here: the page must cope with its absence, and the harness proves it does.
 */
'use strict';

/* "@-26h" / "@+3d" → an ISO time relative to the run */
function resolve(x, now) {
  if (typeof x === 'string') { const m = /^@([+-])(\d+)(h|d)$/.exec(x); return m ? new Date(now + (m[1] === '-' ? -1 : 1) * Number(m[2]) * (m[3] === 'h' ? 3600e3 : 86400e3)).toISOString() : x; }
  if (Array.isArray(x)) return x.map((v) => resolve(v, now));
  if (x && typeof x === 'object') { const o = {}; Object.keys(x).forEach((k) => { o[k] = resolve(x[k], now); }); return o; }
  return x;
}
const rolesOf = (r) => (Array.isArray(r) ? { customer: r.indexOf('customer') >= 0, supplier: r.indexOf('supplier') >= 0 } : (r || { customer: false, supplier: false }));
const day = (iso) => (iso ? String(iso).slice(0, 10) : null);
let LISTSEQ = 0;

/** one design row → the API's party row (what assemble() returns per party) */
function party(p, rec) {
  const roles = rolesOf(p.roles), r = rec || {}, cu = r.customer || {}, su = r.supplier || {};
  const gst = (p.tax_ids || []).filter((t) => t.scheme === 'GSTIN')[0];
  const o = {
    party_id: p.party_id, display_name: p.display_name, user_id: p.user_id, bridge_id: p.bridge_id, email: p.email || null, phone: p.phone || null, otp_contact: null, gstn: null, city: p.city || null, status: 'active',
    kind: p.kind, on_chitbridge: !!p.on_chitbridge, may_trade: p.on_chitbridge ? { ok: true } : { ok: false, why: p.why_not || 'local' },
    roles, party_no: p.party_no || null, last_activity: p.last_at || null,
  };
  if (roles.customer) o.customer = { list_id: cu.list_id || 'cl-' + (++LISTSEQ), segment: p.segment || 'new', segment_override: cu.segment_override || null, txn_count: p.txn_count || 0, last_txn_at: p.last_at || null, groups: p.groups || [], customer_type: 'entity', added_via: cu.added_via || 'counter' };
  if (roles.supplier) o.supplier = { list_id: su.list_id || 'sl-' + (++LISTSEQ), category: su.category || null, preferred: !!su.preferred, supply_kind: su.supply_kind || null, notes: su.notes || null, added_via: su.added_via || 'counter' };
  o.legal_name = p.legal_name || null; o.nickname = p.nickname || null; o.state_code = p.state_code || null; o.tax_ids = p.tax_ids || [];
  o.terms = {};
  if (roles.customer) o.terms.customer = { credit_days: cu.credit_days == null ? null : cu.credit_days, credit_limit_minor: cu.credit_limit_minor == null ? null : cu.credit_limit_minor };
  if (roles.supplier) o.terms.supplier = { credit_days: su.credit_days == null ? null : su.credit_days, credit_limit_minor: su.credit_limit_minor == null ? null : su.credit_limit_minor };
  o.dues = p.balance_minor == null ? null : { balance_minor: p.balance_minor, oldest_due: day(p.oldest_due), overdue: p.dues_overdue != null ? !!p.dues_overdue : (p.balance_minor !== 0 && !!p.oldest_due && day(p.oldest_due) < day(new Date().toISOString())), side: roles.customer && roles.supplier ? 'both' : (roles.customer ? 'customer' : 'supplier') };
  const theirs = r.gstn_profile || null, mine = gst ? gst.value : null;
  o.gstin = { value: mine || theirs, source: mine ? 'shop' : (theirs ? 'profile' : null), theirs, differs: !!(mine && theirs && mine !== theirs) };
  o.name = p.nickname || p.display_name;
  return o;
}

/** GET /parties: ONE row per party (the API never sends a merged-away party, and a party on both lists is one row with two roles); walk-ins in their own list.
 *  { careless: true } keeps the design's duplicate and merged rows, to prove the page's own guard (the shape is the same). */
function list(rows, opt) {
  const o = opt || {}, by = new Map(), out = [], walk = [];
  rows.forEach((p) => {
    if (p.kind === 'walk-in') { walk.push({ walk_in: true, party_id: null, kind: 'walk-in', phone: p.phone, points: (p.points && p.points.balance) || 0, last_activity: p.last_at || null }); return; }
    if (p.merged_into) return;                       /* the API never sends a party that was merged away */
    const k = p.party_id;
    if (!o.careless && by.has(k)) { const a = by.get(k); const r = rolesOf(p.roles); a.roles.customer = a.roles.customer || r.customer; a.roles.supplier = a.roles.supplier || r.supplier; return; }
    const a = party(p, o.records && o.records[p.party_id]); by.set(k, a); out.push(a);
  });
  /* a party's sides follow its merged roles: re-derive the nested sides for a both-roles party */
  out.forEach((a) => {
    if (a.roles.customer && !a.customer) a.customer = { list_id: 'cl-' + (++LISTSEQ), segment: 'new', segment_override: null, txn_count: 0, last_txn_at: null, groups: [], customer_type: 'entity', added_via: 'counter' };
    if (a.roles.supplier && !a.supplier) a.supplier = { list_id: 'sl-' + (++LISTSEQ), category: null, preferred: false, supply_kind: null, notes: null, added_via: 'counter' };
    a.terms = a.terms || {};
    if (a.roles.customer && !a.terms.customer) a.terms.customer = { credit_days: null, credit_limit_minor: null };
    if (a.roles.supplier && !a.terms.supplier) a.terms.supplier = { credit_days: null, credit_limit_minor: null };
    a.dues = a.dues ? Object.assign({}, a.dues, { side: a.roles.customer && a.roles.supplier ? 'both' : (a.roles.customer ? 'customer' : 'supplier') }) : null;
  });
  /* the API's own count of late dues: the parties it marked (lib/crm markLate) — the banner and the rows are one number */
  return { parties: out, walk_ins: walk, count: out.length, truncated: false, alerts: { dues_overdue: out.filter((a) => a.dues && a.dues.overdue).length } };
}

/** a follow-up in the API's shape (lib/crm-followups.js shape): late / today / due_day by the shop's day */
function followupOne(f, now) {
  const t = now || Date.now(), d = day(f.due_at), today = day(new Date(t).toISOString());
  return { followup_id: f.followup_id, party_id: f.party_id, party_no: f.party_no || null, party_name: f.party_name || null, party_listed: f.party_removed ? false : true, what: f.what, due_at: f.due_at, due_day: d,
    assignee_user_id: f.assignee_user_id || null, assignee_name: f.assignee_name || null, source: f.source || 'manual', done_at: f.done_at || null, created_at: f.created_at || f.due_at,
    late: !f.done_at && d < today, today: !f.done_at && d === today,
    /* the API's own bucket (lib/crm-followups bucketOf): late · today · the next six days · later — from the day, never the page's clock */
    bucket: d < today ? 'late' : d === today ? 'today' : d <= day(new Date(Date.parse(today) + 6 * 86400e3).toISOString()) ? 'week' : 'later' };
}
function followups(fus, now) {
  const list2 = fus.map((f) => followupOne(f, now));
  return { followups: list2, late: list2.filter((x) => x.late).length, today: list2.filter((x) => x.today).length };
}

/** GET /parties/:id: the party row + merged_from + relationship + points + migrated + this party's open follow-ups */
function record(rows, id, rec, fus, now) {
  const row = rows.filter((x) => x.party_id === id)[0] || rows[0], r = rec || {};
  const merged = rows.filter((x) => x.merged_into === row.party_id)[0];
  const base = party(row, r);
  const pts = r.points || row.points;
  return Object.assign(base, {
    merged_from: merged ? { party_id: merged.party_id, party_no: merged.party_no } : null,
    relationship: row.kind === 'local' ? null : { relationship: { first_at: (r.scorecard && r.scorecard.first_at) || null, last_at: (r.scorecard && r.scorecard.last_at) || null, you_sent: (r.scorecard && r.scorecard.you_sent) || 0, you_received: (r.scorecard && r.scorecard.you_received) || 0, shape: 'both ways' },
      completion: { closed: 0, completed: 0, rejected_or_cancelled: 0, completion_rate_pct: (r.scorecard && r.scorecard.completion_rate_pct) || null } },
    points: pts ? { programme: pts.programme || 'Rewards', points: pts.balance != null ? pts.balance : pts.points, worth: 0 } : null,
    migrated: true,
    followups: (fus || []).filter((f) => f.party_id === id && !f.done_at).map((f) => followupOne(f, now)),
  });
}

/** the design's timeline entry → the API's, kind by kind (routes/crm.js: chit · message · dispute · ledger · interaction · followup · followup_done · change) */
function entry(e, i) {
  const at = e.at;
  switch (e.kind) {
    case 'message': case 'message_internal': return { kind: 'message', at, chit_id: e.chit_id || 'ch-' + i, who: e.by || null, text: e.line };
    case 'chit': case 'bill': return { kind: 'chit', at, chit_id: e.chit_id || 'ch-' + i, direction: e.theirs ? 'in' : 'out', status: String((e.state && e.state.word) || 'sent').toLowerCase(), purpose: 'order', doc_kind: e.kind === 'bill' ? 'bill' : null,
      bill_no: null, title: e.line, value: e.amount_minor != null ? e.amount_minor / 100 : null, currency: e.currency || 'INR', open_disputes: 0 };
    case 'payment': return { kind: 'ledger', at, ref: e.line, ledger_kind: 'receipt', source: 'payment', amount_minor: e.amount_minor == null ? 0 : e.amount_minor, currency: e.currency || 'INR', doc_date: day(at) };
    case 'dispute': return { kind: 'dispute', at, chit_id: e.chit_id || 'ch-' + i, dispute_id: e.id || 'd' + i, status: 'open', category: 'price' };
    case 'call': case 'visit': case 'note': case 'mail': return { kind: 'interaction', at, interaction_id: e.id || 'ix' + i, interaction_kind: e.kind, direction: e.kind === 'note' ? null : (e.theirs ? 'in' : 'out'), body: e.line, by: e.by || null };
    case 'whatsapp': return { kind: 'interaction', at, interaction_id: e.id || 'ix' + i, interaction_kind: 'message', direction: e.theirs ? 'in' : 'out', body: e.line, by: e.by || null };
    case 'followup': return { kind: 'followup', at, followup_id: e.followup_id || e.id, what: e.line, due_at: at };
    default: return { kind: 'change', at, field: e.line, old: null, new: null, by: e.by || null };
  }
}
/** GET /parties/:id/timeline?before=<iso>&limit=<n>: newest first, { party_id, entries, next_before, migrated } - no per-kind counts, no kind / q filters */
function timeline(tl, id, q) {
  const all = ((tl && (tl.many || tl.entries)) || []).map(entry).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const o = q || {}, limit = Math.max(1, Math.min(100, Number(o.limit) || 30)), before = o.before ? Date.parse(o.before) : Infinity;
  const rows = all.filter((e) => Date.parse(e.at) < before), page = rows.slice(0, limit);
  return { party_id: id, entries: page, next_before: rows.length > limit ? page[page.length - 1].at : null, migrated: true };
}
/** POST /parties/:id/interactions → 201 { interaction } */
function interaction(b, now) {
  return { interaction: { interaction_id: 'ix-new', party_id: 'pid', kind: b.kind, direction: b.kind === 'note' ? null : b.direction, body: b.body, at: new Date(now || Date.now()).toISOString(), by_user_id: 'u1', created_at: new Date(now || Date.now()).toISOString() } };
}
module.exports = { resolve, party, list, record, followupOne, followups, entry, timeline, interaction, rolesOf };
