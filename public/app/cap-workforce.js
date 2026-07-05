/* app/cap-workforce.js — the CO-ASSIST (workforce) capability: FUNCTIONALITY only.
 * Injected by ensureCap('workforce') on first open of the Co-assists screen; classic script, shared global scope.
 * Screen + render + actions (create/invite/PIN/cover/shift/deactivate) + loadCoassists. NO help content
 * (co-assist help lives in app/cap-help.js, lazy). References eager Core/helpers globals at runtime:
 * api, mapApiActor, hatLabel/hatAssignable/HAT_LABEL, acType/acShc/acShLabel/acFlt/acDate/acLogin/acLbl,
 * addActorModal/submitActor/actorInviteModal/actorCleanupModal/confirmAsk, scr, esc, val, opt, toast,
 * modal/closeModal, announce, coId/acIdPrev, startDrag, openHelp, UI/SESSION/STORE.
 * Spec: chitbridge-api/docs/COASSIST-USECASES.md . Tests: COASSIST-REGRESSION.md. */
function coassistsScreen(){
  const list = `<div class="list">
    <div class="lh">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px"><span style="font-family:'Space Grotesk';font-weight:700;font-size:14px">🧑‍🤝‍🧑 Co-assists</span><button onclick="openAssist('coassists')" title="Ask the assistant about this screen" style="border:1px solid var(--line);background:#fff;color:#3F66A6;border-radius:50%;width:20px;height:20px;font-weight:800;cursor:pointer;font-size:12px;line-height:1;flex:none">?</button></div>
      <div style="display:flex;gap:7px"><input class="inp" id="ac_add" placeholder="New co-assist — opens the invite form" style="flex:1" readonly onclick="addActorModal()"><button class="composebtn" onclick="addActorModal()">+ New</button></div>
      <div class="srch" style="margin-top:8px">🔍 <input placeholder="Search name, role, key" value="${esc(UI.acQ||'')}" oninput="UI.acQ=this.value;paintAcList()"></div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--grey)">
        <span style="display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden">${['active','inactive','all'].map(f=>`<button onclick="setAcFlt('${f}')" style="border:0;background:${acFlt()===f?'var(--blue)':'#fff'};color:${acFlt()===f?'#fff':'var(--grey)'};font-weight:700;font-size:11px;padding:4px 9px;text-transform:capitalize">${f}</button>`).join('')}</span>
        <span style="margin-left:auto" id="ac_count">${acVisible().length}</span></div>
    </div>
    <div class="rows" id="ac_rows">${UI._acLoading?'<div class="loadwrap"><span class="spin"></span> loading…</div>':acRowsHTML()}</div>
  </div>`;
  const detail = `<div class="detail" id="detailpane">${acDetailHTML()}</div>`;
  const divider = `<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>`;
  const showDetail = (UI.vp==='mob') && UI.mdetail;
  return `<div class="panel ${showDetail?'showdetail':''}" id="panel" style="--lw:${UI.lw}px;--lh:${UI.lh}px">${list}${divider}${detail}</div>`;
}
function acVisible(){ let a=(UI.acts||[]).filter(x=>acFlt()==='all'?true:(acFlt()==='inactive'?x.status!=='active':x.status==='active'));
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
  paintAcList(); paintAcDetail(); }
function setAcMode(m){ UI.acMode=m; paintAcDetail(); }
function setAcFlt(f){ UI.acFlt=f; UI.acSel=null; UI.acDet=null; const mb=document.getElementById('mainbody'); if(mb)mb.innerHTML=mainBody(); }   // re-render tabs+rows together (was repainting rows only -> stale highlight)
function acDetailHTML(){ const x=UI.acDet;
  if(!x) return `<div class="empty"><div class="big">🧑‍🤝‍🧑</div><div class="t">Select a co-assist</div><div>Pick one to see their profile, shift and access — or manage them.</div></div>`;
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
