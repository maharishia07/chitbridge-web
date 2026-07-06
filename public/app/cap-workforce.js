/* app/cap-workforce.js — the CO-ASSIST (workforce) capability: FUNCTIONALITY only.
 * Injected by ensureCap('workforce') on first open of the Co-assists screen; classic script, shared global scope.
 * Screen + render + actions (create/invite/PIN/cover/shift/deactivate) + loadCoassists. NO help content
 * (co-assist help lives in app/cap-help.js, lazy). References eager Core/helpers globals at runtime:
 * api, mapApiActor, hatLabel/hatAssignable/HAT_LABEL, acType/acShc/acShLabel/acFlt/acDate/acLogin/acLbl,
 * addActorModal/submitActor/actorInviteModal/actorCleanupModal/confirmAsk, scr, esc, val, opt, toast,
 * modal/closeModal, announce, coId/acIdPrev, startDrag, openHelp, UI/SESSION/STORE.
 * Spec: chitbridge-api/docs/COASSIST-USECASES.md . Tests: COASSIST-REGRESSION.md. */
/* connector endpoints — registered here too (Connectors page is dismounted; connectors live in Co-assists) */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    connectorConns:      {m:'GET',   p:'/api/connectors/:actorId/connections',         ok:'y'},
    connectorConnAdd:    {m:'POST',  p:'/api/connectors/:actorId/connections',         ok:'y'},
    connectorConnToggle: {m:'PATCH', p:'/api/connectors/:actorId/connections/:connId', ok:'y'},
    connectorProvision:  {m:'GET',   p:'/api/connectors/:actorId/provisioning',        ok:'y'},
    connectorPing:       {m:'POST',  p:'/api/connectors/:actorId/ping',                ok:'y'},
    connectorCreate:     {m:'POST',  p:'/api/connectors',                              ok:'y'},
    connectorList:       {m:'GET',   p:'/api/connectors',                              ok:'y'},
  });
}
function coassistsScreen(){
  const list = `<div class="list">
    <div class="lh">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px"><span style="font-family:'Space Grotesk';font-weight:700;font-size:14px">🧑‍🤝‍🧑 Co-assists</span><button onclick="openAssist('coassists')" title="Ask the assistant about this screen" style="border:1px solid var(--line);background:#fff;color:#3F66A6;border-radius:50%;width:20px;height:20px;font-weight:800;cursor:pointer;font-size:12px;line-height:1;flex:none">?</button></div>
      <div style="display:flex;gap:7px"><input class="inp" id="ac_add" placeholder="New actor — person, device, system or agent" style="flex:1" readonly onclick="openActorWiz()"><button class="composebtn" onclick="openActorWiz()">+ New</button></div>
      <div class="srch" style="margin-top:8px">🔍 <input placeholder="Search name, role, key" value="${esc(UI.acQ||'')}" oninput="UI.acQ=this.value;paintAcList()"></div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--grey);flex-wrap:wrap">
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden">${['active','inactive','all'].map(f=>`<button onclick="setAcFlt('${f}')" style="border:0;background:${acFlt()===f?'var(--blue)':'#fff'};color:${acFlt()===f?'#fff':'var(--grey)'};font-weight:700;font-size:11px;padding:4px 9px;text-transform:capitalize">${f}</button>`).join('')}</span>
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden">${[['all','All'],['human','👤'],['iot','🛰️'],['erp','🔌']].map(t=>`<button onclick="setAcTypeF('${t[0]}')" title="${t[0]==='all'?'all types':t[0]}" style="border:0;background:${(UI.acTypeF||'all')===t[0]?'var(--blue)':'#fff'};color:${(UI.acTypeF||'all')===t[0]?'#fff':'var(--grey)'};font-weight:700;font-size:11px;padding:4px 9px">${t[1]}</button>`).join('')}</span>
        <span style="margin-left:auto" id="ac_count">${acVisible().length}</span></div>
    </div>
    <div class="rows" id="ac_rows">${UI._acLoading?'<div class="loadwrap"><span class="spin"></span> loading…</div>':acRowsHTML()}</div>
  </div>`;
  const detail = `<div class="detail" id="detailpane">${acDetailHTML()}</div>`;
  const divider = `<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>`;
  const showDetail = (UI.vp==='mob') && UI.mdetail;
  return `<div class="panel ${showDetail?'showdetail':''}" id="panel" style="--lw:${UI.lw}px;--lh:${UI.lh}px">${list}${divider}${detail}</div>`;
}
/* ── Full-panel Add-actor WIZARD (2026-07-06) — one responsive frame BELOW the top bar, same on every step,
 *    back/forth, ≤2-3 fields per pane (rule: more detail → more panes). Type picker → type-specific steps →
 *    result. Panel top is MEASURED from .topbar at render (not hardcoded 52px) so it fits any device/font;
 *    content sits in a centred ≤560px column so 4"/6"/tablet/desktop all read right. Ready types create for
 *    real (Human→addActor · IoT→connectorCreate); explore types walk to a "how it works" preview. */
