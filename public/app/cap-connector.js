/* app/cap-connector.js — Connector / IoT + ERP capability (lazy; gated by the 'connector' entity capability).
 *
 * A connector is a first-class ACTOR (identities row, connector_type iot|erp) grouped by SITE (Model 1: one
 * entity, many Pis/systems). The actor HOLDS the connection string (IoT: CB-issued ActorKey+endpoint / your
 * broker · ERP: base_url+auth_ref). It owns CONNECTIONS (devices/endpoints) each with a bridge_id + config.
 * Health is last_seen-based and CASCADES: a Pi/system offline => every device under it shows no-signal.
 * Backend: routes/connectors.js + migration b62. Self-registers its EP rows on load (no app.html edit).
 */

if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    connectorList:        {m:'GET',   p:'/api/connectors',                              ok:'y'},
    connectorCreate:      {m:'POST',  p:'/api/connectors',                              ok:'y'},
    connectorProvision:   {m:'GET',   p:'/api/connectors/:actorId/provisioning',        ok:'y'},
    connectorPing:        {m:'POST',  p:'/api/connectors/:actorId/ping',                ok:'y'},
    connectorConns:       {m:'GET',   p:'/api/connectors/:actorId/connections',         ok:'y'},
    connectorConnAdd:     {m:'POST',  p:'/api/connectors/:actorId/connections',         ok:'y'},
    connectorConnToggle:  {m:'PATCH', p:'/api/connectors/:actorId/connections/:connId', ok:'y'},
  });
}

