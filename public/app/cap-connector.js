/* app/cap-connector.js — Connector / IoT + ERP capability (lazy; gated by the 'connector' entity capability).
 *
 * L3.1: a connector is a first-class ACTOR (an `identities` row, connector_type iot|erp) that shows in
 * Co-assists as a visible identity and owns one-or-more CONNECTIONS (endpoints/devices in connector_connection).
 * Screen = master-detail: left = connector actors (+ New); right = the selected actor's connections (+ Add /
 * enable-disable) and the EMIT SEAM. The emit is a manual form now = the adapter seam; a real device
 * (MQTT/HTTP/Modbus/ERP API) plugs into the same seam later without touching the rail.
 *
 * Self-registering: this capability adds its own EP rows to the shared EP map on load (api() reads EP at
 * call-time), so no app.html edit is needed. Backend: routes/connectors.js (needs migration b57 applied).
 */

/* --- register this capability's endpoints on the shared EP map (mutating the const object is allowed) --- */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    connectorList:       {m:'GET',   p:'/api/connectors',                              ok:'y'}, // {connectors:[...]}
    connectorCreate:     {m:'POST',  p:'/api/connectors',                              ok:'y'}, // {display_name,type,actor_key?} -> {connector}
    connectorConns:      {m:'GET',   p:'/api/connectors/:actorId/connections',         ok:'y'}, // -> connections[]
    connectorConnAdd:    {m:'POST',  p:'/api/connectors/:actorId/connections',         ok:'y'}, // {ref,direction,retention,...} -> {connection}
    connectorConnToggle: {m:'PATCH', p:'/api/connectors/:actorId/connections/:connId', ok:'y'}, // {enabled} -> {connection}
  });
}

/* ---------- helpers ---------- */
function _connTypeBadge(t){
  var iot = (t==='iot');
  return '<span style="font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:9px;'
    + (iot?'background:#E7F0FB;color:#2b5c9c':'background:#F0EAF9;color:#6a44a8')+'">'
    + (iot?'🛰️ IoT':'🔌 ERP')+'</span>';
}
function _retBadge(r){
  var forget = (r!=='persist_then_purge');
  return '<span title="'+(forget?'raw payload never persisted':'processed then purged')+'" style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;'
    + (forget?'background:#E9F4EE;color:#2f6043':'background:#FBF3E2;color:#8a6d1f')+'">'
    + (forget?'forget':'purge')+'</span>';
}
function _statusDot(s){
  var c = s==='red'?'#c0453b':s==='amber'?'#c9962a':s==='paused'?'#8b93a1':'#2f8f5b';
  return '<span title="'+esc(s||'green')+'" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c+'"></span>';
}
function _connLoading(msg){
  return '<div style="padding:24px;text-align:center;color:var(--grey);font-size:12.5px">'+esc(msg||'Loading…')+'</div>';
}

/* ---------- data ---------- */
async function loadConnectors(){
  try{
    var r = await api('connectorList');
    UI.connectors = (r && r.connectors) || [];
  }catch(e){
    UI.connectors = [];
    UI.connectorsErr = (e && e.message) || 'Could not load connectors.';
  }
  if(typeof renderApp==='function') renderApp();
}
async function selectConnector(actorId){
  var c = (UI.connectors||[]).find(function(x){ return x.identity_id===actorId; });
  UI.connSel = c || null; UI.connConns = undefined; UI.connAddConn = false;
  if(typeof renderApp==='function') renderApp();
  if(!c) return;
  try{
    var conns = await api('connectorConns', {params:{actorId:actorId}});
    UI.connConns = Array.isArray(conns) ? conns : ((conns && conns.connections) || []);
  }catch(e){
    UI.connConns = []; if(typeof toast==='function') toast(MSG?MSG.fail('load connections', e):'Could not load connections.');
  }
  if(typeof renderApp==='function') renderApp();
}

