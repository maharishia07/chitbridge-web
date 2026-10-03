/* cap-crm.js — CB CRM: the parties list (home), follow-ups, Add party, and the plumbing every CRM screen shares.
 * Loaded by crm.html only (after cap-books.js, list-ctl.js, chit-sheet.js). The record, its timeline and the Log sheet are
 * cap-crm-record.js. docs/design/crm/PLAN.md (Phases 3-4) · REQUIREMENT-home.md · REQUIREMENT-followups.md · the designer handoff,
 * where the FROZEN list standard (docs/design/list-standard, SYSTEM.md §3a) wins: every list here is a CBList mount.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): CBList.mount for every list · partyDueChipHTML + bkMoney/bkDate (cap-books.js) for
 * the dues chip and every amount · openChitSheet (chit-sheet.js) for a chit/bill/message · api() with the EP rows (core.js) · tx/txf ·
 * custAdd / supAdd / entitySearch — the app's own add-a-party endpoints (Add party is ONE field over them, F1).
 * ⭐ ONE CALCULATION (rule 2): this file computes NO money, no "late", no segment, no on-ChitBridge. The dues a row shows are the
 * server's stored `balance_minor`, painted by the chip; "late" is `next_followup_late` / `dues_overdue` / `late` from the server.
 * ⭐ NEW PATHS (rule 4): CRM_EP (the /api/crm/* rows — no reader existed), the row → UI.custs/UI.sups mapping (cap-books.js's editor reads
 * those two lists; the CRM list is the one source and is mapped, not fetched twice), the Add-party and Follow-up sheets (no sheet of
 * either exists; each is one field over the existing endpoints).
 * ⚠️ Never the banned word for the books. A failure says what happened and offers Try again, never error.message.
 */
'use strict';

/* ── the CRM API (chitbridge-api PR #15). The party routes it also calls (custAdd · supAdd · custGroup · supPatch · supDel · entitySearch) are CB_PARTY_EP in accounts-shell.js ── */
var CRM_EP = {
  crmParties:    { m: 'GET',    p: '/api/crm/parties',                     ok: 'y' },   // { parties:[…], alerts:{…} } — one read, no per-row fetch
  crmParty:      { m: 'GET',    p: '/api/crm/parties/:id',                 ok: 'y' },   // the list row + contacts · prefs · followups · timeline_head …
  crmTimeline:   { m: 'GET',    p: '/api/crm/parties/:id/timeline',        ok: 'y' },   // ?kind=&q=&before= — server-paged, 50 a page
  crmLog:        { m: 'POST',   p: '/api/crm/parties/:id/interactions',    ok: 'y' },   // 503 "not migrated yet" before b276
  crmFollowups:  { m: 'GET',    p: '/api/crm/followups',                   ok: 'y' },   // ?scope=mine|all&done=0|1
  crmFollowAdd:  { m: 'POST',   p: '/api/crm/followups',                   ok: 'y' },
  crmFollowSet:  { m: 'PATCH',  p: '/api/crm/followups/:id',               ok: 'y' },   // { done:true } · { due_at } · { assignee_user_id }
  crmFollowDel:  { m: 'DELETE', p: '/api/crm/followups/:id',               ok: 'y' },
  custDel:       { m: 'DELETE', p: '/api/relationships/customers/:id',     ok: 'y' },   // new: customers had no remove route (same shape as supDel)
};

var CRM = { gen: 0, loadGen: 0, rows: [], byKey: {}, alerts: {}, currency: 'INR', state: 'loading', err: null, loaded: false, api: null,
  fu: [], fuState: 'loading', fuErr: null, fuScope: null, fuDone: false, coAssists: [], fuApi: null };

/* ── who is looking: the shop's own session is the owner; a co-assist edits unless their hat is a reading one (lib/access.js) ── */
function crmOwner() { return SESSION.role === 'entity'; }
/** the co-assist's hat rides in their signed token (lib/access.js); the session record does not keep it, so it is read from the token's own payload */
function crmHat() {
  if (SESSION.hat) return String(SESSION.hat);
  try { var b = String(SESSION.token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); var c = JSON.parse(atob(b)); return String(c.hat || c.actor_hat || ''); } catch (_) { return ''; }
}
function crmRole() {
  if (crmOwner()) return 'owner';
  return /^(view_only|view|viewer|audit|mis|comment|commenter)$/i.test(crmHat()) ? 'viewer' : 'editor';
}
function crmEdit() { return crmRole() !== 'viewer'; }

/* ── small things every screen uses ── */
function crmKey(p) { return p.party_no || p.party_id; }
function crmDay0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
/** Today · Yesterday · Tomorrow, else the date in the reader's locale (a label for a day, never a verdict: "late" is the server's word) */
function crmDayWord(iso) {
  var d = new Date(iso); if (isNaN(d)) return '';
  var n = Math.round((crmDay0(d) - crmDay0(new Date())) / 86400000);
  return n === 0 ? tx('Today') : n === -1 ? tx('Yesterday') : n === 1 ? tx('Tomorrow') : bkDate(iso);
}
function crmWhen(iso) {
  if (!iso) return '—';
  var w = crmDayWord(iso), d = new Date(iso), n = Math.round((crmDay0(d) - crmDay0(new Date())) / 86400000);
  return (n >= -1 && n <= 1) ? w + ' ' + bkTime(iso) : w;
}
function crmLocalISO(d) { var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function crmPlural(n, one, many) { return n + ' ' + (n === 1 ? tx(one) : tx(many)); }

var CRM_ICON = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  msg: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5', bill: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4', pay: 'M3 7h18v10H3zM3 11h18M7 15h3',
  flag: 'M5 21V4M5 5h12l-2 4 2 4H5', pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  wa: 'M4 20l1.5-4A8 8 0 1 1 8 18.5zM9 9c0 3 3 6 6 6l1-2-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z', note: 'M5 3h10l4 4v14H5zM8 11h8M8 15h6',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2', pencil: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  link: 'M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1',
  house: 'M3 11l9-7 9 7M5 10v10h14V10', walk: 'M12 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 21l2-6-2-3 1-4 3 3 3 1M9 12l-3 2', chit: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01', plus: 'M12 5v14M5 12h14', dots: 'M5 12h.01M12 12h.01M19 12h.01', check: 'M5 12l5 5 9-10',
};
function crmIcon(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (CRM_ICON[k] || CRM_ICON.note) + '"/></svg>'; }

