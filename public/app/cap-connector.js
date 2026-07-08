/* app/cap-connector.js — IoT / ERP connector MANAGEMENT (lazy; loaded via ensureCap('connector') on INVOCATION).
 * The list VIEW (rows, badges, health) lives in cap-workforce and renders from flags — this module is only the
 * heavy Tier-2 management: the device cockpit, provisioning/connection-string, add-device, regenerate, and the
 * one-drop package installer. It SELF-REGISTERS its renderer into ACTOR_MANAGE, so the generic dispatcher finds it.
 * Backend: routes/connectors.js + migration b62. Nothing ships to entities that never open a connector. */

if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    connectorConns:      {m:'GET',   p:'/api/connectors/:actorId/connections',         ok:'y'},
    connectorConnAdd:    {m:'POST',  p:'/api/connectors/:actorId/connections',         ok:'y'},
    connectorConnToggle: {m:'PATCH', p:'/api/connectors/:actorId/connections/:connId', ok:'y'},
    connectorProvision:  {m:'GET',   p:'/api/connectors/:actorId/provisioning',        ok:'y'},
    connectorRegen:      {m:'POST',  p:'/api/connectors/:actorId/regenerate-key',      ok:'y'},
    connectorPing:       {m:'POST',  p:'/api/connectors/:actorId/ping',                ok:'y'},
    connectorCreate:     {m:'POST',  p:'/api/connectors',                              ok:'y'},
    connectorList:       {m:'GET',   p:'/api/connectors',                              ok:'y'},
    connectorDelete:     {m:'DELETE',p:'/api/connectors/:actorId',                     ok:'y'},
    connectorReissueCode:{m:'POST',  p:'/api/connectors/reissue-code',                 ok:'y'},
  });
}

