/* app/cap-admin.js — the "admin" capability (progressively loaded on demand).
 * Injected by ensureCap('admin') the first time an admin screen (CAP_OF) is opened.
 * Classic script, shared global scope: references Core/helpers globals that are eager and already
 * present before this loads — api, mapApiActor, hatAssignable, menuAssist, scr, opt, inr, esc,
 * scrErr, val, toast, MSG, _CARD, CURRENCIES, UI. Screens: MIS, Profile, Settings (+ governance).
 * (Co-assists is planned to move here too, once its shared actor helpers are separated.) */

if (typeof EP !== 'undefined') { Object.assign(EP, {
  vaultGet:  {m:'GET', p:'/api/governance/profile',       ok:'y'},   // returns the trade profile incl. .vault
  vaultSave: {m:'PUT', p:'/api/governance/profile/vault', ok:'y'},
  /* ⚠️ SAME PATH AS cap-messages' msgInbox, under a DIFFERENT KEY. The EP registry rejects duplicate keys
     (guard-static check 1), and MIS must not depend on the messages capability having been opened first —
     Friction counts unattended messages whether or not you have ever visited Messages. */
  misMsgs: {m:'GET', p:'/api/folders/messages', ok:'y'},
}); }
// ── TRADE DOCUMENTS VAULT — the recurring inputs a business provides ONCE that pre-fill every authority form. Grouped;
// matches the backend whitelist (lib/profile.js VAULT_SCHEMA). Gather here → forms are ~70% pre-filled thereafter. ──
var VAULT_UI=[
  {g:'identity', t:'🏢 Business identity', f:[['legal_name','Legal name','as registered'],['trade_name','Trade / brand name',''],['address','Address',''],['city','City',''],['state','State',''],['pincode','PIN / ZIP',''],['country','Country','e.g. India'],['email','Email',''],['phone','Phone','']]},
  {g:'signatory', t:'✍️ Authorised signatory', f:[['name','Name',''],['designation','Designation','e.g. Director']]},
  {g:'registrations', t:'🪪 Registrations', f:[['gstin','GSTIN','15-char'],['pan','PAN',''],['iec','IEC','Import-Export Code'],['ad_code','AD code','bank AD code'],['lut','LUT','export LUT no.']]},
  {g:'banking', t:'🏦 Banking', f:[['bank_name','Bank name',''],['account_no','Account no.',''],['ifsc','IFSC',''],['swift','SWIFT / BIC',''],['ad_branch','AD branch','']]},
  {g:'logistics', t:'🚢 Logistics defaults', f:[['port_loading','Port of loading','e.g. Nhava Sheva'],['incoterm','Preferred Incoterm','e.g. CIF'],['mode','Mode','Sea / Air']]}
];
function vaultCardHTML(vault, encrypted){
  vault=vault||{};
  // F1 — honest at-rest signal. Encrypted (AES-256-GCM, key never in DB) → safe for real data; not configured → dummy only.
  var encBanner = encrypted
    ? '<div style="font-size:10.5px;color:#256e47;background:#eaf6ee;border:1px solid #bfe3cb;border-radius:8px;padding:7px 10px;margin:6px 0 2px">🔒 <b>Encrypted at rest</b> — stored ciphertext-only (a database dump can\'t read it). Safe for real banking &amp; tax details.</div>'
    : '<div style="font-size:10.5px;color:#8a5f11;background:#fdf3e3;border:1px solid #f0dcae;border-radius:8px;padding:7px 10px;margin:6px 0 2px">⚠ <b>Encryption not configured</b> — the vault won\'t save until the platform sets its encryption key. Use <b>dummy data only</b> for now.</div>';
  var groups=VAULT_UI.map(function(G){
    var fields=G.f.map(function(fl){ var k=fl[0], v=(vault[G.g]&&vault[G.g][k])||'';
      return '<div style="display:flex;flex-direction:column;gap:2px"><label style="font-size:10px;color:var(--grey);font-weight:600">'+esc(fl[1])+'</label><input class="inp" id="v_'+G.g+'_'+k+'" value="'+esc(v)+'" placeholder="'+esc(fl[2]||'')+'" style="margin:0"></div>'; }).join('');
    return '<div style="margin-top:13px"><div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:7px">'+G.t+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+fields+'</div></div>';
  }).join('');
  return '<div style="'+_CARD+';margin-top:10px"><div class="sec" style="margin:0">🗂 Trade documents vault <span style="font-size:10px;font-weight:600;color:var(--grey)">— fill once · pre-fills every form</span></div>'
    +'<div style="font-size:11px;color:var(--grey);margin:3px 0 2px;line-height:1.5">These recurring details auto-fill your Commercial Invoice, Packing List and other authority forms. At form time you\'ll only be asked the shipment-specifics (invoice no, dates, ports).</div>'
    +encBanner
    +groups
    +'<div class="err" id="vault_err" style="margin-top:8px"></div>'
    +'<button class="composebtn" style="margin-top:11px" onclick="saveVaultUI()">Save vault</button></div>';
}
async function loadVault(){
  var host=document.getElementById('vaulthost'); if(!host) return;
  try{ var p=(await api('vaultGet'))||{}; host.innerHTML=vaultCardHTML(p.vault||{}, !!p.vault_encrypted); }
  catch(e){ host.innerHTML=vaultCardHTML({}, false); }
  if(window.CBOffline)CBOffline.autodraft(host,'app.vault',{overwrite:true});   // restore unsaved edits over the server copy
}
async function saveVaultUI(){
  var err=document.getElementById('vault_err'); if(err)err.textContent='';
  var vault={};
  VAULT_UI.forEach(function(G){ var grp={}; G.f.forEach(function(fl){ var el=document.getElementById('v_'+G.g+'_'+fl[0]); var v=el?(el.value||'').trim():''; if(v)grp[fl[0]]=v; }); if(Object.keys(grp).length)vault[G.g]=grp; });
  try{ await api('vaultSave',{body:{vault:vault}}); if(window.CBOffline)CBOffline.clearDraft('app.vault'); if(typeof toast==='function')toast('Vault saved ✓'); }
  catch(e){ if(err)err.textContent=(e&&e.message)||'Could not save the vault'; }
}
/* ═══ MIS ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * ⭐ REBUILT 2026-08-16. It was eight equal tiles — chits, value, open, in progress, closed, disputes, co-assists,
 * suppliers — and the trouble was not the layout, it was that EVERY ONE OF THOSE NUMBERS IS KNOWABLE INSIDE A
 * SINGLE COMPANY. CB stands between parties and sees both sides of a transaction, which no single ERP does, and
 * the old screen spent that vantage point on counts an accounts package already prints.
 *
 * Four bands, ordered by "would you act on this today", in the app's own two-pane shell (Athi: *"how do we bring
 * it as two sided panel? because all should be similar"*) — the rail is the set, the right pane is the selected
 * thing, exactly as Task→chit and Suppliers→catalogue. The rail carries each band's HEADLINE, so it is a summary
 * in its own right and the old tile grid is condensed rather than lost. `Overview` renders all four at once, which
 * is the one thing a two-pane shell would otherwise have cost (Athi: *"each at a time, or an option bar on top"*).
 *
 * ⚠️ NOTHING HERE IS INVENTED. Every figure is derived from chits already fetched. Where a number would require
 * logic that does not exist yet (counterparty reliability, mass balance) the band says so rather than showing a
 * plausible score — the same discipline netAvail set by waiting for lib/availability.js.
 */
var MIS_BANDS = [
  { key:'overview', name:'Overview', q:'Everything, condensed' },
  { key:'position', name:'Position', q:'How much is real?' },
  { key:'flow',     name:'Flow',     q:'What is moving?' },
  { key:'friction', name:'Friction', q:'What is stuck?' },
  { key:'trust',    name:'Trust',    q:'Who can I rely on?' }
];
/**
 * ⚠️ THE STATUS→MONEY MAPPING, AND THE TRAP IN IT. `cancelled` and `rejected` live in the `close` bucket beside
 * `completed`, so "committed = closed" would count DEAD value as real money. They are excluded from both sides and
 * reported separately — silently dropping them would be a lie of omission, and folding them in would be worse.
 */
var MIS_COMMITTED = { accepted:1, in_progress:1, partial:1, completed:1 };   // someone said yes
var MIS_FORECAST  = { pending:1, delivered:1, read:1 };                      // sent, nobody has committed
var MIS_DEAD      = { cancelled:1, rejected:1 };

/**
 * ⚠️ ON MOBILE, PICKING A ROW MUST SLIDE TO THE DETAIL. The shell hides .detail under .appwrap.m unless the panel
 * carries .showdetail, so without this the three new two-pane screens showed their rail and then did nothing at
 * all when tapped — the row highlighted and the content stayed invisible. selectSupplier has always done this;
 * one helper rather than the same three lines in MIS, Profile and Settings.
 */
function _capShowDetail(){
  if (UI.vp !== 'mob') return;
  UI.mdetail = true;
  var p = document.getElementById('panel'); if (p) p.classList.add('showdetail');
}
function misBand(){ return UI.misBand || 'overview'; }
/* Repaint from the cached model when we have one — switching band is not a reason to re-fetch five endpoints. */
function misSetBand(k){ UI.misBand = k; renderApp(); _capShowDetail();
  if (UI._mis){ const h=document.getElementById('misbody'); if (h) h.innerHTML = misBandHTML(k, UI._mis); } else { loadMIS(); } }
function misPeriod(){ return UI.misPeriod || 'all'; }
function misSetPeriod(p){ UI.misPeriod = p; renderApp(); loadMIS(); }   // a new window DOES need the data re-bucketed

function misScreen(){
  var m = UI._mis;
  var rail = MIS_BANDS.map(function(b){
    var sel = (misBand() === b.key) ? ' sel' : '';
    var hv = m ? misHeadline(b.key, m) : { v:'·', s:'' };
    return '<div class="row misrow' + sel + '" data-testid="mis-band-' + b.key + '" onclick="misSetBand(\'' + b.key + '\')">'
      + '<div class="main2"><div class="l1"><span class="code">' + esc(b.name) + '</span></div>'
        + '<div class="l2">' + esc(b.q) + '</div></div>'
      + '<div class="misval' + (hv.tone ? ' ' + hv.tone : '') + '">' + hv.v + '<small>' + esc(hv.s) + '</small></div></div>';
  }).join('');
  var seg = function(p, l){ return '<button class="' + (misPeriod() === p ? 'on' : '') + '" onclick="misSetPeriod(\'' + p + '\')">' + l + '</button>'; };
  /* The period bar sits ABOVE the split because it reframes all four bands at once; anything scoped to one band
     lives inside that band. Same rule that puts the Suppliers tabs above its list. */
  var bar = '<div class="misbar"><span class="misttl">📊 MIS</span>'
    + '<span class="seg">' + seg('7', '7 days') + seg('30', '30 days') + seg('all', 'All time') + '</span>'
    + '<span class="misbar-r">' + (m ? '<span class="misasof">live · ' + esc(m.asOf) + '</span>' : '')
    + '<button class="composebtn" onclick="aiRun(\'metrics-narrate\',UI._mis,{title:\'📊 Explain my metrics\'})" title="AI narrates what your numbers say">✨ Explain</button></span></div>';
  var list = '<div class="list"><div class="lh" style="padding:0">' + bar + '</div>'
    + '<div class="rows" id="mis_rail">' + rail + '</div></div>';
  var detail = '<div class="detail" id="detailpane"><div id="misbody">'
    + (m ? misBandHTML(misBand(), m) : '<div class="loadwrap"><span class="spin"></span> loading…</div>') + '</div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  /**
   * ⚠️ ITS OWN RAIL WIDTH, not the shared UI.lw. Task and Suppliers hold lists of unbounded, variable-length rows,
   * so people drag those panes wide — and MIS then inherited that width for FIVE FIXED ROWS, pushing its detail
   * pane off the screen entirely. The rail's content here has a natural size; borrowing another screen's is what
   * made it wrong. Still draggable — startDrag writes UI.lw, and misLw only supplies the default.
   */
  if (UI.misLw == null) UI.misLw = 320;
  var lw = Math.min(UI.misLw, Math.max(260, Math.round((window.innerWidth || 1200) * 0.42)));
  return '<div class="panel' + ((UI.vp === 'mob' && UI.mdetail) ? ' showdetail' : '') + '" id="panel" style="--lw:' + lw + 'px;--lh:' + (UI.lh || 300) + 'px">' + list + divider + detail + '</div>';
}

