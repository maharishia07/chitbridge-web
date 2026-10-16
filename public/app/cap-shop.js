/* app/cap-shop.js — YOUR SHOP: the shop's own particulars, ONE implementation painted in two places (SET1, 2026-10-13).
 *
 * Owner, 2026-10-13: "in the index still lot of function goes to backend app, we have to ensure that all works from here." The till's
 * "GSTIN state ≠ address" and "set up GST" doors opened the workshop (app.html). What they wanted is HERE now, as a small-app screen:
 *   · the BUSINESS section of the profile — licence number (GSTIN in India) · address · supplies → PATCH /entities/profile
 *   · the vault's BUSINESS IDENTITY rows — legal name · address · city · state · PIN · phone · email → PUT /governance/profile/vault
 * Both are what api lib/profile.js `invoiceParty` reads for every invoice and what the till's shopStateClash checks. Nothing here is a
 * third writer: the two shapes that existed are the two shapes kept.
 *
 * ── WHAT IS MOVED (CLAUDE.md rule 1 — moved, never copied; cap-admin.js calls these same names) ───────────────────────────────────
 *   INCOTERMS · SHIP_MODES · VAULT_* · vaultCardHTML … saveVaultUI   — the trade documents vault (was cap-admin.js:47-243)
 *   shopLicLabel · shopFieldsHTML                                     — the Business section's label and inputs (was inline in iamHTML)
 *   SHOP_FIELDS · profFieldsBody                                      — what the section sends (was PROF_FIELDS.profile + saveProfile's loop)
 * ── WHAT IS NEW, AND WHY ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   CBShop.mount(host, { me })  — CB Settings › Your shop: paints the two cards in a host element; nothing existing painted them outside
 *                                 the workshop's Profile pane (which needs renderApp · _capShowDetail · UI.nav).
 *   shopSave                    — the card's one Save through CBAction (M64); the workshop's saveProfile(sec) keeps its own, both send
 *                                 profFieldsBody(SHOP_FIELDS).
 *   UI._vaultOnly               — the vault card limited to one section type (identity): Your shop shows the identity rows, not the banks.
 * Host globals (as every cap-*.js): api · EP · UI · SESSION · esc · tx · txf · toast · val · _CARD · CBAction · CBLocale (optional) · CBOffline (optional).
 * Loaded by app.html through CAP_WITH.admin (before cap-admin.js) and by settings.html directly.
 * Flow step: Onboarding · country (docs/process/flows.json) and O2C · invoice — the invoice party these rows feed.
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  vaultSave: {m:'PUT', p:'/api/governance/profile/vault', ok:'y'},
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
  licence:'🪪 Licence & registration', logistics:'🚢 Logistics defaults', other:'📋 Other details', signature:'🧾 Bill signature' };
/* W27: the bill's signature is edited in Print setup (cap-print.js), never as free rows — the vault card leaves it out of its list and picker */
var VAULT_HIDDEN_TYPES = { signature: true };
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
/** the bank's own code word per pack (W19: no IFSC on an AU shop) — [label, tag]; the IBAN/SWIFT pair everywhere after it */
var BANK_CODE_WORDS = { IN: ['IFSC code', 'ifsc'], AU: ['BSB', 'bsb'], AE: ['IBAN', 'iban'] };
/** a section's suggestions in the shop's own words (FX-QA1 · W19): the identity's tax id, region and postal code from the pack (packWord, helpers.js),
    the bank's code word per pack, the licence's first rows per pack (ABN/ACN · TRN · GSTIN/PAN) — the TAG stays, so a form's pre-fill finds
    `state` / `pincode` / `gstin` whatever the row is called (an AU shop's "Postcode" and "ABN", a UAE shop's "Emirate" and "TRN") */
