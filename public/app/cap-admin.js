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
    ? '<div style="font-size:var(--fs-1);color:var(--ok-2);background:var(--ok-tint);border:1px solid #bfe3cb;border-radius:9px;padding:7px 10px;margin:6px 0 2px">🔒 <b>Encrypted at rest</b> — stored ciphertext-only (a database dump can\'t read it). Safe for real banking &amp; tax details.</div>'
    : '<div style="font-size:var(--fs-1);color:var(--warn-2);background:var(--warn-tint);border:1px solid #f0dcae;border-radius:9px;padding:7px 10px;margin:6px 0 2px">⚠ <b>Encryption not configured</b> — the vault won\'t save until the platform sets its encryption key. Use <b>dummy data only</b> for now.</div>';
  var secs=(UI._vault&&UI._vault.sections)||[];
  var body=secs.length ? secs.map(vaultSectionHTML).join('')
    : '<div style="color:var(--grey);font-size:12px;padding:9px 0">Nothing here yet. Add a section below and name the details you actually have — anything we don’t recognise is still saved.</div>';
  var addOpts=Object.keys(VAULT_SECTION_TYPES).map(function(t){ return '<option value="'+t+'">'+esc(VAULT_SECTION_TYPES[t])+'</option>'; }).join('');
  return '<div style="'+_CARD+';margin-top:10px"><div class="sec" style="margin:0">🗂 Trade documents vault <span style="font-size:var(--fs-1);font-weight:600;color:var(--grey)">— fill once · pre-fills every form</span></div>'
    +'<div style="font-size:var(--fs-1);color:var(--grey);margin:3px 0 2px;line-height:1.5">These recurring details auto-fill your Commercial Invoice, Packing List and other authority forms. At form time you\'ll only be asked the shipment-specifics (invoice no, dates, ports). <b>Name each detail the way you know it</b> — the suggestions are a shortcut, never a limit.</div>'
    +encBanner
    +body
    +'<div style="display:flex;gap:7px;align-items:center;margin-top:13px;flex-wrap:wrap">'
      +'<select class="inp" id="v_addtype" style="max-width:210px;margin:0">'+addOpts+'</select>'
      +'<button class="composebtn ghost" data-testid="vault-add-section" onclick="vaultAddSection()">+ add section</button></div>'
    +'<div class="err" id="vault_err" style="margin-top:8px"></div>'
    +'<button class="composebtn" style="margin-top:11px" data-testid="vault-save" onclick="saveVaultUI()">Save vault</button></div>';
}
/* One section — its type, an optional label that tells two of the same kind apart, and its rows. */
function vaultSectionHTML(sec, i){
  var rows=(sec.rows||[]).map(function(r,j){ return vaultRowHTML(r,i,j,sec.type); }).join('');
  return '<div style="border:1px solid var(--line);border-radius:11px;padding:11px 12px;margin-top:11px;background:var(--paper);color:var(--on-bg)">'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'
      +'<span style="font-size:12px;font-weight:700;color:var(--ink)">'+esc(VAULT_SECTION_TYPES[sec.type]||sec.type)+'</span>'
      /* ⚠️ THE LABEL IS WHAT MAKES REPEATS USABLE. Two sections both reading "Bank" are indistinguishable at a
         glance and unusable at form time — "which account do I invoice against?" has no answer. */
      +'<input class="inp" style="flex:1;min-width:120px;max-width:230px;margin:0;font-size:12px" placeholder="label it — e.g. Export receipts" value="'+esc(sec.label||'')+'" oninput="vaultSetSection('+i+',this.value)">'
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
  try{ var p=(await api('vaultGet'))||{};
    /* The server normalises legacy group-shaped vaults to {sections} on read, so there is exactly one shape here. */
    UI._vault={sections:((p.vault||{}).sections)||[]}; UI._vaultEnc=!!p.vault_encrypted;
  }catch(e){ UI._vault={sections:[]}; UI._vaultEnc=false; }
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
  var bar = '<div class="misbar"><span class="misttl">📊 MIS</span>'
    + '<span class="seg">' + seg('7', '7 days') + seg('30', '30 days') + seg('all', 'All time') + '</span>'
    + '<span class="misbar-r">' + (m ? '<span class="misasof">live · ' + esc(m.asOf) + '</span>' : '')
    + '<button class="composebtn" onclick="aiRun(\'metrics-narrate\',UI._mis,{title:\'📊 Explain my metrics\'})" title="AI narrates what your numbers say">✨ Explain</button></span></div>';
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
function _misHead(t, s){
  return _misBack() + '<div class="dh">' + esc(t) + '</div><div class="ds" style="margin-bottom:14px">' + esc(s) + '</div>'; }
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
  var seg = function(n, col){ return n ? '<span style="background:' + col + ';width:' + (n / t * 100) + '%">' + n + '</span>' : ''; };
  return '<div class="misstack">' + seg(m.open, 'var(--blue)') + seg(m.in_progress, 'var(--prog)') + seg(m.closed, 'var(--ok)') + '</div>'
    + '<div class="miskey"><span class="k"><i class="sw" style="background:var(--blue);color:var(--on-accent)"></i> Open</span>'
    + '<span class="k"><i class="sw" style="background:var(--prog);color:var(--on-warn)"></i> In progress</span>'
    + '<span class="k"><i class="sw" style="background:var(--ok);color:var(--on-ok)"></i> Closed</span></div>';
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
      + 'It is deliberately <b>not</b> recomputed here: a second count that quietly disagreed with the folder pane would be worse than none.</div>';
  }
  var n = s.all.overdue || 0, d = s.overdue_days;
  var mine = (s.received && s.received.overdue) || 0, theirs = (s.sent && s.sent.overdue) || 0;
  return '<div class="mislbl" style="margin-top:16px">Overdue · past ' + esc(String(d)) + ' day' + (d === 1 ? '' : 's') + '</div>'
    + '<div class="misstatus">'
    + (n ? '<i class="dot" style="background:var(--disp);color:var(--on-danger)"></i> <b>' + n + ' overdue</b>'
         : '<i class="dot" style="background:var(--ok);color:var(--on-ok)"></i> <b>Nothing overdue</b>')
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
        : '<i class="dot" style="background:var(--ok);color:var(--on-ok)"></i> <b>No open disputes</b>')
      + '<span class="misnote" style="margin-inline-start:8px">· ' + m.chits + ' chits · ' + (m.open_disputes ? 'needs resolving' : 'nothing to resolve') + '</span></div>'
    + _misOverdue(m) + _misAgeing(m) + _misUnattended(m)
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
      + '<b onclick="navTo(\'settings\');UI.setSec=\'governance\';UI.govTab=0" style="cursor:pointer;color:var(--blue)">Governance → Constitution →</b></div>'
    + meter('Entities', 1, PLAN.entities)
    + meter('Chits today', chitsToday, PLAN.chitsPerDay)
    + meter('Networks formed', 0, null, 'not counted on this screen')
    + meter('Data stored', 0, null, 'not counted on this screen')
    + '<div class="miswhy">These four sat on the governance card as <b>metered</b> rows, two of them showing '
      + '<b>—</b> while this screen was already counting chits. Limits are declared there; what you used is measured here.</div>';
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
          ? '<i class="dot" style="background:var(--disp);color:var(--on-danger)"></i> <b>' + m.open_disputes + ' open</b>'
          : '<i class="dot" style="background:var(--ok);color:var(--on-ok)"></i> <b>No open disputes</b>')
        + '<span style="margin-inline-start:9px">' + (m.waiting.length
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
function profSetSec(k){ UI.profSec = k; renderApp(); _capShowDetail(); if (UI._me) { const h=document.getElementById('profbody');
  if (h){ h.innerHTML = profSecHTML(k, UI._me); if (k === 'vault') loadVault(); } } else { loadProfile(); } }

/**
 * ⚠️ THE TWO-SIDED PANEL IS THE SHAPE, AND IT IS NOT NEGOTIABLE PER SCREEN (Athi, 2026-08-16: *"it has to be
 * uniform two sided, so it nicely works in phone as well"*). I briefly made this tabs because the rail sits
 * ~75% empty on a desktop viewport — which traded a real density gain for the thing that actually matters:
 * every screen behaving the same way, and list→tap→detail→back being the mobile pattern throughout. A screen
 * that is uniform everywhere beats a screen that is optimal once. Density is fixed by the pane, not by the shape.
 */
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
  var detail = '<div class="detail" id="detailpane"><div id="profbody"><button class="dback" data-testid="cap-back" onclick="backToList()">‹ Back</button></div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  if (UI.misLw == null) UI.misLw = 320;
  var lw = Math.min(UI.misLw, Math.max(260, Math.round((window.innerWidth || 1200) * 0.42)));
  return '<div class="panel' + ((UI.vp === 'mob' && UI.mdetail) ? ' showdetail' : '') + '" id="panel" style="--lw:' + lw + 'px;--lh:' + (UI.lh || 300) + 'px">' + list + divider + detail + '</div>';
}

/**
 * ⚠️ ONE READ AT A TIME. The post-render hook fires loadProfile on EVERY render, and a section switch renders —
 * so with the API at ~3.6s a round trip, switching sections stacked four and five identical `me` reads and the
 * pane sat on its spinner behind all of them. The in-flight guard makes the extra renders free.
 */