/* ── the chips: a status is an icon AND a word; the server's verdict (on_chitbridge · why_not · kind) decides, the page only words it ── */
function crmRailChip(p) {
  if (p.kind === 'walk-in') return '<span class="tag walk" title="' + esc(tx('Phone only — points at the counter')) + '">' + crmIcon('walk') + esc(tx('Walk-in')) + '</span>';
  if (p.on_chitbridge) return '<span class="tag on" title="' + esc(tx('Bills and messages reach them in their app')) + '">' + crmIcon('link') + esc(tx('On ChitBridge')) + '</span>';
  var w = p.why_not === 'inactive' ? tx('Account inactive') : p.why_not === 'other_population' ? tx('Test space') : p.why_not === 'shopper' ? tx('Shopper account') : tx('Local');
  return '<span class="tag local" title="' + esc(tx('Not on ChitBridge — bills are yours only')) + '">' + crmIcon('house') + esc(w) + '</span>';
}
var CRM_ROLE = { customer: 'Customer', supplier: 'Supplier' };
function crmRoleChips(p) { return (p.roles || []).map(function (r) { return '<span class="tag role">' + esc(tx(CRM_ROLE[r] || r)) + '</span>'; }).join(''); }
var CRM_SEG = { new: 'New', regular: 'Regular', inactive: 'Inactive', high_value: 'High value' };
function crmSegChip(p) { return p.segment ? '<span class="tag seg">' + esc(tx(CRM_SEG[p.segment] || p.segment)) + '</span>' : ''; }
/** the dues chip is cap-books.js's own (partyDueChipHTML); the CRM row's stored balance is mapped into its map by crmDuesMap() — the number is never summed here */
function crmDueCell(p) {
  if (!CRM.ledger || p.balance_minor == null) return '<span class="sub">—</span>';
  return '<span style="white-space:nowrap">' + partyDueChipHTML(p.party_id, { noNo: true }) + (p.dues_overdue ? ' <span class="late">· ' + esc(tx('late')) + '</span>' : '') + '</span>';
}
function crmFuCell(p) {
  if (!p.next_followup_at) return '<span class="sub">—</span>';
  return '<span' + (p.next_followup_late ? ' class="late"' : '') + '>' + (p.next_followup_late ? esc(tx('Late')) + ' · ' : '') + esc(crmWhen(p.next_followup_at)) + '</span>';
}
function crmPartyCell(p) {
  return '<div class="pcell"><div class="l1">' + (p.unread ? '<span class="udot" title="' + esc(crmPlural(p.unread, 'unread message', 'unread messages')) + '"></span>' : '')
    + '<span class="nm" data-testid="crm-name">' + esc(p.display_name) + '</span>' + (p.party_no ? '<span class="pno" data-testid="crm-no">' + esc(p.party_no) + '</span>' : '') + '</div>'
    + '<div class="l2">' + crmRoleChips(p) + crmRailChip(p) + '</div></div>';
}

/* ═══ THE READ — one call, one row per party ═════════════════════════════════════════════════════════════════════ */
/** the page's own guard on the list (the server already does both): a merged party is never a row; the same party twice is one row with both roles */
function crmNormalize(parties) {
  var by = {}, out = [];
  (parties || []).forEach(function (p) {
    if (!p || p.merged_into) return;
    var k = p.party_id, seen = by[k];
    if (seen) { (p.roles || []).forEach(function (r) { if (seen.roles.indexOf(r) < 0) seen.roles.push(r); }); return; }
    p.roles = (p.roles || []).slice(); p.groups = p.groups || []; p.tax_ids = p.tax_ids || [];
    by[k] = p; out.push(p);
  });
  return out;
}
/** map the stored balances into the dues map cap-books.js's chip, label and ledger block read, and the rows into the two lists its party editor reads — once per read */
function crmIndex() {
  CRM.byKey = {};
  CRM.rows.forEach(function (p) { CRM.byKey[p.party_id] = p; if (p.party_no) CRM.byKey[p.party_no] = p; });
  bkDuesStore({ currency: CRM.currency, parties: CRM.rows.filter(function (p) { return p.balance_minor != null; }).map(function (p) {
    return { party_id: p.party_id, party_no: p.party_no, name: p.display_name, balance_minor: p.balance_minor, oldest_due: p.oldest_due, side: p.roles.length > 1 ? 'both' : p.roles[0] }; }) });
  var mk = function (p, kind) { return { customer_identity_id: kind === 'customer' ? p.party_id : undefined, supplier_entity_id: kind === 'supplier' ? p.party_id : undefined, display_name: p.display_name, nickname: p.nickname, legal_name: p.legal_name,
    party_no: p.party_no, tax_ids: p.tax_ids, state_code: p.state_code, credit_days: null, credit_limit_minor: null }; };
  UI.custs = CRM.rows.filter(function (p) { return p.roles.indexOf('customer') >= 0; }).map(function (p) { return mk(p, 'customer'); });
  UI.sups = CRM.rows.filter(function (p) { return p.roles.indexOf('supplier') >= 0; }).map(function (p) { return mk(p, 'supplier'); });
}
/** what a failure says; a migration answer is a state, never a stack trace (409 on /api/crm/* · 503 on calls and follow-ups) */
function crmErrWords(e, what) {
  var st = e && e.status;
  if (st === 409) return crmOwner() ? { title: tx('CB CRM needs one database step (b276).'), sub: tx('Run the update, then try again. Nothing is lost.') } : { title: tx('Ask the owner to finish setting up CB CRM.'), sub: '' };
  if (st === 503) return { title: tx('Calls and follow-ups start after an update.'), sub: tx('Nothing is lost.') };
  return { title: tx("Couldn't load " + what + "."), sub: tx('Check the connection and try again.') };
}
async function crmLoad(quiet) {
  var g = ++CRM.loadGen;
  if (!quiet || !CRM.loaded) { CRM.state = 'loading'; crmRefresh(); }
  try {
    var r = await api('crmParties');
    if (g !== CRM.loadGen) return;
    var rows = (r && r.parties) || (Array.isArray(r) ? r : []);
    CRM.rows = crmNormalize(rows); CRM.alerts = (r && r.alerts) || {}; CRM.currency = (CRM.rows[0] && CRM.rows[0].currency) || CRM.currency;
    crmIndex(); CRM.state = 'ready'; CRM.loaded = true; CRM.err = null;
  } catch (e) {
    if (g !== CRM.loadGen) return;
    if (CRM.loaded) { CRM.state = 'ready'; } else { CRM.state = 'error'; CRM.err = e; }
  }
  crmNav(CRM.route && CRM.route.nav); crmRefresh();
}
function crmRefresh() { var a = CRM.api; if (a && a.el && document.body.contains(a.el)) a.refresh(); }

