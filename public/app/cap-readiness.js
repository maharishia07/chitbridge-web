/* app/cap-readiness.js — TRADE capability (lazy; ensureCap('readiness')). Two tabs:
 *  • My readiness  — the supplier side: the clearances your standards require, gathered vs pending, rolling up.
 *  • Check a supplier — the buyer side: a counterparty's shareable confidence PASSPORT (status only) → Create trade deal.
 * Backend: routes/governance.js /readiness(/:bridge_id) + /compliance (b90). */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    readinessOwn:    {m:'GET',  p:'/api/governance/readiness',             ok:'y'},
    readinessOf:     {m:'GET',  p:'/api/governance/readiness/:bridge_id',  ok:'y'},
    readinessGather: {m:'POST', p:'/api/governance/compliance',            ok:'y'},
  });
}
async function loadReadiness(){
  try{ UI.readiness = await api('readinessOwn'); }
  catch(e){ UI.readiness = {items:[], summary:{}, error:(e&&e.message)||'Could not load'}; }
  if(typeof renderApp==='function') renderApp();
}
function _rdRing(pct){
  pct = Math.max(0, Math.min(100, pct||0));
  var col = pct>=100 ? '#2f8f5b' : (pct>=60 ? '#c98a1a' : '#c0453b');
  return '<div style="width:64px;height:64px;border-radius:50%;flex:0 0 auto;background:conic-gradient('+col+' '+pct+'%,var(--line) 0);display:grid;place-items:center;position:relative">'
    +'<div style="position:absolute;inset:7px;border-radius:50%;background:#fff"></div>'
    +'<b style="position:relative;font-size:15px;color:'+col+'">'+pct+'%</b></div>';
}
function _rdStatus(st){
  if(st==='gathered') return {col:'#2f8f5b',ic:'✓',lbl:'gathered'};
  if(st==='expiring') return {col:'#c98a1a',ic:'!',lbl:'renew soon'};
  if(st==='expired')  return {col:'#c0453b',ic:'✕',lbl:'expired'};
  return {col:'#8a94a6',ic:'○',lbl:'to gather'};
}
function _rdItem(it){
  var m=_rdStatus(it.status);
  var valid = it.valid_until ? '<span style="color:var(--grey)"> · valid to '+esc(String(it.valid_until).slice(0,10))+'</span>' : '';
  var act = (it.status==='gathered')
    ? '<span style="margin-left:auto;flex:0 0 auto;font-size:11px;color:'+m.col+';font-weight:700">'+m.lbl+'</span>'
    : '<button onclick="gatherReadiness(\''+esc(it.standard)+'\',\''+esc(it.doc)+'\')" style="margin-left:auto;flex:0 0 auto;font-size:12px;font-weight:700;border:1px solid '+(it.status==='pending'?'var(--line)':m.col)+';background:'+(it.status==='pending'?'#fff':m.col)+';color:'+(it.status==='pending'?'#2a2f38':'#fff')+';border-radius:8px;padding:6px 12px;cursor:pointer">'+(it.status==='pending'?'Gather':'Renew')+'</button>';
  return '<div style="display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:11px;background:#fff;padding:10px 13px;margin-bottom:8px">'
    +'<div style="width:23px;height:23px;border-radius:7px;display:grid;place-items:center;font-size:12px;font-weight:800;background:'+m.col+'22;color:'+m.col+';flex:0 0 auto">'+m.ic+'</div>'
    +'<div style="min-width:0"><div style="font-weight:650;font-size:13.5px">'+esc(it.title||it.doc)+'</div>'
      +'<div style="font-size:11.5px;color:var(--grey)">from <span class="mono" style="color:var(--blue)">'+esc(it.standard)+'</span>'+valid+'</div></div>'
    +act+'</div>';
}
function _rdSection(title, list){
  if(!list.length) return '';
  var met = list.filter(function(i){ return i.status==='gathered'||i.status==='expiring'; }).length;
  return '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin:18px 2px 9px;display:flex"><span>'+title+'</span><span style="margin-left:auto;color:'+(met===list.length?'#2f8f5b':'var(--grey)')+'">'+met+' / '+list.length+'</span></div>'+list.map(_rdItem).join('');
}
// ── MY READINESS (supplier) ──
function _rdMine(){
  if(UI.readiness===undefined){ loadReadiness(); return (typeof loader==='function' ? loader('Loading trade readiness…') : 'Loading…'); }
  var rd = UI.readiness||{}, items = rd.clearances||[], s = rd.summary||{};
  if(rd.error) return (typeof emptyState==='function' ? emptyState('⚠️','Could not load readiness', esc(rd.error)) : esc(rd.error));
  if(!items.length) return (typeof emptyState==='function' ? emptyState('🛡️','No standards yet','Adopt a boilerplate to inherit its standards, then gather the required clearances here.') : 'No standards yet.');
  var standing = items.filter(function(i){ return i.scope==='entity'; });
  var pership  = items.filter(function(i){ return i.scope!=='entity'; });
  var msg = s.ready ? 'Import-ready — every clearance is met.' : ((s.total-s.met)+' clearance'+((s.total-s.met)===1?'':'s')+' still to gather.');
  return '<div style="display:flex;gap:16px;align-items:center;border:1px solid var(--line);border-radius:14px;background:#fff;padding:16px 18px;margin-top:12px">'
      +_rdRing(s.percent)
      +'<div><div style="font-weight:700;font-size:18px">Trade readiness</div>'
        +'<div style="font-size:13px;color:var(--grey);margin-top:3px">'+esc(msg)+' Working these <b>is</b> staying compliant — no separate certification chore.</div></div></div>'
    +_rdSection('STANDING CERTIFICATIONS', standing)
    +_rdSection('PER-SHIPMENT CLEARANCES', pership)
    +'<div style="font-size:11.5px;color:var(--grey);margin-top:20px;padding:11px 13px;background:#f7f8fb;border:1px solid var(--line);border-radius:10px">Each row is a clearance your standards require, cascaded from your boilerplate. Gather them all and a buyer viewing your product sees <b>verified confidence</b>.</div>';
}
// ── CHECK A SUPPLIER (buyer) ──
function _rdPassport(d){
  if(d.loading) return (typeof loader==='function' ? loader('Checking…') : 'Checking…');
  if(d.error) return (typeof emptyState==='function' ? emptyState('⚠️','Not found', esc(d.error)) : esc(d.error));
  var sup = d.supplier||{}, items = d.clearances||[], s = d.summary||{}, ready = !!s.ready;
  var standing = items.filter(function(i){ return i.scope==='entity'; });
  var pership  = items.filter(function(i){ return i.scope!=='entity'; });
  function grid(list){ return list.map(function(i){ var m=_rdStatus(i.status); var ok=i.status==='gathered'||i.status==='expiring';
    return '<div style="display:flex;gap:9px;align-items:center;border:1px solid var(--line);border-radius:9px;background:#fff;padding:8px 11px;margin-bottom:6px"><div style="width:19px;height:19px;border-radius:50%;background:'+m.col+'22;color:'+m.col+';display:grid;place-items:center;font-size:11px;font-weight:800">'+m.ic+'</div><div style="font-size:12.5px;font-weight:600">'+esc(i.title||i.doc)+'</div>'+(i.valid_until?'<span style="margin-left:auto;font-size:10.5px;color:var(--grey)">valid to '+esc(String(i.valid_until).slice(0,10))+'</span>':'')+'</div>';
  }).join(''); }
  var verdict = '<div style="display:flex;gap:13px;align-items:center;border-radius:12px;padding:14px 16px;margin:10px 0;background:'+(ready?'#eaf6ee':'#fdf3e3')+';border:1px solid '+(ready?'#bfe3cb':'#f0dcae')+'">'
    +'<div style="width:40px;height:40px;border-radius:50%;background:'+(ready?'#2f8f5b':'#c98a1a')+';color:#fff;display:grid;place-items:center;font-size:20px;flex:0 0 auto">'+(ready?'✓':'!')+'</div>'
    +'<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14.5px;color:'+(ready?'#256e47':'#8a5f11')+'">'+(ready?'Import-ready — every clearance is met':((s.total-s.met)+' clearance(s) outstanding'))+'</div>'
      +'<div style="font-size:11.5px;color:var(--grey)">'+(s.met||0)+' / '+(s.total||0)+' met · verifiable on the rail</div></div>'
    +(ready?'<button onclick="dealFrom(\''+esc(sup.bridge_id||'')+'\')" style="background:#2f8f5b;color:#fff;border:0;border-radius:10px;padding:10px 15px;font-weight:700;cursor:pointer;flex:0 0 auto">Create trade deal →</button>':'')+'</div>';
  return '<div style="border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-top:10px">'
    +'<div style="padding:14px 17px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px"><div style="width:38px;height:38px;border-radius:11px;background:#ece3fb;color:#8a3ffc;display:grid;place-items:center;font-size:17px">🏭</div><div><div style="font-weight:700;font-size:15.5px">'+esc(sup.display_name||sup.bridge_id||'Supplier')+'</div><div style="font-size:11px;color:var(--grey)" class="mono">'+esc(sup.bridge_id||'')+' · verified on the rail</div></div></div>'
    +'<div style="padding:2px 16px 14px">'+verdict
      +(standing.length?'<div style="font-size:11px;font-weight:800;color:var(--grey);margin:14px 2px 8px">STANDING CERTIFICATIONS</div>'+grid(standing):'')
      +(pership.length?'<div style="font-size:11px;font-weight:800;color:var(--grey);margin:14px 2px 8px">PER-SHIPMENT CLEARANCES</div>'+grid(pership):'')
      +'<div style="font-size:11px;color:var(--grey);margin-top:12px">Every tick is a verifiable record on the rail — status only, no private documents exposed.</div>'
    +'</div></div>';
}
function _rdCheck(){
  var v = esc(UI.rdBridge||'');
  var inp = '<div style="display:flex;gap:8px;margin:14px 0 4px"><input id="rd_bridge" value="'+v+'" placeholder="Supplier bridge id (e.g. CB…)" onkeydown="if(event.key===\'Enter\')checkSupplier()" style="flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:9px;font-size:13px"><button onclick="checkSupplier()" style="background:var(--blue);color:#fff;border:0;border-radius:9px;padding:10px 16px;font-weight:700;cursor:pointer">Check</button></div>';
  var body = UI.rdCheck ? _rdPassport(UI.rdCheck) : '<div style="font-size:12.5px;color:var(--grey);padding:10px 2px">Enter a supplier’s bridge id to see their trade-confidence passport before you deal — every clearance, met or not, verifiable on the rail.</div>';
  return inp+body;
}
function _rdTabs(){
  var t = UI.rdTab||'mine';
  function tab(k,lbl){ return '<div onclick="UI.rdTab=\''+k+'\';if(typeof renderApp===\'function\')renderApp()" style="padding:9px 15px;font-size:13px;font-weight:700;cursor:pointer;border-bottom:2px solid '+(t===k?'var(--blue)':'transparent')+';color:'+(t===k?'var(--blue)':'var(--grey)')+'">'+lbl+'</div>'; }
  return '<div style="display:flex;gap:4px;border-bottom:1px solid var(--line)">'+tab('mine','My readiness')+tab('check','Check a supplier')+'</div>';
}
function readinessScreen(){
  var t = UI.rdTab||'mine';
  var content = (t==='check') ? _rdCheck() : _rdMine();
  return '<div style="max-width:720px;margin:0 auto;padding:12px 14px 40px">'+_rdTabs()+content+'</div>';
}
async function checkSupplier(){
  var el = document.getElementById('rd_bridge'); var b = el ? (el.value||'').trim() : '';
  if(!b){ if(typeof toast==='function') toast('Enter a supplier bridge id'); return; }
  UI.rdBridge = b; UI.rdCheck = {loading:true}; if(typeof renderApp==='function') renderApp();
  try{ UI.rdCheck = await api('readinessOf',{params:{bridge_id:b}}); }
  catch(e){ UI.rdCheck = {error:(e&&e.message)||'No such supplier'}; }
  if(typeof renderApp==='function') renderApp();
}
function dealFrom(bridge){ if(typeof toast==='function') toast('Confidence confirmed ✓ — start your order'); UI.nav='suppliers'; if(typeof renderApp==='function') renderApp(); }
function gatherReadiness(standard, doc){
  var it = ((UI.readiness&&UI.readiness.clearances)||[]).filter(function(c){ return c.standard===standard && c.doc===doc; })[0];
  UI.rdGather = { standard:standard, doc:doc, title:(it&&it.title)||doc };
  var far = new Date(Date.now()+365*86400000).toISOString().slice(0,10);
  var inS = 'width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin:5px 0 13px;box-sizing:border-box';
  var lbl = 'font-size:11px;font-weight:700;color:var(--grey)';
  var body = '<div class="mbody" style="padding:16px 18px">'
    +'<div style="font-size:12.5px;color:var(--grey);margin-bottom:13px">This records the clearance as a <b>chit on the rail</b> that carries your document — provenanced &amp; private. Buyers see only that it\'s met + its validity.</div>'
    +'<label style="'+lbl+'">Document (PDF/image · ≤ 6 MB)</label>'
    +'<input id="gd_file" type="file" style="'+inS+'">'
    +'<label style="'+lbl+'">Reference / number (optional)</label>'
    +'<input id="gd_ref" placeholder="e.g. certificate no." style="'+inS+'">'
    +'<label style="'+lbl+'">Valid until</label>'
    +'<input id="gd_valid" type="date" value="'+far+'" style="'+inS+'">'
    +'<div id="gd_err" style="color:#c0453b;font-size:12px;margin-bottom:8px"></div>'
    +'<button id="gd_btn" onclick="submitGather()" style="width:100%;background:var(--blue);color:#fff;border:0;border-radius:9px;padding:11px;font-weight:700;cursor:pointer">Record clearance on the rail</button>'
    +'</div>';
  if(typeof modal==='function') modal('<div class="mhd"><div class="t">🛡️ Gather clearance — '+esc(UI.rdGather.title)+'</div></div>'+body);
}
async function submitGather(){
  var g = UI.rdGather||{}; if(!g.standard) return;
  var fe = document.getElementById('gd_file'), file = fe && fe.files && fe.files[0];
  var ref = ((document.getElementById('gd_ref')||{}).value||'').trim();
  var valid = ((document.getElementById('gd_valid')||{}).value||'') || null;
  var btn = document.getElementById('gd_btn'), err = document.getElementById('gd_err');
  if(err) err.textContent=''; if(btn){ btn.disabled=true; btn.textContent='Recording…'; }
  try{
    // 1 · a SELF-CHIT is the evidence record on the rail (governed + provenanced like any chit)
    var subj = 'Clearance — ' + (g.title||g.doc) + (ref?(' ('+ref+')'):'');
    var r = await api('createChit', {body:{recipients:[{name:'self', role:'to'}], manual_subject:subj, subject:subj, purpose:'general', line_items:[]}});
    var chitId = r && r.chit_id;
    // 2 · attach the document to that chit (best-effort — a reference-only clearance is still valid)
    if(chitId && file && typeof attUpload==='function'){ try{ await attUpload(chitId, file); }catch(_){} }
    // 3 · record the clearance, pointing at its evidence chit
    await api('readinessGather', {body:{standard_key:g.standard, doc_key:g.doc, evidence_ref:(chitId||ref||'recorded'), valid_until:valid, status:'gathered'}});
    if(typeof closeModal==='function') closeModal();
    if(typeof toast==='function') toast(file?'Clearance recorded — document on the rail ✓':'Clearance recorded ✓');
    UI.readiness = undefined; loadReadiness();
  }catch(e){
    if(btn){ btn.disabled=false; btn.textContent='Record clearance on the rail'; }
    if(err) err.textContent=(e&&e.message)||'Failed to record';
  }
}