let _profBusy = false;
async function loadProfile(){ const h=document.getElementById("profbody"); if(!h)return;
  if(SESSION.role==='actor') return loadActorProfile(h);   // actors get their own profile, not the entity's
  if(UI._me){ h.innerHTML = profSecHTML(profSec(), UI._me); if(profSec()==='vault') loadVault(); return; }
  if(_profBusy) return;
  _profBusy = true;
  try{ const e=(await api("me"))||{}; UI._me=e;
    /* ⚠️ RE-QUERY THE HOST AFTER THE AWAIT. renderApp() rebuilds the screen wholesale, so a repaint that lands
       while this fetch is in flight — switching viewport, opening the menu — detaches the node captured above.
       Writing to that stale reference paints into a node no longer in the document and the panel stays blank
       with no error anywhere. Every await in this file that is followed by a DOM write has the same hazard. */
    const h2=document.getElementById("profbody"); if(!h2) return;
    h2.innerHTML = profSecHTML(profSec(), e);
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
var NAMING = [
  { who:'Your business', what:'Entity name', field:'display_name', must:'optional',
    rule:'2–255 characters. Anything you like.',
    why:'What counterparties see on a chit. Change it any time — nothing cites it, everything cites your ID.',
    src:'routes/entities.js:34' },
  { who:'Your business', what:'Bridge ID', field:'bridge_id', must:'given to you',
    rule:'CB + 8 characters. Generated, never chosen.',
    why:'Your permanent public address on the rail. ⚠️ The alphabet leaves out I, O, 0 and 1 on purpose — a '
       + 'bridge ID has to survive being read aloud down a phone.',
    src:'lib/bridgeid.js' },
  { who:'Your business', what:'User ID', field:'user_id', must:'optional, but this is how people add you',
    rule:'An email address, OR: at least 8 characters, letters/numbers/dots/dashes, no spaces. '
       + 'Case-insensitive and unique across the platform.',
    why:'The handle you give someone so they can add you as a supplier. Without one they need your Bridge ID.',
    src:'routes/entities.js:452' },
  { who:'Your people', what:'Co-assist name', field:'display_name', must:'REQUIRED',
    rule:'At least 2 characters.',
    why:'The name that appears against work they do — on an assignment, in a timeline, on a dispute.',
    src:'routes/actors.js:120' },
  { who:'Your people', what:'Co-assist key', field:'actor_key', must:'REQUIRED',
    rule:'At least 4 characters, LOWERCASE LETTERS AND NUMBERS ONLY — no spaces, dots or dashes.',
    why:'What they sign in with. Stricter than a User ID because it is typed at a counter, often in a hurry, '
       + 'sometimes on a phone.',
    src:'routes/actors.js:121' },
  { who:'Your people', what:'Role', field:'actor_role', must:'optional',
    rule:'Up to 100 characters. Free text — "counter", "driver", "accounts".',
    why:'⚠️ A label, not a permission. What they may DO is the hat (view_only · act · audit · mis · manager), '
       + 'set separately.',
    src:'routes/actors.js:123' },
  { who:'Your customers', what:'Customer name', field:'display_name', must:'as they give it',
    rule:'No format rule — a customer types their own name at checkout.',
    why:'They are identified by the phone or email they confirm with a one-time code, not by the name. '
       + '⚠️ Two customers may share a name; they are still two records.',
    src:'routes/catalogue.js:585' }
];
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
function iamTab(){ return UI.iamTab || 'who'; }
function setIamTab(t){ UI.iamTab = t; renderApp(); _capShowDetail(); loadProfile(); }

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

  var seg = [['who','Who'],['access','What they may do']].map(function(x){
    var on = tab === x[0];
    return '<button type="button" data-testid="iam-tab-' + x[0] + '" onclick="setIamTab(' + Q + x[0] + Q + ')"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + ' style="flex:1;cursor:pointer;font:inherit;padding:7px 8px;font-size:var(--fs-2);font-weight:' + (on ? 800 : 500) + ';'
      + 'border:2px solid ' + (on ? 'var(--blue)' : 'var(--line)') + ';border-radius:9px;'
      + 'background:' + (on ? 'var(--blue-tint-bg)' : 'var(--card)') + ';color:var(--on-card)">' + x[1] + '</button>';
  }).join('');

  return _misHead('IAM · Identity &amp; Access Management',
      '<b>Identity</b> — who each party is and what they are called. <b>Access</b> — what each of them may do, '
      + 'and where that permission came from.')
    + '<div style="display:flex;gap:7px;margin-bottom:11px">' + seg + '</div>'
    + (tab === 'who' ? iamWhoHTML(e) : iamAccessHTML(e));
}

/* ══ shared pieces ══════════════════════════════════════════════════════════════════════════════════════════ */

function _iamCard(inner){ return '<div style="' + _CARD + '">' + inner + '</div>'; }
function _iamHead(t, sub){
  return '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:' + (sub ? '3px' : '6px') + '">' + t + '</div>'
    + (sub ? '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55;margin-bottom:7px">' + sub + '</div>' : '');
}
/** The boundary badge. ⚠️ Same three words everywhere, so the spine is learnable in one read. */
function _iamZone(z){
  var C = { inside: ['var(--ok-tint)', 'var(--ok-2)', 'INSIDE'],
            edge:   ['var(--warn-tint)', 'var(--warn-2)', 'AT THE EDGE'],
            outside:['var(--neutral-tint)', 'var(--grey)', 'OUTSIDE'] }[z];
  return '<span style="font-size:var(--fs-1);font-weight:800;letter-spacing:.04em;background:' + C[0] + ';color:' + C[1]
    + ';border-radius:4px;padding:1px 6px">' + C[2] + '</span>';
}

/* ══ WHO ════════════════════════════════════════════════════════════════════════════════════════════════════ */

function iamWhoHTML(e){
  var Q = String.fromCharCode(39);
  var acts = UI._iamActors || [];
  var people = acts.filter(function(a){ return !a.actor_type || a.actor_type === 'human'; });
  var machines = acts.filter(function(a){ return a.actor_type && a.actor_type !== 'human'; });

  var line = function(what, named, signin, where, nav) {
    return '<div style="padding:6px 0;border-block-start:1px solid var(--line)">'
      + '<div style="font-size:var(--fs-2);color:var(--on-card)"><b>' + what + '</b>' + (named ? ' · ' + named : '') + '</div>'
      + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.5">'
      +   'Named by ' + esc(signin[0]) + ' · signs in with ' + esc(signin[1])
      +   (nav ? ' · <a href="#" onclick="' + nav + ';return false" style="color:var(--blue);font-weight:600">' + esc(where) + ' →</a>' : '')
      + '</div></div>';
  };

  return _iamCard(_iamHead(_iamZone('inside') + ' &nbsp;You administer these',
      'Identities this business creates, names and can remove. Athi: <i>&ldquo;people means who works for the '
      + 'entity, within the boundary of the entity&rdquo;</i> — that boundary is exactly what this zone draws.')
    + line('This business', esc(e.display_name || '—'), ['Bridge ID + User ID', 'a one-time code to your email'], '', '')
    /* ⚠️ THE HANDLE IS key@user_id, NOT key@display-name — display_name has no unique index and changes when an
       owner renames the business; user_id has one and does not. See routes/actors.js. */
    + line('People', (people.length ? people.length + ' co-assist' + (people.length === 1 ? '' : 's') : 'none yet')
        + ' <span style="color:var(--grey)">— they work for this business, inside its boundary</span>',
        ['name + actor key, signing in as <b>key@' + esc(e.user_id || 'your-user-id') + '</b>', 'that handle and a one-time code'],
        'Co-assists', "navTo('coassists')")
    /* ⚠️ MACHINES ARE CO-ASSISTS, not a fifth class — same table, different actor_type. Listing them separately
       would imply a separate identity model and a separate place to manage them; there is neither. */
    + line('Machines &amp; agents', machines.length ? machines.length + ' (IoT · AI · ERP)' : 'none yet',
        ['name + actor key', 'a device key or connector credential'], 'Co-assists', "navTo('coassists')")
    + line('Branches &amp; units', 'sub-entities in your network',
        ['their own Bridge ID', 'their own credentials'], 'Network', "navTo('network')"))

  + _iamCard(_iamHead(_iamZone('edge') + ' &nbsp;You set the terms — they identify themselves',
      'You never create these identities and cannot remove one. You decide what the door does.')
    + line('Customers', 'anyone who opens your storefront',
        ['the name they type at checkout', 'a code to their phone or email'], 'Storefront', "profSetSec('storefront')"))

  + _iamCard(_iamHead(_iamZone('outside') + ' &nbsp;They govern themselves',
      'Other businesses. You hold a relationship, not a permission.')
    + line('Suppliers', 'businesses you buy from',
        ['their own User ID', 'their own business account'], 'Suppliers', "navTo('suppliers')")
    + line('Network peers', 'businesses connected to you',
        ['their own Bridge ID', 'their own business account'], 'Network', "navTo('network')")
    /* ⚠️ THE SENTENCE THAT MAKES THE WHOLE STRUCTURE MAKE SENSE. Athi: "For third party, user id is the key,
       that cannot be changed so supplier, if they want to add, they have to use the user id." Listing a supplier
       beside a co-assist without this implies you grant them access, which is exactly backwards. */
    + '<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card);margin-top:8px">'
    + '⚠️ <b>You do not give these access.</b> Each holds its own IAM and decides for itself. What you type to '
    + 'add one is their <b>User ID</b> — which is why yours matters: it is the handle another business types to '
    + 'find <i>you</i>.</div>')

  + '<div style="' + _CARD + ';margin-top:10px">'
    + '<label class="fl">This business</label>'
    + '<div class="kv"><b>Name</b> · ' + esc(e.display_name || '') + '</div>'
    + '<div class="kv"><b>Bridge ID</b> · ' + esc(e.bridge_id || '') + '</div>'
    /**
     * ⭐⭐ THE USER ID IS THE ROOT OF EVERY OTHER NAME, and until now it was one field among five with a short
     * hint. Athi, 2026-08-19: *"user id is the one under which the registration happens in the platform as
     * entity identification. User name is their literal name… user name can be duplicated also, but user id
     * cannot be duplicated."*
     *
     * ⚠️ HE HAD TO EXPLAIN THAT TO ME, which means the screen was not explaining it to anyone. Three things
     * derive from this one value — a co-assist's login, a network root, and how another business finds you —
     * and none of them said so where it is typed.
     */
    + '<label class="fl">User ID <span style="color:var(--grey);font-weight:400;font-size:var(--fs-1)">— your unique name on this platform</span></label>'
    + '<input class="inp" id="pf_uid" value="' + esc(e.user_id || '') + '">'
    + (e.user_id
        ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px;line-height:1.55">'
          + 'Everything else is named from this: co-assists sign in as <b>key@' + esc(e.user_id) + '</b>, a network '
          + 'root is <b>' + esc(e.user_id) + '.store</b>, and another business adds you by typing it. '
          + '⚠️ Unique across the platform — unlike your <b>name</b>, which may repeat.</div>'
        /* ⚠️ AN EMPTY USER ID IS NOT A BLANK FIELD, IT IS A MISSING FOUNDATION. Say so where it is set, because
           the screens that need it will otherwise show a plausible-looking GUESS in its place. */
        : '<div style="font-size:var(--fs-1);color:var(--warn-2);background:var(--warn-tint);border-radius:8px;'
          + 'padding:7px 9px;margin-top:5px;line-height:1.55">'
          + '⚠️ <b>Not set — and three things need it.</b> Co-assists sign in as <b>key@your-user-id</b>, a network '
          + 'root is named from it, and another business adds you by typing it. Until you choose one, other screens '
          + 'show a <b>suggestion</b> slugged from your business name — which is not an identifier and is not saved.'
          + '</div>')
    + '<label class="fl">GSTIN <span style="color:var(--grey);font-weight:400;font-size:var(--fs-1)">— 15 characters</span></label>'
    + '<input class="inp" id="pf_gstn" value="' + esc(e.gstn || '') + '">'
    + '<label class="fl">Address</label><input class="inp" id="pf_addr" value="' + esc(e.address || '') + '">'
    /* ⚠️ "Are you trading?" IS NOT A VISIBILITY SETTING. Athi read the two as contradictory because they sat
       together: business_status answers ARE YOU TRADING, catalogue_visibility answers WHO MAY SEE YOUR
       CATALOGUE. Different questions, similar words — so the note names both and points at the other. */
    + '<label class="fl">Are you trading? <span style="color:var(--grey);font-weight:400;font-size:var(--fs-1)">— open, closed or away</span></label>'
    + '<select class="inp" id="pf_bs">' + opt(['open','closed','away'], e.business_status) + '</select>'
    + '<div class="misnote" style="margin-top:5px">⚠️ This is <b>whether you are trading</b> — nothing to do with who may '
    + '<b>see</b> your catalogue. That is <b onclick="profSetSec(' + Q + 'storefront' + Q + ')" style="cursor:pointer;color:var(--blue)">Storefront</b>.</div>'
    + '<div class="err" id="pf_err"></div>'
    + '<button class="composebtn" style="margin-top:11px" onclick="saveProfile()">Save profile</button>'
  + '</div>'

  + namingRulesHTML();
}

/* ══ WHAT THEY MAY DO ═══════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️⚠️ EVERY ROW NAMES ITS PROVENANCE, and that is the point of the tab. "Why can't I do this?" is the question
 * people actually ask, and today the answer is unfindable for two of the four kinds:
 *
 *   DIRECT   set on this identity, here                    → change it here
 *   DERIVED  follows from where you sit in the tree        → nobody set it; no screen says so
 *   CAPPED   descends from your operator, narrowest wins   → visible, not yours to lift
 *   THEIRS   another business decided                      → not a permission of yours at all
 */
function iamAccessHTML(e){
  var Q = String.fromCharCode(39);
  var acts = UI._iamActors || [];
  var cap = e.visibility_cap || { max: 'public', by: null };
  var vis = e.catalogue_visibility || 'private';

  var PROV = {
    direct:  ['DIRECT',  'var(--blue-tint-bg)', 'var(--blue-2)'],
    derived: ['DERIVED', 'var(--purple-tint)',  'var(--purple-2)'],
    capped:  ['CAPPED',  'var(--warn-tint)',    'var(--warn-2)'],
    theirs:  ['THEIRS',  'var(--neutral-tint)', 'var(--grey)']
  };
  var prov = function(k){
    var c = PROV[k];
    return '<span title="' + esc(k) + '" style="font-size:var(--fs-1);font-weight:800;letter-spacing:.04em;background:' + c[1]
      + ';color:' + c[2] + ';border-radius:4px;padding:1px 6px">' + c[0] + '</span>';
  };

  var row = function(who, what, p, note, nav, navLabel){
    return '<div style="padding:7px 0;border-block-start:1px solid var(--line)">'
      + '<div style="display:flex;gap:7px;align-items:baseline;flex-wrap:wrap">'
      +   '<b style="font-size:var(--fs-2);color:var(--on-card)">' + who + '</b>'
      +   '<span style="font-size:var(--fs-2);color:var(--on-card)">' + what + '</span>'
      +   prov(p)
      + '</div>'
      + (note ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px;line-height:1.5">' + note
          + (nav ? ' <a href="#" onclick="' + nav + ';return false" style="color:var(--blue);font-weight:600">' + esc(navLabel) + ' →</a>' : '')
          + '</div>' : '')
      + '</div>';
  };

  /* per-person hats, from the SAME endpoint Co-assists uses */
  var hatRows = acts.length ? acts.map(function(a){
    var h = a.hat || 'act';
    var L = IAM_HAT[h] || [h, ''];
    var writes = IAM_WRITES.indexOf(h) >= 0;
    return row(esc(a.display_name || a.actor_key || '—'),
      '<b>' + esc(L[0]) + '</b> <span style="color:var(--grey)">— ' + esc(L[1]) + '</span>',
      'direct',
      writes ? 'May create and change records.'
             : '⚠️ Read only — cannot create or change records. Enforced on every write since 2026-08-18.',
      "navTo('coassists')", 'Co-assists');
  }).join('') : '<div style="font-size:var(--fs-1);color:var(--grey);padding:7px 0;border-block-start:1px solid var(--line)">No co-assists yet.</div>';

  return _iamCard(_iamHead(_iamZone('inside') + ' &nbsp;People and machines — the hat',
      'One setting per co-assist, set by you, enforced on every write.')
    + hatRows)

  /**
   * ⚠️⚠️ I RECOMMENDED MOVING SETTINGS › WORK IN HERE, AND I WAS WRONG. My argument was "Work is how tasks reach
   * PEOPLE, so it belongs with people". Checking the data settled it the other way: assignment_model,
   * default_max_tasks, all_task_visible and auto_return_on_short_break are keyed on ENTITY_ID
   * (routes/actors.js:1400). They are ENTITY-WIDE OPERATIONS POLICY, identical for everyone — not a property of
   * any identity.
   *
   * ⭐ The test that decides it: "what may Priya do?" is answered per-person (her hat). "How does work reach
   * Priya?" has the same answer for every co-assist in the business. The first is IAM; the second is operations.
   *
   * Moving it would also have forced this screen to fetch settings it otherwise never needs, and given one
   * control two homes — the exact defect this regrouping exists to remove. So it stays where it is and IAM
   * LINKS to it, which is the "one control, many viewers" rule applied to my own proposal.
   */
  + _iamCard(_iamHead(_iamZone('inside') + ' &nbsp;How work reaches them',
      'Entity-wide, not per person — the same rules for every co-assist.')
    + '<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card);padding:7px 0;border-block-start:1px solid var(--line)">'
    + 'Who gets assigned what, how many tasks at once, whether everyone can see everyone&rsquo;s work, and what '
    + 'happens on a break — one set of rules for the whole business.'
    + '<div style="margin-top:7px"><a href="#" data-testid="iam-to-work" onclick="navTo(&#39;settings&#39;);setSetSec(&#39;work&#39;);return false" '
    + 'style="color:var(--blue);font-weight:600">Settings › Work →</a></div>'
    + '</div>')

  + _iamCard(_iamHead(_iamZone('inside') + ' &nbsp;Where they sit',
      'Access nobody set — it follows from position in your network.')
    + row('Co-assists at a node', 'reach the work of that node and below', 'derived',
        'Placed in the tree, not granted on a screen. Move the person, and their reach moves with them.',
        "navTo('network')", 'Network')
    + row('Costs', (function(){
        var n = acts.filter(function(a){ return a.can_see_costs; }).length;
        return n ? '<b>' + n + '</b> may see buying prices and margin' : 'nobody may see buying prices';
      })(), 'direct',
        'A separate switch from the hat — the only per-person permission besides it.',
        "navTo('coassists')", 'Co-assists'))

  + _iamCard(_iamHead(_iamZone('edge') + ' &nbsp;Customers',
      'You set the door; nobody is granted anything individually.')
    + row('Anyone with your link', (e.storefront_access === 'login' ? 'must sign in before browsing' : 'may browse, signs in to order'), 'direct',
        'One rule for every customer. There is no per-customer permission, by design.',
        "profSetSec('storefront')", 'Storefront')
    + row('Your catalogue', 'is <b>' + esc(vis) + '</b>', (cap.max === 'private' ? 'capped' : 'direct'),
        cap.max === 'private'
          ? '⚠️ Capped at <b>private</b> by ' + esc(cap.by || 'your network operator') + '. A store can be no more open than the thing it sits inside — the narrowest wins.'
          : 'You choose this. It also decides whether your storefront link opens at all.',
        "profSetSec('storefront')", 'Storefront'))

  + _iamCard(_iamHead(_iamZone('outside') + ' &nbsp;Other businesses',
      'Not permissions of yours.')
    + row('Suppliers &amp; peers', 'decide for themselves', 'theirs',
        'Their own IAM answers this. You hold a relationship — what their staff may do is their business, governed by their hats, in their records.',
        "navTo('suppliers')", 'Suppliers')
    + row('Your network operator', 'may co-hold and walk your subtree', 'capped',
        'Where a bounded network names an operator, that operator can trace across it for oversight. Visibility is co-holding.',
        "navTo('network')", 'Network'))

  /* ⚠️ THE HONEST FOOTER. Two of the four provenances are things a reader CANNOT CHANGE, and a permissions
     screen that does not say so invites people to hunt for a switch that does not exist. */
  + _iamCard(_iamHead('What this page cannot change')
    + '<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
    + '<b>DERIVED</b> access follows position — move the person in <b>Network</b>, not here. '
    + '<b>CAPPED</b> access descends from your operator and cannot be lifted from inside. '
    + '<b>THEIRS</b> is another business&rsquo;s answer and never appears as a setting of yours.<br>'
    + '⚠️ Only <b>DIRECT</b> rows have a switch, and every one of them links to the screen that owns it — '
    + 'one control, many viewers.'
    + '</div>');
}

function namingRulesHTML(){
  var open = !!UI._namingOpen;
  var rows = NAMING.map(function(n){
    var tone = /REQUIRED/.test(n.must) ? 'req' : /given to you/.test(n.must) ? 'auto' : 'opt';
    return '<div class="namerow">'
      + '<div class="namehd"><span class="namewhat">' + esc(n.what) + '</span>'
      +   '<code class="namefield">' + esc(n.field) + '</code>'
      +   '<span class="namemust ' + tone + '">' + esc(n.must) + '</span></div>'
      + '<div class="namerule">' + esc(n.rule) + '</div>'
      + '<div class="namewhy">' + n.why + '</div></div>';
  });
  /* Grouped by WHOSE name it is — the question is never "what is display_name", it is "what do I call my staff". */
  var out = '', last = '';
  NAMING.forEach(function(n, i){
    if (n.who !== last){ out += '<div class="namegrp">' + esc(n.who) + '</div>'; last = n.who; }
    out += rows[i];
  });
  return '<div class="namebox">'
    + '<button class="namehead" data-testid="naming-toggle" onclick="UI._namingOpen=!UI._namingOpen;loadProfile()">'
    +   '<span>' + (open ? '▾' : '▸') + '</span> What these names mean, and which are compulsory</button>'
    + (open ? ('<div class="namebody">' + out
    +   '<div class="misnote" style="margin-top:10px">⚠️ Names are labels; <b>IDs are identity</b>. Everything the '
    +   'system stores points at an ID, so renaming is always safe — a chit, a supplier link or an adopted '
    +   'definition follows the rename rather than breaking.</div></div>') : '')
    + '</div>';
}
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
  if (k === '__iam_old') return _misHead('Identity', 'Who you are on the rail — and how others find you.')
    + `<div class="${_CARD}"><div class="kv"><b>Name</b> · ${esc(e.display_name)}</div><div class="kv"><b>Bridge ID</b> · ${esc(e.bridge_id)}</div><div class="kv"><b>Email</b> · ${esc(e.email)}</div></div>
      <label class="fl">User ID <span style="color:var(--grey);font-size:var(--fs-1)">— others add you with this</span></label><input class="inp" id="pf_uid" value="${esc(e.user_id||'')}" placeholder="e.g. yourname or you@email.com">
      <label class="fl">GSTIN <span style="color:var(--grey);font-size:var(--fs-1)">— 15 characters</span></label><input class="inp" id="pf_gstn" value="${esc(e.gstn)}" placeholder="15-char">
      <label class="fl">Address</label><input class="inp" id="pf_addr" value="${esc(e.address)}">
      <label class="fl">Are you trading? <span style="color:var(--grey);font-size:var(--fs-1)">— whether you are open for business</span></label>
      <select class="inp" id="pf_bs">${opt(["open","closed","away"],e.business_status)}</select>
      <div class="misnote" style="margin-top:5px">⚠️ Separate from who can <b>see</b> your catalogue — that lives under <b onclick="profSetSec('storefront')" style="cursor:pointer;color:var(--blue)">Storefront</b>.</div>
      <div class="err" id="pf_err"></div><button class="composebtn" style="margin-top:11px" onclick="saveProfile()">Save profile</button>`
    + namingRulesHTML();
  if (k === 'storefront') return _misHead('Storefront', 'What customers see when they open your link.')
    + storefrontCardHTML(e);
  if (k === 'governance') return _misHead('Your rights', 'What this entity may do — resolved from the layers above it.')
    + (govCardHTML(e.governance) || '<div class="misnote">No governance resolved for this entity yet.</div>')
    /**
     * ⭐ ONE QUESTION, TWO DEPTHS, AND A ROUTE BETWEEN THEM. This card is the RESOLVED answer; Settings ›
     * Governance layers is the seven-layer model it descended through. Neither is a duplicate of the other, but
     * a reader who wants to know WHY their rights are what they are had no way to get from one to the other —
     * so the two screens read like two unrelated opinions rather than an answer and its derivation.
     */
    + '<div style="' + _CARD + ';margin-top:10px">'
    +   '<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
    +   'This is the <b>answer</b>. To see <b>where each part of it came from</b> — which layer set it, and '
    +   'whether you can change it — open the seven layers it descended through.'
    +   '</div>'
    +   '<button class="composebtn" style="margin-top:9px" data-testid="gov-to-layers" '
    +     'onclick="navTo(\'settings\');setSetSec(\'governance\')">The seven layers →</button>'
    + '</div>';
  if (k === 'vault') return _misHead('Trade documents', 'Provide these once — every authority form is then pre-filled.')
    + '<div id="vaulthost"><div class="loadwrap"><span class="spin"></span> loading…</div></div>';
  return '';
}
// "Your governance" — the entity's resolved governance (from attributes): where it's minted, its platform, its basics
// (with provenance ⟵ platform), rights + allowances + jurisdiction. Entity-simple; honest "minted, not enforced yet".
function govCardHTML(g){
  if(!g) return '';
  var inst=g.installation||{}, b=g.basics||{}, j=g.jurisdiction||{};
  var caps=(g.capabilities||[]).map(function(c){return '<span class="optchip" style="background:var(--blue-tint);color:var(--blue-d);border-color:var(--blue-tint-line)">'+esc(c)+'</span>';}).join(' ');
  var allow=(g.allowances||[]).map(function(a){return esc(a.limit+' '+a.resource);}).join(' · ');
  var langs=(b.languages||[]).join(', ');
  var loc=[inst.cloud,inst.region,inst.zone].filter(Boolean).join(' · ');
  return '<div style="'+_CARD+';margin-top:10px">'
    +'<div class="sec" style="margin:0 0 8px">🏛️ Your governance <span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--warn-tint);color:var(--warn-3);border-radius:5px;padding:1px 6px">minted · not enforced yet</span></div>'
    +'<div class="kv"><b>Governed by</b> · '+esc(g.constitution||'—')+' <span style="color:var(--grey);font-size:var(--fs-1)">🔒 platform-set</span></div>'
    +'<div class="kv"><b>Installation</b> · '+esc(inst.label||inst.key||'—')+(loc?(' <span style="color:var(--grey);font-size:var(--fs-1)">'+esc(loc)+'</span>'):'')+'</div>'
    +'<div class="kv"><b>Basics</b> <span style="color:var(--grey);font-size:var(--fs-1)">⟵ from your platform</span> · '+esc(b.currency||'—')+' · '+esc(b.timezone||'—')+' · '+esc(b.region||'—')+(langs?(' · '+esc(langs)):'')+'</div>'
    +'<div style="margin:7px 0 2px;font-size:var(--fs-2)"><b>Rights</b> '+(caps||'<span style="color:var(--grey);font-size:var(--fs-1)">—</span>')+'</div>'
    +(allow?('<div class="kv"><b>Allowances</b> · '+allow+'</div>'):'')
    +(j.disclaimer?('<div style="font-size:var(--fs-1);color:var(--grey);margin-top:7px;line-height:1.5"><b>Jurisdiction</b> — '+esc(j.mode||'')+(j.custodian===false?' · provider, not custodian':'')+'<br>'+esc(j.disclaimer)+'</div>'):'')
    +'</div>';
}
async function saveProfile(){ const x=document.getElementById("pf_err"); if(x)x.textContent="";
  try{ await api("saveProfile",{body:{user_id:val("pf_uid")||null,gstn:val("pf_gstn")||null,address:val("pf_addr")||null,business_status:val("pf_bs")}}); toast(MSG.profileSaved()); }catch(e){ if(x)x.textContent=e.message; } }