/* ---------- screen (master-detail) ---------- */
function connectorsScreen(){
  if(UI.connectors===undefined){ loadConnectors(); return _connLoading('Loading connectors…'); }

  var list = UI.connectors || [];
  var leftItems = list.length ? list.map(function(c){
    var sel = UI.connSel && UI.connSel.identity_id===c.identity_id;
    return '<div onclick="selectConnector(\''+c.identity_id+'\')" style="padding:10px 11px;border-radius:9px;cursor:pointer;margin-bottom:6px;border:1px solid '
      +(sel?'var(--accent,#3F66A6)':'var(--line)')+';'+(sel?'background:#F5F8FC':'')+'">'
      +'<div style="display:flex;align-items:center;gap:8px"><b style="font-size:13px">'+esc(c.display_name)+'</b> '+_connTypeBadge(c.connector_type)+'</div>'
      +'<div class="mono" style="color:var(--grey);font-size:11px;margin-top:2px">'+esc(c.actor_key||'')+'</div>'
    +'</div>';
  }).join('') : '<div style="color:var(--grey);font-size:12.5px;padding:8px 2px">No connectors yet. Create one to begin.</div>';

  var newForm = UI.connNew ? (
    '<div class="card" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:8px">'
      +'<div class="sec" style="margin:0 0 8px;font-size:13px">New connector</div>'
      +'<label class="fl">Name</label><input class="inp" id="cn_name" placeholder="Edge Gateway 01 / Acme ERP" style="width:100%">'
      +'<div style="margin-top:8px"><label class="fl">Type</label>'
        +'<select class="inp" id="cn_type" style="width:100%"><option value="iot">🛰️ IoT device</option><option value="erp">🔌 ERP / API</option></select></div>'
      +'<div class="err" id="cn_err" style="margin-top:6px"></div>'
      +'<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button class="composebtn pri" onclick="createConnector()">Create</button>'
        +'<button class="composebtn" onclick="UI.connNew=false;renderApp()">Cancel</button></div>'
    +'</div>'
  ) : '<div style="margin-top:8px"><button class="composebtn pri" onclick="UI.connNew=true;renderApp()">＋ New connector</button></div>';

  var left = '<div style="flex:1;min-width:230px;max-width:320px">'
    +'<div class="sec" style="font-size:13px;margin-bottom:8px">Connector actors</div>'
    + (UI.connectorsErr ? '<div class="err" style="margin-bottom:6px">'+esc(UI.connectorsErr)+'</div>' : '')
    + leftItems + newForm
  +'</div>';

  var right = '<div style="flex:2;min-width:280px">'+ (UI.connSel ? connectorDetail(UI.connSel) : _connEmpty()) +'</div>';

  return '<div style="padding:14px;max-width:1000px;margin:0 auto">'
    +'<div class="sec" style="font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:9px">🛰️ Connectors</div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin-bottom:14px">A connector is a visible actor (IoT device or ERP/API) under your entity. Give it endpoints/connections, then emit signals over the governed rail — they land in the counterparty\'s <b>Task</b> inbox as sealed, co-held records. Raw payloads are processed then forgotten (receipt-only).</div>'
    +'<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">'+ left + right +'</div>'
  +'</div>';
}

function _connEmpty(){
  return '<div style="border:1px dashed var(--line);border-radius:11px;padding:28px;text-align:center;color:var(--grey);font-size:12.5px">Select a connector on the left to manage its endpoints and emit signals — or create one.</div>';
}