/* ---------- helpers ---------- */
function _connTypeBadge(t){ var iot=(t==='iot'); return '<span style="font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:9px;'+(iot?'background:#E7F0FB;color:#2b5c9c':'background:#F0EAF9;color:#6a44a8')+'">'+(iot?'🛰️ IoT · Pi':'🔌 ERP')+'</span>'; }
function _healthDot(h){ var m={live:'#2f8f5b',slow:'#c9962a',offline:'#c0453b'}; var c=m[h]||'#8b93a1'; return '<span title="'+esc(h||'unknown')+'" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+c+'"></span>'; }
function _healthWord(h){ var m={live:'<span style="color:#2f8f5b;font-weight:700">● live</span>',slow:'<span style="color:#c9962a;font-weight:700">◐ slow</span>',offline:'<span style="color:#c0453b;font-weight:700">● offline</span>'}; return m[h]||'<span style="color:#8b93a1">○ unknown</span>'; }
function _sigLabel(s){
  if(s==='no_signal') return '<span style="color:#c0453b;font-weight:700">○ no signal (gateway down)</span>';
  if(s==='live') return '<span style="color:#2f8f5b;font-weight:700">● live</span>';
  if(s==='slow') return '<span style="color:#c9962a;font-weight:700">◐ slow</span>';
  return '<span style="color:#8b93a1;font-weight:700">○ silent</span>';
}
function _retBadge(r){ var forget=(r!=='persist_then_purge'); return '<span title="'+(forget?'raw payload never persisted':'processed then purged')+'" style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;'+(forget?'background:#E9F4EE;color:#2f6043':'background:#FBF3E2;color:#8a6d1f')+'">'+(forget?'forget':'purge')+'</span>'; }
function _connLoading(msg){ return '<div style="padding:24px;text-align:center;color:var(--grey);font-size:12.5px">'+esc(msg||'Loading…')+'</div>'; }

/* ---------- data ---------- */
async function loadConnectors(){
  try{ var r=await api('connectorList'); UI.connectors=(r&&r.connectors)||[]; UI.connectorsErr=null; }
  catch(e){ UI.connectors=[]; UI.connectorsErr=(e&&e.message)||'Could not load connectors.'; }
  if(typeof renderApp==='function') renderApp();
}
async function selectConnector(actorId){
  var c=(UI.connectors||[]).find(function(x){ return x.identity_id===actorId; });
  UI.connSel=c||null; UI.connConns=undefined; UI.connActorHealth=undefined; UI.connAddConn=false; UI.connProv=undefined;
  if(typeof renderApp==='function') renderApp();
  if(!c) return;
  try{
    var r=await api('connectorConns',{params:{actorId:actorId}});
    UI.connConns=(r&&r.connections)||[]; UI.connActorHealth=(r&&r.actor_health)||'offline';
  }catch(e){ UI.connConns=[]; if(typeof toast==='function') toast(MSG?MSG.fail('load connections',e):'Could not load connections.'); }
  try{ UI.connProv=await api('connectorProvision',{params:{actorId:actorId}}); }catch(_){ UI.connProv=null; }
  if(typeof renderApp==='function') renderApp();
}
async function pingConnector(actorId){
  try{ await api('connectorPing',{params:{actorId:actorId},body:{}}); if(typeof toast==='function') toast('Ping sent — connector marked live.'); UI.connectors=undefined; await loadConnectors(); await selectConnector(actorId); }
  catch(e){ if(typeof toast==='function') toast((e&&e.message)||'Ping failed'); }
}

/* ---------- screen (master-detail, grouped by site) ---------- */
function connectorsScreen(){
  if(UI.connectors===undefined){ loadConnectors(); return _connLoading('Loading connectors…'); }
  var list=UI.connectors||[];
  // group by site
  var groups={}; list.forEach(function(c){ var s=c.site||'— no site —'; (groups[s]=groups[s]||[]).push(c); });
  var leftItems = list.length ? Object.keys(groups).map(function(site){
    var rows=groups[site].map(function(c){
      var sel=UI.connSel&&UI.connSel.identity_id===c.identity_id;
      return '<div onclick="selectConnector(\''+c.identity_id+'\')" style="padding:9px 11px;border-radius:9px;cursor:pointer;margin-bottom:6px;border:1px solid '+(sel?'#3F66A6':'var(--line)')+';'+(sel?'background:#F5F8FC':'')+'">'
        +'<div style="display:flex;align-items:center;gap:8px"><b style="font-size:12.5px">'+esc(c.display_name)+'</b> '+_connTypeBadge(c.connector_type)+'<span style="margin-left:auto">'+_healthDot(c.health)+'</span></div>'
        +'<div style="color:var(--grey);font-size:11px;margin-top:2px">'+Number(c.connection_count||0)+' connection'+(Number(c.connection_count)===1?'':'s')+' · '+esc(c.health||'')+'</div></div>';
    }).join('');
    return '<div style="font-size:10.5px;font-weight:700;color:var(--grey);text-transform:uppercase;letter-spacing:.4px;margin:10px 0 5px">📍 '+esc(site)+'</div>'+rows;
  }).join('') : '<div style="color:var(--grey);font-size:12.5px;padding:8px 2px">No connectors yet. Create one to begin.</div>';

  var newForm = UI.connNew ? _newConnectorForm() : '<div style="margin-top:10px"><button class="composebtn pri" onclick="UI.connNew=true;UI.connNewType=\'iot\';renderApp()">＋ New connector (Pi / system)</button></div>';
  var left='<div style="flex:1;min-width:250px;max-width:340px"><div class="sec" style="font-size:13px;margin-bottom:6px">Connectors</div>'
    +(UI.connectorsErr?'<div class="err" style="margin-bottom:6px">'+esc(UI.connectorsErr)+'</div>':'')+leftItems+newForm+'</div>';
  var right='<div style="flex:2;min-width:300px">'+(UI.connSel?connectorDetail(UI.connSel):_connEmpty())+'</div>';
  return '<div style="padding:14px;max-width:1040px;margin:0 auto">'
    +'<div class="sec" style="font-size:15px;margin-bottom:3px">🛰️ Connectors</div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin-bottom:14px">Each connector is an actor (a Pi, or an ERP system) grouped by site. It holds the connection string; its devices/endpoints are connections under it. If a Pi is down, its devices go silent — the pipe is down, not the sensors.</div>'
    +'<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">'+left+right+'</div></div>';
}
function _newConnectorForm(){
  var t=UI.connNewType||'iot';
  var typeFields = t==='iot'
    ? '<div style="display:flex;gap:8px;margin-top:8px"><div style="flex:1"><label class="fl">Mode</label><select class="inp" id="cn_mode" style="width:100%"><option value="push">push — CB issues the key (Pi sends to us)</option><option value="pull">pull — your broker (we subscribe)</option></select></div>'
      +'<div style="flex:2"><label class="fl">Endpoint / broker (optional)</label><input class="inp" id="cn_endpoint" placeholder="ingest.chitbridge.io:8883" style="width:100%"></div></div>'
    : '<div style="margin-top:8px"><label class="fl">Base URL</label><input class="inp" id="cn_baseurl" placeholder="https://erp.acme.com/api" style="width:100%"></div>'
      +'<div style="display:flex;gap:8px;margin-top:8px"><div style="flex:1"><label class="fl">Auth type</label><select class="inp" id="cn_authtype" style="width:100%"><option>none</option><option>api_key</option><option>basic</option><option>bearer</option><option>oauth2</option></select></div>'
      +'<div style="flex:2"><label class="fl">Auth reference (secret NAME, not the key)</label><input class="inp" id="cn_authref" placeholder="ACME_ERP_APIKEY" style="width:100%"></div></div>';
  return '<div class="card" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:8px">'
    +'<div class="sec" style="margin:0 0 8px;font-size:13px">New connector</div>'
    +'<div style="display:flex;gap:8px"><div style="flex:2"><label class="fl">Name</label><input class="inp" id="cn_name" placeholder="'+(t==='iot'?'Line-1 Gateway':'Acme SAP')+'" style="width:100%"></div>'
    +'<div style="flex:1"><label class="fl">Type</label><select class="inp" id="cn_type" onchange="UI.connNewType=this.value;renderApp()" style="width:100%"><option value="iot"'+(t==='iot'?' selected':'')+'>🛰️ IoT / Pi</option><option value="erp"'+(t==='erp'?' selected':'')+'>🔌 ERP</option></select></div></div>'
    +'<div style="margin-top:8px"><label class="fl">Site / location</label><input class="inp" id="cn_site" placeholder="Chennai / Line-1" style="width:100%"></div>'
    +typeFields
    +'<div class="err" id="cn_err" style="margin-top:6px"></div>'
    +'<div style="display:flex;gap:8px;margin-top:10px"><button class="composebtn pri" onclick="createConnector()">Create</button><button class="composebtn" onclick="UI.connNew=false;renderApp()">Cancel</button></div></div>';
}
function _connEmpty(){ return '<div style="border:1px dashed var(--line);border-radius:11px;padding:28px;text-align:center;color:var(--grey);font-size:12.5px">Select a connector to manage its devices/endpoints, see its health, and get its connection string.</div>'; }

/* ---------- detail ---------- */
function connectorDetail(c){
  var iot=(c.connector_type==='iot');
  var actorHealth=UI.connActorHealth||c.health||'offline';
  var offline=(actorHealth==='offline');
  var conns=UI.connConns, connsHtml;
  if(conns===undefined){ connsHtml=_connLoading('Loading…'); }
  else if(!conns.length){ connsHtml='<div style="color:var(--grey);font-size:12.5px;padding:6px 0">No '+(iot?'devices':'endpoints')+' yet. Add one below.</div>'; }
  else { connsHtml=conns.map(function(cn){
      var cfg=cn.conn_config||{};
      var detail = iot ? [cfg.topic,cfg.device_id].filter(Boolean).join(' · ') : (cfg.path||'');
      return '<div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px dashed var(--line);font-size:12.5px">'
        +'<span style="font-weight:700;color:var(--grey);flex:none;width:26px">'+(cn.direction==='out'?'▲ out':'▼ in')+'</span>'
        +'<span style="flex:1"><b>'+esc(cn.ref)+'</b>'+(cn.bridge_id?' <code style="background:#f6f6f4;border:1px solid #eee;border-radius:5px;padding:0 5px;font-size:10.5px;color:var(--grey)">'+esc(cn.bridge_id)+'</code>':'')+(detail?' <span style="color:var(--grey)">· '+esc(detail)+'</span>':'')+'</span>'
        +_retBadge(cn.retention)+'<span style="min-width:120px;text-align:right">'+_sigLabel(cn.enabled===false?'silent':cn.signal)+'</span>'
        +'<button class="composebtn" style="padding:2px 9px;font-size:11px" onclick="toggleConnection(\''+c.identity_id+'\','+cn.connection_id+','+(cn.enabled?'false':'true')+')">'+(cn.enabled?'Disable':'Enable')+'</button></div>';
    }).join(''); }

  var addForm = UI.connAddConn ? _addConnForm(c) : '<div style="margin-top:8px"><button class="composebtn" onclick="UI.connAddConn=true;renderApp()">＋ Add '+(iot?'device':'endpoint')+'</button></div>';
  var prov = _provBlock(c);
  var banner = offline ? '<div style="background:#fbeceb;border:1px solid #f0c9c6;color:#b4453f;border-radius:10px;padding:10px 12px;font-size:12.5px;font-weight:600;margin:10px 0">⚠ '+(iot?'Gateway':'System')+' OFFLINE — no '+(iot?'device':'endpoint')+' below can reach Chit &amp; Bridge until it is back. (The sensors may be fine; the pipe is down.)</div>' : '';

  return '<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:12px">'
      +'<div style="display:flex;align-items:center;gap:9px;margin-bottom:2px"><span class="sec" style="margin:0;font-size:14px">'+esc(c.display_name)+'</span> '+_connTypeBadge(c.connector_type)+'<span style="margin-left:auto">'+_healthWord(actorHealth)+'</span></div>'
      +'<div style="color:var(--grey);font-size:11px;margin-bottom:6px">📍 '+esc(c.site||'no site')+' · appears in Co-assists · <button class="composebtn" style="padding:1px 8px;font-size:11px" onclick="pingConnector(\''+c.identity_id+'\')">⚡ Test connection</button></div>'
      +banner+prov
      +'<div class="sec" style="margin:12px 0 4px;font-size:13px">'+(iot?'Devices':'Endpoints')+' under this '+(iot?'Pi':'system')+'</div>'+connsHtml+addForm
    +'</div>'
    +_emitCard();
}
function _provBlock(c){
  var p=UI.connProv; if(!p) return '';
  var iot=(p.type==='iot');
  var lines = iot
    ? 'Endpoint = '+esc(p.endpoint||'')+'\nActorKey = ••••••••••  (shown once at creation — Regenerate to re-issue)\n\npublishes:\n'+((p.publishes||[]).map(function(x){return '  '+esc(x.bridge_id||'—')+'   '+esc(x.ref||'')+(x.topic?('   '+esc(x.topic)):'');}).join('\n')||'  (no devices yet)')
    : 'Base URL = '+esc(p.base_url||'—')+'\nAuth     = '+esc(p.auth_type||'none')+(p.auth_ref?('  (ref: '+esc(p.auth_ref)+')'):'')+'\n\nendpoints:\n'+((p.endpoints||[]).map(function(x){return '  '+esc(x.bridge_id||'—')+'   '+esc(x.ref||'')+(x.path?('   '+esc(x.path)):'');}).join('\n')||'  (none yet)');
  return '<div style="border:1px solid #cfe0f4;background:#f2f7fd;border-radius:10px;padding:10px 12px;margin-top:4px">'
    +'<div style="font-weight:700;font-size:12px;color:#2c5aa0;margin-bottom:4px">'+(iot?'Provisioning — the string for this Pi':'Connection — this system')+'</div>'
    +'<pre style="background:#0f1b2d;color:#cfe0f4;border-radius:7px;padding:9px 11px;font-size:11px;overflow:auto;margin:0;line-height:1.5">'+lines+'</pre></div>';
}
function _addConnForm(c){
  var iot=(c.connector_type==='iot');
  var typeFields = iot
    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><div style="flex:1;min-width:90px"><label class="fl">Protocol</label><select class="inp" id="ce_proto" style="width:100%"><option>mqtt</option><option>mqtts</option><option>http</option><option>https</option></select></div>'
      +'<div style="flex:2;min-width:120px"><label class="fl">Topic / path</label><input class="inp" id="ce_topic" placeholder="sensors/line1/temp" style="width:100%"></div>'
      +'<div style="flex:1;min-width:100px"><label class="fl">Device ID</label><input class="inp" id="ce_dev" placeholder="edge-gw-01" style="width:100%"></div></div>'
    : '<div style="margin-top:8px"><label class="fl">Resource path</label><input class="inp" id="ce_path" placeholder="/odata/PurchaseOrders" style="width:100%"></div>';
  return '<div class="card" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:10px">'
    +'<div class="sec" style="margin:0 0 8px;font-size:13px">Add '+(iot?'device':'endpoint')+'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap"><div style="flex:2;min-width:150px"><label class="fl">Name / ref</label><input class="inp" id="ce_ref" placeholder="'+(iot?'Cold-store temp':'PO inbound')+'" style="width:100%"></div>'
    +'<div style="flex:1;min-width:90px"><label class="fl">Direction</label><select class="inp" id="ce_dir" style="width:100%"><option value="in">▼ in</option><option value="out">▲ out</option></select></div></div>'
    +typeFields
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><div style="flex:1;min-width:120px"><label class="fl">Retention</label><select class="inp" id="ce_ret" style="width:100%"><option value="never_persist">forget (never persist)</option><option value="persist_then_purge">process then purge</option></select></div>'
    +'<div style="flex:2;min-width:150px"><label class="fl">Schema (optional)</label><input class="inp" id="ce_schema" placeholder="'+(iot?'Device Signal':'Purchase Order')+'" style="width:100%"></div></div>'
    +'<div class="err" id="ce_err" style="margin-top:6px"></div>'
    +'<div style="display:flex;gap:8px;margin-top:10px"><button class="composebtn pri" onclick="saveConnection(\''+c.identity_id+'\')">Add</button><button class="composebtn" onclick="UI.connAddConn=false;renderApp()">Cancel</button></div></div>';
}
function _emitCard(){
  var log=(UI.connectorLog||[]);
  var logHtml=log.length?log.map(function(s){ return '<div style="display:flex;gap:8px;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px dashed var(--line)"><span style="color:#2f8f5b;flex:none;font-weight:700">▲ emitted</span><span><b>'+esc(s.signal)+'</b> = '+esc(String(s.value))+esc(s.unit||'')+' · '+esc(s.device_id)+'</span><span style="margin-left:auto;color:var(--grey);font-size:11px">→ '+esc(s.to)+' · '+esc(s.at)+'</span></div>'; }).join(''):'<div style="color:var(--grey);font-size:12px;padding:5px 0">No signals emitted yet this session.</div>';
  return '<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:12px">'
      +'<div class="sec" style="margin:0 0 8px;font-size:13px">Emit a signal <span style="font-weight:400;color:var(--grey);font-size:11px">— the adapter seam (stands in for a live device)</span></div>'
      +'<label class="fl">Counterparty entity id</label><input class="inp" id="cx_to" placeholder="receiving entity_id (uuid)" style="width:100%">'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><div style="flex:2;min-width:120px"><label class="fl">Device / endpoint</label><input class="inp" id="cx_dev" placeholder="edge-gw-01" style="width:100%"></div>'
      +'<div style="flex:2;min-width:120px"><label class="fl">Signal</label><input class="inp" id="cx_sig" placeholder="temperature" style="width:100%"></div>'
      +'<div style="flex:1;min-width:80px"><label class="fl">Value</label><input class="inp" id="cx_val" placeholder="42" style="width:100%"></div>'
      +'<div style="flex:1;min-width:64px"><label class="fl">Unit</label><input class="inp" id="cx_unit" placeholder="C" style="width:100%"></div></div>'
      +'<div class="err" id="cx_err" style="margin-top:6px"></div>'
      +'<div style="margin-top:10px"><button class="composebtn pri" onclick="emitSignal()">▲ Emit signal</button></div></div>'
    +'<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px"><div class="sec" style="margin:0 0 4px;font-size:13px">Emitted this session</div>'+logHtml+'</div>';
}

/* ---------- actions ---------- */
async function createConnector(){
  var name=(val('cn_name')||'').trim(), type=(val('cn_type')||'iot'), site=(val('cn_site')||'').trim();
  var err=document.getElementById('cn_err'); if(err)err.textContent='';
  if(name.length<2){ if(err)err.textContent='A name of at least 2 characters is required.'; return; }
  var config={};
  if(type==='iot'){ config={ mode:(val('cn_mode')||'push'), endpoint:(val('cn_endpoint')||'').trim()||undefined }; }
  else { config={ base_url:(val('cn_baseurl')||'').trim()||undefined, auth_type:(val('cn_authtype')||'none'), auth_ref:(val('cn_authref')||'').trim()||undefined }; }
  try{
    var r=await api('connectorCreate',{body:{ display_name:name, type:type, site:site||undefined, config:config }});
    UI.connNew=false; UI.connectors=undefined;
    if(r && r.provision_key){ _showProvisionKey(name, r.provision_key); }
    else if(typeof toast==='function') toast('Connector created — it appears in Co-assists.');
    await loadConnectors();
    var made=r&&r.connector; if(made&&made.identity_id) selectConnector(made.identity_id);
  }catch(e){ if(err)err.textContent=(e&&e.message)||'Create failed'; }
}
function _showProvisionKey(name, key){
  if(typeof modal!=='function'){ if(typeof toast==='function') toast('ActorKey: '+key); return; }
  modal('<div class="mhd"><div class="t">🔑 Device key — shown ONCE</div></div>'
    +'<div class="mbody"><div style="font-size:12.5px;color:var(--grey);margin-bottom:8px">Copy this onto <b>'+esc(name)+'</b> now. We store only a hash — you can Regenerate later, but this exact key is not shown again.</div>'
    +'<pre style="background:#0f1b2d;color:#cfe0f4;border-radius:8px;padding:10px 12px;font-size:12px;overflow:auto;margin:0;user-select:all">'+esc(key)+'</pre></div>'
    +'<div class="mfoot"><button class="pri" onclick="closeModal()">I\'ve copied it</button></div>');
}
async function saveConnection(actorId){
  var ref=(val('ce_ref')||'').trim(), dir=(val('ce_dir')||'in'), ret=(val('ce_ret')||'never_persist'), schema=(val('ce_schema')||'').trim();
  var err=document.getElementById('ce_err'); if(err)err.textContent='';
  if(!ref){ if(err)err.textContent='A name / ref is required.'; return; }
  var c=UI.connSel||{}; var config={};
  if(c.connector_type==='iot'){ config={ protocol:(val('ce_proto')||'mqtts'), topic:(val('ce_topic')||'').trim()||undefined, device_id:(val('ce_dev')||'').trim()||undefined }; }
  else { config={ path:(val('ce_path')||'').trim()||undefined }; }
  try{
    await api('connectorConnAdd',{params:{actorId:actorId}, body:{ ref:ref, direction:dir, retention:ret, schema_ref:schema||undefined, config:config }});
    UI.connAddConn=false; if(typeof toast==='function') toast('Added.');
    await selectConnector(actorId);
  }catch(e){ if(err)err.textContent=(e&&e.message)||'Add failed'; }
}
async function toggleConnection(actorId, connId, enabled){
  try{ await api('connectorConnToggle',{params:{actorId:actorId, connId:connId}, body:{ enabled:enabled }}); if(typeof toast==='function') toast(enabled?'Enabled.':'Disabled.'); await selectConnector(actorId); }
  catch(e){ if(typeof toast==='function') toast((e&&e.message)||'Update failed'); }
}
/* the EMIT SEAM — sends a Device Signal chit over the proven /chits/send rail */
async function emitSignal(){
  var to=(val("cx_to")||"").trim(), dev=(val("cx_dev")||"").trim(), sig=(val("cx_sig")||"").trim();
  var value=(val("cx_val")||"").trim(), unit=(val("cx_unit")||"").trim();
  var err=document.getElementById("cx_err"); if(err)err.textContent="";
  if(!to || !sig){ if(err)err.textContent="Counterparty entity id and Signal are required."; return; }
  var body={ recipients:[{entity_id:to, role:'to'}], purpose:'general',
             manual_subject:'Signal: '+sig+(value?(' = '+value+unit):''),
             business_json:{ kind:'device_signal', device_id:dev||null, signal:sig, value:value||null, unit:unit||null } };
  try{ await api("createChit",{body:body});
    UI.connectorLog=[{signal:sig,value:value,unit:unit,device_id:dev||'—',to:to.slice(0,8)+'…',at:new Date().toLocaleTimeString('en-IN')}].concat(UI.connectorLog||[]).slice(0,20);
    if(typeof toast==='function') toast("Signal emitted — landed in the counterparty's Task.");
    if(typeof renderApp==='function') renderApp();
  }catch(e){ if(err)err.textContent=(e&&e.message)||"Emit failed"; }
}