// 🛍️ Customer storefront — the shareable public shop link + the browse-first / login-first access mode.
function storefrontCardHTML(e){
  /**
   * ⭐⭐ THE STATE LEADS, AND EVERYTHING ELSE FOLLOWS FROM IT.
   *
   * Athi, 2026-08-18: *"Are you trading / Shop Open, close parameter in top is no connection with what is there
   * in this page. It has to be tidy up. Also if the shop is private, it cannot have storefront, if it is
   * network, then it should be visible to network shops only. This page has to be fully reworked based on the
   * entities status. Also need to answer is it independent of catalogue status."*
   *
   * ⚠️ THE ORDER WAS INVERTED, WHICH IS WHY IT READ AS INCOHERENT. The card opened with the shareable link and
   * two buttons, and only THEN — twelve lines down — offered the setting that decides whether that link does
   * anything at all. So the first thing a reader saw was an invitation to share something that, for a private
   * catalogue, showed nothing to anyone including them.
   *
   * ⭐ Now: WHO CAN SEE IT first, then what follows from that. The link, the buttons and the customer-access
   * choice are all downstream of one fact, and they now render as downstream of it.
   *
   * ⚠️ NOTHING IS HIDDEN WHEN CLOSED, and that is deliberate. Hiding the link and the access mode would remove
   * the reader's ability to understand what turning it on would GIVE them — and the control that lifts it lives
   * in this very card, so a hidden section would be a dead end. They are shown INERT and labelled, which is the
   * honest third option between offering a broken thing and pretending it does not exist.
   *
   * ⚠️ AND IT ANSWERS HIS LAST QUESTION DIRECTLY. "Is it independent of catalogue status" — no. The storefront
   * IS the catalogue's public face; there is no separate storefront switch, and pretending there was one is what
   * made the two look unrelated.
   */
  var url = location.origin + '/shop.html?bridge=' + encodeURIComponent(e.bridge_id || '');
  var acc = e.storefront_access || 'browse';
  var vis = e.catalogue_visibility || 'private';   // b114 — absent means not published (EFFECTIVE, cap applied)
  var cap = e.visibility_cap || { max: 'public', by: null, reason: '' };
  var capped = (cap.max === 'private');
  var live = (vis === 'public');                   // the only state in which a stranger's link opens
  var sfopts = [['browse', 'Browse first — catalogue is open; sign in only to order'],
                ['login',  'Login first — customer signs in before browsing']]
    .map(function(o){ return '<option value="' + esc(o[0]) + '"' + (acc === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

  /* The one-line answer to "what is my storefront right now", in the reader's terms rather than the value's. */
  var STATE = {
    public:  ['var(--ok-tint)', 'var(--ok-2)', 'Open', 'Anyone with the link can see your catalogue and order.'],
    network: ['var(--purple-tint)', 'var(--purple-2)', 'Network only',
              'The other businesses in your network can see it. The public link shows nothing.'],
    private: ['var(--danger-tint)', 'var(--disp)', 'Closed',
              'Nobody can see it — the link shows nothing, to anyone, including you.']
  }[vis] || ['var(--danger-tint)', 'var(--disp)', 'Closed', 'Nobody can see it.'];

  return '<div style="' + _CARD + ';margin-top:10px">'
    + '<div class="sec" style="margin:0 0 8px">🛍️ Customer storefront</div>'

    /* ── 1 · THE STATE ─────────────────────────────────────────────────────────────────────────────────── */
    + '<div data-testid="sf-state" style="background:' + STATE[0] + ';color:' + STATE[1] + ';border-radius:9px;'
    +   'padding:9px 11px;font-size:var(--fs-2);line-height:1.55">'
    +   '<b>' + esc(STATE[2]) + '</b> — ' + esc(STATE[3])
    +   (capped ? '<br>⚠️ Capped at <b>Closed</b> by ' + esc(cap.by || 'your network operator')
                 + '. A store can be no more open than the thing it sits inside.' : '')
    + '</div>'

    /* ── 2 · THE CONTROL THAT SETS IT ──────────────────────────────────────────────────────────────────── */
    /* ⚠️ NOT "Is your shop open?". That is the same English question as IAM's "Are you trading?" and a DIFFERENT
       FACT — this one is public/network/private VISIBILITY, that one is open/closed/away TRADING. The screen once
       read "Shop status: open" above "Is your shop open?: Closed", which is two names for one question even when
       both values are correct. */
    + '<label class="fl" style="margin-top:12px">Who can see your catalogue</label>'
    + '<select class="inp" id="pf_catvis" data-testid="pf-catvis" style="max-width:340px"' + (capped ? ' disabled' : '') + '>'
    +   (capped
          ? '<option value="private" selected>Closed — set by your network operator</option>'
          : '<option value="public"' + (vis === 'public' ? ' selected' : '') + '>Open — anyone with the link can see your catalogue</option>'
          + '<option value="network"' + (vis === 'network' ? ' selected' : '') + '>Network only — the other businesses in your network can see it; the public link shows nothing</option>'
          + '<option value="private"' + (vis === 'private' || !vis ? ' selected' : '') + '>Closed — the link shows nothing, to anyone</option>')
    + '</select>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px;line-height:1.55">'
    +   '⚠️ This is <b>not</b> whether you are trading — that is <b onclick="profSetSec(&#39;identity&#39;)" '
    +   'style="cursor:pointer;color:var(--blue)">IAM › Are you trading?</b>, and the two are unrelated. '
    +   'Your storefront <b>is</b> your catalogue&rsquo;s public face; there is no separate storefront switch.'
    + '</div>'

    /* ── 3 · THE LINK — downstream of the state, and inert unless it can open ───────────────────────────── */
    + '<label class="fl" style="margin-top:14px">Your storefront link</label>'
    + (live
        ? '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin-bottom:6px">'
          + 'Share this — anyone can open it and order from your catalogue.</div>'
        : '<div style="font-size:var(--fs-1);color:var(--warn-2);background:var(--warn-tint);border-radius:8px;'
          + 'padding:7px 9px;margin-bottom:6px;line-height:1.55">'
          + '⚠️ <b>This link will not open while your catalogue is ' + esc(STATE[2].toLowerCase()) + '.</b> '
          + 'Anyone following it — including you — sees &ldquo;Shop not found&rdquo;. That wording is deliberately '
          + 'vague to strangers, so that walking the id space tells them nothing; here is the real reason.'
          + (capped ? '' : ' Set <b>Open</b> above and it starts working immediately.')
          + '</div>')
    + '<div style="background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 10px;'
    +   'color:var(--on-card);opacity:' + (live ? '1' : '.55') + '"><span class="mono" id="sf_url">' + esc(url) + '</span></div>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    +   '<button class="composebtn" onclick="sfCopy()"' + (live ? '' : ' disabled title="Your catalogue is not open"') + '>📋 Copy link</button>'
    +   '<button class="composebtn ghost" onclick="window.open(document.getElementById(&#39;sf_url&#39;).textContent,&#39;_blank&#39;)"'
    +     (live ? '' : ' disabled title="Your catalogue is not open"') + '>↗ Open</button>'
    + '</div>'

    /* ── 4 · CUSTOMER ACCESS — only meaningful once there is a storefront ───────────────────────────────── */
    + '<label class="fl" style="margin-top:14px">Customer access'
    +   (live ? '' : ' <span style="color:var(--grey);font-weight:400;font-size:var(--fs-1)">— takes effect when your catalogue is open</span>')
    + '</label>'
    + '<select class="inp" id="pf_sfaccess" style="max-width:340px;opacity:' + (live ? '1' : '.7') + '">' + sfopts + '</select>'

    + '<div class="err" id="pf_err2"></div>'
    + '<button class="composebtn" style="margin-top:9px" onclick="saveStorefront()">Save storefront</button>'
  + '</div>';
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
  const kv=(l,v)=>`<div style="display:flex;gap:10px;padding:9px 13px;border-bottom:1px dashed var(--line);font-size:13px;align-items:baseline"><b style="min-width:104px;color:var(--grey);font-weight:600;font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.4px">${l}</b><span style="font-weight:600;flex:1">${(v==null||v==='')?'—':v}</span></div>`;
  h.innerHTML=`${menuAssist('profile')}<div class="sec">Your profile</div>
    <div class="itab" style="border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:10px">
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
    <div style="font-size:var(--fs-1);color:var(--grey);margin-top:8px;line-height:1.5">Your <b>hat</b>, shift and access are managed by your entity. Set your <b>Duty / Break</b> from the top bar.</div>`;
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
  return '<div style="margin:15px 0 2px;font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-2);color:#5b4a86">↑ Your plan · what it entitles you to</div>'
    + govRowHtml('Plan tier', esc(PLAN.tier), 'bound')
    /* The subscription period. `free` is the honest class: not yours to set, and not set by anyone else either. */
    + govRowHtml('Valid from', PLAN.validFrom ? esc(PLAN.validFrom) : 'no subscription record yet', PLAN.validFrom ? 'bound' : 'free')
    + govRowHtml('Valid to',   PLAN.validTo   ? esc(PLAN.validTo)   : 'no subscription record yet', PLAN.validTo   ? 'bound' : 'free')
    + govRowHtml('Entities allowed', String(PLAN.entities), 'bound')
    + govRowHtml('Chits per day', String(PLAN.chitsPerDay), 'bound')
    + govRowHtml('Networks allowed', String(PLAN.networks), 'bound')
    + '<div class="misnote" style="margin-top:9px">These are the limits. <b onclick="navTo(\'mis\');UI.misBand=\'plan\'" style="cursor:pointer;color:var(--blue)">See what you have used in MIS →</b></div>';
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
function govOwnedElsewhere(where, nav){ return '<button class="govref-go" onclick="'+nav+'">change in '+esc(where)+' →</button>'; }
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
  if (!d) return '<div class="misnote">⚠️ <b>'+esc(label)+'</b> is not declared in Governance — nothing to show.</div>';
  return '<div class="govref"><span class="govref-k">'+esc(label)+'</span>'
    + '<span class="govref-v">'+esc(d.value)+'</span>'
    + '<button class="govref-go" onclick="govGoTo('+d.layerIndex+')" title="Open the layer that declares this">'
      + esc(d.layer)+' →</button></div>';
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
    ['Default max tasks / actor','10 · entity setting','entity'] ] }
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
        + '<span class="govchev">'+(open?'▾':'▸')+'</span><span class="govgrp-t">'+title+'</span>'
        + '<span class="govcount">'+hit.length+'</span><span class="govnote">'+note+'</span></button>'
      + (open ? ('<div class="govgrp-b">'+hit.map(function(r){ return govRowHtml(r[0],r[1],r[2]); }).join('')+'</div>') : '')
      + '</div>';
  };
  var rowsHtml = grp('yours','Yours to set','you control these', function(k){ return YOURS[k]; })
    + grp('fixed','Fixed above you','inherited or platform-bound', function(k){ return FIXED[k]; })
    + grp('none','Not configured yet','arrives from the layer later', function(k){ return !YOURS[k] && !FIXED[k]; });
  if(t===0){ rowsHtml+='<div style="margin:13px 0 2px;font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-2);color:#46546b">⚙ Installation · platform-only (master)</div>'+govRowHtml('Cloud provider','AWS','protected')+govRowHtml('Region','ap-south-1','protected')+govRowHtml('Storage adapter','db → S3 / Azure / GCS','protected')+govRowHtml('Storage bucket','chitbridge-prod-•••','protected')+govRowHtml('Secrets / keys','•••• managed (never exposed)','protected')+govRowHtml('System health','● healthy','protected'); rowsHtml += govPlanBlock(); }
  var inRail = (UI.nav === 'settings');   /* rail carries the layers in Settings; chips elsewhere */
  var foot=(t===0)?'Change a value above, then open <b>tab 7 · Consolidation</b> — the entity inherits it via the boilerplate. <i>Stub: in production these arrive from the layer, not this screen.</i>':(t===6)?'These ride down from the layers into the <b>boilerplate</b> every entity copies at registration, and <b>freeze</b> onto each chit at send. <i>Stub — later set from the real layer.</i>'/* ⚠️ THE GENERIC LEGEND IS GONE. It defined `bound` / `advisory` / `free` — words this screen no longer uses,
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
    +   '<div style="color:var(--grey);margin-bottom:5px"><b>This layer sets the envelope. You choose inside it:</b></div>'
    +   '<a href="#" data-testid="gov-to-locale" onclick="setSetSec(' + "'locale'" + ');return false" style="color:var(--blue);font-weight:600">Localisation →</a>'
    +   '<span style="color:var(--grey)"> language, formats, time zone, working days &nbsp;·&nbsp; </span>'
    +   '<a href="#" data-testid="gov-to-appearance" onclick="setSetSec(' + "'appearance'" + ');return false" style="color:var(--blue);font-weight:600">Appearance →</a>'
    +   '<span style="color:var(--grey)"> theme, text size, motion &nbsp;·&nbsp; </span>'
    +   '<a href="#" data-testid="gov-to-standards" onclick="setSetSec(' + "'standards'" + ');return false" style="color:var(--blue);font-weight:600">Standards →</a>'
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
function setSetSec(k){ UI.setSec = k; renderApp(); _capShowDetail(); loadSettings(); }

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
  var list = '<div class="list"><div class="lh" style="padding:0"><div class="misbar"><span class="misttl">⚙️ Settings</span></div></div>'
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
          + '<span style="color:var(--grey)">Used in </span>'
          + (st.go
              ? '<a href="#" data-testid="std-go-' + esc(st.go) + '" onclick="stdGoto(' + Q + esc(st.go) + Q + ');return false" style="color:var(--blue);font-weight:600">' + esc(st.at) + ' →</a>'
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
        + 'What ChitBridge itself implements. <b>We adopt standards rather than invent formats</b> — a record '
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
        + '⚠️ <b>None of this changes what anyone wrote.</b> These settings govern the chrome and the way figures '
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

  return _misHead('Standards', 'What this platform follows, what you follow, and what your trade follows.')
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

  return _misHead('Appearance', 'How this looks and moves. Every accessibility claim here is measured, not asserted.')

    + card('<label class="fl">Theme</label>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin:0 0 8px">'
        + 'Fifteen themes. The five under <b>Designed for specific needs</b> each name who they are for and which '
        + 'standard they meet — and those levels are computed by a test, so a card claiming 7:1 has been checked.'
        + '</div>'
        + (typeof themePaletteHTML === 'function' ? themePaletteHTML() : ''))

    + card('<label class="fl">Text size</label>'
        + '<div style="display:flex;gap:7px;margin:5px 0 7px">' + sizes + '</div>'
        /* ⚠️ SAYING WHAT IT DOES *NOT* DO. The six size tokens are multiplied together, so headings stay bigger
           than captions — a single flat font size would make every screen legible and structureless at once. */
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5">'
        + 'The whole type scale moves together, so headings stay larger than captions. '
        + '<b>This text is showing at ' + esc(String(Math.round(((TEXT_SIZES.filter(function(x){return x[0]===cur;})[0]||[0,0,1])[2]) * 100))) + '%.</b>'
        + '</div>')

    + card('<label class="fl">Motion</label>'
        + '<div style="display:flex;gap:7px;margin:5px 0 7px">' + motions + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5">'
        + '⚠️ <b>Movement is a health setting, not a matter of polish.</b> Animation triggers migraine, nausea and '
        + 'vertigo for people with vestibular disorders. <b>Follow my device</b> honours the setting you already '
        + 'made in Windows, macOS, iOS or Android — you should not have to ask us separately.'
        + '</div>')

    /* ⚠️ WHAT IS NOT HERE YET, SAID PLAINLY. A settings page that silently lacks the control someone came for
       wastes their time twice: once looking, once wondering whether they missed it. */
    + card('<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">Not here yet</div>'
        + '<div style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + '<b>Typeface</b> — a dyslexia-friendly face (Atkinson Hyperlegible, free, from the Braille Institute) needs '
        + 'the font shipped with the app before it can be offered.<br>'
        + '<b>Colour-vision preview</b> — showing you what deuteranopia does to your own screen, rather than asking '
        + 'you to take the Colour Vision theme on trust.<br>'
        + '<b>These follow you, not this browser.</b> Your theme, text size and motion are stored against you '
        + '(b166), so signing in on another device brings them with you — because someone who needs High Contrast '
        + 'needs it everywhere, not only where they first found it.'
        + '</div>')

    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin-top:8px">'
    +   'Standards: <b>WCAG 2.2</b> (1.4.3 / 1.4.6 contrast · 1.4.4 resize text · 2.3.3 animation from interactions) · '
    +   'colour-blind palette <b>Okabe–Ito</b>.'
    + '</div>';
}