/* The rail doubles as the summary, so each row needs its own headline — one number and one word of context. */
function misHeadline(k, m){
  if (k === 'overview') return { v: MIS_BANDS.length - 1, s: 'bands' };
  if (k === 'position') return { v: inr(m.committed), s: 'committed' };
  if (k === 'flow')     return { v: m.chits, s: m.periodLabel };
  if (k === 'friction'){
    const un = (m.unattended || []).length;
    /* The headline leads with whichever is worse — an unanswered message is friction the chit queue never showed. */
    if (un) return { v: m.waiting.length + un, s: un + ' unanswered', tone:'warn' };
    return { v: m.waiting.length, s: m.waiting.length ? ('oldest ' + m.waiting[0].age) : 'nothing stuck', tone: m.waiting.length ? 'warn' : 'ok' };
  }
  if (k === 'trust')    return { v: m.suppliers, s: m.open_disputes ? (m.open_disputes + ' disputes') : '0 disputes', tone: m.open_disputes ? 'warn' : 'ok' };
  return { v: '·', s: '' };
}

function misBandHTML(k, m){
  if (k === 'overview') return misOverview(m);
  if (k === 'position') return misPosition(m);
  if (k === 'flow')     return misFlow(m);
  if (k === 'friction') return misFriction(m);
  if (k === 'trust')    return misTrust(m);
  return '';
}
function _misHead(t, s){ return '<div class="dh">' + esc(t) + '</div><div class="ds" style="margin-bottom:14px">' + esc(s) + '</div>'; }
function _misSplitBar(m){
  var tot = m.committed + m.forecast;
  if (!tot) return '<div class="misnote">No value on any chit yet.</div>';
  var cp = Math.round(m.committed / tot * 100);
  return '<div class="misplit"><span style="background:var(--blue);width:' + cp + '%"></span>'
    + '<span style="background:var(--gold);width:' + (100 - cp) + '%"></span></div>'
    + '<div class="miskey"><span class="k"><i class="sw" style="background:var(--blue)"></i> Committed ' + inr(m.committed) + '</span>'
    + '<span class="k"><i class="sw" style="background:var(--gold)"></i> Forecast ' + inr(m.forecast) + '</span></div>';
}
function _misStack(m){
  var t = m.chits || 1;
  var seg = function(n, col){ return n ? '<span style="background:' + col + ';width:' + (n / t * 100) + '%">' + n + '</span>' : ''; };
  return '<div class="misstack">' + seg(m.open, 'var(--blue)') + seg(m.in_progress, 'var(--prog)') + seg(m.closed, 'var(--ok)') + '</div>'
    + '<div class="miskey"><span class="k"><i class="sw" style="background:var(--blue)"></i> Open</span>'
    + '<span class="k"><i class="sw" style="background:var(--prog)"></i> In progress</span>'
    + '<span class="k"><i class="sw" style="background:var(--ok)"></i> Closed</span></div>';
}
/* A real series off created_at — no invented shape. Flat line when there is only one bucket, which is honest. */
function _misSpark(series){
  if (!series || series.length < 2) return '<div class="misnote">Not enough history yet for a trend — one bucket of data.</div>';
  var max = Math.max.apply(null, series.map(function(p){ return p.n; })) || 1;
  var pts = series.map(function(p, i){
    var x = 6 + i * (288 / (series.length - 1));
    return Math.round(x) + ',' + Math.round(50 - (p.n / max) * 42);
  }).join(' ');
  var last = pts.split(' ').pop().split(',');
  return '<svg class="misspark" viewBox="0 0 300 56" preserveAspectRatio="none" role="img" aria-label="Chits per period, latest ' + series[series.length - 1].n + '">'
    + '<polyline points="' + pts + '" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="var(--blue)" stroke="#fff" stroke-width="2"/></svg>';
}

function misPosition(m){
  var tot = m.committed + m.forecast;
  var pct = tot ? Math.round(m.committed / tot * 100) : 0;
  return _misHead('Position', 'How much of the pipeline is authoritative, and how much is still a forecast.')
    + '<div class="mistwo"><div>'
      + '<div class="mislbl">Committed · someone said yes</div>'
      + '<div class="mishero">' + inr(m.committed) + '</div>'
      + '<div class="misnote">' + pct + '% of the book is authoritative — accepted, in progress or completed.</div>'
      + _misSplitBar(m)
    + '</div><div>'
      + '<div class="mislbl">Forecast · nobody has committed</div>'
      + '<div class="misfore">' + inr(m.forecast) + '</div>'
      + '<div class="misnote" style="margin-top:7px">Sent or received but not yet accepted. Real work — nobody has promised it.</div>'
      + (m.dead ? '<div class="miswarn">' + inr(m.dead) + ' on cancelled or rejected chits, counted in neither.</div>' : '')
    + '</div></div>'
    + '<div class="miswhy">The old screen showed <b>' + inr(m.committed + m.forecast + m.dead) + '</b> as one “deal value”, blending all three — which <b>overstates the book</b>.</div>';
}
function misFlow(m){
  return _misHead('Flow', 'What is moving through the rail, and at what rate.')
    + '<div class="mistwo"><div>'
      + '<div class="mislbl">Chits by state</div><div class="misbig">' + m.chits + '</div>' + _misStack(m)
      + '<div class="miswhy">Three peer tiles hid that <b>' + m.open + ' + ' + m.in_progress + ' + ' + m.closed + ' = ' + m.chits + '</b>.</div>'
    + '</div><div>'
      + '<div class="mislbl">Chits per ' + esc(m.bucketName) + '</div>'
      + '<div class="misbig">' + m.chits + (m.delta ? ' <span class="misdelta">▲ ' + m.delta + '</span>' : '') + '</div>'
      + _misSpark(m.series)
    + '</div></div>';
}
/* Ageing as a distribution, not a number — the oldest bucket carries the warning tone because that is the one
   worth acting on. An empty bucket renders as a flat rule rather than vanishing, so the scale stays readable. */
function _misAgeing(m){
  const tot = m.waiting.length; if (!tot) return '';
  const max = Math.max.apply(null, m.ageing.map(function(b){ return b.n; })) || 1;
  const cells = m.ageing.map(function(b, i){
    const warn = (i >= 2 && b.n > 0);
    return '<div class="misage' + (warn ? ' warn' : '') + '">'
      + '<div class="misagebar"><i style="height:' + Math.round((b.n / max) * 100) + '%"></i></div>'
      + '<div class="misagen">' + b.n + '</div><div class="misagek">' + b.k + '</div></div>';
  }).join('');
  return '<div class="mislbl" style="margin-top:16px">Ageing · how long they have waited</div>'
    + '<div class="misageing">' + cells + '</div>';
}
function _misUnattended(m){
  const u = m.unattended || [];
  if (!u.length) return '<div class="misnote" style="margin-top:14px">✓ No unanswered messages.</div>';
  const rows = u.slice(0, 4).map(function(x){
    return '<div class="misunrow"><span class="misunage">' + esc(x.age) + '</span>'
      + '<span class="misuntxt"><b>' + esc(x.from) + '</b> — ' + esc(x.text) + '</span></div>';
  }).join('');
  return '<div class="mislbl" style="margin-top:16px">Unanswered messages · ' + u.length + ' waiting on you</div>'
    + '<div class="misunatt">' + rows
    + (u.length > 4 ? '<div class="misnote" style="padding:6px 0 0">…and ' + (u.length - 4) + ' more.</div>' : '')
    + '</div>';
}
function misFriction(m){
  var rows = m.waiting.slice(0, 12).map(function(w){
    return '<tr><td>' + esc(w.on) + '</td><td>' + esc(w.subject) + '</td><td class="num">' + esc(w.age) + '</td>'
      + '<td class="num">' + (w.amt ? inr(w.amt) : '—') + '</td>'
      + '<td><span class="misclock ' + w.who + '">◷ ' + (w.who === 'mine' ? 'Mine' : 'Theirs') + '</span></td></tr>';
  }).join('');
  return _misHead('Friction', 'Where time is being lost — and whose clock is running.')
    + '<div class="misstatus">' + (m.open_disputes
        ? '<i class="dot" style="background:var(--disp)"></i> <b>' + m.open_disputes + ' open dispute' + (m.open_disputes === 1 ? '' : 's') + '</b>'
        : '<i class="dot" style="background:var(--ok)"></i> <b>No open disputes</b>')
      + '<span class="misnote" style="margin-left:8px">· ' + m.chits + ' chits · ' + (m.open_disputes ? 'needs resolving' : 'nothing to resolve') + '</span></div>'
    + _misAgeing(m) + _misUnattended(m)
    + (rows
      ? '<div class="mislbl" style="margin-top:18px">The queue · oldest first</div>'
        + '<div class="misscroll"><table class="mistable"><thead><tr><th>Waiting on</th><th>Chit</th><th>Age</th><th>Value</th><th>Whose clock</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="misnote" style="margin-top:12px">Nothing is waiting — every chit has been accepted or closed.</div>')
    + '<div class="miswhy">Disputes sit here as a <b>status</b>, not a count: <b>0</b> in a plain tile read exactly like <b>Suppliers 2</b>, when one is a health signal and the other is inventory.</div>';
}
function misTrust(m){
  var chan = m.byChannel;
  var chanTxt = Object.keys(chan).length
    ? Object.keys(chan).map(function(c){ return chan[c] + ' by ' + esc(c); }).join(' · ')
    : 'none captured — everything entered by hand';
  return _misHead('Trust', 'Who you deal with, and how the work reaches you.')
    + '<div class="mistrust">'
      + '<div><div class="mislbl">Counterparties</div><div class="misbig" style="font-size:24px">' + m.parties + '</div>'
        + '<div class="misnote">' + (m.partyNames.length ? esc(m.partyNames.slice(0, 3).join(' · ')) : 'no counterparties yet') + '</div></div>'
      + '<div><div class="mislbl">Suppliers on your list</div><div class="misbig" style="font-size:24px">' + m.suppliers + '</div>'
        + '<div class="misnote">' + m.co_assists + ' co-assist' + (m.co_assists === 1 ? '' : 's') + ' working the rail</div></div>'
      + '<div><div class="mislbl">How work arrives</div><div class="misbig" style="font-size:24px">' + m.captured + ' <span style="font-size:13px;color:var(--grey)">of ' + m.chits + '</span></div>'
        + '<div class="misnote">' + chanTxt + '</div></div>'
    + '</div>'
    /* ⚠️ The band I most want and have NOT verified is computable. Say so rather than show a score I cannot stand behind. */
    + '<div class="miswhy">⚠️ <b>Counterparty reliability</b> — who confirms fast, who delivers short — is the most valuable thing this band could report and is <b>not built</b>. It needs behaviour over time that nothing currently records. Shown as plain counts until that exists, rather than as a score.</div>';
}
function misOverview(m){
  var sec = function(name, q, inner){
    return '<div class="misov"><div class="misovh"><span class="misovn">' + esc(name) + '</span><span class="misnote">' + esc(q) + '</span></div>' + inner + '</div>';
  };
  var tot = m.committed + m.forecast, pct = tot ? Math.round(m.committed / tot * 100) : 0;
  return _misHead('Overview', 'All four bands at once — open one on the left for its detail.')
    + sec('Position', 'How much of the pipeline is real?',
        '<div class="mistwo"><div><div class="mishero" style="font-size:30px">' + inr(m.committed) + '</div>'
        + '<div class="misnote">committed · ' + pct + '% of the book</div></div><div>' + _misSplitBar(m) + '</div></div>')
    + sec('Flow', 'What is moving through the rail?',
        '<div class="mistwo"><div>' + _misStack(m) + '</div><div>' + _misSpark(m.series) + '</div></div>')
    + sec('Friction', 'Where is time being lost?',
        '<div class="misstatus">' + (m.open_disputes
          ? '<i class="dot" style="background:var(--disp)"></i> <b>' + m.open_disputes + ' open</b>'
          : '<i class="dot" style="background:var(--ok)"></i> <b>No open disputes</b>')
        + '<span style="margin-left:9px">' + (m.waiting.length
            ? '<b>' + m.waiting.length + ' waiting</b> — ' + m.waitTheirs + ' on <span class="misclock theirs">◷ Theirs</span> ' + m.waitMine + ' on <span class="misclock mine">◷ Mine</span>'
            : 'nothing waiting') + '</span></div>'
        + ((m.unattended || []).length
            ? '<div class="misnote" style="margin-top:6px">⚠ <b>' + m.unattended.length + ' unanswered message'
              + (m.unattended.length === 1 ? '' : 's') + '</b> — oldest ' + esc(m.unattended[0].age) + '</div>'
            : '')
        + _misAgeing(m))
    + sec('Trust', 'Who can I rely on?',
        '<div class="misnote"><b>' + m.parties + ' counterparties</b> · ' + m.captured + ' of ' + m.chits + ' chits captured from a channel · ' + m.suppliers + ' suppliers</div>');
}

