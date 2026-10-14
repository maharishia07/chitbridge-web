/* app/cap-connectors.js — CONNECTORS: what you can attach (the catalogue, with the server's may/why per country), who has checked in, and who
 * owns which stream — ONE implementation painted in two places (T3-SETTINGS, 2026-10-14; the pattern of cap-shop.js, SET1).
 *
 * MOVED from cap-admin.js (never copied; the workshop's Settings › Integrations panes call these same names):
 *   _INT_CAT · _INT_RUN · _INT_MAP · _INT_STR · intProfileMapHTML · intWhereFrom · intEnrolHTML · intApprove · intReject · intDownloadKit ·
 *   intSourceHTML · intToSetup · intCarriesHTML · intConnectorsHTML · INT_TABS · intOpen · intToggleCard · intCardDetailHTML · intTab · intSetTab ·
 *   intFold · intFoldToggle · intInUse · intUseToggle · intStreamsHTML · intStreamSet · the EP entries intCatalogue · intStatus · intApprove ·
 *   intProfileMap · intStreams · intStreamsSet
 * WIDENED (additively): intRepaint() / intOnShow() (the host, or the workshop's loadSettings / setSec); intConnectorsHTML(tab) — CB Settings paints
 *   the connectors card AND the running card on one screen, the workshop keeps its rail's choice.
 * NEW: CBConnectors.mount(host) — CB Settings › Connectors: three cards (connectors · running · who owns what). The workshop's other five
 *   panes (In the books · The store · Network offers · Counters · Keys) stay where they are or have their own section.
 * Host globals (as every cap-*.js): api · EP · UI · SESSION · esc · tx · txf · toast · _CARD · lsGet/lsSet · fmtDateTime (helpers.js) · CFG.
 * Loaded by app.html through CAP_WITH.admin (before cap-admin.js) and by settings.html directly.
 * Flow step: O2C · books (a connector books the order) (docs/process/flows.json).
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  intCatalogue:{m:'GET',  p:'/api/integrations/catalogue',  ok:'y'},   // the connectors that exist (routes/integrations.js)
  intStatus: {m:'GET',    p:'/api/integrations/status',     ok:'y'},   // the connectors that have checked in
  intApprove:{m:'POST',   p:'/api/integrations/:id/approve', ok:'✓'},  // the owner approves a connector's PC (the handshake)
  intProfileMap:{m:'GET', p:'/api/integrations/profile-map',ok:'y'},   // what we look for about the store · where from · how trusted
  intStreams:{m:'GET',    p:'/api/integrations/streams',    ok:'y'},   // who owns which stream (2026-09-07)
  intStreamsSet:{m:'PUT', p:'/api/integrations/streams',    ok:'✓'},   // hand a stream to another connector
}); }
/**
 * ⭐ INTEGRATIONS — API KEYS FOR OTHER SYSTEMS. Athi, 2026-09-05: "create the entire offer as a capability and attach it to
 * any other systems". A key is minted here, shown ONCE, scoped (offers today), listed with its last four characters,
 * revocable in one press. The services it opens: /api/offers kinds · evaluate · explain; the contract at
 * /api/offers/openapi.json. Only a signed-in person mints or revokes — a key cannot breed.
 */
var _INT_CAT, _INT_RUN, _INT_MAP;   /* the connector catalogue, the connectors that have checked in, the profile map — lazy, like the keys */
/**
 * ⭐ THE PROFILE MAP (Athi, 2026-09-05: "do we have a map of what we look for, how do we fill it, what is the authenticity?").
 * One row per field we look for: the value we hold, where it came from (typed · Tally · Zoho · a file · derived from the
 * GSTIN), when, and its rung — declared · copied · checked · verified — plus any check that failed (a GSTIN whose check
 * digit is wrong, a PIN in another state). The connector's sync-profile fills it; a higher rung is never overwritten.
 */