function vaultSuggest(type){
  var cc = shopCc(), words = { state: packWord('region', cc), pincode: packWord('postcode', cc), gstin: taxIdWord(cc) };
  var list = (VAULT_SUGGEST[type] || []).map(function(x){ return words[x[1]] ? [words[x[1]], x[1]] : x; });
  if (type === 'identity') list = [list[0], [words.gstin, 'gstin']].concat(list.slice(1));
  if (type === 'bank') { var code = BANK_CODE_WORDS[cc] || BANK_CODE_WORDS.IN; list = list.filter(function(x){ return x[1] !== 'ifsc'; }); list.splice(2, 0, code); }
  if (type === 'licence') { var india = cc === 'IN', pan = list.filter(function(x){ return x[1] === 'pan'; });   /* India's second id comes from the one list above, never a second literal */
    list = [[words.gstin, 'gstin']].concat(india ? pan : cc === 'AU' ? [['ACN', 'acn']] : []).concat(LICENCE_ROWS, list.filter(function(x){ return ['gstin', 'pan'].indexOf(x[1]) < 0 && (india || ['iec', 'lut', 'ad_code'].indexOf(x[1]) < 0); })); }
  return list;
}
/** W23: a licence's standard rows — name · number · issuer · valid until — offered first in every country */
var LICENCE_ROWS = [['Licence name', 'licence_name'], ['Licence number', 'licence_no'], ['Issued by', 'issuer'], ['Valid until', 'valid_until']];
/** W19/W23: the rows a new section opens with — the standard fields first (country-aware), free rows still allowed after */
function vaultStarterRows(type, fill){
  var f = fill || {};
  var picks = type === 'identity' ? ['legal_name', 'gstin', 'address', 'state', 'pincode'] : type === 'licence' ? ['licence_name', 'licence_no', 'issuer', 'valid_until'] : type === 'bank' ? ['bank_name', 'account_no'] : type === 'signatory' ? ['name', 'designation'] : [];
  var sug = vaultSuggest(type);
  var rows = picks.map(function(tag){ var hit = sug.filter(function(x){ return x[1] === tag; })[0]; return { name: hit ? hit[0] : tag, tag: tag, value: f[tag] || '' }; });
  return rows.length ? rows : [{ name: '', value: '' }];
}
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
    ? '<div style="font-size:var(--fs-1);color:var(--ok-2);background:var(--ok-tint);border:1px solid var(--ok-3,#bfe3cb);border-radius:9px;padding:7px 10px;margin:6px 0 2px">🔒 <b>' + tx('Encrypted at rest') + '</b> — stored ciphertext-only (a database dump can\'t read it). Safe for real banking &amp; tax details.</div>'
    : '<div style="font-size:var(--fs-1);color:var(--warn-2);background:var(--warn-tint);border:1px solid var(--gold-line,#f0dcae);border-radius:9px;padding:7px 10px;margin:6px 0 2px">⚠ <b>' + tx('Encryption not configured') + '</b> — the vault won\'t save until the platform sets its encryption key. ' + txf('Use {dummy} for now.', { dummy: '<b>' + tx('dummy data only') + '</b>' }) + '</div>';
  var only=UI._vaultOnly||'';   /* SET1: a small app asks for ONE section type (identity); the workshop's Documents shows them all */
  var secs=(UI._vault&&UI._vault.sections)||[];
  var shown=secs.map(function(s,i){ return [s,i]; }).filter(function(p){ return (!only||p[0].type===only)&&!VAULT_HIDDEN_TYPES[p[0].type]; });
  var body=shown.length ? shown.map(function(p){ return vaultSectionHTML(p[0],p[1]); }).join('')
    : '<div style="color:var(--grey);font-size:var(--fs-2);padding:9px 0" data-testid="vault-empty">' + (only ? esc(tx('Nothing here yet. Add it — the usual rows are offered first.')) : esc(tx('Nothing here yet. Add a section below — its usual rows come first; name any other detail you have.'))) + '</div>';
  var addOpts=Object.keys(VAULT_SECTION_TYPES).filter(function(t){ return (!only||t===only)&&!VAULT_HIDDEN_TYPES[t]; }).map(function(t){ return '<option value="'+t+'">'+esc(VAULT_SECTION_TYPES[t])+'</option>'; }).join('');
  if (only) return '<div style="'+_CARD+';margin-top:10px" data-testid="vault-only-'+esc(only)+'"><div class="sec" style="margin:0">'+esc(VAULT_SECTION_TYPES[only]||only)+'</div>'
    +encBanner+body
    +'<div style="display:flex;gap:7px;align-items:center;margin-top:13px;flex-wrap:wrap"><select class="inp" id="v_addtype" hidden>'+addOpts+'</select>'
      +(shown.length ? '' : '<button type="button" class="composebtn ghost" data-testid="vault-add-section" onclick="vaultAddSection()">+ '+esc(tx('add the business identity'))+'</button>')+'</div>'
    +'<div class="err" id="vault_err" style="margin-top:8px"></div>'
    +'<button type="button" class="composebtn" style="margin-top:11px" data-testid="vault-save" onclick="saveVaultUI()">' + esc(tx('Save')) + '</button></div>';
  return '<div style="'+_CARD+';margin-top:10px"><div class="sec" style="margin:0">🗂 Trade documents vault <span style="font-size:var(--fs-1);font-weight:600;color:var(--grey)">— fill once · pre-fills every form</span></div>'
    +'<div style="font-size:var(--fs-1);color:var(--grey);margin:3px 0 2px;line-height:1.5">These recurring details auto-fill your Commercial Invoice, Packing List and other authority forms. At form time you\'ll only be asked the shipment-specifics (invoice no, dates, ports). <b>' + tx('Name each detail the way you know it') + '</b> — the suggestions are a shortcut, never a limit.</div>'
    +encBanner
    +body
    +'<div style="display:flex;gap:7px;align-items:center;margin-top:13px;flex-wrap:wrap">'
      +'<select class="inp" id="v_addtype" data-testid="vault-add-type" style="max-width:210px;margin:0" onchange="vaultPickType(this.value)">'+addOpts+'</select>'
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
  var tag=r.tag||'', hint=(tag==='gstin'&&shopCc()!=='IN')?'':(VAULT_HINT[tag]||''), enums=VAULT_ENUM[tag];   /* W19: India's 15-character hint only on an Indian shop */
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
    +'<input class="inp" list="vsug_'+esc(type)+'" style="flex:1 1 130px;min-width:110px;margin:0" placeholder="'+esc(txf('detail name — e.g. {x}', { x: (vaultSuggest(type)[0]||['Name'])[0] }))+'" value="'+esc(r.name||'')+'" oninput="vaultSetRow('+i+','+j+',\'name\',this.value)">'
    +val
    /* the trust rung the profile map gave this row (declared → copied → checked → verified) and where it came from —
       a row a connector copied says so; a row you typed says nothing (declared is the floor, not a badge) */
    +((r.rung&&r.rung!=='declared')||(r.source&&r.source!=='profile')
        ? '<span data-testid="vault-rung" title="'+esc((r.source?'from '+r.source:'')+(r.as_of?' · as of '+String(r.as_of).slice(0,10):''))+'" style="font-size:var(--fs-1);font-weight:800;padding:1px 6px;border-radius:9px;white-space:nowrap;color:'+(r.rung==='verified'?'var(--ok-2)':r.rung==='checked'?'var(--blue-2)':'var(--grey-2)')+';background:'+(r.rung==='verified'?'var(--ok-tint)':r.rung==='checked'?'var(--blue-tint-bg)':'var(--neutral-tint)')+'">'+esc(String(r.rung||'copied').toUpperCase())+(r.source&&r.source!=='profile'?' · '+esc(r.source):'')+'</span>'
        : '')
    +'<button type="button" title="Remove this detail" onclick="vaultDelRow('+i+','+j+')" style="border:1px solid var(--line);background:var(--card);color:var(--grey);border-radius:8px;min-width:28px;min-height:28px;cursor:pointer">×</button></div>';
}
/* The suggestion lists — one <datalist> per section type, emitted once. A datalist SUGGESTS and never restricts,
   which is exactly the contract we want: type "IFSC code" and get the tag, type anything else and keep it. */