function connectorDetail(c){
  var conns = UI.connConns;
  var connsHtml;
  if(conns===undefined){ connsHtml = _connLoading('Loading endpoints…'); }
  else if(!conns.length){ connsHtml = '<div style="color:var(--grey);font-size:12.5px;padding:6px 0">No endpoints yet. Add one below.</div>'; }
  else {
    connsHtml = conns.map(function(cn){
      return '<div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px dashed var(--line);font-size:12.5px">'
        +_statusDot(cn.status)
        +'<span style="font-weight:700;color:var(--grey);flex:none;width:26px">'+(cn.direction==='out'?'▲ out':'▼ in')+'</span>'
        +'<span style="flex:1"><b>'+esc(cn.ref)+'</b>'+(cn.schema_ref?' <span style="color:var(--grey)">· '+esc(cn.schema_ref)+'</span>':'')+'</span>'
        +_retBadge(cn.retention)
        +'<button class="composebtn" style="padding:2px 9px;font-size:11px" onclick="toggleConnection(\''+c.identity_id+'\','+cn.connection_id+','+(cn.enabled?'false':'true')+')">'+(cn.enabled?'Disable':'Enable')+'</button>'
      +'</div>';
    }).join('');
  }

  var addForm = UI.connAddConn ? (
    '<div class="card" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:10px">'
      +'<div class="sec" style="margin:0 0 8px;font-size:13px">Add endpoint</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
        +'<div style="flex:2;min-width:150px"><label class="fl">Endpoint / device ref</label><input class="inp" id="ce_ref" placeholder="'+(c.connector_type==='iot'?'edge-gw-01 / sensor-42':'https://erp.acme/api or queue name')+'" style="width:100%"></div>'
        +'<div style="flex:1;min-width:90px"><label class="fl">Direction</label><select class="inp" id="ce_dir" style="width:100%"><option value="in">▼ in</option><option value="out">▲ out</option></select></div>'
      +'</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
        +'<div style="flex:1;min-width:120px"><label class="fl">Retention</label><select class="inp" id="ce_ret" style="width:100%"><option value="never_persist">forget (never persist)</option><option value="persist_then_purge">process then purge</option></select></div>'
        +'<div style="flex:2;min-width:150px"><label class="fl">Schema ref (optional)</label><input class="inp" id="ce_schema" placeholder="signal schema id / name" style="width:100%"></div>'
      +'</div>'
      +'<div class="err" id="ce_err" style="margin-top:6px"></div>'
      +'<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button class="composebtn pri" onclick="saveConnection(\''+c.identity_id+'\')">Add endpoint</button>'
        +'<button class="composebtn" onclick="UI.connAddConn=false;renderApp()">Cancel</button></div>'
    +'</div>'
  ) : '<div style="margin-top:8px"><button class="composebtn" onclick="UI.connAddConn=true;renderApp()">＋ Add endpoint</button></div>';

  var log = (UI.connectorLog||[]);
  var logHtml = log.length ? log.map(function(s){
    return '<div style="display:flex;gap:8px;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px dashed var(--line)">'
      +'<span style="color:#2f8f5b;flex:none;font-weight:700">▲ emitted</span>'
      +'<span><b>'+esc(s.signal)+'</b> = '+esc(String(s.value))+esc(s.unit||'')+' · '+esc(s.device_id)+'</span>'
      +'<span style="margin-left:auto;color:var(--grey);font-size:11px">→ '+esc(s.to)+' · '+esc(s.at)+'</span></div>';
  }).join('') : '<div style="color:var(--grey);font-size:12px;padding:5px 0">No signals emitted yet this session.</div>';

  return '<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:12px">'
      +'<div style="display:flex;align-items:center;gap:9px;margin-bottom:2px"><span class="sec" style="margin:0;font-size:14px">'+esc(c.display_name)+'</span> '+_connTypeBadge(c.connector_type)+'</div>'
      +'<div class="mono" style="color:var(--grey);font-size:11px;margin-bottom:10px">'+esc(c.actor_key||'')+' · appears in Co-assists</div>'
      +'<div class="sec" style="margin:0 0 4px;font-size:13px">Endpoints / connections</div>'+connsHtml+addForm
    +'</div>'
    +'<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:12px">'
      +'<div class="sec" style="margin:0 0 8px;font-size:13px">Emit a signal <span style="font-weight:400;color:var(--grey);font-size:11px">— the adapter seam</span></div>'
      +'<label class="fl">Counterparty entity id</label><input class="inp" id="cx_to" placeholder="paste the receiving entity_id (uuid)" style="width:100%">'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
        +'<div style="flex:2;min-width:120px"><label class="fl">Device / endpoint</label><input class="inp" id="cx_dev" placeholder="edge-gw-01" style="width:100%"></div>'
        +'<div style="flex:2;min-width:120px"><label class="fl">Signal</label><input class="inp" id="cx_sig" placeholder="temperature" style="width:100%"></div>'
        +'<div style="flex:1;min-width:80px"><label class="fl">Value</label><input class="inp" id="cx_val" placeholder="42" style="width:100%"></div>'
        +'<div style="flex:1;min-width:64px"><label class="fl">Unit</label><input class="inp" id="cx_unit" placeholder="C" style="width:100%"></div>'
      +'</div>'
      +'<div class="err" id="cx_err" style="margin-top:6px"></div>'
      +'<div style="margin-top:10px"><button class="composebtn pri" onclick="emitSignal()">▲ Emit signal</button></div>'
    +'</div>'
    +'<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px">'
      +'<div class="sec" style="margin:0 0 4px;font-size:13px">Emitted this session</div>'+logHtml
    +'</div>';
}