function intProfileMapHTML(){
  if (_INT_MAP === undefined) { _INT_MAP = null; api('intProfileMap').then(function(r){ _INT_MAP = r || {}; if (intOnShow()) intRepaint(); }).catch(function(){ _INT_MAP = {}; if (intOnShow()) intRepaint(); }); }
  var m = _INT_MAP; if (!m || !m.fields) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('The store, as we know it') + '</div><div style="color:var(--grey)">' + tx(m === null ? 'reading…' : 'no map') + '</div></div>';
  var rungStyle = { declared: 'background:var(--warn-tint);color:var(--warn-2)', copied: 'background:var(--blue-tint);color:var(--blue-2)', checked: 'background:var(--ok-tint);color:var(--ok-2)', verified: 'background:var(--ok-2);color:var(--on-ok)' };   /* ⚠️ was #fff on a THEMED ground — the text vanishes in any theme that lightens --ok-2 (guard-static, 2026-09-27); --on-ok is the token for ink on the ok colour */
  var rows = (m.order || []).map(function(k){ var f = m.fields[k] || {}; var src = f.source ? String(f.source) : ''; var when = f.as_of ? String(f.as_of).slice(0, 10) : '';
    return '<tr data-testid="int-map-' + esc(k) + '"><td style="padding:5px 8px;border-top:1px solid var(--line)"><b>' + esc(f.label || k) + '</b><div style="font-size:var(--fs-1);color:var(--grey)">' + esc(f.why || '') + '</div></td>'
      + '<td style="padding:5px 8px;border-top:1px solid var(--line);font-family:monospace">' + (f.value != null ? esc(String(f.value)) : '<span style="color:var(--warn-3)">' + esc(tx('missing')) + '</span>') + (f.issues && f.issues.length ? '<div style="color:var(--warn-3);font-size:var(--fs-1)">⚠ ' + esc(f.issues.join('; ')) + '</div>' : '') + '</td>'
      + '<td style="padding:5px 8px;border-top:1px solid var(--line);font-size:var(--fs-1);color:var(--grey)">' + esc(src) + (when ? ' · ' + esc(when) : '') + '<div>' + esc((f.sources && (f.sources.tally || '')) ? intWhereFrom(f, src) : '') + '</div></td>'
      + '<td style="padding:5px 8px;border-top:1px solid var(--line)">' + (f.rung ? '<span data-testid="int-map-rung-' + esc(k) + '" style="font-size:var(--fs-1);font-weight:800;border-radius:5px;padding:1px 6px;' + (rungStyle[f.rung] || '') + '">' + esc(f.rung) + '</span>' : '') + '</td></tr>'; }).join('');
  return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('The store, as we know it') + ' <span style="font-weight:400;color:var(--grey);font-size:var(--fs-1)">' + esc(String(m.filled || 0) + ' ' + tx('of') + ' ' + String(m.total || 0) + ' ' + tx('filled')) + (m.state_name ? ' · ' + esc(m.state_name) : '') + '</span></div>'
    + '<div style="font-size:var(--fs-2);margin-bottom:6px">' + tx('What we look for, where it came from, and how far it is trusted: declared (typed) → copied (from your own system, with source and date) → checked (the GSTIN check digit, PAN and state agree) → verified (the registry). A connector fills it with sync-profile; a higher rung is never overwritten.') + '</div>'
    + '<div style="overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:var(--fs-2)"><thead><tr><th style="text-align:start;padding:4px 8px">' + tx('Field') + '</th><th style="text-align:start;padding:4px 8px">' + tx('Value') + '</th><th style="text-align:start;padding:4px 8px">' + tx('Source · when') + '</th><th style="text-align:start;padding:4px 8px">' + tx('Rung') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}
/* ⭐ THE HANDSHAKE ON THE ROW (Athi, 2026-09-06): a connector is approved for ONE PC. The row says which PC and which Tally company asked,
   and why it waits; Approve is the owner's act, Reject revokes the key (the kit stops at its next call). */