function vaultDatalists(){
  return Object.keys(VAULT_SUGGEST).map(function(t){
    return '<datalist id="vsug_'+t+'">'+vaultSuggest(t).map(function(s){ return '<option value="'+esc(s[0])+'">'; }).join('')+'</datalist>';
  }).join('');
}
function _vaultSecs(){ UI._vault=UI._vault||{sections:[]}; UI._vault.sections=UI._vault.sections||[]; return UI._vault.sections; }
function _vaultPaint(){ var h=document.getElementById('vaulthost'); if(h) h.innerHTML=vaultCardHTML(null,UI._vaultEnc)+vaultDatalists()+vaultEnd(); }
/** W22: the section the picker holds — remembered as it is chosen (UI._vaultAddType), so a repaint between the choice and the press cannot reset it */
function vaultPickType(v){ UI._vaultAddType=String(v||''); }
function vaultAddSection(){ var s=document.getElementById('v_addtype'), type=UI._vaultAddType||(s&&s.value)||(UI._vaultOnly||'other');
  _vaultSecs().push({type:VAULT_SECTION_TYPES[type]?type:'other',label:'',rows:vaultStarterRows(type)}); _vaultPaint(); }
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
  var hit=vaultSuggest(s.type).concat(VAULT_SUGGEST[s.type]||[]).filter(function(x){ return x[0].toLowerCase()===String(v).trim().toLowerCase(); })[0];
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
    /* ⭐ profileGet, core's one name for this GET — `vaultGet` was a third alias for it (see e2e/ep-aliases.cjs) */
    try{ var p=(await api('profileGet'))||{};
      /* The server normalises legacy group-shaped vaults to {sections} on read, so there is exactly one shape here. */
      vaultHold({sections:((p.vault||{}).sections)||[]}, p.vault_version); UI._vaultEnc=!!p.vault_encrypted;
    }catch(e){ vaultHold({sections:[]}, null); UI._vaultEnc=false; if(typeof cblog==='function')cblog('error','vault read: '+((e&&e.message)||e)); }
  }
  var h2=document.getElementById('vaulthost'); if(!h2) return;   // ⚠️ re-query: a repaint may have landed mid-fetch
  h2.innerHTML=vaultCardHTML(null,UI._vaultEnc)+vaultDatalists()+vaultEnd();
  if(window.CBOffline)CBOffline.autodraft(h2,'app.vault',{overwrite:true});   // restore unsaved edits over the server copy
}
/* ── ⭐ SET-WALK1 · W25 — THE VAULT IS SAVED AS A MERGE-PATCH WITH A VERSION, NEVER AS A WHOLE ─────────────────────────────────────
 * Athi's walk (15 Oct): a screen opened earlier overwrote a newer legal name because every Save sent { sections: ALL }. Now the model keeps
 * the copy it READ (UI._vaultBase) and its version (UI._vaultVersion, GET /profile vault_version); Save sends only what moved, as RFC 7386
 * over the KEYED view the api builds the same way (lib/vault-patch — the key rule below is its twin, pinned by e2e/vault-keys.cjs), and the
 * server refuses a stale version with 409 "Changed since you opened it — reload?" — painted with a Reload button. */
