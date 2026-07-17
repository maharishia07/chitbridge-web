/* app/cap-admin.js — the "admin" capability (progressively loaded on demand).
 * Injected by ensureCap('admin') the first time an admin screen (CAP_OF) is opened.
 * Classic script, shared global scope: references Core/helpers globals that are eager and already
 * present before this loads — api, mapApiActor, hatAssignable, menuAssist, scr, opt, inr, esc,
 * scrErr, val, toast, MSG, _CARD, CURRENCIES, UI. Screens: MIS, Profile, Settings (+ governance).
 * (Co-assists is planned to move here too, once its shared actor helpers are separated.) */

if (typeof EP !== 'undefined') { Object.assign(EP, {
  vaultGet:  {m:'GET', p:'/api/governance/profile',       ok:'y'},   // returns the trade profile incl. .vault
  vaultSave: {m:'PUT', p:'/api/governance/profile/vault', ok:'y'},
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
/* ---- MIS ---- */
function misScreen(){ return scr("📊 MIS","misbody","mis"); }
async function loadMIS(){ const h=document.getElementById("misbody"); if(!h)return;
  try{ const [inb,dq,ac,sp]=await Promise.all([api("inbox"),api("disputeQueue").catch(()=>({})),api("actors").catch(()=>({})),api("supList").catch(()=>({}))]);
    const chits=(inb||[]).map(mapApiChit); const byState={open:0,act:0,close:0}; let value=0; chits.forEach(c=>{byState[c.state]=(byState[c.state]||0)+1; value+=c.amt||0;});
    const openDisp=dq.total_open!=null?dq.total_open:((dq.my_disputes||[]).length+(dq.other_disputes||[]).length);
    const stat=(label,v)=>`<div style="${_CARD};text-align:center;margin:0"><div style="font-size:21px;font-weight:800;font-family:'Space Grotesk'">${v}</div><div style="font-size:11px;color:var(--grey)">${label}</div></div>`;
    UI._mis={ chits:chits.length, deal_value:value, currency:'INR', open:byState.open, in_progress:byState.act, closed:byState.close, open_disputes:openDisp, co_assists:(ac||[]).length, suppliers:(sp||[]).length };
    h.innerHTML=`${menuAssist('mis')}<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button onclick="aiRun('metrics-narrate',UI._mis,{title:'📊 Explain my metrics'})" title="AI narrates what your numbers say" style="font-size:12px;font-weight:700;border:1px solid #6d5bd0;background:#f2effc;color:#6d5bd0;border-radius:8px;padding:7px 12px;cursor:pointer">✨ Explain</button></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px">
      ${stat("Chits",chits.length)}${stat("Deal value",inr(value))}
      ${stat("Open",byState.open)}${stat("In progress",byState.act)}
      ${stat("Closed",byState.close)}${stat("Open disputes",openDisp)}
      ${stat("Co-assists",(ac||[]).length)}${stat("Suppliers",(sp||[]).length)}</div>
      <div style="margin-top:10px;color:var(--grey);font-size:11px">Computed on view from your live data — there is no MIS route on the legacy backend yet (a server-side rollup is the production model).</div>`;
  }catch(e){ h.innerHTML=scrErr(e); } }

/* ---- PROFILE ---- */
function profileScreen(){ return scr("👤 Profile","profbody","profile"); }
async function loadProfile(){ const h=document.getElementById("profbody"); if(!h)return;
  if(SESSION.role==='actor') return loadActorProfile(h);   // actors get their own profile, not the entity's
  try{ const e=(await api("me"))||{};
    h.innerHTML=`${menuAssist('profile')}<div style="${_CARD}"><div class="kv"><b>Name</b> · ${esc(e.display_name)}</div><div class="kv"><b>Bridge ID</b> · ${esc(e.bridge_id)}</div><div class="kv"><b>Email</b> · ${esc(e.email)}</div>
      <label class="fl">User ID <span style="color:var(--grey);font-size:11px">— others add you with this</span></label><input class="inp" id="pf_uid" value="${esc(e.user_id||'')}" placeholder="e.g. yourname or you@email.com">
      <label class="fl">GSTN</label><input class="inp" id="pf_gstn" value="${esc(e.gstn)}">
      <label class="fl">Address</label><input class="inp" id="pf_addr" value="${esc(e.address)}">
      <label class="fl">Shop status</label><select class="inp" id="pf_bs">${opt(["open","closed","away"],e.business_status)}</select>
      <div class="err" id="pf_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveProfile()">Save profile</button></div>${storefrontCardHTML(e)}${govCardHTML(e.governance)}<div id="vaulthost"></div>`;
    loadVault();   // the trade documents vault (async — pre-fills authority forms)
  }catch(e){ h.innerHTML=scrErr(e); } }
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
  var sfopts=[['browse','Browse first — catalogue is open; sign in only to order'],['login','Login first — customer signs in before browsing']]
    .map(function(o){return '<option value="'+o[0]+'"'+(acc===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');
  return '<div style="'+_CARD+';margin-top:10px">'
    +'<div class="sec" style="margin:0 0 8px">🛍️ Customer storefront</div>'
    +'<div style="font-size:12px;color:var(--grey);line-height:1.5;margin-bottom:8px">Share this link — anyone can open it and order from your catalogue. No account needed (they confirm with a one-time code).</div>'
    +'<div style="background:#f4f6f8;border:1px solid var(--line);border-radius:9px;padding:8px 10px"><span class="mono" id="sf_url" style="font-size:11.5px;word-break:break-all">'+esc(url)+'</span></div>'
    +'<div style="display:flex;gap:8px;margin-top:8px"><button class="composebtn" onclick="sfCopy()">📋 Copy link</button><button class="composebtn" style="background:#fff" onclick="window.open(document.getElementById(\'sf_url\').textContent,\'_blank\')">Open ↗</button></div>'
    +'<label class="fl" style="margin-top:12px">Customer access</label><select class="inp" id="pf_sfaccess" style="max-width:340px">'+sfopts+'</select>'
    +'<div class="err" id="pf_err2"></div><button class="composebtn" style="margin-top:9px" onclick="saveStorefront()">Save storefront</button>'
    +'</div>';
}
function sfCopy(){ var u=document.getElementById('sf_url'); if(!u)return; var t=u.textContent;
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(function(){toast('Storefront link copied ✓');}).catch(function(){toast(t);}); }
  else toast(t); }
async function saveStorefront(){ var x=document.getElementById('pf_err2'); if(x)x.textContent='';
  try{ await api('saveProfile',{body:{storefront_access:val('pf_sfaccess')}}); toast('Storefront access saved ✓'); }catch(e){ if(x)x.textContent=e.message; } }

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
function settingsScreen(){ return scr("⚙️ Settings","setbody","settings"); }
// AI assists settings = a REDIRECT to Co-assists (the enable + rule live WITH the actor, next to Human/IoT/ERP —
// a lit AI slot is an actor whose actions are disputable chits, so its control belongs where it's held accountable).
function aiSettingsCard(){ return '<div style="'+_CARD+'"><div class="sec" style="margin:0 0 6px">🤖 AI assists <span style="font-size:10px;font-family:\'Space Mono\';background:#f3f0e8;color:#7a5e22;border-radius:5px;padding:1px 6px">governed</span></div>'
  +'<div style="font-size:12px;color:var(--grey);line-height:1.55">Turn AI helpers on or off and set each one\'s rule — the human gate, bounded by the rung floor (you can only tighten). They live with your other co-assists, because a lit AI slot is an <b>actor</b> whose every action is a chit you can dispute.</div>'
  +'<button class="composebtn" style="margin-top:10px" onclick="goCoassistAI()">Configure AI assists in Co-assists →</button></div>'; }
function goCoassistAI(){ try{ if(typeof UI!=='undefined') UI.acTypeF='ai'; }catch(_){}
  if(typeof navTo==='function') navTo('coassists'); else if(typeof go==='function') go('#/coassists'); }
async function loadSettings(){ const h=document.getElementById("setbody"); if(!h)return;
  try{ const [s,_acts]=await Promise.all([api("getSettings").then(r=>r||{}), api("actors").then(r=>(r||[]).map(mapApiActor)).catch(()=>[])]);
    const _assign=_acts.filter(a=>hatAssignable(a.hat));
    const _daOpts='<option value="">— none (leave in pool) —</option>'+_assign.map(a=>`<option value="${a.id}"${s.default_assignee_actor_id===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
    h.innerHTML=`${menuAssist('settings')}${govLayersBlock()}<div style="${_CARD}">
      <div style="background:#fbeceb;border:1px solid #f0c9c6;border-radius:8px;padding:8px 11px;font-size:11.5px;color:#b4453f;margin-bottom:11px">⏳ These preferences are saved but <b>not yet active</b> — they don't change behaviour yet.</div>
      <label class="fl">Assignment model</label><select class="inp" id="st_am">${opt(["pull","push","both"],s.assignment_model||"both")}</select>
      <label class="fl">Default max tasks per actor</label><input class="inp" id="st_mt" inputmode="numeric" value="${esc(s.default_max_tasks||10)}">
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_av" ${s.all_task_visible?'checked':''}> All tasks visible to all co-assists</label>
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_ar" ${s.auto_return_on_short_break?'checked':''}> Auto-return tasks on short break</label>
      <div class="err" id="st_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveSettings()">Save settings</button></div>${autoAssignCard(s,_daOpts)}<div style="border:1px solid var(--line);border-radius:11px;padding:13px;margin-top:10px"><div class="sec" style="margin:0 0 6px">📎 Attachment policy <span style="font-size:10px;font-family:'Space Mono';background:#f3f0e8;color:#7a5e22;border-radius:5px;padding:1px 6px">governance · stub</span></div><label class="fl">Allowed types</label><input class="inp" id="st_atttypes" value="image, pdf, docx, xlsx, csv, zip"><label class="fl">Max size per file (MB)</label><input class="inp" id="st_attsize" inputmode="numeric" value="10"><label class="fl">Max attachments per chit</label><input class="inp" id="st_attcount" inputmode="numeric" value="10"><div style="font-size:11px;color:var(--grey);margin-top:6px">Where allowed-types / size / count rules live (enforced backend-side). Not active yet.</div></div>${aiSettingsCard()}${blueprintSettingsHTML()}`;
  }catch(e){ h.innerHTML=scrErr(e); } }
async function saveSettings(){ const x=document.getElementById("st_err"); if(x)x.textContent="";
  try{ await api("saveSettings",{body:{assignment_model:val("st_am"),default_max_tasks:+val("st_mt")||10,all_task_visible:document.getElementById("st_av").checked,auto_return_on_short_break:document.getElementById("st_ar").checked}}); toast(MSG.settingsSaved()); }catch(e){ if(x)x.textContent=e.message; } }
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
