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
  /* ⭐ THE SERVER'S MEASUREMENT (backlog 29). MIS was the THIRD implementation of open/overdue/ageing/unread;
     lib/measure.js already served the folder pane and the counterparty scorecard. This makes it three consumers
     of one definition rather than two definitions. ⚠️ Above all it brings OVERDUE, which MIS simply did not have
     — the screen titled "What is stuck?" did not know what late meant. */
  misMetrics: {m:'GET', p:'/api/folders/mis', ok:'y'},
}); }
// ── TRADE DOCUMENTS VAULT — the recurring inputs a business provides ONCE that pre-fill every authority form. Grouped;
// matches the backend whitelist (lib/profile.js VAULT_SCHEMA). Gather here → forms are ~70% pre-filled thereafter. ──
/* ⚠️ INCOTERMS® 2020 — THE ELEVEN RULES, IN THE ICC'S OWN TWO GROUPS. This was a free-text box with an "e.g. CIF"
   placeholder, in the one field a customs form quotes verbatim; free text there guarantees CIF / c.i.f. / "CIF
   Chennai" all meaning the same thing and none of them matching. The split is not cosmetic: FAS/FOB/CFR/CIF are
   defined ONLY for sea and inland waterway, so a business shipping by air that picks FOB has written a term that
   does not apply to its shipment. Grouping them the way the ICC does makes that visible at the moment of choosing.
   ⚠️ Adopted, not invented — this list is the standard's, and it is versioned (2020). It is the same set the
   commerce layer treats as source-entities; when that lands, this list is what it must agree with. */
var INCOTERMS=[
  ['Any mode of transport', [['EXW','EXW — Ex Works'],['FCA','FCA — Free Carrier'],['CPT','CPT — Carriage Paid To'],
    ['CIP','CIP — Carriage and Insurance Paid To'],['DAP','DAP — Delivered at Place'],
    ['DPU','DPU — Delivered at Place Unloaded'],['DDP','DDP — Delivered Duty Paid']]],
  ['Sea and inland waterway only', [['FAS','FAS — Free Alongside Ship'],['FOB','FOB — Free on Board'],
    ['CFR','CFR — Cost and Freight'],['CIF','CIF — Cost, Insurance and Freight']]]
];
/* Same grouped shape as INCOTERMS so one renderer serves both; an empty group name emits no <optgroup>.
   ⚠️ Value === label here on purpose: an authority form PRINTS the mode, so what is stored is what is printed. */
var SHIP_MODES=[['', [['Sea','Sea'],['Air','Air'],['Road','Road'],['Rail','Rail'],['Courier','Courier'],['Multimodal','Multimodal']]]];
/* ⭐⭐ THE VAULT IS REPEATABLE SECTIONS OF ROWS THE USER NAMES (Athi, 2026-08-16: *"add the name of the details and
   then the value as well, so we don't need to look at the entire world... we give option like bank, licence
   details and so on, let them add more rows if they want to"*).
   ⚠️ The fixed field list it replaces was entirely INDIAN — gstin·pan·iec·ad_code·lut·ifsc·pincode. A German
   supplier had nowhere to put a USt-IdNr, and every new country was a code change. Naming your own rows is
   universal by construction.
   ⚠️ SECTIONS REPEAT because one business has two banks — export receipts and domestic — each with its own
   name/IFSC/account set, which a single fixed "Banking" group could not hold at all. */
var VAULT_SECTION_TYPES = { identity:'🏢 Business identity', signatory:'✍️ Authorised signatory', bank:'🏦 Bank',
  licence:'🪪 Licence & registration', logistics:'🚢 Logistics defaults', other:'📋 Other details' };
/* SUGGESTED names per section — [label, tag]. ⚠️ SUGGESTIONS, NEVER RESTRICTIONS: typing anything else is
   accepted and stored as-is. Picking a suggestion sets the row's TAG, which is what lets a form pre-fill find it
   and what lets the verify layer check it. A row with no tag is a perfectly good row that simply cannot do those
   two things. This list starts at what we already had and grows when a real trade needs a name — the alternative
   was encoding every jurisdiction's registrations up front, which never converges. */
var VAULT_SUGGEST = {
  identity:  [['Legal name','legal_name'],['Trade / brand name','trade_name'],['Address','address'],['City','city'],['State','state'],['PIN / ZIP','pincode'],['Country','country'],['Email','email'],['Phone','phone']],
  signatory: [['Name','name'],['Designation','designation']],
  bank:      [['Bank name','bank_name'],['Account no.','account_no'],['IFSC code','ifsc'],['IBAN','iban'],['SWIFT / BIC','swift'],['AD branch','ad_branch'],['Branch','branch']],
  licence:   [['GSTIN','gstin'],['PAN','pan'],['IEC','iec'],['LUT','lut'],['AD code','ad_code'],['LEI','lei'],['VAT number','vat'],['EIN','ein'],['CIN','cin']],
  logistics: [['Port of loading','port_loading'],['Preferred Incoterm','incoterm'],['Mode','mode']],
  other:     [],
};
/* Hints only where the format cannot be guessed, keyed by TAG rather than position — a row keeps its hint
   wherever the user puts it. ⚠️ These are India-shaped on purpose (GSTIN/PAN/IFSC) but they are now attached to
   OPTIONAL tags, so a business that never uses them never sees them. */
var VAULT_HINT = { gstin:'15 characters', pan:'10 characters', ifsc:'11 characters', swift:'8 or 11 characters',
  iban:'up to 34 characters', lei:'20 characters', iec:'Import-Export Code', ad_code:'bank AD code',
  lut:'export LUT no.', port_loading:'e.g. Nhava Sheva', legal_name:'as registered', designation:'e.g. Director' };
/* ⚠️ A CLOSED SET SURVIVES INSIDE THE FREE-FORM MODEL, and the tag is what carries it: a row tagged `incoterm`
   renders the eleven ICC rules, one tagged `mode` renders the transport modes. Free-naming did not cost us the
   controlled vocabulary where a controlled vocabulary is right — it just stopped being mandatory everywhere. */