async function acLoadDevices(id){
  UI.acConnsErr=null;
  var ok=false, lastErr=null;                          // retry once — a cold-start blip must NOT silently show "no devices"
  for(var i=0;i<2 && !ok;i++){
    try{ var r=await api('connectorConns',{params:{actorId:id}}); UI.acConns=(r&&r.connections)||[]; UI.acHealth=(r&&r.actor_health)||'offline'; UI.acLastSeen=(r&&r.actor_last_seen)||null; ok=true; }
    catch(e){ lastErr=e; }
  }
  if(!ok){ UI.acConns=[]; UI.acHealth='offline'; UI.acConnsErr=(lastErr&&lastErr.message)||'Could not load devices'; }
  try{ UI.acProv=await api('connectorProvision',{params:{actorId:id}}); }catch(_){ UI.acProv=null; }
  if(UI.acSel===id) paintAcDetail();
}
function _hdot(h){ return healthDot(h); }   // shared: helpers.js healthDot/sigLabel
function _sig(s){ return sigLabel(s); }
function _tile(k,v){ return '<div style="background:#f4f6f8;border:1px solid var(--line);border-radius:11px;padding:10px 11px;min-width:0"><div style="font-size:10.5px;color:var(--grey);text-transform:uppercase;letter-spacing:.03em">'+k+'</div><div style="font-size:19px;font-weight:800;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+v+'</div></div>'; }
function piCockpit(x){
  var iot=acTypeOf(x)==='iot', health=UI.acHealth||'offline';
  var tchip=iot?'<span class="optchip" style="background:#eaf2fb;color:#2c5aa0;border-color:#cfe0f4">🛰️ IoT</span>':'<span class="optchip" style="background:#f1ecf9;color:#6b3fa0;border-color:#ddcff2">🔌 ERP</span>';
  var ico=function(t,title,on){ return '<button title="'+title+'" onclick="'+on+'" style="border:1px solid var(--line);background:#fff;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:15px">'+t+'</button>'; };
  var header='<div style="position:sticky;top:0;background:#fff;z-index:5;padding-bottom:10px;border-bottom:1px solid var(--line)">'
    +'<button class="dback" onclick="backToList()">‹ Co-assists</button>'
    +'<div style="display:flex;align-items:center;gap:9px;margin-top:6px"><span style="font-size:16px;font-weight:700">'+esc(x.name)+'</span> '+tchip+' '+_hdot(health)
      +'<span style="margin-left:auto;display:inline-flex;gap:7px">'+ico('⚡','Test connection',"acPing('"+x.id+"')")+ico('🔑','Connection string',"UI.acProvOpen=!UI.acProvOpen;paintAcDetail()")+(iot?ico('📦','Create package — one-drop Pi installer',"acCreatePackage('"+x.id+"')"):'')+ico('＋','Add '+(iot?'device':'endpoint'),"UI.acAddDev=!UI.acAddDev;paintAcDetail()")+ico('🗑','Delete this '+(iot?'gateway':'system'),"acDeleteConnector('"+x.id+"','"+esc(x.name).replace(/'/g,"\\'")+"')")+'</span></div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin-top:3px">📍 '+esc(x.site||'no site')+' · '+esc(health)+'</div></div>';
  var offline = health==='offline' ? '<div style="background:#fbeceb;border:1px solid #f0c9c6;color:#b4453f;border-radius:10px;padding:9px 11px;font-size:12px;font-weight:600;margin:10px 0">⚠ '+(iot?'Gateway':'System')+' OFFLINE — no '+(iot?'device':'endpoint')+' below can signal until it is back.</div>' : '';
  var prov = UI.acProvOpen ? _provPanel(iot, x.id) : '';
  var addf = UI.acAddDev ? _addDeviceForm(x,iot) : '';
  var _loadingT=(UI.acConns===undefined); var _cn=_loadingT?[]:(UI.acConns||[]); var _live=_cn.filter(function(c){return c.signal==='live';}).length; var _agoT=(typeof _ago==='function'?_ago(UI.acLastSeen):'');
  var tiles='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:14px 0">'
    +_tile(iot?'Devices':'Endpoints', _loadingT?'—':_cn.length)
    +_tile('Live now', _loadingT?'—':('<span style="display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle;background:'+(_live>0?'#2f8f5b':'#c0453b')+';margin-right:6px"></span>'+_live+' <small style="font-size:12px;color:#586069;font-weight:600">/ '+_cn.length+'</small>'))
    +_tile('Last signal', _loadingT?'—':(_agoT||'—'))
    +'</div>';
  var conns=UI.acConns, list;
  if(conns===undefined) list='<div style="padding:16px;color:var(--grey);font-size:12.5px">Loading…</div>';
  else if(UI.acConnsErr) list='<div style="padding:10px 2px;color:#c0453b;font-size:12px">⚠ '+esc(UI.acConnsErr)+' <button class="composebtn" style="padding:2px 9px;font-size:11px;margin-left:6px" onclick="acLoadDevices(\''+x.id+'\')">Retry</button></div>';
  else if(!conns.length) list='<div style="padding:10px 2px;color:var(--grey);font-size:12.5px">No '+(iot?'devices':'endpoints')+' yet. Tap ＋ to add one.</div>';
  else list=conns.map(function(c){ var cfg=c.conn_config||{}; var det=iot?[cfg.folder?('📁 '+cfg.folder):null,(cfg.classes&&cfg.classes.length)?('🏷 '+cfg.classes.join('/')):null,cfg.topic,cfg.device_id].filter(Boolean).join(' · '):(cfg.path||'');
    return '<div style="display:flex;align-items:center;gap:9px;padding:10px 0;border-bottom:1px dashed var(--line);font-size:12.5px"><div style="flex:1;min-width:0"><b>'+esc(c.ref)+'</b>'+(c.bridge_id?' <code style="background:#f6f6f4;border:1px solid #eee;border-radius:5px;padding:0 5px;font-size:10.5px;color:var(--grey)">'+esc(c.bridge_id)+'</code>':'')+(det?'<div style="color:var(--grey);font-size:11px;margin-top:1px">'+esc(det)+'</div>':'')+'</div>'+_sig(c.enabled===false?'silent':c.signal)+'<button class="composebtn" style="padding:2px 9px;font-size:11px" onclick="acToggleDevice(\''+x.id+'\','+c.connection_id+','+(c.enabled?'false':'true')+')">'+(c.enabled?'Disable':'Enable')+'</button></div>';
  }).join('');
  // Obvious, labelled installer button (the bare 📦 header icon was too easy to miss) + an inline caution: this DOWNLOAD
  // reissues the key, so any device already running this gateway goes silent until reflashed. The confirm gates it too.
  var installerBtn = iot ? '<button class="composebtn pri" style="width:100%;margin:8px 0 3px" onclick="acCreatePackage(\''+x.id+'\')">📦 Get the Pi installer</button><div style="font-size:11px;color:#8a6d1e;text-align:center;margin-bottom:8px;line-height:1.45">⚠ Downloading <b>reissues the key</b> — a device already running this gateway goes silent until you reflash it with the new installer.</div>' : '';
  return header+tiles+installerBtn+offline+prov+addf+'<div class="sec" style="margin-top:14px">'+(iot?'Devices':'Endpoints')+(conns?(' <span style="color:var(--grey);font-weight:400">('+conns.length+')</span>'):'')+'</div>'+list;
}
function _provPanel(iot, aid){
  var p=UI.acProv; if(!p) return '<div style="padding:10px 2px;color:var(--grey);font-size:12px">Loading connection string…</div>';
  var lines = iot ? 'Endpoint = '+esc(p.endpoint||'')+'\nActorKey = ••••••••  (secret — Regenerate to issue a fresh one)\nBridgeIds:\n'+((p.publishes||[]).map(function(z){return '  '+esc(z.bridge_id||'—')+'  '+esc(z.ref||'');}).join('\n')||'  (none yet)') : 'Base URL = '+esc(p.base_url||'—')+'\nAuth = '+esc(p.auth_type||'none')+(p.auth_ref?(' (ref: '+esc(p.auth_ref)+')'):'');
  var fresh = (iot && UI.acFreshKey) ? '<div style="border:1px solid #bfe6c9;background:#eefaf0;border-radius:8px;padding:9px 11px;margin-top:9px"><div style="font-size:11.5px;font-weight:700;color:#1f7a3d;margin-bottom:5px">✅ New ActorKey — copy it to the Pi NOW, it will not be shown again:</div><pre style="background:#0f1b2d;color:#cfe0f4;border-radius:7px;padding:9px 11px;font-size:12px;overflow:auto;margin:0;user-select:all">'+esc(UI.acFreshKey)+'</pre></div>' : '';
  var regen = (iot && aid) ? '<div style="margin-top:9px"><button class="composebtn" onclick="acRegenKey(\''+esc(aid)+'\')">♻ Reissue raw key (advanced)</button><div style="font-size:11px;color:var(--grey);margin-top:4px">For a <b>direct HTTPS device</b> (ESP32 etc.) that can\'t run the installer — shows the raw key once. For a Pi, use <b>📦 Get the Pi installer</b> above instead. Either way, reissuing stops any device on the old key until reflashed.</div></div>' : '';
  return '<div style="border:1px solid #cfe0f4;background:#f2f7fd;border-radius:10px;padding:10px 12px;margin:10px 0"><div style="font-weight:700;font-size:12px;color:#2c5aa0;margin-bottom:4px">🔑 Connection string</div><pre style="background:#0f1b2d;color:#cfe0f4;border-radius:7px;padding:9px 11px;font-size:11px;overflow:auto;margin:0;line-height:1.5">'+lines+'</pre>'+fresh+regen+'</div>';
}
// Delete a connector — RULE: only when it has NO devices attached; the backend returns 409 otherwise (we surface it).
function acDeleteConnector(id, name){
  var run=async function(){
    try{
      await api('connectorDelete',{params:{actorId:id}});
      if(typeof toast==='function')toast('Deleted '+(name||'connector'));
      UI.acSel=null; UI.connectors=undefined;
      if(typeof backToList==='function') backToList();
      if(typeof loadCoassists==='function') loadCoassists();
    }catch(e){ if(typeof toast==='function')toast((e&&e.message)||'Delete failed — it may have devices attached.'); }
  };
  if(typeof confirmAsk==='function') confirmAsk('Delete connector', 'Delete <b>'+esc(name||'this connector')+'</b>? Only allowed if it has <b>no devices attached</b> — remove its devices first otherwise. This cannot be undone.', 'Delete', run, true);
  else if(window.confirm('Delete '+(name||'this connector')+'? Only if it has no devices attached.')) run();
}
function acRegenKey(id){ acReissueGate(id, 'key'); }   // gated: name + one-time code (see acReissueGate)
function _addDeviceForm(x,iot){
  var spec = iot ? '<label class="fl">Topic</label><input class="inp" id="ad_topic" placeholder="sensors/line1/temp" style="width:100%"><label class="fl">Device id</label><input class="inp" id="ad_dev" placeholder="edge-gw-01" style="width:100%">'
                 : '<label class="fl">Resource path</label><input class="inp" id="ad_path" placeholder="/odata/PurchaseOrders" style="width:100%">';
  return '<div style="border:1px dashed #c9d2dd;border-radius:10px;padding:12px;margin:10px 0;background:#fbfcfe"><div style="font-weight:700;font-size:12.5px;margin-bottom:2px">Add '+(iot?'device':'endpoint')+'</div>'
    +'<label class="fl">Name</label><input class="inp" id="ad_ref" placeholder="'+(iot?'Cold-store temp':'PO inbound')+'" style="width:100%">'+spec
    +(iot?('<label class="fl">Folder — file its exceptions here <span style="font-weight:400;color:var(--grey)">(a name you choose, under this entity)</span></label><input class="inp" id="ad_folder" placeholder="e.g. Gate log" style="width:100%">'
         +'<label class="fl">Keep — exception classes <span style="font-weight:400;color:var(--grey)">(comma-sep · blank = all; group / count by these)</span></label><input class="inp" id="ad_classes" placeholder="lorry, tanker" style="width:100%">'):'')
    +'<label class="fl">CC <span style="font-weight:400;color:var(--grey)">(optional — another entity id who also co-holds the proof)</span></label><input class="inp" id="ad_cp" placeholder="another entity id" style="width:100%">'
    +'<div class="err" id="ad_err" style="margin-top:6px"></div>'
    +'<div style="display:flex;gap:8px;margin-top:10px"><button class="composebtn pri" onclick="acAddDevice(\''+x.id+'\','+(iot?'true':'false')+')">Add</button><button class="composebtn" onclick="UI.acAddDev=false;paintAcDetail()">Cancel</button></div></div>';
}
async function acAddDevice(id, iot){
  var ref=(val('ad_ref')||'').trim(), err=document.getElementById('ad_err'); if(err)err.textContent='';
  if(!ref){ if(err)err.textContent='A name is required.'; return; }
  var _cls=(val('ad_classes')||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var config = iot ? {protocol:'mqtts', topic:(val('ad_topic')||'').trim()||undefined, device_id:(val('ad_dev')||'').trim()||undefined, folder:(val('ad_folder')||'').trim()||undefined, classes:_cls.length?_cls:undefined} : {path:(val('ad_path')||'').trim()||undefined};
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
// ═══ CREATE PACKAGE → one-drop installer. Rotates the key (only a fresh key can be embedded — we store only the hash),
//     bundles endpoint + key + device routing + a long-running AGENT (heartbeat + spool drain w/ store-and-forward) +
//     a systemd service, all as an install.sh generated in-browser (key never sits at a URL). Run: sudo bash it on the Pi.
function _download(name, text){
  try{ var b=new Blob([text],{type:'text/x-shellscript'}); var u=URL.createObjectURL(b); var a=document.createElement('a');
    a.href=u; a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); },600); }
  catch(e){ if(typeof toast==='function')toast('Download failed'); }
}
function _agentJs(){ return [
  '#!/usr/bin/env node',
  '// Chit & Bridge IoT agent (long-running). Heartbeats each device + drains a SPOOL directory (store-and-forward).',
  '// Your edge AI writes <name>.json into the spool, e.g:  {"bridge_id":"CB..","sub_type":"tanker","value":"1","image":"/path/frame.jpg"}',
  'var fs=require("fs"), path=require("path"), https=require("https"), URL=require("url").URL;',
  'var CFG=JSON.parse(fs.readFileSync(path.join(__dirname,"config.json"),"utf8"));',
  'var SPOOL=CFG.spool_dir||path.join(__dirname,"spool"), SENT=path.join(__dirname,"sent");',
  'try{ fs.mkdirSync(SPOOL,{recursive:true}); fs.mkdirSync(SENT,{recursive:true}); }catch(e){}',
  'function post(body){ return new Promise(function(res,rej){ var base=String(CFG.endpoint); if(base.slice(-1)==="/")base=base.slice(0,-1);',
  '  var u=new URL(base+"/api/connectors/ingest"); var data=JSON.stringify(body);',
  '  var r=https.request({method:"POST",hostname:u.hostname,port:u.port||443,path:u.pathname,headers:{"Content-Type":"application/json","X-Bridge-Key":CFG.key,"Content-Length":Buffer.byteLength(data)}},function(x){ var b=""; x.on("data",function(c){b+=c;}); x.on("end",function(){ if(x.statusCode>=400)rej(new Error("HTTP "+x.statusCode+" "+b.slice(0,120))); else{ try{res(JSON.parse(b));}catch(e){res(b);} } }); }); r.on("error",rej); r.write(data); r.end(); }); }',
  'function heartbeat(){ (CFG.devices||[]).forEach(function(d){ post({bridge_id:d.bridge_id,heartbeat_only:true}).catch(function(e){ console.error("[hb]",d.bridge_id,e.message); }); }); }',
  'function drain(){ var files=[]; try{ files=fs.readdirSync(SPOOL).filter(function(f){return f.slice(-5)===".json";}); }catch(e){ return; }',
  '  files.forEach(function(f){ var fp=path.join(SPOOL,f), ev; try{ ev=JSON.parse(fs.readFileSync(fp,"utf8")); }catch(e){ return; }',
  '    var proof; if(ev.image){ try{ proof=fs.readFileSync(path.isAbsolute(ev.image)?ev.image:path.join(SPOOL,ev.image)).toString("base64"); }catch(e){} }',
  '    post({bridge_id:ev.bridge_id,sub_type:ev.sub_type,signal:ev.signal||"exception",value:ev.value,unit:ev.unit,device_id:ev.device_id,proof:proof,proof_name:ev.image?path.basename(ev.image):undefined})',
  '      .then(function(out){ console.log("[sent]",f,(out&&out.chit_id)||""); try{ fs.renameSync(fp,path.join(SENT,f)); }catch(e){} if(ev.image){ try{ fs.unlinkSync(path.isAbsolute(ev.image)?ev.image:path.join(SPOOL,ev.image)); }catch(e){} } })',
  '      .catch(function(e){ console.error("[retry]",f,e.message); }); });',
  '}',
  'console.log("[chitbridge] agent up · devices",(CFG.devices||[]).length,"· spool",SPOOL);',
  'heartbeat(); drain(); setInterval(function(){ heartbeat(); drain(); }, (CFG.heartbeat_sec||60)*1000);'
].join('\n'); }
function _buildInstaller(cfg){
  var ndev=(cfg.devices||[]).length, cfgJson=JSON.stringify(cfg,null,2), agent=_agentJs();
  var L=[];
  L.push('#!/usr/bin/env bash');
  L.push('set -e');
  L.push('echo "== Chit and Bridge IoT agent installer =="');
  L.push('if ! command -v node >/dev/null 2>&1; then');
  L.push('  echo "Installing Node.js...";');
  L.push('  (command -v apt-get >/dev/null 2>&1 && sudo apt-get update -y && sudo apt-get install -y nodejs) || { echo "Please install Node.js manually, then re-run."; exit 1; }');
  L.push('fi');
  L.push('DIR=/opt/chitbridge');
  L.push('sudo mkdir -p "$DIR/spool" "$DIR/sent"');
  L.push("sudo tee \"$DIR/config.json\" >/dev/null <<'CBCFG'");
  L.push(cfgJson);
  L.push('CBCFG');
  L.push("sudo tee \"$DIR/agent.js\" >/dev/null <<'CBAGENT'");
  L.push(agent);
  L.push('CBAGENT');
  L.push("sudo tee /etc/systemd/system/chitbridge.service >/dev/null <<'CBSVC'");
  L.push('[Unit]');
  L.push('Description=Chit and Bridge IoT agent');
  L.push('After=network-online.target');
  L.push('Wants=network-online.target');
  L.push('[Service]');
  L.push('ExecStart=/usr/bin/env node /opt/chitbridge/agent.js');
  L.push('Restart=always');
  L.push('RestartSec=5');
  L.push('[Install]');
  L.push('WantedBy=multi-user.target');
  L.push('CBSVC');
  L.push('sudo systemctl daemon-reload');
  L.push('sudo systemctl enable chitbridge >/dev/null 2>&1 || true');
  L.push('sudo systemctl restart chitbridge');
  L.push('echo ""');
  L.push('echo "Installed and running. Devices: '+ndev+'"');
  L.push('echo "Logs:  journalctl -u chitbridge -f"');
  L.push('echo "Spool: drop <event>.json (and image) into $DIR/spool to raise an exception"');
  return L.join('\n')+'\n';
}
function acCreatePackage(id){ acReissueGate(id, 'package'); }
// ── Reissue step-up (destructive): re-type the gateway name (the QUESTION) + a one-time code emailed to the ENTITY
//    (the PASSWORD). Only the entity or a manager delegate can reissue; the code always goes to the account email.
function acReissueGate(id, mode){ UI.acReissue={id:id, mode:mode||'package'};
  if(typeof modal!=='function'){ if(typeof toast==='function')toast('Cannot open the reissue dialog.'); return; }
  modal('<div style="padding:2px 2px"><div style="font-weight:800;font-size:16px;margin-bottom:4px">⚠ Reissue device key</div>'
    +'<div style="font-size:12.5px;color:#586069;line-height:1.5;margin-bottom:12px">This issues a <b>new key</b> — any device already running this gateway <b>stops</b> until you reflash it with the new installer. Only the entity or a manager may do this.</div>'
    +'<label class="fl">1 · Type the gateway\'s exact name</label><input class="inp" id="rg_name" placeholder="gateway name" style="width:100%;margin-bottom:12px">'
    +'<label class="fl">2 · One-time code (sent to the account email)</label><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px"><input class="inp" id="rg_otp" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="flex:1"><button class="composebtn" onclick="acReissueSendCode()">Send code</button></div>'
    +'<div id="rg_msg" style="font-size:11.5px;color:#2c5aa0;min-height:15px;margin-bottom:10px"></div>'
    +'<div style="display:flex;gap:10px"><button class="composebtn" style="flex:1" onclick="closeModal()">Cancel</button><button class="composebtn pri" style="flex:1" onclick="acReissueSubmit()">Reissue</button></div>'
    +'</div>', false);
}
async function acReissueSendCode(){ var m=document.getElementById('rg_msg'); if(m)m.textContent='Sending…';
  try{ var r=await api('connectorReissueCode',{body:{}});
    if(m) m.innerHTML='Code sent to <b>'+esc((r&&r.email)||'the account email')+'</b>.'+((r&&r.dev_otp)?(' <span style="color:#8a6d1e">Dev code <b>'+esc(r.dev_otp)+'</b></span>'):'');
  }catch(e){ if(m)m.textContent=(e&&e.message)||'Could not send the code.'; }
}
async function acReissueSubmit(){ var g=UI.acReissue||{}, id=g.id, mode=g.mode;
  var name=((document.getElementById('rg_name')||{}).value||'').trim(), otp=((document.getElementById('rg_otp')||{}).value||'').trim();
  var m=document.getElementById('rg_msg');
  if(!name){ if(m)m.textContent='Type the gateway name.'; return; }
  if(!/^[0-9]{6}$/.test(otp)){ if(m)m.textContent='Enter the 6-digit code.'; return; }
  if(m)m.textContent='Verifying…';
  try{
    var rk=await api('connectorRegen',{params:{actorId:id},body:{name:name,otp:otp}}); var key=rk&&rk.provision_key;
    if(!key){ if(m)m.textContent='No key issued.'; return; }
    closeModal();
    if(mode==='package'){
      var r=await api('connectorConns',{params:{actorId:id}});
      var devs=((r&&r.connections)||[]).filter(function(c){return c.enabled!==false;}).map(function(c){ var cf=c.conn_config||{}; return {bridge_id:c.bridge_id, ref:c.ref, folder:cf.folder||null, classes:cf.classes||null}; });
      _download('chitbridge-install.sh', _buildInstaller({ endpoint:'https://chitbridge-api-production.up.railway.app', key:key, heartbeat_sec:60, spool_dir:'/opt/chitbridge/spool', devices:devs }));
      UI.acFreshKey=null; if(typeof paintAcDetail==='function')paintAcDetail();   // key is INSIDE the installer — never shown raw
      if(typeof toast==='function')toast('Key reissued — installer downloaded (key is inside it). Reflash the Pi: sudo bash chitbridge-install.sh');
    } else {
      UI.acFreshKey=key; UI.acProvOpen=true; if(typeof paintAcDetail==='function')paintAcDetail();   // direct-device path: the raw key IS the deliverable, shown once
      if(typeof toast==='function')toast('New ActorKey issued — copy it now.');
    }
  }catch(e){ if(m)m.textContent=(e&&e.message)||'Reissue failed.'; }
}

/* self-register the Tier-2 renderer so the generic dispatcher (acOpenManage) finds it after this module lazy-loads */
if (typeof window !== 'undefined' && window.ACTOR_MANAGE) { window.ACTOR_MANAGE.iot = piCockpit; window.ACTOR_MANAGE.erp = piCockpit; }