/** the server's copy, held as the base every patch is measured from */
function vaultHold(vault, version){
  UI._vault = { sections: (vault && vault.sections) || [] };
  UI._vaultBase = JSON.parse(JSON.stringify(UI._vault.sections));
  UI._vaultVersion = version == null ? null : String(version);
}
/** a unique key: the base, then #2, #3 … on a repeat (the api's vault-patch.uniqueKey) */
function vaultUniqueKey(base, seen){ var key=base, n=1; while(seen[key]){ n+=1; key=base+'#'+n; } seen[key]=true; return key; }
/** sections keyed `type|label`, rows keyed `t:<tag>` else `n:<name>` — the api's vault-patch.keyed, one rule on both sides */
function vaultKeys(sections){
  var out={}, seenSections={};
  (sections||[]).forEach(function(sec){
    var rows={}, seenRows={};
    (sec.rows||[]).forEach(function(r){ rows[vaultUniqueKey(r.tag?'t:'+String(r.tag).toLowerCase():'n:'+String(r.name||''), seenRows)]=r; });
    out[vaultUniqueKey(String(sec.type||'other')+'|'+String(sec.label||''), seenSections)]={ type:sec.type, label:sec.label||'', rows:rows };
  });
  return out;
}
/** a row as the server stores it: name · value · tag (the provenance rides back untouched) */
function vaultRowBody(r){ var o={ name:r.name||'', value:r.value||'', tag:r.tag||'' }; if(r.source) o.source=r.source; if(r.as_of) o.as_of=r.as_of; if(r.rung) o.rung=r.rung; return o; }
function vaultRowSame(a,b){ return !!a && !!b && (a.name||'')===(b.name||'') && (a.value||'')===(b.value||'') && (a.tag||'')===(b.tag||''); }
/** the merge-patch from the copy read to the model now: only sections and rows that moved; null = removed; empty when nothing moved */
function vaultPatch(base, now){
  var was=vaultKeys(base), is=vaultKeys(now), sections={}, any=false;
  Object.keys(was).forEach(function(k){ if(!is[k]){ sections[k]=null; any=true; } });
  Object.keys(is).forEach(function(k){
    var sec=is[k], old=was[k], rows={}, moved=false;
    if(!old){ var all={}; Object.keys(sec.rows).forEach(function(rk){ all[rk]=vaultRowBody(sec.rows[rk]); }); sections[k]={ type:sec.type, label:sec.label, rows:all }; any=true; return; }
    Object.keys(old.rows).forEach(function(rk){ if(!sec.rows[rk]){ rows[rk]=null; moved=true; } });
    Object.keys(sec.rows).forEach(function(rk){ if(!vaultRowSame(old.rows[rk], sec.rows[rk])){ rows[rk]=vaultRowBody(sec.rows[rk]); moved=true; } });
    if(moved){ sections[k]={ rows:rows }; any=true; }
  });
  return any ? { sections:sections } : null;
}
/** W25: the server's "changed since you opened it" — the sentence and the one button that fixes it */
function vaultConflictHTML(words){
  return '<span data-testid="vault-conflict">'+esc(words)+'</span> <button type="button" class="composebtn ghost" data-testid="vault-reload" onclick="loadVault()" style="margin-inline-start:8px;min-height:30px">'+esc(tx('Reload'))+'</button>';
}
async function saveVaultUI(){
  var err=document.getElementById('vault_err'); if(err)err.textContent='';
  /* ⚠️ THE MODEL IS THE TRUTH, not the DOM — every control writes straight into UI._vault as it is typed, so the
     save reads one object rather than scraping ids. That is what makes repeatable sections possible at all: there
     is no stable id to scrape when the same section can exist twice. The server drops empty rows; we send as-is. */
  var patch=vaultPatch(UI._vaultBase||[], _vaultSecs());
  if(!patch){ if(typeof toast==='function')toast(tx('Nothing to save.')); return; }
  UI._party = undefined;   /* the Invoice row's supplier block re-reads after a vault save */
  try{
    var r=await api('vaultSave',{body:{version:UI._vaultVersion, patch:patch}});
    vaultHold((r&&r.vault)||{sections:_vaultSecs()}, r&&r.version);
    if(window.CBOffline)CBOffline.clearDraft('app.vault'); if(typeof toast==='function')toast(tx('Vault saved ✓'));
    _vaultPaint();
  }
  catch(e){
    if(!err) return;
    if(e&&e.status===409) err.innerHTML=vaultConflictHTML((e.data&&e.data.message)||e.message||tx('Changed since you opened it — reload?'));
    else err.textContent=(e&&e.message)||tx('Could not save the vault');
  }
}

