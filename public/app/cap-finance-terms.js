/* cap-finance-terms.js — CB Finance · Terms (round F2): the shop's DEFAULT credit terms and each party's OWN, set in ONE place.
 * Loaded by finance.html after cap-finance.js. docs: C:/dev/CB-FINANCE-PLAN.md §4 F2. The CRM record, the counter and Accounts only READ these.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): CBList.mount (the party list) · bkMoneyInput / bkMoneyRead / bkMoney (the M36 money unit — the limit)
 * · CBAction (M64 — Save) · modal/closeModal (finance.html's sheet) · bkPartyLabel · the /api/crm/parties read the CRM already makes.
 * ⭐ ONE CALCULATION (rule 2): nothing here works out money or which term applies — GET /api/books/terms answers `effective` (the party's own value,
 * else the shop's) and `may_set` for THIS login; a field paints what it was told. Before the SQL (b298) has run the server says so and this tab says it
 * in words — the form is greyed, never a 500. A change is an event on the server; the party sheet lists them.
 * ⭐ NEW PATHS (rule 4): FT (this tab's state) · FT_EP (the two /api/books/terms rows + crmParties, which finance.html did not load) · the tab switch
 * (#/terms) — Collections is one list, the nav had no second place to go.
 * ⚠️ Never error.message on a screen: a failure says what happened (CBAction.words) and the button stays.
 */
'use strict';

var FT = { gen: 0, state: 'loading', t: null, parties: [], pstate: 'loading', api: null, cur: 'INR' };
var FT_EP = {
  /* booksTerms (the read) and crmParties live in accounts-shell.js CB_PARTY_EP — CRM reads them too; one name, one place */
  booksTermsSet: { m: 'POST', p: '/api/books/terms',  ok: '✓' },   // owner · { party_id?, side?, credit_days, credit_limit_minor, interest, early } — null clears
};
Object.assign(EP, FT_EP);
var FT_NOT_YET = 'Terms arrive after the next update.';