var VAULT_ENUM = { incoterm:INCOTERMS, mode:SHIP_MODES };
function vaultCardHTML(vault, encrypted){
  vault=vault||{};
  // F1 — honest at-rest signal. Encrypted (AES-256-GCM, key never in DB) → safe for real data; not configured → dummy only.
  var encBanner = encrypted
    ? '<div style="font-size:var(--fs-1);color:var(--ok-2);background:var(--ok-tint);border:1px solid #bfe3cb;border-radius:9px;padding:7px 10px;margin:6px 0 2px">🔒 <b>' + tx('Encrypted at rest') + '</b> — stored ciphertext-only (a database dump can\'t read it). Safe for real banking &amp; tax details.</div>'
    : '<div style="font-size:var(--fs-1);color:var(--warn-2);background:var(--warn-tint);border:1px solid #f0dcae;border-radius:9px;padding:7px 10px;margin:6px 0 2px">⚠ <b>' + tx('Encryption not configured') + '</b> — the vault won\'t save until the platform sets its encryption key. Use <b>dummy data only</b> for now.</div>';
  var secs=(UI._vault&&UI._vault.sections)||[];
  var body=secs.length ? secs.map(vaultSectionHTML).join('')
    : '<div style="color:var(--grey);font-size:var(--fs-2);padding:9px 0">Nothing here yet. Add a section below and name the details you actually have — anything we don’t recognise is still saved.</div>';
  var addOpts=Object.keys(VAULT_SECTION_TYPES).map(function(t){ return '<option value="'+t+'">'+esc(VAULT_SECTION_TYPES[t])+'</option>'; }).join('');
  return '<div style="'+_CARD+';margin-top:10px"><div class="sec" style="margin:0">🗂 Trade documents vault <span style="font-size:var(--fs-1);font-weight:600;color:var(--grey)">— fill once · pre-fills every form</span></div>'
    +'<div style="font-size:var(--fs-1);color:var(--grey);margin:3px 0 2px;line-height:1.5">These recurring details auto-fill your Commercial Invoice, Packing List and other authority forms. At form time you\'ll only be asked the shipment-specifics (invoice no, dates, ports). <b>' + tx('Name each detail the way you know it') + '</b> — the suggestions are a shortcut, never a limit.</div>'
    +encBanner
    +body
    +'<div style="display:flex;gap:7px;align-items:center;margin-top:13px;flex-wrap:wrap">'
      +'<select class="inp" id="v_addtype" style="max-width:210px;margin:0">'+addOpts+'</select>'
      +'<button class="composebtn ghost" data-testid="vault-add-section" onclick="vaultAddSection()">+ add section</button></div>'
    +'<div class="err" id="vault_err" style="margin-top:8px"></div>'
    +'<button class="composebtn" style="margin-top:11px" data-testid="vault-save" onclick="saveVaultUI()">' + tx('Save vault') + '</button></div>';
}
/* One section — its type, an optional label that tells two of the same kind apart, and its rows. */
function vaultSectionHTML(sec, i){
  var rows=(sec.rows||[]).map(function(r,j){ return vaultRowHTML(r,i,j,sec.type); }).join('');
  return '<div style="border:1px solid var(--line);border-radius:11px;padding:11px 12px;margin-top:11px;background:var(--paper);color:var(--on-bg)">'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'
      +'<span style="font-size:var(--fs-2);font-weight:700;color:var(--ink)">'+esc(VAULT_SECTION_TYPES[sec.type]||sec.type)+'</span>'
      /* ⚠️ THE LABEL IS WHAT MAKES REPEATS USABLE. Two sections both reading "Bank" are indistinguishable at a
         glance and unusable at form time — "which account do I invoice against?" has no answer. */
      +'<input class="inp" style="flex:1;min-width:120px;max-width:230px;margin:0;font-size:var(--fs-2)" placeholder="label it — e.g. Export receipts" value="'+esc(sec.label||'')+'" oninput="vaultSetSection('+i+',this.value)">'
      +'<button type="button" title="Remove this section" onclick="vaultDelSection('+i+')" style="margin-inline-start:auto;border:1px solid var(--line);background:var(--card);color:var(--disp);border-radius:8px;min-width:28px;min-height:28px;cursor:pointer">×</button>'
    +'</div>'
    +rows
    +'<button class="composebtn ghost" style="margin-top:8px" onclick="vaultAddRow('+i+')">+ add detail</button></div>';
}
/* One row: the name the USER gives it, and the value. The tag rides along invisibly when the name is one we know. */
function vaultRowHTML(r,i,j,type){
  var tag=r.tag||'', hint=VAULT_HINT[tag]||'', enums=VAULT_ENUM[tag];
  var val;
  if (enums) {
    /* ⚠️ Blank stays FIRST and selectable — these are defaults, not answers. An unrecognised stored value is kept
       as its own option and MARKED, never silently dropped: free text saved before this was a list must survive. */
    var known=false;
    var opts=enums.map(function(g){
      var o=g[1].map(function(x){ if(x[0]===r.value) known=true;
        return '<option value="'+esc(x[0])+'"'+(x[0]===r.value?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('');
      return g[0]?'<optgroup label="'+esc(g[0])+'">'+o+'</optgroup>':o; }).join('');
    var keep=(r.value&&!known)?'<option value="'+esc(r.value)+'" selected>'+esc(r.value)+' — not a standard code</option>':'';
    val='<select class="inp" style="flex:1 1 120px;min-width:105px;margin:0" onchange="vaultSetRow('+i+','+j+',\'value\',this.value)">'
      +'<option value=""'+(r.value?'':' selected')+'>— none —</option>'+keep+opts+'</select>';
  } else {
    val='<input class="inp" style="flex:1 1 120px;min-width:105px;margin:0" value="'+esc(r.value||'')+'" placeholder="'+esc(hint)+'" oninput="vaultSetRow('+i+','+j+',\'value\',this.value)">';
  }
  return '<div style="display:flex;gap:7px;align-items:center;margin-bottom:6px;flex-wrap:wrap">'
    /* ⚠️ BOTH FIELDS FLEX, AND NEITHER HAS A FIXED BASIS. The detail pane is ~350px at its narrowest and that is
       also the phone width; a 190px fixed name column pushed the remove button onto its own line, which reads as
       a stray control belonging to nothing. Let them shrink together and the row stays one row. */
    +'<input class="inp" list="vsug_'+esc(type)+'" style="flex:1 1 130px;min-width:110px;margin:0" placeholder="detail name — e.g. IFSC code" value="'+esc(r.name||'')+'" oninput="vaultSetRow('+i+','+j+',\'name\',this.value)">'
    +val
    +'<button type="button" title="Remove this detail" onclick="vaultDelRow('+i+','+j+')" style="border:1px solid var(--line);background:var(--card);color:var(--grey);border-radius:8px;min-width:28px;min-height:28px;cursor:pointer">×</button></div>';
}
/* The suggestion lists — one <datalist> per section type, emitted once. A datalist SUGGESTS and never restricts,
   which is exactly the contract we want: type "IFSC code" and get the tag, type anything else and keep it. */
function vaultDatalists(){
  return Object.keys(VAULT_SUGGEST).map(function(t){
    return '<datalist id="vsug_'+t+'">'+VAULT_SUGGEST[t].map(function(s){ return '<option value="'+esc(s[0])+'">'; }).join('')+'</datalist>';
  }).join('');
}
function _vaultSecs(){ UI._vault=UI._vault||{sections:[]}; UI._vault.sections=UI._vault.sections||[]; return UI._vault.sections; }
function _vaultPaint(){ var h=document.getElementById('vaulthost'); if(h) h.innerHTML=vaultCardHTML(null,UI._vaultEnc)+vaultDatalists()+_capEnd(); }
function vaultAddSection(){ var s=document.getElementById('v_addtype');
  _vaultSecs().push({type:(s&&s.value)||'other',label:'',rows:[{name:'',value:''}]}); _vaultPaint(); }
function vaultDelSection(i){ _vaultSecs().splice(i,1); _vaultPaint(); }
function vaultSetSection(i,v){ var s=_vaultSecs()[i]; if(s) s.label=v; }   // no repaint — would drop focus mid-word
function vaultAddRow(i){ var s=_vaultSecs()[i]; if(s){ (s.rows=s.rows||[]).push({name:'',value:''}); _vaultPaint(); } }
function vaultDelRow(i,j){ var s=_vaultSecs()[i]; if(s&&s.rows){ s.rows.splice(j,1); _vaultPaint(); } }
/**
 * ⚠️ THE TAG IS SET FROM THE NAME, AND ONLY WHEN THE NAME MATCHES A SUGGESTION. Typing a name we know silently
 * tags the row so forms can pre-fill it and verify can check it; typing anything else clears the tag and the row
 * is stored exactly as written. The user is never told about tags and never has to care — which is the point.
 * ⚠️ NO REPAINT ON TYPING. Rebuilding the host mid-keystroke drops focus and the caret, so the model is updated
 * in place; only structural changes (add/remove) repaint. The one exception is a name that gains or loses an
 * ENUM tag, where the value control itself has to change shape.
 */
function vaultSetRow(i,j,field,v){
  var s=_vaultSecs()[i]; if(!s||!s.rows||!s.rows[j]) return;
  var r=s.rows[j];
  if(field!=='name'){ r[field]=v; return; }
  r.name=v;
  var before=r.tag||'';
  var hit=(VAULT_SUGGEST[s.type]||[]).filter(function(x){ return x[0].toLowerCase()===String(v).trim().toLowerCase(); })[0];
  r.tag=hit?hit[1]:'';
  if(!!VAULT_ENUM[before] !== !!VAULT_ENUM[r.tag]) _vaultPaint();
}
async function loadVault(){
  var host=document.getElementById('vaulthost'); if(!host) return;
  /* ⚠️ THE END MARKER IS PAINTED HERE, NOT BY profSecHTML — it is a claim that you have seen everything, so it
     must not appear beside a spinner. Appended synchronously with the content it terminates, on both paths. */
  /* ⭐ ALREADY IN HAND — /entities/me?include=vault brought it with the profile, so the vault section paints
     without a second round trip. The fetch below still runs on every other path: a direct open, a refresh after
     a save, an actor profile. See _profSeedIncluded. */
  if (UI._vaultSeeded) { UI._vaultSeeded = false; }
  else {
    try{ var p=(await api('vaultGet'))||{};
      /* The server normalises legacy group-shaped vaults to {sections} on read, so there is exactly one shape here. */
      UI._vault={sections:((p.vault||{}).sections)||[]}; UI._vaultEnc=!!p.vault_encrypted;
    }catch(e){ UI._vault={sections:[]}; UI._vaultEnc=false; }
  }
  var h2=document.getElementById('vaulthost'); if(!h2) return;   // ⚠️ re-query: a repaint may have landed mid-fetch
  h2.innerHTML=vaultCardHTML(null,UI._vaultEnc)+vaultDatalists()+_capEnd();
  if(window.CBOffline)CBOffline.autodraft(h2,'app.vault',{overwrite:true});   // restore unsaved edits over the server copy
}
async function saveVaultUI(){
  var err=document.getElementById('vault_err'); if(err)err.textContent='';
  /* ⚠️ THE MODEL IS THE TRUTH, not the DOM — every control writes straight into UI._vault as it is typed, so the
     save reads one object rather than scraping ids. That is what makes repeatable sections possible at all: there
     is no stable id to scrape when the same section can exist twice. The server drops empty rows; we send as-is. */
  var vault={sections:_vaultSecs()};
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
  { key:'trust',    name:'Trust',    q:'Who can I rely on?' },
  /* The outcome half of the plan declared in Governance → Constitution. It is a metric, so it lives here. */
  { key:'plan',     name:'Plan',     q:'What have I used?' }
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
  var bar = '<div class="misbar"><span class="misttl">' + tx('📊 MIS') + '</span>'
    + '<span class="seg">' + seg('7', '7 days') + seg('30', '30 days') + seg('all', 'All time') + '</span>'
    + '<span class="misbar-r">' + (m ? '<span class="misasof">live · ' + esc(m.asOf) + '</span>' : '')
    + '<button class="composebtn" onclick="aiRun(\'metrics-narrate\',UI._mis,{title:\'📊 Explain my metrics\'})" title="AI narrates what your numbers say">' + tx('✨ Explain') + '</button></span></div>';
  var list = '<div class="list"><div class="lh" style="padding:0">' + bar + '</div>'
    + '<div class="rows" id="mis_rail">' + rail + '</div></div>';
  var detail = '<div class="detail" id="detailpane"><div id="misbody">'
    /* ⚠️ NO INLINE SPINNER, AND A WAY OUT WHILE IT LOADS. api() already shows the centred "Reading data…" pill,
       so a second spinner in the pane is two indicators for one fetch. And on mobile the loading pane COVERS the
       rail — without this button a slow read (measured ~3.6s against Railway) strands you on a blank screen. */
    + (m ? misBandHTML(misBand(), m)
         : '<button class="dback" data-testid="cap-back" onclick="backToList()">‹ Back</button>') + '</div></div>';
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
  if (k === 'plan')     return { v: (UI._misToday==null?'·':UI._misToday), s:'of '+PLAN.chitsPerDay+' today' };
  if (k === 'trust')    return { v: m.suppliers, s: m.open_disputes ? (m.open_disputes + ' disputes') : '0 disputes', tone: m.open_disputes ? 'warn' : 'ok' };
  return { v: '·', s: '' };
}

/* Athi: *"scroll not appearing, how do i know i reached the bottom"* — so say so, rather than leaving a stopped
   page indistinguishable from a stalled one. */
function _capEnd(){ return '<div class="capend">— end —</div>'; }
function misBandHTML(k, m){
  var body = (k === 'overview') ? misOverview(m)
    : (k === 'position') ? misPosition(m)
    : (k === 'flow')     ? misFlow(m)
    : (k === 'friction') ? misFriction(m)
    : (k === 'trust')    ? misTrust(m)
    : (k === 'plan')     ? misPlan(m) : '';
  return body ? (body + _capEnd()) : '';
}
/**
 * ⚠️ THE BACK BUTTON IS PART OF THE HEADING, not an optional extra. On mobile the detail pane COVERS the rail,
 * so a section without a way back is a dead end — the same failure as the Find-a-product panel on a laptop, and
 * it reached three screens at once because they share this helper. `.dback` is the shell's mobile-only back
 * control: hidden on a laptop where the rail is still visible beside you, shown exactly when it is not.
 */
/* ⚠️ The back button is separable from the title, because Governance drops the title (the rail already names it)
   but still needs a way back on mobile. Losing it with the heading is exactly the dead-end fixed earlier. */
function _misBack(){ return '<button class="dback" data-testid="cap-back" onclick="backToList()">‹ Back</button>'; }
/**
 * ⚠️ AN ABSENT SUBTITLE TAKES NO SPACE. Passing '' used to emit an empty `<div class="ds">` carrying a 14px
 * bottom margin — a gap under the heading with nothing in it, which reads as a rendering fault rather than as
 * a screen that simply needs no strapline. Now that a subtitle is optional (the IAM one was removed because it
 * had gone stale), omitting it has to look deliberate.
 */
function _misHead(t, s){
  return _misBack() + '<div class="dh">' + esc(t) + '</div>'
    + (s ? '<div class="ds" style="margin-bottom:14px">' + esc(s) + '</div>' : '<div style="margin-bottom:11px"></div>'); }
function _misSplitBar(m){
  var tot = m.committed + m.forecast;
  if (!tot) return '<div class="misnote">No value on any chit yet.</div>';
  var cp = Math.round(m.committed / tot * 100);
  return '<div class="misplit"><span style="background:var(--blue);width:' + cp + '%;color:var(--on-accent)"></span>'
    + '<span style="background:var(--gold);width:' + (100 - cp) + '%;color:var(--on-gold)"></span></div>'
    + '<div class="miskey"><span class="k"><i class="sw" style="background:var(--blue);color:var(--on-accent)"></i> Committed ' + inr(m.committed) + '</span>'
    + '<span class="k"><i class="sw" style="background:var(--gold);color:var(--on-gold)"></i> Forecast ' + inr(m.forecast) + '</span></div>';
}
function _misStack(m){
  var t = m.chits || 1;
  /**
   * ⚠️⚠️ EVERY BACKGROUND MUST NAME ITS TEXT COLOUR, and this was the one renderer that did not. Found by
   * THEME-01 once the account was seeded: `hcdark / mis` — white on `rgb(143,190,255)` at **1.91:1**.
   *
   * ⭐ IT IS THE ONLY BAR THAT PUTS THE NUMBER INSIDE THE FILL. `_misSplitBar` and both `miskey` swatches pair
   * each background with its `--on-*` token; this one wrote the count onto the segment and let it inherit the
   * card's ink — white in every dark theme.
   *
   * ⭐⭐ AND IT FAILED IN THE HIGH-CONTRAST DARK THEME, which exists precisely for people who need contrast.
   * `--blue` is LIGHTENED in dark themes so it reads as an accent ON dark; using it as a BACKGROUND inverts
   * that relationship, and inherited white then sits on a pale blue. A token is readable in one direction
   * only — which is exactly what the paired `--on-*` tokens are for.
   *
   * ⚠️ IT COULD NOT HAVE BEEN CAUGHT ON AN EMPTY ACCOUNT: `seg()` returns '' when the count is zero, so with
   * no chits there is no segment, no text, and nothing to measure. This is the bug M3 was worth doing for.
   */
  var seg = function(n, col, on){ return n ? '<span style="background:' + col + ';color:' + on + ';width:' + (n / t * 100) + '%">' + n + '</span>' : ''; };
  return '<div class="misstack">' + seg(m.open, 'var(--blue)', 'var(--on-accent)')
    + seg(m.in_progress, 'var(--prog)', 'var(--on-warn)') + seg(m.closed, 'var(--ok)', 'var(--on-ok)') + '</div>'
    + '<div class="miskey"><span class="k"><i class="sw" style="background:var(--blue);color:var(--on-accent)"></i> ' + tx('Open') + '</span>'
    + '<span class="k"><i class="sw" style="background:var(--prog);color:var(--on-warn)"></i> ' + tx('In progress') + '</span>'
    + '<span class="k"><i class="sw" style="background:var(--ok);color:var(--on-ok)"></i> ' + tx('Closed') + '</span></div>';
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
      + '<div class="mislbl">' + tx('Committed · someone said yes') + '</div>'
      + '<div class="mishero">' + inr(m.committed) + '</div>'
      + '<div class="misnote">' + pct + '% of the book is authoritative — accepted, in progress or completed.</div>'
      + _misSplitBar(m)
    + '</div><div>'
      + '<div class="mislbl">' + tx('Forecast · nobody has committed') + '</div>'
      + '<div class="misfore">' + inr(m.forecast) + '</div>'
      + '<div class="misnote" style="margin-top:7px">Sent or received but not yet accepted. Real work — nobody has promised it.</div>'
      + (m.dead ? '<div class="miswarn">' + inr(m.dead) + ' on cancelled or rejected chits, counted in neither.</div>' : '')
    + '</div></div>'
    + '<div class="miswhy">The old screen showed <b>' + inr(m.committed + m.forecast + m.dead) + '</b> as one “deal value”, blending all three — which <b>overstates the book</b>.</div>';
}
function misFlow(m){
  return _misHead('Flow', 'What is moving through the rail, and at what rate.')
    + '<div class="mistwo"><div>'
      + '<div class="mislbl">' + tx('Chits by state') + '</div><div class="misbig">' + m.chits + '</div>' + _misStack(m)
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
/**
 * ⭐⭐ OVERDUE — the number MIS did not have (backlog 29).
 *
 * `overdue` is a POLICY, not an opinion: `overdue_days` is set in Settings and obeyed by the folder Metrics pane
 * and the counterparty scorecard, both reading lib/measure.js. MIS — the screen titled *"What is stuck?"* — never
 * mentioned it, so setting overdue to 3 days changed every other surface and left this one exactly as it was.
 *
 * ⚠️ IT SAYS THE THRESHOLD OUT LOUD. "6 overdue" is unfalsifiable on its own; "6 past 7 days" can be checked, and
 * tells the reader that the number moves when the policy moves rather than when the business does.
 *
 * ⚠️ WHEN THE MEASUREMENT IS UNAVAILABLE IT SAYS SO. It does NOT fall back to counting in the browser — a silent
 * second implementation is exactly the drift this replaced, and the fallback would be invisible precisely when
 * the two disagree.
 */
function _misOverdue(m){
  var s = m.srv;
  if (!s || !s.all) {
    return '<div class="misnote" style="margin-top:14px">⚠️ Overdue is unavailable — the server measurement could not be read. '
      + 'It is deliberately <b>not</b> as shown in the folder pane.</div>';
  }
  var n = s.all.overdue || 0, d = s.overdue_days;
  var mine = (s.received && s.received.overdue) || 0, theirs = (s.sent && s.sent.overdue) || 0;
  return '<div class="mislbl" style="margin-top:16px">Overdue · past ' + esc(String(d)) + ' day' + (d === 1 ? '' : 's') + '</div>'
    + '<div class="misstatus">'
    + (n ? '<i class="dot" style="background:var(--disp);color:var(--on-danger)"></i> <b>' + n + ' overdue</b>'
         : '<i class="dot" style="background:var(--ok);color:var(--on-ok)"></i> <b>' + tx('Nothing overdue') + '</b>')
    + '<span class="misnote" style="margin-inline-start:8px">· ' + mine + ' received · ' + theirs + ' sent</span></div>'
    + '<div class="misnote" style="margin-top:4px">The threshold is the <b onclick="navTo(\'settings\')" style="cursor:pointer;color:var(--blue)">overdue policy</b> — '
    + 'the same one the folder pane and the supplier scorecard obey, so all three move together.</div>';
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
        ? '<i class="dot" style="background:var(--disp);color:var(--on-danger)"></i> <b>' + m.open_disputes + ' open dispute' + (m.open_disputes === 1 ? '' : 's') + '</b>'
        : '<i class="dot" style="background:var(--ok);color:var(--on-ok)"></i> <b>' + tx('No open disputes') + '</b>')
      + '<span class="misnote" style="margin-inline-start:8px">· ' + m.chits + ' chits · ' + (m.open_disputes ? 'needs resolving' : 'nothing to resolve') + '</span></div>'
    + _misOverdue(m) + _misAgeing(m) + _misUnattended(m)
    + (rows
      ? '<div class="mislbl" style="margin-top:18px">' + tx('The queue · oldest first') + '</div>'
        + '<div class="misscroll"><table class="mistable"><thead><tr><th>' + tx('Waiting on') + '</th><th>' + tx('Chit') + '</th><th>' + tx('Age') + '</th><th>' + tx('Value') + '</th><th>' + tx('Whose clock') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="misnote" style="margin-top:12px">Nothing is waiting — every chit has been accepted or closed.</div>')
    /* ⭐ DESIGN RATIONALE → SPEC. Why a dispute is shown as a status rather than a number is a good decision
       and not one the reader has to agree with before using the screen. */
    + specNote('mis.disputes-as-status',
        'Disputes are a <b>status</b>, not a count: a plain <b>0</b> tile reads exactly like <b>Suppliers 2</b>, '
      + 'when one is a health signal and the other is inventory.');
}
function misTrust(m){
  var chan = m.byChannel;
  var chanTxt = Object.keys(chan).length
    ? Object.keys(chan).map(function(c){ return chan[c] + ' by ' + esc(c); }).join(' · ')
    : 'none captured — everything entered by hand';
  return _misHead('Trust', 'Who you deal with, and how the work reaches you.')
    + '<div class="mistrust">'
      + '<div><div class="mislbl">' + tx('Counterparties') + '</div><div class="misbig" style="font-size:var(--fs-5)">' + m.parties + '</div>'
        + '<div class="misnote">' + (m.partyNames.length ? esc(m.partyNames.slice(0, 3).join(' · ')) : 'no counterparties yet') + '</div></div>'
      + '<div><div class="mislbl">' + tx('Suppliers on your list') + '</div><div class="misbig" style="font-size:var(--fs-5)">' + m.suppliers + '</div>'
        + '<div class="misnote">' + m.co_assists + ' co-assist' + (m.co_assists === 1 ? '' : 's') + ' working the rail</div></div>'
      + '<div><div class="mislbl">' + tx('How work arrives') + '</div><div class="misbig" style="font-size:var(--fs-5)">' + m.captured + ' <span style="font-size:var(--fs-2);color:var(--grey)">of ' + m.chits + '</span></div>'
        + '<div class="misnote">' + chanTxt + '</div></div>'
    + '</div>'
    /* ⚠️ The band I most want and have NOT verified is computable. Say so rather than show a score I cannot stand behind. */
    + '<div class="miswhy">' + txf('⚠️ {what} — who confirms fast, who delivers short — is the most valuable thing this could report, and is {notbuilt}. Shown as plain counts, not a score.', {
        what: '<b>' + tx('Counterparty reliability') + '</b>', notbuilt: '<b>' + tx('not built') + '</b>' }) + '</div>';
}
/**
 * ⭐ USAGE AGAINST THE DECLARED PLAN. The limits come from PLAN (declared in Governance → Constitution); this band
 * only measures. One declaration, one report.
 *
 * ⚠️ IT SAYS WHAT IT CANNOT COUNT. `Networks formed` and `Data stored` have no client-side source, so they say so
 * instead of rendering `0` — which would read as "you have none" rather than "we did not look". That distinction
 * is the same one the supplier search makes between "not listed" and "can't tell", and the `—` these rows used to
 * show on the governance card is exactly the ambiguity being removed.
 */
function misPlan(m){
  var meter = function(label, used, limit, note){
    if (limit == null) return '<div class="govrow"><span class="govrow-k">'+esc(label)+'</span>'
      + '<span class="govrow-v" style="color:var(--grey)">'+esc(note||'not counted here')+'</span></div>';
    var pct = Math.min(100, Math.round((used / limit) * 100));
    var tone = pct >= 100 ? 'var(--disp)' : pct >= 80 ? 'var(--prog)' : 'var(--blue)';
    return '<div class="misplanrow"><div class="misplanhead"><span>'+esc(label)+'</span>'
      + '<span class="misplanv">'+used+' <span style="color:var(--grey);font-weight:600">of '+limit+'</span></span></div>'
      + '<div class="misplanbar"><i style="width:'+pct+'%;background:'+tone+'"></i></div></div>';
  };
  var todayStart = new Date(); todayStart.setHours(0,0,0,0);
  var chitsToday = (UI._misStamps || []).filter(function(t){ return t >= todayStart.getTime(); }).length;
  /**
   * The subscription window, when there is one. ⚠️ It says "no period recorded" rather than assuming open-ended —
   * a plan with no dates and a plan valid forever look identical on screen but are not the same claim, and only
   * one of them is true here.
   */
  var w = planWindow();
  var period = !w
    ? '<span class="govtag" style="background:var(--warn-tint);color:var(--warn-3)">no period recorded</span>'
    : w.state === 'expired'
      ? '<span class="govtag" style="background:var(--danger-tint);color:var(--disp)">expired '+w.days+'d ago</span>'
      : w.state === 'not yet started'
        ? '<span class="govtag" style="background:var(--warn-tint);color:var(--warn-3)">starts in '+w.days+'d</span>'
        : '<span class="govtag" style="background:var(--ok-tint);color:var(--disp)">active'+(w.days!=null?(' · '+w.days+'d left'):'')+'</span>';
  return _misHead('Plan', 'What you have used against the limits your plan declares.')
    + '<div class="misnote" style="margin-bottom:10px">'+period+'</div>'
    + '<div class="misnote" style="margin-bottom:12px"><b>'+esc(PLAN.tier)+'</b> plan · limits declared in '
      + '<b onclick="navTo(\'settings\');UI.setSec=\'governance\';UI.govTab=0" style="cursor:pointer;color:var(--blue)">Governance <span class=arw>→</span> Constitution <span class=arw>→</span></b></div>'
    + meter('Entities', 1, PLAN.entities)
    + meter('Chits today', chitsToday, PLAN.chitsPerDay)
    + meter('Networks formed', 0, null, 'not counted on this screen')
    + meter('Data stored', 0, null, 'not counted on this screen')
    + '<div class="miswhy">These four sat on the governance card as <b>metered</b> rows, two of them showing '
      + '<b>—</b> while this screen counted chits. Your plan sets the limit; this is what you have used.</div>';
}
function misOverview(m){
  var sec = function(name, q, inner){
    return '<div class="misov"><div class="misovh"><span class="misovn">' + esc(name) + '</span><span class="misnote">' + esc(q) + '</span></div>' + inner + '</div>';
  };
  var tot = m.committed + m.forecast, pct = tot ? Math.round(m.committed / tot * 100) : 0;
  return _misHead('Overview', '')
    + sec('Position', 'How much of the pipeline is real?',
        '<div class="mistwo"><div><div class="mishero" style="font-size:var(--fs-6)">' + inr(m.committed) + '</div>'
        + '<div class="misnote">committed · ' + pct + '% of the book</div></div><div>' + _misSplitBar(m) + '</div></div>')
    + sec('Flow', 'What is moving through the rail?',
        '<div class="mistwo"><div>' + _misStack(m) + '</div><div>' + _misSpark(m.series) + '</div></div>')
    + sec('Friction', 'Where is time being lost?',
        '<div class="misstatus">' + (m.open_disputes
          ? '<i class="dot" style="background:var(--disp);color:var(--on-danger)"></i> <b>' + m.open_disputes + ' open</b>'
          : '<i class="dot" style="background:var(--ok);color:var(--on-ok)"></i> <b>' + tx('No open disputes') + '</b>')
        + '<span style="margin-inline-start:9px">' + (m.waiting.length
            ? '<b>' + m.waiting.length + ' waiting</b> — ' + m.waitTheirs + ' on <span class="misclock theirs">' + tx('◷ Theirs') + '</span> ' + m.waitMine + ' on <span class="misclock mine">' + tx('◷ Mine') + '</span>'
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
    /* ⚠️ The window is computed BEFORE the fetch because the server has to measure the same one — see `since`
       below. A period selector on screen beside a figure measured over all time is worse than no selector. */
    const _days = misPeriod() === 'all' ? null : parseInt(misPeriod(), 10);
    const _since = _days ? new Date(Date.now() - _days * 864e5).toISOString() : undefined;
    const [inb, snt, dq, ac, sp, msgRaw, srv] = await Promise.all([
      api('inbox'), api('sent').catch(function(){ return []; }),
      api('disputeQueue').catch(function(){ return {}; }),
      api('actors').catch(function(){ return []; }), api('supList').catch(function(){ return []; }),
      api('misMsgs').catch(function(){ return []; }),
      /* ⚠️ Fails SOFT to null, not to a client-computed substitute. If the measurement is unavailable the screen
         must say the number is unavailable — quietly falling back to a second implementation is precisely the
         drift this endpoint exists to end, and it would be invisible. */
      api('misMetrics', { query: { since: _since } }).catch(function(){ return null; })
    ]);
    const seen = {}, chits = [];
    (inb || []).concat(snt || []).forEach(function(raw){
      const c = mapApiChit(raw); if (!c || seen[c.id]) return; seen[c.id] = 1;
      c._iSent = !!SESSION.entity && (c.sender || '') === SESSION.entity;
      chits.push(c);
    });

    /* ⚠️ ONE window, derived once above and reused — the client filter and the server's `since` must be the same
       boundary or the two halves of this screen describe different fortnights. */
    const days = _days;
    const cutoff = _since ? Date.parse(_since) : null;
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
    /* Kept for the Plan band, which counts against a per-DAY limit and so cannot use the period-windowed series. */
    UI._misStamps = chits.map(function(c){ return (new Date(c.created_at)).getTime(); }).filter(function(t){ return t; });
    { const _t0 = new Date(); _t0.setHours(0,0,0,0);
      UI._misToday = UI._misStamps.filter(function(t){ return t >= _t0.getTime(); }).length; }
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
      /* ⭐ THE SERVER'S MEASUREMENT (backlog 29) — the same lib/measure.js the folder pane and the counterparty
         scorecard read, so all three now agree by construction rather than by coincidence. `srv` is null when
         the call failed; every reader must handle that rather than fall back to a second implementation. */
      srv: srv,
      periodLabel: misPeriod() === 'all' ? 'all time' : ('last ' + misPeriod() + 'd'),
      asOf: CBLocale.time(Date.now()),
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
  /**
   * ⭐⭐ IAM — and the NAME is the small part. Athi asked for "Identity" to become IAM with five identity
   * classes (entity · employee · customer · supplier · IoT/AI/ERP), then said: *"do not take my words as
   * decision, think and provide a better alternate if possible."*
   *
   * ⚠️ THE FIVE-CLASS TABLE WOULD HAVE BEEN WRONG, and wrong in a way that contradicts the product. Of those
   * five, this business ADMINISTERS exactly two — itself and its co-assists (machines are co-assists; same
   * table, different actor_type). A customer self-identifies with a one-time code. A supplier is another
   * business with its own IAM. Five rows with an "Access" column implies you grant access to all five; you
   * cannot, so three would sit permanently empty and read as "not built yet" rather than "not yours to set".
   *
   * ⭐ SO IT IS STRUCTURED BY BOUNDARY — inside · at the edge · outside. That is the same sovereignty the rest
   * of the rail rests on, and it turns the asymmetry from an apology into the content.
   */
  { key:'identity',   name:'IAM',         q:'Who can act, and what they may do' },
  { key:'storefront', name:'Storefront',  q:'What customers can see' },
  /* ⚠️ NOT "Governance" — Settings has a section by that name too, and two rows with one name in two screens is
     a collision even when the content differs. This one is your RESOLVED position (Governed by · Basics · Rights ·
     Allowances · Jurisdiction); the Settings one is the 7-layer model those values descend from. */
  { key:'governance', name:'Your rights',  q:'What this entity may do' },
  { key:'vault',      name:'Documents',   q:'Fill forms once, reuse' }
];
function profSec(){ return UI.profSec || 'identity'; }
/**
 * ⚠️ REPAINT THE BODY DIRECTLY — do not rely on the post-render hook. renderApp() rewrites the pane to its
 * "loading…" placeholder and the `if(UI.nav==="profile") loadProfile()` hook fires while #profbody is not yet in
 * the document, so loadProfile's `if(!h) return` bailed and every section sat on the spinner forever. It worked on
 * FIRST entry only, because arriving at the screen triggers a second render that the section switch does not.
 */
/* ⚠️ THE OLD profSetSec LIVED HERE — it switched PANES. The rail it drove is gone (see profileScreen), so the
   pane-switching version was dead the moment the sections absorbed it, and a duplicate definition means the
   earlier one silently never runs. The surviving shim, below, opens the matching accordion instead. */

/**
 * ⚠️ THE TWO-SIDED PANEL IS THE SHAPE, AND IT IS NOT NEGOTIABLE PER SCREEN (Athi, 2026-08-16: *"it has to be
 * uniform two sided, so it nicely works in phone as well"*). I briefly made this tabs because the rail sits
 * ~75% empty on a desktop viewport — which traded a real density gain for the thing that actually matters:
 * every screen behaving the same way, and list→tap→detail→back being the mobile pattern throughout. A screen
 * that is uniform everywhere beats a screen that is optimal once. Density is fixed by the pane, not by the shape.
 */
/**
 * ⚠️⚠️ THE RAIL IS GONE, AND KEEPING IT WOULD HAVE BEEN THE VERY DUPLICATION ATHI ASKED ME TO REMOVE.
 *
 * He said the other three panels *"can come over to the first page itself"*, and I folded Storefront, Rights
 * and Documents into iamHTML as sections — while leaving the left rail still listing those same four names.
 * The screen would have offered every one of them twice, in two different interaction styles, which is worse
 * than the repetition I was sent to remove. Found by reviewing my own change rather than by anyone seeing it.
 *
 * ⭐ ONE PANE FOR EVERYONE NOW — the same shape an actor already had. loadProfile fills #profbody, and the
 * sections inside it are the navigation.
 */
function profileScreen(){ return scr('👤 Profile', 'profbody', 'profile'); }

/**
 * ⚠️ profSetSec SURVIVES AS A SHIM, because four call sites still ask for a section by name — a nav link, the
 * storefront cross-reference, and the naming-rules pointer. With the rail gone the honest translation is to
 * OPEN the matching accordion rather than to switch panes, so an old link still lands the reader on the thing
 * it promised. Deleting it would have left four dead links pointing at nothing.
 */
var _SEC_TO_ACCORDION = { identity:'ident', storefront:'governed', governance:'rights', vault:'docs' };
function profSetSec(k){
  var key = _SEC_TO_ACCORDION[k] || 'ident';
  UI._iamOpen = UI._iamOpen || {};
  UI._iamOpen[key] = true;
  UI.nav = 'profile';
  renderApp(); _capShowDetail(); loadProfile();
}

/**
 * ⚠️ ONE READ AT A TIME. The post-render hook fires loadProfile on EVERY render, and a section switch renders —
 * so with the API at ~3.6s a round trip, switching sections stacked four and five identical `me` reads and the
 * pane sat on its spinner behind all of them. The in-flight guard makes the extra renders free.
 */
let _profBusy = false;
/**
 * ⭐ SEED THE THREE SUB-LOADERS FROM THE ONE RESPONSE, and set their latches so they do not fetch again.
 *
 * ⚠⚠ EACH SHAPE IS TAKEN FROM ITS OWN LOADER, NOT GUESSED. The channels one especially: the bound addresses
 * live in `channels[].bindings[]`, NOT in `channels[]` — that array is the CATALOGUE OF TYPES (whatsapp · email
 * · sms · web) and each type carries its own bindings. Guessing it once already produced a profile that
 * rendered four type objects with no address and no status, and a test fixture built on the same guess so it
 * passed while the screen was blank. Copied from the loader, deliberately, rather than re-derived.
 *
 * ⚠️ A FAILED INCLUDE MUST NOT LATCH. The server reports a broken part as `{ error }` in place, so the
 * profile still paints without it — but leaving the latch UNSET means the section's own loader will try again
 * when it renders. Bundling must not turn a retryable gap into a permanent one.
 */
function _profSeedIncluded(e){
  var inc = e && e.included; if (!inc) return;
  var ok = function(v){ return v && !v.error; };

  if (ok(inc.readiness)) { UI._rdSum = inc.readiness.summary || null; UI._rdSumLoaded = true; }

  if (ok(inc.channels)) {
    UI._chans = Array.isArray(inc.channels.channels)
      ? inc.channels.channels.reduce(function(all, t){ return all.concat(t.bindings || []); }, [])
      : null;
    UI._chansLoaded = true;
  }

  /* ⚠️ THE VAULT IS NOT LATCHED THE SAME WAY — loadVault() paints a host element as well as fetching, so it
     still runs when the vault section opens. Seeding the DATA means it paints immediately instead of showing
     a spinner for a round trip it no longer needs. */
  if (ok(inc.vault)) {
    UI._vault = { sections: ((inc.vault.vault || {}).sections) || [] };
    UI._vaultEnc = !!inc.vault.vault_encrypted;
    UI._vaultSeeded = true;
  }
}

async function loadProfile(){ const h=document.getElementById("profbody"); if(!h)return;
  if(SESSION.role==='actor') return loadActorProfile(h);   // actors get their own profile, not the entity's
  /* ⚠️ THE SNAPSHOT IS RE-TAKEN AFTER EVERY PAINT. A baseline captured once at load goes stale the first time
     a section is collapsed, and every later edit then reads as clean. See profSnapshot. */
  if(UI._me){ h.innerHTML = profSecHTML(profSec(), UI._me); if(profSec()==='vault') loadVault(); profSnapshot(); return; }
  if(_profBusy) return;
  _profBusy = true;
  /**
   * ⭐⭐ ONE HTTP ROUND TRIP INSTEAD OF FOUR. Athi, 2026-08-21: *"why do we need a round trip, can't the js send
   * all the required information in one shot? We have built most of the stuff as lazy load, and for each lazy
   * load if we have to do a round trip, that will feel like waiting forever."*
   *
   * ⚠️⚠️ THIS SCREEN MADE FOUR SEPARATE FETCHES — /entities/me, /governance/readiness, /channels and
   * /governance/profile — because each was added by whoever needed it, in its own loader, each with its own
   * latch. Nothing was wrong with any one of them. From India to Railway that is 200–400ms EACH, so over a
   * second of network before the profile is complete, and the sections arrive one at a time in front of you.
   *
   * ⭐ THE SUB-LOADERS ARE NOT DELETED, and that is deliberate. iamLoadTrade / iamLoadChannels / loadVault stay
   * exactly as they are for every path that does not come through here — a section opened directly, a refresh
   * after a save, an actor profile. What changes is that their LATCHES are set from this response, so on the
   * common path they find the work already done and return without fetching.
   */
  /* ⭐ meTake() HANDS BACK THE REQUEST THAT WAS ALREADY IN FLIGHT, started at sign-in before this screen
     existed. If none is waiting it fetches exactly as before — the include list is identical, so the two paths
     cannot return different shapes. See mePrefetchStart in app.html. */
  try{ const e=(await meTake())||{}; UI._me=e;
    _profSeedIncluded(e);
    /* ⚠️ RE-QUERY THE HOST AFTER THE AWAIT. renderApp() rebuilds the screen wholesale, so a repaint that lands
       while this fetch is in flight — switching viewport, opening the menu — detaches the node captured above.
       Writing to that stale reference paints into a node no longer in the document and the panel stays blank
       with no error anywhere. Every await in this file that is followed by a DOM write has the same hazard. */
    const h2=document.getElementById("profbody"); if(!h2) return;
    h2.innerHTML = profSecHTML(profSec(), e);
    profSnapshot();
    if (profSec() === 'vault') loadVault();   // the trade documents vault (async — pre-fills authority forms)
  }catch(e){ const h3=document.getElementById("profbody"); if(h3) h3.innerHTML=scrErr(e); }
  finally { _profBusy = false; } }

/**
 * ⭐ THE FOUR NAMES, AND WHICH ARE COMPULSORY (Athi, 2026-08-16: *"need to mention about user name context, entity
 * name, employee naming convention and end customer user name convention, what is must, what it means etc"*).
 *
 * ⚠️ EVERY RULE HERE IS READ OFF THE SERVER'S OWN VALIDATORS, not written from memory — `routes/entities.js`
 * (display_name, user_id), `routes/actors.js` (display_name, actor_key), `lib/bridgeid.js` (the alphabet), and
 * `routes/catalogue.js` (the customer row). If a validator changes and this text does not, this becomes the stale
 * copy the rest of today was spent removing. **Cite the file when you edit it.**
 */
/* ⚠️ NAMING lived here — the table that explained Bridge ID, User ID and the rest. Its only renderer
   (namingRulesHTML) went with the dead __iam_old branch, leaving it unreferenced data. Athi: *"in fact this
   information should not be appearing anywhere."* One reference survives at line ~3050 and it is a COMMENT
   pointing here — left deliberately, because the naming rules still exist, in NAMING.md and the API. */
/**
 * ⭐⭐ IAM — who can act for this business, and what each of them may do.
 *
 * ── WHY BOUNDARY, NOT CLASS ─────────────────────────────────────────────────────────────────────────────────
 *
 * Athi listed five classes and then said *"do not take my words as decision, think and provide a better
 * alternate if possible."* Testing his five against what this business actually ADMINISTERS:
 *
 *     this business    yes          co-assists       yes (machines are co-assists — same table, actor_type)
 *     customers        NO — they self-identify with a one-time code; you set terms, not identities
 *     suppliers        NO — another business, with its own IAM; you hold a relationship
 *
 * ⚠️ Five rows with an "Access" column implies you grant access to all five. You cannot. Three would sit
 * permanently empty, and an empty column reads as "not built yet" rather than "not yours to set" — which would
 * contradict the sovereignty the whole rail rests on. So the spine is INSIDE · EDGE · OUTSIDE, and the
 * asymmetry becomes the content instead of an apology.
 *
 * ── WHY TWO TABS ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * ⭐ Identity and access have DIFFERENT TRUTH VALUES, and one table would hide that. Naming is solid — the rules
 * are real and enforced by server validators. Access was a promise two-fifths kept until this afternoon: the hat
 * existed, was offered as a choice, and was enforced in two places out of ~130. One table would have rendered
 * "View-only" beside a real name and a real key, in the same weight, as though all three were equally true.
 *
 * They are also read on different days: naming is set up once, access is checked whenever someone arrives or
 * leaves.
 *
 * ── ⭐⭐ PROVENANCE IS A COLUMN, BECAUSE "WHY CAN'T I DO THIS?" IS THE REAL QUESTION ─────────────────────────
 *
 * Athi asked whether access is *"direct, derived and so on"*, and then *"what about network?"*. The network is
 * not a fourth bucket — it is the EDGE ACCESS FLOWS ALONG, and it appears in all three:
 *
 *     DIRECT    set on this identity, here          the hat · can_see_costs
 *     DERIVED   follows from WHERE YOU SIT          a co-assist's reach follows its node in the tree
 *     CAPPED    descends from your operator         "a store can be no more open than the thing it sits inside
 *                                                    — the narrowest wins" (lib/network-build.js)
 *     THEIRS    another business decided            not shown as a permission at all, because it is not ours
 *
 * ⚠️ DERIVED and CAPPED are the two nobody can find today, because no screen says "this is true because of where
 * you sit". Naming the provenance is what makes this page answer the question people actually ask.
 */
function iamTab(){ return UI.iamTab || 'me'; }
/* setIamTab removed with the tab strip it drove — see iamHTML. */

/* ⚠️ SAME API AS CO-ASSISTS — Athi: "assume we need to have it in another place, then that has to be the same
   api and should behave the same way." This is `api('actors')`, the endpoint cap-workforce already uses, cached
   on UI so switching tabs does not re-fetch. IAM never writes an actor; it links to Co-assists to do that. */
async function iamLoadActors(){
  if (UI._iamActors) return UI._iamActors;
  try { UI._iamActors = (await api('actors', { query: { status: 'all' } })) || []; }
  catch (_) { UI._iamActors = []; }
  return UI._iamActors;
}

var IAM_HAT = {
  manager:   ['Manager',   'acts, and assigns work to others'],
  act:       ['Act',       'does the work'],
  audit:     ['Audit',     'review only'],
  mis:       ['MIS',       'reports'],
  view_only: ['View-only', 'read only']
};
var IAM_WRITES = ['act', 'manager'];

function iamHTML(e){
  var Q = String.fromCharCode(39);
  var tab = iamTab();
  /* kick the fetch on first paint; the tab repaints when it lands */
  if (!UI._iamActors) { iamLoadActors().then(function(){ if (profSec() === 'identity') { _capShowDetail(); loadProfile(); } }); }

  /**
   * ⭐⭐ THREE TABS, AND THE FIRST ONE IS THE ONLY ONE THAT ACTS. Athi, 2026-08-19: *"in the IAM tab, we can
   * bring it as tabs, because he is going to look at only his profile, others are for information only."*
   *
   * ⚠️ HE IS DESCRIBING AN ASYMMETRY I HAD FLATTENED. Two of these tabs are REFERENCE — a map of who else
   * exists and what each may do, every row linking elsewhere to change anything. One is a FORM: the reader's
   * own business, with fields they edit and a Save button. Putting the form third, below two pages of other
   * people's rows, buries the only thing on the screen they came to do.
   *
   * So "My profile" leads, and the rest is labelled for what it is.
   */
  /**
   * ⭐ FOUR TABS, ONE PER KIND OF PARTY — the shape Athi approved in the profiles design.
   *
   * The earlier three (mine · everyone else · what they may do) split by ROLE OF THE SCREEN, which put a
   * business, an employee and a customer on one page and then forced every row to explain which it was.
   * Splitting by PARTY means each tab shows one thing and needs no sentence saying so — which is the point:
   * *"we do not need any explanation."*
   */
    /**
   * ⭐⭐ TWO TABS. Athi, 2026-08-20: *"only two tabs, others are variation of the same."*
   *
   * NETWORK went because a network node IS an entity — *"there is nothing called network tab"* — and the
   * Business tab already says whether you are part of one. CUSTOMER went because there is no customer
   * profile in this app at all: a customer token is accepted only by middleware/customer-auth and can never
   * reach app.html, so their profile lives on the STOREFRONT. Four tabs implied four places to manage
   * people; there are two.
   */
  /* ⚠️⚠️ THE TAB STRIP IS GONE. Athi, 2026-08-20: *"remove the employee tab, move what matters beside the
     picker."* The Employee tab was 195 words of reference prose describing the access model — on a screen
     where nobody chooses an access level. The two facts worth keeping moved to where the choice is made:
     "cannot raise a dispute" into the Commenter option (ACCESS_CHOICES, app.html) and "a label; it grants
     nothing" beside the Role field (cap-workforce). Everything else described what the other screen does.

     ⭐ AND ONE TAB IS NOT A TAB. With Employee gone the strip would have offered a single choice, which is a
     control that cannot be used — the same false affordance as a disabled input or a link to a closed shop. */

  /* ⚠️ _misHead ESCAPES BOTH ARGUMENTS — it takes text, not markup. I passed HTML and it printed a literal
     "&amp;" and a raw <b> tag on Athi's screen. Plain text only here. */
  /**
   * ⚠️⚠️ THE SUBTITLE IS GONE BECAUSE IT HAD BECOME FALSE, WHICH IS WORSE THAN REDUNDANT. Athi, 2026-08-20:
   * *"do we really need this statement — Who can act for this business, and what they may do — in IAM screen?"*
   *
   * It described the screen as it was when co-assists were managed here. They are not: this screen now holds
   * Identity, Business, Storefront, Rights and Documents, and the people live under Co-assists. So the one
   * sentence at the top of the screen was telling a reader the screen was about something it no longer
   * contains — a sentence nobody updated because nobody owns a subtitle.
   *
   * ⭐ AND THE HEADING ALONE ANSWERS IT. Five named sections say what is here better than a sentence
   * generalising over them, and this is the fourth explanatory line removed from this screen today. The
   * pattern is consistent: a description of a screen ages the moment the screen changes, while the sections
   * cannot — they ARE the screen.
   */
  return _misHead('IAM · Identity and Access Management', '')
    /* ⚠️ TWO BRANCHES, BECAUSE THERE ARE TWO TABS. 'node' and 'cust' were still routed here after their tabs
       were removed — unreachable, and exactly the kind of leftover that makes the next reader believe a
       Network tab exists somewhere they have not looked. */
    /* ⚠️ NO EMPLOYEE BRANCH HERE, AND THERE MUST NOT BE ONE. I put one here and it was dead code:
       loadProfile() routes an actor to loadActorProfile() before this function is ever called, so an employee
       cannot reach iamHTML at all. The employee's own screen is rendered THERE — one place, see the note on
       loadActorProfile. A branch here would be unreachable and would read to the next person as though this
       screen served both parties. */
    + iamMeHTML(e);
}

/* ══ shared pieces ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️⚠️ _iamCard, _iamHead and _iamZone LIVED HERE and went with iamWhoHTML/iamAccessHTML on 2026-08-19.
 *
 * Nothing else called them — so removing their two callers orphaned them, and dead-surface went UP from 9 to
 * 10 rather than down. That is how the cascade announced itself, and it is the argument for reading a dead
 * SET together rather than one at a time: the second layer only becomes visible once the first is gone.
 */
/**
 * ⭐⭐ ONE TAB PER PARTY, AS ROWS. Athi, 2026-08-19: *"this is the perfect way of saying"* (the profiles design)
 * and *"we do not need any explanation."*
 *
 * ⚠️ THE PROSE WAS THE BUG, NOT THE CONTENT. Everything these rows say was already on the old screen — buried
 * in sentences that explained which party a row belonged to, because one page held all of them. Splitting by
 * party means each tab shows ONE kind of thing, so the explanation is structural and the words can go.
 *
 * ⭐ AND THE ONE VISUAL RULE FROM THE DESIGN CARRIES OVER: an IDENTIFIER is monospace, a NAME is not. You can
 * see which field is unique without being told — which is the distinction that cost a day to get straight.
 */
var IAM_PARTY = {
  emp: {
    title: 'Employee',
    who: 'Works for this business, inside its boundary.',
    nav: ["navTo('coassists')", 'Co-assists'],
    rows: function (e, acts) {
      var uid = e.user_id || 'your-user-id';
      var n = acts.filter(function (a) { return !a.actor_type || a.actor_type === 'human'; }).length;
      var costs = acts.filter(function (a) { return a.can_see_costs; }).length;
      /**
       * ⚠️ THIS COUNTED WRONG THE MOMENT b173 LANDED. It read (a.hat || 'act'), so an actor carrying the new
       * access_level and no hat defaulted to 'act' and was counted as a writer — the tab cheerfully reported
       * "3 people, 3 can write" for one editor and two who cannot. A fallback chain has to be read in the same
       * order everywhere, and lib/access.js is the order: level first, hat only when the level is absent.
       */
      var LEVEL_OF = { act:'editor', manager:'editor', audit:'commenter', mis:'commenter', view_only:'commenter' };
      var writes = acts.filter(function (a) {
        var lvl = a.access_level || LEVEL_OF[a.hat] || 'editor';
        return lvl === 'editor';
      }).length;
      return [
        /**
         * ⭐⭐ TWO NAMES, AND BOTH TRAVEL OUTWARD. Athi, 2026-08-20: *"Display Name — this can be visible in
         * internal conversation, his employee records etc. External name: employee@entity - Display name.
         * Need to distinguish and both should be there in external conversation."*
         *
         * The PAIR is the point. `ravi@acmetraders` alone is machine-shaped and says nothing about who a
         * person is; "Ravi Kumar" alone is ambiguous — several businesses have a Ravi. A counterparty needs
         * WHICH BUSINESS and WHICH PERSON, so outward they go together.
         */
        ['Display name', 'Their own — used inside', 0, 'May repeat. Internal conversation and their record.'],
        ['External name', 'ravi@' + uid + ' — Ravi Kumar', 1, 'Both halves travel: which business, and which person.'],

        /**
         * ⚠️⚠️ THIS ROW USED TO ADVERTISE FIVE PERMISSIONS AND THERE ARE TWO. It read
         * "Act · Manager · Audit · MIS · View-only — what they may do, enforced on every write", and a manager
         * reading that reasonably concluded the five differed. They do not: `act` and `manager` behave
         * IDENTICALLY, and `audit`, `mis` and `view_only` behave identically to each other.
         *
         * ⭐ Athi, 2026-08-20, diagnosing it better than I had: *"we are talking about two different things
         * here. One is role and another one is access. Here the access is nothing but editable or read only…
         * the role is multiple level in the organisation. Here we are not building multiple level of
         * organisation structure — that is out of scope."*
         *
         * So the CODE is right and the VOCABULARY was wrong: it presented role-words as permission-words. The
         * row now states the two access levels that exist, and lists the five names as what they map to.
         * The person who would otherwise discover this is an employee who asked for a hat that changed nothing.
         */
        /**
         * ⭐⭐ VIEWER · COMMENTER · EDITOR — adopted from Google Workspace, not invented. Athi, 2026-08-20:
         * *"if at all any standards to follow or how other platform quotes… then follow that."*
         *
         * ⚠️ HE HAD ALREADY DESCRIBED "COMMENTER" WITHOUT A NAME FOR IT — *"read only is internal messaging
         * only, not external messaging."* When a description lands on a standard's definition unprompted, the
         * standard is the right one. Google's three are also pure CAPABILITY words with no job title in them,
         * which is the property that matters: what this replaces was five ROLE words posing as permissions.
         *
         * ⭐ AND TWO FLAGS CARRY WHAT THE NAMES USED TO SMUGGLE. Five hats could never express "an editor who
         * sees every branch" — there was no sixth name, and adding one is how five becomes eight.
         */
        ['Access', 'Viewer · Commenter · Editor', 0, 'Three levels. Google Workspace’s, so nobody has to learn ours.'],
        ['Viewer', 'Reads', 0, 'Looks, and says nothing.'],
        ['Commenter', 'Reads · replies INTERNALLY', 0,
          'Sees everything including external threads, and may reply to colleagues. Cannot answer the other party, and cannot raise a dispute — someone auditing who participates is not auditing.'],
        ['Editor', 'Changes records · messages anyone', 0, 'Inside or outside.'],
        ['Sees the whole business', 'A separate switch', 0, 'Reach normally follows their node. This lifts it — inside this entity only.'],
        ['Can see costs', costs + ' of ' + acts.length, 0, 'Buying price and margin. Also a separate switch.'],
        ['Who can change it', 'The account owner, never themselves', 0, 'Every change is recorded — who, when, from what, and why.'],

        ['Role', 'Free text', 0, 'A label. It grants nothing — access does that.'],
        ['Where they sit', 'A node in your structure', 0, 'Their reach follows the node, not the job title.'],
        ['How many', n + (n === 1 ? ' person' : ' people') + ' · ' + writes + ' can write', 0, '']
      ];
    }
  },
  /**
   * ⚠️ DEAD SINCE 2026-08-20 — kept, not deleted, per Athi's rule: *"mark it as dead and later if it is not
   * accessed at all, then remove."* The Network and Customer TABS are gone (IAM-SPEC §26.3): a network node IS
   * an entity, and a customer never reaches this app at all. Nothing routes here any more.
   *
   * The content is not worthless — it is the clearest statement of how a node and a customer are NAMED — which
   * is why it waits for a home rather than a delete. Network naming belongs on the Business tab; customer
   * naming belongs on the storefront.
   */
  node: {
    title: 'Network node',
    who: 'A branch, unit or counter. Its own entity, under yours.',
    nav: ["navTo('network')", 'Network'],
    rows: function (e) {
      var uid = e.user_id || 'your-user-id';
      return [
        ['Store name', 'Its own', 0, 'May repeat'],
        ['Handle', uid + '.store', 1, 'Unique across the platform'],
        ['Bridge ID', 'Its own, generated', 1, 'Different from yours'],
        ['Sits under', e.display_name || 'you', 0, 'The root of the tree'],
        ['Who can see it', 'Capped by its parent', 0, 'The narrowest wins'],
        ['Who works there', 'Co-assists placed at the node', 0, 'Their reach follows it']
      ];
    }
  },
  cust: {
    title: 'Customer',
    who: 'Someone who ordered. You never created this identity.',
    nav: ["profSetSec('storefront')", 'Storefront'],
    rows: function (e) {
      var bid = e.bridge_id || 'CB…';
      return [
        ['Name', 'As they type it', 0, 'No format rule · may repeat'],
        ['Verified by', 'phone@' + bid + '.cr', 1, 'Unique at this shop'],
        ['or', 'email=domain@' + bid + '.cr', 1, 'The @ becomes = so two providers stay two people'],
        ['Proves it with', 'A one-time code', 0, 'No password'],
        ['Access', (e.storefront_access === 'login' ? 'Sign in first' : 'Browse first'), 0, 'One rule for every customer'],
        ['Hat', 'None', 0, 'Not staff — cannot be granted or restricted']
      ];
    }
  }
};


/**
 * ⭐ MY PROFILE — the only tab on this screen that ACTS. Everything else is a map.
 *
 * ⚠️ It leads and it is the default, because a reader opening IAM is almost always here to change something
 * about their own business. Two tabs of other people's rows in front of that is a screen that makes you scroll
 * past everyone else to reach yourself.
 */
/**
 * ⭐⭐ THREE COLLAPSIBLE SECTIONS, GROUPED BY WHO OWNS THE ROW. Athi, 2026-08-20: *"Maybe three different
 * sections, clearly laid out what we are showcasing, as collapsible… if we have to bring a bit more, we have
 * to categorise and showcase accordingly."*
 *
 * ⭐ AND NAMED BY CONCERN, which answers the question he asked in the critique — *"have we worked as per IAM
 * definition or have we mixed up?"* We had. Roughly half of this tab is not identity or access at all: a
 * licence number is business profile, a storefront is commerce presence. Naming the boxes says so on the
 * screen, so a reader knows when they have left IAM:
 *
 *     Identity & access      ← IAM proper. Always open: opening your own profile, this is what you came for.
 *     Business profile       ← licence, address. Collapsed.
 *     Presence & governance  ← constitution, trading, storefront. Collapsed — reference, rarely acted on.
 *
 * ⚠️ EVERY INPUT ID IS UNCHANGED — pf_name, pf_uid, pf_gstn, pf_addr, pf_bs. saveProfile() reads them by id,
 * and a restructure that quietly renamed one would break saving in a way no parse check catches.
 */
function iamSection(key, title, body, opts){
  var o = opts || {};
  var open = (UI._iamOpen && Object.prototype.hasOwnProperty.call(UI._iamOpen, key))
    ? UI._iamOpen[key] : !!o.openByDefault;
  var Q = String.fromCharCode(39);
  return '<div style="border:1px solid var(--line);border-radius:11px;margin-bottom:9px;background:var(--card);color:var(--on-card);overflow:hidden">'
    + '<button type="button" data-testid="iam-sec-' + key + '" aria-expanded="' + (open ? 'true' : 'false') + '"'
    +   ' onclick="iamToggle(' + Q + key + Q + ')"'
    +   ' style="width:100%;display:flex;align-items:center;gap:8px;cursor:pointer;font:inherit;text-align:start;'
    +   'border:0;background:var(--paper);color:var(--on-bg);padding:10px 13px;font-weight:700;font-size:var(--fs-2)">'
    +   '<span style="font-size:11px;color:var(--grey)">' + (open ? '▾' : '<span class=arw>▸</span>') + '</span>'
    +   esc(title)
    +   (o.hint ? '<span style="margin-inline-start:auto;font-weight:400;font-size:var(--fs-1);color:var(--grey)">' + esc(o.hint) + '</span>' : '')
    + '</button>'
    + (open ? '<div style="padding:11px 13px 14px">' + body + '</div>' : '')
    + '</div>';
}

/**
 * ⚠️ COLLAPSING A SECTION DESTROYS ITS INPUTS, so this is a real exit and is guarded like one. iamSection
 * renders its body only when open — closing a section with an edit in it discards that edit silently, which is
 * the exact loss Athi asked to be asked about. Guarding only page navigation would have missed the click
 * people make most often.
 */
function iamToggle(k){
  profGuard(function(){
    UI._iamOpen = UI._iamOpen || {};
    /* the default for a key that has never been touched is whatever the section declared, so the first click
       must flip THAT, not flip an assumed-false */
    var cur = Object.prototype.hasOwnProperty.call(UI._iamOpen, k) ? UI._iamOpen[k] : (k === 'ident');
    UI._iamOpen[k] = !cur;
    renderApp(); _capShowDetail(); loadProfile();
  });
}

/**
 * ⭐⭐ ONE ROW RENDERER FOR THE WHOLE PROFILE. Athi, 2026-08-20: *"anywhere else if the treatment is different
 * just complete those, so all looks similar."*
 *
 * There were THREE shapes doing one job — idRow stacked the label above the value with a dashed rule,
 * rowHtml put the label to the left, and each repeated the same uppercase-label styling inline. Three copies
 * of a style is three places for it to drift, and it had: the same fact looked different depending on which
 * section a reader was in.
 *
 * ⚠️ box() IS DELIBERATELY NOT FOLDED IN. Rights and Trade ready are a GRID OF INDEPENDENT FACTS — Athi asked
 * for boxes there specifically (*"can we make it as boxes, with gaps, more presentable"*) — and a grid is a
 * different thing from a list, not a different style for the same thing.
 *
 * Label left, value right, message BENEATH the value — his convention, once.
 */
/**
 * ⭐⭐ WHERE THIS VALUE CAME FROM, MARKED THE SAME WAY EVERY TIME. Athi, 2026-08-21: *"these settings can fall
 * from governance layer / blueprint / user selected — do we make a mark, how it is derived?"*
 *
 * ⚠⚠ THE VOCABULARY ALREADY EXISTED AND WAS AD HOC, which is the actual defect. Different rows said 'Set
 * above you', 'from your region', 'you set this', 'your device — not set for the business' — four phrasings for
 * three ideas, each invented at the moment its row was written. A reader could not tell whether two rows
 * saying different things meant different things.
 *
 * ⚠️ BLUEPRINT IS DELIBERATELY ABSENT. Athi's model has three sources and the code has three too, but they
 * are not the same three: nothing in the codebase lets a blueprint or work pattern supply a locale value —
 * checked, not assumed. Adding a label that can never appear would document an intention as if it were a
 * behaviour, which is the failure mode this whole table exists to end. When a blueprint does supply one, it
 * gets a row here and the mark starts firing on its own.
 *
 * ⚠️ DEFAULT IS A REAL SOURCE, NOT AN ABSENCE. 'Nobody chose this' is the single most useful thing a reader
 * can learn about a setting that looks wrong — it says the fix is to choose, not to hunt for who overrode you.
 */
var PROF_SRC = {
  gov: ['Governed', 'decided above you — not yours to change'],
  biz: ['Business', 'set on the business record'],
  you: ['You',      'your own choice, on this account'],
  def: ['Default',  'nobody chose — following your region'],
};

/**
 * ⭐⭐ THE MARKS ARE OPT-IN. Athi, 2026-08-21: *"in the profile screen you can have a toggle button to see the
 * source if required."* — *if required* is the operative half.
 *
 * ⚠️ I HAD SHIPPED THEM ALWAYS-ON, WHICH SPENDS THE TEXT BUDGET ON THE WRONG READER. Where a value came from
 * is a question people ask when something looks WRONG — rarely, and deliberately. Eleven permanent chips make
 * every reader pay, every visit, for an answer almost none of them wanted, on a screen already measured at 56%
 * explanation. Off by default; one click when the question arises.
 *
 * ⚠️ THE NOTES STAY VISIBLE EITHER WAY. '{cur} no longer permitted' and 'your device — the business is in IN'
 * are exceptions a reader must see unprompted; only the routine provenance chip hides.
 */
/* ⚠️ typeof-GUARDED, LIKE ITS NEIGHBOURS. apGet lives in app.html; this file is a lazily-loaded capability,
   and a render that throws because an OPTIONAL affordance could not read a preference would blank the whole
   profile to hide a chip nobody asked for. The same shape as the themeGet/TEXT_SIZES guards above. */
function profSrcOn(){
  try { return typeof apGet === 'function' && apGet('cb_prof_src', '') === '1'; } catch (_) { return false; }
}
function profSrcToggle(){
  apSet('cb_prof_src', profSrcOn() ? '' : '1');
  loadProfile();
}

/** The control itself — a quiet line, not a switch competing with the content. */
function profSrcBtn(){
  var on = profSrcOn();
  return '<a href="#" data-testid="prof-src-toggle" onclick="profSrcToggle();return false" '
    + 'style="color:var(--blue);font-size:var(--fs-1);text-decoration:none">'
    + (on ? tx('Hide where these come from') : tx('Show where these come from')) + '</a>';
}

function _srcMark(src) {
  if (!profSrcOn()) return '';               /* opt-in — see the note above */
  var s = Object.prototype.hasOwnProperty.call(PROF_SRC, src) ? PROF_SRC[src] : null;
  if (!s) return '';
  /* ⚠️ COLOUR CARRIES NOTHING HERE. Every mark is the same grey: making 'Governed' red would read as a
     warning, and being governed is not a problem. The word is the information. */
  return '<span title="' + esc(s[1]) + '" style="font-size:var(--fs-1);font-weight:700;letter-spacing:.04em;'
    + 'text-transform:uppercase;color:var(--grey);border:1px solid var(--line);border-radius:4px;'
    + 'padding:0 4px;white-space:nowrap">' + esc(s[0]) + '</span>';
}

function profRow(label, value, note, isHtml, src){
  var mark = _srcMark(src);
  return '<div style="display:flex;gap:12px;align-items:flex-start;padding:5px 0">'
    + '<b style="min-width:88px;flex:0 0 88px;font-size:var(--fs-1);color:var(--grey);text-transform:uppercase;'
    + 'letter-spacing:.04em;line-height:1.7">' + esc(label) + '</b>'
    + '<div style="flex:1;min-width:0">'
      /* ⚠️ isHtml MEANS "THIS VALUE IS MARKUP" — the jump-to-control arrow, the employee login chip.
         Everything else is escaped and stays escaped: raw HTML must be opted into deliberately. */
      + '<div>' + (isHtml ? value : esc(value)) + '</div>'
      /* ⚠️ THE MARK SHARES THE NOTE LINE rather than taking a row of its own. Every row gaining a third line
         would add eleven lines to this section for information most readers need once. */
      + ((mark || note) ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.5;'
          + 'display:flex;gap:6px;align-items:baseline;flex-wrap:wrap">' + mark
          + (note ? '<span>' + esc(note) + '</span>' : '') + '</div>' : '')
    + '</div></div>';
}

/** ⭐ And ONE group heading — larger, ruled, with its rows indented beneath it. */
function profGroup(title, rowsHtml){
  if (!rowsHtml) return '';
  return '<div style="font-size:var(--fs-2);font-weight:700;color:var(--on-card);'
    + 'margin:14px 0 6px;padding-bottom:4px;border-block-end:1px solid var(--line)">' + esc(title) + '</div>'
    + '<div style="padding-inline-start:6px">' + rowsHtml + '</div>';
}

function iamMeHTML(e){
  var Q = String.fromCharCode(39);
  /* ⚠️ KICKED FROM THE RENDERER because this screen has no mount step — same as iamLoadDocs, same latch. */
  iamLoadTrade();
  iamLoadChannels();

  /* ── 1 · IDENTITY & ACCESS ─────────────────────────────────────────────────────────────────────────────
   * ⚠️⚠️ NAME EDITABLE, USER ID FIXED — and it was exactly reversed before. This app's own naming table says
   * display_name is *"change it any time — nothing cites it, everything cites your ID"*, and the screen had
   * made the NAME read-only text and the USER ID an editable input. The mutable fact was pinned and the
   * load-bearing one was loose. */
  /**
   * ⭐ THE PENCIL IS THE AFFORDANCE, NOT A SENTENCE. Athi, 2026-08-20: *"in the name field show editable
   * icon."* Two rows sit together — one editable, one fixed — and the difference now shows in the row itself
   * rather than being inferred from the fact that one is an <input>.
   */
  var ident = '<label class="fl">' + tx('Name') + ' <span style="color:var(--grey);font-weight:400" title="' + esc(tx('You can change this')) + '">✎</span></label>'
    + '<input class="inp" id="pf_name" value="' + esc(e.display_name || '') + '">'

    /* ⚠️⚠️ THE THREE-LINE EXPLANATION IS GONE. Athi: *"we don't want this info — that is what we are showcasing
       in employee."* It said co-assists sign in as key@handle, which the EMPLOYEE's own screen already shows
       them as their actual login. Explaining someone else's screen on yours is the definition of the text this
       product carries too much of; the 🔒 says the one thing left that is not visible from the value. */
    + '<div style="margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--on-bg)">'
    + (e.user_id
        ? '<div style="font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.05em;color:var(--grey);font-weight:600">'
          +   tx('User ID') + ' <span title="' + esc(tx('Cannot be changed')) + '">🔒</span></div>'
          + '<div class="mono" style="font-size:var(--fs-3);color:var(--gold);margin-top:2px">' + esc(e.user_id) + '</div>'
        : '<label class="fl" style="margin-top:0">' + tx('User ID') + '</label>'
          + '<input class="inp" id="pf_uid" value="" autocapitalize="off" spellcheck="false">'
          /* ⚠️ THIS ONE STAYS. It is not explanation — it is the rule you must satisfy to fill the box, and it
             is unrecoverable if you get it wrong. Set-once means there is no second attempt to learn from. */
          + '<div style="font-size:var(--fs-1);color:var(--warn-2);margin-top:5px;line-height:1.5">'
          +   '8+ characters · letters, numbers, dashes · no <b>@</b> or <b>.</b> · <b>' + tx('permanent') + '</b></div>')
    + '</div>';

  /* ⚠️⚠️ THE BRIDGE ID ROW IS GONE, AND NOT ONLY FROM HERE. Athi: *"we don't need to say minted, never typed —
     in fact this information should not be appearing anywhere."* A bridge_id is a PRIMARY KEY: it exists so
     rows can reference each other without depending on anything a person may change. Putting it on screen
     asks someone to know an implementation detail, and — worse — two supplier screens were labelling it
     "User ID", so a person could read it and quote it to a supplier as their handle. See e2e/bridge-id-audit. */

  /* ── 2 · BUSINESS PROFILE ──────────────────────────────────────────────────────────────────────────────
   * ⚠️ GSTIN IS INDIA-ONLY AND THIS IS THE HALF-STEP. Athi, 2026-08-19: *"GSTIN is for India — if it is for
   * any other country, how do they do? We may have to ask licence name and licence number… possibly we
   * provide suggestion based on country."* The full (scheme, value) pair needs a column and a country
   * catalogue; until then the label says what it is and where the name comes from, so the field stops
   * asserting that every business on earth is Indian. */
  var licLabel = (function(){
    try {
      var r = CBLocale.region && CBLocale.region();
      return ({ IN:'GSTIN', AE:'TRN', SA:'VAT number', GB:'VAT / company number', DE:'USt-IdNr.', FR:'SIRET', SG:'UEN', US:'EIN' })[r] || 'Licence number';
    } catch (_) { return 'Licence number'; }
  })();
  var profile = '<label class="fl">' + esc(licLabel)
    +   ' <span style="color:var(--grey);font-weight:400;font-size:var(--fs-1)">— your business registration</span></label>'
    + '<input class="inp" id="pf_gstn" value="' + esc(e.gstn || '') + '">'
    + '<label class="fl">' + tx('Address') + '</label>'
    + '<input class="inp" id="pf_addr" value="' + esc(e.address || '') + '">'
    /**
     * ⭐⭐ GOODS · SERVICES · BOTH — the GST and WTO vocabulary, not "sales vs service". Athi, 2026-08-20:
     * *"does this business do sales or service?… any generic standard term available that has to be used."*
     *
     * A SALE is the transaction, and a service is sold too; goods and services are the two kinds of THING
     * supplied, which is the distinction actually being drawn. Every Indian GST return says "supply of goods
     * or services or BOTH" — so the words cost a reader nothing to learn.
     *
     * ⚠️ AND "BOTH" IS THE COMMON CASE, not a convenience. A garage sells a part and fits it. Two options
     * would make half the market describe itself wrongly on the first screen it meets.
     */
    + '<label class="fl">' + tx('Supplies') + '</label>'
    + '<select class="inp" id="pf_sup" style="max-width:220px">'
    +   [['goods', tx('Goods')], ['services', tx('Services')], ['both', tx('Both')]].map(function(o){
          return '<option value="' + esc(o[0]) + '"' + ((e.supplies || 'goods') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('')
    + '</select>'
    /**
     * ⚠️⚠️ COUNTRY · TIME ZONE · NUMBER FORMAT MOVED HERE, AND I ALMOST LOST THEM. They sat under "Presence &
     * governance"; rewriting that section as Storefront dropped the iamGovernedRows() call and nothing on
     * screen said so — e2e/dead-surface.cjs caught it by reporting the function newly orphaned. Athi's line
     * was *"information should not be missed"*, and this is exactly how it goes missing: not deleted on
     * purpose, but left behind by a regroup.
     *
     * ⭐ AND BUSINESS IS WHERE THEY BELONG. They are facts about the business — where it trades, in what
     * currency, how it writes numbers — not about its presence. The sentence that used to introduce them
     * ("From your installation. Your own reading language and formats are separate…") is gone: the rows are
     * read-only, which says the same thing by being true.
     */
    ;   /* ⚠️ REGIONAL LEFT THIS SECTION. Athi, 2026-08-20: *"can we keep regional as a separate collapsable
           unit — it is under business, I was searching for something on its own."* He went looking for it as a
           thing and found it as a footnote. A block a person searches FOR is a section; a block they read in
           passing is a row. Which it is was decided by how he tried to use it, not by where the data lives. */

  /* ── 3 · PRESENCE & GOVERNANCE ─────────────────────────────────────────────────────────────────────────
   * Read-only rows come from the constitution and the operator; the editable one is trading status. */
  var vis = e.catalogue_visibility || 'private';
  var st  = e.business_status || 'open';
  /* ⚠️ DECLARED HERE, NOT BORROWED. I first wrote the capped-visibility branch below using `cap` and `capped`
     from storefrontCardHTML — variables in a different function, which is a ReferenceError at render time and
     invisible to node --check. Third time today that a remembered name compiled and would not have run. */
  var cap    = e.visibility_cap || { max: 'public', by: null, reason: '' };
  var capped = (cap.max === 'private');
  /**
   * ⭐⭐ ONE RESOLVED SENTENCE, NOT TWO FACTS TO JOIN. Athi, 2026-08-19: *"we have to state explicitly that your
   * storefront is visible to public — that depends on the open, close, away status."*
   *
   * ⚠️⚠️ AND THE OLD NOTE HERE IS NOW FALSE. It read *"this is whether you are trading — nothing to do with who
   * may see your catalogue"*, which was TRUE of the old code and is not true of the new: `closed` now hides the
   * catalogue outright (IAM-SPEC §12). A backend fix that leaves a contradicting sentence on the screen has
   * moved the bug rather than fixed it.
   */
  /**
   * ⭐⭐ IS THERE A STOREFRONT AT ALL. Everything in this section follows from this one boolean — the link, the
   * customer-access mode, and the network line. That is the coupling Athi named: *"both should work together —
   * when no link, why do you need browse first?"*
   *
   * ⚠️⚠️ AND A NETWORK WITH NOTHING PUBLISHED UNDER IT IS NOT LIVE. *"By default it is a PRIVATE network, so no
   * storefront. But if you have any store under you is public, then the storefront will be public."* Without
   * this clause the screen offered a link for a network whose every member was private — a link that opens an
   * empty shop, which is the false affordance this whole section keeps being fixed for.
   *
   * ⚠️ `== null` IS DELIBERATE: it catches undefined AND null — a server that could not take the count, and an
   * older API that does not send one. Neither is evidence that the network is empty, so neither hides the
   * link. Only a real zero does.
   */
  var live = (st !== 'closed') && vis !== 'private'
          && !(vis === 'network' && e.network_public_count === 0);

  /**
   * ⭐⭐ TWO CONTROLS, ADJACENT, AND NOTHING ELSE. The resolved sentence is gone: it restated in prose what the
   * two selects say in two words, and it was the third of four places this screen named the same fact.
   *
   * ⚠️ THE CONTROL ITSELF MOVED HERE FROM THE STOREFRONT PANEL. Visibility was read-only here with a link
   * saying "Change in Storefront", which is a screen telling you to go to another screen to change something
   * it is already showing you. If it can display it, it can set it.
   */
  var governed = '<div style="display:flex;gap:11px;flex-wrap:wrap">'
    +   '<div style="flex:1 1 150px"><label class="fl" style="margin-top:0">' + tx('Trading') + '</label>'
    +     '<select class="inp" id="pf_bs" style="margin:0">' + opt(['open','away','closed'], st) + '</select></div>'
    /* ⚠️ THE CAP IS HONOURED HERE OR THE CONTROL LIES. visibility_cap can pin an entity to private from a layer
       above it; offering "public" in that state would be a choice the server refuses. Disabled, and the reason
       is the only sentence in this section — because a control that cannot be used and does not say why is the
       one place where removing the explanation would remove the information. */
    +   '<div style="flex:1 1 150px"><label class="fl" style="margin-top:0">' + tx('Visible to') + '</label>'
    +     '<select class="inp" id="pf_vis" style="margin:0"' + (capped ? ' disabled' : '') + '>'
    +     opt(capped ? ['private'] : ['public','network','private'], vis) + '</select></div>'
    + '</div>'
    + (capped ? '<div class="misnote" style="margin-top:6px">' + esc(cap.reason || tx('Set above you.')) + '</div>' : '')

    /* ⚠️ THE STOREFRONT LINK OPENS IN A NEW WINDOW — and that does NOT protect the session, which was the
       stated reason for it. Same origin means the same localStorage. We are safe today because shop.html
       holds no session at all; the rule to keep is that a customer token must never be written to cb_sess. */
    /**
     * ⚠️⚠️ THE CUSTOMER-ACCESS MODE CAME WITH IT, OR IT WOULD HAVE BEEN LOST. Folding the Storefront panel into
     * this section made storefrontCardHTML unreachable — and that card held `storefront_access` (browse-first
     * vs login-first), a real setting with no other home. Deleting the panel without carrying this across is
     * the same failure as the localisation rows an hour ago: not removed on purpose, left behind by a regroup.
     */
    /**
     * ⚠️⚠️ THE CUSTOMER-ACCESS MODE ONLY EXISTS WHILE THERE IS A STOREFRONT. Athi, 2026-08-20: *"private, link
     * is gone, but browse-first window is visible — both should work together. When no link, why do you need
     * browse first?"*
     *
     * ⭐ THAT IS A COUPLING, AND IT IS THE ONE THE LINK ALREADY OBEYS. "Browse first or sign in first" answers
     * a question about people arriving at a shop; with no shop nobody arrives, and the control sets a rule for
     * a situation that cannot occur. Two controls describing one thing must appear and vanish together, or the
     * screen says the shop is shut and in the next line asks how visitors should enter it.
     *
     * ⚠️ DROPPED FROM THE DOM, NOT DISABLED — which also puts it beyond PROF_FIELDS, so the per-section Save
     * cannot send an access mode for a storefront that does not exist. Registered in C:\dev\INVARIANTS.md.
     */
    /* ⚠️ BUILT INLINE — opt() takes a flat value list, and there is no label/value variant. I wrote `opt2(...)`
       from memory and it does not exist anywhere: the sixth invented name today, and the only one caught
       before it shipped, because I checked instead of assuming. */
    + (live
        ? '<label class="fl">' + tx('Customers') + '</label>'
          + '<select class="inp" id="pf_sfaccess" style="max-width:320px">'
          +   [['browse', tx('Browse first')], ['login', tx('Sign in first')]].map(function(o){
                return '<option value="' + esc(o[0]) + '"' + ((e.storefront_access || 'browse') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
              }).join('')
          + '</select>'
        : '')

    /**
     * ⭐ THE NETWORK ANSWER IS DERIVED, NOT STORED. Athi, 2026-08-20: *"if you change the option to network, by
     * default it is a PRIVATE network, so no storefront. But if you have any store under you is public, then
     * the storefront will be public. This way we are avoiding another status field."*
     *
     * ⭐⭐ A PRIVATE NETWORK NEEDS NO FLAG — it is a network where nobody has published. The question already
     * has an answer in the data, and a second stored answer beside it is two facts that can disagree.
     *
     * ⚠️ null IS NOT ZERO. The server sends null when the count could not be taken; "nothing under you is
     * public" is a definite statement and this is the absence of one, so the line simply does not appear.
     */
    + (vis === 'network' && e.network_public_count != null
        ? '<div class="kv" style="margin-top:9px"><b>' + tx('Network') + '</b> · '
          + (e.network_public_count > 0
              ? esc(txf('{n} store(s) under you are public', { n: e.network_public_count }))
              : '<span style="color:var(--grey)">' + tx('nothing under you is public') + '</span>')
          + '</div>'
        : '')

    + '<div class="kv" style="margin-top:11px"><b>' + tx('Link') + '</b> · '
    +   (live && (e.user_id || e.bridge_id)
          ? '<a href="/shop.html?s=' + encodeURIComponent(e.user_id || e.bridge_id) + '" target="_blank" rel="noopener noreferrer"'
            + ' style="color:var(--blue)">' + esc(location.host + '/shop.html?s=' + (e.user_id || e.bridge_id)) + ' <span class=arw>↗</span></a>'
          : '<span style="color:var(--grey)">' + tx('nothing to show while private or closed') + '</span>')
    + '</div>'
    /* ⭐ THE OTHER HALF OF "how is this store reached" — the link answers the catalogue, these answer the
       messages. Both are outward facts; neither is configured here. */
    ;   /* ⚠️ CHANNELS LEFT THIS SECTION, for the same reason Regional did. Athi: *"same way, the channel under
           storefront, can we keep it separate as Channel? And point to channel settings?"* Both were things he
           went LOOKING for and found buried — and the test is not where the data belongs but how a person
           reaches for it. The storefront link answers "can customers see my catalogue"; the channels answer
           "where does work arrive". Related, and not the same question. */

  /**
   * ⭐⭐ FIVE SECTIONS, ONE SCREEN, NO RAIL. Athi, 2026-08-20: *"we have other three panel in profile —
   * storefront, your rights and documents — it can come over to the first page itself… see what we have
   * repeated… no explanatory text, the details have to be intuitive and information should not be missed."*
   *
   * ⚠️⚠️ CATALOGUE VISIBILITY WAS STATED FOUR TIMES. "You have no public storefront", "Who may see your
   * catalogue · private", "Storefront · not visible right now" — three read-only restatements on THIS screen —
   * and then the Storefront panel, which owns the actual control. Three of the four were echoes.
   *
   * ⚠️⚠️ AND TRADING STATUS SAT APART FROM VISIBILITY WITH EACH PANEL APOLOGISING FOR THE SPLIT. This screen
   * carried "⚠️ Separate from who can see your catalogue — that lives under Storefront" and Storefront carried
   * "⚠️ This is not whether you are trading — that is under Identity". Two panels explaining why they are not
   * each other is the split being wrong, not the labels. They are one subject — `closed` already hides the
   * catalogue outright (§12) — so they now sit together and both disclaimers deleted themselves.
   *
   * ⭐ THE HINT CARRIES THE ANSWER SO THE SECTION NEED NOT BE OPENED. That is what replaces the prose: a
   * reader learns "private · open" from the closed header, and opens it only to change something.
   */
  /**
   * ⚠️⚠️ THE HINT IS WHY THESE SECTIONS EXIST CLOSED. Athi could not find the channels or the Regional block —
   * both sit inside sections that default to collapsed, so the feature was shipped, correct, and invisible.
   *
   * ⭐ THE FIX IS NOT TO OPEN EVERYTHING. It is the rule this screen already follows: the hint carries the
   * ANSWER so the section need not be opened. A reader who wants "public · open · 2 channels" now has it
   * without a click, and opens the section only to change something.
   */
  var _regHint = [ (e.country || null), (e.currency_code || null), (e.timezone || null) ]
                 .filter(Boolean).join(' · ') || tx('not set');
  var _chanN = Array.isArray(UI._chans) ? UI._chans.length : null;
  /* ⚠️ AFTER _chanN, NOT BEFORE.  hoists the NAME and not the VALUE, so reading it one line earlier gave
     undefined — falsy — and the hint would have said "none yet" for every entity, always. A silent
     always-wrong, and the third this session that only a check for declaration order would find. */
  /* ⚠️ null (not read / failed) IS NOT ZERO — the hint stays empty rather than claiming none. */
  var _chanHint = (_chanN === null) ? '' : (_chanN ? (_chanN + ' ' + (_chanN === 1 ? tx('bound') : tx('bound'))) : tx('none yet'));
  var _sfHint = [ (e.catalogue_visibility || 'private'), (e.business_status || 'open') ].join(' · ');
  /* ⭐ COUNTRY AND CURRENCY IN THE HINT — the two Regional facts a reader is most likely to be checking, and
     the reason they open this section at all. */
  /* ⭐ country and currency moved OUT of this hint with the block they describe — a hint must summarise its
     own section, or the closed screen answers the wrong question. */
  var _licHint = [ (e.supplies || 'goods'), (e.gstn ? licLabel : null), (e.address ? 'address' : null) ].filter(Boolean).join(' · ')
                 || tx('not set');

  /* ⭐ EACH SECTION CARRIES ITS OWN SAVE — and Rights carries none, because nothing in it is yours to set.
     A Save button on a read-only card is the same false affordance as a disabled input. */
  return iamSection('ident', tx('Identity'), ident + profSaveBtn('ident'), { openByDefault: true,
             hint: [e.user_id, e.bridge_id].filter(Boolean).join(' · ') })
    + iamSection('profile', tx('Business'), profile + profSaveBtn('profile'), { hint: _licHint })
    /* ⚠️ THE SAVE BUTTON WENT WITH THE PICKER. It was rendered when the constitution permitted more than one
       currency — the section's only writable control. With the picker in Settings, a Save here would submit an
       empty section: a button that does nothing is worse than no button, because a reader who presses it and
       sees 'saved' believes something was written. */
    + iamSection('regional', tx('Regional'), iamGovernedRows(e), { hint: _regHint })
    + iamSection('channels', tx('Channels'), iamChannelRows(), { hint: _chanHint })
    + iamSection('governed', tx('Storefront'), governed + profSaveBtn('governed'), { hint: _sfHint })
    /* ⭐ TRADE READY SITS BESIDE RIGHTS, not among the editable sections — both answer "what may this
       business do", one from the platform and one from the world. Neither takes a Save. */
    + iamSection('trade', tx('Trade ready'), iamTradeBody(), { hint: iamTradeHint() })
    + iamSection('rights', tx('Rights'), iamRightsBody(e), { hint: tx('resolved') })
    + iamSection('docs', tx('Documents'), iamVaultBody(), { hint: UI._vaultHint || '' });
}

/**
 * The resolved-rights card, moved off its own panel.
 *
 * ⚠️ THE PARAGRAPH THAT USED TO SIT UNDER IT IS GONE — three sentences explaining that this is the answer and
 * the seven layers are the derivation. The button says "The seven layers →", which is the same information in
 * four words, and the reader who does not care never reads a paragraph telling them they might.
 */
function iamRightsBody(e){
  var Q = String.fromCharCode(39);
  return (govCardHTML(e.governance) || '<div class="misnote">' + tx('Nothing resolved yet.') + '</div>')
    + '<button class="composebtn" style="margin-top:9px" data-testid="gov-to-layers" '
    +   'onclick="navTo(' + Q + 'settings' + Q + ');setSetSec(' + Q + 'governance' + Q + ')">'
    +   tx('The seven layers') + ' <span class=arw>→</span></button>';
}

/**
 * The trade-documents vault, moved off its own panel.
 *
 * ⚠️ IT LOADS ASYNCHRONOUSLY AND MUST ONLY DO SO WHEN THE SECTION IS OPEN. The vault was a whole panel a
 * person navigated to deliberately; as a collapsed section it would otherwise fetch on every profile paint for
 * every reader who never opens it — the on-demand rule exactly.
 */
function iamVaultBody(){
  var open = UI._iamOpen && UI._iamOpen.docs;
  if (!open) return '';
  setTimeout(function(){ if (typeof loadVault === 'function') loadVault(); }, 0);
  return '<div id="vaulthost"><div class="loadwrap"><span class="spin"></span> ' + tx('loading…') + '</div></div>';
}


/**
 * ⚠️⚠️ SESSION_IS_ACTOR LIVED HERE AND IS GONE, IN TWO STAGES, BOTH WORTH RECORDING.
 *
 * It first read `SESSION.identity_type` (never set anywhere — my line was the only reader in the repo) and
 * `UI.profile.identity_type` (UI.profile belongs to cap-readiness.js: the TRADE DECLARATION). So it returned
 * false for everyone: not a crash, a silent always-false. e2e/session-keys.cjs now catches that class.
 *
 * Then it turned out not to be needed at all. loadProfile() already routes an actor to loadActorProfile()
 * before iamHTML runs, so the branch it gated was unreachable no matter what it returned. The right question
 * was never "is this reader an actor" — it was "where does an employee's profile already render", and that
 * had an answer before I started.
 *
 * ⭐ TWO BUGS, ONE CAUSE: I searched for where the IAM SCREEN renders instead of where an EMPLOYEE'S PROFILE
 * renders, and built beside a function I never looked for.
 */

/**
 * ⭐⭐ THE EMPLOYEE'S OWN PROFILE. Athi, 2026-08-20: *"in the employee profile, there is nothing mentioned
 * about his access level, like reviewer, edit and the other one, which one he belongs to."*
 *
 * Three things an employee needs about themselves, and the screen showed none of them:
 *   1. WHO they are here      — the login they type, which is key@business and is not theirs to change
 *   2. WHAT THEY MAY DO       — the access level, with the other levels visible so the answer has a scale
 *   3. HOW TO CHANGE IT       — they cannot; the owner can. Said plainly rather than left to be discovered.
 *
 * ⚠️ ALL THREE ARE READ-ONLY BY DESIGN. Athi, on the walk: *"current hat, display below what other hats are
 * possible. Request your manager to modify if required."* An editable control here would be a lie — the API
 * refuses it (routes/actors.js is entity-only), so the screen must not offer what the server will decline.
 */
function iamSelfEmployeeHTML(e){
  /* ⚠️ KICKED OFF FROM THE RENDERER because there is no other hook — this screen has no mount step. The latch
     inside iamLoadDocs is what keeps that from being a render loop. */
  iamLoadDocs();
  var lvl   = accessLevelOf(e);
  var login = (e.actor_key && e.parent_user_id) ? (e.actor_key + "@" + e.parent_user_id) : null;

  /**
   * ── 1 · WHO YOU ARE — name, login, access level. ALL READ-ONLY. ───────────────────────────────────────
   *
   * ⭐⭐ Athi, 2026-08-20: *"the access the employee cannot change, it should be done by entity and it should
   * be visible here as part of WHO YOU ARE — name, id, and access level."*
   *
   * ⚠️ THE NAME WAS AN EDITABLE INPUT AND IS NOT ANY MORE. It sits in the list of things Athi called visible,
   * beside two facts nobody disputes are the entity's; and the external name a counterparty sees is
   * key@business — Display Name, so a person who could rename themselves freely could present as someone
   * else to the other side of a trade. ⚠️ ASSUMPTION FLAGGED: if an employee should be able to change their
   * own display name, this is the line to change, and the API needs a matching route — /actors/:id is
   * entity-only today, so an input here would have been refused anyway.
   *
   * ⭐ THREE FACTS, ONE BLOCK, NO FORM. Nothing here is editable, so nothing here should look editable.
   */
  /* ⚠️ idRow WAS ITS OWN SHAPE — label stacked ABOVE the value with a dashed rule, while Regional put the
     label to the left. Same job, two looks, and a reader crossing between the employee profile and the
     business profile met the same kind of fact dressed differently. It is profRow now; the value may be
     markup here (the login chip), which is why the fourth argument is true. */
  var idRow = function(label, value, note){ return profRow(label, value, note, true); };

  var who = idRow(tx('Name'), '<span style="font-size:var(--fs-3);font-weight:700">' + esc(e.display_name || '—') + '</span>',
                  tx('Set by your employer.'))
    + idRow(tx('Your login'),
            login ? '<span class="mono" style="font-size:var(--fs-3);color:var(--gold)">' + esc(login) + '</span>'
                  : '<span class="mono" style="color:var(--grey)">' + esc(e.actor_key || '—') + '</span>',
            tx('Your key, then your employer\'s User ID. Issued with your account and cannot be changed.'))
    + idRow(tx('Access'),
            '<span class="optchip" style="background:var(--blue-tint);color:var(--blue-d);border-color:var(--blue-tint-line)">'
              + esc(ACCESS_LABEL[lvl] || lvl) + '</span>'
            + (e.whole_entity === true  ? ' <span class="optchip">' + tx('Whole business') + '</span>' : '')
            + (e.can_see_costs === true ? ' <span class="optchip">' + tx('Sees costs') + '</span>' : ''),
            tx('Only your employer can change this.'))
    /* ⚠️ NO BRIDGE ID ROW. Athi: *"this information should not be appearing anywhere."* An employee has a
       login they type and a name colleagues read; the internal key is neither, and showing it here would
       invite them to quote it to someone. e2e/bridge-id-audit.cjs holds the line. */;

  /**
   * ── 2 · YOUR IDENTITY RECORD ─────────────────────────────────────────────────────────────────────────
   *
   * ⭐ RENDERED BY THE SHARED MODULE, NOT BY THIS FILE. Athi: *"as a separate module to update."* The same
   * block appears on the Co-assists form; two copies would drift, and the copy that lost the Aadhaar
   * sentence would be the one that mattered. In 'self' mode it splits itself into what this person may add
   * and what their employer recorded. UI._idocs is filled by iamLoadDocs().
   *
   * ⚠️ THE SEPARATE "YOUR ACCESS" SECTION IS GONE. The ladder of three levels was a good way to show a level
   * in isolation and the wrong answer to what Athi actually asked for — access belongs *"as part of who you
   * are, name, id, and access level"*. One line in the identity block beats a section a reader must open to
   * learn one word, and this product's measured problem is that 56% of its on-screen words are explanation.
   */
  var docs = (typeof CBIdDocs !== 'undefined')
    ? CBIdDocs.html(UI._idocs || [], 'self')
    : '<div class="misnote">' + tx('Loading…') + '</div>';

  return iamSection("ident", tx("Who you are"), who, { openByDefault: true, hint: ACCESS_LABEL[lvl] || '' })
    + iamSection("docs", tx("Your identity record"), docs, { hint: iamDocsHint() });
}

/** "2 of 6 verified" — the summary an owner or an employee reads before opening the section. */
function iamDocsHint(){
  var d = UI._idocs || [];
  if (!d.length) return '';
  var ok = d.filter(function(x){ return x.status === 'verified'; }).length;
  return ok + ' of ' + (CBIdDocs ? CBIdDocs.ORDER.length : 6) + ' verified';
}

/**
 * ⭐⭐ TRADE READY, AS THE OUTWARD ANSWER — not the workbench.
 *
 * Athi, 2026-08-20: *"Trade ready — I guess that also, if we make it crisp, then it can get into profile.
 * That is how other suppliers will view this person."*
 *
 * ⚠️ SO THE 535-LINE SCREEN DOES NOT MOVE. cap-readiness is a workbench — lanes, destinations, AI drafting,
 * registry verification — and a person goes there to DO something. What belongs on a profile is the thing a
 * counterparty reads: how much is proved, and how well. Copying the workbench here would have given the app a
 * second place to work on the same records, which is the duplication this whole day removed.
 *
 * ⭐ THE RUNGS ARE THE CONTENT, and they are already the product's own vocabulary — verified beats attested
 * beats documented ([[project-attestation-layer]]). A supplier asking "can I trade with them" is asking which
 * rung, not how many rows.
 */
function iamTradeHint(){
  var s = UI._rdSum;
  if (!s) return '';
  if (!s.total) return tx('not started');
  return s.verified + ' ' + tx('verified') + ' · ' + s.met + '/' + s.total;
}

function iamTradeBody(){
  var s = UI._rdSum;
  if (s === undefined) return '<div class="misnote">' + tx('Loading…') + '</div>';
  /* ⚠️ null means the read FAILED. That is not "nothing is ready" — a definite claim from an absent answer is
     the mistake the network count already avoids. */
  if (s === null) return '<div class="misnote">' + tx('Could not read your trade record.') + '</div>';
  if (!s.total)  return '<div class="misnote">' + tx('Nothing recorded yet.') + '</div>'
    + iamTradeLink();

  var box = function(label, value, sub, tone){
    return '<div style="flex:1 1 130px;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:11px;'
      + 'background:var(--paper);color:var(--on-bg)">'
      + '<div style="font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.05em;color:var(--grey);font-weight:600">' + esc(label) + '</div>'
      + '<div style="margin-top:3px;font-size:var(--fs-4);font-weight:700' + (tone ? ';color:' + tone : '') + '">' + esc(value) + '</div>'
      + (sub ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' + esc(sub) + '</div>' : '')
      + '</div>';
  };

  /* The trust ladder, highest rung first — that is the order a counterparty reads it in. */
  var rungs = '<div style="display:flex;flex-wrap:wrap;gap:9px">'
    + box(tx('Verified'),   String(s.verified),   tx('checked at source'), 'var(--ok-3)')
    + box(tx('Attested'),   String(s.attested),   tx('third party'), '')
    + box(tx('Documented'), String(s.documented), tx('self-declared'), '')
    + '</div>';

  /* ⚠️ ONLY WHAT NEEDS ACTION APPEARS. A row reading "expired: 0" is a fact nobody needs; the absence of the
     row is the same answer and costs no attention. */
  var flags = [];
  if (s.expiring) flags.push(['⚠️', s.expiring + ' ' + tx('expiring'), 'var(--warn-3)']);
  if (s.expired)  flags.push(['✕',  s.expired  + ' ' + tx('expired'),  'var(--bad-3)']);
  if (s.pending)  flags.push(['○',  s.pending  + ' ' + tx('not started'), 'var(--grey)']);

  return rungs
    + (flags.length
        ? '<div class="kv" style="margin-top:10px">'
          + flags.map(function(f){ return '<span style="color:' + f[2] + ';margin-inline-end:12px">' + f[0] + ' ' + esc(f[1]) + '</span>'; }).join('')
          + '</div>'
        : '')
    + iamTradeLink();
}

/* ⭐ THE WORK HAPPENS ON THE OTHER SCREEN, and the button is the whole instruction. */
function iamTradeLink(){
  var Q = String.fromCharCode(39);
  return '<button class="composebtn" style="margin-top:10px" data-testid="prof-to-readiness" '
    + 'onclick="navTo(' + Q + 'readiness' + Q + ')">' + tx('Trade readiness') + ' <span class=arw>→</span></button>';
}

/**
 * ⚠️ LATCHED, like the identity record — this sets UI._rdSum and then repaints, and the renderer reads
 * UI._rdSum. Without the latch that is a cycle which pins a core and looks like a slow screen.
 */
async function iamLoadTrade(){
  if (UI._rdSumLoaded) return;
  UI._rdSumLoaded = true;
  try {
    var r = await fetch(CFG.API_BASE + '/api/governance/readiness',
      { headers: { Authorization: 'Bearer ' + SESSION.token } });
    UI._rdSum = r.ok ? ((await r.json()).summary || null) : null;
  } catch (_) { UI._rdSum = null; }
  renderApp(); _capShowDetail(); loadProfile();
}

/**
 * Fetch the record once, then re-render.
 *
 * ⚠️ GUARDED AGAINST A RENDER LOOP. It sets UI._idocs and calls renderApp, and renderApp calls the renderer
 * that reads UI._idocs — so without the _idocsLoaded latch this is an infinite cycle that pins a CPU core and
 * looks, from the outside, exactly like a slow screen.
 */
async function iamLoadDocs(){
  if (UI._idocsLoaded) return;
  UI._idocsLoaded = true;
  try {
    await ensureCap('iddocs');
    UI._idocs = await CBIdDocs.load();
    /* ⚠️ loadProfile() TOO — the employee screen is painted by loadActorProfile, which renderApp alone does
       not re-run. Without it the documents arrive, sit in UI._idocs, and the section keeps showing "Loading…"
       until something else happens to repaint. Same trio iamToggle uses; anything less is a half-repaint. */
    renderApp(); _capShowDetail(); loadProfile();
  } catch (_) { /* the record is additive — its absence must not take the profile down */ }
}

/**
 * The constitutional facts — read-only here by design. Athi, 2026-08-19: *"in my eyes this would be coming
 * from constitution based on the installation, so it should be read only."*
 *
 * ⚠️ AND THE LABEL HAS TO SAY WHOSE THEY ARE, or "read-only" reads as "you cannot change your language" —
 * which is false. There are TWO locale concepts sharing words: the ENTITY's (country of business, the
 * currency it trades in — a fact about the business) and the PERSON's (what THIS reader reads, editable in
 * Settings). This block is the entity's.
 */
/**
 * ⚠️⚠️ TWO CONCEPTS WERE SHARING ONE VALUE, AND MY OWN TEXT TRIM MADE IT WORSE.
 *
 * These rows read Time zone and Number format out of CBLocale — which is the READER's setting, written by the
 * picker in Settings › Localisation. Under a heading called Business, beside Country of business, they said a
 * personal display preference was a fact about the company. The row that used to distinguish them was the
 * sentence *"From your installation. Your own reading language and formats are separate…"* — and I deleted it
 * an hour ago as explanation, which removed the only thing holding the two apart.
 *
 * ⭐ THE FIX IS NOT TO PUT THE SENTENCE BACK. It is to show the facts that ARE the business's, from the
 * ENTITY record: country and trading currency, both already on /entities/me. Time zone and number format
 * belong to the reader and live in Settings, where they can be changed — one owner per fact.
 *
 * ⚠️ AND THIS IS WHAT PASS 3 IS FOR. The duplication was not two labels saying the same thing; it was one
 * value answering two different questions, which no label-comparison would have found.
 */
/**
 * ⭐⭐ HOW THIS BUSINESS IS REACHED, ON THE SCREEN THAT ANSWERS THAT. Athi, 2026-08-20: *"channels, we setup in
 * settings, but it has to be exposed as the channel in profile? This is how this store is accessed."*
 *
 * ⭐ SAME TEST AS TRADE READY, SAME ANSWER. Settings › Channels is where you BIND a number and verify it — a
 * workbench. What belongs on a profile is the outward fact: the addresses a counterparty can actually reach.
 * The storefront link was already here answering half that question; the channels are the other half.
 *
 * ⚠️⚠️ A DECLARED CHANNEL IS NOT A WAY TO REACH ANYONE. status is declared|verified, and Settings already says
 * it plainly — "not confirmed yet: messages sent to this number reach nobody". Listing one here as though it
 * worked would put a false contact route on the screen a counterparty trusts, so it is shown as inactive
 * rather than hidden: hiding it would leave an owner wondering where their number went.
 */
function iamChannelRows(){
  var Q0 = String.fromCharCode(39);
  var cs = UI._chans;
  if (cs === undefined) return '';                    // not read yet — say nothing rather than "none"
  if (cs === null) return '';                         // the read failed — same rule as the network count
  /**
   * ⚠️⚠️ AN EMPTY LIST STILL RENDERS. It used to return nothing, so an owner who had not bound a number saw no
   * trace of the feature — indistinguishable from "not built". That is the same mistake as hiding a declared
   * channel, applied to the empty case: I reasoned that a business with no channels "has nothing to say here",
   * which is true of the DATA and false of the PERSON, who needs to know the row exists and how to fill it.
   */
  if (!cs.length) return '<div class="kv" style="margin-top:2px">'
    + '<span style="color:var(--grey)">' + tx('no channel yet') + '</span>'
    + ' <a href="#" onclick="navTo(' + Q0 + 'settings' + Q0 + ');setSetSec(' + Q0 + 'channels' + Q0 + ');return false" style="color:var(--blue);font-size:var(--fs-1);margin-inline-start:6px">'
    + tx('Add one in Channel settings') + ' <span class=arw>→</span></a></div>';
  var Q = String.fromCharCode(39);
  /* ⚠️ NO INNER HEADING. The section is called Channels; repeating it one line down reads as a rendering
     fault — the same reason the Regional block lost its own title when it was promoted. */
  return ''
    + cs.map(function(c){
        var ok = c.status === 'verified';
        return '<div class="kv" style="margin-top:3px">'
          + '<span style="color:' + (ok ? 'var(--ok-3)' : 'var(--grey)') + '">' + (ok ? '✓' : '○') + '</span> '
          + '<span class="mono">' + esc(c.address || '') + '</span>'
          + '<span style="color:var(--grey);font-size:var(--fs-1)"> · ' + esc(c.label || c.channel || '')
          + (ok ? '' : ' · ' + tx('not receiving yet')) + '</span></div>';
      }).join('')
    + '<div class="kv" style="margin-top:6px"><a href="#" onclick="navTo(' + Q + 'settings' + Q + ');setSetSec(' + Q + 'channels' + Q + ');return false" style="color:var(--blue);font-size:var(--fs-1)">'
    + tx('Channel settings') + ' <span class=arw>→</span></a></div>';
}

/** ⚠️ Latched, like the identity record and the trade summary — this repaints, and the renderer reads it. */
async function iamLoadChannels(){
  if (UI._chansLoaded) return;
  UI._chansLoaded = true;
  try {
    var r = await fetch(CFG.API_BASE + '/api/channels', { headers: { Authorization: 'Bearer ' + SESSION.token } });
    var j = r.ok ? await r.json() : null;
    /**
     * ⚠️⚠️ THE BOUND ADDRESSES ARE IN channels[].bindings[], NOT channels[]. I wrote
     *  from memory without reading lib/channels.js:  is the CATALOGUE OF
     * CHANNEL TYPES (whatsapp · email · sms · web) and each type carries its own bindings. So the profile was
     * rendering four type objects that have no address and no status — the same remembered-name mistake as
     * SESSION.identity_type, applied to an API contract instead of a variable.
     *
     * ⭐ AN API SHAPE IS A NAME LIKE ANY OTHER: reading it costs one minute, guessing it costs a screen that
     * silently shows nothing.
     */
    UI._chans = j && Array.isArray(j.channels)
      ? j.channels.reduce(function(all, t){ return all.concat(t.bindings || []); }, [])
      : null;
  } catch (_) { UI._chans = null; }
  renderApp(); _capShowDetail(); loadProfile();
}

/**
 * ⭐⭐ COUNTRY · CURRENCY · TIME ZONE · TIMESTAMP, IN ONE PLACE. Athi, 2026-08-20: *"country, currency,
 * timezone, timestamp — if all in one place in profile that would be great. We can take them to settings to
 * change it."*
 *
 * ⚠️⚠️ TWO OF THESE ARE THE BUSINESS'S AND TWO ARE THE READER'S, AND THAT IS WHY THEY WERE SPLIT AN HOUR AGO.
 * Country and currency come from the ENTITY record; time zone and timestamp format come from CBLocale, which
 * is this reader's own setting. Putting them together is right — a person wants to see the four facts at once
 * — but presenting them as one KIND of fact is what made Profile claim a personal preference was a company
 * fact in the first place.
 *
 * ⭐ SO THE MESSAGE LINE CARRIES THE DIFFERENCE, WHICH IS ATHI'S OWN CONVENTION: value first, message under it.
 * "Business" and "Yours" are two words that do what a paragraph did, and they are true at a glance.
 *
 * ⚠️ THE TIMESTAMP IS SHOWN AS AN EXAMPLE, NOT A FORMAT CODE. "en-IN" tells a reader nothing; the current
 * moment rendered the way their chits will be is the same fact, legible.
 */
/* ⚠️ A CODE IS NOT A LANGUAGE TO A READER. "ta" tells a person nothing; the endonym tells them everything,
   and seeing their own script is how they confirm the setting took. */
var _LANG_NAME = { en:'English', hi:'हिन्दी', ta:'தமிழ்', ar:'العربية', fr:'Français' };
function _langName(l){ var n = _LANG_NAME[l]; return n ? (n + ' (' + l + ')') : String(l || ''); }

/**
 * ⭐ A FLAG AND A SYMBOL, BOTH DERIVED — no asset, no lookup table to fall out of date. Athi, 2026-08-20:
 * *"under currency, we are not showcasing the currency symbol, country flag etc? Can we."*
 *
 * The flag is the ISO-3166 code as regional-indicator codepoints: IN → 🇮🇳. Any country that exists has one,
 * automatically, including ones added after this line was written.
 *
 * ⚠️⚠️ AND ON WINDOWS IT WILL RENDER AS "IN", NOT A FLAG. Windows ships no colour flag glyphs, so Chrome draws
 * the two letters — which is why this is an ADDITION beside the name and never a replacement for it. A flag
 * that silently degrades to a country code is fine; a flag REPLACING the code would show Athi two letters
 * where he expected a picture and nothing where he expected the code.
 */
function _flag(cc){
  var c = String(cc || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';   // only a 2-letter ISO code makes a flag; "India" does not
  try { return c.replace(/./g, function(ch){ return String.fromCodePoint(127397 + ch.charCodeAt(0)); }); }
  catch (_) { return ''; }
}

/**
 * ⚠️ NOT EVERY CURRENCY HAS A SYMBOL, and Intl says so honestly — AED formats as "AED". When the symbol IS the
 * code there is nothing to add, so nothing is added rather than printing "AED AED".
 */
function _curSym(cur){
  try {
    var p = new Intl.NumberFormat(CBLocale.locale ? CBLocale.locale() : 'en', { style: 'currency', currency: cur }).formatToParts(1);
    var c = p.find(function(x){ return x.type === 'currency'; });
    return (c && c.value && c.value !== cur) ? c.value : '';
  } catch (_) { return ''; }
}

/**
 * Do these two zones actually put the clock in a different place right now?
 *
 * ⭐ COMPARING NAMES IS WRONG — Asia/Calcutta === Asia/Kolkata, Europe/Kiev === Europe/Kyiv, and a dozen more
 * aliases besides. Comparing the RENDERED INSTANT answers the only question a reader has: will my timestamps
 * read differently from the business's? Two names for one zone answer "no", which is correct.
 */
function _tzDiffers(a, b){
  if (!a || !b) return false;
  if (a === b) return false;
  try {
    var t = Date.now();
    var f = function(z){ return new Intl.DateTimeFormat('en-GB', { timeZone: z, dateStyle: 'short', timeStyle: 'short' }).format(t); };
    return f(a) !== f(b);
  } catch (_) { return false; }   /* an unknown zone is not evidence of a difference */
}

function iamGovernedRows(e){
  var rows = [];
  var Q = String.fromCharCode(39);
  var country = (e && e.country) || null;
  try {
    var r = CBLocale.regionInfo && CBLocale.regionInfo();
    /* ⚠️ THE FLAG IS APPENDED, NEVER SUBSTITUTED — on Windows it renders as two letters, so the name must
       still be there. A flag that degrades to a country code is fine; one that REPLACES the name shows a
       reader two letters where they expected a picture and nothing where they expected the name. */
    /**
     * ⚠️⚠️ THE ENTITY'S COUNTRY, NEVER THE READER'S REGION. My first version preferred regionInfo().code — which
     * is the READER's region — so a UAE business showed the INDIAN flag to an Indian reader. The third time
     * today that a reader-side locale value was used for an entity-side fact, and the most visibly wrong:
     * currency and time zone disagree quietly, a flag disagrees in colour.
     *
     * ⭐ AND NO FLAG IS BETTER THAN THE WRONG FLAG. If the entity's country is stored as a NAME ("India") there
     * is no code to derive from, so nothing is drawn — borrowing the reader's would be inventing a fact about
     * someone else's business.
     */
    var _cc = (country && String(country).length === 2) ? country : null;
    rows.push(['Country', ((country || (r && r.name) || 'Not set') + ' ' + _flag(_cc)).trim(), '', false, 'biz', country ? 'biz' : 'def']);
  } catch (_) { if (country) rows.push(['Country', country, '', false, 'biz', 'biz']); }
  /**
   * ⚠️⚠️ CURRENCY AND TIME ZONE CAN CONTRADICT RIGHTS › BASICS, AND ATHI ASKED THE RIGHT QUESTION.
   *
   * Basics resolves currency, timezone and region from the INSTALLATION, bounded by the constitution
   * (lib/govresolve.js). Regional read them from the ENTITY ROW. Two sources, one word.
   *
   * ⚠️ AND identities.currency_code IS  WITH NOTHING IN THE APP EVER WRITING IT — no control,
   * no update path. So it is not the business's choice; it is an unset column showing a default. On any
   * non-INR installation the two screens disagree TODAY: Basics says AED, Regional says INR.
   *
   * ⭐ THE FIX IS THE RULE THIS SCREEN ALREADY FOLLOWS — one owner per fact. The governed value is the answer
   * unless this entity has explicitly chosen otherwise, and the message column says WHICH, so a reader is
   * never left comparing two numbers with no way to know which governs.
   */
  /**
   * ⚠️⚠️ THE GOVERNED VALUE WINS, AND MY FIRST ATTEMPT HAD IT BACKWARDS. I preferred the entity column and fell
   * back to governance — which never fires, because identities.currency_code is . The column
   * is ALWAYS truthy, so a UAE installation still showed INR beside Basics saying AED: the contradiction
   * Athi asked about, with a comment on top explaining it was fixed.
   *
   * ⭐ THE COLUMN CANNOT EXPRESS "NOT CHOSEN" — a default that is a real value is indistinguishable from a
   * decision. And nothing in the app ever WRITES it: there is no control, no update path. So it is not a
   * choice today, and the governed value is the answer until something makes it one.
   */
  /**
   * ⭐⭐ REGION BOUNDS THE SET; THE ENTITY PICKS ONE. Athi, 2026-08-20: *"if the region changes, can it have
   * different currency? Under region there can be MULTIPLE currencies, one of the currency will be chosen."*
   *
   * ⚠️ I HAD THIS WRONG TWICE. First the entity column won — which never fires, because currency_code is
   * DEFAULT INR and always truthy. Then governance won — which removes the choice Athi is describing. The
   * model is neither: the CONSTITUTION names what is permitted, and the entity picks from inside it.
   *
   * ⭐ SO THE ROW IS A CONTROL ONLY WHEN THERE IS A CHOICE. One permitted currency is a fact and renders as a
   * fact; two or more is a decision and renders as a picker. A select with one option is a control that
   * cannot be used — the same false affordance as a link to a closed shop.
   */
  var gb  = (e && e.governance && e.governance.basics) || {};
  var gal = (e && e.governance && e.governance.allowed) || {};
  var perm = Array.isArray(gal.currencies) ? gal.currencies : null;
  /**
   * ⚠️⚠️ PRECEDENCE FOLLOWS WHETHER A CHOICE EXISTS AT ALL — that is the piece both my earlier attempts missed.
   *   · the layer permits SEVERAL  → the entity's pick wins; it is a decision
   *   · the layer permits ONE      → that one; there is nothing to decide
   *   · the layer permits NOTHING EXPLICIT → the governed value wins, because the column is DEFAULT INR and
   *     never written, so it is not a choice — it is a default masquerading as one. This is the case that
   *     made Rights say AED and Regional say INR on the same screen.
   */
  var hasChoice = !!(perm && perm.length > 1);
  var curr = hasChoice ? ((e && e.currency_code) || gb.currency || null)
                       : (gb.currency || (e && e.currency_code) || null);
  /* ⚠️ A STORED VALUE OUTSIDE THE ENVELOPE IS NOT SILENTLY SUBSTITUTED — it is named, because a business
     trading in a currency its layer no longer permits needs to know, not to have it quietly corrected. */
  /* ⚠️ THE STORED VALUE, NOT THE RESOLVED ONE. Checking  could never fire once governance won the
     precedence — so a business whose saved currency is no longer permitted would have been silently shown the
     permitted one and never told. The question is about what THEY hold, not what we chose to display. */
  var stored  = (e && e.currency_code) || null;
  var outside = !!(perm && perm.length && stored && perm.indexOf(stored) < 0);
  /**
   * ⭐⭐ A FACT, NOT A CONTROL — THE PICKER THAT WAS HERE IS NOW IN SETTINGS. Athi, 2026-08-21: *"why have we
   * brought the currency to choose here? Let it be in settings only."*
   *
   * ⚠️ HE HAD ALREADY GIVEN THE RULE AND THIS ROW BROKE IT: *"settings is where we can change the value,
   * profile is the personal preference — settings snapshot."* One editable <select> in a column of read-only
   * rows also reads as an accident, because the eye takes a control as permission and every neighbour said no.
   *
   * ⚠️ AND IT WAS WRITING TO THE WRONG ROW ANYWAY. PATCH /profile writes req.identity.identity_id — the
   * CALLER'S record — so a co-assist changing 'the business currency' landed it on their own actor row, where
   * nothing reads it. The screen said saved, the business still priced in the old currency. Same shape as the
   * user_id theft, minus the global name: the API now refuses it outright (CURRENCY_ENTITY_ONLY).
   */
  var stored  = (e && e.currency_code) || null;
  var outside = !!(perm && perm.length && stored && perm.indexOf(stored) < 0);
  if (curr) {
    /* ⚠️ LABELLED BY WHERE THE VALUE CAME FROM, not by whether a list exists. With no allowed set the governed
       value wins — and calling that "Business" was the original lie in a new place. */
    var fromGov = (curr === gb.currency && curr !== stored) || (!stored && !!gb.currency);
    /* ⭐ SYMBOL BESIDE THE CODE — '₹ INR'. The code is what a system needs; the symbol is what a person
       recognises. Neither replaces the other, and not every currency has one (AED formats as AED). */
    rows.push(['Currency', esc((_curSym(curr) ? _curSym(curr) + ' ' : '') + curr) + _locLink(tx('Currency'), 'loc-currency'),
      outside ? txf('{cur} no longer permitted', { cur: stored }) : '',
      true, 'biz', fromGov ? 'gov' : 'biz']);   /* ⚠️ blank where the GROUP HEADING already says it — the message column is for exceptions only */
  }
  /**
   * ⚠️⚠️ THE ZONE IS THE BUSINESS'S, AND THE READER'S IS THE FALLBACK — NOT THE OTHER WAY ROUND.
   * Athi, 2026-08-20: *"how come it is mine? It is entity's timezone and currency, country, clock."* He is
   * right, and the code could not say so: identities had no timezone until b176. A chit is a shared record —
   * "received 19:00" must mean one instant with one reading inside a business, or two colleagues discussing
   * the same chit are discussing different times.
   *
   * ⚠️ WHEN b176 HAS NOT RUN, OR NOBODY HAS PICKED ONE, IT SAYS SO. Showing the reader's zone under a
   * "Business" label would be the original mistake with a better label on it.
   */
  var bizTz = (e && e.timezone) || null;
  try {
    /* ⚠️ SAME THREE-WAY ANSWER AS CURRENCY: the entity's own zone if b176 gave it one, else the governed zone
       from the installation, else this device — each labelled, so Rights and Regional can never look like two
       opinions about one fact. */
    if (bizTz) rows.push(['Time zone', bizTz, '', false, 'biz', 'biz']);
    else if (gb.timezone) rows.push(['Time zone', gb.timezone, '', false, 'biz', 'gov']);
    else if (CBLocale.timezone) rows.push(['Time zone', CBLocale.timezone(), tx('your device — not set for the business'), false, 'biz', 'def']);
    /* ⚠️ A LIVE EXAMPLE, so a wrong setting is obvious rather than encoded. */
    /* ⚠️ THE TIMESTAMP FORMAT IS STILL THE READER'S, AND SAYING OTHERWISE WOULD BE A LIE. b176 stores the
       business's ZONE; every date on every screen still renders through CBLocale. Redirecting that is a
       deliberate change across the whole app, not a side effect of adding a column — so the label states what
       is true today rather than what the design intends. */
    /**
     * ⭐⭐ LANGUAGE AND DIRECTION JOIN THIS GROUP. Athi, 2026-08-20: *"under regional, language and read
     * right-to-left or left-to-right settings, under 'how you read it' title — the title can be separate so it
     * can show the preferred language, 1, 2 and 3."*
     *
     * ⚠️ DIRECTION IS NOT A SETTING, IT IS A CONSEQUENCE. CBLocale.dir() derives it from the language via
     * Intl.Locale.getTextInfo — Arabic reads right-to-left because it is Arabic, not because someone ticked a
     * box. Offering it as a choice would let a person set a combination no language on earth uses, which is
     * the same reasoning that keeps number grouping tied to the region.
     *
     * ⭐ AND THE ORDER IS THE MEANING. 1, 2, 3 is a fallback chain (RFC 4647): show me Tamil, else Hindi, else
     * English. Rendering them as an unordered list would lose the only thing that distinguishes them.
     */
    var _langs = (CBLocale.langs ? CBLocale.langs() : [CBLocale.lang && CBLocale.lang()]).filter(Boolean);
    _langs.forEach(function(l, i){
      rows.push([(i === 0 ? tx('Language') : ' ') + ' ' + (i + 1), _langName(l), (i === 0 ? tx('first choice') : tx('then')), false, 'read',
        /**
         * ⚠⚠ 'IS cb_langs SET' IS NOT 'DID YOU CHOOSE IT'. setRegion() WRITES the language list as a side
         * effect — pick India and cb_langs becomes ['en'] without anyone touching a language control. Testing
         * for the key's presence therefore marked every reader's languages as their own choice, which is the
         * precise lie this mark exists to prevent: it would send someone hunting for a decision they never made.
         *
         * ⭐ SO IT IS DERIVED BY COMPARISON, not by a flag. Still the region's own first language, alone? That
         * is the default. Anything else — a second language, a different first — required a human to act.
         */
        _langsAreDefault() ? 'def' : 'you']);
    });
    if (CBLocale.dir) /* ⚠️ NO MARK. Direction is not derived from a SOURCE, it is derived from the language — there is no layer
       that could have set it and no choice a reader could make. Marking it 'Default' would invite someone to
       look for the control that overrides it. */
    rows.push(['Reads', CBLocale.dir() === 'rtl' ? tx('right to left') : tx('left to right'), tx('follows the language'), false, 'read']);
    /**
     * ⚠️⚠️ THE READER'S ZONE BELONGS IN THIS GROUP, and leaving it out is what made Settings look broken.
     * Athi, 2026-08-21: *"when I click the language and formats hyperlink it goes to settings, but it shows
     * something different from what is there in the profile."*
     *
     * Measured: changing the zone in Settings moved the profile TIMESTAMP (07:11 → 02:41, the same instant in
     * London) while the row labelled TIME ZONE went on saying Asia/Kolkata. Both were correct — that row is
     * the BUSINESS's clock (b176) and the picker sets the READER's device — but a person who changes a
     * setting called Time zone and watches a row called Time zone not move concludes the save failed.
     *
     * ⭐ SO THE TIMESTAMP NAMES THE ZONE IT IS RENDERED IN, and only when it differs from the business's.
     * When they agree there is nothing to disambiguate and a second zone row would be noise; when they differ,
     * that difference is the explanation for a timestamp that just moved.
     */
    var _readTz = (CBLocale.timezone && CBLocale.timezone()) || null;
    var _bizTz2 = (e && e.timezone) || null;
    /**
     * ⭐⭐ THE REGION THE SAMPLES ARE WRITTEN FOR, NAMED. Athi, 2026-08-21, holding the two screens side by
     * side: *"still looks different — one from profile and another one from settings?"* Profile said COUNTRY:
     * IN; Settings said PRESENTATION: United States. Both correct, and together they read as a bug.
     *
     * ⚠⚠ THEY ARE TWO DIFFERENT FACTS WEARING SIMILAR NAMES. `Country` is identities.country — where the
     * BUSINESS is. `Region` is cb_region — how THIS READER wants figures written. A business in India read by
     * someone on a US-configured device is a perfectly ordinary state, and nothing on the profile said so: the
     * only evidence was 12,345,678.9 grouping the American way under a row that said IN.
     *
     * ⚠️ I HAD ALREADY FIXED THIS EXACT SHAPE FOR THE TIME ZONE and did not generalise it. The timestamp
     * names its zone when it differs from the business's; the number format named nothing at all. My own
     * alignment guard called Region 'demonstrated — drives every sample', which is too weak a standard: a
     * sample proves the EFFECT and never lets a reader check the SETTING. It is NAMED now, and the guard says so.
     *
     * ⚠️ THE NOTE APPEARS ONLY WHEN THEY DIFFER. When the reader's region and the business's country agree
     * there is nothing to disambiguate, and a permanent line explaining a non-difference is the text budget
     * being spent on nobody.
     */
    try {
      var _fr   = CBLocale.region && CBLocale.region();
      var _fri  = CBLocale.regionInfo && CBLocale.regionInfo();
      var _ftag = CBLocale.tag ? CBLocale.tag() : (CBLocale.locale && CBLocale.locale());
      /* ⚠️ THE BASE TAG ONLY. en-IN-u-fw-sun-nu-deva is a machine's answer to a human's question; every -u-
         extension is spelled out in the note beside it, so showing both would be the same fact twice, once
         illegibly. split('-u-')[0] rather than a regex — the separator is literal and fixed by BCP 47. */
      if (_ftag) _ftag = String(_ftag).split('-u-')[0];
      if (_fr || _ftag) {
        var _fname = (_fri && _fri.name) || _fr || '';
        /**
         * ⭐⭐ AND THE THREE SETTINGS THAT HAD NO NAME ANYWHERE RIDE HERE. Athi, 2026-08-21: *"even the
         * numbering system etc shows wrong."* They were not wrong — measured, `nu=deva` really does render
         * १,२३,४५,६७८.९ and `ca=indian` really does render 30 Sravana. They were UNNAMED: a reader who chose
         * Devanagari digits saw them under a row called NUMBERS with nothing saying which setting did that.
         *
         * ⚠️ ONE LINE, NOT THREE ROWS. Numbering system, hour cycle and calendar are each a rarely-touched
         * refinement of the same question this row already answers. Three permanent rows would spend the text
         * budget on settings almost nobody changes and push the group past six; one note, listing only what was
         * actually overridden, costs nothing when nothing was.
         *
         * ⚠️ AND ONLY OVERRIDES — the region's own defaults are already visible in the samples below. Naming
         * a default is not information, it is noise that makes the real choices harder to spot.
         */
        var _ov = [];
        try {
          if (CBLocale.getExt) {
            var _nu = CBLocale.getExt('nu'), _hc = CBLocale.getExt('hc'), _ca = CBLocale.getExt('ca');
            if (_nu) _ov.push(_locName(NUMERALS, _nu));
            if (_hc) _ov.push(_locName(HOURS, _hc));
            if (_ca) _ov.push(_locName(CALS, _ca));
            /* ⚠️ FIRST DAY OF WEEK WAS 'NAMED' ONLY AS THE SUBTAG -u-fw-sun INSIDE en-IN-u-fw-sun. That is
               named the way a licence plate names a car: technically identifying, unreadable by the person
               who set it. It says 'Week starts Sunday' now, and the tag below drops its -u- extensions. */
            var _fw = CBLocale.getExt('fw');
            if (_fw) _ov.push(txf('week starts {d}', { d: _locName(WEEK, _fw) }));
          }
        } catch (_) { /* no ext layer — the row still names the region */ }
        var _diff = (_fr && country && String(_fr).toUpperCase() !== String(country).toUpperCase())
          ? txf('your device — the business is in {c}', { c: country }) : '';
        /* ⚠️ THE ARROW POINTS AT THE REGION PICKER, the control that decides most of this row — and the
           override names in the note each carry their own, so 'Devanagari →' lands on the numeral picker
           rather than making the reader guess which of six controls produced it. */
        var _fval = esc(_fname ? _fname + (_ftag ? ' (' + _ftag + ')' : '') : _ftag) + _locLink(tx('Region'), 'loc-region');
        rows.push(['Format', _fval,
          [_diff].concat(_ov).filter(Boolean).join(' · '),
          true, 'fmt', (CBLocale.region() || (CBLocale.getExt && CBLocale.getExt('locale'))) ? 'you' : 'def']);
      }
    } catch (_) { /* absent locale layer — the samples below still speak for themselves */ }
    if (CBLocale.datetime) rows.push(['Timestamp', esc(CBLocale.datetime(Date.now())) + _locLink(tx('Time zone'), 'loc-tz'),
      /**
       * ⚠️ THE COMPARISON IS THE CLOCK, NOT THE NAME. Asia/Calcutta and Asia/Kolkata are THE SAME ZONE under a
       * legacy alias, and a string compare called them different — so the note claimed a reader was on another
       * clock when they were not. The note exists to explain a timestamp that DIFFERS; if the two zones render
       * the same instant identically there is nothing to explain, whatever they are called.
       */
      _tzDiffers(_readTz, _bizTz2) ? txf('shown in {tz} — your device', { tz: _readTz }) : '',
      true, 'fmt']);   /* ⚠️ isHtml — the value now carries the jump-to-control arrow */
    /* ⭐ NUMBERS, AS AN EXAMPLE FOR THE SAME REASON AS THE TIMESTAMP. India groups 12,34,56,789 and the US
       groups 123,456,789 — a reader recognises their own grouping instantly and would have to decode
       'en-IN'. Athi: *"number system also."* */
    if (CBLocale.number) rows.push(['Numbers', esc(CBLocale.number(12345678.9)) + _locLink(tx('Numbering system'), 'loc-nu'), '', true, 'fmt']);
    else if (CBLocale.locale) rows.push(['Numbers', esc((12345678.9).toLocaleString(CBLocale.locale())) + _locLink(tx('Numbering system'), 'loc-nu'), '', true, 'fmt']);
    /**
     * ⭐⭐ THEME AND TEXT SIZE JOIN "HOW YOU READ IT" — because that is literally what they are. Athi,
     * 2026-08-21: *"under profile, personal preference the colour scheme and the size of the char, say 75%,
     * 100% etc. can be shown, set? That brings all in one place."*
     *
     * ⚠️ THE CONTROLS ALREADY EXIST — Settings › Appearance has both, and the size is already expressed as a
     * percentage. So this is not a second control; it is the same answer, shown where a person is already
     * reading their other reading preferences. Two pickers for one setting is how a screen disagrees with
     * itself, which is what the goods/services pointer avoided an hour ago.
     *
     * ⭐ AND THE PERCENTAGE IS THE USEFUL PART. "Large" means nothing next to "Default"; 115% says how much.
     */
    /**
     * ⭐⭐ THE SNAPSHOT MUST COVER EVERY SETTING, OR IT IS NOT A SNAPSHOT. Athi, 2026-08-21: *"settings is where
     * we can change the value, profile is the personal preference — settings snapshot, and it has to be
     * aligned. Check for all the values in settings."*
     *
     * ⚠️ SETTINGS CAN CHANGE NINE THINGS; THIS NAMED FOUR. Region, format, languages, numbering system, hour
     * cycle, calendar, first day of week, working days, time zone. Numbering, hour cycle and calendar are
     * DEMONSTRATED by the Timestamp and Numbers samples — a reader sees ١٢٣ or a 24-hour clock without being
     * told the setting's name. But WORKING WEEK appears in no sample at all, so a person could set it and
     * find no trace of it here.
     *
     * ⭐ SO: demonstrated is enough for a format; invisible is not. The working week gets a row.
     */
    try {
      if (CBLocale.workdays) {
        var _D = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 7:'Sun' };
        var _wd = CBLocale.workdays() || [];
        if (_wd.length) rows.push(['Working week', esc(_wd.map(function(d){ return _D[d] || d; }).join(' ')) + _locLink(tx('Working days'), 'loc-workdays'),
          '',
          true, 'fmt', (CBLocale.hasWorkdayOverride && CBLocale.hasWorkdayOverride()) ? 'you' : 'def']);
      }
    } catch (_) { /* absent locale layer — show what we have */ }

    try {
      if (typeof THEMES !== 'undefined' && typeof themeGet === 'function') {
        var _th = THEMES[themeGet()] || {};
        rows.push(['Theme', esc(_th.name || themeGet()) + _locLink(tx('Theme'), 'theme-' + themeGet(), 'appearance'), _th.a11y ? txf('meets WCAG {level}', { level: _th.a11y.level }) : '', true, 'look', 'you']);
      }
      if (typeof TEXT_SIZES !== 'undefined' && typeof textSize === 'function') {
        var _ts = TEXT_SIZES.filter(function(x){ return x[0] === textSize(); })[0];
        if (_ts) rows.push(['Text size', esc(_ts[1] + ' · ' + Math.round(_ts[2] * 100) + '%') + _locLink(tx('Text size'), 'ap-fs-' + textSize(), 'appearance'), '', true, 'look', 'you']);
      }
    } catch (_) { /* appearance layer absent — show what we have rather than nothing */ }
  } catch (_) { /* locale layer absent — show what we have rather than nothing */ }

  if (!rows.length) return '';
  /**
   * ⭐⭐ THE GROUP IS CALLED "REGIONAL". Athi, 2026-08-20: *"that group, how do we call it? Any industry
   * standard name for it, other than locale?"*
   *
   * LOCALE is the engineering word — POSIX, CLDR, ICU, Intl — and it is precise, which is why it is in the
   * code and not on the screen. REGIONAL is what the same set is called wherever a person meets it: Windows
   * "Region and language", macOS "Language & Region", Android "Regional preferences". A word people have
   * already learned somewhere else costs nothing to learn here.
   *
   * Rejected: "Jurisdiction" (already means the governance layer in this product — a collision), "Formatting
   * conventions" (CLDR's own phrase, and four syllables of nobody's vocabulary), "Territory" (CLDR's word
   * for the country alone, so it under-names the group).
   */
  /* ⚠️ NO TOP RULE OR MARGIN NOW — those separated it from the licence rows it used to sit under. A section
     already has its own frame, and a divider inside one reads as a second, emptier section. */
  /**
   * ⭐⭐ TWO TITLED GROUPS, NOT A SOURCE COLUMN ON EVERY ROW. Athi, 2026-08-20: *"under 'how you read it'
   * title — the title can be separate."*
   *
   * The message column was doing a heading's job one row at a time: "Business, Business, Business, How you
   * read it, How you read it". A heading says it once and groups what it governs, which is what a person is
   * actually scanning for — whose fact is this, and can I change it.
   *
   * ⚠️ THE PER-ROW MESSAGE SURVIVES WHERE IT SAYS SOMETHING THE HEADING CANNOT — "Set above you" on a currency
   * the layer chose, "no longer permitted" on one it has withdrawn, "first choice / then" on the language
   * chain. A heading cannot carry an exception.
   */
/**
 * One Regional row. Athi, 2026-08-20: *"if the comment takes space bring it underneath."*
 *
 * ⭐⭐ THAT IS HIS OWN CONVENTION, APPLIED CONSISTENTLY — value first, message beneath it, settled on the
 * governance boxes ("base@v1" then "Platform set"). Here the message sat in a right-hand column instead,
 * competing with the value for width on a narrow screen and pushing "no longer permitted" onto its own line
 * anyway. Underneath, it costs nothing horizontally and reads in the order a person needs it: what it is,
 * then whose it is.
 */
/* ⭐ Regional rows go through the SAME renderer as every other profile row — see profRow. x[3] flags markup. */
/* ⚠️ x[4] IS THE GROUP, x[5] THE SOURCE — positional, because these rows are built by twenty push() calls
   across three hundred lines and converting them all to objects is a change with no test behind it. The
   cost is that a row written with four elements gets no mark, which _srcMark answers with silence. */
var rowHtml = function(x){ return profRow(x[0], x[1], x[2], !!x[3], x[5]); };
  /**
   * ⚠️ A HEADING MUST NOT LOOK LIKE A ROW LABEL. Athi, 2026-08-20: *"can you make indentation or size
   * difference or underline for the heading — some difference should be there between heading and text."*
   *
   * It was uppercase-small-grey — the SAME treatment as the row labels beside it — so "BUSINESS" and
   * "COUNTRY" read as two items in one list rather than a group and its contents. Three differences now,
   * because on a dense screen one is easy to miss: it is LARGER, it carries a RULE beneath it, and the rows
   * are INDENTED under it. Contrast is already measured by a11y-contrast; hierarchy was not measured by
   * anything, which is why it drifted.
   */
  /* ⭐ and the SAME group heading — see profGroup. */
  var grp = function(title, list){ return list.length ? profGroup(title, list.map(rowHtml).join('')) : ''; };
  return '<div>'
    /* ⚠️ THE IN-BLOCK 'Regional' HEADING WENT WITH THE PROMOTION — the section header says it now, and a
       title repeated immediately under itself reads as a rendering fault. */
    /**
     * ⭐⭐ FOUR SMALL GROUPS, NOT TWO WITH ONE OF THEM SEVEN ROWS LONG. Athi, 2026-08-21: *"a small list is
     * always good, human brain cannot take multiple things in one go — so small groups like identity, business;
     * if too many in one single group, split it with a subgroup."*
     *
     * ⚠️ 'How you read it' HAD BECOME A DRAWER. It started as language and direction — two rows that genuinely
     * belong together — and then timestamp, numbers, working week, theme and text size were each added to it
     * because it was the group that existed. Seven unrelated rows under one heading is a list, which is the
     * thing the heading was there to prevent.
     *
     * ⚠️ THE SPLIT IS BY QUESTION ANSWERED, NOT BY ROW COUNT. Cutting seven at the midpoint would produce two
     * groups nobody could name; the test of a real group is that its heading is a question a reader would ask —
     * where are you · what language · how are values written · how does it look.
     *
     * ⚠️ ONE TABLE DRIVES IT, so a fifth group is a line here plus a key on the row — not a fourth copy of
     * .filter(r[4] === '…'), which is how the drawer formed in the first place.
     */
    + [['biz',  tx('Business')],
       ['read', tx('How you read it')],
       ['fmt',  tx('How values are written')],
       ['look', tx('How it looks')]]
      .map(function(g){
        /* ⚠️ 'biz' MATCHES AN ABSENT KEY TOO — a row pushed without a group must land somewhere visible,
           not vanish because a five-element array was written with four. */
        return grp(g[1], rows.filter(function(r){ return (r[4] || 'biz') === g[0]; }));
      }).join('')
    /* ⭐ ONE LINK OUT, NOT FOUR. Athi: *"we can take them to settings to change it."* */
    /* ⚠️ TWO DESTINATIONS, BECAUSE THE GROUP HAS TWO OWNERS. Language and formats are set in Localisation;
       theme and text size in Appearance. One link would send half the readers to the wrong screen, and a
       link that lands you somewhere without the control you came for is worse than no link. */
    + '<div style="margin-top:9px;display:flex;gap:14px;flex-wrap:wrap">'
    +   '<a href="#" onclick="navTo(' + Q + 'settings' + Q + ');setSetSec(' + Q + 'locale' + Q + ');return false" style="color:var(--blue);font-size:var(--fs-1)">'
    +   tx('Language and formats') + ' <span class=arw>→</span></a>'
    +   '<a href="#" onclick="navTo(' + Q + 'settings' + Q + ');setSetSec(' + Q + 'appearance' + Q + ');return false" style="color:var(--blue);font-size:var(--fs-1)">'
    +   tx('Theme and text size') + ' <span class=arw>→</span></a>'
    /* ⚠️ WITH THE TWO LINKS, NOT ABOVE THE ROWS. This line answers a question about the rows rather than
       being one of them; putting it at the top would make every reader step over it to reach the content they
       came for, which is the cost the opt-in exists to avoid. */
    +   profSrcBtn()
    + '</div>'
    + '</div>';
}

/** The boundary badge. ⚠️ Same three words everywhere, so the spine is learnable in one read. */

/* ══ WHO ════════════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ iamWhoHTML and iamAccessHTML LIVED HERE and were removed 2026-08-19. They rendered the old "who can
 * act" and "what access" panes, which the four IAM tabs replaced — orphaned by my own restructure, and
 * found by e2e/dead-surface.cjs rather than by me remembering.
 */
/* namingRulesHTML lived here — removed with its only caller (the dead __iam_old branch). It was the table
 * that explained what a Bridge ID is, and that is the explanation Athi asked to remove everywhere. */
/* ⚠️ AN ASYNC SECTION PAINTS ITS OWN END MARKER. "— end —" says the panel is complete; appended here it landed
   directly under the vault's "loading…", telling the reader they had seen everything while nothing had arrived.
   The vault is the only section whose body is a placeholder rather than its content — see loadVault(). */
function profSecHTML(k, e){
  var b = _profSecBody(k, e);
  if (!b) return '';
  return k === 'vault' ? b : (b + _capEnd());
}
function _profSecBody(k, e){
  if (k === 'identity') return iamHTML(e);
  /* ⚠️⚠️ THE __iam_old BRANCH WAS DELETED HERE, AND IT TOOK namingRulesHTML WITH IT.
     No section key is ever '__iam_old' — PROF_SECS has identity/storefront/governance/vault — so this was
     unreachable, and it was the ONLY caller of namingRulesHTML. That table explained what a Bridge ID is,
     which is precisely the information Athi asked to stop showing anywhere: *"in fact this information
     should not be appearing anywhere."* Removing a dead branch and finding it was the last thing keeping a
     whole explanatory table alive is the same cascade dead-surface caught on 2026-08-19. */
  /**
   * ⚠️⚠️ THE storefront / governance / vault BRANCHES WERE DELETED HERE — all three unreachable.
   *
   * profSec() only ever returns 'identity' now: the rail that set it is gone and its four panels live as
   * sections inside iamHTML. Leaving the branches would have left THREE renderers for three screens that are
   * rendered elsewhere, and the next person to change the Storefront would have had even odds of editing the
   * dead one.
   *
   * ⚠️ THE CUSTOMER-ACCESS MODE WAS CARRIED ACROSS FIRST. storefrontCardHTML held 
   * (browse-first vs login-first) and nothing else did — deleting this branch before moving that control
   * would have removed a real setting silently, which is exactly how the localisation rows nearly went.
   */
  return '';
}
// "Your governance" — the entity's resolved governance (from attributes): where it's minted, its platform, its basics
// (with provenance ⟵ platform), rights + allowances + jurisdiction. Entity-simple; honest "minted, not enforced yet".
/**
 * The resolved-governance card — as BOXES, not a stack of key-value lines.
 *
 * Athi, 2026-08-20: *"your governance, can we make it as boxes, with gaps, more presentable."*
 *
 * ⭐⭐ AND THE GRID IS NOT DECORATION — IT IS THE CONTENT. These are five independent facts that happen to
 * arrive together: who governs you, where you run, what you may do, how much, and under whose law. Stacked as
 *  rows they read as one paragraph with bold bits, and a reader scanning for their
 * rights has to read the allowances to get there. One box per fact makes them separately findable, which is
 * what a person actually does with this card.
 *
 * ⚠️ EMPTY BOXES ARE NOT RENDERED. A grid of "—" would be a promise of five facts and delivery of two; a box
 * appears only when there is something in it, so the card is honest about how much is resolved.
 */
function govCardHTML(g){
  if(!g) return '';
  var inst=g.installation||{}, b=g.basics||{}, j=g.jurisdiction||{};
  var caps=(g.capabilities||[]).map(function(c){return '<span class="optchip" style="background:var(--blue-tint);color:var(--blue-d);border-color:var(--blue-tint-line)">'+esc(c)+'</span>';}).join(' ');
  var allow=(g.allowances||[]).map(function(a){return esc(a.limit+' '+a.resource);}).join(' · ');
  var langs=(b.languages||[]).join(', ');
  var loc=[inst.cloud,inst.region,inst.zone].filter(Boolean).join(' · ');

  /* ⚠️ EACH BOX NAMES ITS INK BECAUSE IT PAINTS ITS GROUND — guard check 11. */
  var box=function(label, value, sub){
    if(!value) return '';
    return '<div style="flex:1 1 200px;min-width:0;padding:11px 13px;border:1px solid var(--line);border-radius:11px;'
      + 'background:var(--paper);color:var(--on-bg)">'
      + '<div style="font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.05em;color:var(--grey);font-weight:600">' + esc(label) + '</div>'
      + '<div style="margin-top:4px;font-size:var(--fs-2);line-height:1.5">' + value + '</div>'
      + (sub ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">' + esc(sub) + '</div>' : '')
      + '</div>';
  };

  var boxes = [
    /**
     * ⭐⭐ THE VALUE FIRST, THE MESSAGE UNDER IT. Athi, 2026-08-20: *"any message you want to provide, that has
     * to be below the value — base@v1, and then platform set. It has to be shown separately as a message… in
     * principle we settle this way."*
     *
     * ⚠️ SO THE VERSION IS PART OF THE VALUE, NOT THE MESSAGE. "base@v1" is one identifier — splitting the @v1
     * into the grey line below would make the version look like commentary about the constitution rather than
     * part of its name, and a rights question is always about a specific version. The message line is reserved
     * for WHERE IT CAME FROM, which is the only thing a reader cannot see by looking at the value.
     */
    box(tx('Governed by'),
        esc(g.constitution || '') + (g.constitution_version ? esc('@' + g.constitution_version) : ''),
        tx('Platform set')),
    box(tx('Installation'), esc(inst.label||inst.key||''), loc),
    box(tx('Basics'), [b.currency, b.timezone, langs].filter(Boolean).map(esc).join(' · '), tx('Platform set')),
    box(tx('Rights'), caps, tx('Cascaded to you')),
    box(tx('Allowances'), allow ? esc(allow) : '', tx('Cascaded to you')),
  ].filter(Boolean).join('');

  if(!boxes) return '';
  return '<div style="display:flex;flex-wrap:wrap;gap:9px">' + boxes + '</div>'
    + (j.disclaimer ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:9px;line-height:1.5">' + esc(j.disclaimer) + '</div>' : '');
}
/**
 * ⭐⭐ ONE SAVE PER SECTION. Athi, 2026-08-20: *"if each section has to have a separate save button to do so."*
 *
 * ⚠️⚠️ AND IT FIXES A LIVE BUG STRUCTURALLY RATHER THAN DEFENSIVELY. One button at the bottom read fields from
 * every section — but iamSection renders its body ONLY WHEN OPEN, and val() returns "" for a missing element.
 * The API declares `business_status: optional().isIn(['open','closed','away'])`, and "" is not undefined, so
 * .optional() does not skip it and isIn rejects it: collapse Storefront, edit your name, press Save → 400
 * Validation failed, on a field the person never touched and could not see. gstn and address escaped only
 * because the UPDATE happens to COALESCE them.
 *
 * ⭐ A save that belongs to a section can only ever send that section's fields — the whole class of bug goes
 * away rather than being guarded against, and the button now sits where the reader's attention already is.
 */
var PROF_FIELDS = {
  ident:    [['pf_name', 'display_name'], ['pf_uid', 'user_id']],
  profile:  [['pf_gstn', 'gstn'], ['pf_addr', 'address'], ['pf_sup', 'supplies']],
  governed: [['pf_bs', 'business_status'], ['pf_vis', 'catalogue_visibility'], ['pf_sfaccess', 'storefront_access']],
  /* ⚠️ REGIONAL SAVES NOTHING NOW, AND THE EMPTY ARRAY IS THE POINT. Its one control (pf_cur) moved to
     Settings; leaving ['pf_cur','currency_code'] here would make profDirtySections read an element that no
     longer exists, and the section would offer a Save button with nothing behind it. A read-only section is
     an honest one — it says the value is decided elsewhere. */
  regional: [],
};

/**
 * ⚠️ ACCESS-AWARE. Athi: *"it should work perfectly for each different access."* Only the business itself may
 * write its own profile — routes/entities.js writes req.identity.identity_id, so a co-assist saving here would
 * quietly write gstn and address onto their OWN actor row, where nothing reads them. An employee cannot reach
 * this screen today (loadProfile routes them to loadActorProfile), but a button that would silently misfile
 * data must not exist on the strength of a route that might change.
 */
function profCanEdit(){ return !(typeof SESSION !== 'undefined' && SESSION && SESSION.actorId); }

function profSaveBtn(sec){
  if (!profCanEdit()) return '';
  var Q = String.fromCharCode(39);
  return '<div class="err" id="pf_err_' + sec + '" style="margin-top:8px"></div>'
    + '<button class="composebtn" data-testid="prof-save-' + sec + '" style="margin-top:6px" '
    +   'onclick="saveProfile(' + Q + sec + Q + ')">' + tx('Save') + '</button>';
}

/* ════ UNSAVED CHANGES ════════════════════════════════════════════════════════════════════════════════════
 *
 * Athi, 2026-08-20: *"if the user edit something and came out without saving, we have to ask confirmation —
 * you have edited but not saved — and a confirmation message for both save and cancel."*
 *
 * ⭐⭐ THE SNAPSHOT IS TAKEN FROM THE DOM AT RENDER, NOT FROM THE SERVER PAYLOAD. Comparing against `e` would
 * call a field dirty whenever the server normalised it — an address the API trimmed, a status it defaulted —
 * so a person who typed nothing would be asked to save nothing. What was ON THE SCREEN is the only honest
 * baseline for "did you change it".
 *
 * ⚠️ AND IT MUST SURVIVE A REPAINT. iamToggle re-renders the whole panel, so the snapshot is re-taken after
 * every paint; a snapshot captured once at load would go stale on the first collapse and report every
 * subsequent edit as clean.
 */
var _profSnap = {};

/**
 * ⭐⭐ SETTINGS GETS THE SAME GUARD, FROM THE SAME FUNCTIONS. Profile lost work silently until today; Settings
 * still can — three of its sections need a Save (Work, Auto-assign, Documents) and clicking another rail row
 * discards whatever was typed. The policy flags and channels apply on change and have nothing to lose, so
 * they are deliberately not listed: a guard that fires for controls which cannot lose work would be the same
 * false affordance as a link to a closed shop.
 *
 * ⚠️ THE HELPERS TAKE A FIELD MAP RATHER THAN BEING COPIED. A second snapshot/dirty pair would drift from the
 * first the moment either changed — the standing rule, and the reason Profile and Settings can now never
 * disagree about what unsaved means.
 */
var SET_FIELDS = {
  work:   [['st_am', 'assignment_model'], ['st_mt', 'default_max_tasks']],
  assign: [['st_aam', 'mode'], ['st_ada', 'default_assignee']],
};

function setSnapshot(){ profSnapshot(SET_FIELDS); }
function setGuard(go){ return profGuard(go, SET_FIELDS, { work: tx('Work'), assign: tx('Auto-assign') }); }

/** Re-read every profile field currently on screen. Called after each paint. */
function profSnapshot(map){
  map = map || PROF_FIELDS;
  _profSnap = {};
  Object.keys(map).forEach(function(s){
    map[s].forEach(function(pair){
      var el = document.getElementById(pair[0]);
      if (el) _profSnap[pair[0]] = el.value;
    });
  });
}

/** Which sections have an on-screen field whose value differs from the snapshot. */
function profDirtySections(map){
  map = map || PROF_FIELDS;
  var out = [];
  Object.keys(map).forEach(function(s){
    var dirty = map[s].some(function(pair){
      var el = document.getElementById(pair[0]);
      /* ⚠️ A FIELD NOT ON SCREEN IS NOT DIRTY. A collapsed section cannot have been edited, and treating its
         absence as a change would prompt on every single navigation. */
      return el && Object.prototype.hasOwnProperty.call(_profSnap, pair[0]) && el.value !== _profSnap[pair[0]];
    });
    if (dirty) out.push(s);
  });
  return out;
}

/**
 * profGuard(go) — run `go`, or ask first if something is unsaved.
 *
 * ⚠️ THE PROMPT NAMES WHAT IS UNSAVED. "You have unsaved changes" makes a person hunt through five collapsed
 * sections for something they may not have touched; naming the section turns the question into an answer.
 *
 * ⚠️ THREE OUTCOMES, NOT TWO. Save-and-go, discard-and-go, and STAY — because a person interrupted mid-edit
 * often wants neither. A two-button dialog forces a decision about the data in order to answer a question
 * about the navigation.
 */
function profGuard(go, map, nameMap){
  /* ⚠️ THE MAP IS REMEMBERED FOR profGuardDo — it saves the dirty sections after the person chooses, and
     without this it would save PROFILE fields when the prompt came from Settings. */
  UI._guardMap = map || PROF_FIELDS;
  var dirty = profDirtySections(UI._guardMap);
  if (!dirty.length) return go();
  var Q = String.fromCharCode(39);
  var names = nameMap || { ident: tx('Identity'), profile: tx('Business'), governed: tx('Storefront') };
  var what  = dirty.map(function(s){ return names[s] || s; }).join(', ');

  UI._profGo = go;
  /**
   * ⚠️ modal() TAKES ONE HTML STRING, NOT (title, body, buttons). I wrote the three-argument call from memory
   * and only the first would have rendered — the fourth remembered-signature mistake today, after
   * SESSION.identity_type, PURPOSE.profile and the borrowed `capped`. The house markup is mhd / mbody / mfoot,
   * as confirmAsk builds it; confirmAsk itself is two-button and this needs three.
   */
  modal('<div class="mhd"><div class="t">' + esc(tx('Not saved')) + '</div></div>'
    + '<div class="mbody"><div style="font-size:var(--fs-2);line-height:1.55;color:var(--ink)">'
    +   tx('You changed') + ' <b>' + esc(what) + '</b> ' + tx('and have not saved it.')
    + '</div></div>'
    + '<div class="mfoot">'
    +   '<button data-testid="prof-guard-stay" onclick="profGuardDo(' + Q + 'stay' + Q + ')">' + esc(tx('Stay here')) + '</button>'
    +   '<button data-testid="prof-guard-discard" onclick="profGuardDo(' + Q + 'discard' + Q + ')">' + esc(tx('Discard')) + '</button>'
    +   '<button class="pri" data-testid="prof-guard-save" onclick="profGuardDo(' + Q + 'save' + Q + ')">' + esc(tx('Save and continue')) + '</button>'
    + '</div>');
  /* ⚠️ ESCAPE AND THE BACKDROP MEAN STAY, NOT DISCARD. A dialog dismissed by accident must never be the thing
     that throws away work — the safe default is the one that changes nothing. */
  UI._modalDismiss = function(){ UI._profGo = null; };
}

/** ⭐ EVERY OUTCOME CONFIRMS ITSELF. Athi: *"a confirmation message for both save and cancel."* Silence after
 *  discarding is indistinguishable from silence after saving, and the difference is the person's work. */
async function profGuardDo(which){
  var go = UI._profGo; UI._profGo = null;
  if (typeof closeModal === 'function') closeModal();
  if (which === 'stay') { toast(tx('Staying — nothing was changed.')); return; }
  var map = UI._guardMap || PROF_FIELDS;
  if (which === 'save') {
    var secs = profDirtySections(map);
    /* ⚠️ WHICH SAVER DEPENDS ON WHICH SCREEN ASKED. A single saveProfile() here would have written Profile
       fields in response to a Settings prompt — the map is what tells them apart. */
    for (var i = 0; i < secs.length; i++) {
      if (map === PROF_FIELDS) await saveProfile(secs[i]);
      else if (secs[i] === 'work')   await saveSettings();
      else if (secs[i] === 'assign') await saveAutoAssign();
    }
    toast(tx('Saved.'));
  } else {
    profSnapshot(map);              // whatever is on screen becomes the new baseline
    toast(tx('Changes discarded.'));
  }
  if (typeof go === 'function') go();
}

async function saveProfile(sec){
  /* ⚠️ DEFAULTS TO EVERY SECTION so an older call site (or a test) that calls saveProfile() with no argument
     still saves what is on screen rather than silently saving nothing. */
  var secs = sec ? [sec] : Object.keys(PROF_FIELDS);
  var x = document.getElementById('pf_err_' + (sec || secs[0])) || document.getElementById('pf_err');
  if (x) x.textContent = '';

  var _b = {};
  secs.forEach(function(s){
    (PROF_FIELDS[s] || []).forEach(function(pair){
      var el = document.getElementById(pair[0]);
      if (!el || el.disabled) return;          // not rendered, or capped → not this person's to send
      var v = val(pair[0]);
      if (v !== '') _b[pair[1]] = v;
    });
  });

  if (!Object.keys(_b).length) { if (x) x.textContent = tx('Nothing to save.'); return; }
  try { await api('saveProfile', { body: _b }); toast(MSG.profileSaved()); UI._me = null; loadProfile(); }
  catch (e) { if (x) x.textContent = e.message; }
}
// 🛍️ Customer storefront — the shareable public shop link + the browse-first / login-first access mode.
/* sfCopy removed with storefrontCardHTML, the card whose copy button called it. */
/**
 * ⚠️⚠️ THIS FUNCTION WAS DELETED BY ACCIDENT AND RESTORED FROM GIT (commit a823180).
 *
 * A scripted cut() removing storefrontCardHTML and saveStorefront over-reached and took loadActorProfile with
 * it. Nothing complained: the file parsed, every gate passed, and render-smoke kept reporting 9/9 — because it
 * calls iamSelfEmployeeHTML directly and never goes through loadProfile. The ONLY symptom would have been an
 * employee opening Profile and getting a blank pane from a ReferenceError.
 *
 * ⭐ FOUND BY dead-surface REPORTING iamSelfEmployeeHTML AND saveActorPin AS ORPHANS — not by any test, and not
 * by reading the diff. A function with no callers is usually dead code; twice today it has instead meant that
 * something which SHOULD call it has gone missing. The orphan count going UP after a deletion is the signal.
 */
/**
 * loadActorProfile — THE employee's own profile. There is exactly one, and finding that out was the whole
 * problem.
 *
 * ⚠️⚠️ I BUILT A SECOND ONE AND IT WAS UNREACHABLE. Athi asked why his access level was not shown; I added an
 * employee branch inside iamHTML and shipped it. But loadProfile() short-circuits three lines in —
 * `if(SESSION.role==='actor') return loadActorProfile(h)` — so iamHTML is NEVER CALLED for an employee and
 * the new screen could not render for anyone. Two renderers for one screen, and the one I wrote was the dead
 * one. Athi's report, twice, was simply "still not rendering".
 *
 * ⭐ THE STANDING RULE EXISTS FOR EXACTLY THIS: a second call site means find the first one. I searched for
 * where the IAM screen renders instead of where an EMPLOYEE's profile renders, found iamHTML, and built
 * beside a function I never looked for. The content below is the same iamSelfEmployeeHTML — now called from
 * the one place that actually runs.
 *
 * ⚠️ AND IT NEEDS /me, NOT THE TOKEN. The old version read everything from jwtPayload, which is why it could
 * only say "your hat is managed by your entity" without naming it: the level deliberately is NOT in the JWT,
 * so that an owner demoting someone takes effect immediately rather than at token expiry. Naming the level
 * therefore costs one round trip, and that is the correct price for the answer being current.
 */
async function loadActorProfile(h){
  /* ⭐ A COLLAPSIBLE SECTION LIKE THE OTHERS. Athi, 2026-08-20: *"pin number again as a collapsable stuff"* and
     *"change your pin is fine"* — so the wording stays and only the container changes. Three sections that
     behave the same way beat two accordions and one loose card sitting under them. */
  const pinBody = `<label class="fl">${tx('Current PIN')}</label><input class="inp" id="pf_cpin" inputmode="numeric" maxlength="4" style="max-width:150px" placeholder="4 digits">
      <label class="fl">${tx('New PIN')}</label><input class="inp" id="pf_npin" inputmode="numeric" maxlength="4" style="max-width:150px" placeholder="4 digits">
      <label class="fl">${tx('Confirm new PIN')}</label><input class="inp" id="pf_npin2" inputmode="numeric" maxlength="4" style="max-width:150px" placeholder="4 digits">
      <div class="err" id="pf_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveActorPin()">${tx('Change PIN')}</button>`;
  const pinCard = iamSection('pin', tx('Change your PIN'), pinBody, { hint: tx('4 digits') });

  /* Paint immediately from the token so the screen is never blank, then replace once /me lands. */
  const p = (typeof jwtPayload === 'function' && jwtPayload(SESSION.token)) || {};
  if (!UI._me) {
    h.innerHTML = `<div class="sec">${tx('Your profile')}</div>`
      + `<div class="misnote">${esc(SESSION.name || p.display_name || '')} — loading your access…</div>` + pinCard;
  }

  let e = UI._me;
  if (!e) {
      /* ⭐ meNow() — the warm request started at sign-in, or a fetch. An actor never passes through
         loadProfile (it returns here first), so before this the co-assist path always paid a full round
         trip while a perfectly good one was already in flight. */
    try { e = (await meNow()) || {}; UI._me = e; }
    catch (err) { e = { display_name: SESSION.name || p.display_name, actor_key: p.actor_key, identity_type: 'actor' }; }
  }
  /* ⚠️ RE-QUERY AFTER THE AWAIT — renderApp rebuilds the shell, so the node captured above may be detached.
     Every await in this file followed by a DOM write has the same hazard. */
  const h2 = document.getElementById('profbody'); if (!h2) return;
  h2.innerHTML = `<div class="sec">${tx('Your profile')}</div>`
    + iamSelfEmployeeHTML(e)
    + pinCard
    + `<div style="font-size:var(--fs-1);color:var(--grey);margin-top:8px;line-height:1.5">Set your <b>${tx('Duty / Break')}</b> from the top bar.</div>`;
}

async function saveActorPin(){ const x=document.getElementById("pf_err"); if(x)x.textContent="";
  const c=val("pf_cpin"), n=val("pf_npin"), n2=val("pf_npin2");
  if(!/^\d{4}$/.test(n)){ if(x)x.textContent="New PIN must be 4 digits."; return; }
  if(n!==n2){ if(x)x.textContent="New PINs don't match."; return; }
  try{ await api("changePin",{body:{current_pin:c,new_pin:n,confirm_pin:n2}}); toast("PIN changed ✓"); ['pf_cpin','pf_npin','pf_npin2'].forEach(function(i){ var el=document.getElementById(i); if(el)el.value=''; }); }
  catch(e){ if(x)x.textContent=e.message; } }
/* ---- SETTINGS + governance (7-layer perception stub) ---- */
/**
 * ⭐ MODEL A — GOVERNANCE DECLARES, EVERY OTHER SCREEN REFERS (Athi, 2026-08-16: *"model a, we need to bring
 * unification. then only we can refer in only one place."*).
 *
 * GOV is the single declaration table. Before this, several rows here were ALSO hardcoded in the screen that acts
 * on them — the attachment list `image, pdf, docx, xlsx, csv, zip` existed as two independent string literals in
 * this one file, so Governance and Settings → Policy could disagree and nothing would notice.
 *
 * ⚠️ A CONSUMER MUST NOT COPY THE VALUE. Read it with govDecl(label) and render what comes back. If a label is
 * renamed here the lookup returns null and the consumer shows "not declared" — loud, and better than a stale copy
 * that keeps rendering the old answer forever. Full audit: C:\dev\RECONCILE-declarations.md.
 */
/**
 * The catalogue-visibility CAP, read from the entity rather than asserted. `UI._me` is the profile payload, so
 * this is whatever the server last said. Before Profile has been opened there is nothing to read — and it says so
 * rather than guessing, because a governance row inventing "private" is exactly the drift being removed.
 */
/**
 * ⚠️ THE CAP CARRIES MORE THAN A MAXIMUM, and the old row dropped all of it. The server returns
 * `{max, by, enforced, reason}` — e.g. *"The free plan declares no public catalogue, but plan enforcement is off"*
 * with `enforced:false`. A cap that is DECLARED BUT NOT ENFORCED is a different fact from one that binds, and it is
 * precisely the kind of thing a governance screen exists to say out loud. Printing only "private (cap)" threw away
 * both who set it and whether it actually holds.
 */
function govCatVis(){
  var e = UI._me;
  if (!e) return 'open Profile → Storefront to read it';
  var cap = e.visibility_cap || {};
  var vis = e.catalogue_visibility || 'private';
  var out = vis;
  if (cap.max && cap.max !== 'public') out += ' · capped at ' + cap.max + (cap.by ? ' by ' + cap.by : '');
  /* Say when a declared cap is NOT binding — otherwise the screen implies a constraint that is not applied. */
  if (cap.max && cap.max !== 'public' && cap.enforced === false) out += ' (declared, not enforced)';
  return out;
}
/**
 * The assignment model as SAVED, not as asserted. The row read a literal 'both · entity setting' while the real
 * value is written by Settings → Work through saveSettings — so changing it there left Governance still claiming
 * "both".
 *
 * ⚠️ It also says the value is not enforced, because Settings' own banner says exactly that ("saved but not yet
 * active"). A governance screen repeating a stored value while omitting that nothing acts on it is the same
 * overstatement as a cap that does not bind.
 */
/**
 * ⭐ STANDARDS AND UNITS COME FROM THE CATALOGUE MODEL, not from a dash in this file.
 *
 * Both rows read `—` while `catalogue-model.js` has held the real registries all along — `STD_SCHEMES`
 * (HS · GS1 GPC · Schema.org · UNSPSC · custom) and `STANDARDS` — and Definitions already surfaces them, citing
 * "app/catalogue-model.js · STD_SCHEMES" as its source. So the governance screen was showing "not configured" for
 * something configured in two other places.
 *
 * ⚠️ NAMES ONLY, AND CAPPED. The point of the row is that a registry exists and where it lives — not to mirror
 * its contents, which is how a second copy starts. Definitions remains the place to read them in full.
 */
/**
 * ⭐ THE PLAN IS A DECLARATION; ITS CONSUMPTION IS A METRIC (Athi, 2026-08-16: *"metered for constitution are
 * really the MIS? … setting up here and show the outcome in MIS"*).
 *
 * Constitution used to carry five "metered" rows — Entities provisioned · Networks formed · Chits issued · Data
 * stored · Plan tier — mixing the two. Four were MEASUREMENTS sitting on a configuration screen, and two of them
 * (`Chits issued`, `Data stored`) rendered as `—` while **MIS was computing the real chit count on the next
 * screen along**. A governance card showing a dash for a number the product already knows is the clearest
 * possible case for splitting declaration from outcome.
 *
 * Governance now declares PLAN and nothing else. MIS reads the same object and reports usage against it.
 */
/**
 * ⭐ A PLAN IS A SUBSCRIPTION, so it has a validity window (Athi, 2026-08-16: *"valid from and to date need to
 * bring in if it is a subscription model"*). Right — a plan with no period cannot express renewal, lapse, or
 * "this limit applied last month but not this one".
 *
 * ⚠️ THE DATES ARE DECLARED AS A SHAPE, NOT AS DATA — validFrom/validTo are null because NOTHING SUPPLIES THEM.
 * There is no plan_tier, plan_expires, subscription or billing column in the API, and lib/assist-kb.js:68 states
 * plainly that "Subscription tiers, usage quotas … are in design, not yet live". Putting plausible dates here
 * would make a stub look like a record — the exact failure just removed from Currency and the clearance count.
 *
 * The precedent for the real thing already exists in this codebase: product versions carry valid_from/valid_to
 * and are queried by instant (`routes/products.js`). A plan should follow that shape, not invent its own.
 */
var PLAN = { tier:'Free', entities:5, chitsPerDay:10, networks:1, validFrom:null, validTo:null };
/* Where a plan sits in time. Returns null when there is no window to reason about — callers must not guess. */
function planWindow(){
  if (!PLAN.validFrom && !PLAN.validTo) return null;
  var now = Date.now();
  var from = PLAN.validFrom ? Date.parse(PLAN.validFrom) : null;
  var to   = PLAN.validTo   ? Date.parse(PLAN.validTo)   : null;
  if (to && now > to)     return { state:'expired', to:to, days:Math.ceil((now-to)/864e5) };
  if (from && now < from) return { state:'not yet started', from:from, days:Math.ceil((from-now)/864e5) };
  return { state:'active', to:to, days: to ? Math.ceil((to-now)/864e5) : null };
}
function govPlanBlock(){
  return '<div style="margin:15px 0 2px;font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-2);color:#5b4a86">' + tx('↑ Your plan · what it entitles you to') + '</div>'
    + govRowHtml('Plan tier', esc(PLAN.tier), 'bound')
    /* The subscription period. `free` is the honest class: not yours to set, and not set by anyone else either. */
    + govRowHtml('Valid from', PLAN.validFrom ? esc(PLAN.validFrom) : 'no subscription record yet', PLAN.validFrom ? 'bound' : 'free')
    + govRowHtml('Valid to',   PLAN.validTo   ? esc(PLAN.validTo)   : 'no subscription record yet', PLAN.validTo   ? 'bound' : 'free')
    + govRowHtml('Entities allowed', String(PLAN.entities), 'bound')
    + govRowHtml('Chits per day', String(PLAN.chitsPerDay), 'bound')
    + govRowHtml('Networks allowed', String(PLAN.networks), 'bound')
    + '<div class="misnote" style="margin-top:9px">These are the limits. <b onclick="navTo(\'mis\');UI.misBand=\'plan\'" style="cursor:pointer;color:var(--blue)">See what you have used in MIS <span class=arw>→</span></b></div>';
}
function govCodeStandards(){
  var M = (typeof CBCatalogue !== 'undefined') ? CBCatalogue : null;
  var s = M && M.STD_SCHEMES;
  if (!s || !s.length) return 'no scheme registry loaded';
  return s.slice(0, 4).join(' · ') + (s.length > 4 ? ' +' + (s.length - 4) : '') + ' — see Definitions';
}
/**
 * ⚠️ I GOT THIS WRONG FIRST TIME and it is worth recording. This row is "Units of measure", and I pointed it at
 * `CBCatalogue.STANDARDS` because the name looked close enough — but STANDARDS holds ADOPTED SPECIFICATIONS
 * (JSON Schema 2020-12, RFC 7386 merge-patch, GS1 GTIN, PIM, MDM survivorship). It reported "19 declared" for a
 * registry of units that does not exist. A confident number pointing at the wrong table is worse than a dash,
 * because a dash invites the question and a number closes it.
 *
 * ⚠️ THERE IS NO CENTRAL UNITS REGISTRY. The only list is `CW_UNITS` inside the catalogue wizard (cap-catalogue.js),
 * which is a screen, not a model — so units cannot be declared, referenced or governed. That is a real Model A gap
 * and it is stated here rather than papered over.
 */
/**
 * ⭐⭐ LOCALISATION RESOLVES INTO GOVERNANCE LAYER 2 (Athi, 2026-08-18: *"where is the localisation layer, it is
 * missing in the governance layer?"*).
 *
 * ⚠️ HE WAS RIGHT AND IT WAS HALF-THERE. Layer 2 · Jurisdiction has said "locale bundle lands partly here" since
 * it was written, and carries a "Date / number format" row — which read a literal em-dash. The DECLARATION
 * existed and nothing resolved it, so the layer claimed to govern something it could not see.
 *
 * That is the same defect `govCatVis` was written to fix: a row asserting a value independently of the thing it
 * describes, which is fine until the two disagree and the screen keeps saying the old answer.
 *
 * ⚠️ FUNCTIONS, NOT THEIR RESULTS. GOV is a const built once at load, before CBLocale has read storage —
 * `govLocaleFormat()` here would freeze on whatever was true at parse time. govVal() unwraps them at render.
 *
 * ── MODEL A, the same shape as visibility ─────────────────────────────────────────────────────────────────
 * The LAYER declares what a jurisdiction permits. Settings › Localisation is where a person CHOOSES WITHIN it.
 * The layer caps; the profile chooses. Localisation is not a separate concern from governance — it is one of
 * the seven layers, and the settings screen is its chooser.
 */
function govLocaleLang(){
  try {
    var m = { en:'English', hi:'हिन्दी (Hindi)', ta:'தமிழ் (Tamil)', fr:'Français (French)' };
    var l = CBLocale.lang();
    return (m[l] || l) + ' · interface';
  } catch(_){ return '—'; }
}
function govLocaleFormat(){
  try { return CBLocale.locale() + ' · ' + CBLocale.money(1234.5, 'INR') + ' · ' + CBLocale.date(Date.now()); }
  catch(_){ return '—'; }
}
function govLocaleDir(){
  try { return CBLocale.dir() === 'rtl' ? 'right to left (RTL)' : 'left to right (LTR)'; } catch(_){ return '—'; }
}
function govUnits(){
  /* Reads the MODEL now, not the wizard — so it resolves whether or not the catalogue capability has been opened.
     Reaching across to another lazily-loaded capability's global was the reason this row used to read empty. */
  var M = (typeof CBCatalogue !== 'undefined') ? CBCatalogue : null;
  var u = M && M.UNITS;
  if (!u || !u.length) return 'no units registry loaded';
  return u.length + ' declared · ' + u.slice(0, 5).join(' · ') + (u.length > 5 ? ' +' + (u.length - 5) : '');
}
function govAssignModel(){
  var s = UI._set && UI._set.s;
  if (!s) return 'open Settings → Work to read it';
  return (s.assignment_model || 'both') + ' — saved, not yet enforced';
}
/* The cap's own explanation, when the server gives one. Shown under the row rather than truncated into it. */
function govCatVisWhy(){
  var cap = (UI._me && UI._me.visibility_cap) || {};
  return cap.reason ? String(cap.reason) : '';
}
/**
 * ⚠️ THE VALUE, NOT A SECOND CONTROL (Athi: *"whatever is there in profile if already works, remove the stub in
 * governance and bring the same here"*). Right — the stub is gone and Governance now shows the REAL value.
 *
 * But it shows it read-only, with a link to where it is set. Putting Profile's `<select>` here too would give one
 * value two controls, which is the duplication being removed, only worse: two places to change it and no way to
 * tell which one last won. One owner, many viewers.
 */
function govOwnedElsewhere(where, nav){ return '<button class="govref-go" onclick="'+nav+'">change in '+esc(where)+' <span class=arw>→</span></button>'; }
/* A declared value may be a literal or a function of live state — resolve it the same way everywhere, so no
   consumer has to know which kind it got. */
function govVal(v){ try { return (typeof v === 'function') ? v() : v; } catch(_){ return '—'; } }
function govDecl(label){
  for (var i=0; i<GOV.length; i++){
    var rows = GOV[i].rows || [];
    for (var j=0; j<rows.length; j++){
      if (rows[j][0] === label) return { value:govVal(rows[j][1]), klass:rows[j][2], layer:GOV[i].n, layerIndex:i };
    }
  }
  return null;
}
/* Render a declared value read-only, with where it was declared and a way to go there. The consumer screen shows
   the value; it does not own it. */
function govRefHTML(label){
  var d = govDecl(label);
  if (!d) return '<div class="misnote">⚠️ <b>'+esc(label)+'</b> is not set — nothing to show.</div>';
  return '<div class="govref"><span class="govref-k">'+esc(label)+'</span>'
    + '<span class="govref-v">'+esc(d.value)+'</span>'
    + '<button class="govref-go" onclick="govGoTo('+d.layerIndex+')" title="Open the layer that declares this">'
      + esc(d.layer)+' <span class=arw>→</span></button></div>';
}
function govGoTo(i){ UI.govTab=i; UI.setSec='governance'; if(UI.vp==='mob'){ UI.mdetail=true; }
  renderApp(); if(typeof loadSettings==='function') loadSettings(); }

const GOV=[
  { n:'1 · Constitution', tag:'platform · top layer', desc:'Platform-wide rules every entity inherits at mint. Set the locale here → it flows down into the boilerplate.', rows:[
    ['Message max length','unbounded','advisory'],['Max schemas / entity','2','bound'],
    /* ⚠️ RESOLVED, NOT HARDCODED. This row read a literal 'private (cap)' while the real cap lives on the entity
       as `visibility_cap` (server-set, applied by Profile → Storefront, which disables the control and says "set
       by your network operator"). The behaviour was already Model A — the layer caps, Profile chooses within it —
       but this row asserted a value independently, so a network operator lifting the cap would leave Governance
       still saying "private" with nothing to notice. Reads the same source now. */
    /* ⚠️ THE FUNCTION, NOT ITS RESULT. GOV is a const built once at load, so `govCatVis()` here would evaluate
       before UI._me exists and freeze on "not read yet" forever. A declaration that depends on live state has to
       be resolved at RENDER time — govVal() below unwraps it. */
    ['Catalogue visibility', govCatVis, 'chosen'],['Attachment types','image, pdf, docx, xlsx, csv, zip','advisory'],
    ['Attachment max size','10 MB','advisory'] ] },
  /* ⚠️ THE LOCALISATION ROWS RESOLVE LIVE — see govLocaleLang/Format/Dir above. They read '—' until 2026-08-18:
     the layer declared it governed the locale bundle and could not see it. Chosen in Settings › Localisation,
     which is this layer's chooser, exactly as Profile → Storefront is the chooser for visibility. */
  { n:'2 · Jurisdiction', tag:'country / legal · localisation', desc:'Country-specific legal & tax frame, and the locale bundle: language, formats and reading direction. Chosen in Settings › Localisation.', rows:[
    ['Country','—','free'],['Tax regime (GST / VAT)','—','free'],['Legal framework','—','free'],
    ['Interface language', govLocaleLang, 'chosen'],
    ['Date / number format', govLocaleFormat, 'chosen'],
    ['Reading direction', govLocaleDir, 'chosen'],
    ['Sort order','follows the format locale','free'] ] },
  { n:'3 · Vertical', tag:'business type', desc:'Defaults for your line of business.', rows:[
    ['Business vertical','—','free'],['Default units','—','free'],['Vertical currency default','—','free'] ] },
  { n:'4 · Standards', tag:'codes / units', desc:'Measurement & coding standards.', rows:[
    ['Units of measure', govUnits, 'free'], ['Code standards (HSN / SKU)', govCodeStandards, 'free'] ] },
  { n:'5 · Content', tag:'shared assets · versioned', desc:'Shared catalogue / manuals / images published once & carried by reference, not copied.', rows:[
    ['Shared catalogue / manuals / images','published once · referenced','free'],['Asset reference','asset_id @ version','free'],
    ['On update','new version; frozen chits keep the old','free'] ] },
  { n:'6 · ERP', tag:'integration', desc:'System integration adapters.', rows:[
    ['ERP adapter','—','free'],['Sync mode','—','free'] ] },
  { n:'7 · Consolidation', tag:'→ boilerplate the entity inherits', desc:'The 7 layers consolidate into the Boilerplate every entity copies at registration; the locale below is inherited from Constitution.', rows:[
    ['Assignment model', govAssignModel, 'entity'],
    ['Default max tasks / co-assist','10 · entity setting','entity'] ] }   /* ⚠️ the SECOND site of this label — the reason TERM exists */
];
/**
 * ⚠️ REWRITTEN FOR A READER, NOT A DEVELOPER. These were 9.5px Space Mono chips reading "advisory · mutable",
 * "lock · bound", "free · TBD" — below the 11px legibility floor, in the data font, and in vocabulary that only
 * means anything if you already know the model. Every row carried one, so a layer was a wall of nine-colour
 * jargon and the actual question ("can I change this?") was the hardest thing on the screen to answer.
 *
 * Now: plain words, at the floor, and only where they add something the GROUP HEADING has not already said.
 */
var GOV_KLASS = {
  advisory:  { say:'you can change this',        tone:'yours' },
  entity:    { say:'you set this',               tone:'yours' },
  bound_set: { say:'choose from a fixed list',   tone:'yours' },
  chosen:    { say:'you can only make it stricter', tone:'yours' },
  bound:     { say:'locked by the layer above',  tone:'fixed' },
  inherited: { say:'inherited, frozen',          tone:'fixed' },
  protected: { say:'set by the platform',        tone:'fixed' },
  metered:   { say:'counted for licensing',      tone:'fixed' },
  free:      { say:'not set yet',                tone:'none'  }
};
/**
 * ⚠️ PERMISSION IS NOT THE SAME AS "THERE IS A CONTROL HERE", and conflating them made this screen lie.
 *
 * The class says what the LAYER permits. Translating `advisory · mutable` to the plain "you can change this" read
 * as a promise about THIS SCREEN — and 4 of the 19 rows carrying it (Message max length, Catalogue visibility,
 * Attachment types, Attachment max size) are rendered as plain text with nothing to click. The old jargon was
 * vague enough to survive that gap; plain English is not, which is a good argument for plain English and a bad
 * argument for leaving it unchecked.
 *
 * So the wording now depends on whether the row actually offers a control. Same governance, honest sentence.
 */
function govKlass(k, hasControl){
  var x = GOV_KLASS[k] || GOV_KLASS.free;
  var col = x.tone==='yours' ? ['var(--ok-tint)','var(--ok-2)'] : x.tone==='fixed' ? ['var(--blue-tint-bg)','var(--blue-2)'] : ['var(--warn-tint)','var(--grey-2)'];
  var say = x.say;
  /**
   * ⚠️ `=== false`, NOT `!hasControl`. Only a caller that has actually LOOKED may claim there is no control.
   * policyFlagsCard calls govKlass(def.gov) with one argument and renders its select separately, so `undefined`
   * was read as "no control" and every policy flag suddenly said "no control here yet" beside a working dropdown.
   * The same mistake as the rows this caveat was written to fix, pointing the other way: an assertion made from
   * absence of information rather than from evidence.
   */
  if (x.tone === 'yours' && hasControl === false){
    col = ['var(--warn-tint)','var(--warn-3)'];
    say = say + ' — no control here yet';
  }
  return '<span class="govtag" style="background:'+col[0]+';color:'+col[1]+'">'+say+'</span>';
}
/**
 * ⚠️ TIMEZONES / LANGS / GOVSET / govSetVal / govSel WERE HERE AND ARE DELETED (2026-08-16).
 *
 * They existed only to drive three <select>s on this card that wrote to localStorage `cb_govset` — a store no
 * other code in the app ever read. Removing the decoy controls left all five with zero callers, so keeping them
 * would leave the machinery for a fake setting sitting in the file waiting to be wired up by mistake.
 *
 * ⚠️ CURRENCIES is NOT removed — it is a shared global from Core, used elsewhere.
 */
/**
 * ⚠️ WRAPS INSTEAD OF PUSHING THE PANE SIDEWAYS. Label + value + class-tag on one non-wrapping flex line needed
 * ~469px; inside Settings the pane is ~358px, so the row forced the WHOLE DETAIL PANE to scroll horizontally
 * (measured: 111px over) and the tags read "advisory · mut…". A row that cannot fit should fold onto a second
 * line — the pane scrolling sideways is never the right answer, it just moves the problem to the whole screen.
 */
/**
 * ⭐ THREE COLUMNS — name : value : what it means (Athi, 2026-08-16: *"like Currency : data : comment"*).
 *
 * It was a single flex line with the value and a jargon chip crowded after the label, wrapping raggedly when it
 * did not fit. As a table it can be READ DOWN: every label starts at the same x, every value at the same x, and
 * the comment column answers "can I change this?" on the row itself rather than in a legend at the bottom.
 *
 * ⚠️ The comment repeats within a group, and that is fine HERE — a column of like values is scannable, where
 * the same text as loose chips after each value was noise. The layout is what changed the answer.
 */
function govRowHtml(label,valHtml,klass){
  /* Does this row actually offer a way to change it? Read from the rendered value, so the comment can never drift
     from the control — add a select to a row and its wording corrects itself. */
  var hasControl = /<select|<input|<textarea|<button/i.test(String(valHtml));
  /* Rows whose value is owned by another screen say where, so the reader is never left hunting for the control —
     and there is still only ONE control. */
  /**
   * ⚠️ THE MAP HAD TWO ENTRIES AND THE PRODUCT NOW HAS FIVE OWNED VALUES. Localisation and Appearance were
   * built after this map was written, so their governance rows declared a rule and offered no way to reach the
   * control — the exact "left hunting for the control" this map exists to prevent, reintroduced by growth.
   */
  var OWNER = { 'Catalogue visibility': ['Profile → Storefront', "navTo('profile');UI.profSec='storefront'"],
                'Assignment model':     ['Settings → Work',      "setSetSec('work')"],
                'Interface language':   ['Settings → Localisation', "setSetSec('locale')"],
                'Date / number format': ['Settings → Localisation', "setSetSec('locale')"],
                'Reading direction':    ['Settings → Localisation', "setSetSec('locale')"] };
  var own = OWNER[label];
  var why = (label === 'Catalogue visibility') ? govCatVisWhy() : '';
  return '<div class="govrow"><span class="govrow-k">'+esc(label)+'</span>'
    + '<span class="govrow-v">'+valHtml
      /* ⚠️ THROUGH THE HELPER, not inlined. govOwnedElsewhere() was written for exactly this, with the
         "one owner, many viewers" reasoning attached to it, and then this line duplicated its body — so the
         helper sat uncalled while its explanation applied to code somewhere else. Found by the dead-surface
         scan, which reported it as unreachable when it was really un-adopted. */
      + (own ? ' ' + govOwnedElsewhere(own[0], own[1]) : '')
    + '</span>'
    + '<span class="govrow-c">'+govKlass(klass, hasControl || !!own)+'</span></div>'
    + (why ? '<div class="govwhy">'+esc(why)+'</div>' : '');
}
/* In Settings the layers are rail rows, so the RAIL has to repaint too (to move the highlight); elsewhere the
   in-place swap is still right. renderApp covers both — Settings paints from cache, so it is not a re-fetch. */
/* Open state is per-group and sticks while you move between layers — you are usually asking the same question
   ("what can I change?") of each one in turn, and re-collapsing on every switch would fight that. */
function govToggleGrp(k){ UI.govOpen = UI.govOpen || { yours:true, fixed:false, none:false };
  UI.govOpen[k] = !UI.govOpen[k];
  var h=document.getElementById('govblock'); if(h) h.outerHTML=govLayersBlock(); }
function govSetTab(i){ UI.govTab=i;
  if (UI.nav === 'settings'){ if(UI.vp==='mob'){ UI.mdetail=true; } renderApp(); if(typeof loadSettings==='function') loadSettings(); return; }
  var h=document.getElementById('govblock'); if(h)h.outerHTML=govLayersBlock(); }
function govLayersBlock(){ var t=UI.govTab||0; var L=GOV[t];
  var tabs=GOV.map(function(g,i){ return '<button class="composebtn'+(i===t?' on':'')+'" style="font-size:var(--fs-1);padding:5px 9px" onclick="govSetTab('+i+')">'+esc(g.n)+'</button>'; }).join('');
  /**
   * ⭐ SPLIT BY WHO CONTROLS IT (Athi, 2026-08-16: *"we have to see how we can split between what is static and
   * what can change"*). The distinction already existed — it was encoded in a nine-value class on every row — but
   * it was a small chip at the right edge, so answering "what can I actually change here?" meant decoding nine
   * tags line by line. It is the first question anyone brings to a governance screen, so it becomes the structure.
   *
   * ⚠️ THREE GROUPS, NOT TWO. `free` means "not configured yet, lands here later" — it is neither yours to change
   * nor fixed above you, and filing it under either would be a claim the data does not make.
   */
  var YOURS = { advisory:1, entity:1, bound_set:1, chosen:1 };   // set it, pick from a set, or tighten it
  var FIXED = { bound:1, inherited:1, protected:1, metered:1 };  // decided upstream or by the platform
  var _rows=[];
  var push=function(label,val,klass){ _rows.push([label,val,klass]); };
  /**
   * ⚠️ THE THREE DECOY CONTROLS ARE GONE. Currency, Timezone and Language were working `<select>`s that persisted
   * to localStorage (`cb_govset`) and were read by NOTHING except this screen. Money renders from
   * `SESSION.currency` via myCur(); timezone and language have no store and no reader at all. So the only
   * editable controls on the governance card were the three that changed nothing — the most convincing thing on
   * the screen and the least real. A stub you cannot edit is honest; one that accepts and remembers your input
   * is not.
   *
   * Now: Currency shows the entity's ACTUAL value, read-only because no write path exists (adding a select before
   * the endpoint would recreate exactly the problem). Timezone and Language say plainly that nothing sets them.
   */
  if(t===0){
    /**
     * ⚠️⚠️ TWO SOURCES FOR ONE FACT, AND THEY CAN DISAGREE. This row read the ENTITY RECORD
     * (identities.currency_code, via myCur()). Profile › Your rights reads the RESOLVED governance
     * (basics.currency — the installation's currency, bounded by the platform's allowed list,
     * lib/govresolve.js:49). Two different columns, both rendered as the authoritative answer, on two screens.
     *
     * ⭐ The resolved value is the one that GOVERNS — it is what the platform and installation permit. The
     * entity record is what this business set. Where they differ that is worth SEEING, not hiding behind
     * whichever screen you happened to open, so the row shows both and names them.
     */
    (function(){
      var _rec = (typeof myCur === 'function') ? myCur() : (SESSION.currency || 'INR');
      var _gov = (UI._me && UI._me.governance && UI._me.governance.basics && UI._me.governance.basics.currency) || '';
      if (_gov && _rec && String(_gov).toUpperCase() !== String(_rec).toUpperCase()) {
        push('Currency', esc(_gov) + ' <span style="color:var(--warn-2)">— governed. Your entity record says '
          + esc(_rec) + ', which is what your prices are stamped with.</span>', 'bound');
      } else {
        push('Currency', esc(_gov || _rec) + ' — from your installation, matched by your entity record', 'bound');
      }
    })();
    push('Timezone', 'not stored anywhere yet', 'free');
    push('Language', 'not stored anywhere yet', 'free');
  }
  /* ⚠️ The Consolidation view inherited from GOVSET — the localStorage decoy — so it echoed a value nothing
     used. It reads the same real sources the Constitution row does, and says so where there is none. */
  else if(t===6){
    push('Currency (inherited)', esc(typeof myCur==='function' ? myCur() : (SESSION.currency||'INR')) + ' · from your entity record', 'inherited');
    push('Timezone (inherited)', 'nothing to inherit — not stored', 'free');
    push('Language (inherited)', 'nothing to inherit — not stored', 'free');
  }
  L.rows.forEach(function(r){ push(r[0],esc(govVal(r[1])),r[2]); });   // literal or live — govVal resolves both
  /**
   * ⭐ COLLAPSIBLE GROUPS (Athi, 2026-08-16). A layer can run to nineteen rows, and the three groups are not
   * equally interesting: "Yours to set" is the reason you opened the screen, "Fixed above you" is reference, and
   * "Not configured yet" is a placeholder. Opening all three every time buries the actionable one under the other
   * two — so the one you can act on opens, the rest stay shut with their count visible and open on a click.
   *
   * ⚠️ The count sits in the HEADER, not inside the panel, so a shut group still tells you how much is in it.
   * A collapsed section that hides even its own size is just missing information.
   */
  var grp=function(key,title,note,pick){
    var hit=_rows.filter(function(r){ return pick(r[2]); });
    if(!hit.length) return '';
    UI.govOpen = UI.govOpen || { yours:true, fixed:false, none:false };
    var open = !!UI.govOpen[key];
    return '<div class="govgrp'+(open?' open':'')+'">'
      + '<button class="govgrp-h" data-testid="gov-grp-'+key+'" onclick="govToggleGrp(\''+key+'\')" aria-expanded="'+open+'">'
        + '<span class="govchev">'+(open?'▾':'<span class=arw>▸</span>')+'</span><span class="govgrp-t">'+title+'</span>'
        + '<span class="govcount">'+hit.length+'</span><span class="govnote">'+note+'</span></button>'
      + (open ? ('<div class="govgrp-b">'+hit.map(function(r){ return govRowHtml(r[0],r[1],r[2]); }).join('')+'</div>') : '')
      + '</div>';
  };
  var rowsHtml = grp('yours','Yours to set','you control these', function(k){ return YOURS[k]; })
    + grp('fixed','Fixed above you','inherited or platform-bound', function(k){ return FIXED[k]; })
    + grp('none','Not configured yet','arrives from the layer later', function(k){ return !YOURS[k] && !FIXED[k]; });
  if(t===0){ rowsHtml+='<div style="margin:13px 0 2px;font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-2);color:#46546b">' + tx('⚙ Installation · platform-only (master)') + '</div>'+govRowHtml('Cloud provider','AWS','protected')+govRowHtml('Region','ap-south-1','protected')+govRowHtml('Storage adapter','db <span class=arw>→</span> S3 / Azure / GCS','protected')+govRowHtml('Storage bucket','chitbridge-prod-•••','protected')+govRowHtml('Secrets / keys','•••• managed (never exposed)','protected')+govRowHtml('System health','● healthy','protected'); rowsHtml += govPlanBlock(); }
  var inRail = (UI.nav === 'settings');   /* rail carries the layers in Settings; chips elsewhere */
  /* ⭐ THE INSTRUCTION STAYS, THE MECHANISM MOVES. "boilerplate every entity copies at registration" and
     "freeze onto each chit at send" are how it works; a person on this tab is choosing a value. */
  var foot=(t===0)?('Change a value above, then open <b>tab 7 · Consolidation</b>. <i>⏳ ' + tx('Pending') + '</i>'
      + specNote('governance.inherit', 'Values are inherited by the entity from the layer that set them.'))
    :(t===6)?('<i>⏳ ' + tx('Pending') + '</i>'
      + specNote('governance.boilerplate', 'These come down into the <b>boilerplate</b> every entity copies at registration, and <b>freeze</b> onto each chit at send.'))/* ⚠️ THE GENERIC LEGEND IS GONE. It defined `bound` / `advisory` / `free` — words this screen no longer uses,
   because every row now says what it means in plain English on the row itself. A legend for vocabulary that is
   not on the page is the stale-copy bug in its purest form: correct once, then quietly describing nothing. */
:'';
  /* ⚠️ "stub · perception" was internal shorthand on a user-facing screen. The honest part of it — that these are
     not enforced yet — is worth keeping and is now said in words a reader can act on. */
  /**
   * ⭐ THE LAYER IS THE SUBJECT, so it is the heading — name first, then which of the seven it is, then what it
   * means, then the groups. It used to open with "🏛️ Governance · 7 layers" (which the rail already says) and
   * carry the layer name in smaller type underneath, so the screen led with its category instead of its content.
   *
   * ⚠️ The layer NAME comes from GOV[i].n, which is "1 · Constitution" — the ordinal is stripped for the heading
   * and stated properly as "Layer 1 of 7", rather than printing "1 · Constitution" beside "Layer 1 of 7" twice.
   */
  /* The layer's own name, ordinal and all — "1 · Constitution" — is the heading. The separate "Layer 1 of 7" line
     said the same thing a second way; the rail shows all seven, so position is already visible there. */
  return '<div id="govblock" style="'+_CARD+'">'
    + (inRail?'':'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:11px">'+tabs+'</div>')
    + '<div class="govtitle">'+esc(L.n)+'</div>'
    + '<div class="govsub">'+esc(L.tag)
      + ' <span class="govtag" style="background:var(--warn-tint);color:var(--warn-3)">shown, not enforced yet</span></div>'
    + '<div class="govdesc">'+esc(L.desc)+'</div>'
    + rowsHtml
    + (foot ? ('<div style="font-size:var(--fs-1);color:var(--grey);margin-top:11px;line-height:1.5">'+foot+'</div>') : '')
    /**
     * ⭐⭐ GOVERNANCE SETS THE ENVELOPE; SETTINGS PICKS A POINT INSIDE IT — and this footer is where that
     * relationship stops being implicit.
     *
     * Athi, 2026-08-18: *"localisation, appearance and standards, can they get into governance layer?"*
     *
     * ⚠️ THE ANSWER IS NO, AND THE REASON IS THE SPLIT THIS SCREEN ALREADY MAKES. Every row above is either
     * YOURS or FIXED. Governance answers "by what authority, and how far may I move?"; Settings answers "where
     * inside that am I?". Moving the day-to-day pickers in here would bury a control someone uses weekly inside
     * the screen they visit twice a year — and moving the authority out to Settings would leave governance
     * describing rules it could not point at.
     *
     * ⚠️ SO THEY ARE LINKED, NOT MERGED. The rows above already RESOLVE live from the same source the settings
     * screens write (govLocaleLang/Format/Dir), so the two can never disagree; these links close the loop by
     * sending a reader from the rule to the place the choice is made.
     */
    + '<div style="margin-top:12px;padding-top:10px;border-block-start:1px solid var(--line);font-size:var(--fs-1);line-height:1.6">'
    +   '<div style="color:var(--grey);margin-bottom:5px"><b>This sets the limits. You choose inside them:</b></div>'
    +   '<a href="#" data-testid="gov-to-locale" onclick="setSetSec(' + "'locale'" + ');return false" style="color:var(--blue);font-weight:600">Localisation <span class=arw>→</span></a>'
    +   '<span style="color:var(--grey)"> language, formats, time zone, working days &nbsp;·&nbsp; </span>'
    +   '<a href="#" data-testid="gov-to-appearance" onclick="setSetSec(' + "'appearance'" + ');return false" style="color:var(--blue);font-weight:600">Appearance <span class=arw>→</span></a>'
    +   '<span style="color:var(--grey)"> theme, text size, motion &nbsp;·&nbsp; </span>'
    +   '<a href="#" data-testid="gov-to-standards" onclick="setSetSec(' + "'standards'" + ');return false" style="color:var(--blue);font-weight:600">Standards <span class=arw>→</span></a>'
    +   '<span style="color:var(--grey)"> the authority every rule above derives from, and what each one removes</span>'
    + '</div>' + '</div>';
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
  { key:'governance', name:'Governance layers', q:'Where your rights come from' },
  /* ⚠️ NAMED FOR WHAT IT RENDERS. I called this "Blueprints · Shared catalogue designs" when splitting Settings
     into sections, taking the name from the function (blueprintSettingsHTML) without reading its output — it
     renders WORK_PATTERNS, "Governed by work pattern". Nothing about catalogue blueprints appears on it. */
  { key:'blueprints', name:'Work patterns',  q:'How each action is governed' },
  /* ⚠️ ITS OWN SECTION, NOT A ROW UNDER SOMETHING ELSE. Localisation is eight decisions — language, direction,
     numerals, numbers, money, dates, times and sort order — and they were scattered across five files and three
     hardcoded 'en-IN' pins. A concern that large filed under "Work" is a concern nobody finds. */
  { key:'locale',     name:'Localisation', q:'Language, formats and direction' },
  /**
   * ⭐ APPEARANCE IS ITS OWN SECTION, because it outgrew the avatar dropdown the moment the themes started
   * explaining themselves. Fifteen themes, five of which carry an audience and a standard, do not fit a menu
   * that hangs off a topbar — the phone-sized scrolling panel there is a patch, and this is the real home.
   *
   * ⚠️ AND BECAUSE TEXT SIZE AND MOTION BELONG NEXT TO THE THEMES. They are the same decision — "can I use
   * this?" — and splitting them across a menu and a settings page means someone who needs two of the three
   * finds one of them. Athi: *"we can see how to bring the look and feel as a separate unit."*
   */
  { key:'appearance', name:'Appearance',   q:'Theme, text size and motion' },
  /**
   * ⭐⭐ STANDARDS — what the PLATFORM follows, what YOU follow, and what your TRADE follows.
   *
   * Athi, 2026-08-18: *"under standards, possibly we can bring two section — what this platform follows, what
   * the end user is going to follow. All implementation standards can be specified here, so all comes under one
   * roof. And then specific to entity for commercial standard."*
   *
   * ⚠️ THE STATUS COLUMN IS THE WHOLE POINT, and a list without it would be marketing. Some of these are
   * implemented and tested, some are half-done, some are only decided — and a compliance page that flattens
   * those three into one tick is worse than no page, because someone will rely on it. Anything not in force
   * says what is missing, in its own row.
   */
  { key:'standards',  name:'Standards',    q:'What we follow, what you follow' }
];
function setSec(){ return UI.setSec || 'work'; }
/* Same reason as profSetSec — the hook fires before #setbody exists, so drive the load explicitly. */
/**
 * ⚠️ SWITCHING SECTIONS IS AN EXIT, and it discards whatever was typed. Three Settings sections need a Save
 * (Work, Auto-assign, Documents); clicking another rail row threw that away silently, which is the exact loss
 * Athi asked to be warned about on Profile. Same guard, same three outcomes, same functions.
 */
function setSetSec(k){
  setGuard(function(){ UI.setSec = k; renderApp(); _capShowDetail(); loadSettings(); });
}

function settingsScreen(){
  /**
   * ⭐ THE 7 GOVERNANCE LAYERS ARE RAIL ROWS (Athi, 2026-08-16: *"under governance you can bring all 7 layers and
   * each can bring its own data right side"*). They were a strip of chips INSIDE the right pane — a second
   * navigation nested in a section, so the screen had two different ways of choosing a thing depending on how
   * deep you were. The rail already is the way you choose a thing; the layers just belong in it.
   *
   * They appear only while Governance is the open section, so the rail stays five rows when it is not.
   */
  var rail = SET_SECS.map(function(s){
    var row = '<div class="row misrow' + (setSec() === s.key ? ' sel' : '') + '" data-testid="set-sec-' + s.key + '" onclick="setSetSec(\'' + s.key + '\')">'
      + '<div class="main2"><div class="l1"><span class="code">' + esc(s.name) + '</span></div><div class="l2">' + esc(s.q) + '</div></div></div>';
    if (s.key === 'governance' && setSec() === 'governance' && typeof GOV !== 'undefined'){
      row += GOV.map(function(g, i){
        var on = ((UI.govTab || 0) === i);
        return '<div class="row misrow sub' + (on ? ' sel' : '') + '" data-testid="gov-layer-' + i + '" onclick="govSetTab(' + i + ')">'
          + '<div class="main2"><div class="l1"><span class="code">' + esc(g.n) + '</span></div>'
          + '<div class="l2">' + esc(g.tag || '') + '</div></div></div>';
      }).join('');
    }
    return row;
  }).join('');
  var list = '<div class="list"><div class="lh" style="padding:0"><div class="misbar"><span class="misttl">' + tx('⚙️ Settings') + '</span></div></div>'
    + '<div class="rows" id="set_rail">' + rail + '</div></div>';
  var detail = '<div class="detail" id="detailpane"><div id="setbody"><button class="dback" data-testid="cap-back" onclick="backToList()">‹ Back</button></div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  if (UI.misLw == null) UI.misLw = 320;
  var lw = Math.min(UI.misLw, Math.max(260, Math.round((window.innerWidth || 1200) * 0.42)));
  return '<div class="panel' + ((UI.vp === 'mob' && UI.mdetail) ? ' showdetail' : '') + '" id="panel" style="--lw:' + lw + 'px;--lh:' + (UI.lh || 300) + 'px">' + list + divider + detail + '</div>';
}
// AI assists settings = a REDIRECT to Co-assists (the enable + rule live WITH the actor, next to Human/IoT/ERP —
// a lit AI slot is an actor whose actions are disputable chits, so its control belongs where it's held accountable).
function aiSettingsCard(){ return '<div style="'+_CARD+'"><div class="sec" style="margin:0 0 6px">🤖 AI assists <span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--warn-tint);color:var(--warn-3);border-radius:5px;padding:1px 6px">governed</span></div>'
  /**
   * ⭐ SIMPLIFIED, NOT MERELY SHORTENED. Athi, 2026-08-20: *"this text has to be simplified, no one understands
   * rung floor etc."*
   *
   * Three pieces of jargon carried the old sentence — "the human gate", "bounded by the rung floor (you can
   * only tighten)", and "a lit AI slot is an actor" — and none of them is needed to understand what the button
   * underneath does. The two facts a reader actually needs are that an AI assist is governed like a person,
   * and that what it does is disputable.
   *
   * ⚠️ "actor" WENT TOO. It is the database's word (identity_type='actor'), never the product's — TERM.coassist
   * is what a person reads.
   */
  +'<div style="font-size:var(--fs-2);color:var(--grey);line-height:1.55">An AI assist is a ' + TERM.coassist + '. '
  +'It works to a rule you set, and everything it does is a chit you can dispute.</div>'
  +'<button class="composebtn" style="margin-top:10px" onclick="goCoassistAI()">Configure AI assists in Co-assists <span class=arw>→</span></button></div>'; }
function goCoassistAI(){ try{ if(typeof UI!=='undefined') UI.acTypeF='ai'; }catch(_){}
  if(typeof navTo==='function') navTo('coassists'); else if(typeof go==='function') go('#/coassists'); }
/**
 * ⚠️ FETCH ONCE, PAINT MANY. Switching section is not a reason to re-read settings and the actor list — and until
 * this cache existed every switch fired both again, so the pane sat on its spinner while a round trip completed
 * for data it already had.
 */
async function loadSettings(){ const h=document.getElementById("setbody"); if(!h)return;
  if (UI._set){ return (function(){ var r = paintSettings(UI._set.s, UI._set.daOpts); setSnapshot(); return r; })(); }
  try{ const [s,_acts]=await Promise.all([api("getSettings").then(r=>r||{}), api("actors").then(r=>(r||[]).map(mapApiActor)).catch(()=>[])]);
    const _assign=_acts.filter(a=>hatAssignable(a.hat));
    const _daOpts='<option value="">— none (leave in pool) —</option>'+_assign.map(a=>`<option value="${a.id}"${s.default_assignee_actor_id===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
    UI._set={ s:s, daOpts:_daOpts };
    paintSettings(s, _daOpts);
    /* ⚠️ THE BASELINE IS TAKEN AFTER EVERY PAINT — one captured at load goes stale the first time a
       section changes, and every later edit then reads as clean. Same rule as Profile. */
    setSnapshot();
  }catch(e){ h.innerHTML=scrErr(e); } }
/**
 * ⭐⭐ THE LOCALISATION SCREEN.
 *
 * ⚠️ THE LIVE PREVIEW IS THE MOST IMPORTANT COMPONENT ON IT, and it is not decoration. Every other control here
 * is an abstraction — nobody can predict what `ar-EG` does to a number, or that Arabic switches the page
 * direction, or that French moves the currency symbol to the end. Showing the result BEFORE the choice is the
 * difference between a setting and a guess. Ship this without the preview and people will set a locale, meet
 * unexpected digits somewhere else entirely, and file it as a bug.
 *
 * ⭐ LANGUAGE AND FORMAT ARE TWO CONTROLS, deliberately. An Indian trader may want English words with Indian
 * grouping; a Gulf buyer Arabic words with Western digits. Tying them forces a choice nobody asked to make.
 *
 * ⚠️ DIRECTION IS SHOWN, NOT CHOSEN. It follows the language, and offering it as a control invites somebody to
 * pick an unreadable combination and then report the app as broken.
 */

/**
 * The Appearance screen — theme, text size and motion, with the standard stated on every claim.
 *
 * ⚠️ IT REUSES themePaletteHTML() RATHER THAN DRAWING ITS OWN SWATCHES. Two renderers for the same fifteen
 * themes would drift the day someone adds a sixteenth, and the one that was forgotten would be the one a
 * reader happened to be looking at. One palette, two places it can appear.
 */

/**
 * ⭐ THE REGISTER OF STANDARDS. One row per standard, so adding one is a line of data and never a screen edit.
 *
 * ⚠️ STATUS IS NOT DECORATION. `live` means implemented and covered by a test; `part` means partly, and the
 * row MUST say what is missing; `plan` means decided but not built. Athi's standing rule is that we name what
 * is unproven rather than oversell it — and a standards page is exactly where overselling would do most harm,
 * because it is the page someone would quote to a buyer.
 */
function stdTab(){ return UI.stdTab || 'platform'; }
function setStdTab(k){ UI.stdTab = k; renderApp(); _capShowDetail(); loadSettings(); }

function standardsSettingsHTML(){
  var Q = String.fromCharCode(39);
  var card = function(inner){ return '<div style="' + _CARD + '">' + inner + '</div>'; };
  var tab = stdTab();

  var BADGE = {
    live: ['In force',  'var(--ok-tint)',     'var(--ok-2)'],
    part: ['Partly',    'var(--warn-tint)',   'var(--warn-2)'],
    plan: ['Planned',   'var(--neutral-tint)','var(--grey)']
  };

  var seg = [['platform','What we follow'],['yours','What you follow'],['commercial','Your trade'],['why','Why bother']].map(function(x){
    var on = tab === x[0];
    return '<button type="button" data-testid="std-tab-' + x[0] + '" onclick="setStdTab(' + Q + x[0] + Q + ')"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + ' style="flex:1;cursor:pointer;font:inherit;padding:7px 8px;font-size:var(--fs-2);font-weight:' + (on ? 800 : 500) + ';'
      + 'border:2px solid ' + (on ? 'var(--blue)' : 'var(--line)') + ';border-radius:9px;'
      + 'background:' + (on ? 'var(--blue-tint-bg)' : 'var(--card)') + ';color:var(--on-card)">' + x[1] + '</button>';
  }).join('');

  var row = function(st){
    var b = BADGE[st.s] || BADGE.plan;
    return '<div style="padding:8px 0;border-block-start:1px solid var(--line)">'
      + '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap">'
      +   '<b style="font-size:var(--fs-2);color:var(--on-card)">' + esc(st.n) + '</b>'
      +   '<span style="font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;'
      +     'background:' + b[1] + ';color:' + b[2] + ';border-radius:4px;padding:1px 6px">' + b[0] + '</span>'
      + '</div>'
      + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.5">' + esc(st.w) + '</div>'
      /* ⚠️ A "partly" or "planned" row without this line would be the overclaim the status was meant to prevent. */
      + (st.note ? '<div style="font-size:var(--fs-1);color:var(--warn-2);margin-top:3px;line-height:1.5">⚠️ ' + esc(st.note) + '</div>' : '')
      /**
       * ⭐ WHERE IT BITES, AND WHAT IT REMOVES. Athi, 2026-08-18: *"where the standards or the implementation can
       * be seen… we are actually redirecting them where it is being used and how effective it is going to be."*
       *
       * ⚠️ A standard named without a place is trivia. The row that says "GS1 — SKU identity" tells a reader
       * nothing they can act on; the row that says "used in Catalogue › product identity, because the three-way
       * match needs both sides to agree this is the same product" is the difference between a compliance list
       * and an explanation. Where it is USED makes it checkable; what it REMOVES makes it worth having.
       */
      + (st.at ? '<div style="font-size:var(--fs-1);margin-top:4px;line-height:1.5">'
          + '<span style="color:var(--grey)">' + tx('Used in') + ' </span>'
          + (st.go
              ? '<a href="#" data-testid="std-go-' + esc(st.go) + '" onclick="stdGoto(' + Q + esc(st.go) + Q + ');return false" style="color:var(--blue);font-weight:600">' + esc(st.at) + ' <span class=arw>→</span></a>'
              : '<b style="color:var(--on-card)">' + esc(st.at) + '</b>')
          + '</div>' : '')
      /**
       * ⭐⭐ THE WORKED VALUE. Athi, 2026-08-18: *"whenever we are saying we have followed the standard, is there
       * any way we can show some sample record and how that will behave — example, HS code, other system
       * reference and so on, so people can visualise."*
       *
       * ⚠️ "We follow GS1" is a claim a reader has to take on trust. "08901234567894 — the last digit is
       * computed from the other thirteen, so a typo is detectable, and both sides know it is the same product
       * without comparing names" is a claim they can SEE working. The second one survives being forwarded to a
       * sceptical colleague; the first does not.
       *
       * ⚠️ The value is shown in a monospace block because it is a LITERAL — the exact bytes another system
       * would receive. Rendering it as prose would invite the reader to think it was illustrative.
       */
      + (st.ex && st.ex !== '—' ? '<div style="margin-top:6px">'
          + '<code style="display:inline-block;font-family:' + Q + 'Space Mono' + Q + ',ui-monospace,monospace;font-size:var(--fs-1);'
          + 'background:var(--neutral-tint);color:var(--on-card);border:1px solid var(--line);border-radius:5px;'
          + 'padding:2px 7px;word-break:break-all;max-width:100%">' + esc(st.ex) + '</code>'
          + (st.exWhy ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px;line-height:1.55">' + st.exWhy + '</div>' : '')
          + '</div>' : '')
      + (st.why ? '<div style="font-size:var(--fs-1);color:var(--on-card);margin-top:4px;line-height:1.55;'
          + 'border-inline-start:2px solid var(--line);padding-inline-start:8px">' + st.why + '</div>' : '')
      + '</div>';
  };

  var groupsOf = function(list){
    var seen = [], out = '';
    list.forEach(function(st){ if (seen.indexOf(st.g) < 0) seen.push(st.g); });
    seen.forEach(function(g){
      out += card('<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:2px">' + esc(g) + '</div>'
        + list.filter(function(st){ return st.g === g; }).map(row).join(''));
    });
    return out;
  };

  var body;
  if (tab === 'platform') {
    var plat = STANDARDS.filter(function(st){ return st.g !== 'Commercial'; });
    var n = { live:0, part:0, plan:0 };
    STANDARDS.forEach(function(st){ n[st.s]++; });
    body = card('<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + 'What ChitBridge itself implements. <b>' + tx('We adopt standards rather than invent formats') + '</b> — a record '
        + 'that only this platform can read is a record you do not own.'
        + '<div style="margin-top:7px;font-size:var(--fs-1);color:var(--grey)">'
        + '<b style="color:var(--ok-2)">' + n.live + ' in force</b> · '
        + '<b style="color:var(--warn-2)">' + n.part + ' partly</b> · '
        + n.plan + ' planned. '
        + 'Rows that are not in force say what is missing — a page like this is quoted to buyers, so an '
        + 'overstatement here would do more harm than a gap.'
        + '</div></div>')
      /* ⚠️ THE RECORD COMES FIRST. The list answers "what do you follow"; the record answers "what does that
         get me", and a reader who sees the answer to the second reads the first differently. */
      + (typeof stdRecordHTML === 'function' ? stdRecordHTML({ compact: false }) : '')
      + groupsOf(plat);

  } else if (tab === 'yours') {
    /* ⚠️ READ FROM THE LIVE SETTINGS, never a stored copy. A page describing what you follow that had drifted
       from what you actually set would be the one place a wrong answer is guaranteed to be believed. */
    var DAY = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 7:'Sun' };
    var r = CBLocale.regionInfo();
    var th = (typeof THEMES !== 'undefined' && THEMES[typeof themeGet === 'function' ? themeGet() : 'cream']) || {};
    var mine = [
      ['Region',        r ? r.name : 'Not set'],
      ['Languages',     CBLocale.langs().map(function(x, i){ return (i + 1) + '. ' + CBLocale.langName(x); }).join('  ·  ')],
      ['Reading order', CBLocale.dir() === 'rtl' ? 'Right to left ←' : 'Left to right →'],
      ['Locale tag',    '<code>' + esc(CBLocale.tag()) + '</code>'],
      ['Numbers',       esc(CBLocale.number(123456789.5))],
      ['Money',         esc(CBLocale.money(123456.5, (typeof SESSION !== 'undefined' && SESSION && SESSION.currency) || 'INR'))],
      ['Date',          esc(CBLocale.date(Date.now()))],
      ['Time',          esc(CBLocale.time(Date.now()))],
      ['Time zone',     esc(CBLocale.timezone())],
      ['Working days',  CBLocale.workdays().map(function(d){ return DAY[d]; }).join(' ') + (CBLocale.hasWorkdayOverride() ? '  (you set these)' : '  (regional default)')],
      ['Theme',         esc(th.name || '—') + (th.a11y ? '  · meets WCAG ' + esc(th.a11y.level) : '')],
      ['Text size',     (typeof TEXT_SIZES !== 'undefined' && typeof textSize === 'function')
                          ? (function(){ var m = TEXT_SIZES.filter(function(x){ return x[0] === textSize(); })[0]; return m ? m[1] + ' (' + Math.round(m[2] * 100) + '%)' : '—'; })() : '—'],
      ['Motion',        (typeof motionPref === 'function') ? ({ auto:'Follow my device', reduce:'Reduced', full:'Always animate' }[motionPref()] || '—') : '—']
    ];
    body = card('<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + 'The conventions <b>your</b> screens follow. Every line here is a live reading of your own settings, '
        + 'not a stored copy — change one in Localisation or Appearance and this moves with it.'
        + '</div>')
      + card('<div data-testid="std-yours">' + mine.map(function(x){
          return '<div style="display:flex;gap:10px;padding:5px 0;border-block-start:1px solid var(--line);font-size:var(--fs-2)">'
            + '<span style="min-width:112px;color:var(--grey)">' + x[0] + '</span>'
            + '<b style="color:var(--on-card);min-width:0;word-break:break-word">' + x[1] + '</b></div>';
        }).join('') + '</div>')
      + card('<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.6">'
        + '⚠️ <b>' + tx('None of this changes what anyone wrote.') + '</b> These settings govern the chrome and the way figures '
        + 'are written. Product names, catalogue entries, chit subjects, messages and dispute reasons stay in the '
        + 'language and the currency their author used — a chit is a shared record, and one that read differently '
        + 'to each party would not be a record.</div>');

  } else if (tab === 'why') {
    /**
     * ⭐⭐ THE ARGUMENT, AND ITS COSTS ON THE SAME PAGE.
     *
     * ⚠️ A page that listed only the benefits would be the same overclaim the status column exists to prevent,
     * one level up. The costs are real — slower to build, bigger than the need, moving targets, and an
     * obligation to be honest that we then have to keep. Stating them is what makes the benefits believable.
     */
    var col = function(title, items, tint, ink){
      return card('<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:' + ink + ';margin-bottom:6px">' + title + '</div>'
        + items.map(function(x){
            return '<div style="padding:6px 0;border-block-start:1px solid var(--line)">'
              + '<b style="font-size:var(--fs-2);color:var(--on-card)">' + x[0] + '</b>'
              + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.55">' + x[1] + '</div></div>';
          }).join(''));
    };
    /* ⚠️ ONE RENDERER, TWO SURFACES — see stdWhyHTML in cap-standards.js. The argument used to be written out
       here; the Legend needing it made a second copy the obvious move and the wrong one. */
    body = stdWhyHTML({ compact: false });
  } else {
    body = card('<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + 'The commercial standards <b>your entity</b> trades under. These are not platform settings — they are '
        + 'terms you and your counterparty agree, and the platform\'s job is to carry them onto the record so '
        + 'nobody has to remember which version applied.'
        + '</div>')
      + groupsOf(STANDARDS.filter(function(st){ return st.g === 'Commercial'; }))
      + card('<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.6">'
        + '⚠️ <b>Carried is not the same as enforced,</b> and the difference matters to a buyer. An Incoterm on a '
        + 'chit today records what was agreed; it does not yet check the shipment against it. That gap is stated '
        + 'here rather than left for someone to discover in a dispute.</div>');
  }

  return _misHead('Standards', '')
    + '<div style="display:flex;gap:7px;margin-bottom:10px">' + seg + '</div>'
    + body;
}

function appearanceSettingsHTML(){
  var card = function(inner){ return '<div style="' + _CARD + '">' + inner + '</div>'; };
  /* ⚠️ Q IS DEFINED HERE, in the SHIPPED function — not in the script that generated it. This is the fourth
     time a generator-only constant has been emitted into shipped code (BT, then Q twice, now this). It always
     PARSES, because a bare identifier is valid syntax, so node --check and the guard both pass and it only
     dies when the line finally runs — reaching Athi as "the buttons do nothing". A generator that writes code
     must be tested by RUNNING its output, which is what caught this one before it shipped. */
  var Q = String.fromCharCode(39);
  var cur = (typeof textSize === 'function') ? textSize() : 'm';
  var mot = (typeof motionPref === 'function') ? motionPref() : 'auto';

  var pill = function(id, on, click, label, sub){
    return '<button type="button" data-testid="' + id + '" onclick="' + click + '"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + ' style="flex:1;min-width:0;cursor:pointer;font:inherit;text-align:center;padding:7px 6px;border-radius:9px;'
      + 'border:2px solid ' + (on ? 'var(--blue)' : 'var(--line)') + ';'
      + 'background:' + (on ? 'var(--blue-tint-bg)' : 'var(--card)') + ';color:var(--on-card)">'
      + '<span style="display:block;font-weight:' + (on ? 800 : 600) + ';font-size:var(--fs-2)">' + esc(label) + '</span>'
      + (sub ? '<span style="display:block;font-size:var(--fs-1);color:var(--grey);margin-top:2px">' + esc(sub) + '</span>' : '')
      + '</button>';
  };

  var sizes = (typeof TEXT_SIZES !== 'undefined' ? TEXT_SIZES : []).map(function(x){
    return pill('ap-fs-' + x[0], cur === x[0], 'textSizeSet(' + Q + x[0] + Q + ')', x[1], Math.round(x[2] * 100) + '%');
  }).join('');

  var motions = [
    ['auto',   'Follow my device', 'the usual'],
    ['reduce', 'Reduce motion',    'no animation'],
    ['full',   'Always animate',   'override']
  ].map(function(x){
    return pill('ap-motion-' + x[0], mot === x[0], 'motionSet(' + Q + x[0] + Q + ')', x[1], x[2]);
  }).join('');

  return _misHead('Appearance', '')

    + card('<label class="fl">' + tx('Theme') + '</label>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin:0 0 8px">'
        + 'Fifteen themes. The five under <b>' + tx('Designed for specific needs') + '</b> each name who they are for and which '
        + 'standard they meet — and those levels are computed by a test, so a card claiming 7:1 has been checked.'
        + '</div>'
        + (typeof themePaletteHTML === 'function' ? themePaletteHTML() : ''))

    + card('<label class="fl">' + tx('Text size') + '</label>'
        + '<div style="display:flex;gap:7px;margin:5px 0 7px">' + sizes + '</div>'
        /* ⚠️ THE SENTENCE THAT WAS HERE IS GONE — "the whole type scale moves together, so headings stay
           larger than captions" is a description of the implementation, and the line BELOW it demonstrates
           the same thing by being rendered at the chosen size. A demonstration outlives an explanation:
           this text is showing at 115% is checkable by looking at it. Athi: *"if some adjustment needed in
           settings, please do so."* */
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5">'
        + '<b>This text is showing at ' + esc(String(Math.round(((TEXT_SIZES.filter(function(x){return x[0]===cur;})[0]||[0,0,1])[2]) * 100))) + '%.</b>'
        + '</div>')

    + card('<label class="fl">' + tx('Motion') + '</label>'
        + '<div style="display:flex;gap:7px;margin:5px 0 7px">' + motions + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5">'
        + '⚠️ <b>' + tx('Movement is a health setting, not a matter of polish.') + '</b> Animation triggers migraine, nausea and '
        + 'vertigo for people with vestibular disorders. <b>' + tx('Follow my device') + '</b> honours the setting you already '
        + 'made in Windows, macOS, iOS or Android — you should not have to ask us separately.'
        + '</div>')

    /* ⚠️ WHAT IS NOT HERE YET, SAID PLAINLY. A settings page that silently lacks the control someone came for
       wastes their time twice: once looking, once wondering whether they missed it. */
    + card('<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">' + tx('Not here yet') + '</div>'
        + '<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + '<b>' + tx('Typeface') + '</b> — a dyslexia-friendly face (Atkinson Hyperlegible, free, from the Braille Institute) needs '
        + 'the font shipped with the app before it can be offered.<br>'
        + '<b>' + tx('Colour-vision preview') + '</b> — showing you what deuteranopia does to your own screen, rather than asking '
        + 'you to take the Colour Vision theme on trust.<br>'
        + '<b>' + tx('These follow you, not this browser.') + '</b> Your theme, text size and motion are stored against you '
        + '(b166), so signing in on another device brings them with you — because someone who needs High Contrast '
        + 'needs it everywhere, not only where they first found it.'
        + '</div>')

    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin-top:8px">'
    +   'Standards: <b>WCAG 2.2</b> (1.4.3 / 1.4.6 contrast · 1.4.4 resize text · 2.3.3 animation from interactions) · '
    +   'colour-blind palette <b>' + tx('Okabe–Ito') + '</b>.'
    + '</div>';
}

/**
 * ⭐ THE LOCALE LABEL TABLES, AT MODULE SCOPE — they were `var`s INSIDE localeSettingsHTML, which made them
 * invisible to the profile. Writing 'Devanagari' a second time over in iamGovernedRows is how the Settings
 * picker and the Profile note start disagreeing about what a code is called: two tables, one meaning, no force
 * keeping them equal. The pickers still read these; nothing else changed for them.
 */
var NUMERALS = [['', 'Follow the format'], ['latn', 'Western'], ['arab', 'Eastern Arabic'], ['deva', 'Devanagari']];
var HOURS    = [['', 'Follow the format'], ['h12', '12-hour'], ['h23', '24-hour']];
var CALS     = [['', 'Follow the format'], ['gregory', 'Gregorian'], ['islamic-umalqura', 'Hijri (Umm al-Qura)'], ['indian', 'Indian national'], ['buddhist', 'Buddhist']];
var WEEK     = [['', 'Follow the format'], ['mon', 'Monday'], ['sun', 'Sunday'], ['sat', 'Saturday']];

/**
 * The short name for a stored code — 'deva' → 'Devanagari'. The tables carry a sample after an em dash
 * ('Devanagari — १२३') because a PICKER should show one; a note beside the value should not repeat digits the
 * reader can already see, so the sample is trimmed here rather than kept in a second table.
 *
 * ⚠️ .find() ON AN ARRAY, not a bracket lookup on an object — no prototype chain to walk past, so an unknown
 * code returns the code itself instead of something truthy from Object.prototype.
 */
/**
 * ⭐⭐ WHAT THIS OPTION WOULD ACTUALLY DO, RENDERED. Athi, 2026-08-21: *"I changed to Indian calendar and the
 * result was Sravana, but I was not aware what Indian calendar means until I saw the result. If you change
 * this control, this is the effect — that has to be spelt then and there explicitly."*
 *
 * ⚠️ 'Indian national' NAMES A STANDARD AND DESCRIBES NOTHING. Nobody picks a calendar from its title; they
 * pick it from the date it produces. Numerals and hour cycle already carried a sample and the calendar list —
 * the one whose options are genuinely unguessable — was the single list without one.
 *
 * ⚠⚠ GENERATED, NOT TYPED, AND THAT IS THE REAL CHANGE. The samples that did exist were hand-written strings:
 * 'Devanagari — १२३' was a CLAIM about what Intl does, maintained by whoever last remembered. These are
 * produced by the same engine that will render the app, against today's date, in the reader's own base locale,
 * so a sample can never promise something the setting does not deliver.
 */
function _locSample(kind, code) {
  if (!code) return '';                       /* 'Follow the format' has no effect of its own to show */
  var base = String((CBLocale.tag ? CBLocale.tag() : 'en') || 'en').split('-u-')[0];
  var now  = new Date();
  try {
    if (kind === 'nu') return new Intl.NumberFormat(base + '-u-nu-' + code).format(12345678.9);
    if (kind === 'hc') return new Intl.DateTimeFormat(base + '-u-hc-' + code,
      { hour: '2-digit', minute: '2-digit' }).format(now);
    if (kind === 'ca') return new Intl.DateTimeFormat(base + '-u-ca-' + code,
      { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  } catch (_) { /* ⚠️ an engine that does not know this extension shows the NAME alone rather than a wrong
                    sample — silence is honest here, a guess is not. */ }
  return '';
}

/** [code, name] → [code, 'name — sample'], for the pickers. One place, so every list gets the same treatment. */
function _locWithSamples(table, kind) {
  return table.map(function (t) {
    var s = _locSample(kind, t[0]);
    return [t[0], s ? t[1] + ' — ' + s : t[1]];
  });
}

/**
 * ⭐⭐ TAKE ME TO THE CONTROL THAT DECIDES THIS. Athi, 2026-08-21: *"bringing the format together, that is
 * good — but if we can see the place where the control is changing, that would be great."*
 *
 * ⚠️ THE TWO LINKS AT THE FOOT OF THE SECTION WERE NOT ENOUGH. 'Language and formats →' lands you on a screen
 * with ten controls on it and leaves you to work out which one produced 30 Sravana. A link that gets you to
 * the right SCREEN has done half the job and taken credit for all of it.
 *
 * ⚠️ THE HIGHLIGHT IS THE POINT, NOT THE NAVIGATION. Scrolling to an element that looks like its nine
 * neighbours leaves the reader hunting anyway, so the control is outlined for a moment when it arrives — long
 * enough to find, short enough not to become part of the design.
 *
 * ⚠️ AFTER A PAINT, NOT BEFORE. setSetSec() re-renders; querying for the element in the same tick finds the
 * OLD screen, or nothing. requestAnimationFrame twice — one to let the render commit, one to let layout settle,
 * because scrollIntoView on an element the browser has not measured yet scrolls to the wrong place.
 */
function _locGoto(testid, sec) {
  navTo('settings');
  setSetSec(sec || 'locale');
  var tries = 0;
  var find = function () {
    var el = document.querySelector('[data-testid="' + testid + '"]');
    /* ⚠️ A BOUNDED RETRY, NOT A LOOP. The settings body paints asynchronously; if the element never appears
       (a control removed, a testid renamed) this must give up quietly rather than spin — the reader is already
       on the right screen, which is the fallback the old links offered. */
    if (!el) { if (++tries < 20) requestAnimationFrame(find); return; }
    requestAnimationFrame(function () {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { el.scrollIntoView(); }
      var prev = el.style.outline, prevOff = el.style.outlineOffset;
      el.style.outline = '2px solid var(--blue)';
      el.style.outlineOffset = '3px';
      setTimeout(function () { el.style.outline = prev; el.style.outlineOffset = prevOff; }, 2200);
    });
  };
  requestAnimationFrame(find);
  return false;
}

/**
 * The little arrow beside a value: where this one is decided.
 *
 * ⚠️ AN ARROW, NOT A SENTENCE. 'You can change this in Settings › Localisation › Calendar' is eleven words
 * per row on a screen that already measured 56% explanation. The affordance carries the meaning; the title
 * attribute carries the name for anyone who wants it.
 */
function _locLink(label, testid, sec) {
  var Q = String.fromCharCode(39);
  return ' <a href="#" title="' + esc(label) + '" onclick="return _locGoto(' + Q + testid + Q
    + (sec ? ', ' + Q + sec + Q : '') + ')" style="color:var(--blue);text-decoration:none;font-size:var(--fs-1)">→</a>';
}

/** Are the reader's languages simply what their region hands out, untouched? See the note at its call site. */
function _langsAreDefault() {
  try {
    var mine = (CBLocale.langs && CBLocale.langs()) || [];
    var ri   = CBLocale.regionInfo && CBLocale.regionInfo();
    if (!ri || !ri.langs || !ri.langs.length) return !mine.length;
    return mine.length === 1 && mine[0] === ri.langs[0];
  } catch (_) { return true; }   /* ⚠️ unknown → 'Default'. Claiming a choice nobody made is the worse error. */
}

function _locName(table, code) {
  var row = table.find(function (t) { return t[0] === code; });
  return row ? String(row[1]).split(' — ')[0] : code;
}

/**
 * ⭐⭐ SETTINGS STAGES, IT NO LONGER APPLIES. Athi, 2026-08-21: *"can we create a save button for each section
 * if they are going to change? So it is a deliberate change per item. This will not happen every day, but I
 * believe this will have a larger impact."*
 *
 * ⚠⚠ HE IS RIGHT AND MY FIRST ANSWER WAS TOO NARROW. I had reasoned that these are reader preferences in
 * this browser, instantly visible and instantly reversible, so a Save button would make you commit before you
 * could see the result. The part I left out: every one of them is PUSHED to the account through CBPrefs, so a
 * mis-click does not stay in this browser — it follows the person to every device they sign in on. That is the
 * larger impact, and it makes deliberateness worth more than immediacy.
 *
 * ⭐ SO BOTH, RATHER THAN A TRADE: the card previews the pending choice live, and nothing leaves until Save.
 * The preview works by REPLAYING the staged calls against real storage, rendering, and rolling back — the same
 * code path a save takes, so what you see is what you get rather than a second implementation's guess.
 *
 * ⚠️ AND THE REST OF THE APP KEEPS THE SAVED FORMAT while you are choosing. Only this card previews. A whole
 * screen lurching into Devanagari on the way past a dropdown is the mis-click Athi is describing, not the cure.
 */
/**
 * The pending bar — what is waiting, and the two ways out of it. Absent entirely when nothing is staged, so
 * the screen a reader normally sees is unchanged.
 */
/**
 * ⭐ THE CURRENCY MENU — the region's answer alone at the top, every ISO 4217 code below it.
 *
 * ⚠️ A SUGGESTION IS NOT A FILTER, and the difference is the bug this replaced. Athi, 2026-08-21: *"if the
 * region is selected the currency should be filtered for that region, but otherwise they should be able to set
 * for any currency — the entire table can be showcased."* Both halves matter: floating SGD to the top for a
 * Singapore business saves a scroll through 162 rows; REMOVING the other 161 would recreate the four-currency
 * cap in a nicer costume.
 *
 * ⚠️ THE CURRENT VALUE IS ALWAYS IN THE LIST even when it is neither suggested nor enumerable — an engine
 * without Intl.supportedValuesOf returns null, and a <select> that silently drops what is saved would show the
 * business a currency it does not use and write it on the next save.
 */
function _curPicker(cur) {
  var all  = (CBLocale.currencies && CBLocale.currencies()) || null;
  var mine = (CBLocale.regionCurrencies && CBLocale.regionCurrencies()) || [];
  var top  = mine.slice();
  if (cur && top.indexOf(cur) < 0) top.unshift(cur);        /* what you use is never buried */
  var rest = (all || []).filter(function (c) { return top.indexOf(c) < 0; });
  if (!all) rest = [];                                      /* cannot enumerate → offer what we know, say nothing false */

  var label = function (c) {
    var nm = (CBLocale.currencyName && CBLocale.currencyName(c)) || c;
    return esc(c) + (nm && nm !== c ? ' — ' + esc(nm) : '');
  };
  var optsOf = function (list) {
    return list.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + label(c) + '</option>';
    }).join('');
  };

  /* ⚠️ regionInfo(), NOT a regionName() I remembered writing — it does not exist. locale.js exposes the
     whole record; the name is a field on it. */
  var _ri = CBLocale.regionInfo && CBLocale.regionInfo();
  var regionName = (_ri && _ri.name) || CBLocale.region();
  return '<select class="inp" id="loc-cur" style="margin:0;max-width:320px" onchange="localeSetCurrency(this.value)">'
    + (top.length ? '<optgroup label="' + esc(regionName ? tx('Used in') + ' ' + regionName : tx('In use')) + '">'
                    + optsOf(top) + '</optgroup>' : '')
    + (rest.length ? '<optgroup label="' + esc(tx('All currencies')) + '">' + optsOf(rest) + '</optgroup>' : '')
    + '</select>';
}

/**
 * ⚠⚠ THIS ONE WRITES TO THE SERVER, unlike every other setter on this screen — so it must survive a refusal.
 * The API bounds the value by the constitution and answers CURRENCY_NOT_ALLOWED with the permitted set named;
 * showing that message beats a silent revert, which is what a fire-and-forget save would have produced.
 */
async function localeSetCurrency(code) {
  var want = String(code || '').toUpperCase();
  if (!want) return;
  try {
    /* ⚠️ api() TAKES A REGISTERED KEY, NOT A PATH — api('saveProfile', {body}) is the house call; a raw path
       with {method} is a shape this codebase does not have. */
    await api('saveProfile', { body: { currency_code: want } });
    if (typeof SESSION !== 'undefined' && SESSION) SESSION.currency = want;
    UI._me = null; loadProfile();                       /* re-read, exactly as saveProfile does */
    toast(txf('Prices are now written in {cur}', { cur: want }));
  } catch (err) {
    /* ⚠️ PUT THE OLD VALUE BACK ON THE SCREEN. A <select> that keeps showing the refused choice tells the
       reader it was accepted. */
    toast((err && err.message) || tx('That currency could not be set.'), 'err');
    UI._me = null; loadProfile();
  }
}

function _locPendingBar() {
  var st = UI._locStage || [];
  if (!st.length) return '';
  var Q = String.fromCharCode(39);
  var rowOf = function (o) {
    /* ⚠️ THE VALUE AS THE PICKER SHOWS IT, not the raw code. 'ca=indian' is the thing Athi could not read;
       repeating it in the confirmation would repeat the problem at the moment it matters most. */
    var v = o.args[o.args.length - 1];
    var shown = Array.isArray(v) ? (v.length ? v.join(', ') : tx('follow the region'))
      : (o.fn === 'setExt'
          ? (_locName(o.args[0] === 'nu' ? NUMERALS : o.args[0] === 'hc' ? HOURS : o.args[0] === 'ca' ? CALS : WEEK, v)
             + (_locSample(o.args[0], v) ? ' — ' + _locSample(o.args[0], v) : ''))
          : (v || tx('follow the region')));
    return '<div style="display:flex;gap:8px;padding:2px 0">'
      + '<b style="min-width:132px;font-size:var(--fs-1);color:var(--grey);text-transform:uppercase;letter-spacing:.04em">'
      + esc(o.what) + '</b><div style="flex:1;min-width:0">' + esc(shown) + '</div></div>';
  };
  /* ⚠️ A SURFACE MUST NAME ITS TEXT COLOUR. guard-static flagged this: painting a background and letting
     the text inherit means the two themes can disagree — warn-tint is light in both, so dark-mode inherited
     ink would be pale text on a pale panel.

     ⚠️⚠️ AND THIS COMMENT USED TO SIT BETWEEN `return` AND ITS VALUE. A block comment containing a newline
     counts as a line terminator, so AUTOMATIC SEMICOLON INSERTION turned the statement into a bare `return;`
     — the bar below became unreachable, the function returned undefined, and `_locPendingBar() + body`
     rendered the literal word "undefined" at the top of the pane. Nothing threw and nothing logged.

     ⭐ THE UNSAVED-CHANGES BAR WAS THE ONE THING THAT COULD NOT AFFORD TO FAIL SILENTLY: staging still
     worked, so a change was held and never announced. You would edit a setting, see no confirmation, and
     reasonably conclude it had saved. A comment moved one line up is the whole fix. */
  return '<div data-testid="loc-pending" style="position:sticky;top:0;z-index:3;background:var(--warn-tint);color:var(--on-card);'
    + 'border:1px solid var(--warn-2);border-radius:9px;padding:10px 12px;margin-bottom:10px">'
    + '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;'
    + 'color:var(--on-card);margin-bottom:6px">' + tx('Not saved yet') + '</div>'
    + st.map(rowOf).join('')
    + '<div style="display:flex;gap:8px;margin-top:9px">'
    +   '<button class="btn pri" style="flex:1" onclick="localeSaveLocale()">' + tx('Save') + '</button>'
    +   '<button class="btn" style="flex:1" onclick="localeDiscardLocale()">' + tx('Discard') + '</button>'
    + '</div></div>';
}

function localeSettingsHTML(){
  if (!UI._locStage || !UI._locStage.length) return _localeSettingsBody();
  var snap = CBLocale.snapshot();
  /* ⚠️ QUIETLY — a preview that pushed would sync a value nobody chose, and the rollback would be the only
     part that stayed local. See CBLocale.quietly. */
  return CBLocale.quietly(function(){
    /* ⚠️ THE BAR IS BUILT INSIDE THE PREVIEW, so its sample renders in the pending calendar too — a
       confirmation showing today's date in the OLD calendar would be describing what you are leaving. */
    try { _locReplay(); return _locPendingBar() + _localeSettingsBody(); }
    finally { CBLocale.restore(snap); }
  });
}

function _localeSettingsBody(){
  /* ⚠️ THE QUOTE IS BUILT HERE, NOT IN THE SCRIPT THAT WROTE THIS FILE. Third time: BT, then Q in the palette,
     now Q again. A generator-only constant emitted into shipped code PARSES fine and dies at render. The only
     check that catches it is running the function — which is what caught this one, before it shipped. */
  var Q = String.fromCharCode(39);
  var d = CBLocale.describe();

  /* The option lists and the two builders every card below uses. ⚠️ These were lost when the language/format
     blocks were replaced — the render harness caught it immediately, which is the whole reason it exists. */
  var FORMATS = [
    ['', 'Same as region'],
    ['en-IN', 'India — 12,34,56,789.50 (lakh · crore)'],
    ['en-US', 'United States — 123,456,789.50 (million)'],
    ['en-GB', 'United Kingdom — 123,456,789.50'],
    ['de-DE', 'Germany — 123.456.789,50'],
    ['fr-FR', 'France — 123 456 789,50'],
    ['ar-AE', 'UAE — Arabic, Western digits'],
    ['ar-EG', 'Egypt — Arabic, Eastern digits ١٢٣'],
    ['ja-JP', 'Japan — 123,456,789.50']
  ];

  var cur = (function(){ try { return localStorage.getItem('cb_locale') || ''; } catch(_) { return ''; } })();
  var sel = function(id, list, val, fn){
    return '<select class="inp" data-testid="' + id + '" onchange="' + fn + '(this.value)">'
      /* ⚠️ ESCAPE THE VALUE TOO, not only the label. `o[0]` lands inside `value="…"` — an unescaped quote
         there closes the attribute and everything after it becomes markup. Every list passed here today is
         ours or the engine's, so nothing is exploitable right now; that is precisely why it would survive
         until the day someone passes a list built from stored data, which is one edit away on this screen. */
      + list.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('')
      + '</select>';
  };
  var card = function(inner){ return '<div style="' + _CARD + '">' + inner + '</div>'; };
  var line = function(k, v){
    return '<div style="display:flex;gap:10px;padding:4px 0;font-size:var(--fs-2)">'
      + '<span style="min-width:108px;color:var(--grey)">' + k + '</span>'
      + '<b style="color:var(--on-card);min-width:0;word-break:break-word">' + v + '</b></div>';
  };
  /* Working-day chips. ⚠️ ISO numbering (1 = Monday … 7 = Sunday) throughout, because that is what
     Intl.Locale.weekInfo returns — mixing it with Date.getDay()'s 0 = Sunday moves every due date by one. */
  var DAYFULL = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 7:'Sun' };
  var work = CBLocale.workdays();
  var dayChips = [1,2,3,4,5,6,7].map(function(n){
    var on = work.indexOf(n) >= 0;
    return '<button type="button" data-testid="loc-day-' + n + '" onclick="localeToggleWorkday(' + n + ')"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + ' style="cursor:pointer;font:inherit;border-radius:8px;padding:5px 10px;font-size:var(--fs-2);'
      + 'border:1px solid ' + (on ? 'var(--ok)' : 'var(--line)') + ';'
      + 'background:' + (on ? 'var(--ok-tint)' : 'var(--card)') + ';'
      + 'color:' + (on ? 'var(--ok-2)' : 'var(--grey)') + ';font-weight:' + (on ? 700 : 500) + '">'
      + DAYFULL[n] + '</button>';
  }).join('');

  /* ⚠️ The zone list comes from the ENGINE (Intl.supportedValuesOf), not a table we would have to edit twice a
     year. Where the engine will not supply one, a short list beats an empty select. */
  var tzCur = (function(){ try { return localStorage.getItem('cb_tz') || ''; } catch(_) { return ''; } })();
  var tzAll = CBLocale.zones();
  /* ⚠️ esc() — the zone comes from localStorage (and, via b165, from a row another device wrote), so it is not
     ours to trust. Every OTHER render of it on this screen was escaped; this one label was not, which is exactly
     how one gets missed: the value LOOKS like a constant because it usually reads "Asia/Kolkata". */
  var tzOpts = [['', 'Follow this device — ' + esc(CBLocale.timezone())]].concat(
    (tzAll.length ? tzAll : ['Asia/Kolkata','Asia/Dubai','Asia/Riyadh','Europe/London','Europe/Berlin','America/New_York','UTC'])
      .map(function(z){ return [z, z.split('/').join(' / ')]; }));

  var myCurCode = (typeof SESSION !== 'undefined' && SESSION && SESSION.currency) || 'INR';
  var wi = CBLocale.weekInfo() || {};
  var DAY = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 7:'Sun' };
  var weekend = (wi.weekend || []).map(function(x){ return DAY[x] || x; }).join(' + ') || '—';

  /**
   * ⭐⭐ PRESENTATION AND LANGUAGE ARE NOW TWO SEPARATE CHOICES, AND THE FIRST BOUNDS THE SECOND.
   *
   * Athi, 2026-08-18: *"under locale, we have to split presentation style and languages separately… if the
   * language and the style contradicts then it will be a problem, so we have to specify, for this style, these
   * are the languages compatible out of which you can choose say two or three max."*
   *
   * ⚠️ Before this the screen offered four language buttons and nine formats as independent lists — 36
   * combinations, most of which no reader on earth wants. Arabic words with lakh grouping and a Buddhist
   * calendar was two clicks away and nothing said it was wrong.
   */
  var d = CBLocale.describe();
  var region = CBLocale.region();
  var chosen = CBLocale.langs();
  var allowed = CBLocale.allowedLangs();

  var regionOpts = [['', 'Not set — show me everything']].concat(
    Object.keys(CBLocale.REGIONS).map(function (k) {
      var r = CBLocale.REGIONS[k];
      return [k, r.name + ' — ' + r.format + ' · ' + r.langs.slice(0, 4).map(function (x) { return CBLocale.langName(x); }).join(', ')
        + (r.langs.length > 4 ? ' …' : '')];
    }));

  /**
   * ⚠️ A LANGUAGE IS A TOGGLE IN AN ORDERED LIST, NOT A RADIO. RFC 4647 calls this a language priority list —
   * "I read Tamil, then English, then Hindi" — and the ORDER is what decides which version of a catalogue a
   * reader is shown when several exist. So each chosen language carries its rank, visibly.
   */
  var langChips = allowed.map(function (code) {
    var at = chosen.indexOf(code);
    var on = at >= 0;
    var full = !on && chosen.length >= CBLocale.MAX_LANGS;
    return '<button type="button" data-testid="loc-lang-' + code + '"'
      + ' onclick="localeToggleLang(' + Q + code + Q + ')"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + (full ? ' disabled' : '')
      + ' style="border:1px solid ' + (on ? 'var(--blue)' : 'var(--line)') + ';'
      + 'background:' + (on ? 'var(--blue-tint-bg)' : 'var(--card)') + ';'
      + 'color:' + (on ? 'var(--blue)' : (full ? 'var(--grey-4)' : 'var(--on-card)')) + ';'
      + 'opacity:' + (full ? '.5' : '1') + ';cursor:' + (full ? 'not-allowed' : 'pointer') + ';'
      + 'border-radius:9px;padding:5px 11px;font-size:var(--fs-2);font-weight:' + (on ? 700 : 500) + ';margin:0 6px 6px 0">'
      + (on ? '<b style="font-family:\'Space Mono\',monospace">' + (at + 1) + '</b> ' : '')
      + esc(CBLocale.langName(code)) + '</button>';
  }).join('');

  return _misHead('Localisation', '')

    /* ── 1 · PRESENTATION ───────────────────────────────────────────────────────────────────────────────── */
    + card('<label class="fl">Presentation <span style="font-weight:400;color:var(--grey)">— how figures are written</span></label>'
        + sel('loc-region', regionOpts, region, 'localeSetRegion')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;line-height:1.55">'
        + 'A region sets the number, money, date and time conventions <b>and the languages it makes sense to read '
        + 'in</b>. Choosing one prunes any language it does not admit, rather than leaving a combination that '
        + 'contradicts itself.<br>'
        + '⚠️ <b>' + tx('Grouping is not a separate switch, and that is deliberate.') + '</b> Millions or lakhs is a property of '
        + 'the region itself — CLDR knows India groups 12,34,56,789 and the US groups 123,456,789. Offering it '
        + 'apart would let you pick a combination no locale on earth uses.'
        + '</div>')

    + card('<label class="fl">Or a format directly <span style="font-weight:400;color:var(--grey)">— if no region fits</span></label>'
        + sel('loc-format', FORMATS, cur, 'localeSetFormat'))

    /* ── 2 · LANGUAGES ──────────────────────────────────────────────────────────────────────────────────── */
    + card('<label class="fl">Languages you read <span style="font-weight:400;color:var(--grey)">— up to ' + CBLocale.MAX_LANGS + ', in order</span></label>'
        + '<div style="margin:4px 0 6px">' + langChips + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55">'
        + 'The <b>order matters</b>. When a catalogue exists in more than one language you are shown the highest '
        + 'one on this list that its author actually wrote. This is a <b>language priority list</b> (RFC 4647) — '
        + 'the same thing your browser sends every website as <code>' + tx('Accept-Language') + '</code>.'
        + (region ? '' : '<br>⚠️ No region set, so every language we name is offered. Pick a region above to see only the ones that fit.')
        + '</div>')

    /* ⚠️⚠️ THE RULE THAT MATTERS MOST ON THIS SCREEN, RAISED FROM A FOOTNOTE TO ITS OWN CARD. Athi, twice:
       *"the panel and content in the panel, catalogue should stay in the language the origin is, no direct
       conversion at all."* Everything above chooses BETWEEN versions a human wrote. Nothing here produces text
       no human wrote, and that boundary is the reason a chit can be a shared record at all. */
    + '<div style="' + _CARD + ';border-color:var(--warn-tint);background:var(--warn-tint);color:var(--on-card)">'
    +   '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--warn-2);margin-bottom:5px">' + tx('Content is never converted') + '</div>'
    +   '<div style="font-size:var(--fs-2);line-height:1.6">'
    +   'These settings change the <b>chrome</b> — labels, buttons, and how figures are written. They never touch '
    +   'what people wrote. A product name, a catalogue entry, a chit subject, a message and a dispute reason stay '
    +   'in the language their author used.<br>'
    +   '<b>' + tx('Choosing a language picks between versions a human wrote — it does not translate anything.') + '</b> '
    +   'A chit is a shared record, and one that read differently to each party would not be a record.'
    +   '</div>'
    + '</div>'

    + card('<label class="fl">Numbering system <span style="font-weight:400;color:var(--grey)">— <code>-u-nu-</code></span></label>'
        + sel('loc-nu', _locWithSamples(NUMERALS, 'nu'), CBLocale.getExt('nu'), 'localeSetNu'))

    + card('<label class="fl">Hour cycle <span style="font-weight:400;color:var(--grey)">— <code>-u-hc-</code></span></label>'
        + sel('loc-hc', _locWithSamples(HOURS, 'hc'), CBLocale.getExt('hc'), 'localeSetHc'))

    + card('<label class="fl">Calendar <span style="font-weight:400;color:var(--grey)">— <code>-u-ca-</code></span></label>'
        + sel('loc-ca', _locWithSamples(CALS, 'ca'), CBLocale.getExt('ca'), 'localeSetCa'))

    + card('<label class="fl">First day of week <span style="font-weight:400;color:var(--grey)">— <code>-u-fw-</code></span></label>'
        + sel('loc-fw', WEEK, CBLocale.getExt('fw'), 'localeSetFw')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:7px;line-height:1.55">'
        + 'Which column a calendar starts on. Separate from which days you actually <i>work</i> — that is below.'
        + '</div>')

    /* ══ WORKING DAYS ═══════════════════════════════════════════════════════════════════════════════════════
     * ⚠️⚠️ LOAD-BEARING, NOT A PREFERENCE. "Due in three working days" lands on a different DATE depending on
     * this, and until now the app had no idea. CLDR supplies the region's answer; a business overrides it
     * because a shop that opens on Sunday is a fact, not an error to be corrected. */
    + card('<label class="fl">Working days <span style="font-weight:400;color:var(--grey)">— what a due date counts</span></label>'
        + '<div data-testid="loc-workdays" style="display:flex;gap:5px;flex-wrap:wrap;margin:5px 0 7px">' + dayChips + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55">'
        + (CBLocale.hasWorkdayOverride()
            ? 'You have set these yourself. <a href="#" onclick="localeResetWorkdays();return false" data-testid="loc-workdays-reset" style="color:var(--blue)">' + tx('Use the regional default') + '</a> instead.'
            : 'These come from <b>' + tx('CLDR') + '</b> for your region — ' + esc(weekend) + ' is the weekend here. Tap a day to override.')
        + '<br>⚠️ <b>' + tx('The weekend is not Saturday and Sunday everywhere.') + '</b> Saudi Arabia\'s is Friday + Saturday; '
        + 'India\'s is Sunday alone; the UAE moved to Saturday + Sunday in 2022. Any due date counted in '
        + '<i>working</i> days lands on a different day in Riyadh, Mumbai and Berlin.'
        + '</div>')

    /* ══ TIME ZONE ══════════════════════════════════════════════════════════════════════════════════════════
     * ⚠️ One immutable event, three different answers to "when did this happen", because every date was rendered
     * in whatever zone the browser happened to be in. */
    + card('<label class="fl">' + tx('Time zone') + '</label>'
        + sel('loc-tz', tzOpts, tzCur, 'localeSetTz')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;line-height:1.55">'
        + 'Now showing times in <b>' + esc(CBLocale.timezone()) + '</b>. '
        + 'A chit stamped 19:00 in Dubai reads 20:30 in Mumbai and 16:00 in London — the same instant, three '
        + 'answers. Leave this on your device unless you want your <i>business\'s</i> clock wherever you are.'
        + '</div>')

    /* ══ CURRENCY ═══════════════════════════════════════════════════════════════════════════
     * ⭐⭐ THE CONTROL LIVES HERE NOW — IT USED TO POINT AT THE PROFILE, AND THE PROFILE POINTED BACK. Athi,
     * 2026-08-21: *"why have we brought the currency to choose in profile? Let it be in settings only."* His
     * rule from the day before decides it: Settings changes, Profile shows.
     *
     * ⚠️ THIS IS THE ONE CONTROL ON THIS SCREEN THAT IS NOT YOURS. Everything else in Localisation is a reader
     * preference in this browser's storage; currency is a column on the business and changes what every
     * colleague and every counterparty sees. So it is gated to the entity and says whose it is — an employee
     * reads it, and reading is the correct amount of power over a company's trading currency.
     *
     * ⚠️ THE LIST IS GROUPED, NOT DUMPED. Athi, 2026-08-21: *"a small list is always good, human brain
     * cannot take multiple things in one go."* 162 codes in one flat menu is the failure he is describing, so
     * the region's own currency sits alone at the top and the rest are one <optgroup> below it — a list of one
     * for the answer that is almost always right, with everything still reachable.
     */
    + card('<label class="fl">' + tx('Currency') + '</label>'
        + '<div data-testid="loc-currency" style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + (profCanEdit() ? _curPicker(myCurCode)
           : '<b>' + esc(myCurCode) + ' ' + esc(CBLocale.symbol(myCurCode)) + '</b> · '
             + '<span style="color:var(--grey)">' + tx('set by the business') + '</span>')
        + '<div style="margin-top:7px;color:var(--grey)">' + tx('Your prices are written in this.') + ' '
        + esc(CBLocale.money(123456.5, myCurCode)) + '</div>'
        + '<div style="margin-top:7px;color:var(--warn-2)">⚠️ ' + tx('Amounts are never converted.') + ' '
        + '<span style="color:var(--grey)">' + tx('A supplier quoting in USD stays') + ' '
        + esc(CBLocale.money(123456.5, 'USD')) + '.</span></div>'
        + '</div>')

    /* THE PREVIEW — see the note on this function. Every control above is an abstraction; this is the only place
       the choice becomes visible before it is made. */
    + '<div style="' + _CARD + ';background:var(--neutral-tint);color:var(--on-card)" data-testid="loc-preview">'
    +   '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:6px">' + tx('How this looks') + '</div>'
    +   line('Number', esc(CBLocale.number(123456789.5)))
    +   line('Money', esc(CBLocale.money(123456.5, 'INR')) + ' &nbsp;·&nbsp; ' + esc(CBLocale.money(123456.5, 'USD')))
    +   line('Date', esc(CBLocale.date(Date.now())))
    +   line('Time', esc(CBLocale.time(Date.now())))
    +   line('Sorting', esc(CBLocale.sort(['Zebra','Ähnlich','apple','Ökonom','banana']).join(' · ')))
    +   line('Direction', d.dir === 'rtl' ? 'right to left ←' : 'left to right →')
    +   line('Locale tag', '<code>' + esc(CBLocale.tag()) + '</code>')
    + '</div>'

    + card('<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">' + tx('What is never translated') + '</div>'
        + '<div style="font-size:var(--fs-2);line-height:1.55;color:var(--on-card)">'
        + 'Product names, chit subjects, message text and dispute reasons stay in the words their author wrote. '
        + '<b>' + tx('A chit is a shared record') + '</b> — one that read differently to each party would not be a record.</div>');
}
/** Choosing a region sets the format AND prunes languages it does not admit — see the note in locale.js. */
/**
 * ⭐⭐ NOTHING APPLIES UNTIL SAVE. Athi, 2026-08-21: *"can we create a save button for each section if they
 * are going to change? So it is a deliberate change per item. This will not happen every day, but I believe
 * this will have a larger impact."*
 *
 * ⚠⚠ I FIRST ARGUED AGAINST THIS AND THE ARGUMENT HAD A HOLE. My reasoning was that these are reader
 * preferences in this browser — instantly visible, instantly reversible — so a Save button would make you
 * commit before you could see the result. What I left out is that every one of them is PUSHED to the account
 * through CBPrefs. A mis-click does not stay in this browser; it follows the person to every device they sign
 * in on. That is the larger impact, and it outweighs immediacy.
 *
 * ⭐ SO BOTH, RATHER THAN A TRADE. The card previews the pending choice live — you still see the date before
 * you keep it — and nothing leaves until Save.
 *
 * ⚠️ ONE BAR NAMING EVERY PENDING ITEM, NOT ONE BUTTON PER CARD. These controls are not independent:
 * choosing a region PRUNES languages it does not admit. A Save button on the Region card that committed only
 * the region would be claiming a separation the data does not have — and one that committed the language loss
 * too would be doing something its label did not say. The bar lists each pending change by name, which is the
 * per-item deliberateness Athi asked for, without inventing an independence these settings do not have.
 */
/**
 * ⭐ ONE STAGED CHANGE. The control does not apply — it records what it WOULD do, and the card repaints
 * showing that. Nothing reaches storage or the account until Save.
 *
 * ⚠️ OPERATIONS, NOT VALUES. setRegion() prunes languages the region does not admit; setWorkdays() refuses
 * to empty the week. Staging the VALUE and writing it at Save would skip those rules, so the preview would
 * show one outcome and the save produce another. Replaying the CALL is the only way the two agree.
 *
 * ⚠️ LAST WRITE PER CONTROL WINS. Picking three regions in a row must stage one change, not three — and a
 * replay of all three would be slower and, for setRegion, would prune against the intermediate ones.
 */
function _locStage(what, fn, args) {
  UI._locStage = (UI._locStage || []).filter(function (o) {
    /* setExt is four controls sharing one function — they are the same control only if the subtag matches. */
    return o.fn !== fn || (fn === 'setExt' && o.args[0] !== args[0]);
  });
  UI._locStage.push({ what: what, fn: fn, args: args });
  loadSettings();          /* ⚠️ the CARD repaints; renderApp() deliberately does not run — see the wrapper. */
}

function _locReplay() {
  (UI._locStage || []).forEach(function (o) { CBLocale[o.fn].apply(CBLocale, o.args); });
}

/** What is waiting, named — so the Save button can say what it is about to do. */
function _locPending() {
  var seen = [];
  (UI._locStage || []).forEach(function (o) { if (seen.indexOf(o.what) < 0) seen.push(o.what); });
  return seen;
}

/**
 * ⚠️ UNDO SURVIVES THE SAVE, and it is not redundant with staging. Staging stops the ACCIDENT — a stray
 * click on a dropdown. Undo covers the DELIBERATE change that turned out wrong once you saw the whole app in
 * it. Different mistakes, different moments.
 */
function localeSaveLocale() {
  var pending = _locPending();
  if (!pending.length) return;
  var before = CBLocale.snapshot();
  _locReplay();
  UI._locStage = [];
  renderApp(); _capShowDetail(); loadSettings();
  toast(txf('{what} saved', { what: pending.join(', ') }), function () {
    CBLocale.restore(before);
    renderApp(); _capShowDetail(); loadSettings();
    toast(txf('{what} put back', { what: pending.join(', ') }));
  });
}

function localeDiscardLocale() {
  if (!(UI._locStage || []).length) return;
  UI._locStage = [];
  loadSettings();
  toast(tx('Nothing was changed.'));
}

function localeSetTz(v){ _locStage(tx('Time zone'), 'setTimezone', [v]); }
/**
 * ⚠️ THE LAST WORKING DAY CANNOT BE REMOVED. A business with no working days has no due dates at all, and every
 * SLA calculation would divide by an empty week — a state the UI should refuse rather than the maths discover.
 */
/**
 * ⚠⚠ A TOGGLE READS BEFORE IT WRITES, SO IT MUST READ THE STAGED LIST. CBLocale.workdays() and .langs()
 * return what is SAVED. Untick Saturday, then untick Friday: the second call would still see Saturday and
 * hand it back, so the first click would silently undo itself. The single-value pickers escape this because
 * they overwrite; a toggle accumulates, and accumulating onto a stale base loses every click but the last.
 */
function _locStaged(fn, live) {
  var last = null;
  (UI._locStage || []).forEach(function (o) { if (o.fn === fn) last = o; });
  return last ? last.args[0].slice() : live();
}

function localeToggleWorkday(n){
  var cur = _locStaged('setWorkdays', function(){ return CBLocale.workdays(); }), at = cur.indexOf(n);
  if (at >= 0) { if (cur.length > 1) cur.splice(at, 1); } else cur.push(n);
  _locStage(tx('Working days'), 'setWorkdays', [cur]);
}
/** Clearing the override returns to CLDR's answer for the region — not to a hardcoded Mon–Fri. */
function localeResetWorkdays(){ _locStage(tx('Working days'), 'setWorkdays', [[]]); }
function localeSetRegion(v){ _locStage(tx('Region'), 'setRegion', [v]); }
/**
 * ⚠️ APPEND, DO NOT REPLACE — the list is ORDERED and the order is the feature. Toggling a language on puts it
 * last (lowest priority); toggling it off closes the gap. Reordering by re-selecting is a smaller, separate
 * design problem, and pretending a toggle could express rank would have made the order silently arbitrary.
 * ⚠️ The last remaining language cannot be removed: a reader with no languages matches nothing at all.
 */
function localeToggleLang(code){
  var cur = _locStaged('setLangs', function(){ return CBLocale.langs(); }), at = cur.indexOf(code);
  if (at >= 0) { if (cur.length > 1) cur.splice(at, 1); }
  else if (cur.length < CBLocale.MAX_LANGS) cur.push(code);
  _locStage(tx('Languages'), 'setLangs', [cur]);
}
function localeSetFormat(v){ _locStage(tx('Format'), 'setLocale', [v]); }
/* One handler shape per subtag — each re-renders so the preview above moves with the choice. */
function localeSetNu(v){ _locStage(tx('Numbering system'), 'setExt', ['nu', v]); }
function localeSetHc(v){ _locStage(tx('Hour cycle'), 'setExt', ['hc', v]); }
function localeSetCa(v){ _locStage(tx('Calendar'), 'setExt', ['ca', v]); }
function localeSetFw(v){ _locStage(tx('First day of week'), 'setExt', ['fw', v]); }


function paintSettings(s, _daOpts){ const h=document.getElementById("setbody"); if(!h)return;
  { const k = setSec();
    const notYet = '<div style="background:var(--danger-tint);border:1px solid #f0c9c6;border-radius:9px;padding:8px 11px;font-size:var(--fs-1);color:var(--disp);margin-bottom:11px">⏳ These preferences are saved but <b>not yet active</b> — they don\'t change behaviour yet.</div>';
    var out = "";
    if (k === "locale") out = localeSettingsHTML();
    else if (k === "appearance") out = appearanceSettingsHTML();
    else if (k === "standards") {
      /**
       * ⚠️ THE REGISTER MOVED TO ITS OWN CAPABILITY (shared with the Legend), so it may not be here yet. Calling
       * standardsSettingsHTML() blind would throw on `STANDARDS is not defined` and paint an empty pane —
       * which reads as "we follow no standards", the worst possible failure for this particular screen.
       */
      if (typeof STANDARDS === 'undefined') {
        out = _misHead('Standards', '')
            + '<div style="' + _CARD + ';color:var(--grey);font-size:var(--fs-2)">' + tx('Loading the register…') + '</div>';
        ensureCap('standards').then(function(){ if (setSec() === 'standards') { _capShowDetail(); loadSettings(); } })
          .catch(function(e){ var h=document.getElementById('setbody'); if(h) h.innerHTML = scrErr(e); });
      } else out = standardsSettingsHTML();
    }
    else if (k === "work") out = _misHead('Work', '')
      + `<div style="${_CARD}">${notYet}
      ${/**
         * ⭐⭐ THE SAME CONTROL, NOT A SECOND ONE. Athi, 2026-08-20: *"in the settings, we have to include to
         * change the type, either goods or service, in the settings so the type of work it takes care of."*
         *
         * ⚠️ IT WRITES THE SAME COLUMN AND READS THE SAME VALUE as the Business section on the profile. Two
         * pickers for one fact is how a screen comes to disagree with itself — the thing this whole day has
         * been removing. Here it is a POINTER, not a copy: it states what is set and sends the reader to the
         * one place that sets it. Settings › Work is where a person asks "what kind of work do we do", so the
         * answer belongs on it; the CONTROL does not have to.
         */''}
      <div class="kv" style="margin-bottom:9px"><b>${tx('Supplies')}</b> · ${esc((UI._me && UI._me.supplies) || 'goods')}
        <a href="#" onclick="navTo('profile');profSetSec('identity');UI._iamOpen=Object.assign(UI._iamOpen||{},{profile:true});return false"
           style="color:var(--blue);font-size:var(--fs-1);margin-inline-start:6px">${tx('Change in Business')} <span class=arw>→</span></a></div>
      <label class="fl">${tx('Task assignment')}${helpQ('work.assignment', 'How tasks reach people')}</label><select class="inp" id="st_am">${opt(["pull","push","both"],s.assignment_model||"both")}</select>
      <label class="fl">${tx('Default max tasks per')} ${TERM.coassist}</label><input class="inp" id="st_mt" inputmode="numeric" value="${esc(s.default_max_tasks||10)}">
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_av" ${s.all_task_visible?'checked':''}> All tasks visible to all co-assists</label>
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_ar" ${s.auto_return_on_short_break?'checked':''}> ${tx('Auto-return tasks on short break')}</label>
      <div class="err" id="st_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveSettings()">${tx('Save settings')}</button></div>`
      /* ⚠️ A DEAD CROSS-REFERENCE LIVED HERE. It sent a reader to "Profile → Identity" for the naming rules,
         set UI._namingOpen to expand them, and pointed at NAMING — a table deleted earlier today with its only
         renderer. The link would have opened the right screen and shown nothing.

         ⭐ A POINTER IS A DEPENDENCY. It survived because deleting the target did not touch the file that
         pointed at it, which is the same drift as a subtitle nobody owns. The naming rules still exist in
         NAMING.md and are enforced by the API; a screen does not need to say so. */
      + autoAssignCard(s,_daOpts) + aiSettingsCard();
    else if (k === "policy") out = _misHead('Policy', '')
      + policyFlagsCard()
      /**
       * ⚠️ THIS CARD USED TO RE-DECLARE THE ATTACHMENT RULES. It carried its own `<input>`s pre-filled with
       * `image, pdf, docx, xlsx, csv, zip` and `10` — the exact strings ALSO written into the Constitution layer,
       * as two independent literals in this same file. Nothing read one from the other, nothing compared them, and
       * neither was saved anywhere, so they could sit disagreeing forever with no symptom.
       *
       * Under Model A the declaration lives in GOV and this screen REFERS to it. The inputs are gone on purpose:
       * an editable field for a value this screen does not own is the same lie as "you can change this" on a row
       * with no control. When the layer marks it `advisory` AND an edit path exists, the control belongs here —
       * not before.
       */
      + '<div style="border:1px solid var(--line);border-radius:12px;padding:13px;margin-top:10px">'
        + '<div class="sec" style="margin:0 0 8px">' + tx('📎 Attachment policy') + '</div>'
        + '<div class="misnote" style="margin-bottom:9px">Set for your business. Shown here.</div>'
        + govRefHTML('Attachment types') + govRefHTML('Attachment max size')
      + '</div>';
    else if (k === "channels"){ out = _misHead('Channels', '') + channelsCard();
      loadChannels();   // async — the card paints itself in when the read lands
    }
    /* ⚠️ NO SECTION HEADING HERE (Athi: *"governance, the layers your entity minted under, not required.. just
       1. Constitution under Governance"*). The rail row already says Governance and the selected layer is the
       subject — repeating the section name above it pushed the actual content down for no information. */
    else if (k === "governance") out = _misBack() + govLayersBlock();
    else if (k === "blueprints") out = _misHead('Work patterns', '') + blueprintSettingsHTML();
    /* One assignment, so the end marker is appended in one place rather than five — and cannot be forgotten on a
       branch added later. */
    h.innerHTML = out + (out ? _capEnd() : '');
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
  /**
   * ⚠️ `def` WAS `both` HERE TOO — A THIRD DECLARATION OF ONE DEFAULT. The engine (routes/chits.js) did
   * `received`, lib/policy.js said `both`, and so did this. Three statements of one rule, two of them wrong.
   * ⭐ Athi settled it 2026-08-16: *"mostly it is task, a billing counter, very rarely this become order… so the
   * default is task, if the user changes to order copy, then we need to honour that"* — which is exactly what the
   * engine already did. The saved column is read first; this is only the fallback, so an explicit choice stands.
   * ⚠️ Guarded by tests/policy-defaults.test.js in the API repo, which reads BOTH sides and fails if they part.
   */
  { key:'self_copy_pref',    label:'Self-chit copy',        type:'enum',   options:['received','both','sent'],
    labels:{ received:'Task only', both:'Both Task and Order', sent:'Order only' },
    def:'received', level:'entity',        gov:'entity',   help:'' },
  { key:'chit_expiry_days',  label:'Chit expiry (days)',    type:'number', def:0,  level:'work-pattern', gov:'chosen',   help:'0 = no expiry' },
  { key:'retention_days',    label:'Retention (days)',      type:'number', def:0,  level:'entity',        gov:'chosen',   help:'0 = keep' },
  { key:'dispute_scope',     label:'Dispute messages',      type:'enum',   options:['per-party','shared'],          def:'per-party', level:'platform', gov:'bound', help:'Set by the platform' },
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
  if(_polLocked(def.gov)) return '<span style="font-weight:700;font-size:var(--fs-2)">'+esc(String(v))+'</span> <span style="font-size:var(--fs-1)" title="locked / inherited — cannot change here">🔒</span>';
  var dis=_POL.busy?' disabled':'';
  /**
   * ⚠️ THE VALUE IS THE CODE; THE LABEL IS FOR A PERSON. This rendered raw enum codes — a dropdown offering
   * "both · sent · received" against a setting about self-chits, where the words a person recognises are Task and
   * Order. `received` means "Task only" and nothing on screen said so. Athi, 2026-08-16, reasoning it out loud:
   * *"mostly it is task, a billing counter, very rarely this become order"* — that is the vocabulary, and the
   * control should have been speaking it.
   * ⚠️ `value` stays the code, so what is SENT is unchanged. Only the words move.
   */
  if(def.type==='enum') return '<select'+dis+' data-testid="pol-'+esc(def.key)+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">'+def.options.map(function(o){ var lbl=(def.labels&&def.labels[o])||o; return '<option value="'+esc(o)+'"'+(String(v)===String(o)?' selected':'')+'>'+esc(lbl)+'</option>'; }).join('')+'</select>';
  if(def.type==='number') return '<input type="number"'+dis+' data-testid="pol-'+esc(def.key)+'" value="'+esc(String(v))+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="width:90px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">';
  return '<input'+dis+' value="'+esc(String(v))+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">';
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
    + '<span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--ok-tint);color:var(--ok-2);border-radius:5px;padding:1px 6px">inbound · live</span></div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin-bottom:8px">Bind the number or address customers write to. Anything sent there lands in <b>' + tx('📨 Intake') + '</b> — raw, for you to confirm into a chit. Nothing here can send on your behalf.</div>';
  if(_CH.busy && !_CH.data) return head+'<div class="loadwrap" style="justify-content:flex-start;padding:6px 0"><span class="spin"></span> reading your channels…</div>';
  /* ⚠️ A MISSING ENDPOINT IS NOT A BROKEN SCREEN, and must not be reported as one. The API deploys separately from
     this page, so a web release can land first — "Could not read your channels" would send someone hunting for a
     fault in their own account. Name the actual state: the server has not shipped this yet. */
  if(_CH.notDeployed) return head+pendingNote('this server has not shipped channels yet');
  if(_CH.err) return head+'<div style="background:var(--danger-tint);border:1px solid #f0c9c6;border-radius:9px;padding:9px 11px;font-size:var(--fs-2);color:var(--disp)">'+esc(_CH.err)+'</div>';
  if(!_CH.data) return head+'<div style="font-size:var(--fs-2);color:var(--grey)">Not loaded.</div>';
  /* The route answers 200 with a note when the table is not there — say which it is, because "no channels" and
     "the store does not exist" look identical on screen and mean entirely different things. */
  if(_CH.data.note) return head+'<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:var(--fs-2);color:var(--warn-3)">The channel map is not migrated on this environment ('+esc(_CH.data.note)+'). The panel is here; the table is not.</div>';
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
  var pill = live ? ['var(--ok-2)','var(--ok-tint)','receiving']
           : (bound && !verified) ? ['var(--warn-2)','var(--warn-tint)','claimed — awaiting confirmation']
           : (!c.provider_configured && bound) ? ['var(--warn-2)','var(--warn-tint)','waiting on a provider account']
           : (c.provider_configured && !bound) ? ['var(--warn-2)','var(--warn-tint)','configured — nothing bound yet']
           : ['var(--grey-2)','var(--blue-tint-bg)','not set up'];
  return '<div style="padding:10px 0;border-bottom:1px solid var(--line)" data-testid="ch-row-'+esc(c.key)+'">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<span style="font-weight:600;font-size:var(--fs-2)">'+esc(c.name)+'</span>'
    + '<span style="font-size:var(--fs-1);font-weight:800;color:'+pill[0]+';background:'+pill[1]+';border-radius:5px;padding:1px 7px" data-testid="ch-status-'+esc(c.key)+'">'+pill[2]+'</span>'
    + '<span style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--blue);cursor:pointer;font-weight:600" data-testid="ch-add-'+esc(c.key)+'" onclick="chToggleAdd(\''+esc(c.key)+'\')">'+(_CH.adding===c.key?'cancel':'+ bind')+'</span>'
    + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">'+esc(c.hint)+'</div>'
    /* ⚠️ REPLIES ARE A SEPARATE CREDENTIAL, so a separate line. Receiving and sending are not one switch: the app
       secret verifies inbound, WHATSAPP_TOKEN sends. Saying "connected" once would promise replies we cannot make.
       Only shown where the channel actually has a return leg. */
    + (c.key==='whatsapp' ? '<div style="font-size:var(--fs-1);margin-top:3px;color:'+(c.outbound_configured?'var(--ok-2)':'var(--grey)')+'">'
        + (c.outbound_configured
            ? '↩ replies on — status changes go back to the customer, within their 24-hour window'
            : '↩ replies off — needs WHATSAPP_TOKEN. Messages still arrive; nothing goes back.')
        + '</div>' : '')
    + (c.bindings||[]).map(function(b){
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:var(--fs-2)">'
          + '<span style="font-family:ui-monospace,Menlo,monospace">'+esc(b.address)+'</span>'
          + (b.label?'<span style="color:var(--grey)">'+esc(b.label)+'</span>':'')
          /* declared vs verified — asserted is not confirmed, and the difference is visible. */
          /* declared vs verified — and what DECLARED actually costs you, said in the row rather than in a footnote:
             a claim that has not been confirmed receives nothing at all. */
          + '<span style="font-size:var(--fs-1);font-weight:800;color:'+(b.status==='verified'?'var(--ok-2)':'var(--warn-2)')+';background:'+(b.status==='verified'?'var(--ok-tint)':'var(--warn-tint)')+';border-radius:5px;padding:1px 6px" title="'+(b.status==='verified'?'confirmed by the platform — messages sent here reach you':'not confirmed yet — messages sent to this number reach nobody')+'">'+esc(b.status==='verified'?'verified'+(b.verified_via?' · '+b.verified_via:''):'declared — not receiving yet')+'</span>'
          + '<span style="margin-inline-start:auto;cursor:pointer;color:var(--grey-4)" title="Unbind" data-testid="ch-del" onclick="chUnbind(\''+esc(b.id)+'\')">✕</span></div>'
          /**
           * ⚠️ HANDS-FREE, PER LINE (b131). Athi: *"no one will sit and create a chit from whatsapp, it has to be
           * automatic without anyone's presence."*
           *
           * ⚠️ THE SWITCH IS NOT THE PERMISSION, and the row says so: on an unverified line it reads "waiting on
           * verification" rather than "on", because a binding that receives nothing cannot raise anything either.
           * Two independent conditions, and a toggle that claimed otherwise would be the lie.
           */
          + (b.auto_raise===undefined ? '' :
             '<label style="display:flex;align-items:center;gap:6px;margin:5px 0 0 10px;font-size:var(--fs-1);color:var(--grey);cursor:pointer">'
             + '<input type="checkbox" data-testid="ch-autoraise" '+(b.auto_raise?'checked':'')+' onchange="chSetAutoRaise(\''+esc(b.id)+'\',this.checked)">'
             + '<span>Raise messages on this line <b>automatically</b>'
             + (b.auto_raise && b.status!=='verified' ? ' <span style="color:var(--warn-2);font-weight:700">— waiting on verification</span>' : '')
             + '<br><span style="font-size:var(--fs-1)">' + txf('A chit appears in your Task list with nobody present. It is still an {inquiry} — a record, not an obligation — and anything the co-assist cannot read stays here in Intake.',
                 { inquiry: '<b>' + tx('inquiry') + '</b>' }) + '</span></span></label>')
          /* ⚠️ TEMPLATES ARE PER-NUMBER, so they hang off the BINDING and not the channel. Meta approves for one
             WhatsApp account; another business's approval says nothing about this one. */
          + (c.key==='whatsapp' ? (c.templates||[]).map(function(t){
              var state=((b.templates||{})[t.name])||'none';
              var col=state==='approved'?['var(--ok-2)','var(--ok-tint)']:state==='pending'?['var(--warn-2)','var(--warn-tint)']:['var(--grey-2)','var(--blue-tint-bg)'];
              return '<div style="margin:5px 0 0 10px;padding:7px 9px;border-inline-start:2px solid var(--line);font-size:var(--fs-1)">'
                + '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-family:ui-monospace,Menlo,monospace">'+esc(t.name)+'</span>'
                + '<span style="font-size:var(--fs-1);font-weight:800;color:'+col[0]+';background:'+col[1]+';border-radius:5px;padding:1px 6px">'+esc(state==='none'?'not approved':state)+'</span>'
                + '<span style="color:var(--grey)">'+esc(t.category)+' · '+esc(t.language)+'</span>'
                + '<span style="margin-inline-start:auto;color:var(--blue);cursor:pointer;font-weight:600" data-testid="ch-tpl-toggle" onclick="chSetTemplate(\''+esc(b.id)+'\',\''+esc(t.name)+'\',\''+(state==='approved'?'pending':'approved')+'\')">'
                + (state==='approved'?'mark not approved':'mark approved')+'</span></div>'
                /* Show the submission text VERBATIM. Describing it would guarantee a mismatch with what Meta
                   approved, and a template whose text differs from the approved one is simply rejected. */
                + '<div style="margin-top:4px;color:var(--grey)">Submit this to Meta word for word:</div>'
                + '<div style="margin-top:2px;padding:5px 7px;background:var(--paper);border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:var(--fs-1);white-space:pre-wrap;color:var(--on-bg)">'+esc(t.body)+'</div>'
                + (state!=='approved' ? '<div style="margin-top:3px;color:var(--warn-2)">Until approved: no sending beyond 24h after the customer writes.</div>' : '')
                + '</div>'; }).join('') : '')
          ; }).join('')
    + (_CH.adding===c.key
        ? '<div style="display:flex;gap:6px;margin-top:8px"><input class="inp" id="ch_addr" placeholder="'+esc(c.placeholder)+'" data-testid="ch-addr" style="flex:1">'
          + '<input class="inp" id="ch_label" placeholder="label (optional)" data-testid="ch-label" style="max-width:140px">'
          + '<button class="composebtn" data-testid="ch-save" onclick="chBind(\''+esc(c.key)+'\')">' + tx('Bind') + '</button></div>'
          + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">'+esc(c.address_label)+' — the address customers write TO. It is a <b>claim</b>: not active until your number is confirmed.</div>'
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
function chSetAutoRaise(id, on){
  if(!on) return _chSetAutoRaise(id, false);
  confirmAsk('Raise messages on this line automatically?',
    'A chit will appear in your Task list <b>without anyone present</b>. It is an inquiry — a record, not an '
    + 'obligation — and it still says the sender is unverified.'
    + '<div style="margin-top:7px">' + txf('Anything the co-assist cannot read stays in {intake} for you.', { intake: '<b>' + tx('Intake') + '</b>' }) + '</div>',
    'Turn it on', function(){ _chSetAutoRaise(id, true); });
  /* ⚠️ The toggle already moved on screen. Cancelling must put it back, and only a reload knows the real state. */
  loadChannels();
}
async function _chSetAutoRaise(id, on){
  try{ await api('channelAutoRaise',{params:{id:id}, body:{on:!!on}}); await loadChannels(); }
  catch(e){ toast((e&&e.message)||'Could not change that.', true); await loadChannels(); }
}
async function chSetTemplate(id, name, state){
  try{ await api('channelTemplate',{params:{id:id}, body:{name:name, state:state}}); await loadChannels(); }
  catch(e){ toast((e&&e.message)||'Could not update the template.', true); }
}
function chUnbind(id){
  confirmAsk('Unbind this address?',
    'Messages sent to it will <b>stop reaching your intake inbox</b>.'
    + '<div style="margin-top:7px">Captures you have already received are untouched.</div>',
    'Unbind', function(){ _chUnbind(id); }, true);
}
async function _chUnbind(id){
  try{ await api('channelUnbind',{params:{id:id}}); await loadChannels(); }
  catch(e){ toast((e&&e.message)||'Could not unbind that.', true); }
}

function policyFlagsCard(){ loadPolicy(); return '<div style="'+_CARD+';margin-top:10px" id="polflags">'+policyFlagsInner()+'</div>'; }
function policyFlagsInner(){
  var rows=POLICY_FLAGS.map(function(def){ return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)">'
    +'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-weight:600;font-size:var(--fs-2)">'+esc(def.label)+'</span>'+govKlass(def.gov)+'<span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--neutral-tint);color:var(--grey-2);border-radius:5px;padding:1px 6px">'+esc(def.level)+'</span></div>'
    /* ⚠️ AN EMPTY help RENDERS NOTHING, NOT AN EMPTY DIV. Four of these were trimmed to direction today and
       one removed outright; without this each would leave a 2px-margined empty element under its control —
       a gap that reads as a rendering fault. Same fix as _misHead when its subtitle went. */
    +(def.help ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.45">'+esc(def.help)+'</div>' : '')+'</div>'
    +'<div style="flex:none;text-align:end;min-width:120px">'+_polControl(def)+'</div></div>'; }).join('');
  /* A setting that cannot be stored must SAY so rather than accept a change it will lose — that is the whole
     failure this card is being rebuilt out of. */
  var warn = !_POL.migrated ? pendingNote('not available on this environment — changes will not save')+'<div style="height:7px"></div>' : '';
  var err = _POL.err ? '<div style="color:var(--disp);font-size:var(--fs-1);margin-top:6px">'+esc(_POL.err)+'</div>' : '';
  return '<div class="sec" style="margin:0 0 4px">🚩 Business rules <span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--ok-tint);color:var(--ok-2);border-radius:5px;padding:1px 6px">saved to your entity</span></div>'
    /* ⭐ GOVERNANCE GRAMMAR → SPEC. "class + level", "platform-bound", "tighten-only" is our vocabulary for
       our mechanism. The person here is deciding one toggle; the grammar behind it is what a reviewer wants. */
    + specNote('settings.policy-flags.grammar',
        'Per-entity toggles cover what the 7-layer block does not yet carry — same governance grammar '
      + '(<b>class</b> + <b>level</b>): 🔒 <b>platform-bound</b> cannot be relaxed · <b>tighten-only</b> may be '
      + 'made stricter · <b>entity</b> is set freely.')
    +warn+rows+err
    +'<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:8px">'
    + txf('Stored on your business, not on this device. {enforced} whether you keep a copy, and whether you buy or sell. Expiry and retention: ⏳ {pending}.', {
        enforced: '<b>' + tx('Working today:') + '</b>', pending: tx('pending') }) + '</div>';
}
function autoAssignCard(s, daOpts){ const m=s.auto_assign_mode||'off';
  return `<div style="${_CARD};margin-top:10px"><div class="sec" style="margin:0 0 6px">🧭 Auto-assign on receipt <span style="font-size:var(--fs-1);font-family:'Space Mono';background:var(--ok-tint);color:var(--ok-2);border-radius:5px;padding:1px 6px">active</span></div>
    <label class="fl">${tx('Mode')}${helpQ('work.autoassign', 'How auto-assign picks someone')}</label><select class="inp" id="st_aam">
      <option value="off"${m==='off'?' selected':''}>${tx('Off — received chits wait in the pool')}</option>
      <option value="default_assignee"${m==='default_assignee'?' selected':''}>${tx('Default assignee — all to one person')}</option>
      <option value="least_loaded"${m==='least_loaded'?' selected':''}>${tx('Least-loaded — balance across the team')}</option>
    </select>
    <label class="fl">${tx('Default / overflow assignee')}</label><select class="inp" id="st_ada">${daOpts}</select>
    ${/* ⚠️⚠️ THE PARAGRAPH THAT WAS HERE IS NOW BEHIND THE "?". Athi, 2026-08-20: *"do we need this message —
          again a ? can take it to assistant and can answer the same."* It explained three separate rules at once:
          who may be assigned, how least-loaded breaks ties and overflows, and what happens on leave. None of them
          is needed to CHOOSE a mode; all of them are needed if you ask why. That is exactly the split the
          assistant exists for — the screen states, the assistant explains.

          ⚠️ IT WAS ALSO WRONG UNTIL AN HOUR AGO: it said "Act / Manager", two levels retired in b173. A
          paragraph nobody re-reads is a paragraph nobody corrects, which is its own argument for moving it. */''}
    <div class="err" id="st_aerr"></div><button class="composebtn" style="margin-top:9px" onclick="saveAutoAssign()">${tx('Save auto-assign')}</button></div>`;
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
    ? '<div style="'+_CARD+'"><div class="sec" id="kb_formhd" style="margin:0 0 6px">' + tx('Publish an answer') + '</div>'
      +'<label class="fl">' + tx('Question') + '</label><input class="inp" id="kb_q" data-testid="kb-question" placeholder="e.g. How do I export to Excel?">'
      +'<label class="fl">' + tx('Answer') + '</label><textarea class="inp" id="kb_a" data-testid="kb-answer" rows="4" placeholder="The answer the assistant should give…" style="width:100%;resize:vertical"></textarea>'
      +'<label class="fl">Context <span style="color:var(--grey);font-size:var(--fs-1)">— screens (comma), or * for everywhere</span></label><input class="inp" id="kb_c" data-testid="kb-context" placeholder="e.g. task, order  (or *)" value="*">'
      +'<div class="err" id="kb_err"></div><div style="display:flex;gap:7px;margin-top:9px"><button class="composebtn" id="kb_pub" data-testid="kb-publish" onclick="publishAnswer()">' + tx('📣 Publish to catalogue') + '</button><button class="composebtn ghost" data-testid="kb-new" onclick="kbNew()">＋ New / clear</button></div>'
      +'<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">' + txf('Add a new answer, or press {edit} on one below to refine it.', {
          edit: '<b>' + tx('Edit') + '</b>' }) + '</div>'
      /* ⭐ "catalogue → projection" is how it works, not what to do. */
      + specNote('assist.answers.projection', 'Answers are served to the assistant instantly (catalogue <span class=arw>→</span> projection).')
      + '</div>'
    : '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:11px 13px;font-size:var(--fs-2);color:var(--warn-3);margin-bottom:11px">This is the help-desk knowledge base. Queries arrive as chits in <b>' + tx('GOV-01-Help') + '</b>\'s Task inbox — operate as GOV-01-Help to answer, close, and publish here.</div>';
  h.innerHTML=form+'<div style="font-size:var(--fs-2);color:var(--grey);margin:12px 0 6px">' + tx('Published answers (') + '<span id="kb_n">…</span>)</div><div id="kb_list"><div class="loadwrap"><span class="spin"></span> loading…</div></div>';
  if(window.CBOffline)CBOffline.autodraft(h,'kb.form');   // draft the question/answer/context you're writing
  try{ _kbItems=(await api("assistQuestions"))||[]; const n=document.getElementById("kb_n"); if(n)n.textContent=_kbItems.length;
    const L=document.getElementById("kb_list"); if(L) L.innerHTML = _kbItems.length ? _kbItems.map(function(e){
      const eb = isHelp ? '<button class="composebtn" style="padding:2px 9px;font-size:var(--fs-1);flex:none" onclick="kbEdit(\''+esc(e.id)+'\')">' + tx('Edit') + '</button>' : '';
      return '<div style="'+_CARD+';padding:9px 11px"><div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:var(--fs-2)">'+esc(e.q)+'</div><div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">'+esc(e.a)+'</div><div style="font-size:var(--fs-1);color:var(--grey-4);margin-top:3px">'+esc(Array.isArray(e.context)?e.context.join(', '):'')+'</div></div>'+eb+'</div></div>'; }).join('') : '<div style="color:var(--grey);font-size:var(--fs-2)">None yet.</div>';
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


/* ⚠️ storefrontCardHTML and saveStorefront were removed on 2026-08-20. The Storefront PANEL they drew was
   folded into iamHTML as a section, which made both unreachable; their one irreplaceable control
   (storefront_access) was carried across FIRST, then the pair deleted. Two renderers for one screen is
   how the next person edits the dead one. */