/* ── YOUR SHOP — the Business section of the profile (MOVED from iamHTML, cap-admin.js): the licence number · address · supplies the
 * invoice party reads (api lib/profile.js invoiceParty). Painted by the workshop's Profile AND by CB Settings › Your shop; saved by PATCH /entities/profile. ── */
/* ── 2 · BUSINESS PROFILE ──────────────────────────────────────────────────────────────────────────────
 * ⚠️ GSTIN IS INDIA-ONLY AND THIS IS THE HALF-STEP. Athi, 2026-08-19: *"GSTIN is for India — if it is for
 * any other country, how do they do? We may have to ask licence name and licence number… possibly we
 * provide suggestion based on country."* The full (scheme, value) pair needs a column and a country
 * catalogue; until then the label says what it is and where the name comes from, so the field stops
 * asserting that every business on earth is Indian. */
function shopLicLabel(){ return taxIdWord(shopCc()); }   /* STD2: the pack's word (helpers.js, the one reader); no pack → "Tax number" — the CBLocale region table is gone */
/** the shop's country as THIS card knows it (CB Settings › Your shop reads /me), else the page's — never written to the global SESSION.country (STD2) */
function shopCc(){ return (typeof CBShop !== 'undefined' && CBShop.country && CBShop.country()) || ''; }
/** the three inputs (ids pf_gstn · pf_addr · pf_sup — saveProfile and SHOP_FIELDS read them by id) */
function shopFieldsHTML(e, licLabel){
  return '<label class="fl">' + esc(licLabel)
    +   ' <span style="color:var(--grey);font-weight:400;font-size:var(--fs-1)">— your business registration</span></label>'
    + '<input class="inp" id="pf_gstn" value="' + esc(e.gstn || '') + '">'
    + '<label class="fl">' + tx('Address') + '</label>'
    + '<input class="inp" id="pf_addr" value="' + esc(e.address || '') + '">'
    /* ⭐ SET-WALK1 · W27(a): GOODS · SERVICES · BOTH is a tax attribute of the business, not a bill line — it moved to Country setup, beside
       the tax registration (cap-country.js csuSuppliesRow); the one writer stays PATCH /entities/profile `supplies` (SHOP_SUPPLIES). */
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
    ;
}
/** the fields PATCH /entities/profile takes from this card — cap-admin's PROF_FIELDS.profile IS this list */
var SHOP_FIELDS = [['pf_gstn', 'gstn'], ['pf_addr', 'address']];
/** W27(a): the supplies choice — the GST/WTO vocabulary (goods · services · both; "both" is the common case: a garage sells a part and fits it) */
var SHOP_SUPPLIES = [['goods', 'Goods'], ['services', 'Services'], ['both', 'Both']];
/** what a section sends: only inputs on screen and not capped — the rule saveProfile (cap-admin.js) has always applied, in one place */
function profFieldsBody(pairs){
  var b = {};
  (pairs || []).forEach(function(pair){
    var el = document.getElementById(pair[0]);
    if (!el || el.disabled) return;          // not rendered, or capped → not this person's to send
    var v = val(pair[0]);
    if (v !== '') b[pair[1]] = v;
  });
  return b;
}