function finTab() { return /^#\/terms/.test(location.hash) ? 'terms' : 'collect'; }
function ftNav() {
  var t = finTab();
  [['collect', 'fin-nav-collections'], ['terms', 'fin-nav-terms']].forEach(function (x) {
    var a = document.querySelector('[data-testid="' + x[1] + '"]'); if (!a) return;
    a.classList.toggle('active', x[0] === t); if (x[0] === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', function () { if (!document.getElementById('screen') || typeof finMount !== 'function') return; ftNav(); finMount(false); });

/* ── the fields: one builder for the shop card and the party sheet ── */
function ftNum(v) { return v == null ? '' : String(v); }
function ftField(id, label, input) { return '<div class="kv"><b style="flex:1 1 150px">' + esc(label) + '</b><span style="flex:1 1 150px">' + input + '</span></div>'; }
function ftInput(id, v, ph, off) {
  return '<input class="inp" id="' + id + '" data-testid="' + id + '" inputmode="numeric" autocomplete="off" value="' + esc(ftNum(v)) + '" placeholder="' + esc(ph == null ? '' : String(ph)) + '"' + (off ? ' disabled' : '') + '>';
}
/** own: this level's values ({credit_days, credit_limit_minor, interest, early}); dflt: what falls back (placeholders); off: greyed */
function ftForm(p, own, dflt, off) {
  own = own || {}; dflt = dflt || {};
  var i = own.interest || {}, e = own.early || {}, di = dflt.interest || {}, de = dflt.early || {};
  return ftField(p + '_days', tx('Credit days'), ftInput(p + '_days', own.credit_days, dflt.credit_days, off))
    + ftField(p + '_limit', tx('Credit limit'), bkMoneyInput({ id: p + '_limit', minor: own.credit_limit_minor, cur: FT.cur, ph: dflt.credit_limit_minor != null ? bkMoney(dflt.credit_limit_minor, FT.cur) : tx('No limit'), extra: off ? 'disabled' : '' }))
    + ftField(p + '_ion', tx('Interest on overdue'), '<input type="checkbox" id="' + p + '_ion" data-testid="' + p + '_ion"' + (i.on ? ' checked' : '') + (off ? ' disabled' : '') + '> <span class="hint">' + esc(tx('Shown, never charged')) + '</span>')
    + ftField(p + '_rate', tx('Rate % a year'), ftInput(p + '_rate', i.rate_pct, di.rate_pct, off))
    + ftField(p + '_grace', tx('Grace days'), ftInput(p + '_grace', i.grace_days, di.grace_days, off))
    + ftField(p + '_epct', tx('Early-pay discount %'), ftInput(p + '_epct', e.pct, de.pct, off))
    + ftField(p + '_edays', tx('Pay within days'), ftInput(p + '_edays', e.within_days, de.within_days, off));
}
function ftText(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
function ftOne(id) { var t = ftText(id); if (t === '') return null; var n = Number(t); return isFinite(n) ? n : NaN; }
/** the form → the body the server takes, or { bad: sentence }. Empty = not set (null). Money is read by the money unit, never multiplied here. */
function ftRead(p) {
  var days = ftOne(p + '_days'), rate = ftOne(p + '_rate'), grace = ftOne(p + '_grace'), ep = ftOne(p + '_epct'), ed = ftOne(p + '_edays');
  if ([days, rate, grace, ep, ed].some(function (n) { return n !== null && isNaN(n); })) return { bad: tx('Numbers only, please') };
  var lt = ftText(p + '_limit'), lim = lt === '' ? null : bkMoneyRead(p + '_limit');
  if (lim !== null && isNaN(lim)) return { bad: tx('That limit is not an amount') };
  var on = !!(document.getElementById(p + '_ion') || {}).checked;
  return { body: { credit_days: days, credit_limit_minor: lim,
    interest: (on || rate !== null || grace !== null) ? { on: on, rate_pct: rate, grace_days: grace } : null,
    early: (ep !== null || ed !== null) ? { pct: ep, within_days: ed } : null } };
}

/* ── the screen ── */
function ftMount(frame) {
  var s = document.getElementById('screen'); if (!s) return;
  ftNav(); s.className = 'screen';
  s.innerHTML = '<div class="card" id="ft_shop" data-testid="ft-shop"></div><div id="ft_parties" data-testid="ft-parties" style="flex:1 1 auto;min-height:260px"></div>';
  ftShopPaint();
  FT.api = CBList.mount(document.getElementById('ft_parties'), {
    key: 'fin-terms', t: tx, rows: function () { return FT.parties; }, id: function (p) { return p.party_id; }, rowTid: function (p) { return 'ft-row-' + p.party_id; },
    columns: ftCols(), defaultCols: ['party', 'days', 'limit'], cardMax: 3, fill: false,
    head: function () { return { title: tx('Party terms') }; },
    state: function () { return FT.pstate; }, error: function () { return tx('Could not read your parties. Try again.'); }, onRetry: function () { ftLoad(); },
    empty: { title: tx('No customers yet') },
    search: function (p) { return [p.party_no, p.name, bkPartyLabel(p.party_id, p.name)].join(' '); },
    sorts: [{ key: 'name', label: tx('Name'), cmp: function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); } }],
    onOpen: function (p) { ftOpen(p.party_id); },
  });
  if (!frame) ftLoad(FT.parties.length > 0);
}
function ftCols() {
  var dash = '<span style="color:var(--grey)">—</span>', mine = function (p) { return (p.terms && p.terms.customer) || {}; };
  return [
    { key: 'party', label: tx('Party'), prio: 1, sort: 'name', w: 240, html: true, cell: function (p) { return esc(bkPartyLabel(p.party_id, p.name)); } },
    { key: 'days', label: tx('Credit days'), prio: 2, w: 150, html: true, cell: function (p) { var d = mine(p).credit_days; return d == null ? dash + ' <span class="hint">' + esc(tx('Shop default')) + '</span>' : '<span data-b="days">' + esc(String(d)) + '</span>'; } },
    { key: 'limit', label: tx('Credit limit'), prio: 3, w: 170, num: true, html: true, cell: function (p) { var l = mine(p).credit_limit_minor; return l == null ? dash : '<span data-b="limit">' + esc(bkMoney(Number(l), FT.cur)) + '</span>'; } },
  ];
}
function ftShopPaint() {
  var el = document.getElementById('ft_shop'); if (!el) return;
  if (FT.state === 'loading') { el.innerHTML = '<h2>' + esc(tx('Shop terms')) + '</h2><p class="hint">' + esc(tx('Loading…')) + '</p>'; return; }
  if (FT.state === 'error' || !FT.t) { el.innerHTML = '<h2>' + esc(tx('Shop terms')) + '</h2><p data-testid="ft-error">' + esc(tx('Could not read terms. Try again.')) + '</p><button type="button" class="act" data-testid="ft-retry" onclick="ftLoad()">' + esc(tx('Try again')) + '</button>'; return; }
  var t = FT.t, off = !t.terms_migrated || !t.may_set, why = !t.terms_migrated ? FT_NOT_YET : (t.may_set ? '' : (t.why_not || 'Only the owner may set terms.'));
  el.innerHTML = '<h2>' + esc(tx('Shop terms')) + '</h2><p class="hint">' + esc(tx('Used when a party has none of its own.')) + '</p>'
    + (why ? '<div class="hint" data-testid="ft-why" style="opacity:.85">' + esc(tx(why)) + '</div>' : '')
    + ftForm('fts', t.default, null, off)
    + '<div style="display:flex;gap:10px;align-items:center"><button type="button" class="act" data-testid="ft-save"' + (off ? ' disabled' : '') + ' onclick="ftSaveShop(this)">' + esc(tx('Save')) + '</button><span id="ft_why" data-testid="ft-out" class="hint"></span></div>'
    + '<h3 style="margin:14px 0 4px;font-size:14px">' + esc(tx('Changes')) + '</h3>' + bkTermEvents(t.events, FT.cur, 'ft-event');
}
async function ftLoad(quiet) {
  var g = ++FT.gen;
  if (!quiet) { FT.state = 'loading'; FT.pstate = 'loading'; ftShopPaint(); if (FT.api) FT.api.refresh(); }
  var terms = api('booksTerms').then(function (r) { return { r: r }; }, function (e) { return { e: e }; });
  var list = api('crmParties').then(function (r) { return { r: r }; }, function (e) { return { e: e }; });
  var a = await terms, b = await list;
  if (g !== FT.gen) return;
  if ((a.e && a.e.status === 404) || (b.e && b.e.status === 404 && !a.r)) { finOff(); return; }   /* the Ledger is off (M212) */
  if (a.r) { FT.t = a.r; FT.state = 'ready'; } else { FT.state = 'error'; }
  if (b.r) { FT.parties = ((b.r.parties) || []).filter(function (p) { return p.roles && p.roles.customer && p.kind !== 'walk-in'; }); FT.pstate = 'ready'; } else { FT.pstate = 'error'; }
  ftShopPaint(); if (FT.api) FT.api.refresh();
}
function ftSaveShop(btn) {
  var r = ftRead('fts'), out = document.getElementById('ft_why');
  if (r.bad) { if (out) out.textContent = r.bad; return; }
  return CBAction.run(btn, function () { return api('booksTermsSet', { body: r.body }); },
    { key: 'ft-save', out: 'ft_why', failed: tx('Could not save terms'), done: tx('Saved'), outcome: function () { ftLoad(true); } });
}

/* ── one party's own terms: the sheet ── */
async function ftOpen(pid) {
  var p = FT.parties.filter(function (x) { return x.party_id === pid; })[0] || { party_id: pid };
  modal('<div class="mhd"><div class="t" data-testid="ft-sheet-title">' + esc(bkPartyLabel(pid, p.name)) + '</div></div><div class="mbody" id="ft_sheet_body"><p class="hint">' + esc(tx('Loading…')) + '</p></div>');
  var r;
  try { r = await api('booksTerms', { query: { party_id: pid, side: 'customer' } }); }
  catch (e) { var b = document.getElementById('ft_sheet_body'); if (b) b.innerHTML = '<p data-testid="ft-sheet-error">' + esc(tx('Could not read terms. Try again.')) + '</p>'; return; }
  var body = document.getElementById('ft_sheet_body'); if (!body) return;
  var off = !r.terms_migrated || !r.may_set, why = !r.terms_migrated ? FT_NOT_YET : (r.may_set ? '' : (r.why_not || ''));
  var own = r.party ? r.party.own : {}, d = r.default || {};
  body.innerHTML = (why ? '<div class="hint" data-testid="ft-sheet-why">' + esc(tx(why)) + '</div>' : '')
    + '<p class="hint">' + esc(tx('Empty means the shop default.')) + '</p>' + ftForm('ftp', own, d, off)
    + '<h3 style="margin:12px 0 4px;font-size:14px">' + esc(tx('Changes')) + '</h3>' + bkTermEvents(r.events, FT.cur, 'ft-event');
  var foot = document.querySelector('#fin_sheet .mfoot'); if (foot) foot.remove();
  body.insertAdjacentHTML('afterend', '<div class="mfoot"><span id="ftp_why" data-testid="ftp-out" class="hint"></span><button type="button" onclick="closeModal()">' + esc(tx('Close')) + '</button>'
    + '<button type="button" class="act" data-testid="ftp-save"' + (off ? ' disabled' : '') + ' onclick="ftSaveParty(\'' + esc(pid) + '\',this)">' + esc(tx('Save')) + '</button></div>');
}
function ftSaveParty(pid, btn) {
  var r = ftRead('ftp'), out = document.getElementById('ftp_why');
  if (r.bad) { if (out) out.textContent = r.bad; return; }
  var body = Object.assign({ party_id: pid, side: 'customer' }, r.body);
  return CBAction.run(btn, function () { return api('booksTermsSet', { body: body }); },
    { key: 'ftp-save:' + pid, out: 'ftp_why', failed: tx('Could not save terms'), done: tx('Saved'), outcome: function () { ftLoad(true).then(function () { ftOpen(pid); }); } });
}