function localeSettingsHTML(){
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
  var NUMERALS = [['', 'Follow the format'], ['latn', 'Western — 123'], ['arab', 'Eastern Arabic — ١٢٣'], ['deva', 'Devanagari — १२३']];
  var HOURS    = [['', 'Follow the format'], ['h12', '12-hour — 09:15 pm'], ['h23', '24-hour — 21:15']];
  var CALS     = [['', 'Follow the format'], ['gregory', 'Gregorian'], ['islamic-umalqura', 'Hijri (Umm al-Qura)'], ['indian', 'Indian national'], ['buddhist', 'Buddhist']];
  var WEEK     = [['', 'Follow the format'], ['mon', 'Monday'], ['sun', 'Sunday'], ['sat', 'Saturday']];

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

  return _misHead('Localisation', 'Presentation and language are separate choices — and content is never converted.')

    /* ── 1 · PRESENTATION ───────────────────────────────────────────────────────────────────────────────── */
    + card('<label class="fl">Presentation <span style="font-weight:400;color:var(--grey)">— how figures are written</span></label>'
        + sel('loc-region', regionOpts, region, 'localeSetRegion')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;line-height:1.55">'
        + 'A region sets the number, money, date and time conventions <b>and the languages it makes sense to read '
        + 'in</b>. Choosing one prunes any language it does not admit, rather than leaving a combination that '
        + 'contradicts itself.<br>'
        + '⚠️ <b>Grouping is not a separate switch, and that is deliberate.</b> Millions or lakhs is a property of '
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
        + 'the same thing your browser sends every website as <code>Accept-Language</code>.'
        + (region ? '' : '<br>⚠️ No region set, so every language we name is offered. Pick a region above to see only the ones that fit.')
        + '</div>')

    /* ⚠️⚠️ THE RULE THAT MATTERS MOST ON THIS SCREEN, RAISED FROM A FOOTNOTE TO ITS OWN CARD. Athi, twice:
       *"the panel and content in the panel, catalogue should stay in the language the origin is, no direct
       conversion at all."* Everything above chooses BETWEEN versions a human wrote. Nothing here produces text
       no human wrote, and that boundary is the reason a chit can be a shared record at all. */
    + '<div style="' + _CARD + ';border-color:var(--warn-tint);background:var(--warn-tint);color:var(--on-card)">'
    +   '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--warn-2);margin-bottom:5px">Content is never converted</div>'
    +   '<div style="font-size:var(--fs-2);line-height:1.6">'
    +   'These settings change the <b>chrome</b> — labels, buttons, and how figures are written. They never touch '
    +   'what people wrote. A product name, a catalogue entry, a chit subject, a message and a dispute reason stay '
    +   'in the language their author used.<br>'
    +   '<b>Choosing a language picks between versions a human wrote — it does not translate anything.</b> '
    +   'A chit is a shared record, and one that read differently to each party would not be a record.'
    +   '</div>'
    + '</div>'

    + card('<label class="fl">Numbering system <span style="font-weight:400;color:var(--grey)">— <code>-u-nu-</code></span></label>'
        + sel('loc-nu', NUMERALS, CBLocale.getExt('nu'), 'localeSetNu'))

    + card('<label class="fl">Hour cycle <span style="font-weight:400;color:var(--grey)">— <code>-u-hc-</code></span></label>'
        + sel('loc-hc', HOURS, CBLocale.getExt('hc'), 'localeSetHc'))

    + card('<label class="fl">Calendar <span style="font-weight:400;color:var(--grey)">— <code>-u-ca-</code></span></label>'
        + sel('loc-ca', CALS, CBLocale.getExt('ca'), 'localeSetCa'))

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
            ? 'You have set these yourself. <a href="#" onclick="localeResetWorkdays();return false" data-testid="loc-workdays-reset" style="color:var(--blue)">Use the regional default</a> instead.'
            : 'These come from <b>CLDR</b> for your region — ' + esc(weekend) + ' is the weekend here. Tap a day to override.')
        + '<br>⚠️ <b>The weekend is not Saturday and Sunday everywhere.</b> Saudi Arabia\'s is Friday + Saturday; '
        + 'India\'s is Sunday alone; the UAE moved to Saturday + Sunday in 2022. Any due date counted in '
        + '<i>working</i> days lands on a different day in Riyadh, Mumbai and Berlin.'
        + '</div>')

    /* ══ TIME ZONE ══════════════════════════════════════════════════════════════════════════════════════════
     * ⚠️ One immutable event, three different answers to "when did this happen", because every date was rendered
     * in whatever zone the browser happened to be in. */
    + card('<label class="fl">Time zone</label>'
        + sel('loc-tz', tzOpts, tzCur, 'localeSetTz')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;line-height:1.55">'
        + 'Now showing times in <b>' + esc(CBLocale.timezone()) + '</b>. '
        + 'A chit stamped 19:00 in Dubai reads 20:30 in Mumbai and 16:00 in London — the same instant, three '
        + 'answers. Leave this on your device unless you want your <i>business\'s</i> clock wherever you are.'
        + '</div>')

    /* ══ CURRENCY ═══════════════════════════════════════════════════════════════════════════════════════════
     * ⭐⭐ THE SAME RULE AS LANGUAGE, AND SAYING SO IS THE POINT OF THIS CARD. There is no "show me everything in
     * rupees", because converting AED 500 to rupees means inventing a rate, a date for that rate, and a number
     * nobody agreed to — exactly as translating a product name invents words nobody wrote. A price is money in
     * a stated currency; the reader chooses how DIGITS are grouped, never what the money is. */
    + card('<label class="fl">Currency</label>'
        + '<div data-testid="loc-currency" style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + 'Your business prices in <b>' + esc(myCurCode) + ' ' + esc(CBLocale.symbol(myCurCode)) + '</b>. '
        + '<span style="color:var(--grey)">Change that in Profile — it is a fact about your business, not about you as a reader.</span>'
        + '<div style="margin-top:7px">Formatted for you: <b>' + esc(CBLocale.money(123456.5, myCurCode)) + '</b> '
        + '<span style="color:var(--grey)">· a supplier quoting in USD still shows as ' + esc(CBLocale.money(123456.5, 'USD')) + '</span></div>'
        + '<div style="margin-top:7px;color:var(--warn-2)">⚠️ <b>Amounts are never converted.</b> Converting a price '
        + 'would mean inventing an exchange rate and a date for it — a number no party agreed to. You always see '
        + 'the currency the price was written in.</div>'
        + '</div>')

    /* THE PREVIEW — see the note on this function. Every control above is an abstraction; this is the only place
       the choice becomes visible before it is made. */
    + '<div style="' + _CARD + ';background:var(--neutral-tint);color:var(--on-card)" data-testid="loc-preview">'
    +   '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:6px">How this looks</div>'
    +   line('Number', esc(CBLocale.number(123456789.5)))
    +   line('Money', esc(CBLocale.money(123456.5, 'INR')) + ' &nbsp;·&nbsp; ' + esc(CBLocale.money(123456.5, 'USD')))
    +   line('Date', esc(CBLocale.date(Date.now())))
    +   line('Time', esc(CBLocale.time(Date.now())))
    +   line('Sorting', esc(CBLocale.sort(['Zebra','Ähnlich','apple','Ökonom','banana']).join(' · ')))
    +   line('Direction', d.dir === 'rtl' ? 'right to left ←' : 'left to right →')
    +   line('Locale tag', '<code>' + esc(CBLocale.tag()) + '</code>')
    + '</div>'

    + card('<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">What is never translated</div>'
        + '<div style="font-size:var(--fs-2);line-height:1.55;color:var(--on-card)">'
        + 'Product names, chit subjects, message text and dispute reasons stay in the words their author wrote. '
        + '<b>A chit is a shared record</b> — one that read differently to each party would not be a record.</div>');
}
/** Choosing a region sets the format AND prunes languages it does not admit — see the note in locale.js. */
function localeSetTz(v){ CBLocale.setTimezone(v); renderApp(); _capShowDetail(); loadSettings(); }
/**
 * ⚠️ THE LAST WORKING DAY CANNOT BE REMOVED. A business with no working days has no due dates at all, and every
 * SLA calculation would divide by an empty week — a state the UI should refuse rather than the maths discover.
 */