/* ═══ THE SHELL'S PARTS: sidebar, the bar's one action, the router ═══════════════════════════════════════════════ */
function crmNav(active) {
  var late = Number((CRM.alerts || {}).followups_overdue) || 0;   // the server's number — the same one the alert line shows
  var items = [['parties', 'Parties', 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 3.6-6 8-6s8 2 8 6', CRM.loaded ? '<span class="n quiet" data-testid="crm-nav-n-parties">' + CRM.rows.length + '</span>' : ''],
    ['followups', 'Follow-ups', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2', late ? '<span class="n" data-testid="crm-nav-n-followups" title="' + esc(crmPlural(late, 'late follow-up', 'late follow-ups')) + '">' + late + '</span>' : '']];
  document.getElementById('nav').innerHTML = items.map(function (x) {
    return '<a class="nav-btn' + (x[0] === active ? ' active' : '') + '" href="#/' + x[0] + '" data-testid="crm-nav-' + x[0] + '" aria-label="' + esc(tx(x[1])) + '"' + (x[0] === active ? ' aria-current="page"' : '') + '>'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + x[2] + '"/></svg><span class="label">' + esc(tx(x[1])) + '</span>' + x[3] + '</a>';
  }).join('');
}
function crmBar(crumb, action, overlay) {
  var m = document.querySelector('.main'); if (m) m.classList.toggle('overbar', !!overlay);
  document.getElementById('crumb').innerHTML = crumb || '';
  var a = document.getElementById('crm-bar-act'); if (a) a.innerHTML = action || '';
}
function crmAddBtn() { return crmEdit() ? '<button type="button" class="act sm" data-testid="crm-add" data-crm="add">+ ' + esc(tx('Add party')) + '</button>' : ''; }
function crmAddFuBtn() { return crmEdit() ? '<button type="button" class="act sm" data-testid="crm-fu-add" data-crm="fuadd">+ ' + esc(tx('Add follow-up')) + '</button>' : ''; }
function crmGo(hash, replace) { if (replace) { try { history.replaceState(null, '', hash); } catch (_) {} crmRoute(); } else location.hash = hash; }

function crmRoute() {
  var h = (location.hash || '').replace(/^#\/?/, ''), q = '', qi = h.indexOf('?');
  if (qi >= 0) { q = h.slice(qi + 1); h = h.slice(0, qi); }
  var seg = h.split('/').filter(Boolean).map(decodeURIComponent), params = {};
  q.split('&').forEach(function (kv) { if (kv) { var a = kv.split('='); params[a[0]] = decodeURIComponent(a[1] || ''); } });
  closeModal();
  if (seg[0] === 'party' && seg[1]) {
    CRM.route = { nav: 'parties', view: 'party', key: seg[1], sub: seg[2] || '', params: params };
    return crmRecordOpen(CRM.route);
  }
  if (seg[0] === 'followups') {
    CRM.route = { nav: 'followups', view: 'followups', sub: seg[1] || '', params: params };
    crmNav('followups'); crmFollowups();
    if (seg[1] === 'add') crmFuAddOpen(params.party);
    return;
  }
  CRM.route = { nav: 'parties', view: 'parties', sub: seg[1] || '', params: params };
  crmNav('parties'); crmHome();
  if (seg[1] === 'add') crmAddOpen(params.q || '');
}

/* ═══ 1 · HOME — the parties list (a CBList mount: the Task table's look, one row per party) ═════════════════════ */
function crmPartyCols() {
  var cols = [{ key: 'party', label: 'Party', prio: 1, w: 320, sort: 'name', html: true, cell: crmPartyCell, value: function (p) { return p.display_name; } }];
  if (CRM.ledger) cols.push({ key: 'dues', label: 'Dues', prio: 2, w: 180, sort: 'dues', html: true, cell: crmDueCell, value: function (p) { return p.balance_minor == null ? '' : p.balance_minor; } });
  cols.push(
    { key: 'next', label: 'Next follow-up', prio: 3, w: 170, html: true, cell: crmFuCell, value: function (p) { return p.next_followup_at || ''; } },
    { key: 'last', label: 'Last activity', prio: 4, w: 150, sort: 'last', html: true, cell: function (p) { return p.last_at ? esc(crmWhen(p.last_at)) : '<span class="sub">—</span>'; }, value: function (p) { return p.last_at || ''; } },
    { key: 'seg', label: 'Segment · groups', prio: 5, w: 190, html: true, cell: function (p) { return (crmSegChip(p) + (p.groups || []).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join(' ')) || '<span class="sub">—</span>'; }, value: function (p) { return [p.segment].concat(p.groups || []).join(' '); } },
    { key: 'phone', label: 'Phone', prio: 6, w: 160, cell: function (p) { return p.phone || '—'; } },
    { key: 'email', label: 'E-mail', prio: 7, w: 220, cell: function (p) { return p.email || '—'; } },
    { key: 'gstin', label: 'GSTIN', prio: 8, w: 190, mono: true, cell: function (p) { var g = (p.tax_ids || []).filter(function (t) { return t.scheme === 'GSTIN'; })[0]; return g ? g.value : '—'; } },
    { key: 'city', label: 'City', prio: 9, w: 140, cell: function (p) { return p.city || '—'; } });
  return cols;
}
function crmGroupNames() { var s = {}; CRM.rows.forEach(function (p) { (p.groups || []).forEach(function (g) { s[g] = 1; }); }); return Object.keys(s).sort(); }
function crmFilters() {
  var f = [
    { key: 'role', label: tx('Role'), all: tx('All roles'), options: [{ v: 'customer', label: tx('Customers') }, { v: 'supplier', label: tx('Suppliers') }, { v: 'both', label: tx('Both') }], match: function (p, v) { return v === 'both' ? p.roles.length === 2 : p.roles.indexOf(v) >= 0; } },
    { key: 'rail', label: tx('ChitBridge'), all: tx('All'), options: [{ v: 'on', label: tx('On ChitBridge') }, { v: 'local', label: tx('Local') }, { v: 'walk', label: tx('Walk-in') }], match: function (p, v) { return v === 'on' ? !!p.on_chitbridge : v === 'walk' ? p.kind === 'walk-in' : (!p.on_chitbridge && p.kind !== 'walk-in'); } },
    { key: 'seg', label: tx('Segment'), all: tx('Any segment'), options: Object.keys(CRM_SEG).map(function (k) { return { v: k, label: tx(CRM_SEG[k]) }; }), match: function (p, v) { return p.segment === v; } },
    { key: 'group', label: tx('Group'), all: tx('Any group'), options: crmGroupNames(), match: function (p, v) { return (p.groups || []).indexOf(v) >= 0; } },
  ];
  if (CRM.ledger) f.push({ key: 'dues', label: tx('Dues'), all: tx('Any'), options: [{ v: 'has', label: tx('Has dues') }, { v: 'late', label: tx('Dues late') }], match: function (p, v) { return v === 'late' ? !!p.dues_overdue : !!p.balance_minor; } });
  f.push({ key: 'fu', label: tx('Follow-up'), all: tx('Any'), options: [{ v: 'due', label: tx('Follow-up due') }, { v: 'late', label: tx('Follow-up late') }], match: function (p, v) { return v === 'late' ? !!p.next_followup_late : !!p.next_followup_at; } });
  return f;
}
function crmPartySorts() {
  var by = function (f, rev) { return function (a, b) { var x = f(a), y = f(b); return rev ? (y > x ? 1 : y < x ? -1 : 0) : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }); }; };
  return [{ key: 'name', label: tx('Name'), cmp: by(function (p) { return p.display_name; }) },
    { key: 'last', label: tx('Last activity'), cmp: by(function (p) { return p.last_at || ''; }, true) },
    { key: 'dues', label: tx('Dues'), cmp: by(function (p) { return Math.abs(p.balance_minor || 0); }, true) },   // an ordering of the server's figures, not a sum
    { key: 'newest', label: tx('Newest'), cmp: by(function (p) { return p.party_no || ''; }, true) }];
}
/** the alert line: only failing things, each with the button that fixes it (SYSTEM rule 1). "duplicates" waits for its screen (Phase 6). */
function crmNotices() {
  var a = CRM.alerts || {}, out = [], fu = Number(a.followups_overdue) || 0, du = Number(a.dues_overdue) || 0;
  if (fu > 0) out.push({ text: crmPlural(fu, 'follow-up late', 'follow-ups late') + ' · ' + tx('Open follow-ups'), cls: 'warn', tid: 'crm-alert-followups', onOpen: function () { crmGo('#/followups'); } });
  if (CRM.ledger && du > 0) out.push({ text: crmPlural(du, 'party with late dues', 'parties with late dues') + ' · ' + tx('See dues'), cls: 'warn', tid: 'crm-alert-dues', onOpen: function () { location.href = '/accounts.html#dues'; } });
  return out;
}
function crmPeek(p) {
  var g = (p.tax_ids || []).filter(function (t) { return t.scheme === 'GSTIN'; })[0];
  var rows = [[tx('Phone'), p.phone], [tx('E-mail'), p.email], [tx('GSTIN'), g && g.value], [tx('City'), p.city], [tx('Last activity'), p.last_at && crmWhen(p.last_at)],
    [tx('Points'), p.points && p.points.balance != null ? p.points.balance : null]].filter(function (r) { return r[1] != null && r[1] !== ''; });
  return '<div data-testid="crm-peek-' + esc(crmKey(p)) + '">' + (rows.length ? rows.map(function (r) { return CBList.nextRow(['<span style="color:var(--muted)">' + esc(r[0]) + '</span> ' + esc(r[1])], []); }).join('') : '<div style="color:var(--muted);font-size:var(--fs-1)">' + esc(tx('Nothing more is recorded')) + '</div>') + '</div>';
}
function crmHome() {
  crmBar('<strong>' + esc(tx('CB CRM')) + '</strong>', crmAddBtn(), true);
  var s = document.getElementById('screen'); s.className = 'screen flush';
  s.innerHTML = '<div id="crm_list" data-testid="crm-list"></div>';
  if (CRM.api && CRM.api.destroy) { try { CRM.api.destroy(); } catch (_) {} }
  CRM.api = CBList.mount(document.getElementById('crm_list'), {
    key: 'crm-parties', t: tx, rows: function () { return CRM.rows; }, id: function (p) { return p.party_id; }, rowTid: function (p) { return 'crm-row-' + crmKey(p); },
    columns: crmPartyCols, defaultCols: CRM.ledger ? ['party', 'dues', 'next'] : ['party', 'last', 'next'], cardMax: 3,
    head: function () { return { title: tx('Parties'), notices: CRM.state === 'ready' ? crmNotices() : [] }; },
    state: function () { return CRM.state; }, error: function () { return crmErrWords(CRM.err, 'your parties'); }, onRetry: function () { crmLoad(); },
    empty: { title: tx('No parties yet'), sub: tx('Customers appear when you bill them; suppliers when you add them. Use + Add party.') },
    search: function (p) { return [p.display_name, p.nickname, p.legal_name, p.party_no, p.user_id, p.phone, p.email, (p.tax_ids || []).map(function (t) { return t.value; }).join(' '), (p.groups || []).join(' ')].join(' '); },
    searchHint: tx('Name, User ID, phone or e-mail'),
    filters: crmFilters(), sorts: crmPartySorts(),
    group: { options: [['none', 'None'], ['rail', 'ChitBridge'], ['role', 'Role'], ['seg', 'Segment']], default: 'none', tid: 'crm-parties',
      by: function (p, mode) {
        if (mode === 'rail') { var k = p.kind === 'walk-in' ? 'walk' : p.on_chitbridge ? 'on' : 'local'; return [{ on: tx('On ChitBridge'), local: tx('Local'), walk: tx('Walk-in') }[k], k]; }
        if (mode === 'role') { var r = p.roles.length > 1 ? 'both' : p.roles[0]; return [{ both: tx('Both'), customer: tx('Customers'), supplier: tx('Suppliers') }[r], r]; }
        if (mode === 'seg') return p.segment ? [tx(CRM_SEG[p.segment] || p.segment), p.segment] : [tx('No segment'), 'none'];
        return null;
      } },
    onOpen: function (p) { crmGo('#/party/' + encodeURIComponent(crmKey(p))); },
    next: crmPeek, actions: [{ id: 'open', label: tx('Open record'), tid: 'crm-open', run: function (p) { crmGo('#/party/' + encodeURIComponent(crmKey(p))); } }],
  });
  if (!CRM.loaded) crmLoad(); else crmLoad(true);
}

/* ═══ 2 · FOLLOW-UPS — the Task table, grouped Late · Today · This week · Later ══════════════════════════════════ */
var CRM_BUCKET = { late: 'Late', today: 'Today', week: 'This week', later: 'Later' };
function crmFuDue(f) {
  if (f.late) return '<span class="late">' + esc(tx('Late')) + ' · ' + esc(crmDayWord(f.due_at)) + '</span>';
  return esc(crmWhen(f.due_at));
}
function crmFuWhat(f) {
  var who = f.assignee_left ? '<span class="late">' + esc(tx('Unassigned')) + '</span>' : esc(f.assignee_name || tx('Unassigned'));
  var src = { manual: tx('Manual'), dues: tx('Dues'), interaction: tx('From a call') }[f.source] || '';
  var acts = f.party_removed ? '<span class="sub">' + esc(tx('No longer your party')) + '</span> <button type="button" class="crm-mini" data-crm="fudel" data-id="' + esc(f.followup_id) + '" data-testid="crm-fu-del-' + esc(f.followup_id) + '">' + esc(tx('Delete')) + '</button>'
    : (crmEdit() ? '<button type="button" class="crm-mini" data-crm="fudone" data-id="' + esc(f.followup_id) + '" data-testid="crm-fu-done-' + esc(f.followup_id) + '">' + esc(tx('Done')) + '</button>'
      + (f.assignee_left ? ' <button type="button" class="crm-mini" data-crm="fuassign" data-id="' + esc(f.followup_id) + '" data-testid="crm-fu-assign-' + esc(f.followup_id) + '">' + esc(tx('Assign')) + '</button>' : '') : '');
  return '<div><div' + (f.party_removed ? ' class="sub"' : '') + '>' + esc(f.what) + '</div><div class="sub" style="font-size:12.5px">' + who + (src ? ' · ' + esc(src) : '') + '</div><div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap">' + acts + '</div></div>';
}
async function crmFuLoad() {
  var g = ++CRM.loadGen;
  CRM.fuState = 'loading'; crmFuRefresh();
  try {
    var scope = CRM.fuScope || (crmOwner() ? 'all' : 'mine');
    var r = await api('crmFollowups', { query: { scope: scope, done: CRM.fuDone ? '1' : '0' } });
    CRM.fu = (r && r.followups) || (Array.isArray(r) ? r : []); CRM.coAssists = (r && r.co_assists) || CRM.coAssists; CRM.fuState = CRM.fu.length ? 'ready' : 'ready'; CRM.fuErr = null;
  } catch (e) { CRM.fuState = e && e.status === 503 ? 'notyet' : 'error'; CRM.fuErr = e; }
  crmFuRefresh();
}
function crmFuRefresh() { var a = CRM.fuApi; if (a && a.el && document.body.contains(a.el)) { a.refresh(); } }
/** a list whose filters or search are answered by the SERVER: the page reads what the person chose from the events the unit's own controls raise
 *  (a filter select, its ×, Clear, the search box — nothing of the unit's internals) and asks again when it changed. onChange({ filt:{key:value}, q }) */
function crmWatch(el, onChange) {
  var cur = { filt: {}, q: '' }, last = JSON.stringify(cur), t = null;
  var fire = function (ms) { clearTimeout(t); t = setTimeout(function () { var now = JSON.stringify(cur); if (now !== last) { last = now; onChange(JSON.parse(now)); } }, ms); };
  el.addEventListener('change', function (ev) { var k = ev.target.getAttribute && ev.target.getAttribute('data-filt'); if (k) { if (ev.target.value) cur.filt[k] = ev.target.value; else delete cur.filt[k]; fire(20); } });
  el.addEventListener('click', function (ev) {
    var c = ev.target.closest && ev.target.closest('[data-unfilt],[data-cbl-clearf],[data-cbl-clear]'); if (!c) return;
    if (c.hasAttribute('data-unfilt')) delete cur.filt[c.getAttribute('data-unfilt')]; else { cur.filt = {}; if (c.hasAttribute('data-cbl-clear')) cur.q = ''; }
    fire(20);
  });
  el.addEventListener('input', function (ev) { if (ev.target.hasAttribute && ev.target.hasAttribute('data-cbl-q')) { cur.q = String(ev.target.value || '').trim(); fire(300); } });
}
function crmFollowups() {
  crmBar('<a href="#/parties" data-testid="crm-back">‹ ' + esc(tx('Parties')) + '</a>', crmAddFuBtn(), true);
  var s = document.getElementById('screen'); s.className = 'screen flush';
  var def = crmOwner() ? 'all' : 'mine';
  s.innerHTML = '<div id="crm_fu" data-testid="crm-fu-list"></div>';
  if (CRM.fuApi && CRM.fuApi.destroy) { try { CRM.fuApi.destroy(); } catch (_) {} }
  var by = function (f) { return function (a, b) { return String(f(a)).localeCompare(String(f(b)), undefined, { numeric: true, sensitivity: 'base' }); }; };
  var el = document.getElementById('crm_fu');
  CRM.fuApi = CBList.mount(el, {
    key: 'crm-followups', t: tx, rows: function () { return CRM.fuState === 'ready' ? CRM.fu : []; }, id: function (f) { return f.followup_id; }, rowTid: function (f) { return 'crm-fu-' + f.followup_id; },
    columns: [{ key: 'due', label: 'Due', prio: 1, w: 170, sort: 'due', html: true, cell: crmFuDue, value: function (f) { return f.due_at; } },
      { key: 'what', label: 'What', prio: 2, w: 420, html: true, cell: crmFuWhat, value: function (f) { return f.what; } },
      { key: 'party', label: 'Party', prio: 3, w: 240, sort: 'party', html: true, cell: function (f) { return '<span class="nm">' + esc(f.party_name) + '</span> <span class="pno mono" style="font-size:12px;color:var(--muted)">' + esc(f.party_no || '') + '</span>'; }, value: function (f) { return f.party_name; } },
      { key: 'who', label: 'Who', prio: 4, w: 150, cell: function (f) { return f.assignee_left ? tx('Unassigned') : (f.assignee_name || '—'); } },
      { key: 'source', label: 'Source', prio: 5, w: 140, cell: function (f) { return { manual: tx('Manual'), dues: tx('Dues'), interaction: tx('From a call') }[f.source] || '—'; } },
      { key: 'created', label: 'Created', prio: 6, w: 140, sort: 'created', cell: function (f) { return f.created_at ? bkDate(f.created_at) : '—'; }, value: function (f) { return f.created_at || ''; } }],
    defaultCols: ['due', 'what', 'party'], cardMax: 3,
    head: function () {
      var open = CRM.fu.filter(function (f) { return f.bucket === 'late' || f.bucket === 'today'; }).length;
      return { title: tx('Follow-ups'), chips: CRM.fuState === 'ready' && !CRM.fuDone && CRM.fu.length && !open ? [{ text: tx('Nothing due today'), tid: 'crm-fu-nothing-today' }] : [] };
    },
    state: function () { return CRM.fuState === 'loading' ? 'loading' : (CRM.fuState === 'error' ? 'error' : null); },
    error: function () { return crmErrWords(CRM.fuErr, 'follow-ups'); }, onRetry: function () { crmFuLoad(); },
    empty: function () { return CRM.fuState === 'notyet' ? { title: tx('Calls and follow-ups start after an update.'), sub: tx('Nothing is lost.') } : { title: tx('No follow-ups.'), sub: tx('Add one from a party, or when you log a call.') }; },
    search: function (f) { return [f.what, f.party_name, f.party_no, f.assignee_name].join(' '); }, searchHint: tx('Search follow-ups'),
    /* Mine / Everyone and Open / Done are the server's two questions (?scope= · ?done=): they sit in the unit's Filters like any other, and the page asks again when they change */
    filters: [{ key: 'scope', label: tx('Show'), all: tx(def === 'all' ? 'Everyone' : 'Mine'), options: [{ v: def === 'all' ? 'mine' : 'all', label: tx(def === 'all' ? 'Mine' : 'Everyone') }], match: function () { return true; } },
      { key: 'done', label: tx('State'), all: tx('Open'), options: [{ v: '1', label: tx('Done') }], match: function () { return true; } },
      { key: 'source', label: tx('Source'), all: tx('Any source'), options: [{ v: 'manual', label: tx('Manual') }, { v: 'dues', label: tx('Dues') }, { v: 'interaction', label: tx('From a call') }], match: function (f, v) { return f.source === v; } }],
    sorts: [{ key: 'due', label: tx('Due'), cmp: by(function (f) { return f.due_at || ''; }) }, { key: 'party', label: tx('Party'), cmp: by(function (f) { return f.party_name || ''; }) }, { key: 'created', label: tx('Created'), cmp: by(function (f) { return f.created_at || ''; }) }],
    group: { default: 'on', tid: 'crm-fu', order: ['late', 'today', 'week', 'later'], by: function (f) { var b = f.bucket || 'later'; return [tx(CRM_BUCKET[b] || b), b]; } },
    onOpen: function (f) { if (!f.party_removed) crmGo('#/party/' + encodeURIComponent(f.party_no || f.party_id)); },
    next: function (f) { return '<div>' + CBList.nextRow(['<span style="color:var(--muted)">' + esc(tx('Due')) + '</span> ' + esc(crmWhen(f.due_at))], []) + (crmEdit() && !f.party_removed ? '<div class="supacts" style="padding:4px 0"><button type="button" class="crm-mini" data-crm="fusnooze" data-id="' + esc(f.followup_id) + '" data-when="tomorrow" data-testid="crm-fu-snooze-tomorrow-' + esc(f.followup_id) + '">' + esc(tx('Snooze')) + ' · ' + esc(tx('Tomorrow')) + '</button><button type="button" class="crm-mini" data-crm="fusnooze" data-id="' + esc(f.followup_id) + '" data-when="week">' + esc(tx('Snooze')) + ' · ' + esc(tx('Next week')) + '</button></div>' : '') + '</div>'; },
  });
  crmWatch(el, function (c) { CRM.fuScope = c.filt.scope || def; CRM.fuDone = c.filt.done === '1'; crmFuLoad(); });
  crmFuLoad();
}
async function crmFuAct(id, body, done) {
  try { await api('crmFollowSet', { params: { id: id }, body: body }); if (done) done(); toast(tx('Saved')); CRM.fu = CRM.fu.filter(function (f) { return f.followup_id !== id || !(body.done); }); crmFuLoad(); crmLoad(true); }
  catch (e) { toast(e && e.status === 503 ? tx('Calls and follow-ups start after an update. Nothing is lost.') : tx("Couldn't save that. Try again.")); }
}
function crmSnoozeISO(when) { var d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() + (when === 'week' ? 7 : 1)); return d.toISOString(); }

/* ═══ 3 · ADD PARTY — one field; look on ChitBridge and in your parties first (F1) ═══════════════════════════════ */
var ADD = { role: 'customer', q: '', busy: false, found: null };
function crmAddOpen(q) {
  ADD.q = q || ''; ADD.found = null; ADD.busy = false;
  modal('<div class="mhd"><div class="t">' + esc(tx('Add party')) + '</div></div><div class="mbody" data-testid="crm-add-sheet">'
    + '<p class="hint" style="margin:0">' + esc(tx('One field — we look on ChitBridge and in your parties first.')) + '</p>'
    + '<label>' + esc(tx('Who?')) + '<input class="inp" id="crm_addq" data-testid="crm-addq" value="' + esc(ADD.q) + '" placeholder="' + esc(tx('Name, User ID, phone or e-mail')) + '" autocomplete="off"></label>'
    + '<div class="supacts"><span class="hint">' + esc(tx('As')) + '</span><div class="seg2" role="group" aria-label="' + esc(tx('Role')) + '"><button type="button" data-crm="addrole" data-v="customer" aria-pressed="true" data-testid="crm-add-role-customer">' + esc(tx('Customer')) + '</button><button type="button" data-crm="addrole" data-v="supplier" aria-pressed="false" data-testid="crm-add-role-supplier">' + esc(tx('Supplier')) + '</button></div></div>'
    + '<div id="crm_addres" aria-live="polite" style="display:flex;flex-direction:column;gap:8px"></div></div>'
    + '<div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button></div>');
  ADD.role = 'customer';
  var inp = document.getElementById('crm_addq'); if (inp) { inp.focus(); inp.addEventListener('input', crmAddType); }
  crmAddResults();
}
var _addT = null;
function crmAddType(ev) { ADD.q = ev.target.value; clearTimeout(_addT); _addT = setTimeout(crmAddSearch, 250); crmAddResults(); }
async function crmAddSearch() {
  var q = ADD.q.trim(); ADD.found = null;
  if (q.length < 2 || (q.indexOf('@') >= 0 && !/\S+@\S+\.\S+/.test(q))) { crmAddResults(); return; }
  var mine = q;
  try { var r = await api('entitySearch', { query: { q: q } }); if (ADD.q.trim() === mine) ADD.found = (r && (r.results || r.entities)) || (Array.isArray(r) ? r : []); }
  catch (_) { ADD.found = []; }
  crmAddResults();
}
function crmAddResults() {
  var box = document.getElementById('crm_addres'); if (!box) return;
  var q = ADD.q.trim(), ql = q.toLowerCase(), h = '';
  if (!q) { box.innerHTML = '<p class="hint" style="margin:0">' + esc(tx('Type a name to add a local party, or a User ID / e-mail to find them on ChitBridge.')) + '</p>'; return; }
  var mine = CRM.rows.filter(function (p) { return [p.display_name, p.nickname, p.party_no, p.user_id, p.phone, p.email].join(' ').toLowerCase().indexOf(ql) >= 0; }).slice(0, 4);
  mine.forEach(function (p) {
    h += '<div class="result" data-testid="crm-add-mine"><span><span class="k">' + esc(tx('Already your party')) + '</span><b>' + esc(p.display_name) + '</b> <span class="pno mono">' + esc(p.party_no || '') + '</span><br>' + crmRoleChips(p) + ' ' + crmRailChip(p) + '</span>'
      + '<button type="button" class="act sm ghost" data-crm="addopen" data-k="' + esc(crmKey(p)) + '">' + esc(tx('Open')) + '</button></div>';
  });
  (ADD.found || []).forEach(function (e, i) {
    h += '<div class="result" data-testid="crm-add-found"><span><span class="k">' + esc(tx('On ChitBridge — is this them?')) + '</span><b>' + esc(e.display_name) + '</b><br><span class="mono hint">' + esc(e.user_id || '') + '</span><span class="hint">' + (e.city ? ' · ' + esc(e.city) : '') + '</span></span>'
      + '<button type="button" class="act sm" data-crm="addfound" data-i="' + i + '" data-testid="crm-add-this">' + esc(tx('Add')) + '</button></div>';
  });
  if (q.indexOf('@') >= 0 && !/\S+@\S+\.\S+/.test(q)) h += '<div class="banner" data-testid="crm-add-warn">' + crmIcon('warn') + '<span>' + esc(tx('Use their User ID or e-mail to find them on ChitBridge.')) + '</span></div>';
  else h += '<div class="result" data-testid="crm-add-local"><span><span class="k">' + esc(tx('Not on ChitBridge')) + '</span><b>' + esc(txf('Add “{q}” as a local party', { q: q })) + '</b><br><span class="hint">' + esc(tx('Bills are yours only until they join.')) + '</span></span>'
    + '<button type="button" class="act sm ghost" data-crm="addlocal" data-testid="crm-add-local-go">' + esc(tx('Add as local')) + '</button></div>';
  box.innerHTML = h;
}
async function crmAddGo(kind, byHandle) {
  if (ADD.busy) return; ADD.busy = true;
  var role = ADD.role, ep = role === 'supplier' ? 'supAdd' : 'custAdd', body;
  if (kind === 'found') body = role === 'supplier' ? { supplier_bridge_id: byHandle.bridge_id } : { handle: byHandle.user_id };
  else body = { name: ADD.q.trim().replace(/\s+/g, ' ') };
  try {
    var r = await api(ep, { body: body });
    var made = r && (r.customer || r.supplier) || {}, id = made.customer_identity_id || made.supplier_entity_id;
    closeModal(); toast(tx(role === 'supplier' ? 'Supplier added' : 'Customer added') + ': ' + (made.display_name || ADD.q));
    await crmLoad(true);
    var p = id && CRM.byKey[id]; crmGo(p ? '#/party/' + encodeURIComponent(crmKey(p)) : '#/parties');
  } catch (e) { toast((e && e.message) || tx("Couldn't add that. Try again.")); }
  ADD.busy = false;
}

/* ═══ 4 · ADD FOLLOW-UP — party picker · what · when (presets write into the date) · who ═════════════════════════ */
var FUADD = { party: null };
function crmFuAddOpen(partyKey, then, prefill) {
  var p = partyKey && CRM.byKey[partyKey]; FUADD.party = p || null; FUADD.then = then || null; FUADD.source = (prefill && prefill.source) || 'manual';
  modal('<div class="mhd"><div class="t">' + esc(tx('Add follow-up')) + '</div></div><div class="mbody" data-testid="crm-fu-sheet">'
    + '<label>' + esc(tx('Party')) + '<input class="inp" id="crm_fu_pq" data-testid="crm-fu-pq" placeholder="' + esc(tx('Name or party no')) + '" autocomplete="off" value="' + esc(p ? p.display_name : '') + '"></label>'
    + '<div id="crm_fu_pres" style="display:flex;flex-direction:column;gap:6px"></div>'
    + '<label>' + esc(tx('What')) + '<input class="inp" id="crm_fu_what" data-testid="crm-fu-what" placeholder="' + esc(tx('Call back about…')) + '" value="' + esc((prefill && prefill.what) || '') + '"></label>'
    + '<label>' + esc(tx('When')) + '<input class="inp" id="crm_fu_due" data-testid="crm-fu-due" type="date"></label>'
    + '<div class="supacts">' + [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next week']].map(function (x) { return '<button type="button" class="crm-mini" data-crm="fupreset" data-v="' + x[0] + '" data-testid="crm-fu-preset-' + x[0] + '">' + esc(tx(x[1])) + '</button>'; }).join('') + '</div>'
    + '<label>' + esc(tx('Who')) + '<select class="inp" id="crm_fu_who" data-testid="crm-fu-who"><option value="">' + esc(tx('Me')) + '</option>' + (CRM.coAssists || []).map(function (c) { return '<option value="' + esc(c.user_id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select></label>'
    + '<div id="crm_fu_msg" class="hint" role="status"></div></div>'
    + '<div class="mfoot"><button type="button" onclick="closeModal()">' + esc(tx('Cancel')) + '</button><button type="button" class="pri" data-crm="fusave" data-testid="crm-fu-save">' + esc(tx('Save')) + '</button></div>');
  var pq = document.getElementById('crm_fu_pq'); if (pq) { pq.addEventListener('input', function () { FUADD.party = null; crmFuPicker(pq.value); }); if (!p) pq.focus(); else document.getElementById('crm_fu_what').focus(); }
}
function crmFuPicker(q) {
  var box = document.getElementById('crm_fu_pres'); if (!box) return;
  q = String(q || '').trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
  var m = CRM.rows.filter(function (p) { return [p.display_name, p.nickname, p.party_no].join(' ').toLowerCase().indexOf(q) >= 0 && p.kind !== 'walk-in'; }).slice(0, 5);
  box.innerHTML = m.map(function (p) { return '<button type="button" class="result" style="text-align:left;background:var(--surface)" data-crm="fupick" data-k="' + esc(p.party_id) + '" data-testid="crm-fu-pick-' + esc(crmKey(p)) + '"><span><b>' + esc(p.display_name) + '</b> <span class="pno mono">' + esc(p.party_no || '') + '</span></span></button>'; }).join('')
    || '<span class="hint">' + esc(tx('Nobody matches.')) + '</span>';
}
async function crmFuSave() {
  var g = function (id) { return String((document.getElementById(id) || {}).value || '').trim(); }, msg = document.getElementById('crm_fu_msg');
  if (!FUADD.party) { msg.textContent = tx('Pick a party first.'); return; }
  if (!g('crm_fu_what')) { msg.textContent = tx('Say what to do.'); return; }
  if (!g('crm_fu_due')) { msg.textContent = tx('Pick a day.'); return; }
  var body = { party_id: FUADD.party.party_id, what: g('crm_fu_what'), due_at: new Date(g('crm_fu_due') + 'T09:00:00').toISOString(), source: FUADD.source || 'manual' };
  if (g('crm_fu_who')) body.assignee_user_id = g('crm_fu_who');
  try { await api('crmFollowAdd', { body: body }); var then = FUADD.then; closeModal(); toast(tx('Follow-up added')); crmLoad(true); if (CRM.route && CRM.route.view === 'followups') crmFuLoad(); if (then) then(); }
  catch (e) { msg.textContent = e && e.status === 503 ? tx('Calls and follow-ups start after an update. Nothing is lost.') : tx("Couldn't save that. Try again."); }
}

/* ═══ ONE click door for every control this file draws outside a CBList cell (data-crm="…") ═════════════════════ */
document.addEventListener('click', function (ev) {
  var t = ev.target.closest && ev.target.closest('[data-crm]'); if (!t) return;
  var a = t.getAttribute('data-crm'), id = t.getAttribute('data-id'), v = t.getAttribute('data-v');
  if (a === 'add') return crmGo('#/parties/add');
  if (a === 'fuadd') return crmFuAddOpen(null);
  if (a === 'fudone') { ev.stopPropagation(); return crmFuAct(id, { done: true }); }
  if (a === 'fusnooze') { ev.stopPropagation(); return crmFuAct(id, { due_at: crmSnoozeISO(t.getAttribute('data-when')) }); }
  if (a === 'fuassign') { ev.stopPropagation(); return crmFuAct(id, { assignee_user_id: (SESSION.userId || SESSION.name || '') }); }
  if (a === 'fudel') { ev.stopPropagation(); return api('crmFollowDel', { params: { id: id } }).then(function () { toast(tx('Deleted')); crmFuLoad(); }, function () { toast(tx("Couldn't delete that. Try again.")); }); }
  if (a === 'addrole') { ADD.role = v; document.querySelectorAll('[data-crm="addrole"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); }); return; }
  if (a === 'addopen') return crmGo('#/party/' + encodeURIComponent(t.getAttribute('data-k')));
  if (a === 'addfound') return crmAddGo('found', (ADD.found || [])[+t.getAttribute('data-i')]);
  if (a === 'addlocal') return crmAddGo('local');
  if (a === 'fupreset') { var d = new Date(); if (v === 'tomorrow') d.setDate(d.getDate() + 1); if (v === 'week') d.setDate(d.getDate() + 7); document.getElementById('crm_fu_due').value = crmLocalISO(d); return; }
  if (a === 'fupick') { FUADD.party = CRM.byKey[t.getAttribute('data-k')]; document.getElementById('crm_fu_pq').value = FUADD.party.display_name; document.getElementById('crm_fu_pres').innerHTML = ''; return; }
  if (a === 'fusave') return crmFuSave();
  if (typeof crmRecordClick === 'function') return crmRecordClick(a, t, ev);
});
