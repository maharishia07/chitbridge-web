/* app/cap-readiness.js — TRADE READINESS capability (lazy; loaded via ensureCap('readiness')).
 * The supplier's compliance: the documents its standards require (from its boilerplate), gathered vs pending,
 * rolling up to import-ready. Working these IS staying compliant. Backend: routes/governance.js /readiness +
 * /compliance (b90). readinessScreen() = a readiness ring + the clearances grouped by scope (standing / per-shipment). */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    readinessOwn:    {m:'GET',  p:'/api/governance/readiness',  ok:'y'},
    readinessGather: {m:'POST', p:'/api/governance/compliance', ok:'y'},
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
function _rdItem(it){
  var st = it.status, col, ic, lbl;
  if(st==='gathered'){ col='#2f8f5b'; ic='✓'; lbl='gathered'; }
  else if(st==='expiring'){ col='#c98a1a'; ic='!'; lbl='renew soon'; }
  else if(st==='expired'){ col='#c0453b'; ic='✕'; lbl='expired'; }
  else { col='#8a94a6'; ic='○'; lbl='to gather'; }
  var valid = it.valid_until ? '<span style="color:var(--grey)"> · valid to '+esc(String(it.valid_until).slice(0,10))+'</span>' : '';
  var act = (st==='gathered')
    ? '<span style="margin-left:auto;flex:0 0 auto;font-size:11px;color:'+col+';font-weight:700">'+lbl+'</span>'
    : '<button onclick="gatherReadiness(\''+esc(it.standard)+'\',\''+esc(it.doc)+'\')" style="margin-left:auto;flex:0 0 auto;font-size:12px;font-weight:700;border:1px solid '+(st==='pending'?'var(--line)':col)+';background:'+(st==='pending'?'#fff':col)+';color:'+(st==='pending'?'#2a2f38':'#fff')+';border-radius:8px;padding:6px 12px;cursor:pointer">'+(st==='pending'?'Gather':'Renew')+'</button>';
  return '<div style="display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:11px;background:#fff;padding:10px 13px;margin-bottom:8px">'
    +'<div style="width:23px;height:23px;border-radius:7px;display:grid;place-items:center;font-size:12px;font-weight:800;background:'+col+'22;color:'+col+';flex:0 0 auto">'+ic+'</div>'
    +'<div style="min-width:0"><div style="font-weight:650;font-size:13.5px">'+esc(it.title||it.doc)+'</div>'
      +'<div style="font-size:11.5px;color:var(--grey)">from <span class="mono" style="color:var(--blue)">'+esc(it.standard)+'</span>'+valid+'</div></div>'
    +act+'</div>';
}
function readinessScreen(){
  if(UI.readiness===undefined){ loadReadiness(); return (typeof loader==='function' ? loader('Loading trade readiness…') : 'Loading…'); }
  var rd = UI.readiness||{}, items = rd.items||[], s = rd.summary||{};
  if(rd.error) return (typeof emptyState==='function' ? emptyState('⚠️','Could not load readiness', esc(rd.error)) : esc(rd.error));
  if(!items.length) return (typeof emptyState==='function' ? emptyState('🛡️','No standards yet','Adopt a boilerplate to inherit its standards, then gather the required clearances here.') : 'No standards yet.');
  var standing = items.filter(function(i){ return i.scope==='entity'; });
  var pership  = items.filter(function(i){ return i.scope!=='entity'; });
  var msg = s.ready ? 'Import-ready — every clearance is met.' : ((s.total-s.met)+' clearance'+((s.total-s.met)===1?'':'s')+' still to gather.');
  function sec(title, list){ if(!list.length) return '';
    var met = list.filter(function(i){ return i.status==='gathered'||i.status==='expiring'; }).length;
    return '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin:18px 2px 9px;display:flex"><span>'+title+'</span><span style="margin-left:auto;color:'+(met===list.length?'#2f8f5b':'var(--grey)')+'">'+met+' / '+list.length+'</span></div>'+list.map(_rdItem).join('');
  }
  return '<div style="max-width:720px;margin:0 auto;padding:16px 14px 40px">'
    +'<div style="display:flex;gap:16px;align-items:center;border:1px solid var(--line);border-radius:14px;background:#fff;padding:16px 18px">'
      +_rdRing(s.percent)
      +'<div><div style="font-weight:700;font-size:18px">Trade readiness</div>'
        +'<div style="font-size:13px;color:var(--grey);margin-top:3px">'+esc(msg)+' Working these <b>is</b> staying compliant — no separate certification chore.</div></div></div>'
    +sec('STANDING CERTIFICATIONS', standing)
    +sec('PER-SHIPMENT CLEARANCES', pership)
    +'<div style="font-size:11.5px;color:var(--grey);margin-top:20px;padding:11px 13px;background:#f7f8fb;border:1px solid var(--line);border-radius:10px">Each row is a clearance your standards require, cascaded from your boilerplate. Gather them all and a buyer viewing your product sees <b>verified confidence</b> — and the deal moves.</div>'
    +'</div>';
}
async function gatherReadiness(standard, doc){
  try{
    var far = new Date(Date.now()+730*86400000).toISOString().slice(0,10);   // demo validity; a real gather uploads the doc
    await api('readinessGather', {body:{standard_key:standard, doc_key:doc, evidence_ref:'app://'+doc, valid_until:far}});
    if(typeof toast==='function') toast('Clearance gathered.');
    UI.readiness = undefined; loadReadiness();
  }catch(e){ if(typeof toast==='function') toast((e&&e.message)||'Gather failed'); }
}