async function loadMIS(){
  if (!document.getElementById('mis_rail')) return;
  try{
    /* ⚠️ BOTH SIDES, NOT JUST inbox. "Whose clock" is unanswerable from received copies alone — everything would
       read as mine. Merged by id so a self-chit, which lands in both, is counted once. */
    const [inb, snt, dq, ac, sp, msgRaw] = await Promise.all([
      api('inbox'), api('sent').catch(function(){ return []; }),
      api('disputeQueue').catch(function(){ return {}; }),
      api('actors').catch(function(){ return []; }), api('supList').catch(function(){ return []; }),
      api('misMsgs').catch(function(){ return []; })
    ]);
    const seen = {}, chits = [];
    (inb || []).concat(snt || []).forEach(function(raw){
      const c = mapApiChit(raw); if (!c || seen[c.id]) return; seen[c.id] = 1;
      c._iSent = !!SESSION.entity && (c.sender || '') === SESSION.entity;
      chits.push(c);
    });

    const days = misPeriod() === 'all' ? null : parseInt(misPeriod(), 10);
    const cutoff = days ? (Date.now() - days * 864e5) : null;
    const inWindow = chits.filter(function(c){ return !cutoff || (new Date(c.created_at)).getTime() >= cutoff; });

    let committed = 0, forecast = 0, dead = 0;
    const byState = { open:0, act:0, close:0 };
    const byChannel = {}; let captured = 0;
    const parties = {}; const waiting = [];
    const now = Date.now();
    inWindow.forEach(function(c){
      const st = c._status || 'pending', amt = c.amt || 0;
      if (MIS_DEAD[st]) dead += amt; else if (MIS_COMMITTED[st]) committed += amt; else if (MIS_FORECAST[st]) forecast += amt;
      byState[c.state] = (byState[c.state] || 0) + 1;
      if (c.via && c.via.channel){ captured++; byChannel[c.via.channel] = (byChannel[c.via.channel] || 0) + 1; }
      const other = c._iSent ? (c.party || '') : (c.sender || c.party || '');
      if (other && other !== SESSION.entity) parties[other] = 1;
      if (MIS_FORECAST[st]){
        const ageMs = now - (new Date(c.created_at)).getTime();
        const d = Math.floor(ageMs / 864e5), h = Math.floor(ageMs / 36e5);
        waiting.push({ on:'Acceptance', subject:c.code || '—', amt:amt, ageMs:ageMs,
                       age: d >= 1 ? (d + 'd') : (h + 'h'),
                       /* I sent it → they owe the answer. It came to me → the clock is mine. */
                       who: c._iSent ? 'theirs' : 'mine' });
      }
    });
    waiting.sort(function(a, b){ return b.ageMs - a.ageMs; });

    /* Weekly buckets when the span is wide, daily when it is short — a 7-day window has no weeks in it. */
    const stamps = inWindow.map(function(c){ return (new Date(c.created_at)).getTime(); }).filter(function(t){ return t; }).sort();
    let series = [], bucketName = 'week';
    if (stamps.length){
      const spanDays = (stamps[stamps.length - 1] - stamps[0]) / 864e5;
      const size = spanDays > 21 ? 7 : 1; bucketName = size === 7 ? 'week' : 'day';
      const buckets = {};
      stamps.forEach(function(t){ const b = Math.floor((t - stamps[0]) / (size * 864e5)); buckets[b] = (buckets[b] || 0) + 1; });
      const maxB = Math.max.apply(null, Object.keys(buckets).map(Number));
      for (let i = 0; i <= maxB; i++) series.push({ n: buckets[i] || 0 });
    }
    const delta = series.length >= 2 ? (series[series.length - 1].n - series[series.length - 2].n) : 0;

    /**
     * ⭐ AGEING + UNATTENDED (Athi, 2026-08-16: *"can we bring aging, message unattended etc"*).
     *
     * Ageing is the classic receivables question asked of the rail: not "how many are waiting" but "how long have
     * they been waiting", because a day-old wait and a fortnight-old wait are not the same fact and a single count
     * hides which you have.
     *
     * ⚠️ AN UNANSWERED MESSAGE IS TIME LOST TOO, and it was invisible here. A counterparty asking "can you deliver
     * before 7pm" and getting no reply is exactly the friction this band exists to surface — it just never had a
     * chit status to show up under. Inbound and unread, aged the same way; messages I sent are not my delay.
     */
    const AGE_BUCKETS = [
      { k:'<1d',  max:1 }, { k:'1–3d', max:3 }, { k:'3–7d', max:7 }, { k:'7d+', max:Infinity }
    ];
    const ageing = AGE_BUCKETS.map(function(b){ return { k:b.k, n:0 }; });
    waiting.forEach(function(w){
      const d = w.ageMs / 864e5;
      for (let i = 0; i < AGE_BUCKETS.length; i++){ if (d < AGE_BUCKETS[i].max){ ageing[i].n++; break; } }
    });

    const msgs = (msgRaw && (msgRaw.messages || msgRaw.items || (Array.isArray(msgRaw) ? msgRaw : []))) || [];
    const unattended = msgs.filter(function(m){
      /* Unread AND not mine — my own outbound message sitting unread is THEIR clock, not a task of mine. */
      return !m.read_at && m.sender_entity_id !== SESSION.entityId;
    }).map(function(m){
      const ms = now - (new Date(m.created_at)).getTime();
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5);
      return { from:m.sender_display_name || '—', text:(m.message_text || '').slice(0, 90),
               subject:m.manual_subject || m.auto_subject || '—', ageMs:ms, age: d >= 1 ? (d + 'd') : (h + 'h') };
    }).sort(function(a, b){ return b.ageMs - a.ageMs; });

    const openDisp = dq.total_open != null ? dq.total_open : (((dq.my_disputes || []).length) + ((dq.other_disputes || []).length));
    UI._mis = {
      chits: inWindow.length, committed: committed, forecast: forecast, dead: dead,
      open: byState.open, in_progress: byState.act, closed: byState.close,
      open_disputes: openDisp, co_assists: (ac || []).length, suppliers: (sp || []).length,
      parties: Object.keys(parties).length, partyNames: Object.keys(parties),
      captured: captured, byChannel: byChannel,
      waiting: waiting, waitMine: waiting.filter(function(w){ return w.who === 'mine'; }).length,
      waitTheirs: waiting.filter(function(w){ return w.who === 'theirs'; }).length,
      ageing: ageing, unattended: unattended,
      series: series, bucketName: bucketName, delta: delta > 0 ? delta : 0,
      periodLabel: misPeriod() === 'all' ? 'all time' : ('last ' + misPeriod() + 'd'),
      asOf: new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }),
      currency: 'INR'
    };
    const h = document.getElementById('misbody'); if (h) h.innerHTML = misBandHTML(misBand(), UI._mis);
    const r = document.getElementById('mis_rail');
    if (r) r.innerHTML = MIS_BANDS.map(function(b){
      const sel = (misBand() === b.key) ? ' sel' : '', hv = misHeadline(b.key, UI._mis);
      return '<div class="row misrow' + sel + '" data-testid="mis-band-' + b.key + '" onclick="misSetBand(\'' + b.key + '\')">'
        + '<div class="main2"><div class="l1"><span class="code">' + esc(b.name) + '</span></div><div class="l2">' + esc(b.q) + '</div></div>'
        + '<div class="misval' + (hv.tone ? ' ' + hv.tone : '') + '">' + hv.v + '<small>' + esc(hv.s) + '</small></div></div>';
    }).join('');
  }catch(e){ const h = document.getElementById('misbody'); if (h) h.innerHTML = scrErr(e); } }

/* ---- PROFILE ---- */
/* ═══ PROFILE ═══════════════════════════════════════════════════════════════════════════════════════════════
 * Same two-pane grammar as MIS, Task and Suppliers — sections on the left, the selected section on the right.
 * It was one long scroll of four unrelated cards (identity, storefront, governance, vault) with no way to tell
 * where one ended and the next began, which is how the storefront's "Is your shop open?" came to sit a few
 * hundred pixels under identity's "Shop status" and read as its contradiction.
 */
var PROF_SECS = [
  { key:'identity',   name:'Identity',    q:'Who you are on the rail' },
  { key:'storefront', name:'Storefront',  q:'What customers can see' },
  { key:'governance', name:'Governance',  q:'Rights and jurisdiction' },
  { key:'vault',      name:'Documents',   q:'Fill forms once, reuse' }
];
function profSec(){ return UI.profSec || 'identity'; }
/**
 * ⚠️ REPAINT THE BODY DIRECTLY — do not rely on the post-render hook. renderApp() rewrites the pane to its
 * "loading…" placeholder and the `if(UI.nav==="profile") loadProfile()` hook fires while #profbody is not yet in
 * the document, so loadProfile's `if(!h) return` bailed and every section sat on the spinner forever. It worked on
 * FIRST entry only, because arriving at the screen triggers a second render that the section switch does not.
 */
function profSetSec(k){ UI.profSec = k; renderApp(); _capShowDetail(); if (UI._me) { const h=document.getElementById('profbody');
  if (h){ h.innerHTML = profSecHTML(k, UI._me); if (k === 'vault') loadVault(); } } else { loadProfile(); } }

function profileScreen(){
  if (SESSION.role === 'actor') return scr('👤 Profile', 'profbody', 'profile');   // actors keep the simple card
  var e = UI._me || {};
  var rail = PROF_SECS.map(function(s){
    return '<div class="row misrow' + (profSec() === s.key ? ' sel' : '') + '" data-testid="prof-sec-' + s.key + '" onclick="profSetSec(\'' + s.key + '\')">'
      + '<div class="main2"><div class="l1"><span class="code">' + esc(s.name) + '</span></div><div class="l2">' + esc(s.q) + '</div></div></div>';
  }).join('');
  var list = '<div class="list"><div class="lh" style="padding:0"><div class="misbar"><span class="misttl">👤 Profile</span>'
    + '<span class="misbar-r"><span class="misasof">' + esc(e.display_name || '') + '</span></span></div></div>'
    + '<div class="rows" id="prof_rail">' + rail + '</div></div>';
  var detail = '<div class="detail" id="detailpane"><div id="profbody"><div class="loadwrap"><span class="spin"></span> loading…</div></div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  if (UI.misLw == null) UI.misLw = 320;
  var lw = Math.min(UI.misLw, Math.max(260, Math.round((window.innerWidth || 1200) * 0.42)));
  return '<div class="panel' + ((UI.vp === 'mob' && UI.mdetail) ? ' showdetail' : '') + '" id="panel" style="--lw:' + lw + 'px;--lh:' + (UI.lh || 300) + 'px">' + list + divider + detail + '</div>';
}