var AW_STEPS={ human:['who','hat'], iot:['gw','mode'], erp:['sys','conn'], ai:['agent','guard'] };
function _awCap(k){ return ((typeof SESSION!=='undefined'&&SESSION.capabilities)||[]).indexOf(k)>=0; }
function _awReady(t){ return t==='human'?true:(t==='ai'?_awCap('ai'):_awCap('connector')); }
function openActorWiz(){ UI.awType=null; UI.awStep=0; UI.awData={}; UI.awErr=null; UI.awResult=null; awRender(); }
function awClose(){ var h=document.getElementById('actorwiz'); if(h)h.remove(); }
function awHost(){ var h=document.getElementById('actorwiz'); if(!h){ h=document.createElement('div'); h.id='actorwiz'; document.body.appendChild(h); } return h; }
function awCapture(){ UI.awData=UI.awData||{}; ['aw_name','aw_key','aw_hat','aw_site','aw_mode','aw_baseurl','aw_authref','aw_role','aw_under'].forEach(function(id){ var el=document.getElementById(id); if(el) UI.awData[id]=el.value; }); }
function awPick(t){ UI.awType=t; UI.awStep=0; UI.awErr=null; awRender(); }
function awNext(){ awCapture(); var s=AW_STEPS[UI.awType]||[]; if(UI.awStep>=s.length-1){ awFinish(); } else { UI.awStep++; UI.awErr=null; awRender(); } }
function awBack(){ awCapture(); UI.awErr=null; if(UI.awStep==='done'){ UI.awStep=(AW_STEPS[UI.awType]||[]).length-1; UI.awResult=null; } else if(UI.awStep===0){ UI.awType=null; } else { UI.awStep--; } awRender(); }
async function awFinish(){
  awCapture(); var t=UI.awType, d=UI.awData||{};
  if(!_awReady(t)){ UI.awResult=_awPreviewHtml(t); UI.awStep='done'; UI.awErr=null; awRender(); return; }
  if(t==='human'){
    var name=(d.aw_name||'').trim(), key=(d.aw_key||'').toLowerCase().trim();
    if(!name||key.length<4){ UI.awErr='A display name and a User ID of 4+ characters are required.'; awRender(); return; }
    if(!/^[a-z0-9]+$/.test(key)){ UI.awErr='User ID: lowercase letters and numbers only.'; awRender(); return; }
    try{ var r=await api('addActor',{body:{display_name:name,actor_key:key,hat:d.aw_hat||'act'}});
      var lf=(r&&(r.login_format||(r.actor&&r.actor.login_format)))||(typeof coId==='function'?coId(key):key);
      var otp=(r&&(r.otp||r.dev_otp))||'';
      UI.awResult='<div style="text-align:center"><div style="font-size:34px;margin:8px 0 6px">✉️</div><div style="font-weight:700;font-size:16px">Invite ready</div><div style="font-size:13px;color:#3a4048;line-height:1.7;margin-top:10px">User ID <b>'+esc(lf)+'</b><br>one-time code <b>'+esc(otp||'—')+'</b><br><br>Share these — they set a PIN and start on shift.</div></div>';
      UI.awStep='done'; UI.awErr=null; awRender();
      if(UI.nav==='coassists' && typeof loadCoassists==='function') loadCoassists();
    }catch(e){ UI.awErr=(e&&e.message)||'Create failed'; awRender(); }
    return;
  }
  var cfg = t==='iot' ? {mode:d.aw_mode||'push'} : {base_url:(d.aw_baseurl||'').trim()||undefined, auth_ref:(d.aw_authref||'').trim()||undefined};
  var nm2=(d.aw_name||'').trim(); if(nm2.length<2){ UI.awErr='A name of at least 2 characters is required.'; awRender(); return; }
  try{ var r2=await api('connectorCreate',{body:{display_name:nm2,type:t,site:(d.aw_site||'').trim()||undefined,config:cfg}});
    var pk=r2&&r2.provision_key;
    UI.awResult='<div style="text-align:center"><div style="font-size:34px;margin:8px 0 6px">'+(t==='iot'?'🔑':'🔌')+'</div><div style="font-weight:700;font-size:16px">'+(t==='iot'?'Connection string issued':'System connected')+'</div>'+(pk?('<div style="font-size:12px;color:#3a4048;margin-top:10px">ActorKey — shown once, copy it to the Pi:</div><pre style="background:#0f1b2d;color:#cfe0f4;border-radius:8px;padding:10px 12px;font-size:12px;overflow:auto;margin:8px 0 0;user-select:all">'+esc(pk)+'</pre>'):('<div style="font-size:12.5px;color:#3a4048;margin-top:10px">Add its '+(t==='iot'?'devices':'endpoints')+' in Connectors.</div>'))+'</div>';
    UI.awStep='done'; UI.awErr=null; UI.connectors=undefined; awRender();
    if(UI.nav==='coassists' && typeof loadCoassists==='function') loadCoassists();   // refresh the panel so the new Pi/system shows immediately
  }catch(e){ UI.awErr=(e&&e.message)||'Create failed'; awRender(); }
}
function _awPreviewHtml(t){
  var m={ erp:{ic:'🔌',nm:'ERP / API',how:'The system\'s endpoints exchange records over the governed rail — processed then forgotten (receipt only).'},
          ai:{ic:'🤖',nm:'AI agent',how:'A governed AI drafts / answers under your rules — every action it takes is a chit you can see and dispute.'},
          iot:{ic:'🛰️',nm:'IoT device',how:'A Pi publishes readings to the connection string we issue — they become chits over the rail.'} }[t]||{ic:'',nm:t,how:''};
  return '<div style="text-align:center"><div style="font-size:34px;margin:8px 0 6px">'+m.ic+'</div><div style="font-weight:700;font-size:16px">'+m.nm+' — how it works</div><div style="font-size:13px;color:#3a4048;line-height:1.6;margin-top:10px">'+m.how+'</div><div style="font-size:11.5px;color:#2c5aa0;background:#eef3fb;border:1px solid #cfe0f4;border-radius:9px;padding:9px 11px;margin-top:14px">✨ Explore mode — not activated for your entity yet.</div></div>';
}
function awRender(){
  var d=UI.awData||{};   // render THROUGH the app's shared modal() → same placement/backdrop/responsive as every other dialog
  function fld(id,label,ph){ return '<div style="margin-bottom:20px"><label class="fl" style="display:block;margin-bottom:5px">'+label+'</label><input class="inp" id="'+id+'" placeholder="'+ph+'" value="'+esc(d[id]||'')+'" style="width:100%"></div>'; }
  function selF(id,label,opts){ return '<div style="margin-bottom:20px"><label class="fl" style="display:block;margin-bottom:5px">'+label+'</label><select class="inp" id="'+id+'" style="width:100%">'+opts.map(function(o){ return '<option value="'+o[0]+'"'+(String(d[id])===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></div>'; }
  function how(x){ return '<div style="font-size:12px;color:var(--grey);background:#f7f7f5;border:1px solid var(--line);border-radius:10px;padding:10px 12px;line-height:1.5;margin-top:12px">'+x+'</div>'; }
  var body='', title='', sub='', dots='', foot='';
  if(UI.awType===null){
    title='Add to your workforce'; sub='What kind of actor? People, devices, systems and agents can all act for you.';
    var types=[['human','👤','Human','A person who acts for you'],['iot','🛰️','IoT device','A Pi / gateway that sends signals'],['erp','🔌','ERP / API','Connect a business system'],['ai','🤖','AI agent','An autonomous actor']];
    body='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+types.map(function(t){ var rdy=_awReady(t[0]);
      return '<div onclick="awPick(\''+t[0]+'\')" onmouseover="this.style.borderColor=\'#3F66A6\'" onmouseout="this.style.borderColor=\'#e5e2dd\'" style="border:1px solid #e5e2dd;border-radius:14px;padding:14px;cursor:pointer;'+(rdy?'':'opacity:.72')+'"><div style="font-size:24px">'+t[1]+'</div><div style="font-weight:700;font-size:14px;margin-top:6px">'+t[2]+'</div><div style="font-size:11.5px;color:#6a707a;margin-top:2px;line-height:1.35">'+t[3]+'</div><span style="display:inline-block;margin-top:9px;font-size:10px;font-weight:700;border-radius:20px;padding:1px 9px;'+(rdy?'background:#e8f3ec;color:#2f7a45':'background:#eef3fb;color:#2c5aa0')+'">'+(rdy?'ready':'explore')+'</span></div>';
    }).join('')+'</div>';
    foot='<button class="composebtn" style="flex:1" onclick="awClose()">Cancel</button>';
  } else {
    var steps=AW_STEPS[UI.awType]||[], rdy=_awReady(UI.awType);
    var icN={human:['👤','Human'],iot:['🛰️','IoT device'],erp:['🔌','ERP / API'],ai:['🤖','AI agent']}[UI.awType];
    title=icN[0]+' '+icN[1]+(rdy?'':' · explore');
    dots='<div style="display:flex;gap:6px;margin:0 0 14px">'+steps.map(function(s,i){ var st=(UI.awStep==='done'||i<UI.awStep)?'#9cc0ea':(i===UI.awStep?'#3F66A6':'#eceae6'); return '<span style="height:4px;flex:1;border-radius:3px;background:'+st+'"></span>'; }).join('')+'<span style="height:4px;flex:1;border-radius:3px;background:'+(UI.awStep==='done'?'#3F66A6':'#eceae6')+'"></span></div>';
    if(UI.awStep==='done'){
      sub=rdy?'Done':'Preview'; body=UI.awResult||'';
      foot='<button class="composebtn" style="flex:1" onclick="awBack()">‹ Back</button><button class="composebtn pri" style="flex:1" onclick="awClose()">'+(rdy?'Done':'Got it')+'</button>';
    } else {
      var sk=steps[UI.awStep];
      if(sk==='who') body=fld('aw_name','Display name','Anitha')+fld('aw_key','User ID (sign-in)','anitha')+how('They sign in with this User ID under your entity + a one-time code, then set a PIN.');
      else if(sk==='hat') body=selF('aw_hat','Hat (what they do)',[['act','Act — does the work'],['manager','Manager — acts + assigns'],['audit','Audit — review only'],['mis','MIS — reports'],['view_only','View-only']])+how('Only Act / Manager hats can be assigned work.');
      else if(sk==='gw') body=fld('aw_name','Gateway name','Line-1 Gateway')+fld('aw_site','Site','Chennai')+how('One Pi = one gateway; its sensors are connections (BridgeIds) under it.');
      else if(sk==='mode') body=selF('aw_mode','How it connects',[['push','push — we issue the key (Pi sends to us)'],['pull','pull — your broker (we subscribe)']])+how('Push is simplest for a Pi — we hand you a string to flash on it.');
      else if(sk==='sys') body=fld('aw_name','System name','Acme SAP')+fld('aw_site','Site','HQ')+how('One system = one actor; its endpoints are connections under it.');
      else if(sk==='conn') body=fld('aw_baseurl','Base URL','https://sap.acme.com/api')+fld('aw_authref','Auth reference (secret NAME)','ACME_SAP_KEY')+how('We store a reference to the secret, never the raw key.');
      else if(sk==='agent') body=fld('aw_name','Agent name','Draft-bot')+fld('aw_role','Role','drafts replies for review')+how('Every action it takes is a chit you can see and dispute.');
      else if(sk==='guard') body=selF('aw_under','Acts under',[['rules','your rules only'],['approval','your rules + human approval']])+how('Governed: it can only do what your rules allow.');
      sub=(UI.awStep+1)+' of '+steps.length;
      if(UI.awErr) body+='<div style="color:#c0453b;font-size:12.5px;margin-top:10px">'+esc(UI.awErr)+'</div>';
      var nextLbl=(UI.awStep===steps.length-1)?(rdy?'Create':'See result'):'Next ›';
      foot='<button class="composebtn" style="flex:1" onclick="awBack()">‹ Back</button><button class="composebtn pri" style="flex:1" onclick="awNext()">'+nextLbl+'</button>';
    }
  }
  // RESPONSIVE placement: FULL-SCREEN on mobile (fill · generous gaps · buttons in a bottom bar — like the
  // co-assist screens), a comfortable CENTRED CARD on laptop (not a full-bleed sheet). Below the measured bar.
  var host=awHost(), mob=((UI.vp==='mob')||(typeof window!=='undefined'&&window.innerWidth<640)), barH=((document.querySelector('.topbar')||{}).offsetHeight)||52;
  var head='<div style="padding:16px 18px;border-bottom:1px solid #f0efec"><div style="max-width:520px;margin:0 auto;display:flex;align-items:flex-start;gap:10px"><div style="flex:1"><div style="font-size:17px;font-weight:700">'+title+'</div>'+(sub?'<div style="font-size:12.5px;color:var(--grey);margin-top:3px">'+sub+'</div>':'')+'</div><button onclick="awClose()" style="border:1px solid var(--line);background:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;flex:none">✕</button></div>'+(dots?'<div style="max-width:520px;margin:0 auto">'+dots+'</div>':'')+'</div>';
  var mid='<div style="flex:1;overflow:auto;padding:22px 18px"><div style="max-width:520px;margin:0 auto">'+body+'</div></div>';
  var footbar='<div style="border-top:1px solid #f0efec;padding:14px 18px"><div style="max-width:520px;margin:0 auto;display:flex;gap:12px">'+foot+'</div></div>';
  // ONE comfortable centred card, both mobile & laptop: sized to its content (never a full-screen sheet), dim
  // backdrop, bounded height with the body scrolling if a step ever gets long. Near-full-width on a phone.
  // Fill the SAME region the co-assist screens use: measure #panel (the current screen container) and match its
  // exact start/end. Mobile → the full screen below the header; laptop → the content pane (NOT the whole viewport).
  // Reuses the app's own coordinates instead of guessing — content lives inside via head/mid(scroll)/footbar.
  var pane=document.getElementById('panel')||document.querySelector('.panel');
  var r=pane?pane.getBoundingClientRect():null;
  var pos=(r&&r.height>240)?('top:'+Math.round(r.top)+'px;left:'+Math.round(r.left)+'px;width:'+Math.round(r.width)+'px;height:'+Math.round(r.height)+'px'):('top:'+barH+'px;left:0;right:0;bottom:0');
  host.innerHTML='<div style="position:fixed;'+pos+';background:#fff;z-index:400;display:flex;flex-direction:column;overflow:hidden;box-shadow:-8px 0 24px rgba(0,0,0,.08)">'+head+mid+footbar+'</div>';
}
/* ══ CONNECTOR (Pi / system) handled IN Co-assists — the separate Connectors page is dismounted. When the
 *    selected actor is a connector, acDetailHTML renders this COCKPIT instead of the human profile. Principle:
 *    STATIC stuff (health · connection string · add) lives in the STICKY TOP as icons; the DEVICE LIST scrolls
 *    below (so 15 devices never bury the connection string). Reuses the connector API (b62). ══ */
async function acLoadDevices(id){
  try{ var r=await api('connectorConns',{params:{actorId:id}}); UI.acConns=(r&&r.connections)||[]; UI.acHealth=(r&&r.actor_health)||'offline'; }catch(e){ UI.acConns=[]; UI.acHealth='offline'; }
  try{ UI.acProv=await api('connectorProvision',{params:{actorId:id}}); }catch(_){ UI.acProv=null; }
  if(UI.acSel===id) paintAcDetail();
}
function _hdot(h){ var m={live:'#2f8f5b',slow:'#c9962a',offline:'#c0453b'}; return '<span title="'+esc(h||'')+'" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+(m[h]||'#9aa3a7')+'"></span>'; }
function _sig(s){ if(s==='no_signal')return '<span style="color:#c0453b;font-weight:700;font-size:11px">○ no signal</span>'; if(s==='live')return '<span style="color:#2f8f5b;font-weight:700;font-size:11px">● live</span>'; if(s==='slow')return '<span style="color:#c9962a;font-weight:700;font-size:11px">◐ slow</span>'; return '<span style="color:#9aa3a7;font-weight:700;font-size:11px">○ silent</span>'; }
function piCockpit(x){
  var iot=acTypeOf(x)==='iot', health=UI.acHealth||'offline';
  var tchip=iot?'<span class="optchip" style="background:#eaf2fb;color:#2c5aa0;border-color:#cfe0f4">🛰️ IoT</span>':'<span class="optchip" style="background:#f1ecf9;color:#6b3fa0;border-color:#ddcff2">🔌 ERP</span>';
  var ico=function(t,title,on){ return '<button title="'+title+'" onclick="'+on+'" style="border:1px solid var(--line);background:#fff;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:15px">'+t+'</button>'; };
  var header='<div style="position:sticky;top:0;background:#fff;z-index:5;padding-bottom:10px;border-bottom:1px solid var(--line)">'
    +'<button class="dback" onclick="backToList()">‹ Co-assists</button>'
    +'<div style="display:flex;align-items:center;gap:9px;margin-top:6px"><span style="font-size:16px;font-weight:700">'+esc(x.name)+'</span> '+tchip+' '+_hdot(health)
      +'<span style="margin-left:auto;display:inline-flex;gap:7px">'+ico('⚡','Test connection',"acPing('"+x.id+"')")+ico('🔑','Connection string',"UI.acProvOpen=!UI.acProvOpen;paintAcDetail()")+ico('＋','Add '+(iot?'device':'endpoint'),"UI.acAddDev=!UI.acAddDev;paintAcDetail()")+'</span></div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin-top:3px">📍 '+esc(x.site||'no site')+' · '+esc(health)+'</div></div>';
  var offline = health==='offline' ? '<div style="background:#fbeceb;border:1px solid #f0c9c6;color:#b4453f;border-radius:10px;padding:9px 11px;font-size:12px;font-weight:600;margin:10px 0">⚠ '+(iot?'Gateway':'System')+' OFFLINE — no '+(iot?'device':'endpoint')+' below can signal until it is back.</div>' : '';
  var prov = UI.acProvOpen ? _provPanel(iot) : '';
  var addf = UI.acAddDev ? _addDeviceForm(x,iot) : '';
  var conns=UI.acConns, list;
  if(conns===undefined) list='<div style="padding:16px;color:var(--grey);font-size:12.5px">Loading…</div>';
  else if(!conns.length) list='<div style="padding:10px 2px;color:var(--grey);font-size:12.5px">No '+(iot?'devices':'endpoints')+' yet. Tap ＋ to add one.</div>';
  else list=conns.map(function(c){ var cfg=c.conn_config||{}; var det=iot?[cfg.topic,cfg.device_id].filter(Boolean).join(' · '):(cfg.path||'');
    return '<div style="display:flex;align-items:center;gap:9px;padding:10px 0;border-bottom:1px dashed var(--line);font-size:12.5px"><div style="flex:1;min-width:0"><b>'+esc(c.ref)+'</b>'+(c.bridge_id?' <code style="background:#f6f6f4;border:1px solid #eee;border-radius:5px;padding:0 5px;font-size:10.5px;color:var(--grey)">'+esc(c.bridge_id)+'</code>':'')+(det?'<div style="color:var(--grey);font-size:11px;margin-top:1px">'+esc(det)+'</div>':'')+'</div>'+_sig(c.enabled===false?'silent':c.signal)+'<button class="composebtn" style="padding:2px 9px;font-size:11px" onclick="acToggleDevice(\''+x.id+'\','+c.connection_id+','+(c.enabled?'false':'true')+')">'+(c.enabled?'Disable':'Enable')+'</button></div>';
  }).join('');
  return header+offline+prov+addf+'<div class="sec" style="margin-top:14px">'+(iot?'Devices':'Endpoints')+(conns?(' <span style="color:var(--grey);font-weight:400">('+conns.length+')</span>'):'')+'</div>'+list;
}
function _provPanel(iot){
  var p=UI.acProv; if(!p) return '<div style="padding:10px 2px;color:var(--grey);font-size:12px">Loading connection string…</div>';
  var lines = iot ? 'Endpoint = '+esc(p.endpoint||'')+'\nActorKey = ••••••••  (shown once at creation · Regenerate to re-issue)\nBridgeIds:\n'+((p.publishes||[]).map(function(z){return '  '+esc(z.bridge_id||'—')+'  '+esc(z.ref||'');}).join('\n')||'  (none yet)') : 'Base URL = '+esc(p.base_url||'—')+'\nAuth = '+esc(p.auth_type||'none')+(p.auth_ref?(' (ref: '+esc(p.auth_ref)+')'):'');
  return '<div style="border:1px solid #cfe0f4;background:#f2f7fd;border-radius:10px;padding:10px 12px;margin:10px 0"><div style="font-weight:700;font-size:12px;color:#2c5aa0;margin-bottom:4px">🔑 Connection string</div><pre style="background:#0f1b2d;color:#cfe0f4;border-radius:7px;padding:9px 11px;font-size:11px;overflow:auto;margin:0;line-height:1.5">'+lines+'</pre></div>';
}
function _addDeviceForm(x,iot){
  var spec = iot ? '<label class="fl">Topic</label><input class="inp" id="ad_topic" placeholder="sensors/line1/temp" style="width:100%"><label class="fl">Device id</label><input class="inp" id="ad_dev" placeholder="edge-gw-01" style="width:100%">'
                 : '<label class="fl">Resource path</label><input class="inp" id="ad_path" placeholder="/odata/PurchaseOrders" style="width:100%">';
  return '<div style="border:1px dashed #c9d2dd;border-radius:10px;padding:12px;margin:10px 0;background:#fbfcfe"><div style="font-weight:700;font-size:12.5px;margin-bottom:2px">Add '+(iot?'device':'endpoint')+'</div>'
    +'<label class="fl">Name</label><input class="inp" id="ad_ref" placeholder="'+(iot?'Cold-store temp':'PO inbound')+'" style="width:100%">'+spec
    +'<label class="fl">Send signals to — counterparty entity id (optional)</label><input class="inp" id="ad_cp" placeholder="receiving entity id — signals become chits to them" style="width:100%">'
    +'<div class="err" id="ad_err" style="margin-top:6px"></div>'
    +'<div style="display:flex;gap:8px;margin-top:10px"><button class="composebtn pri" onclick="acAddDevice(\''+x.id+'\','+(iot?'true':'false')+')">Add</button><button class="composebtn" onclick="UI.acAddDev=false;paintAcDetail()">Cancel</button></div></div>';
}
async function acAddDevice(id, iot){
  var ref=(val('ad_ref')||'').trim(), err=document.getElementById('ad_err'); if(err)err.textContent='';
  if(!ref){ if(err)err.textContent='A name is required.'; return; }
  var config = iot ? {protocol:'mqtts', topic:(val('ad_topic')||'').trim()||undefined, device_id:(val('ad_dev')||'').trim()||undefined} : {path:(val('ad_path')||'').trim()||undefined};
  var cp = (val('ad_cp')||'').trim()||undefined;   // counterparty entity id — where this device's signals route as chits
  try{ await api('connectorConnAdd',{params:{actorId:id},body:{ref:ref,direction:'in',config:config,counterparty_entity_id:cp}}); UI.acAddDev=false; if(typeof toast==='function')toast('Added.'); await acLoadDevices(id); }
  catch(e){ if(err)err.textContent=(e&&e.message)||'Add failed'; }
}
async function acToggleDevice(id, connId, enabled){
  try{ await api('connectorConnToggle',{params:{actorId:id,connId:connId},body:{enabled:enabled}}); await acLoadDevices(id); }
  catch(e){ if(typeof toast==='function')toast((e&&e.message)||'Update failed'); }
}
async function acPing(id){
  try{ await api('connectorPing',{params:{actorId:id},body:{}}); if(typeof toast==='function')toast('Ping sent — marked live.'); await acLoadDevices(id); }
  catch(e){ if(typeof toast==='function')toast((e&&e.message)||'Ping failed'); }
}
function setAcTypeF(t){ UI.acTypeF=t; if(typeof renderApp==='function')renderApp(); }   // filter the panel by actor TYPE (human/iot/erp)
function acTypeOf(x){ return ((UI._connMap||{})[x.id]) || (x.type||'human'); }            // connector_type (iot/erp) wins, else the actor type
function acVisible(){ let a=(UI.acts||[]).filter(x=>acFlt()==='all'?true:(acFlt()==='inactive'?x.status!=='active':x.status==='active'));
  const tf=UI.acTypeF||'all'; if(tf!=='all')a=a.filter(x=>acTypeOf(x)===tf);
  const q=(UI.acQ||'').trim().toLowerCase(); if(q)a=a.filter(x=>((x.name||'')+' '+(x.role||'')+' '+(x.key||'')+' '+(x.type||'')).toLowerCase().includes(q)); return a; }
function acRowHTML(x){ const dim=x.status!=='active'?'opacity:.55':'';
  const coverNm=x.del?((UI._acNames||{})[x.del]||'—'):''; const coversNames=(UI._coversNames||{})[x.id]||[];
  const coverLines=(x.del||coversNames.length)?'<div style="font-size:11px;color:var(--grey);margin-top:3px;line-height:1.45">'+(x.del?('🛡 Covered by <b style="color:var(--ink);font-weight:600">'+coverNm+'</b>'):'')+((x.del&&coversNames.length)?'<br>':'')+(coversNames.length?('🤝 Covers for <b style="color:var(--ink);font-weight:600">'+coversNames.join(', ')+'</b>'):'')+'</div>':'';
  return `<div class="row ${x.id===UI.acSel?'sel':''}" data-ac="${x.id}" style="${dim}" onclick="selectActor('${x.id}')">
    <div style="width:9px;height:9px;border-radius:50%;flex:0 0 auto;margin-top:5px;background:${x.shift==='on_shift'?'#2f8f5b':x.shift==='on_break'?'#c9a441':'#b9b9b9'}"></div>
    <div class="main2"><div class="l1"><span class="code">${esc(x.name)}</span><span class="optchip" style="background:#eef3fb;color:#345488;border-color:#cfe0f4">${hatLabel(x.hat)}</span>${_connChip(x.id)}${x.pinSet?'':(x.otp?'<span class="optchip" style="background:#fbf7ea;color:#7a5e22;border-color:#e6d9a8">⏳ invite</span>':'')}<span class="amt" style="margin-left:auto;font-size:11.5px;color:var(--grey)">${x.load}/${x.max||'∞'}</span></div>
      <div class="l2">${esc(x.role||'—')} · <span class="mono">${acLogin(x)}</span> <span class="optchip ${acShc(x.shift)}">${acShLabel(x.shift)}</span>${x.status!=='active'?'<span class="optchip off">'+esc(x.status)+'</span>':''}${(x.shift!=='on_shift'&&x.returnDate)?' · returns '+acDate(x.returnDate):''}</div>${coverLines}</div>
    <div class="rowgo" aria-hidden="true">›</div></div>`; }
function acRowsHTML(){ const r=acVisible(); if(!r.length) return '<div class="empty"><div class="big">🧑‍🤝‍🧑</div><div class="t">No co-assists</div><div>Add one with <b>+ New</b> above.</div></div>';
  const cc={},cn={},nm={}; (UI.acts||[]).forEach(a=>{ const _l=acLbl(a); nm[a.id]=_l; if(a.del){ cc[a.del]=(cc[a.del]||0)+1; (cn[a.del]=cn[a.del]||[]).push(_l); } }); UI._coversCount=cc; UI._coversNames=cn; UI._acNames=nm;   // reverse-delegate maps (name+userid labels), once
  return r.map(acRowHTML).join(''); }
function paintAcList(){ const b=document.getElementById('ac_rows'); if(b)b.innerHTML=acRowsHTML(); const c=document.getElementById('ac_count'); if(c)c.textContent=acVisible().length; }
function paintAcDetail(){ const dp=document.getElementById('detailpane'); if(dp){ dp.className='detail'; dp.innerHTML=acDetailHTML(); } }
function selectActor(id, silent){ UI.acSel=id; UI.acMode='view'; UI.acDet=(UI.acts||[]).find(a=>a.id===id)||null;
  if((UI.vp==='mob') && !silent){ UI.mdetail=true; const p=document.getElementById('panel'); if(p)p.classList.add('showdetail'); }
  paintAcList(); paintAcDetail();
  if(UI.acDet && typeof acTypeOf==='function' && (acTypeOf(UI.acDet)==='iot'||acTypeOf(UI.acDet)==='erp')){ UI.acConns=undefined; UI.acProv=undefined; UI.acProvOpen=false; UI.acAddDev=false; acLoadDevices(id); }   // Pi selected → load its devices
}
function setAcMode(m){ UI.acMode=m; paintAcDetail(); }
function setAcFlt(f){ UI.acFlt=f; UI.acSel=null; UI.acDet=null; const mb=document.getElementById('mainbody'); if(mb)mb.innerHTML=mainBody(); }   // re-render tabs+rows together (was repainting rows only -> stale highlight)
function acDetailHTML(){ const x=UI.acDet;
  if(!x) return `<div class="empty"><div class="big">🧑‍🤝‍🧑</div><div class="t">Select a co-assist</div><div>Pick one to see their profile, shift and access — or manage them.</div></div>`;
  if(typeof acTypeOf==='function' && (acTypeOf(x)==='iot'||acTypeOf(x)==='erp')) return piCockpit(x);   // a Pi / system → its device cockpit (not the human profile)
  const back=`<button class="dback" onclick="backToList()">‹ Co-assists</button>`;
  const seg=(m,l)=>`<button onclick="setAcMode('${m}')" style="border:0;background:${(UI.acMode==='edit'?'edit':'view')===m?'var(--ink)':'#fff'};color:${(UI.acMode==='edit'?'edit':'view')===m?'#fff':'var(--grey)'};font-size:12px;font-weight:700;padding:6px 15px">${l}</button>`;
  const toggle=`<div style="display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;margin-top:10px">${seg('view','View')}${seg('edit','Edit')}</div>`;
  const head=`<div class="dh">${back}<div class="dt">${esc(x.name)} <span class="optchip ${acShc(x.shift)}">${acShLabel(x.shift)}</span></div><div class="ds">${esc(x.role||'—')} · <span class="mono">${acLogin(x)}</span></div>${toggle}</div>`;
  let body, bar;
  if(UI.acMode==='edit'){
    body=`<div class="sec">Edit — co-assist profile</div>
      <label class="fl">Display name</label><input class="inp" id="ac_ename" value="${esc(x.name)}">
      <label class="fl">Role</label><input class="inp" id="ac_erole" value="${esc(x.role||'')}" placeholder="e.g. Dispatch, Accounts">
      <label class="fl">Hat (only Act / Manager can be assigned work)</label><select class="inp" id="ac_ehat" style="max-width:240px">${['act','manager','audit','mis','view_only'].map(h=>'<option value="'+h+'"'+(x.hat===h?' selected':'')+'>'+hatLabel(h)+'</option>').join('')}</select>
      <label class="fl">Leave-cover delegate (covers auto-assigned work while on leave)</label><select class="inp" id="ac_edel" style="max-width:240px"><option value="">— none —</option>${(UI.acts||[]).filter(a=>a.id!==x.id && hatAssignable(a.hat)).map(a=>'<option value="'+a.id+'"'+(x.del===a.id?' selected':'')+'>'+esc(a.name)+'</option>').join('')}</select>
      <label class="fl">Max concurrent tasks</label><input class="inp" id="ac_emax" inputmode="numeric" value="${x.max||''}" style="width:120px">
      <label class="fl">Phone</label><input class="inp" id="ac_ephone" value="${esc(x.phone||'')}" placeholder="optional">
      <div class="err" id="ac_ederr" style="margin-top:8px"></div>
      <div style="font-size:11px;color:#9a7b34;background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;margin-top:10px;line-height:1.5"><b>Stage B</b> — profile edit needs <span class="mono">PATCH /api/actors/:id</span> (no migration). Save shows an error until that endpoint is deployed.</div>`;
    bar=`<button class="pri" onclick="saveActor('${x.id}')">Save</button><button onclick="setAcMode('view')">Cancel</button>`;
  } else {
    const pct=x.max?Math.min(100,Math.round(x.load/x.max*100)):0;
    const kv=(l,v)=>`<div style="display:flex;gap:10px;padding:9px 13px;border-bottom:1px dashed var(--line);font-size:13px;align-items:baseline"><b style="min-width:104px;color:var(--grey);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px">${l}</b><span style="font-weight:600;flex:1">${(v==null||v==='')?'—':v}</span></div>`;
    const hatV='<span class="optchip" style="background:#eef3fb;color:#345488;border-color:#cfe0f4">'+hatLabel(x.hat)+'</span>'+(hatAssignable(x.hat)?'':' <span style="font-size:11px;color:var(--grey)">not assignable</span>');
    const coversFor=(UI.acts||[]).filter(a=>a.del===x.id).map(a=>acLbl(a));
    const prof=`<div class="sec">Profile</div><div class="itab" style="border:1px solid var(--line);border-radius:11px;overflow:hidden">
      ${kv('Name',esc(x.name))}
      ${kv('Login','<span class="mono">'+acLogin(x)+'</span>')}
      ${kv('Role',esc(x.role||''))}
      ${kv('Type',acType(x.type))}
      ${kv('Hat',hatV)}
      ${kv('Max tasks',(x.max||'∞')+'')}
      ${kv('Last got task',x.lastAssigned?acDate(x.lastAssigned):'—')}
      ${kv('Phone',x.phone?esc(x.phone):'')}
      ${kv('Joined',acDate(x.created))}
      ${kv('Last active',acDate(x.last))}</div>`;
    const work=`<div class="sec">Shift &amp; load</div><div class="itab" style="padding:11px 12px">
      <div style="display:flex;align-items:center;gap:8px"><span class="optchip ${acShc(x.shift)}">${acShLabel(x.shift)}</span><span style="font-size:12px;color:var(--grey)">${x.status==='active'?'active':esc(x.status)}</span></div>
      ${(x.shift!=='on_shift' && (x.breakSince||x.returnDate)) ? '<div style="font-size:11.5px;color:var(--grey);margin-top:6px">'+(x.breakSince?('On break since '+acDate(x.breakSince)):'')+(x.returnDate?((x.breakSince?' · ':'')+'returns '+acDate(x.returnDate)):'')+'</div>' : ''}
      <div style="font-size:12.5px;margin-top:9px">Load · <b>${x.load}</b> / ${x.max||'∞'} tasks</div><div style="height:8px;background:#eef1f4;border-radius:5px;overflow:hidden;margin-top:6px"><span style="display:block;height:100%;background:var(--blue);border-radius:5px;width:${pct}%"></span></div></div>`;
    const eng=`<div class="sec">Access / engagement</div><div style="font-size:11px;color:#9a7b34;background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;line-height:1.5">Per-actor engagement (view-only · act · audit · MIS) is <b>planned, not enforced yet</b> — today a co-assist acts within the entity's scope. Default-deny per node is the roadmap.</div>`;
    const coverName = x.del?acLbl((UI.acts||[]).find(a=>a.id===x.del)):'';
    const coverSection = '<div class="sec">Leave cover</div><div class="itab" style="border:1px solid var(--line);border-radius:11px;overflow:hidden;margin-bottom:10px">'
      +'<div style="padding:10px 13px;border-bottom:1px dashed var(--line)"><div style="font-size:10.5px;color:#345488;text-transform:uppercase;letter-spacing:.4px;font-weight:700">🛡 Covered by</div><div style="font-size:13px;margin-top:3px;line-height:1.45">'+(x.del?('<b>'+coverName+'</b> takes over <b>'+esc(x.name)+'</b>&rsquo;s work when '+esc(x.name)+' is away.'):'<span style="color:var(--grey)">No cover set — nobody takes '+esc(x.name)+'&rsquo;s work when away.</span>')+'</div></div>'
      +'<div style="padding:10px 13px"><div style="font-size:10.5px;color:#2e6b3f;text-transform:uppercase;letter-spacing:.4px;font-weight:700">🤝 Covers for</div><div style="font-size:13px;margin-top:3px;line-height:1.45">'+(coversFor.length?('<b>'+esc(x.name)+'</b> takes over <b>'+coversFor.join(', ')+'</b>&rsquo;s work when they&rsquo;re away.'):'<span style="color:var(--grey)">'+esc(x.name)+' isn&rsquo;t anyone&rsquo;s cover yet.</span>')+'</div></div>'
      +'</div>';
    const loginState = x.pinSet
      ? '<div class="sec">Login</div><div style="'+_CARD+';background:#e7f3ea;border-color:#bfe0cd"><div style="font-size:13px;color:#2e6b3f;font-weight:600">✓ Active — PIN set. They sign in with their User ID + PIN.</div></div>'
      : (x.otp
          ? '<div class="sec">Login — pending invite</div><div style="'+_CARD+';background:#eef3fb;border-color:#cfe0f4"><div style="font-size:10.5px;color:#345488;text-transform:uppercase;letter-spacing:.4px;font-weight:700">User ID</div><div class="mono" style="font-weight:700;font-size:13px;word-break:break-all">'+esc(acLogin(x))+'</div><div style="font-size:10.5px;color:#345488;text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-top:7px">One-time code</div><div class="mono" style="font-weight:800;font-size:20px;letter-spacing:3px;color:#345488">'+esc(x.otp)+'</div><div style="font-size:11px;color:#345488;margin-top:6px">Share these so they can sign in &amp; set their PIN. Not set a PIN yet.</div></div>'
          : '<div class="sec">Login — pending</div><div style="'+_CARD+';background:#fbf7ea;border-color:#e6d9a8"><div style="font-size:12.5px;color:#7a5e22">No active one-time code and no PIN yet — use <b>Re-invite</b> below to issue a code.</div></div>');
    const connSec=(UI._connMap||{})[x.id]?('<div class="sec">Connector endpoints</div><div class="itab" style="padding:11px 12px"><div style="font-size:12.5px;color:var(--grey);margin-bottom:9px">This co-assist is a '+(UI._connMap[x.id]==='iot'?'🛰️ IoT device':'🔌 ERP / API')+' connector — manage its endpoints (devices / integrations) and emit signals over the rail.</div><button class="composebtn pri" onclick="manageConnector(\''+x.id+'\')">Manage endpoints →</button></div>'):'';
    body=prof+connSec+coverSection+loginState+work+eng;
    if(x.status==='active'){
      bar=(x.type==='human'?(x.pinSet
            ? `<button onclick="acResetPin('${x.id}')" title="They have a PIN but forgot or locked it — clear it and issue a fresh one-time code so they set a new PIN.">🔑 Reset PIN</button>`
            : `<button onclick="acReinvite('${x.id}')" title="They haven't set a PIN yet — re-issue their one-time code (e.g. if they lost it). A new code won't help once a PIN is set.">✉️ Re-invite</button>`)
          :'')+
          `<button class="warn" onclick="acStatus('${x.id}','deactivate')" title="Suspend access — they can no longer sign in and their active tasks return to the pool. Reversible via Reactivate.">🚫 Deactivate</button>`;
    } else {
      bar=`<button class="pri" onclick="acStatus('${x.id}','reactivate')" title="Restore access and issue a fresh one-time code so they can sign in again.">↩ Reactivate</button><button class="warn" onclick="acStatus('${x.id}','remove')" title="Permanently remove this co-assist. This cannot be undone.">🗑 Remove permanently</button>`;
    }
  }
  return `${head}<div class="db">${body}</div><div class="actbar">${bar}</div>`;
}
/* acShift removed (dead) — entity set-shift used the self-only /break route (400 for entity); actors self-manage shift. Entity set-shift = backlog. */
async function acReinvite(id){ const x=(UI.acts||[]).find(a=>a.id===id)||{}; try{ const r=await api("actorOtp",{params:{id}}); const otp=(r&&(r.otp||r.dev_otp))||''; const lf=(r&&r.login_format)||acLogin(x); actorInviteModal('✉️ New code — '+(x.name||'co-assist'), x.name, lf, otp); }catch(e){ toast(MSG.fail("re-invite", e)); } }
function acResetPin(id){ const x=(UI.acts||[]).find(a=>a.id===id)||{};
  confirmAsk('Reset PIN', 'Reset <b>'+esc(x.name||'this co-assist')+'</b>&rsquo;s PIN? A new one-time code is issued and they set a new PIN on next login.', 'Reset PIN', async function(){
    try{ const r=await api("actorPinReset",{params:{id}}); const otp=(r&&(r.otp||r.dev_otp))||''; const lf=(r&&r.login_format)||acLogin(x); actorInviteModal('🔑 PIN reset — '+(x.name||'co-assist'), x.name, lf, otp); }catch(e){ toast(MSG.fail("reset the PIN", e)); }
  }); }
function acStatus(id, action){ const x=(UI.acts||[]).find(a=>a.id===id); if(!x)return;
  const routed = x.load>0 ? ' Their '+x.load+' active task(s) return to the pool.' : '';
  const run=async function(){ const body={action}; if(x.load>0)body.task_action='pool'; if(action==='remove')body.confirm='REMOVE';
    try{ const r=await api("actorStatus",{params:{id},body}); UI.acSel=null; UI.acDet=null; UI.mdetail=false; await loadCoassists();
      if(action==='reactivate'){ const otp=(r&&(r.otp||r.dev_otp))||''; const lf=(r&&r.login_format)||acLogin(x); actorInviteModal('↩ '+(x.name||'co-assist')+' reactivated', x.name, lf, otp); }
      else { const parts=[];
        if(r&&r.tasks_routed>0) parts.push(r.tasks_routed+' task'+(r.tasks_routed>1?'s':'')+(body.task_action==='actor'?' reassigned to a colleague':' returned to the pool'));
        if(r&&r.had_cover) parts.push('own leave-cover cleared');
        if(r&&r.covers_removed>0) parts.push('was leave-cover for '+r.covers_removed+' — those cover links removed');
        if(r&&r.was_default_assignee) parts.push('was the default auto-assign assignee — cleared');
        if(r&&r.disputes_cleared>0) parts.push(r.disputes_cleared+' dispute hand-off'+(r.disputes_cleared>1?'s':'')+' cleared');
        actorCleanupModal(action, x.name, parts); } }
    catch(e){ toast(MSG.fail("update the co-assist", e)); } };
  if(action==='deactivate') confirmAsk('Deactivate co-assist', 'Deactivate <b>'+esc(x.name)+'</b>? They can no longer sign in until reactivated.'+esc(routed), 'Deactivate', run, true);
  else if(action==='remove') confirmAsk('Remove permanently', 'Permanently remove <b>'+esc(x.name)+'</b>? This cannot be undone.'+esc(routed), 'Remove', run, true);
  else run(); }
async function saveActor(id){ const err=document.getElementById("ac_ederr"); if(err)err.textContent="";
  const body={ display_name:val("ac_ename")||undefined, actor_role:val("ac_erole")||null, max_tasks:(+val("ac_emax")||undefined), phone:val("ac_ephone")||null, hat:val("ac_ehat")||undefined };
  try{ await api("actorEdit",{params:{id},body}); const x=(UI.acts||[]).find(a=>a.id===id);
    const delEl=document.getElementById("ac_edel");
    if(delEl && delEl.value!==((x&&x.del)||'')){ await api("actorDelegate",{params:{id},body:{delegate_actor_id:delEl.value||null}}); if(x)x.del=delEl.value||null; }
    if(x){ if(body.display_name)x.name=body.display_name; x.role=body.actor_role; if(body.max_tasks)x.max=body.max_tasks; x.phone=body.phone; if(body.hat)x.hat=body.hat; } UI.acMode='view';
    // Action-state discipline: only this record's row + the detail change — the rest of the list is untouched (no reload).
    const _r=document.querySelector('.row[data-ac="'+id+'"]'); if(_r&&x){ _r.outerHTML=acRowHTML(x); } else { paintAcList(); }
    paintAcDetail(); toast('Co-assist updated ✓'); if(typeof announce==='function')announce(((x&&x.name)||'Co-assist')+' updated'); }
  catch(e){ if(err)err.textContent=e.message; } }
async function loadCoassists(){
  UI._acLoading=true; const rb=document.getElementById('ac_rows'); if(rb)rb.innerHTML='<div class="loadwrap"><span class="spin"></span> loading…</div>';
  try{ const actors=((await api("actors",{query:{status:'all'}}))||[]).map(mapApiActor); UI.acts=actors; STORE.actors=actors; UI._acLoading=false; paintAcList();   // fetch ALL — client acFlt tabs categorize (active incl. on-break, inactive=deactivated/removed)
    if(UI.acSel && !UI.acts.some(a=>a.id===UI.acSel)){ UI.acSel=null; UI.acDet=null; }
    if(!UI.acSel && UI.acts.length && UI.vp!=='mob'){ const f=acVisible()[0]; if(f)selectActor(f.id, true); else paintAcDetail(); }
    else paintAcDetail();
    loadConnMap();   // annotate which co-assists are CONNECTORS (graceful; needs the connector capability + b57)
  }catch(e){ UI._acLoading=false; const rb2=document.getElementById('ac_rows'); if(rb2)rb2.innerHTML=`<div class="empty"><div class="t">Couldn't load co-assists</div><div>${esc(e.message)}</div></div>`; }
}
/* A connector is a non-human co-assist. Annotate the actor list with its connector type (iot/erp) by fetching the
   connector register. Graceful no-op if the capability is off or b57 isn't applied (so this never breaks the page). */
async function loadConnMap(){
  try{
    if(!((SESSION.capabilities||[]).indexOf('connector')>=0)){ UI._connMap={}; return; }
    if(typeof ensureCap==='function'){ await ensureCap('connector'); }   // registers the connectorList EP + selectConnector for Manage
    const r=await api('connectorList'); const map={};
    ((r&&r.connectors)||[]).forEach(function(c){ map[c.identity_id]=c.connector_type; });
    UI._connMap=map; paintAcList(); if(UI.acDet)paintAcDetail();
  }catch(_){ UI._connMap=UI._connMap||{}; }   // b57 not applied / capability off -> simply don't annotate
}
function _connChip(id){ const t=(UI._connMap||{})[id]; if(!t)return ''; const iot=t==='iot';
  return '<span class="optchip" style="background:'+(iot?'#E7F0FB':'#F0EAF9')+';color:'+(iot?'#2b5c9c':'#6a44a8')+';border-color:transparent">'+(iot?'🛰️ IoT':'🔌 ERP')+'</span>'; }
function manageConnector(id){ UI.nav='connectors';
  if(typeof ensureCap==='function'){ ensureCap('connector').then(function(){ if(typeof renderApp==='function')renderApp(); if(typeof selectConnector==='function')selectConnector(id); }); } }