/** ⭐ where this field lives in the system that filled it — Tally, Zoho, GoFrugal or a CSV column (2026-09-07) */
function intWhereFrom(f, src){
  var srcs = (f && f.sources) || {}; var key = String(src || '').toLowerCase();
  var named = { tally: 'Tally', zoho: 'Zoho Books', csv: 'CSV', gofrugal: 'GoFrugal' };
  var pick = srcs[key] ? key : (Object.keys(srcs)[0] || '');
  if (!pick || !srcs[pick]) return '';
  return (named[pick] || pick) + ': ' + srcs[pick];
}
function intEnrolHTML(r){
  var e = r.enrol; if (!e) return '';
  var facts = [e.host, e.company, e.gstin].filter(Boolean).map(esc).join(' · ');
  if (e.approved === false) return '<div style="font-weight:400;font-size:var(--fs-1);margin-top:3px"><span style="color:var(--warn-2);font-weight:700">⚠ ' + tx('waiting for approval') + '</span> — ' + facts + (e.reason ? ' <span style="color:var(--grey)">(' + esc(e.reason) + ')</span>' : '')
    + '<div style="display:flex;gap:6px;margin-top:5px"><button class="composebtn" data-testid="int-approve-' + esc(r.actor_id) + '" onclick="intApprove(\'' + esc(r.actor_id) + '\')">✓ ' + tx('Approve this PC') + '</button>'
    + (r.key_jti ? '<button class="btn2" onclick="intReject(\'' + esc(r.key_jti) + '\')">' + tx('Reject') + '</button>' : '') + '</div></div>';
  return '<div style="font-weight:400;font-size:var(--fs-1);color:var(--ok-2);margin-top:3px">✓ ' + tx('approved') + (facts ? ' · ' + facts : '') + '</div>';
}
async function intApprove(id){ try { await api('intApprove', { params: { id: id } }); toast(tx('Approved — the connector starts within a minute.')); _INT_RUN = undefined; intRepaint(); } catch (e) { toast(tx('Could not approve') + ': ' + (e && e.message || e)); } }
async function intReject(jti){ try { await api('keysRevoke', { params: { jti: jti } }); toast(tx('Key revoked — that kit can no longer connect.')); _INT_RUN = undefined; _KEYS = undefined; intRepaint(); } catch (e) { toast(tx('Could not revoke') + ': ' + (e && e.message || e)); } }

/** the kit, fetched with the session so the key rides inside; saved through a blob like the tax export (misTaxDownload) */
async function intDownloadKit(id, adapter){
  try {
    var base = (typeof CFG !== 'undefined' && CFG.API_BASE) || '';
    var r = await fetch(base + '/api/integrations/download/' + encodeURIComponent(id) + '?adapter=' + encodeURIComponent(adapter), { headers: { Authorization: 'Bearer ' + SESSION.token } });
    if (!r.ok) throw new Error('download failed (' + r.status + ')');
    var blob = await r.blob();
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chitbridge-connector-' + id + '.zip'; document.body.appendChild(a); a.click(); a.remove();
    toast(tx('Downloaded — your key is inside. Unzip on the Tally PC and double-click start.cmd.'));
    _INT_RUN = undefined;   /* the new key shows under Your keys on the next paint */
  } catch (e) { toast(tx('Could not download') + ': ' + (e && e.message || e)); }
}

/**
 * ⭐ THE HOME OF CONNECTORS (Athi, 2026-09-05: "include the tally connector as a downloadable option in the system itself …
 * all should reside as part of Integrations; if we build more, it should stay there"). The catalogue comes from the API
 * (routes/integrations.js CATALOGUE) so a new connector appears here the day it is built; the download is a zip of the kit
 * with connector.json pre-filled for THIS API and adapter — the key stays empty, a secret never rides a link.
 */