/** the workshop's pane ends with its marker (cap-admin.js _capEnd); a small app has no pane to end */
function vaultEnd(){ return (typeof _capEnd === 'function') ? _capEnd() : ''; }

/* ── CB SETTINGS › YOUR SHOP — the page's host mounts the two cards here ───────────────────────────────────────────────────────── */
var CBShop = (function () {
  var H = { host: null, me: null, loading: false, cc: '' };
  function esc0(v){ return esc(v); }
  function card(title, body, tid){
    return '<section class="shop-card" data-testid="' + tid + '" style="' + _CARD + '"><h2 class="shop-h">' + esc0(title) + '</h2>' + body + '</section>';
  }
  /** the Business section: the same inputs the workshop's Profile paints (shopFieldsHTML), one Save (M64) */
  function shopCardHTML(e){
    var who = SESSION && SESSION.actorId;
    return shopFieldsHTML(e || {}, shopLicLabel())
      + '<div class="err" id="pf_err_profile" data-testid="shop-err" style="margin-top:8px"></div>'
      + (who ? '<p class="sub" data-testid="shop-ask-owner">' + esc0(tx('Only the owner can change these. Ask the owner.')) + '</p>'
             : '<button type="button" class="act" id="shop-save" data-testid="shop-save" style="margin-top:8px">' + esc0(tx('Save')) + '</button>');
  }
  /** W26: the line that says what the top box feeds, INSIDE the top box; the lower box says it feeds an authority's forms */
  function billLine(){
    return '<p class="sub" data-testid="shop-why" style="margin:10px 0 0">' + esc0(packSplitsByState(H.cc)
      ? txf('These go on every bill. A tax invoice names one state: the {id}, the address and the {postcode} must agree.', { id: taxIdWord(H.cc), postcode: tx(packWord('postcode', H.cc)) })
      : txf('These go on every bill: the {id} and the address.', { id: taxIdWord(H.cc) })) + '</p>';
  }
  function paint(){
    var h = H.host; if (!h) return;
    UI._vaultOnly = 'identity';
    h.innerHTML = card(tx('Your shop'), shopCardHTML(H.me) + billLine(), 'shop-card')
      + '<p class="sub" data-testid="shop-print-door"><a class="sx-link" href="/settings.html#/print" data-testid="shop-print-link">' + esc0(tx('What prints on the bill — Print setup')) + ' ›</a></p>'
      + '<h2 class="shop-h" style="margin-top:14px" data-testid="shop-forms-title">' + esc0(tx('Used on forms for an authority')) + '</h2>'
      + '<p class="sub" data-testid="shop-forms-why">' + esc0(tx('The legal name and address an authority form prints.')) + ' <a class="sx-link" href="/settings.html#/account" data-testid="shop-licences-link">' + esc0(tx('Licences & registrations')) + ' ›</a></p>'
      + '<div id="vaulthost" data-testid="shop-identity"></div>';
    var b = document.getElementById('shop-save'); if (b) b.onclick = function () { shopSave(b); };
    loadVault().then(prefillIdentity);
  }
  /** W14b: one place for the address — an EMPTY Business identity opens with the shop's own details already in its rows (nothing is saved until Save) */
  function prefillIdentity(){
    var secs = _vaultSecs(); if (secs.some(function (x) { return x.type === 'identity'; })) return;
    var me = H.me || {}; if (!me.address && !me.gstn && !me.display_name) return;
    secs.push({ type: 'identity', label: '', rows: vaultStarterRows('identity', { legal_name: me.legal_name || '', gstin: me.gstn || '', address: me.address || '' }) });
    _vaultPaint();
  }
  function read(){
    if (H.loading) return; H.loading = true;
    api('me').then(function (r) { H.me = (r && (r.entity || r)) || {}; }, function (e) { H.me = {}; if (e && e.status === 401 && typeof CBFrame !== 'undefined') CBFrame.ended(); })
      .then(function () { H.loading = false; shopCountry(H.me); paint(); });
  }
  /** the shop's country from /me, kept on THIS card (STD2: never written to the global SESSION.country) — the words above pass it to helpers.js shopReg(cc) */
  function shopCountry(me){ var c = me && (me.country || me.country_code); H.cc = c ? String(c).toUpperCase() : ''; }
  function mount(host, o){ H.host = host; H.me = (o && o.me) || null; if (H.me) { shopCountry(H.me); paint(); } else read(); }
  return { mount: mount, refresh: read, paint: paint, country: function () { return H.cc; } };
})();
/** Your shop › Save: one press, one PATCH, the outcome said where it happened (M64); the server's refusal in its own words */
function shopSave(btn){
  var x = document.getElementById('pf_err_profile'); if (x) x.textContent = '';
  var body = profFieldsBody(SHOP_FIELDS);
  if (!Object.keys(body).length) { if (x) x.textContent = tx('Nothing to save.'); return; }
  CBAction.run(btn, function () { return api('saveProfile', { body: body }); }, {
    key: 'shop-save', busy: tx('Saving…'),
    outcome: function () { toast(tx('Shop details saved.')); if (typeof UI !== 'undefined') UI._me = null; UI._party = undefined; CBShop.refresh(); },
    onFail: function (words) { if (x) x.textContent = words; },
  });
}
