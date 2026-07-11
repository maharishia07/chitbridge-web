/* app/cap-readiness.js — TRADE capability (lazy; ensureCap('readiness')). Two tabs:
 *  • My readiness  — the supplier side: the clearances your standards require, gathered vs pending, rolling up.
 *  • Check a supplier — the buyer side: a counterparty's shareable confidence PASSPORT (status only) → Create trade deal.
 * Backend: routes/governance.js /readiness(/:bridge_id) + /compliance (b90). */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    readinessOwn:    {m:'GET',  p:'/api/governance/readiness',             ok:'y'},
    readinessOf:     {m:'GET',  p:'/api/governance/readiness/:bridge_id',  ok:'y'},
    readinessGather: {m:'POST', p:'/api/governance/compliance',            ok:'y'},
    lanes:           {m:'GET',  p:'/api/governance/lanes',                 ok:'y'},
    readinessVerify: {m:'POST', p:'/api/governance/verify',               ok:'y'},
    instruments:     {m:'GET',  p:'/api/governance/instruments',           ok:'y'},
    journey:         {m:'GET',  p:'/api/governance/journey',               ok:'y'},
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
function _rungBadge(r){
  var map={verified:['#2f8f5b','Verified'],attested:['#0e7c74','Attested'],documented:['#c98a1a','Documented'],declared:['#8a94a6','Declared']};
  var x=map[r]; if(!x) return '';
  return '<span style="font-size:9px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;border-radius:5px;padding:2px 6px;background:'+x[0]+'22;color:'+x[0]+';margin-left:7px" title="trust rung">'+x[1]+'</span>';
}
// ── per-topic LIFECYCLE model (client-side) — each clearance is a process with states, an AI role + a partner option ──
var LIFE = {
  'iso-9001':{life:[['Implement QMS','done'],['Registrar audit','done'],['Certified','done'],['Surveillance','now'],['Recertify (3-yr)','next']],use:'Keep your QMS current — a surveillance audit holds the certificate.',ai:{lvl:'L3',gate:'sign recert',t:'AI tracks validity, assembles the surveillance evidence, flags the renewal window.'},partner:'Accredited ISO registrar'},
  'iso-14001':{life:[['Implement EMS','done'],['Registrar audit','now'],['Certified','next'],['Surveillance','next']],use:'Certify your environmental management system with an accredited registrar.',ai:{lvl:'L3',gate:'sign',t:'AI assembles the aspects register and audit evidence.'},partner:'Environmental registrar'},
  'reach':{life:[['Not started','now'],['Inventory substances','next'],['Register with ECHA','next'],['Safety dossier','next'],['Verified','next']],use:'Inventory each substance ≥1 t/yr and register it with ECHA.',ai:{lvl:'L3',gate:'authorise ECHA filing',t:'AI builds the inventory, drafts each registration + the safety dossier; you authorise the filing.'},partner:'EU Only-Representative'},
  'sds':{life:[['No sheet','done'],['Draft GHS','now'],['Attach to product','next'],['Travels with order','next']],use:'Attach a current GHS Safety Data Sheet to each order.',ai:{lvl:'L3',gate:'approve',t:'AI authors the GHS sheet from your formulation; you approve.'},partner:'Testing lab'},
  'tsca':{life:[['Not listed','now'],['File PMN / inventory','next'],['Listed','next']],use:'List substances on the US EPA TSCA inventory.',ai:{lvl:'L3',gate:'authorise',t:'AI prepares the inventory listing / PMN.'},partner:'US agent'},
  'bis':{life:[['Not certified','now'],['Apply','next'],['Certified (ISI mark)','next']],use:'Obtain BIS product certification (ISI mark).',ai:{lvl:'L2',gate:'submit',t:'AI prepares the BIS application.'},partner:'BIS consultant'},
  'exim-policy':{life:[['IEC obtained','now'],['Declaration filed','next'],['Cleared','next']],use:'Hold a valid IEC and complete the export declaration.',ai:{lvl:'L3',gate:'confirm',t:'AI verifies the IEC and prepares the export declaration.'},partner:'Customs broker (CHA)'}
};
function _life(std, status){ return LIFE[std] || {life:[['Pending',status==='pending'?'now':'done'],['Gathered',(status==='gathered'||status==='expiring')?'now':'next'],['Verified','next']],use:'Gather this clearance and keep it valid.',ai:{lvl:'L2',gate:'approve',t:'AI helps assemble and file the evidence; you approve.'},partner:null}; }
function _rdSub(t){ return '<div style="font-size:9.5px;font-weight:800;color:var(--grey);letter-spacing:.05em;text-transform:uppercase;margin:13px 0 6px">'+t+'</div>'; }
function _rdKv(k,v){ return '<div style="display:flex;gap:8px;padding:3px 0;font-size:12.5px"><span style="text-transform:uppercase;color:var(--grey);min-width:96px;font-size:10px;letter-spacing:.03em;padding-top:1px">'+k+'</span><span style="color:var(--ink);font-weight:500">'+esc(String(v))+'</span></div>'; }
function _rdExpand(it){
  var L=_life(it.standard, it.status);
  var steps=L.life.map(function(s){ var c=s[1]; var col=c==='done'?'#2f8f5b':(c==='now'?'var(--blue)':'#c9d2dc'); var ic=c==='done'?'✓':(c==='now'?'●':'○');
    return '<div style="display:flex;align-items:center;gap:9px;padding:4px 0;font-size:12.5px;color:'+(c==='next'?'var(--grey)':'var(--ink)')+'"><span style="width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:9px;font-weight:800;color:#fff;background:'+col+';flex:0 0 auto">'+ic+'</span>'+esc(s[0])+(c==='now'?' <span style="font-size:8.5px;color:var(--blue);font-weight:800;text-transform:uppercase;letter-spacing:.04em">you are here</span>':'')+'</div>';
  }).join('');
  var ev=_rdKv('Trust rung', it.rung||'—')+_rdKv('Status', it.status||'—')+(it.valid_until?_rdKv('Valid until', String(it.valid_until).slice(0,10)):'')+(it.evidence_ref&&/^[0-9a-f-]{20,}$/i.test(String(it.evidence_ref))?_rdKv('Evidence','document on the rail'):'');
  var ai=L.ai;
  var partner=L.partner?'<div style="margin-top:11px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:#faf6ee"><span style="font-size:8.5px;font-weight:800;color:#8a5e22;text-transform:uppercase;letter-spacing:.05em">Or hand it to a partner</span><div style="font-size:12.5px;margin-top:3px;font-weight:600">'+esc(L.partner)+'</div></div>':'';
  return '<div style="border-top:1px solid var(--line);padding:12px 15px 15px;background:#fbfcfe">'
    +_rdSub('Its lifecycle')+steps
    +_rdSub('Evidence · current version')+'<div>'+ev+'</div>'
    +_rdSub('How you use it')+'<div style="font-size:12.5px;color:var(--ink)">'+esc(L.use)+'</div>'
    +_rdSub('🤖 How AI enables it')+'<div style="font-size:12.5px;color:var(--grey)"><b style="color:var(--blue)">'+ai.lvl+'</b> · gate: '+esc(ai.gate)+' — '+esc(ai.t)+'</div>'
    +partner
    +'<div style="font-size:10.5px;color:var(--grey);margin-top:12px;border-left:3px solid #8a5e22;padding-left:9px;line-height:1.45">Versioned: when a buyer folds this into an order they keep a <b>snapshot</b> — later changes never alter their copy.</div>'
  +'</div>';
}
// ── TWO-PANE master-detail (list ↔ detail, like Task/Co-assist) — selecting preserves scroll (no jump) ──
function _rdSelect(std,doc){
  var sc=document.getElementById('rdscroll'); var top=sc?sc.scrollTop:0;
  UI.rdSel = std+'|'+doc;
  if(typeof renderApp==='function') renderApp();
  var sc2=document.getElementById('rdscroll'); if(sc2) sc2.scrollTop=top;   // keep position across the re-render
}
function _rdRow(it, selKey){
  var m=_rdStatus(it.status), k=it.standard+'|'+it.doc, on=(k===selKey);
  return '<div onclick="_rdSelect(\''+esc(it.standard)+'\',\''+esc(it.doc)+'\')" style="display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:9px;cursor:pointer;margin:2px 0;background:'+(on?'#eef3fb':'transparent')+';border:1px solid '+(on?'var(--blue)':'transparent')+'">'
    +'<div style="width:9px;height:9px;border-radius:50%;background:'+m.col+';flex:0 0 auto"></div>'
    +'<div style="min-width:0;flex:1"><div style="font-weight:'+(on?'700':'600')+';font-size:12.5px;color:'+(on?'var(--blue)':'var(--ink)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(it.title||it.doc)+'</div></div>'
    +'<div style="width:15px;height:15px;border-radius:5px;display:grid;place-items:center;font-size:9px;font-weight:800;background:'+m.col+'22;color:'+m.col+';flex:0 0 auto">'+m.ic+'</div></div>';
}
function _rdDetailPane(it){
  if(!it) return '<div style="color:var(--grey);font-size:13px;padding:24px;text-align:center">Select a clearance on the left to see its lifecycle.</div>';
  var m=_rdStatus(it.status), rung = it.rung ? _rungBadge(it.rung) : '';
  var idType = ({iec_code:'iec',gstn:'gstn',pan:'pan'})[it.doc];
  var verifyBtn = (idType && it.rung!=='verified')
    ? '<button onclick="verifyReadiness(\''+esc(it.standard)+'\',\''+esc(it.doc)+'\',\''+idType+'\')" style="font-size:12px;font-weight:700;border:1px solid #2f8f5b;background:#eaf6ee;color:#2f8f5b;border-radius:8px;padding:7px 12px;cursor:pointer">🔗 Verify</button>' : '';
  var actBtn = (it.status==='gathered')
    ? '<span style="font-size:12px;color:'+m.col+';font-weight:700">'+m.lbl+'</span>'
    : '<button onclick="gatherReadiness(\''+esc(it.standard)+'\',\''+esc(it.doc)+'\')" style="font-size:12px;font-weight:700;border:1px solid '+(it.status==='pending'?'var(--line)':m.col)+';background:'+(it.status==='pending'?'#fff':m.col)+';color:'+(it.status==='pending'?'#2a2f38':'#fff')+';border-radius:8px;padding:7px 13px;cursor:pointer">'+(it.status==='pending'?'Gather':'Renew')+'</button>';
  return '<div style="padding:14px 16px 0"><div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px">'+esc(it.title||it.doc)+rung+'</div><div style="font-size:11.5px;color:var(--grey);margin-top:2px">from <span class="mono" style="color:var(--blue)">'+esc(it.standard)+'</span></div></div><div style="flex:0 0 auto;display:flex;gap:6px;align-items:center">'+verifyBtn+actBtn+'</div></div></div>'
    + _rdExpand(it);
}
// ── COMMERCIAL COVER (live /instruments) — the invariant spine beneath the industry-variable compliance ──
async function loadCommerce(){
  try{ UI.commerce = await api('instruments', {query:{incoterm:'CIF', cross_border:1}}); }
  catch(e){ UI.commerce = {error:(e&&e.message)||'x'}; }
  UI.commerceLoading=false; if(typeof renderApp==='function') renderApp();
}
async function loadJourney(){
  try{ UI.journey = await api('journey', {query:{incoterm:'CIF', cross_border:1}}); }
  catch(e){ UI.journey = {error:(e&&e.message)||'x'}; }
  UI.journeyLoading=false; if(typeof renderApp==='function') renderApp();
}
function _frmBadge(c){
  var map={market:['#2857b8','market'],credit:['#8a5e22','credit'],liquidity:['#0e7c74','liquidity'],operational:['#7a4fb0','operational']};
  var x=map[c]||['#8a94a6',String(c||'—')];
  return '<span style="font-size:9px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;border-radius:5px;padding:2px 6px;background:'+x[0]+'1e;color:'+x[0]+'">FRM · '+x[1]+'</span>';
}
function _rdCommerce(){
  if(UI.commerce===undefined){ if(!UI.commerceLoading){ UI.commerceLoading=true; loadCommerce(); } return ''; }
  if(UI.commerce.error || !UI.commerce.cluster) return '';
  var rows = UI.commerce.cluster.map(function(g){
    var names = (g.instruments||[]).map(function(i){ return esc(i.name); }).join(' · ');
    var onrail = g.covered_onrail ? '<span style="font-size:10px;color:#2f8f5b;font-weight:800;margin-left:6px">● on rail</span>' : '';
    return '<div style="border:1px solid var(--line);border-radius:10px;background:#fff;padding:10px 12px;margin-bottom:7px">'
      +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:650;font-size:13px">'+esc(g.label)+'</span>'+_frmBadge(g.frm_class)+onrail+'</div>'
      +'<div style="font-size:11.5px;color:var(--grey);margin-top:4px">'+names+'</div></div>';
  }).join('');
  return '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin:24px 2px 6px">COMMERCIAL COVER · the invariant spine (FRM)</div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin:0 2px 10px">Same in every industry — only the compliance above changes with the goods. Cover by risk:</div>'
    +rows;
}
function _rdJourney(){
  if(UI.journey===undefined){ if(!UI.journeyLoading){ UI.journeyLoading=true; loadJourney(); } return ''; }
  if(UI.journey.error || !UI.journey.chain) return '';
  var chips = UI.journey.chain.map(function(s){
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;border:1px solid var(--line);border-radius:999px;padding:5px 10px;background:#fff;white-space:nowrap">'
      +esc(s.activity)+(s.partner_type?'<span style="color:var(--blue);font-weight:700">· '+esc(s.partner_type)+'</span>':'')+'</span>';
  }).join('');
  return '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin:24px 2px 9px">END-TO-END SETTLEMENT CHAIN</div>'
    +'<div style="display:flex;gap:7px;flex-wrap:wrap">'+chips+'</div>';
}
// ── MY READINESS (supplier) — spin the globe: readiness resolved per destination ──
async function loadLanes(){
  try{ UI.laneMatrix = await api('lanes', {query:{vertical:'paint', origin:UI.laneOrigin||'IN'}}); }
  catch(e){ UI.laneMatrix = {error:(e&&e.message)||'Could not load', lanes:[]}; }
  if(UI.laneMatrix && UI.laneMatrix.lanes && UI.laneMatrix.lanes.length){
    if(!UI.laneDest || !UI.laneMatrix.lanes.some(function(l){return l.dest_key===UI.laneDest;})) UI.laneDest = UI.laneMatrix.lanes[0].dest_key;
    loadLaneReadiness(UI.laneDest);
  }
  if(typeof renderApp==='function') renderApp();
}
async function loadLaneReadiness(dest){
  UI.laneRd = undefined;
  try{ UI.laneRd = await api('readinessOwn', {query:{destination:dest, vertical:'paint', origin:UI.laneOrigin||'IN'}}); }
  catch(e){ UI.laneRd = {error:(e&&e.message)||'Could not load'}; }
  if(typeof renderApp==='function') renderApp();
}
function setLaneDest(dest){ UI.laneDest=dest; UI.laneRd=undefined; if(typeof renderApp==='function')renderApp(); loadLaneReadiness(dest); }
function setLaneOrigin(o){ UI.laneOrigin=o; UI.laneMatrix=undefined; UI.laneRd=undefined; if(typeof renderApp==='function')renderApp(); loadLanes(); }
function _rdOriginSel(){
  var o = UI.laneOrigin||'IN', opts = [['IN','India'],['EU','European Union'],['US','United States'],['GULF','Gulf (GCC)']];
  return '<span style="font-size:12px;color:var(--grey)">Home country: </span><select onchange="setLaneOrigin(this.value)" style="font-size:12.5px;font-weight:700;border:1px solid var(--line);border-radius:8px;padding:5px 8px;background:#fff">'
    + opts.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===o?' selected':'')+'>'+x[1]+'</option>'; }).join('') + '</select>';
}
function _rdTiles(){
  var m=UI.laneMatrix; if(!m||!m.lanes) return '';
  return '<div style="display:flex;gap:9px;flex-wrap:wrap;margin:12px 0 2px">'+m.lanes.map(function(l){
    var c=l.percent>=100?'#2f8f5b':(l.percent>=80?'#c98a1a':'#c0453b'), on=l.dest_key===UI.laneDest;
    return '<div onclick="setLaneDest(\''+l.dest_key+'\')" style="flex:1 1 128px;min-width:118px;cursor:pointer;border:1px solid '+(on?'var(--blue)':'var(--line)')+';box-shadow:'+(on?'0 0 0 2px #eef3fb':'none')+';border-radius:12px;background:#fff;padding:11px 10px;text-align:center">'
      +'<div style="font-size:12px;font-weight:700">'+esc(l.dest_name)+'</div>'
      +'<div style="width:38px;height:38px;border-radius:50%;margin:7px auto 0;background:conic-gradient('+c+' '+l.percent+'%,var(--line) 0);display:grid;place-items:center;position:relative"><div style="position:absolute;inset:5px;border-radius:50%;background:#fff"></div><b style="position:relative;font-size:11px;color:'+c+'">'+l.percent+'%</b></div>'
      +'<div style="font-size:10px;font-weight:700;margin-top:5px;color:'+c+'">'+(l.ready?'✓ ready':'◐ '+l.gaps.length+' gap'+(l.gaps.length===1?'':'s'))+'</div></div>';
  }).join('')+'</div>';
}
function _rdMine(){
  if(UI.laneMatrix===undefined){ loadLanes(); return (typeof loader==='function'?loader('Resolving your markets…'):'Loading…'); }
  if(UI.laneMatrix.error) return (typeof emptyState==='function'?emptyState('⚠️','Could not load', esc(UI.laneMatrix.error)):esc(UI.laneMatrix.error));
  var head = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px">'+_rdOriginSel()+'<span style="font-size:11.5px;color:var(--grey);margin-left:auto">Readiness varies by where you ship →</span></div>'+_rdTiles();
  var rd = UI.laneRd;
  if(rd===undefined) return head+(typeof loader==='function'?loader('…'):'');
  if(rd.error) return head+(typeof emptyState==='function'?emptyState('⚠️','Could not load', esc(rd.error)):'');
  var items=(rd.clearances)||[], s=(rd.summary)||{};
  var standing = items.filter(function(i){return i.scope==='entity';});
  var pership  = items.filter(function(i){return i.scope!=='entity';});
  var msg = s.ready ? ('Import-ready for '+esc(rd.dest_name)+' — every clearance met.') : ((s.total-s.met)+' clearance'+((s.total-s.met)===1?'':'s')+' to gather for '+esc(rd.dest_name)+'.');
  // two-pane master-detail (left = the clearances, right = the selected one's lifecycle)
  var all = standing.concat(pership);
  if(!UI.rdSel || !all.some(function(i){return i.standard+'|'+i.doc===UI.rdSel;})) UI.rdSel = all.length ? (all[0].standard+'|'+all[0].doc) : null;
  var sel = all.filter(function(i){return i.standard+'|'+i.doc===UI.rdSel;})[0];
  var grpHdr=function(t){return '<div style="font-size:9.5px;font-weight:800;color:var(--grey);letter-spacing:.05em;padding:9px 8px 4px">'+t+'</div>';};
  var left = (standing.length?grpHdr('STANDING CERTIFICATIONS')+standing.map(function(i){return _rdRow(i,UI.rdSel);}).join(''):'')
           + (pership.length?grpHdr('PER-SHIPMENT CLEARANCES')+pership.map(function(i){return _rdRow(i,UI.rdSel);}).join(''):'');
  var twopane = '<div style="display:flex;gap:13px;flex-wrap:wrap;align-items:flex-start;margin-top:14px">'
    +'<div style="flex:1 1 240px;min-width:220px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:5px 6px">'+left+'</div>'
    +'<div style="flex:2 1 330px;min-width:290px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden">'+_rdDetailPane(sel)+'</div></div>';
  return head
    +'<div style="display:flex;gap:16px;align-items:center;border:1px solid var(--line);border-radius:14px;background:#fff;padding:15px 17px;margin-top:14px">'
      +_rdRing(s.percent)
      +'<div><div style="font-weight:700;font-size:16px">Readiness for '+esc(rd.dest_name||'')+'</div>'
        +'<div style="font-size:12.5px;color:var(--grey);margin-top:3px">'+msg+' Pick a clearance to see its <b>lifecycle</b>.</div></div></div>'
    +twopane
    +_rdCommerce()
    +_rdJourney()
    +'<div style="font-size:11.5px;color:var(--grey);margin-top:20px;padding:11px 13px;background:#f7f8fb;border:1px solid var(--line);border-radius:10px">Requirements are <b>derived per lane</b> (home + destination) — nothing enumerated. Gather what you can; each gap carries guidance to meet the rest.</div>';
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
  // scroll container (matches the app's standard screen wrapper) — #mainbody is a flex column, so flex:1+overflow-y:auto scrolls.
  return '<div id="rdscroll" style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch"><div style="max-width:980px;margin:0 auto;padding:12px 14px 40px">'+_rdTabs()+content+'</div></div>';
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
function verifyReadiness(standard, doc, id_type){
  UI.rdVerify = { standard:standard, doc:doc, id_type:id_type };
  var inS='width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin:5px 0 13px;box-sizing:border-box';
  var body = '<div class="mbody" style="padding:16px 18px">'
    +'<div style="font-size:12.5px;color:var(--grey);margin-bottom:12px">Check your <b>'+id_type.toUpperCase()+'</b>. When a registry is connected this confirms it against the source of truth — the top <b>verified</b> rung. Until then it validates the format and records a <b>declared</b> claim (never a false “verified”).</div>'
    +'<label style="font-size:11px;font-weight:700;color:var(--grey)">'+id_type.toUpperCase()+' number</label>'
    +'<input id="vf_id" placeholder="'+(id_type==='iec'?'e.g. AAACR1234B':id_type.toUpperCase()+' number')+'" style="'+inS+'">'
    +'<div id="vf_err" style="color:#c0453b;font-size:12px;margin-bottom:8px"></div>'
    +'<button id="vf_btn" onclick="submitVerify()" style="width:100%;background:#2f8f5b;color:#fff;border:0;border-radius:9px;padding:11px;font-weight:700;cursor:pointer">🔗 Verify ID</button>'
    +'</div>';
  if(typeof modal==='function') modal('<div class="mhd"><div class="t">🔗 Verify registry ID</div></div>'+body);
}
async function submitVerify(){
  var g=UI.rdVerify||{}; if(!g.standard) return;
  var id=((document.getElementById('vf_id')||{}).value||'').trim();
  var btn=document.getElementById('vf_btn'), err=document.getElementById('vf_err');
  if(err) err.textContent=''; if(btn){ btn.disabled=true; btn.textContent='Verifying…'; }
  try{
    var far=new Date(Date.now()+730*86400000).toISOString().slice(0,10);
    var res = await api('readinessVerify', {body:{standard_key:g.standard, doc_key:g.doc, id_type:g.id_type, id_value:id, valid_until:far}});
    if(typeof closeModal==='function') closeModal();
    var vm = res && res.verdict && res.verdict.method;
    if(typeof toast==='function') toast(vm==='registry' ? 'Verified against the registry ✓' : 'Format valid — recorded as a declared claim');
    UI.laneMatrix=undefined; UI.laneRd=undefined; loadLanes();
  }catch(e){ if(btn){ btn.disabled=false; btn.textContent='🔗 Verify ID'; } if(err) err.textContent=(e&&e.message)||'Verification failed'; }
}
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
    UI.laneMatrix = undefined; UI.laneRd = undefined; loadLanes();
  }catch(e){
    if(btn){ btn.disabled=false; btn.textContent='Record clearance on the rail'; }
    if(err) err.textContent=(e&&e.message)||'Failed to record';
  }
}