/** what this connector carries — the streams it owns (2026-09-07). Silent until the ownership map has been read. */
/** the OTHER system's health as of this connector's last run — "live" says the connector checked in, never that Tally answered. */
function intSourceHTML(r){
  var sc = r.source; if (!sc || sc.ok === null || sc.ok === undefined) return '';
  var when = sc.at ? fmtDateTime(sc.at) : '';
  var sys = r.adapter || tx('the other system');
  if (sc.ok) return '<div style="width:100%;font-size:var(--fs-1);color:var(--ok-2)" data-testid="int-source-' + esc(r.id) + '">✓ ' + esc(txf('{sys} answered', { sys: sys })) + (when ? ' · ' + esc(when) : '') + '</div>';
  return '<div style="width:100%;font-size:var(--fs-1);color:var(--warn-3)" data-testid="int-source-' + esc(r.id) + '">⚠ ' + esc(txf('{sys} did not answer', { sys: sys })) + (when ? ' · ' + esc(when) : '') + (sc.why ? ' · ' + esc(sc.why) : '') + ' — ' + tx('the connector keeps trying and starts by itself when it comes back') + '</div>';
}
/** from a running row to that system's own card — the instructions live in one place (2026-09-07) */
function intToSetup(id){ UI.intOpen = id; lsSet('cb_int_open', id); intSetTab('connectors'); }
function intCarriesHTML(r){
  var d = _INT_STR; if (!d || !d.owner) return '';
  var mine = (d.streams || []).filter(function(st){ return d.owner[st.id] === r.id; });
  if (!mine.length) return '<div style="width:100%;font-size:var(--fs-1);color:var(--warn-2)" data-testid="int-carries-' + esc(r.id) + '">' + tx('carries nothing — every stream it can carry belongs to another connector') + '</div>';
  return '<div style="width:100%;font-size:var(--fs-1);color:var(--grey)" data-testid="int-carries-' + esc(r.id) + '">' + esc(tx('carries')) + ': ' + mine.map(function(st){ return esc(tx(st.label)); }).join(' · ') + '</div>';
}
function intConnectorsHTML(tab){   /* T3-SETTINGS: tab = 'connectors' | 'running' (CB Settings paints both cards); absent = the workshop's rail choice */
  if (_INT_CAT === undefined) { _INT_CAT = null; api('intCatalogue').then(function(r){ _INT_CAT = (r && r.connectors) || []; if (intOnShow()) intRepaint(); }).catch(function(){ _INT_CAT = []; if (intOnShow()) intRepaint(); }); }
  if (_INT_RUN === undefined) { _INT_RUN = null; api('intStatus').then(function(r){ _INT_RUN = (r && r.connectors) || []; if (intOnShow()) intRepaint(); }).catch(function(){ _INT_RUN = []; if (intOnShow()) intRepaint(); }); }
  var base = (typeof CFG !== 'undefined' && CFG.API_BASE) || '';
  var cat = _INT_CAT || [], run = _INT_RUN || [];
  var use = intInUse();
  var chosen = use.length ? cat.filter(function(c){ return use.indexOf(c.id) >= 0; }) : cat;
  var rest = use.length ? cat.filter(function(c){ return use.indexOf(c.id) < 0; }) : [];
  var cards = cat.length ? chosen.map(function(c){
    /* ⭐ through the session, not a bare link: the API mints a connector key INTO the zip's connector.json (Athi, 2026-09-06: "download option should autofill everything") */
    /* CX6 (K1): the SERVER says whether this connector works for the shop's country (may/why from the pack) — a refused one stays shown, greyed WITH its sentence */
    var may = c.may || { ok: true }, no = may.ok === false;
    var adapters = (c.adapters || []).map(function(a){ return '<button class="composebtn" data-testid="int-download-' + esc(c.id) + '-' + esc(a) + '"' + (no ? ' disabled aria-disabled="true" title="' + esc(may.why || '') + '" style="opacity:.55;cursor:not-allowed"' : ' onclick="intDownloadKit(\'' + esc(c.id) + '\',\'' + esc(a) + '\')"') + '>⬇ ' + esc(tx('Download')) + ' · ' + esc(a) + '</button>'; }).join(' ');
    var open = intOpen() === c.id;
    var more = '<span data-testid="int-card-' + esc(c.id) + '-toggle" onclick="intToggleCard(\'' + esc(c.id) + '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-1);user-select:none">' + (open ? '▾ ' + tx('less') : '▸ ' + txf('what to do for {name}', { name: c.name })) + '</span>';
    var steps = open ? intCardDetailHTML(c) : '';
    var doc = c.docs ? '<a href="' + esc(base + c.docs) + '" target="_blank" rel="noopener" data-testid="int-docs-' + esc(c.id) + '" style="font-size:var(--fs-1);color:var(--blue)">📄 ' + esc(tx('Instructions')) + '</a>' : '';
    var tick = '<label style="display:inline-flex;gap:5px;align-items:center;font-size:var(--fs-1);color:var(--grey);cursor:pointer"><input type="checkbox" data-testid="int-use-' + esc(c.id) + '"' + (use.indexOf(c.id) >= 0 ? ' checked' : '') + ' onchange="intUseToggle(\'' + esc(c.id) + '\', this.checked)">' + esc(tx('we use this')) + '</label>';
    return '<div data-testid="int-connector-' + esc(c.id) + '" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:8px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1">' + esc(c.name) + '</b>' + tick + ' ' + doc + ' ' + adapters + '</div>'
      + '<div style="font-size:var(--fs-2);margin-top:6px">' + esc(c.does) + '</div>'
      + (no ? '<div data-testid="int-why-' + esc(c.id) + '" style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">' + esc(may.why || '') + '</div>' : '')
      + '<div style="margin-top:6px">' + more + '</div>'
      + (open ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">' + esc(tx('Runs on')) + ': ' + esc(c.runs_on) + ' · ' + esc(c.status) + '</div>' : '')
      + steps + '</div>';
  }).join('') : '<div style="color:var(--grey)">' + tx(_INT_CAT === null ? 'reading…' : 'No connectors published yet.') + '</div>';
  var rows = run.length ? run.map(function(r){ var ago = r.last_seen ? Math.round((Date.now() - new Date(r.last_seen).getTime()) / 60000) : null; var c = r.counters || {};
    return '<div data-testid="int-running-' + esc(r.id) + '" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--line);font-size:var(--fs-2)"><b style="flex:1">' + esc(r.name) + intEnrolHTML(r) + '</b><span style="color:var(--grey);font-size:var(--fs-1)">' + esc(r.adapter || '') + ' · ' + esc(r.host || '') + ' · ' + (ago == null ? '' : (ago < 1 ? tx('just now') : txf('{n} min ago', { n: String(ago) }))) + ' · ' + esc(tx('products')) + ' ' + esc(String(c.products_ok || 0)) + ' · ' + esc(tx('orders')) + ' ' + esc(String(c.orders_ok || 0)) + (c.receipts_ok ? ' · ' + esc(tx('receipts')) + ' ' + esc(String(c.receipts_ok)) : '') + (c.failed ? ' · <span style="color:var(--warn-3)">' + esc(tx('failed')) + ' ' + esc(String(c.failed)) + '</span>' : '') + (r.note ? ' · ' + esc(r.note) : '') + ' · <span data-testid="int-row-help-' + esc(r.id) + '" onclick="intToSetup(\'' + esc(r.adapter || '') + '\')" style="cursor:pointer;color:var(--blue)">' + esc(txf('what to do for {name}', { name: r.adapter || 'this' })) + '</span></span>' + intSourceHTML(r) + intCarriesHTML(r) + '</div>'; }).join('')
    : '<div style="color:var(--grey);font-size:var(--fs-2)">' + tx(_INT_RUN === null ? 'reading…' : 'None has checked in yet — a connector reports here each time it runs, and every five minutes while it watches.') + '</div>';
  if ((tab || intTab()) === 'running') return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Running connectors') + '</div>'
    + intFold('running', ['One row per connector that has checked in.', 'It reports every run, and every five minutes while it watches.', '"Answered" is the other system. "Live" is only the connector itself.', 'Approve a PC once — a kit is approved for one PC at a time.']) + rows + '</div>';
  var more = rest.length ? '<div style="margin-top:10px;font-size:var(--fs-1);color:var(--grey)" data-testid="int-rest">' + esc(txf('{n} you do not use: {names}', { n: String(rest.length), names: rest.map(function(c){ return c.name; }).join(', ') })) + ' — ' + tx('tick "we use this" on one to bring it back') + '</div>' : '';
  return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Connectors') + '</div>'
    + intFold('connectors', ['A small program that runs beside your own system — Tally, Zoho, a folder of files.', 'It carries products and stock up, offers back, and orders down as vouchers.', 'Download, unzip, double-click start.cmd. Your key is already inside.'])
    + cards + more + '</div>';
}
/**
 * ⭐⭐ INTEGRATIONS, ONE QUESTION PER PANE (Athi, 2026-09-07: "the integration screen is overwhelming … it takes time to digest").
 * The rail expands these under Integrations exactly as it expands Governance's layers — no new control to learn — and each pane answers
 * one question: what can I attach · who is checked in · who carries what · did it land · what do the books say about me · what other
 * systems sign in with.
 */
var INT_TABS = [
  { key: 'connectors', n: 'Connectors',      q: 'what you can attach' },
  { key: 'running',    n: 'Running',         q: 'who is checked in, and is the other system answering' },
  { key: 'streams',    n: 'Who owns what',   q: 'one owner per stream' },
  { key: 'books',      n: 'In the books',    q: 'did it land, and what is late' },
  { key: 'store',      n: 'The store',       q: 'what your own books say about you' },
  { key: 'netoffers',  n: 'Network offers',  q: 'offers a brand releases to its stores, and which ones each store takes' },
  { key: 'counters',   n: 'Counters',        q: 'every till on your shop \u2014 where it is, when it last spoke' },
  { key: 'keys',       n: 'Keys & services', q: 'what other systems sign in with' },
];
function intOpen(){ return UI.intOpen !== undefined ? UI.intOpen : lsGet('cb_int_open', ''); }
function intToggleCard(id){ var next = intOpen() === id ? '' : id; UI.intOpen = next; lsSet('cb_int_open', next); intRepaint(); }
/** the four things a person needs about ONE system, in its own card (2026-09-07) */
function intCardDetailHTML(c){
  var group = function(title, lines){
    if (!lines || !lines.length) return '';
    return '<div style="margin-top:8px"><div style="font-size:var(--fs-1);font-weight:700;color:var(--grey);text-transform:uppercase;letter-spacing:.04em">' + esc(tx(title)) + '</div>'
      + '<ul style="margin:3px 0 0;padding-inline-start:18px;font-size:var(--fs-2)">' + lines.map(function(l){ return '<li style="margin:2px 0">' + esc(tx(l)) + '</li>'; }).join('') + '</ul></div>';
  };
  return '<div data-testid="int-detail-' + esc(c.id) + '" style="border-top:1px solid var(--line);margin-top:8px;padding-top:2px">'
    + group('Before you start', c.needs)
    + group('What to do', c.steps)
    + group('If it does not work', c.watch_out)
    + group('Once it runs, look here', ['Running — is it checked in, and did ' + (c.default_adapter || c.id) + ' answer it', 'Who owns what — which streams this connector carries', 'In the books — whether each order reached it, and what is late'])
    + '</div>';
}
function intTab(){ var k = UI.intTab || lsGet('cb_int_tab', 'connectors'); return INT_TABS.some(function(t){ return t.key === k; }) ? k : 'connectors'; }
/* ⚠️ THE RAIL IS PART OF THE PAINT (Athi, 2026-09-07: "when I click the submenu the details change on the right, but the menu marked
   in a different colour does not change"). intRepaint() repaints the BODY only, so the highlight stayed on the old row — the same
   reason govSetTab calls renderApp() first. Copying that, rather than inventing a second way to move a selection. */
function intSetTab(k){ UI.intTab = k; lsSet('cb_int_tab', k); if (typeof renderApp === 'function') renderApp(); intRepaint(); }
/** ⭐ the prose folds, and stays folded — an explanation is worth reading once, not on every visit (2026-09-07) */
function intFold(key, lines){
  var open = lsGet('cb_fold_' + key, '1') === '1';
  var list = (Array.isArray(lines) ? lines : [lines]).map(function(l){ return '<li style="margin:2px 0">' + esc(tx(l)) + '</li>'; }).join('');
  return '<div style="font-size:var(--fs-2);margin-bottom:6px">'
    + '<span data-testid="int-fold-' + esc(key) + '" onclick="intFoldToggle(\'' + esc(key) + '\')" style="cursor:pointer;color:var(--grey);font-size:var(--fs-1);user-select:none">' + (open ? '▾ ' + tx('less') : '▸ ' + tx('what this is')) + '</span>'
    + (open ? '<ul style="margin:4px 0 0;padding-inline-start:18px">' + list + '</ul>' : '') + '</div>';
}
function intFoldToggle(key){ lsSet('cb_fold_' + key, lsGet('cb_fold_' + key, '1') === '1' ? '0' : '1'); intRepaint(); }
/** ⭐ which systems this account actually runs. A DISPLAY choice, not a connection: it puts them first and folds the rest away. */
function intInUse(){ var v = ((typeof SESSION !== 'undefined' && SESSION.policy_flags) || {}).connectors_in_use; return Array.isArray(v) ? v.filter(function(x){ return x !== 'none'; }) : []; }
async function intUseToggle(id, on){
  var now = intInUse().filter(function(x){ return x !== id; });
  if (on) now.push(id);
  try {
    var r = await api('policySet', { body: { connectors_in_use: now.length ? now : ['none'] } });
    if (typeof SESSION !== 'undefined') SESSION.policy_flags = (r && r.flags) || Object.assign({}, SESSION.policy_flags || {}, { connectors_in_use: now });
    intRepaint();
  } catch (e) { toast(tx('Could not save') + ': ' + (e && e.message || e)); }
}

/**
 * ⭐⭐ WHO OWNS WHICH STREAM (Athi, 2026-09-07: "say quantity gets posted in ERP, sales record in Tally and possibly Zoho CRM — will it
 * not confuse the purpose?"). Many systems on one account is a real setup; many systems on one STREAM is not. The first connector to
 * carry a stream claims it, so an account with one system is never asked a question — this card is where a migration hands one over.
 */
var _INT_STR;
function intStreamsHTML(){
  if (_INT_STR === undefined) { _INT_STR = null; api('intStreams').then(function(r){ _INT_STR = r || {}; if (intOnShow()) intRepaint(); }).catch(function(){ _INT_STR = { error: true }; if (intOnShow()) intRepaint(); }); }
  var d = _INT_STR || {}; var list = d.streams || [], own = d.owner || {}, con = d.connectors || [];
  if (_INT_STR === null) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Who owns what') + '</div><div style="color:var(--grey);font-size:var(--fs-2)">' + tx('reading…') + '</div></div>';
  var nameOf = function(id){ var c = con.find(function(x){ return x.id === id; }); return c ? (c.name + ' · ' + (c.adapter || '')) : id; };
  var body;
  if (!con.length) body = '<div style="color:var(--grey);font-size:var(--fs-2)">' + tx('No connector has checked in yet. The first one to run claims the streams it can carry.') + '</div>';
  else if (con.length === 1 && Object.keys(own).length) body = '<div style="font-size:var(--fs-2)" data-testid="int-streams-single">' + txf('{name} carries everything.', { name: con[0].name }) + ' ' + tx('A second connector claims only what is still free, and this is where you would hand a stream over.') + '</div>';
  else body = '<div style="overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:var(--fs-2)"><thead><tr>'
      + '<th style="text-align:start;padding:4px 8px">' + tx('Stream') + '</th><th style="text-align:start;padding:4px 8px">' + tx('What travels') + '</th><th style="text-align:start;padding:4px 8px">' + tx('Carried by') + '</th></tr></thead><tbody>'
      + list.map(function(st){
          var sel = '<select class="inp" data-testid="int-stream-' + esc(st.id) + '" onchange="intStreamSet(\'' + esc(st.id) + '\', this.value)">'
            + '<option value="">' + esc(tx('nobody')) + '</option>'
            + con.map(function(c){ return '<option value="' + esc(c.id) + '"' + (own[st.id] === c.id ? ' selected' : '') + '>' + esc(nameOf(c.id)) + '</option>'; }).join('')
            + (own[st.id] && !con.find(function(c){ return c.id === own[st.id]; }) ? '<option value="' + esc(own[st.id]) + '" selected>' + esc(own[st.id]) + ' (' + esc(tx('not running')) + ')</option>' : '')
            + '</select>';
          return '<tr><td style="padding:5px 8px;border-top:1px solid var(--line)"><b>' + esc(tx(st.label)) + '</b><div style="font-size:var(--fs-1);color:var(--grey)">' + esc(st.dir === 'in' ? tx('into ChitBridge') : tx('out to the other system')) + '</div></td>'
            + '<td style="padding:5px 8px;border-top:1px solid var(--line);font-size:var(--fs-1);color:var(--grey)">' + esc(tx(st.what)) + '</td>'
            + '<td style="padding:5px 8px;border-top:1px solid var(--line)">' + sel + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Who owns what') + '</div>'
    + intFold('streams', ['Several connectors are fine — a POS for stock, the books for vouchers, a CRM for parties.', 'Each stream belongs to exactly one of them, or the same order becomes a voucher in two ledgers.', 'The first connector to carry a stream claims it. Change it here when a migration ends.']) + body + '</div>';
}
async function intStreamSet(stream, kit){
  try { var body = {}; body[stream] = kit || null; await api('intStreamsSet', { body: body });
    toast(kit ? tx('Stream handed over — the connector picks it up within a minute.') : tx('Stream left unowned — nobody carries it now.'));
    _INT_STR = undefined; intRepaint();
  } catch (e) { toast(tx('Could not change it') + ': ' + (e && e.message || e)); }
}

/* ── CB SETTINGS › CONNECTORS — the page's host mounts the three cards here (T3-SETTINGS) ─────────────────────────────────────────────────── */
var CBConnectors = (function () {
  var H = { el: null };
  function active(){ return !!(H.el && H.el.isConnected); }
  function paint(){
    if (!active()) return;
    H.el.innerHTML = '<h2 class="shop-h" data-testid="int-title">' + esc(tx('Connectors')) + '</h2>'
      + intConnectorsHTML('connectors') + '<div style="margin-top:12px">' + intConnectorsHTML('running') + '</div>'
      + '<div style="margin-top:12px">' + intStreamsHTML() + '</div>';
  }
  function mount(host){ H.el = document.createElement('div'); H.el.setAttribute('data-testid', 'int-screen'); host.appendChild(H.el); _INT_CAT = undefined; _INT_RUN = undefined; _INT_STR = undefined; paint(); }
  return { mount: mount, paint: paint, active: active };
})();
function intRepaint(){ if (CBConnectors.active()) CBConnectors.paint(); else if (typeof loadSettings === 'function') loadSettings(); }
function intOnShow(){ return CBConnectors.active() || (typeof setSec === 'function' && setSec() === 'integrations'); }