function localeToggleWorkday(n){
  var cur = CBLocale.workdays(), at = cur.indexOf(n);
  if (at >= 0) { if (cur.length > 1) cur.splice(at, 1); } else cur.push(n);
  CBLocale.setWorkdays(cur);
  renderApp(); _capShowDetail(); loadSettings();
}
/** Clearing the override returns to CLDR's answer for the region — not to a hardcoded Mon–Fri. */
function localeResetWorkdays(){ CBLocale.setWorkdays([]); renderApp(); _capShowDetail(); loadSettings(); }
function localeSetRegion(v){ CBLocale.setRegion(v); renderApp(); _capShowDetail(); loadSettings(); }
/**
 * ⚠️ APPEND, DO NOT REPLACE — the list is ORDERED and the order is the feature. Toggling a language on puts it
 * last (lowest priority); toggling it off closes the gap. Reordering by re-selecting is a smaller, separate
 * design problem, and pretending a toggle could express rank would have made the order silently arbitrary.
 * ⚠️ The last remaining language cannot be removed: a reader with no languages matches nothing at all.
 */
function localeToggleLang(code){
  var cur = CBLocale.langs(), at = cur.indexOf(code);
  if (at >= 0) { if (cur.length > 1) cur.splice(at, 1); }
  else if (cur.length < CBLocale.MAX_LANGS) cur.push(code);
  CBLocale.setLangs(cur);
  renderApp(); _capShowDetail(); loadSettings();
}
function localeSetFormat(v){ CBLocale.setLocale(v); renderApp(); _capShowDetail(); loadSettings(); }
/* One handler shape per subtag — each re-renders so the preview above moves with the choice. */
function localeSetNu(v){ CBLocale.setExt('nu', v); renderApp(); _capShowDetail(); loadSettings(); }
function localeSetHc(v){ CBLocale.setExt('hc', v); renderApp(); _capShowDetail(); loadSettings(); }
function localeSetCa(v){ CBLocale.setExt('ca', v); renderApp(); _capShowDetail(); loadSettings(); }
function localeSetFw(v){ CBLocale.setExt('fw', v); renderApp(); _capShowDetail(); loadSettings(); }


