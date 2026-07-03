/* app/cap-admin.js — the "admin" capability (progressively loaded on demand).
 * Injected by ensureCap('admin') the first time an admin screen (CAP_OF) is opened.
 * Classic script, shared global scope: references Core/helpers globals that are eager and already
 * present before this loads — api, mapApiActor, hatAssignable, menuAssist, scr, opt, inr, esc,
 * scrErr, val, toast, MSG, _CARD, CURRENCIES, UI. Screens: MIS, Profile, Settings (+ governance).
 * (Co-assists is planned to move here too, once its shared actor helpers are separated.) */

/* ---- MIS ---- */
function misScreen(){ return scr("📊 MIS","misbody","mis"); }
async function loadMIS(){ const h=document.getElementById("misbody"); if(!h)return;
  try{ const [inb,dq,ac,sp]=await Promise.all([api("inbox"),api("disputeQueue").catch(()=>({})),api("actors").catch(()=>({})),api("supList").catch(()=>({}))]);
    const chits=(inb||[]).map(mapApiChit); const byState={open:0,act:0,close:0}; let value=0; chits.forEach(c=>{byState[c.state]=(byState[c.state]||0)+1; value+=c.amt||0;});
    const openDisp=dq.total_open!=null?dq.total_open:((dq.my_disputes||[]).length+(dq.other_disputes||[]).length);
    const stat=(label,v)=>`<div style="${_CARD};text-align:center;margin:0"><div style="font-size:21px;font-weight:800;font-family:'Space Grotesk'">${v}</div><div style="font-size:11px;color:var(--grey)">${label}</div></div>`;
    h.innerHTML=`${menuAssist('mis')}<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px">
      ${stat("Chits",chits.length)}${stat("Deal value",inr(value))}
      ${stat("Open",byState.open)}${stat("In progress",byState.act)}
      ${stat("Closed",byState.close)}${stat("Open disputes",openDisp)}
      ${stat("Actors",(ac||[]).length)}${stat("Suppliers",(sp||[]).length)}</div>
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
      <div class="err" id="pf_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveProfile()">Save profile</button></div>`;
  }catch(e){ h.innerHTML=scrErr(e); } }
async function saveProfile(){ const x=document.getElementById("pf_err"); if(x)x.textContent="";
  try{ await api("saveProfile",{body:{user_id:val("pf_uid")||null,gstn:val("pf_gstn")||null,address:val("pf_addr")||null,business_status:val("pf_bs")}}); toast(MSG.profileSaved()); }catch(e){ if(x)x.textContent=e.message; } }

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
async function loadSettings(){ const h=document.getElementById("setbody"); if(!h)return;
  try{ const [s,_acts]=await Promise.all([api("getSettings").then(r=>r||{}), api("actors").then(r=>(r||[]).map(mapApiActor)).catch(()=>[])]);
    const _assign=_acts.filter(a=>hatAssignable(a.hat));
    const _daOpts='<option value="">— none (leave in pool) —</option>'+_assign.map(a=>`<option value="${a.id}"${s.default_assignee_actor_id===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
    h.innerHTML=`${menuAssist('settings')}${govLayersBlock()}<div style="${_CARD}">
      <div style="background:#fbeceb;border:1px solid #f0c9c6;border-radius:8px;padding:8px 11px;font-size:11.5px;color:#b4453f;margin-bottom:11px">⏳ These preferences are saved but <b>not yet active</b> — they don't change behaviour yet.</div>
      <label class="fl">Assignment model</label><select class="inp" id="st_am">${opt(["pull","push","both"],s.assignment_model||"both")}</select>
      <label class="fl">Default max tasks per actor</label><input class="inp" id="st_mt" inputmode="numeric" value="${esc(s.default_max_tasks||10)}">
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_av" ${s.all_task_visible?'checked':''}> All tasks visible to all actors</label>
      <label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="st_ar" ${s.auto_return_on_short_break?'checked':''}> Auto-return tasks on short break</label>
      <div class="err" id="st_err"></div><button class="composebtn" style="margin-top:9px" onclick="saveSettings()">Save settings</button></div>${autoAssignCard(s,_daOpts)}<div style="border:1px solid var(--line);border-radius:11px;padding:13px;margin-top:10px"><div class="sec" style="margin:0 0 6px">📎 Attachment policy <span style="font-size:10px;font-family:'Space Mono';background:#f3f0e8;color:#7a5e22;border-radius:5px;padding:1px 6px">governance · stub</span></div><label class="fl">Allowed types</label><input class="inp" id="st_atttypes" value="image, pdf, docx, xlsx, csv, zip"><label class="fl">Max size per file (MB)</label><input class="inp" id="st_attsize" inputmode="numeric" value="10"><label class="fl">Max attachments per chit</label><input class="inp" id="st_attcount" inputmode="numeric" value="10"><div style="font-size:11px;color:var(--grey);margin-top:6px">Where allowed-types / size / count rules live (enforced backend-side). Not active yet.</div></div>`;
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