/* ---------- actions ---------- */
async function createConnector(){
  var name=(val('cn_name')||'').trim(), type=(val('cn_type')||'iot');
  var err=document.getElementById('cn_err'); if(err)err.textContent='';
  if(name.length<2){ if(err)err.textContent='A name of at least 2 characters is required.'; return; }
  try{
    var r = await api('connectorCreate', {body:{ display_name:name, type:type }});
    UI.connNew=false; UI.connectors=undefined;              // force reload
    if(typeof toast==='function') toast('Connector created — it now appears in Co-assists.');
    await loadConnectors();
    var made = r && r.connector;
    if(made && made.identity_id) selectConnector(made.identity_id);
  }catch(e){ if(err)err.textContent=(e&&e.message)||'Create failed'; }
}

async function saveConnection(actorId){
  var ref=(val('ce_ref')||'').trim(), dir=(val('ce_dir')||'in'), ret=(val('ce_ret')||'never_persist'), schema=(val('ce_schema')||'').trim();
  var err=document.getElementById('ce_err'); if(err)err.textContent='';
  if(!ref){ if(err)err.textContent='An endpoint / device ref is required.'; return; }
  try{
    await api('connectorConnAdd', {params:{actorId:actorId}, body:{ ref:ref, direction:dir, retention:ret, schema_ref:schema||undefined }});
    UI.connAddConn=false;
    if(typeof toast==='function') toast('Endpoint added.');
    await selectConnector(actorId);                          // reload connections
  }catch(e){ if(err)err.textContent=(e&&e.message)||'Add failed'; }
}

async function toggleConnection(actorId, connId, enabled){
  try{
    await api('connectorConnToggle', {params:{actorId:actorId, connId:connId}, body:{ enabled:enabled }});
    if(typeof toast==='function') toast(enabled?'Endpoint enabled.':'Endpoint disabled.');
    await selectConnector(actorId);
  }catch(e){ if(typeof toast==='function') toast((e&&e.message)||'Update failed'); }
}

/* the EMIT SEAM — sends a Device Signal chit over the proven /chits/send rail (unchanged) */
async function emitSignal(){
  var to=(val("cx_to")||"").trim(), dev=(val("cx_dev")||"").trim(), sig=(val("cx_sig")||"").trim();
  var value=(val("cx_val")||"").trim(), unit=(val("cx_unit")||"").trim();
  var err=document.getElementById("cx_err"); if(err)err.textContent="";
  if(!to || !sig){ if(err)err.textContent="Counterparty entity id and Signal are required."; return; }
  var body={ recipients:[{entity_id:to, role:'to'}], purpose:'general',
             manual_subject:'Signal: '+sig+(value?(' = '+value+unit):''),
             business_json:{ kind:'device_signal', device_id:dev||null, signal:sig, value:value||null, unit:unit||null } };
  try{ await api("createChit",{body:body});
    UI.connectorLog=[{signal:sig,value:value,unit:unit,device_id:dev||'—',to:to.slice(0,8)+'…',at:new Date().toLocaleTimeString()}].concat(UI.connectorLog||[]).slice(0,20);
    if(typeof toast==='function') toast("Signal emitted — landed in the counterparty's Task.");
    if(typeof renderApp==='function') renderApp();
  }catch(e){ if(err)err.textContent=(e&&e.message)||"Emit failed"; }
}