function paintSettings(s, _daOpts){ const h=document.getElementById("setbody"); if(!h)return;
  { const k = setSec();
    const notYet = '<div style="background:var(--danger-tint);border:1px solid #f0c9c6;border-radius:9px;padding:8px 11px;font-size:11.5px;color:var(--disp);margin-bottom:11px">⏳ These preferences are saved but <b>not yet active</b> — they don\'t change behaviour yet.</div>';
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
        out = _misHead('Standards', 'What this platform follows, what you follow, and what your trade follows.')
            + '<div style="' + _CARD + ';color:var(--grey);font-size:var(--fs-2)">Loading the register…</div>';
        ensureCap('standards').then(function(){ if (setSec() === 'standards') { _capShowDetail(); loadSettings(); } })
          .catch(function(e){ var h=document.getElementById('setbody'); if(h) h.innerHTML = scrErr(e); });
      } else out = standardsSettingsHTML();
    }
    else if (k === "work") out = _misHead('Work', 'How tasks reach the people and co-assists who do them.')
      + `<div style="${_CARD}">${notYet}
      <label class="fl">Assignment model</label><select class="inp" id="st_am">${opt(["pull","push","both"],s.assignment_model||"both")}</select>
      <label class="fl">Default max tasks per actor</label><input class="inp" id="st_mt" inputmode="numeric" value="${esc(s.default_max_tasks||10)}">
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_av" ${s.all_task_visible?'checked':''}> All tasks visible to all co-assists</label>
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_ar" ${s.auto_return_on_short_break?'checked':''}> Auto-return tasks on short break</label>
      <div class="err" id="st_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveSettings()">Save settings</button></div>`
      /* Model A: co-assist naming is DECLARED in Profile → Identity (NAMING). This is a pointer, never a copy. */
      + '<div class="misnote" style="margin-top:10px">What to call a co-assist — what is required, and why the '
      + 'sign-in key is stricter than a User ID — is set out under '
      + '<a href="#" onclick="navTo(\'profile\');profSetSec(\'identity\');UI._namingOpen=true;return false">'
      + 'Profile → Identity</a>.</div>'
      + autoAssignCard(s,_daOpts) + aiSettingsCard();
    else if (k === "policy") out = _misHead('Policy', 'Rules that govern your own records.')
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
        + '<div class="sec" style="margin:0 0 8px">📎 Attachment policy</div>'
        + '<div class="misnote" style="margin-bottom:9px">Declared once, in the governance layers. Shown here so you can see what applies.</div>'
        + govRefHTML('Attachment types') + govRefHTML('Attachment max size')
      + '</div>';
    else if (k === "channels"){ out = _misHead('Channels', 'The inbound numbers and addresses that become chits.') + channelsCard();
      loadChannels();   // async — the card paints itself in when the read lands
    }
    /* ⚠️ NO SECTION HEADING HERE (Athi: *"governance, the layers your entity minted under, not required.. just
       1. Constitution under Governance"*). The rail row already says Governance and the selected layer is the
       subject — repeating the section name above it pushed the actual content down for no information. */
    else if (k === "governance") out = _misBack() + govLayersBlock();
    else if (k === "blueprints") out = _misHead('Work patterns', 'Each action is a governed pattern — what is sealed, and what you may set.') + blueprintSettingsHTML();
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
    def:'received', level:'entity',        gov:'entity',   help:'A chit to yourself is usually work you gave yourself, so it lands in Task. Change it if you also want it filed under Order.' },
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
    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin-bottom:8px">Where messages come in from. Bind the number or address a customer writes to, and anything sent there lands in <b>📨 Intake</b> — raw, for you to confirm into a chit. Nothing here can send on your behalf.</div>';
  if(_CH.busy && !_CH.data) return head+'<div class="loadwrap" style="justify-content:flex-start;padding:6px 0"><span class="spin"></span> reading your channels…</div>';
  /* ⚠️ A MISSING ENDPOINT IS NOT A BROKEN SCREEN, and must not be reported as one. The API deploys separately from
     this page, so a web release can land first — "Could not read your channels" would send someone hunting for a
     fault in their own account. Name the actual state: the server has not shipped this yet. */
  if(_CH.notDeployed) return head+'<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:12px;color:var(--warn-3)">The channels API is not on this server yet (the panel shipped ahead of it). Nothing is wrong with your account — deploy the API and reload.</div>';
  if(_CH.err) return head+'<div style="background:var(--danger-tint);border:1px solid #f0c9c6;border-radius:9px;padding:9px 11px;font-size:12px;color:var(--disp)">'+esc(_CH.err)+'</div>';
  if(!_CH.data) return head+'<div style="font-size:12px;color:var(--grey)">Not loaded.</div>';
  /* The route answers 200 with a note when the table is not there — say which it is, because "no channels" and
     "the store does not exist" look identical on screen and mean entirely different things. */
  if(_CH.data.note) return head+'<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:12px;color:var(--warn-3)">The channel map is not migrated on this environment ('+esc(_CH.data.note)+'). The panel is here; the table is not.</div>';
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
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px">'
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
             '<label style="display:flex;align-items:center;gap:6px;margin:5px 0 0 10px;font-size:11.5px;color:var(--grey);cursor:pointer">'
             + '<input type="checkbox" data-testid="ch-autoraise" '+(b.auto_raise?'checked':'')+' onchange="chSetAutoRaise(\''+esc(b.id)+'\',this.checked)">'
             + '<span>Raise messages on this line <b>automatically</b>'
             + (b.auto_raise && b.status!=='verified' ? ' <span style="color:var(--warn-2);font-weight:700">— waiting on verification</span>' : '')
             + '<br><span style="font-size:var(--fs-1)">A chit appears in your Task list with nobody present. It is still an <b>inquiry</b> — a record, not an obligation — and anything the co-assist cannot read stays here in Intake.</span></span></label>')
          /* ⚠️ TEMPLATES ARE PER-NUMBER, so they hang off the BINDING and not the channel. Meta approves for one
             WhatsApp account; another business's approval says nothing about this one. */
          + (c.key==='whatsapp' ? (c.templates||[]).map(function(t){
              var state=((b.templates||{})[t.name])||'none';
              var col=state==='approved'?['var(--ok-2)','var(--ok-tint)']:state==='pending'?['var(--warn-2)','var(--warn-tint)']:['var(--grey-2)','var(--blue-tint-bg)'];
              return '<div style="margin:5px 0 0 10px;padding:7px 9px;border-inline-start:2px solid var(--line);font-size:11.5px">'
                + '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-family:ui-monospace,Menlo,monospace">'+esc(t.name)+'</span>'
                + '<span style="font-size:var(--fs-1);font-weight:800;color:'+col[0]+';background:'+col[1]+';border-radius:5px;padding:1px 6px">'+esc(state==='none'?'not approved':state)+'</span>'
                + '<span style="color:var(--grey)">'+esc(t.category)+' · '+esc(t.language)+'</span>'
                + '<span style="margin-inline-start:auto;color:var(--blue);cursor:pointer;font-weight:600" data-testid="ch-tpl-toggle" onclick="chSetTemplate(\''+esc(b.id)+'\',\''+esc(t.name)+'\',\''+(state==='approved'?'pending':'approved')+'\')">'
                + (state==='approved'?'mark not approved':'mark approved')+'</span></div>'
                /* Show the submission text VERBATIM. Describing it would guarantee a mismatch with what Meta
                   approved, and a template whose text differs from the approved one is simply rejected. */
                + '<div style="margin-top:4px;color:var(--grey)">Submit this to Meta word for word:</div>'
                + '<div style="margin-top:2px;padding:5px 7px;background:var(--paper);border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:var(--fs-1);white-space:pre-wrap;color:var(--on-bg)">'+esc(t.body)+'</div>'
                + (state!=='approved' ? '<div style="margin-top:3px;color:var(--warn-2)">Until Meta approves this, nothing can be sent more than 24 hours after the customer last wrote.</div>' : '')
                + '</div>'; }).join('') : '')
          ; }).join('')
    + (_CH.adding===c.key
        ? '<div style="display:flex;gap:6px;margin-top:8px"><input class="inp" id="ch_addr" placeholder="'+esc(c.placeholder)+'" data-testid="ch-addr" style="flex:1">'
          + '<input class="inp" id="ch_label" placeholder="label (optional)" data-testid="ch-label" style="max-width:140px">'
          + '<button class="composebtn" data-testid="ch-save" onclick="chBind(\''+esc(c.key)+'\')">Bind</button></div>'
          + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">'+esc(c.address_label)+' — the address your customers write TO, not theirs. It is a <b>claim</b>: it starts inert and receives nothing until the platform confirms the number is yours.</div>'
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
    + '<div style="margin-top:7px">Anything the co-assist cannot read stays in <b>Intake</b> for you.</div>',
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
    +'<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.45">'+esc(def.help)+'</div></div>'
    +'<div style="flex:none;text-align:end;min-width:120px">'+_polControl(def)+'</div></div>'; }).join('');
  /* A setting that cannot be stored must SAY so rather than accept a change it will lose — that is the whole
     failure this card is being rebuilt out of. */
  var warn = !_POL.migrated ? '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:11.5px;color:var(--warn-3);margin-bottom:7px">Policy flags are not migrated on this environment (b130). The card is here; the column is not — changes will not save.</div>' : '';
  var err = _POL.err ? '<div style="color:var(--disp);font-size:11.5px;margin-top:6px">'+esc(_POL.err)+'</div>' : '';
  return '<div class="sec" style="margin:0 0 4px">🚩 Policy flags <span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--ok-tint);color:var(--ok-2);border-radius:5px;padding:1px 6px">saved to your entity</span></div>'
    +'<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5;margin-bottom:6px">The per-entity toggles the <b>7-layer block above</b> doesn\'t yet carry — same governance grammar (<b>class</b> + <b>level</b>): 🔒 platform-bound you can\'t relax; <b>tighten-only</b> you can make stricter; <b>entity</b> you set freely.</div>'
    +warn+rows+err
    +'<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:8px">Stored on the entity, not on this device. <b>Enforced today:</b> self-chit copy, and which side of the trade you are on (inbound pricing). Expiry and retention are declared, not yet enforced.</div>';
}
function autoAssignCard(s, daOpts){ const m=s.auto_assign_mode||'off';
  return `<div style="${_CARD};margin-top:10px"><div class="sec" style="margin:0 0 6px">🧭 Auto-assign on receipt <span style="font-size:var(--fs-1);font-family:'Space Mono';background:var(--ok-tint);color:var(--ok-2);border-radius:5px;padding:1px 6px">active</span></div>
    <label class="fl">Mode</label><select class="inp" id="st_aam">
      <option value="off"${m==='off'?' selected':''}>Off — received chits wait in the pool</option>
      <option value="default_assignee"${m==='default_assignee'?' selected':''}>Default assignee — all to one person</option>
      <option value="least_loaded"${m==='least_loaded'?' selected':''}>Least-loaded — balance across the team</option>
    </select>
    <label class="fl">Default / overflow assignee</label><select class="inp" id="st_ada">${daOpts}</select>
    <div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;line-height:1.55">Only <b>Act / Manager</b> co-assists can be assigned. In <b>least-loaded</b>, ties break to whoever went longest without a new task; when everyone is at capacity it overflows to the default assignee. Anyone <b>on leave</b> routes to their delegate.</div>
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
      +'<label class="fl">Context <span style="color:var(--grey);font-size:var(--fs-1)">— screens (comma), or * for everywhere</span></label><input class="inp" id="kb_c" data-testid="kb-context" placeholder="e.g. task, order  (or *)" value="*">'
      +'<div class="err" id="kb_err"></div><div style="display:flex;gap:7px;margin-top:9px"><button class="composebtn" id="kb_pub" data-testid="kb-publish" onclick="publishAnswer()">📣 Publish to catalogue</button><button class="composebtn ghost" data-testid="kb-new" onclick="kbNew()">＋ New / clear</button></div>'
      +'<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">Add a new answer, or press <b>Edit</b> on one below to refine it. Served to the assistant instantly (catalogue → projection).</div></div>'
    : '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:11px 13px;font-size:var(--fs-2);color:var(--warn-3);margin-bottom:11px">This is the help-desk knowledge base. Queries arrive as chits in <b>GOV-01-Help</b>\'s Task inbox — operate as GOV-01-Help to answer, close, and publish here.</div>';
  h.innerHTML=form+'<div style="font-size:12px;color:var(--grey);margin:12px 0 6px">Published answers (<span id="kb_n">…</span>)</div><div id="kb_list"><div class="loadwrap"><span class="spin"></span> loading…</div></div>';
  if(window.CBOffline)CBOffline.autodraft(h,'kb.form');   // draft the question/answer/context you're writing
  try{ _kbItems=(await api("assistQuestions"))||[]; const n=document.getElementById("kb_n"); if(n)n.textContent=_kbItems.length;
    const L=document.getElementById("kb_list"); if(L) L.innerHTML = _kbItems.length ? _kbItems.map(function(e){
      const eb = isHelp ? '<button class="composebtn" style="padding:2px 9px;font-size:var(--fs-1);flex:none" onclick="kbEdit(\''+esc(e.id)+'\')">Edit</button>' : '';
      return '<div style="'+_CARD+';padding:9px 11px"><div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:var(--fs-2)">'+esc(e.q)+'</div><div style="font-size:11.5px;color:var(--grey);margin-top:2px">'+esc(e.a)+'</div><div style="font-size:var(--fs-1);color:var(--grey-4);margin-top:3px">'+esc(Array.isArray(e.context)?e.context.join(', '):'')+'</div></div>'+eb+'</div></div>'; }).join('') : '<div style="color:var(--grey);font-size:12px">None yet.</div>';
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