async function loadProfile(){ const h=document.getElementById("profbody"); if(!h)return;
  if(SESSION.role==='actor') return loadActorProfile(h);   // actors get their own profile, not the entity's
  try{ const e=(await api("me"))||{}; UI._me=e;
    h.innerHTML = profSecHTML(profSec(), e);
    if (profSec() === 'vault') loadVault();   // the trade documents vault (async — pre-fills authority forms)
  }catch(e){ h.innerHTML=scrErr(e); } }

function profSecHTML(k, e){
  if (k === 'identity') return _misHead('Identity', 'Who you are on the rail — and how others find you.')
    + `<div class="${_CARD}"><div class="kv"><b>Name</b> · ${esc(e.display_name)}</div><div class="kv"><b>Bridge ID</b> · ${esc(e.bridge_id)}</div><div class="kv"><b>Email</b> · ${esc(e.email)}</div></div>
      <label class="fl">User ID <span style="color:var(--grey);font-size:11px">— others add you with this</span></label><input class="inp" id="pf_uid" value="${esc(e.user_id||'')}" placeholder="e.g. yourname or you@email.com">
      <label class="fl">GSTN</label><input class="inp" id="pf_gstn" value="${esc(e.gstn)}">
      <label class="fl">Address</label><input class="inp" id="pf_addr" value="${esc(e.address)}">
      <label class="fl">Are you trading? <span style="color:var(--grey);font-size:11px">— whether you are open for business</span></label>
      <select class="inp" id="pf_bs">${opt(["open","closed","away"],e.business_status)}</select>
      <div class="misnote" style="margin-top:5px">⚠️ Separate from who can <b>see</b> your catalogue — that lives under <b onclick="profSetSec('storefront')" style="cursor:pointer;color:var(--blue)">Storefront</b>.</div>
      <div class="err" id="pf_err"></div><button class="composebtn" style="margin-top:11px" onclick="saveProfile()">Save profile</button>`;
  if (k === 'storefront') return _misHead('Storefront', 'What customers see when they open your link.')
    + storefrontCardHTML(e);
  if (k === 'governance') return _misHead('Governance', 'Where you are minted, and what that entitles you to.')
    + (govCardHTML(e.governance) || '<div class="misnote">No governance resolved for this entity yet.</div>');
  if (k === 'vault') return _misHead('Trade documents', 'Provide these once — every authority form is then pre-filled.')
    + '<div id="vaulthost"><div class="loadwrap"><span class="spin"></span> loading…</div></div>';
  return '';
}
// "Your governance" — the entity's resolved governance (from attributes): where it's minted, its platform, its basics
// (with provenance ⟵ platform), rights + allowances + jurisdiction. Entity-simple; honest "minted, not enforced yet".
function govCardHTML(g){
  if(!g) return '';
  var inst=g.installation||{}, b=g.basics||{}, j=g.jurisdiction||{};
  var caps=(g.capabilities||[]).map(function(c){return '<span class="optchip" style="background:#eef3fb;color:#345488;border-color:#cfe0f4">'+esc(c)+'</span>';}).join(' ');
  var allow=(g.allowances||[]).map(function(a){return esc(a.limit+' '+a.resource);}).join(' · ');
  var langs=(b.languages||[]).join(', ');
  var loc=[inst.cloud,inst.region,inst.zone].filter(Boolean).join(' · ');
  return '<div style="'+_CARD+';margin-top:10px">'
    +'<div class="sec" style="margin:0 0 8px">🏛️ Your governance <span style="font-size:10px;font-family:\'Space Mono\';background:#f3f0e8;color:#7a5e22;border-radius:5px;padding:1px 6px">minted · not enforced yet</span></div>'
    +'<div class="kv"><b>Governed by</b> · '+esc(g.constitution||'—')+' <span style="color:var(--grey);font-size:11px">🔒 platform-set</span></div>'
    +'<div class="kv"><b>Installation</b> · '+esc(inst.label||inst.key||'—')+(loc?(' <span style="color:var(--grey);font-size:11px">'+esc(loc)+'</span>'):'')+'</div>'
    +'<div class="kv"><b>Basics</b> <span style="color:var(--grey);font-size:11px">⟵ from your platform</span> · '+esc(b.currency||'—')+' · '+esc(b.timezone||'—')+' · '+esc(b.region||'—')+(langs?(' · '+esc(langs)):'')+'</div>'
    +'<div style="margin:7px 0 2px;font-size:12.5px"><b>Rights</b> '+(caps||'<span style="color:var(--grey);font-size:11px">—</span>')+'</div>'
    +(allow?('<div class="kv"><b>Allowances</b> · '+allow+'</div>'):'')
    +(j.disclaimer?('<div style="font-size:11px;color:var(--grey);margin-top:7px;line-height:1.5"><b>Jurisdiction</b> — '+esc(j.mode||'')+(j.custodian===false?' · provider, not custodian':'')+'<br>'+esc(j.disclaimer)+'</div>'):'')
    +'</div>';
}
async function saveProfile(){ const x=document.getElementById("pf_err"); if(x)x.textContent="";
  try{ await api("saveProfile",{body:{user_id:val("pf_uid")||null,gstn:val("pf_gstn")||null,address:val("pf_addr")||null,business_status:val("pf_bs")}}); toast(MSG.profileSaved()); }catch(e){ if(x)x.textContent=e.message; } }
