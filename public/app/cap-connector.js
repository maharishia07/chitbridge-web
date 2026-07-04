/* app/cap-connector.js — Connector / IoT capability (lazy; gated by the 'connector' entity capability).
 * L1->L2 living proof: a connector endpoint EMITS a Device Signal chit to a counterparty entity over the
 * governed rail (reusing the proven /chits/send path); the signal lands in the counterparty's Task inbox as
 * a sealed, co-held record. The emit is a manual form now = the ADAPTER SEAM; a real device (MQTT/HTTP/Modbus)
 * plugs into the same seam later without touching the rail. Loaded by ensureCap('connector') via CAP_OF. */

function connectorsScreen(){
  const log = (UI.connectorLog||[]);
  const logHtml = log.length ? log.map(function(s){
    return '<div style="display:flex;gap:8px;align-items:center;font-size:12.5px;padding:6px 0;border-bottom:1px dashed var(--line)">'
      +'<span style="color:#2f8f5b;flex:none;font-weight:700">▲ emitted</span>'
      +'<span><b>'+esc(s.signal)+'</b> = '+esc(String(s.value))+esc(s.unit||'')+' · device '+esc(s.device_id)+'</span>'
      +'<span style="margin-left:auto;color:var(--grey);font-size:11px">→ '+esc(s.to)+' · '+esc(s.at)+'</span></div>';
  }).join('') : '<div style="color:var(--grey);font-size:12.5px;padding:6px 0">No signals emitted yet this session.</div>';
  return '<div style="padding:14px;max-width:720px;margin:0 auto">'
    +'<div class="sec" style="font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:9px">🛰️ Connector / IoT</div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin-bottom:12px">A connector endpoint emits a <b>Device Signal</b> chit to a counterparty over the governed rail — it lands in their <b>Task</b> inbox as a sealed, co-held record. The emit is a manual form now (the adapter seam); a real device plugs into the same seam later.</div>'
    +'<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:12px">'
      +'<div class="sec" style="margin:0 0 8px">Emit a signal</div>'
      +'<label class="fl">Counterparty entity id</label><input class="inp" id="cx_to" placeholder="paste the receiving entity_id (uuid)" style="width:100%">'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
        +'<div style="flex:2;min-width:120px"><label class="fl">Device id</label><input class="inp" id="cx_dev" placeholder="edge-gw-01" style="width:100%"></div>'
        +'<div style="flex:2;min-width:120px"><label class="fl">Signal</label><input class="inp" id="cx_sig" placeholder="temperature" style="width:100%"></div>'
        +'<div style="flex:1;min-width:80px"><label class="fl">Value</label><input class="inp" id="cx_val" placeholder="42" style="width:100%"></div>'
        +'<div style="flex:1;min-width:64px"><label class="fl">Unit</label><input class="inp" id="cx_unit" placeholder="C" style="width:100%"></div>'
      +'</div>'
      +'<div class="err" id="cx_err" style="margin-top:6px"></div>'
      +'<div style="margin-top:10px"><button class="composebtn pri" onclick="emitSignal()">▲ Emit signal</button></div>'
    +'</div>'
    +'<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:14px">'
      +'<div class="sec" style="margin:0 0 4px">Emitted this session</div>'+logHtml
      +'<div style="font-size:11px;color:var(--grey);margin-top:8px">Received signals arrive in the counterparty\'s <b>Task</b> inbox (open it to log/ack). Auto-handle rules = a later rung.</div>'
    +'</div>'
  +'</div>';
}

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