// 🛍️ Customer storefront — the shareable public shop link + the browse-first / login-first access mode.
function storefrontCardHTML(e){
  var url=location.origin+'/shop.html?bridge='+encodeURIComponent(e.bridge_id||'');
  var acc=e.storefront_access||'browse';
  var vis=e.catalogue_visibility||'private';   // b114 — absent means not published (EFFECTIVE, cap applied)
  var cap=e.visibility_cap||{max:'public',by:null,reason:''};
  var capped=(cap.max==='private');
  var sfopts=[['browse','Browse first — catalogue is open; sign in only to order'],['login','Login first — customer signs in before browsing']]
    .map(function(o){return '<option value="'+o[0]+'"'+(acc===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');
  return '<div style="'+_CARD+';margin-top:10px">'
    +'<div class="sec" style="margin:0 0 8px">🛍️ Customer storefront</div>'
    +'<div style="font-size:12px;color:var(--grey);line-height:1.5;margin-bottom:8px">Share this link — anyone can open it and order from your catalogue. No account needed (they confirm with a one-time code).</div>'
    +'<div style="background:#f4f6f8;border:1px solid var(--line);border-radius:9px;padding:8px 10px"><span class="mono" id="sf_url" style="font-size:11.5px;word-break:break-all">'+esc(url)+'</span></div>'
    +'<div style="display:flex;gap:8px;margin-top:8px"><button class="composebtn" onclick="sfCopy()">📋 Copy link</button><button class="composebtn" style="background:#fff" onclick="window.open(document.getElementById(\'sf_url\').textContent,\'_blank\')">Open ↗</button></div>'
    // ── IS THE SHOP OPEN AT ALL? ─────────────────────────────────────────────────────────────────────────────
    // Athi, 2026-08-06: "it says the store does not have a public catalogue — how do I make it public?"
    //
    // He could not, and neither could anyone else. b114 made publishing an EXPLICIT act and shipped no way to
    // perform it: the only mention of catalogue_visibility in the whole front end was a read-only Settings row.
    // The API has read and written it since b114; the control simply did not exist. So every shop sat private,
    // its storefront link opened onto "this shop has no public catalogue", and the owner had no lever.
    //
    // It belongs HERE, immediately above the link it governs — a link that does not work is the symptom, and the
    // switch that makes it work should not be on a different screen.
    // ── A CONTROL THAT CANNOT WORK MUST NOT LOOK LIKE ONE ────────────────────────────────────────────────────
    // The cap comes from /me (`visibility_cap`): the operator who provisioned this entity, then the plan. When it
    // is capped, the switch is DISABLED and says WHO capped it — offering a working-looking control that 403s on
    // save is the same lie as a button that reports success and does nothing.
    /* ⚠️ RENAMED FROM "Is your shop open?". That is the same English question as identity's "Shop status", but a
       different fact — this one is public/network/private VISIBILITY, that one is open/closed/away TRADING. The
       screen read "Shop status: open" above "Is your shop open?: Closed", and I misread it as a contradiction
       with the source in front of me. Two names for one question is a bug even when both values are correct. */
    +'<label class="fl" style="margin-top:12px">Who can see your catalogue</label>'
    +'<select class="inp" id="pf_catvis" data-testid="pf-catvis" style="max-width:340px"'+(capped?' disabled':'')+'>'
      // THREE TIERS (b115). `network` is the warehouse case: invisible to the world, visible to the businesses
      // under the same network. Worded by WHO SEES IT rather than by the value, because "network" means nothing to
      // a shopkeeper and "the other businesses in your network" means exactly what it says.
      +(capped ? '<option value="private" selected>Closed — set by your network operator</option>'
               : '<option value="public"'+(vis==='public'?' selected':'')+'>Open — anyone with the link can see your catalogue</option>'
                +'<option value="network"'+(vis==='network'?' selected':'')+'>Network only — the other businesses in your network can see it; the public cannot</option>'
                +'<option value="private"'+(vis==='private'||!vis?' selected':'')+'>Closed — the link shows nothing, to anyone</option>')
    +'</select>'
    +(capped
      ? '<div style="margin-top:7px;font-size:12px;color:#6a44a8;background:#F0EAF9;border:1px solid #e3d5f5;border-radius:8px;padding:7px 10px">🔒 '+esc(cap.reason||'This entity may not publish a public catalogue.')+'<div style="color:var(--grey);margin-top:3px">You cannot change this here — it is set '+(cap.by==='operator'?'by whoever provisioned this entity':'by your plan')+'.</div></div>'
      : (vis==='network'
          ? '<div style="margin-top:7px;font-size:12px;color:#6a44a8;background:#F0EAF9;border:1px solid #e3d5f5;border-radius:8px;padding:7px 10px">🔗 <b>Network only.</b> Businesses under your network see this catalogue. A shopper on the link above sees nothing — and neither does an outside business that adds you as a supplier.</div>'
          : (vis!=='public' ? '<div style="margin-top:7px;font-size:12px;color:#B4483C;background:#FBEDEA;border:1px solid #f3d9d5;border-radius:8px;padding:7px 10px">⚠ Your shop is CLOSED. The link above will show &ldquo;this shop has no public catalogue&rdquo; — to customers and to other businesses looking at you as a supplier.</div>' : '')))
    +'<label class="fl" style="margin-top:12px">Customer access</label><select class="inp" id="pf_sfaccess" style="max-width:340px">'+sfopts+'</select>'
    +'<div class="err" id="pf_err2"></div><button class="composebtn" style="margin-top:9px" onclick="saveStorefront()">Save storefront</button>'
    +'</div>';
}
function sfCopy(){ var u=document.getElementById('sf_url'); if(!u)return; var t=u.textContent;
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(function(){toast('Storefront link copied ✓');}).catch(function(){toast(t);}); }
  else toast(t); }
async function saveStorefront(){ var x=document.getElementById('pf_err2'); if(x)x.textContent='';
  try{ await api('saveProfile',{body:{storefront_access:val('pf_sfaccess'), catalogue_visibility:(document.getElementById('pf_catvis')&&document.getElementById('pf_catvis').disabled)?undefined:val('pf_catvis')}});
    toast(val('pf_catvis')==='public' ? 'Shop is OPEN — your link works now ✓' : 'Shop is CLOSED — the link shows nothing');
    if(typeof loadProfile==='function') loadProfile(); }catch(e){ if(x)x.textContent=e.message; } }

// Actor's own profile — their identity (from the JWT) + self-service Change PIN. Hat/shift/access are set by
// the entity; the actor sets Duty/Break from the top bar.
function loadActorProfile(h){
  const p=(typeof jwtPayload==='function'&&jwtPayload(SESSION.token))||{};
  const login=(p.actor_key&&p.parent_entity_name)?(p.actor_key+'@'+p.parent_entity_name):(SESSION.name||'');
  const kv=(l,v)=>`<div style="display:flex;gap:10px;padding:9px 13px;border-bottom:1px dashed var(--line);font-size:13px;align-items:baseline"><b style="min-width:104px;color:var(--grey);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px">${l}</b><span style="font-weight:600;flex:1">${(v==null||v==='')?'—':v}</span></div>`;
  h.innerHTML=`${menuAssist('profile')}<div class="sec">Your profile</div>
    <div class="itab" style="border:1px solid var(--line);border-radius:11px;overflow:hidden;margin-bottom:10px">
      ${kv('Name',esc(SESSION.name||p.display_name||''))}
      ${kv('Login','<span class="mono">'+esc(login)+'</span>')}
      ${kv('Role',esc(p.actor_role||''))}
      ${kv('Works for',esc(p.parent_entity_name||SESSION.entity||''))}
      ${kv('Status',SESSION.duty==='break'?'On break':'On duty')}</div>
    <div style="${_CARD}"><div class="sec" style="margin:0 0 8px">🔑 Change your PIN</div>
      <label class="fl">Current PIN</label><input class="inp" id="pf_cpin" inputmode="numeric" maxlength="4" style="max-width:150px" placeholder="4 digits">
      <label class="fl">New PIN</label><input class="inp" id="pf_npin" inputmode="numeric" maxlength="4" style="max-width:150px" placeholder="4 digits">
      <label class="fl">Confirm new PIN</label><input class="inp" id="pf_npin2" inputmode="numeric" maxlength="4" style="max-width:150px" placeholder="4 digits">
      <div class="err" id="pf_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveActorPin()">Change PIN</button></div>
    <div style="font-size:11px;color:var(--grey);margin-top:8px;line-height:1.5">Your <b>hat</b>, shift and access are managed by your entity. Set your <b>Duty / Break</b> from the top bar.</div>`;
}
async function saveActorPin(){ const x=document.getElementById("pf_err"); if(x)x.textContent="";
  const c=val("pf_cpin"), n=val("pf_npin"), n2=val("pf_npin2");
  if(!/^\d{4}$/.test(n)){ if(x)x.textContent="New PIN must be 4 digits."; return; }
  if(n!==n2){ if(x)x.textContent="New PINs don't match."; return; }
  try{ await api("changePin",{body:{current_pin:c,new_pin:n,confirm_pin:n2}}); toast("PIN changed ✓"); ['pf_cpin','pf_npin','pf_npin2'].forEach(function(i){ var el=document.getElementById(i); if(el)el.value=''; }); }
  catch(e){ if(x)x.textContent=e.message; } }
/* ---- SETTINGS + governance (7-layer perception stub) ---- */
const GOV=[
  { n:'1 · Constitution', tag:'platform · top layer', desc:'Platform-wide rules every entity inherits at mint. Set the locale here → it flows down into the boilerplate.', rows:[
    ['Message max length','unbounded','advisory'],['Max schemas / entity','2','bound'],
    ['Catalogue visibility','private (cap)','chosen'],['Attachment types','image, pdf, docx, xlsx, csv, zip','advisory'],
    ['Attachment max size','10 MB','advisory'] ] },
  { n:'2 · Jurisdiction', tag:'country / legal', desc:'Country-specific legal & tax frame (locale bundle lands partly here).', rows:[
    ['Country','—','free'],['Tax regime (GST / VAT)','—','free'],['Legal framework','—','free'],
    ['Date / number format','—','free'] ] },
  { n:'3 · Vertical', tag:'business type', desc:'Defaults for your line of business.', rows:[
    ['Business vertical','—','free'],['Default units','—','free'],['Vertical currency default','—','free'] ] },
  { n:'4 · Standards', tag:'codes / units', desc:'Measurement & coding standards.', rows:[
    ['Units of measure','—','free'],['Code standards (HSN / SKU)','—','free'] ] },
  { n:'5 · Content', tag:'shared assets · versioned', desc:'Shared catalogue / manuals / images published once & carried by reference, not copied.', rows:[
    ['Shared catalogue / manuals / images','published once · referenced','free'],['Asset reference','asset_id @ version','free'],
    ['On update','new version; frozen chits keep the old','free'] ] },
  { n:'6 · ERP', tag:'integration', desc:'System integration adapters.', rows:[
    ['ERP adapter','—','free'],['Sync mode','—','free'] ] },
  { n:'7 · Consolidation', tag:'→ boilerplate the entity inherits', desc:'The 7 layers consolidate into the Boilerplate every entity copies at registration; the locale below is inherited from Constitution.', rows:[
    ['Assignment model','both · entity setting','entity'],
    ['Default max tasks / actor','10 · entity setting','entity'] ] }
];
function govKlass(k){ var M={bound:['lock · bound','#fbeceb','#b4453f'],bound_set:['pick-from-set','#EEF3FB','#3F66A6'],advisory:['advisory · mutable','#E4F0E9','#2F6B49'],chosen:['tighten-only','#F5ECD6','#7a5e22'],free:['free · TBD','#efeee9','#8a8a82'],inherited:['inherited · frozen','#EEF3FB','#3F66A6'],entity:['entity setting','#E4F0E9','#2F6B49'],metered:['metered ↑ · licensing','#EFEAF6','#5b4a86'],protected:['protected · platform','#E7EBF0','#46546b']}; var x=M[k]||M.free; return '<span style="font-size:9.5px;font-family:\'Space Mono\';background:'+x[1]+';color:'+x[2]+';border-radius:5px;padding:1px 6px;white-space:nowrap">'+x[0]+'</span>'; }
var TIMEZONES=['Asia/Kolkata','UTC','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','America/Sao_Paulo','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Africa/Johannesburg'];
var LANGS=[['en','English'],['ta','Tamil'],['hi','Hindi']];
var GOVSET=(function(){ var d={currency:'INR',timezone:'Asia/Kolkata',language:'en'}; try{ return Object.assign(d, JSON.parse(localStorage.getItem('cb_govset')||'{}')); }catch(_){ return d; } })();
function govSetVal(k,v){ GOVSET[k]=v; try{ localStorage.setItem('cb_govset', JSON.stringify(GOVSET)); }catch(_){ } var h=document.getElementById('govblock'); if(h)h.outerHTML=govLayersBlock(); }
function govSel(k,opts){ return '<select class="inp" style="width:auto;min-width:160px;padding:4px 8px;font-size:12px" onchange="govSetVal(\''+k+'\',this.value)">'+opts.map(function(o){ var v=Array.isArray(o)?o[0]:o, l=Array.isArray(o)?(o[0]+' · '+o[1]):o; return '<option value="'+esc(v)+'"'+(GOVSET[k]===v?' selected':'')+'>'+esc(l)+'</option>'; }).join('')+'</select>'; }
function govRowHtml(label,valHtml,klass){ return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)"><span style="flex:1;font-size:12.5px;color:var(--ink)">'+esc(label)+'</span><span style="font-size:12px;color:var(--grey);font-family:\'Space Mono\'">'+valHtml+'</span>'+govKlass(klass)+'</div>'; }
function govSetTab(i){ UI.govTab=i; var h=document.getElementById('govblock'); if(h)h.outerHTML=govLayersBlock(); }
function govLayersBlock(){ var t=UI.govTab||0; var L=GOV[t];
  var tabs=GOV.map(function(g,i){ return '<button class="composebtn'+(i===t?' on':'')+'" style="font-size:11px;padding:5px 9px" onclick="govSetTab('+i+')">'+esc(g.n)+'</button>'; }).join('');
  var rowsHtml='';
  if(t===0){ rowsHtml+=govRowHtml('Currency',govSel('currency',CURRENCIES),'advisory'); rowsHtml+=govRowHtml('Timezone',govSel('timezone',TIMEZONES),'advisory'); rowsHtml+=govRowHtml('Language',govSel('language',LANGS),'bound_set'); }
  else if(t===6){ var ll=(LANGS.filter(function(x){return x[0]===GOVSET.language;})[0]||['',''])[1]||GOVSET.language; rowsHtml+=govRowHtml('Currency (inherited)',esc(GOVSET.currency)+' · from Constitution','inherited'); rowsHtml+=govRowHtml('Timezone (inherited)',esc(GOVSET.timezone)+' · from Constitution','inherited'); rowsHtml+=govRowHtml('Language (inherited)',esc(GOVSET.language)+' ('+esc(ll)+') · from Constitution','inherited'); }
  rowsHtml+=L.rows.map(function(r){ return govRowHtml(r[0],esc(r[1]),r[2]); }).join('');
  if(t===0){ rowsHtml+='<div style="margin:13px 0 2px;font-family:\'Space Grotesk\';font-weight:700;font-size:12.5px;color:#46546b">⚙ Installation · platform-only (master)</div>'+govRowHtml('Cloud provider','AWS','protected')+govRowHtml('Region','ap-south-1','protected')+govRowHtml('Storage adapter','db → S3 / Azure / GCS','protected')+govRowHtml('Storage bucket','chitbridge-prod-•••','protected')+govRowHtml('Secrets / keys','•••• managed (never exposed)','protected')+govRowHtml('System health','● healthy','protected'); rowsHtml+='<div style="margin:13px 0 2px;font-family:\'Space Grotesk\';font-weight:700;font-size:12.5px;color:#5b4a86">↑ Metered up to Constitution · for licensing</div>'+govRowHtml('Entities provisioned','1','metered')+govRowHtml('Networks formed','0','metered')+govRowHtml('Chits issued','—','metered')+govRowHtml('Data stored','—','metered')+govRowHtml('Plan tier','Free · 5 entities / 10 chits-day / 1 network','metered'); }
  var foot=(t===0)?'Change a value above, then open <b>tab 7 · Consolidation</b> — the entity inherits it via the boilerplate. <i>Stub: in production these arrive from the layer, not this screen.</i>':(t===6)?'These ride down from the layers into the <b>boilerplate</b> every entity copies at registration, and <b>freeze</b> onto each chit at send. <i>Stub — later set from the real layer.</i>':'<b>bound</b> = inherited &amp; locked · <b>advisory</b> = entity may change when upstream leaves it free · <b>free</b> = not configured yet, lands here later.';
  return '<div id="govblock" style="'+_CARD+'"><div class="sec" style="margin:0 0 8px">🏛️ Governance · 7 layers <span style="font-size:10px;font-family:\'Space Mono\';background:#f3f0e8;color:#7a5e22;border-radius:5px;padding:1px 6px">stub · perception</span></div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:11px">'+tabs+'</div><div style="font-family:\'Space Grotesk\';font-weight:700;font-size:14px">'+esc(L.n)+' <span style="font-size:10.5px;color:var(--grey);font-weight:400">· '+esc(L.tag)+'</span></div><div style="font-size:12px;color:var(--grey);margin:2px 0 9px">'+esc(L.desc)+'</div>'+rowsHtml+'<div style="font-size:11px;color:var(--grey);margin-top:9px;line-height:1.5">'+foot+'</div></div>';
}
/* ═══ SETTINGS ══════════════════════════════════════════════════════════════════════════════════════════════
 * Eight cards in one scroll — governance layers, assignment, auto-assign, attachment policy, AI, channels, policy
 * flags, blueprints — with nothing marking where one subject ended and the next began. Grouped into five sections
 * in the same two-pane shell the rest of the app uses.
 *
 * ⚠️ The "saved but NOT YET ACTIVE" warning stays exactly where it is. It is the most useful sentence on the
 * screen: a preference that is stored and unenforced looks identical to one that works.
 */
var SET_SECS = [
  { key:'work',       name:'Work',        q:'How tasks reach people' },
  { key:'policy',     name:'Policy',      q:'Rules on your records' },
  { key:'channels',   name:'Channels',    q:'Where work arrives from' },
  { key:'governance', name:'Governance',  q:'The layers you sit under' },
  { key:'blueprints', name:'Blueprints',  q:'Shared catalogue designs' }
];
function setSec(){ return UI.setSec || 'work'; }
/* Same reason as profSetSec — the hook fires before #setbody exists, so drive the load explicitly. */
function setSetSec(k){ UI.setSec = k; renderApp(); _capShowDetail(); loadSettings(); }

function settingsScreen(){
  var rail = SET_SECS.map(function(s){
    return '<div class="row misrow' + (setSec() === s.key ? ' sel' : '') + '" data-testid="set-sec-' + s.key + '" onclick="setSetSec(\'' + s.key + '\')">'
      + '<div class="main2"><div class="l1"><span class="code">' + esc(s.name) + '</span></div><div class="l2">' + esc(s.q) + '</div></div></div>';
  }).join('');
  var list = '<div class="list"><div class="lh" style="padding:0"><div class="misbar"><span class="misttl">⚙️ Settings</span></div></div>'
    + '<div class="rows" id="set_rail">' + rail + '</div></div>';
  var detail = '<div class="detail" id="detailpane"><div id="setbody"><div class="loadwrap"><span class="spin"></span> loading…</div></div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  if (UI.misLw == null) UI.misLw = 320;
  var lw = Math.min(UI.misLw, Math.max(260, Math.round((window.innerWidth || 1200) * 0.42)));
  return '<div class="panel' + ((UI.vp === 'mob' && UI.mdetail) ? ' showdetail' : '') + '" id="panel" style="--lw:' + lw + 'px;--lh:' + (UI.lh || 300) + 'px">' + list + divider + detail + '</div>';
}
// AI assists settings = a REDIRECT to Co-assists (the enable + rule live WITH the actor, next to Human/IoT/ERP —
// a lit AI slot is an actor whose actions are disputable chits, so its control belongs where it's held accountable).
function aiSettingsCard(){ return '<div style="'+_CARD+'"><div class="sec" style="margin:0 0 6px">🤖 AI assists <span style="font-size:10px;font-family:\'Space Mono\';background:#f3f0e8;color:#7a5e22;border-radius:5px;padding:1px 6px">governed</span></div>'
  +'<div style="font-size:12px;color:var(--grey);line-height:1.55">Turn AI helpers on or off and set each one\'s rule — the human gate, bounded by the rung floor (you can only tighten). They live with your other co-assists, because a lit AI slot is an <b>actor</b> whose every action is a chit you can dispute.</div>'
  +'<button class="composebtn" style="margin-top:10px" onclick="goCoassistAI()">Configure AI assists in Co-assists →</button></div>'; }
function goCoassistAI(){ try{ if(typeof UI!=='undefined') UI.acTypeF='ai'; }catch(_){}
  if(typeof navTo==='function') navTo('coassists'); else if(typeof go==='function') go('#/coassists'); }
/**
 * ⚠️ FETCH ONCE, PAINT MANY. Switching section is not a reason to re-read settings and the actor list — and until
 * this cache existed every switch fired both again, so the pane sat on its spinner while a round trip completed
 * for data it already had.
 */
async function loadSettings(){ const h=document.getElementById("setbody"); if(!h)return;
  if (UI._set){ return paintSettings(UI._set.s, UI._set.daOpts); }
  try{ const [s,_acts]=await Promise.all([api("getSettings").then(r=>r||{}), api("actors").then(r=>(r||[]).map(mapApiActor)).catch(()=>[])]);
    const _assign=_acts.filter(a=>hatAssignable(a.hat));
    const _daOpts='<option value="">— none (leave in pool) —</option>'+_assign.map(a=>`<option value="${a.id}"${s.default_assignee_actor_id===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
    UI._set={ s:s, daOpts:_daOpts };
    paintSettings(s, _daOpts);
  }catch(e){ h.innerHTML=scrErr(e); } }
function paintSettings(s, _daOpts){ const h=document.getElementById("setbody"); if(!h)return;
  { const k = setSec();
    const notYet = '<div style="background:#fbeceb;border:1px solid #f0c9c6;border-radius:8px;padding:8px 11px;font-size:11.5px;color:#b4453f;margin-bottom:11px">⏳ These preferences are saved but <b>not yet active</b> — they don\'t change behaviour yet.</div>';
    if (k === 'work') h.innerHTML = _misHead('Work', 'How tasks reach the people and co-assists who do them.')
      + `<div style="${_CARD}">${notYet}
      <label class="fl">Assignment model</label><select class="inp" id="st_am">${opt(["pull","push","both"],s.assignment_model||"both")}</select>
      <label class="fl">Default max tasks per actor</label><input class="inp" id="st_mt" inputmode="numeric" value="${esc(s.default_max_tasks||10)}">
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_av" ${s.all_task_visible?'checked':''}> All tasks visible to all co-assists</label>
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_ar" ${s.auto_return_on_short_break?'checked':''}> Auto-return tasks on short break</label>
      <div class="err" id="st_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveSettings()">Save settings</button></div>`
      + autoAssignCard(s,_daOpts) + aiSettingsCard();
    else if (k === 'policy') h.innerHTML = _misHead('Policy', 'Rules that govern your own records.')
      + policyFlagsCard()
      + `<div style="border:1px solid var(--line);border-radius:11px;padding:13px;margin-top:10px"><div class="sec" style="margin:0 0 6px">📎 Attachment policy <span style="font-size:10px;font-family:'Space Mono';background:#f3f0e8;color:#7a5e22;border-radius:5px;padding:1px 6px">governance · stub</span></div><label class="fl">Allowed types</label><input class="inp" id="st_atttypes" value="image, pdf, docx, xlsx, csv, zip"><label class="fl">Max size per file (MB)</label><input class="inp" id="st_attsize" inputmode="numeric" value="10"><label class="fl">Max attachments per chit</label><input class="inp" id="st_attcount" inputmode="numeric" value="10"><div style="font-size:11px;color:var(--grey);margin-top:6px">Where allowed-types / size / count rules live (enforced backend-side). Not active yet.</div></div>`;
    else if (k === 'channels'){ h.innerHTML = _misHead('Channels', 'The inbound numbers and addresses that become chits.') + channelsCard();
      loadChannels();   // async — the card paints itself in when the read lands
    }
    else if (k === 'governance') h.innerHTML = _misHead('Governance', 'The layers your entity is minted under.') + govLayersBlock();
    else if (k === 'blueprints') h.innerHTML = _misHead('Blueprints', 'Catalogue designs you publish or adopt.') + blueprintSettingsHTML();
  } }
async function saveSettings(){ const x=document.getElementById("st_err"); if(x)x.textContent="";
  try{ await api("saveSettings",{body:{assignment_model:val("st_am"),default_max_tasks:+val("st_mt")||10,all_task_visible:document.getElementById("st_av").checked,auto_return_on_short_break:document.getElementById("st_ar").checked}}); toast(MSG.settingsSaved()); }catch(e){ if(x)x.textContent=e.message; } }
/* ---- POLICY FLAGS — per-entity governance toggles, SERVER-PERSISTED (b130).
 *
 * Athi, 2026-08-09: *"make the policy flags real, move it to settings."*
 *
 * They were a localStorage prototype: the card said "set ✓", nothing left the browser, and the server that has to
 * ENFORCE them never heard. `self_copy_pref` was the sharpest version of that — it has a real, enforced column, and
 * this card wrote past it into localStorage, so the one flag with teeth was the one the UI had disconnected.
 *
 * The schema still lives here (the card renders from data, not from markup), but the VALUES now come from and go
 * to /api/entities/policy, which validates against its own whitelist. The server never trusts this list.
 */
var POLICY_FLAGS = [
  /* ⚠️ AN ENTITY IS CREATED FOR A PURPOSE. Athi: *"sell and purchase never been the same entity. while testing we
     are trying to test all the possibility in the same business, so for us it seems the same entity will do
     everything, but that is not going to be the case."* Which side of the trade an entity is on does not change
     message to message — which is why this is a setting here and not the per-raise toggle I first built. */
  { key:'trade_side',        label:'This entity',           type:'enum',   options:['sell','receive'],              def:'sell', level:'entity',        gov:'entity',   help:'SELL — inbound messages are priced from your catalogue where the item matches. RECEIVE — they are not: a catalogue price is what you SELL at, and pricing goods coming IN off it puts a figure on the record nobody agreed.' },
  { key:'self_copy_pref',    label:'Self-chit copy',        type:'enum',   options:['both','sent','received'],      def:'both', level:'entity',        gov:'entity',   help:'A chit to yourself: keep both copies, only the Order (sent), or only the Task (received).' },
  { key:'chit_expiry_days',  label:'Chit expiry (days)',    type:'number', def:0,  level:'work-pattern', gov:'chosen',   help:'0 = no expiry. Auto-closes a chit after N days. Tighten-only, per work pattern.' },
  { key:'retention_days',    label:'Retention (days)',      type:'number', def:0,  level:'entity',        gov:'chosen',   help:'0 = keep. Per-copy retention; governed auto-purge is destructive → human-gated.' },
  { key:'dispute_scope',     label:'Dispute messages',      type:'enum',   options:['per-party','shared'],          def:'per-party', level:'platform', gov:'bound', help:'Per-party confidential scoping is the USP — platform-bound, cannot be relaxed.' },
];
var _POL = { flags:null, busy:false, err:null, migrated:true };
function _polVal(def){ var o=_POL.flags||{}; return (o[def.key]!==undefined)?o[def.key]:def.def; }
function _polLocked(gov){ return gov==='bound'||gov==='protected'||gov==='inherited'; }
/* ⚠️ THE WRITE IS AWAITED AND ITS ANSWER IS SHOWN. The old version toasted "set ✓" the instant you changed a
   dropdown, whatever happened afterwards — which is the exact habit that let a dead setting look alive for months.
   The card repaints from what the SERVER returns, so what is on screen is what is stored. */
async function setPolFlag(key, v){
  var def=POLICY_FLAGS.filter(function(d){return d.key===key;})[0];
  if(def&&def.type==='number') v=(v===''?0:Number(v));
  _POL.busy=true; _POL.err=null; paintPolicy();
  try{
    var body={}; body[key]=v;
    var r=await api('policySet',{body:body});
    _POL.flags=(r&&r.flags)||_POL.flags;
    toast((def?def.label:'Flag')+' saved');
  }catch(e){
    _POL.err=(e&&e.message)||'Could not save that setting.';
    if(/not migrated|b130|503/i.test(_POL.err)) _POL.migrated=false;
  }
  _POL.busy=false; paintPolicy();
}
async function loadPolicy(){
  _POL.busy=true; _POL.err=null; paintPolicy();
  try{ var r=await api('policyGet'); _POL.flags=(r&&r.flags)||{}; _POL.migrated=!(_POL.flags._migrated===false); }
  catch(e){ _POL.err=(e&&e.message)||'Could not read your policy flags.'; }
  _POL.busy=false; paintPolicy();
}
function paintPolicy(){ var h=document.getElementById('polflags'); if(h) h.innerHTML=policyFlagsInner(); }
function _polControl(def){ var v=_polVal(def);
  if(_polLocked(def.gov)) return '<span style="font-weight:700;font-size:12.5px">'+esc(String(v))+'</span> <span style="font-size:10px" title="locked / inherited — cannot change here">🔒</span>';
  var dis=_POL.busy?' disabled':'';
  if(def.type==='enum') return '<select'+dis+' data-testid="pol-'+esc(def.key)+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px">'+def.options.map(function(o){ return '<option'+(String(v)===String(o)?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select>';
  if(def.type==='number') return '<input type="number"'+dis+' data-testid="pol-'+esc(def.key)+'" value="'+esc(String(v))+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="width:90px;padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px">';
  return '<input'+dis+' value="'+esc(String(v))+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px">';
}

/* ---- CHANNELS — the inbound on-ramps. Which number / address reaches THIS entity's intake inbox (b123).
 *
 * Athi, 2026-08-09: *"is there a new panel in the front end as Channels, underneath we can specify whatsapp,
 * email and so on?"*
 *
 * The capture pipeline has been complete except for this: a message arrives on a public webhook carrying nothing
 * but a destination number, and the server has to know whose inbox that is. It may not read it off the payload —
 * that would let anyone post an obligation into anyone's intake — so it reads it here.
 *
 * ⚠️ TWO FACTS, SHOWN SEPARATELY, BECAUSE ONLY THE PAIR RECEIVES ANYTHING.
 *   · PROVIDER CONFIGURED — the server really holds the secret for that channel (read from the environment, never
 *     from anything typed on this screen).
 *   · BOUND — this entity has claimed a number / address.
 * A panel that collapsed those into one green tick would tell an owner "WhatsApp: connected" when no account
 * exists, and their customer's message would vanish while the screen insisted all was well. So each is stated,
 * and the row says plainly which of the two is missing.
 */
var _CH = { data: null, busy: false, err: null, adding: null };

function channelsCard(){
  return '<div style="'+_CARD+';margin-top:10px" id="ch_card">'+channelsInner()+'</div>';
}
function channelsInner(){
  var head = '<div class="sec" style="margin:0 0 4px">📡 Channels '
    + '<span style="font-size:10px;font-family:\'Space Mono\';background:#e7f3ea;color:#2e6b3f;border-radius:5px;padding:1px 6px">inbound · live</span></div>'
    + '<div style="font-size:11px;color:var(--grey);line-height:1.5;margin-bottom:8px">Where messages come in from. Bind the number or address a customer writes to, and anything sent there lands in <b>📨 Intake</b> — raw, for you to confirm into a chit. Nothing here can send on your behalf.</div>';
  if(_CH.busy && !_CH.data) return head+'<div class="loadwrap" style="justify-content:flex-start;padding:6px 0"><span class="spin"></span> reading your channels…</div>';
  /* ⚠️ A MISSING ENDPOINT IS NOT A BROKEN SCREEN, and must not be reported as one. The API deploys separately from
     this page, so a web release can land first — "Could not read your channels" would send someone hunting for a
     fault in their own account. Name the actual state: the server has not shipped this yet. */
  if(_CH.notDeployed) return head+'<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:12px;color:#6b5a36">The channels API is not on this server yet (the panel shipped ahead of it). Nothing is wrong with your account — deploy the API and reload.</div>';
  if(_CH.err) return head+'<div style="background:#fbeceb;border:1px solid #f0c9c6;border-radius:9px;padding:9px 11px;font-size:12px;color:#b4453f">'+esc(_CH.err)+'</div>';
  if(!_CH.data) return head+'<div style="font-size:12px;color:var(--grey)">Not loaded.</div>';
  /* The route answers 200 with a note when the table is not there — say which it is, because "no channels" and
     "the store does not exist" look identical on screen and mean entirely different things. */
  if(_CH.data.note) return head+'<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:12px;color:#6b5a36">The channel map is not migrated on this environment ('+esc(_CH.data.note)+'). The panel is here; the table is not.</div>';
  return head + (_CH.data.channels||[]).map(_chRow).join('');
}
function _chRow(c){
  var bound=(c.bindings||[]).length;
  /* ⚠️ RECEIVING requires BOTH. Anything else is a state worth naming, not a colour to average out. */
  /* ⚠️ RECEIVING NEEDS A VERIFIED BINDING, not just any binding (b124). A claim is not a permission: until the
     platform confirms the number is yours, it resolves to nothing and messages sent there reach nobody. Counting a
     declared claim as "receiving" would be the panel telling the exact lie the migration exists to stop. */
  var verified=(c.bindings||[]).filter(function(b){ return b.status==='verified'; }).length;
  var live = c.provider_configured && verified;
  var pill = live ? ['#2e6b3f','#e7f3ea','receiving']
           : (bound && !verified) ? ['#8a5a1e','#FBF6E9','claimed — awaiting confirmation']
           : (!c.provider_configured && bound) ? ['#8a5a1e','#FBF6E9','waiting on a provider account']
           : (c.provider_configured && !bound) ? ['#8a5a1e','#FBF6E9','configured — nothing bound yet']
           : ['#6a707a','#eef1f5','not set up'];
  return '<div style="padding:10px 0;border-bottom:1px solid var(--line)" data-testid="ch-row-'+esc(c.key)+'">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<span style="font-weight:600;font-size:12.5px">'+esc(c.name)+'</span>'
    + '<span style="font-size:9.5px;font-weight:800;color:'+pill[0]+';background:'+pill[1]+';border-radius:5px;padding:1px 7px" data-testid="ch-status-'+esc(c.key)+'">'+pill[2]+'</span>'
    + '<span style="margin-left:auto;font-size:11px;color:var(--blue);cursor:pointer;font-weight:600" data-testid="ch-add-'+esc(c.key)+'" onclick="chToggleAdd(\''+esc(c.key)+'\')">'+(_CH.adding===c.key?'cancel':'+ bind')+'</span>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:2px">'+esc(c.hint)+'</div>'
    /* ⚠️ REPLIES ARE A SEPARATE CREDENTIAL, so a separate line. Receiving and sending are not one switch: the app
       secret verifies inbound, WHATSAPP_TOKEN sends. Saying "connected" once would promise replies we cannot make.
       Only shown where the channel actually has a return leg. */
    + (c.key==='whatsapp' ? '<div style="font-size:11px;margin-top:3px;color:'+(c.outbound_configured?'#2e6b3f':'var(--grey)')+'">'
        + (c.outbound_configured
            ? '↩ replies on — status changes go back to the customer, within their 24-hour window'
            : '↩ replies off — needs WHATSAPP_TOKEN. Messages still arrive; nothing goes back.')
        + '</div>' : '')
    + (c.bindings||[]).map(function(b){
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px">'
          + '<span style="font-family:ui-monospace,Menlo,monospace">'+esc(b.address)+'</span>'
          + (b.label?'<span style="color:var(--grey)">'+esc(b.label)+'</span>':'')
          /* declared vs verified — asserted is not confirmed, and the difference is visible. */
          /* declared vs verified — and what DECLARED actually costs you, said in the row rather than in a footnote:
             a claim that has not been confirmed receives nothing at all. */
          + '<span style="font-size:9.5px;font-weight:800;color:'+(b.status==='verified'?'#2e6b3f':'#8a5a1e')+';background:'+(b.status==='verified'?'#e7f3ea':'#FBF6E9')+';border-radius:5px;padding:1px 6px" title="'+(b.status==='verified'?'confirmed by the platform — messages sent here reach you':'not confirmed yet — messages sent to this number reach nobody')+'">'+esc(b.status==='verified'?'verified'+(b.verified_via?' · '+b.verified_via:''):'declared — not receiving yet')+'</span>'
          + '<span style="margin-left:auto;cursor:pointer;color:#9aa3a7" title="Unbind" data-testid="ch-del" onclick="chUnbind(\''+esc(b.id)+'\')">✕</span></div>'
          /**
           * ⚠️ HANDS-FREE, PER LINE (b131). Athi: *"no one will sit and create a chit from whatsapp, it has to be
           * automatic without anyone's presence."*
           *
           * ⚠️ THE SWITCH IS NOT THE PERMISSION, and the row says so: on an unverified line it reads "waiting on
           * verification" rather than "on", because a binding that receives nothing cannot raise anything either.
           * Two independent conditions, and a toggle that claimed otherwise would be the lie.
           */
          + (b.auto_raise===undefined ? '' :
             '<label style="display:flex;align-items:center;gap:6px;margin:5px 0 0 10px;font-size:11.5px;color:var(--grey);cursor:pointer">'
             + '<input type="checkbox" data-testid="ch-autoraise" '+(b.auto_raise?'checked':'')+' onchange="chSetAutoRaise(\''+esc(b.id)+'\',this.checked)">'
             + '<span>Raise messages on this line <b>automatically</b>'
             + (b.auto_raise && b.status!=='verified' ? ' <span style="color:#8a5a1e;font-weight:700">— waiting on verification</span>' : '')
             + '<br><span style="font-size:10.5px">A chit appears in your Task list with nobody present. It is still an <b>inquiry</b> — a record, not an obligation — and anything the co-assist cannot read stays here in Intake.</span></span></label>')
          /* ⚠️ TEMPLATES ARE PER-NUMBER, so they hang off the BINDING and not the channel. Meta approves for one
             WhatsApp account; another business's approval says nothing about this one. */
          + (c.key==='whatsapp' ? (c.templates||[]).map(function(t){
              var state=((b.templates||{})[t.name])||'none';
              var col=state==='approved'?['#2e6b3f','#e7f3ea']:state==='pending'?['#8a5a1e','#FBF6E9']:['#6a707a','#eef1f5'];
              return '<div style="margin:5px 0 0 10px;padding:7px 9px;border-left:2px solid var(--line);font-size:11.5px">'
                + '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-family:ui-monospace,Menlo,monospace">'+esc(t.name)+'</span>'
                + '<span style="font-size:9.5px;font-weight:800;color:'+col[0]+';background:'+col[1]+';border-radius:5px;padding:1px 6px">'+esc(state==='none'?'not approved':state)+'</span>'
                + '<span style="color:var(--grey)">'+esc(t.category)+' · '+esc(t.language)+'</span>'
                + '<span style="margin-left:auto;color:var(--blue);cursor:pointer;font-weight:600" data-testid="ch-tpl-toggle" onclick="chSetTemplate(\''+esc(b.id)+'\',\''+esc(t.name)+'\',\''+(state==='approved'?'pending':'approved')+'\')">'
                + (state==='approved'?'mark not approved':'mark approved')+'</span></div>'
                /* Show the submission text VERBATIM. Describing it would guarantee a mismatch with what Meta
                   approved, and a template whose text differs from the approved one is simply rejected. */
                + '<div style="margin-top:4px;color:var(--grey)">Submit this to Meta word for word:</div>'
                + '<div style="margin-top:2px;padding:5px 7px;background:var(--paper);border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;white-space:pre-wrap">'+esc(t.body)+'</div>'
                + (state!=='approved' ? '<div style="margin-top:3px;color:#8a5a1e">Until Meta approves this, nothing can be sent more than 24 hours after the customer last wrote.</div>' : '')
                + '</div>'; }).join('') : '')
          ; }).join('')
    + (_CH.adding===c.key
        ? '<div style="display:flex;gap:6px;margin-top:8px"><input class="inp" id="ch_addr" placeholder="'+esc(c.placeholder)+'" data-testid="ch-addr" style="flex:1">'
          + '<input class="inp" id="ch_label" placeholder="label (optional)" data-testid="ch-label" style="max-width:140px">'
          + '<button class="composebtn" data-testid="ch-save" onclick="chBind(\''+esc(c.key)+'\')">Bind</button></div>'
          + '<div style="font-size:10.5px;color:var(--grey);margin-top:4px">'+esc(c.address_label)+' — the address your customers write TO, not theirs. It is a <b>claim</b>: it starts inert and receives nothing until the platform confirms the number is yours.</div>'
        : '')
    + '</div>';
}
function chPaint(){ var h=document.getElementById('ch_card'); if(h) h.innerHTML=channelsInner(); }
async function loadChannels(){
  _CH.busy=true; _CH.err=null; _CH.notDeployed=false; chPaint();
  try{ _CH.data=await api('channelsList'); }
  catch(e){
    var m=(e&&e.message)||'';
    if(/does not exist|not found|404/i.test(m)) _CH.notDeployed=true;
    else _CH.err=m||'Could not read your channels.';
  }
  _CH.busy=false; chPaint();
}
function chToggleAdd(k){ _CH.adding=(_CH.adding===k)?null:k; chPaint(); }
async function chBind(channel){
  var addr=val('ch_addr'), label=val('ch_label');
  if(!String(addr||'').trim()){ toast('Enter the number or address first.', true); return; }
  try{
    await api('channelBind',{body:{channel:channel, address:addr, label:label}});
    _CH.adding=null; await loadChannels(); toast('Channel bound ✓');
  }catch(e){ toast((e&&e.message)||'Could not bind that.', true); }
}
/* ⚠️ CONFIRMED WHEN TURNING IT ON, not when turning it off. Switching it on changes what happens while nobody is
   watching, which is exactly the kind of change that should be read once before it takes effect. Switching it off
   only ever means "back to a person pressing Raise" — nothing to warn about. Repaints from the server either way. */
async function chSetAutoRaise(id, on){
  if(on && !confirm('Raise messages on this line automatically?\n\nA chit will appear in your Task list without anyone present. It is an inquiry — a record, not an obligation — and it still says the sender is unverified.\n\nAnything the co-assist cannot read stays in Intake for you.')){ await loadChannels(); return; }
  try{ await api('channelAutoRaise',{params:{id:id}, body:{on:!!on}}); await loadChannels(); }
  catch(e){ toast((e&&e.message)||'Could not change that.', true); await loadChannels(); }
}
async function chSetTemplate(id, name, state){
  try{ await api('channelTemplate',{params:{id:id}, body:{name:name, state:state}}); await loadChannels(); }
  catch(e){ toast((e&&e.message)||'Could not update the template.', true); }
}
async function chUnbind(id){
  if(!confirm('Unbind this address?\n\nMessages sent to it will stop reaching your intake inbox. Captures you have already received are untouched.')) return;
  try{ await api('channelUnbind',{params:{id:id}}); await loadChannels(); }
  catch(e){ toast((e&&e.message)||'Could not unbind that.', true); }
}

function policyFlagsCard(){ loadPolicy(); return '<div style="'+_CARD+';margin-top:10px" id="polflags">'+policyFlagsInner()+'</div>'; }
function policyFlagsInner(){
  var rows=POLICY_FLAGS.map(function(def){ return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)">'
    +'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-weight:600;font-size:12.5px">'+esc(def.label)+'</span>'+govKlass(def.gov)+'<span style="font-size:9px;font-family:\'Space Mono\';background:#eef1f5;color:#6a707a;border-radius:5px;padding:1px 6px">'+esc(def.level)+'</span></div>'
    +'<div style="font-size:11px;color:var(--grey);margin-top:2px;line-height:1.45">'+esc(def.help)+'</div></div>'
    +'<div style="flex:none;text-align:right;min-width:120px">'+_polControl(def)+'</div></div>'; }).join('');
  /* A setting that cannot be stored must SAY so rather than accept a change it will lose — that is the whole
     failure this card is being rebuilt out of. */
  var warn = !_POL.migrated ? '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:11.5px;color:#6b5a36;margin-bottom:7px">Policy flags are not migrated on this environment (b130). The card is here; the column is not — changes will not save.</div>' : '';
  var err = _POL.err ? '<div style="color:#b4453f;font-size:11.5px;margin-top:6px">'+esc(_POL.err)+'</div>' : '';
  return '<div class="sec" style="margin:0 0 4px">🚩 Policy flags <span style="font-size:10px;font-family:\'Space Mono\';background:#e7f3ea;color:#2e6b3f;border-radius:5px;padding:1px 6px">saved to your entity</span></div>'
    +'<div style="font-size:11px;color:var(--grey);line-height:1.5;margin-bottom:6px">The per-entity toggles the <b>7-layer block above</b> doesn\'t yet carry — same governance grammar (<b>class</b> + <b>level</b>): 🔒 platform-bound you can\'t relax; <b>tighten-only</b> you can make stricter; <b>entity</b> you set freely.</div>'
    +warn+rows+err
    +'<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:8px">Stored on the entity, not on this device. <b>Enforced today:</b> self-chit copy, and which side of the trade you are on (inbound pricing). Expiry and retention are declared, not yet enforced.</div>';
}
function autoAssignCard(s, daOpts){ const m=s.auto_assign_mode||'off';
  return `<div style="${_CARD};margin-top:10px"><div class="sec" style="margin:0 0 6px">🧭 Auto-assign on receipt <span style="font-size:10px;font-family:'Space Mono';background:#e7f3ea;color:#2e6b3f;border-radius:5px;padding:1px 6px">active</span></div>
    <label class="fl">Mode</label><select class="inp" id="st_aam">
      <option value="off"${m==='off'?' selected':''}>Off — received chits wait in the pool</option>
      <option value="default_assignee"${m==='default_assignee'?' selected':''}>Default assignee — all to one person</option>
      <option value="least_loaded"${m==='least_loaded'?' selected':''}>Least-loaded — balance across the team</option>
    </select>
    <label class="fl">Default / overflow assignee</label><select class="inp" id="st_ada">${daOpts}</select>
    <div style="font-size:11px;color:var(--grey);margin-top:6px;line-height:1.55">Only <b>Act / Manager</b> co-assists can be assigned. In <b>least-loaded</b>, ties break to whoever went longest without a new task; when everyone is at capacity it overflows to the default assignee. Anyone <b>on leave</b> routes to their delegate.</div>
    <div class="err" id="st_aerr"></div><button class="composebtn" style="margin-top:9px" onclick="saveAutoAssign()">Save auto-assign</button></div>`;
}
async function saveAutoAssign(){ const x=document.getElementById("st_aerr"); if(x)x.textContent="";
  const mode=val("st_aam"), da=val("st_ada");
  if(mode==='default_assignee' && !da){ if(x)x.textContent="Pick a default assignee for this mode."; return; }
  try{ await api("saveSettings",{body:{auto_assign_mode:mode, default_assignee_actor_id:da||null}}); toast("Auto-assign saved ✓"); }catch(e){ if(x)x.textContent=e.message; } }

/* ---- ASSISTANT — knowledge base: the help desk publishes answers to its own catalogue -> served live ----
   Queries are handled the hard way (chits in GOV-01-Help's Task inbox: message + close). This screen is the
   one new atom: Publish-to-catalogue. loadGaps() name kept (renderApp dispatch) — it now loads the KB screen. */
function assistReviewScreen(){ return scr("🧠 Assistant — knowledge base","kbbody","assistreview"); }
var _kbItems=[], _kbEditId='';
async function loadGaps(){ const h=document.getElementById("kbbody"); if(!h)return;
  const me=(typeof SESSION!=='undefined')?SESSION:{}; const isHelp=(me.name==='GOV-01-Help'||me.isHelpdesk);
  const form = isHelp
    ? '<div style="'+_CARD+'"><div class="sec" id="kb_formhd" style="margin:0 0 6px">Publish an answer</div>'
      +'<label class="fl">Question</label><input class="inp" id="kb_q" data-testid="kb-question" placeholder="e.g. How do I export to Excel?">'
      +'<label class="fl">Answer</label><textarea class="inp" id="kb_a" data-testid="kb-answer" rows="4" placeholder="The answer the assistant should give…" style="width:100%;resize:vertical"></textarea>'
      +'<label class="fl">Context <span style="color:var(--grey);font-size:11px">— screens (comma), or * for everywhere</span></label><input class="inp" id="kb_c" data-testid="kb-context" placeholder="e.g. task, order  (or *)" value="*">'
      +'<div class="err" id="kb_err"></div><div style="display:flex;gap:7px;margin-top:9px"><button class="composebtn" id="kb_pub" data-testid="kb-publish" onclick="publishAnswer()">📣 Publish to catalogue</button><button class="composebtn" data-testid="kb-new" style="background:#fff" onclick="kbNew()">＋ New / clear</button></div>'
      +'<div style="font-size:11px;color:var(--grey);margin-top:6px">Add a new answer, or press <b>Edit</b> on one below to refine it. Served to the assistant instantly (catalogue → projection).</div></div>'
    : '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:10px;padding:11px 13px;font-size:12.5px;color:#6b5a36;margin-bottom:11px">This is the help-desk knowledge base. Queries arrive as chits in <b>GOV-01-Help</b>\'s Task inbox — operate as GOV-01-Help to answer, close, and publish here.</div>';
  h.innerHTML=form+'<div style="font-size:12px;color:var(--grey);margin:12px 0 6px">Published answers (<span id="kb_n">…</span>)</div><div id="kb_list"><div class="loadwrap"><span class="spin"></span> loading…</div></div>';
  if(window.CBOffline)CBOffline.autodraft(h,'kb.form');   // draft the question/answer/context you're writing
  try{ _kbItems=(await api("assistQuestions"))||[]; const n=document.getElementById("kb_n"); if(n)n.textContent=_kbItems.length;
    const L=document.getElementById("kb_list"); if(L) L.innerHTML = _kbItems.length ? _kbItems.map(function(e){
      const eb = isHelp ? '<button class="composebtn" style="padding:2px 9px;font-size:11px;flex:none" onclick="kbEdit(\''+esc(e.id)+'\')">Edit</button>' : '';
      return '<div style="'+_CARD+';padding:9px 11px"><div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px">'+esc(e.q)+'</div><div style="font-size:11.5px;color:var(--grey);margin-top:2px">'+esc(e.a)+'</div><div style="font-size:10.5px;color:#9aa3a7;margin-top:3px">'+esc(Array.isArray(e.context)?e.context.join(', '):'')+'</div></div>'+eb+'</div></div>'; }).join('') : '<div style="color:var(--grey);font-size:12px">None yet.</div>';
  }catch(e){ const L=document.getElementById("kb_list"); if(L)L.innerHTML=scrErr(e); } }
function kbEdit(id){ const it=_kbItems.find(function(x){return x.id===id;}); if(!it)return; _kbEditId=id;
  const q=document.getElementById("kb_q"),a=document.getElementById("kb_a"),c=document.getElementById("kb_c"),hd=document.getElementById("kb_formhd"),pb=document.getElementById("kb_pub");
  if(q)q.value=it.q||''; if(a)a.value=it.a||''; if(c)c.value=(Array.isArray(it.context)?it.context.join(', '):'*'); if(hd)hd.textContent='Edit answer'; if(pb)pb.textContent='💾 Update';
  if(q&&q.scrollIntoView)q.scrollIntoView({behavior:'smooth',block:'center'}); }
function kbNew(){ if(window.CBOffline)CBOffline.clearDraft('kb.form'); _kbEditId=''; const q=document.getElementById("kb_q"),a=document.getElementById("kb_a"),c=document.getElementById("kb_c"),hd=document.getElementById("kb_formhd"),pb=document.getElementById("kb_pub"),x=document.getElementById("kb_err");
  if(q)q.value=''; if(a)a.value=''; if(c)c.value='*'; if(hd)hd.textContent='Publish an answer'; if(pb)pb.textContent='📣 Publish to catalogue'; if(x)x.textContent=''; }
async function publishAnswer(){ const x=document.getElementById("kb_err"); if(x)x.textContent="";
  const q=val("kb_q"), a=val("kb_a"); const c=(val("kb_c")||"").split(',').map(function(s){return s.trim();}).filter(Boolean);
  if(!q||!a){ if(x)x.textContent="Question and answer are both required."; return; }
  try{ await api("assistPublish",{body:{question:q, answer:a, context:c, qa_id:_kbEditId||undefined}}); toast(_kbEditId?"Updated ✓ — live":"Published ✓ — live in the assistant"); kbNew(); loadGaps(); }
  catch(e){ if(x)x.textContent=(e&&e.message)||"Could not publish"; } }
