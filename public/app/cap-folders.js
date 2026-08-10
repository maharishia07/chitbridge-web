/* app/cap-folders.js — FOLDERS capability (lazy; loaded via ensureCap('folders')).
 * A per-entity TREE for organising ANY chit (mailing-model). foldersScreen() = tree (left, recursive/nestable) +
 * the selected folder's chits with Current/Archive (right). Any chit is redirected via 📁 Move (sets folder_id on
 * this entity's copy). Backend: routes/folders.js + b63. Self-registers its endpoints. */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    foldersList:  {m:'GET',    p:'/api/folders',      ok:'y'},
    folderCreate: {m:'POST',   p:'/api/folders',      ok:'y'},
    folderRename: {m:'PATCH',  p:'/api/folders/:id',  ok:'y'},
    folderDelete: {m:'DELETE', p:'/api/folders/:id',  ok:'y'},
    folderMove:   {m:'POST',   p:'/api/folders/move', ok:'y'},
    folderChits:  {m:'GET',    p:'/api/folders/:id/chits', ok:'y'},
    // Metrics share select+measure with the counterparty scorecard, so a folder and a supplier can never
    // disagree about what "open" or "overdue" means.
    folderMetrics:     {m:'GET',    p:'/api/folders/:id/metrics',    ok:'y'},
    folderRules:       {m:'GET',    p:'/api/folders/:id/rules',      ok:'y'},
    folderRuleCreate:  {m:'POST',   p:'/api/folders/:id/rules',      ok:'y'},
    folderRuleUpdate:  {m:'PATCH',  p:'/api/folders/rules/:rule_id', ok:'y'},
    folderRuleDelete:  {m:'DELETE', p:'/api/folders/rules/:rule_id', ok:'y'},
    folderRulePreview: {m:'POST',   p:'/api/folders/rules/preview',  ok:'y'},   // what WOULD this rule have caught
    scorecardList:     {m:'GET',    p:'/api/relationships/scorecard', ok:'y'},
    scorecardOne:      {m:'GET',    p:'/api/relationships/scorecard/:entity_id', ok:'y'},
  });
}
async function loadFolders(){
  try{ var r=await api('foldersList'); UI.folders=(r&&r.folders)||[]; }catch(e){ UI.folders=[]; }
  if(typeof renderApp==='function') renderApp();
}
// recursive tree render — parent_id makes it nestable (same pattern as the Network tree)
function _folderTree(parentId, depth){
  var kids=(UI.folders||[]).filter(function(f){ return (f.parent_id||null)===(parentId||null); });
  return kids.map(function(f){ var sel=UI.folderSel===f.folder_id;
    return '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;padding-left:'+(8+depth*15)+'px;border-radius:8px;cursor:pointer;font-size:12.5px;'+(sel?'background:#eef4fc;color:#2c5aa0;font-weight:700':'color:#3a4048')+'" onclick="selectFolder(\''+f.folder_id+'\')">📁 '+esc(f.name)+'<span style="margin-left:auto;font-size:11px;color:var(--grey)">'+(f.count||0)+'</span></div>'+_folderTree(f.folder_id, depth+1);
  }).join('');
}
function foldersScreen(){
  if(UI.folders===undefined){ loadFolders(); return loader('Loading folders…'); }
  var tree=_folderTree(null,0)||'<div style="color:var(--grey);font-size:12px;padding:8px 6px">No folders yet — create one below.</div>';
  var right= UI.folderSel ? _folderView() : emptyState('📁','Pick a folder','Or create one, then file chits into it with 📁 Move.');
  return '<div style="display:flex;height:100%;min-height:0">'
    +'<div style="width:250px;border-right:1px solid var(--line);overflow:auto;padding:12px 8px;flex:0 0 auto">'
      +'<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;padding:2px 8px 8px">FOLDERS</div>'
      +tree
      +'<div style="font-size:12px;color:var(--blue);padding:9px 8px 4px;cursor:pointer" onclick="newFolder()">＋ New folder</div></div>'
    +'<div style="flex:1;overflow:auto;min-width:0" id="detailpane">'+right+'</div></div>';
}
function selectFolder(id){ UI.folderSel=id; UI.folderArch=false; UI.folderChits=undefined; if(typeof renderApp==='function')renderApp(); loadFolderChits(); }
function setFolderArch(a){ UI.folderArch=a; UI.folderChits=undefined; var dp=document.getElementById('detailpane'); if(dp)dp.innerHTML=_folderView(); loadFolderChits(); }
async function loadFolderChits(){
  var id=UI.folderSel; if(!id) return;
  try{ var r=await api('folderChits',{params:{id:id}, query:{archived:UI.folderArch?1:0}}); UI.folderChits=(r&&(r.chits||r.rows||r.data))||[]; }
  catch(e){ UI.folderChits=[]; }
  var dp=document.getElementById('detailpane'); if(dp)dp.innerHTML=_folderView();
}
function _folderView(){
  var f=(UI.folders||[]).find(function(x){return x.folder_id===UI.folderSel;})||{name:'Folder'};
  var arch=!!UI.folderArch;
  var tab=function(on,label,onclick){ return '<span onclick="'+onclick+'" style="cursor:pointer;font-size:12px;font-weight:700;padding:5px 13px;border-radius:16px;'+(on?'background:var(--blue);color:#fff':'border:1px solid var(--line);color:#586069')+'">'+label+'</span>'; };
  var head='<div style="padding:14px 18px;border-bottom:1px solid var(--line)"><div style="font-size:17px;font-weight:800">📁 '+esc(f.name)+'</div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin-top:2px">source = the sender / co-assist · destination = this folder</div>'
    +'<div style="display:flex;gap:6px;margin-top:11px;align-items:center">'+tab(!arch,'Current','setFolderArch(false)')+tab(arch,'Archive','setFolderArch(true)')
    +'<span style="margin-left:auto;font-size:11px;color:var(--blue);cursor:pointer" onclick="renameFolder(\''+UI.folderSel+'\')">Rename</span>'
    +'<span style="font-size:11px;color:#c0453b;cursor:pointer;margin-left:14px" onclick="deleteFolder(\''+UI.folderSel+'\')">Delete</span></div>'
    /* ⚠️ PANES, NOT A DENSER PANE. Rules and metrics are each a full job; crushed into the chit list they would be
       unreadable on a phone and barely readable anywhere. One job per tab — the shape the compose flow already uses. */
    +'<div style="display:flex;gap:6px;margin-top:10px">'+_ftab('chits','📄 Chits')+_ftab('metrics','📊 Metrics')+_ftab('rules','⚙️ Rules')+'</div></div>';
  var list;
  if(UI.folderChits===undefined) list='<div style="padding:16px;color:var(--grey);font-size:12.5px">Loading…</div>';
  else if(!UI.folderChits.length) list='<div style="padding:22px 18px;color:var(--grey);font-size:12.5px">Nothing '+(arch?'in Archive':'here')+' yet. From Task, use 📁 Move to file a chit into this folder.</div>';
  else list=UI.folderChits.map(function(c){
    var bj=c.business_json; if(typeof bj==='string'){ try{ bj=JSON.parse(bj); }catch(e){ bj=null; } }
    var isDev=!!(bj&&bj.kind==='device_signal');
    var subj=esc(c.manual_subject||c.auto_subject||'(no subject)');
    var raiser=esc(c.raiser_name||(isDev&&bj.device_id)||c.sender_entity_display_name||'—');
    var line2 = isDev ? ('🛰️ '+esc(bj.sub_type||bj.signal||'signal')+((bj.value!=null&&bj.value!=='')?(' = '+esc(String(bj.value))+esc(bj.unit||'')):'')+' · raised by <b>'+raiser+'</b>') : ('from '+esc(c.sender_entity_display_name||raiser));
    var when=(typeof fmtAt==='function'?esc(fmtAt(c.created_at)):'');
    var openA=(typeof openChit==='function')?('openChit(\''+c.chit_id+'\')'):'';
    return '<div style="display:flex;gap:11px;padding:12px 18px;border-bottom:1px solid #f0f2f4;cursor:pointer" onclick="'+openA+'"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13.5px">'+(isDev?'🛢️ ':'')+subj+'</div><div style="font-size:11.5px;color:var(--grey);margin-top:2px">'+line2+'</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto"><span style="font-size:11px;color:var(--grey)">'+when+'</span><span style="font-size:11px;color:var(--blue);border:1px solid #cfe0f4;background:#f2f7fd;border-radius:8px;padding:2px 8px" onclick="event.stopPropagation();moveChit(\''+c.chit_id+'\')">📁 Move</span></div></div>';
  }).join('');
  // The chit list is now ONE of three panes; metrics and rules render themselves.
  if(_FLD.tab==='metrics') return head+_folderMetricsPane();
  if(_FLD.tab==='rules')   return head+_folderRulesPane();
  return head+'<div style="overflow:auto">'+list+'</div>';
}
/* A tab in the folder header. Same pill shape as Current/Archive above it, so the two rows read as one control. */
function _ftab(k,label){
  var on=(_FLD.tab||'chits')===k;
  return '<span data-testid="folder-tab-'+k+'" onclick="setFolderTab(\''+k+'\')" style="cursor:pointer;font-size:12px;font-weight:700;padding:5px 13px;border-radius:16px;'
    +(on?'background:var(--ink);color:#fff':'border:1px solid var(--line);color:#586069')+'">'+label+'</span>';
}
async function newFolder(){
  var name=(typeof prompt==='function')?prompt('New folder name:'):''; if(!name||!name.trim())return;
  try{ await api('folderCreate',{body:{name:name.trim()}}); UI.folders=undefined; loadFolders(); if(typeof toast==='function')toast('Folder created.'); }
  catch(e){ if(typeof toast==='function')toast((e&&e.message)||'Create failed'); }
}
async function renameFolder(id){
  var f=(UI.folders||[]).find(function(x){return x.folder_id===id;})||{};
  var name=(typeof prompt==='function')?prompt('Rename folder:', f.name||''):''; if(!name||!name.trim())return;
  try{ await api('folderRename',{params:{id:id},body:{name:name.trim()}}); UI.folders=undefined; loadFolders(); }
  catch(e){ if(typeof toast==='function')toast((e&&e.message)||'Rename failed'); }
}
function deleteFolder(id){
  var run=async function(){ try{ await api('folderDelete',{params:{id:id}}); UI.folderSel=null; UI.folderChits=undefined; UI.folders=undefined; loadFolders(); }catch(e){ if(typeof toast==='function')toast((e&&e.message)||'Delete failed'); } };
  if(typeof confirmAsk==='function') confirmAsk('Delete folder','Delete this folder? Its chits are <b>not</b> deleted — they return to the main mailbox.','Delete',run,true);
  else if(window.confirm('Delete folder? Its chits return to the mailbox.')) run();
}
async function moveChit(chitId){
  if(UI.folders===undefined){ try{ var rr=await api('foldersList'); UI.folders=(rr&&rr.folders)||[]; }catch(e){ UI.folders=[]; } }   // self-load so Move works from Task, not just the Folders screen
  var opts=(UI.folders||[]).map(function(f){ return '<div style="padding:9px 12px;border-bottom:1px solid #f0f2f4;cursor:pointer" onclick="_doMove(\''+chitId+'\',\''+f.folder_id+'\')">📁 '+esc(f.name)+'</div>'; }).join('');
  var body='<div style="max-height:320px;overflow:auto">'+(opts||'<div style="padding:12px;color:var(--grey);font-size:12px">No folders yet — create one first.</div>')+'<div style="padding:10px 12px;color:#c0453b;cursor:pointer;border-top:1px solid var(--line)" onclick="_doMove(\''+chitId+'\',null)">↩ Remove from folder (back to mailbox)</div></div>';
  if(typeof modal==='function') modal('<div class="mhd"><div class="t">📁 Move to folder</div></div><div class="mbody" style="padding:0">'+body+'</div>');
}
async function _doMove(chitId, folderId){
  if(folderId==='null'||folderId==='')folderId=null;
  if(typeof closeModal==='function')closeModal();
  try{ await api('folderMove',{body:{chit_id:chitId, folder_id:folderId}}); if(typeof toast==='function')toast(folderId?'Filed into folder.':'Removed from folder.');
    UI.folders=undefined; UI.folderChits=undefined;
    if(UI.nav==='folders'){ loadFolders(); } else if(typeof loadList==='function'){ loadList(); }   // refresh Task (moved chit leaves the main list) or the folder view
  }catch(e){ if(typeof toast==='function')toast((e&&e.message)||'Move failed'); }
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *  FOLDER PANES — Chits · Metrics · Rules.  The folder is the place these live.
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Athi, 2026-08-10: *"bring the UX on the folder itself. in the sense, when we create a folder, inside we may have
 * to have options to set the rules and whatever it is."*
 *
 * ⚠️ PANES, NOT A DENSER PANE. The rules builder and the metrics strip are each a full job; crushing them into the
 * chit list would make the folder screen unreadable on a phone and barely readable anywhere else. Tabs across the
 * top, one job each — the same shape the compose step-flow uses, and the standing rule here.
 */
var _FLD = { tab: 'chits', metrics: null, rules: null, rulesNote: null, busy: false, err: null, draft: null, preview: null };

function setFolderTab(t){
  _FLD.tab = t; _FLD.err = null;
  var dp = document.getElementById('detailpane'); if (dp) dp.innerHTML = _folderView();
  if (t === 'metrics' && !_FLD.metrics) loadFolderMetrics();
  if (t === 'rules'   && !_FLD.rules)   loadFolderRules();
}
function _fldPaint(){ var dp = document.getElementById('detailpane'); if (dp) dp.innerHTML = _folderView(); }

async function loadFolderMetrics(){
  _FLD.busy = true; _fldPaint();
  try { _FLD.metrics = await api('folderMetrics', { params: { id: UI.folderSel } }); }
  catch (e) { _FLD.err = (e && e.message) || 'Could not read the metrics.'; }
  _FLD.busy = false; _fldPaint();
}
async function loadFolderRules(){
  _FLD.busy = true; _fldPaint();
  try {
    var r = await api('folderRules', { params: { id: UI.folderSel } });
    _FLD.rules = (r && r.rules) || [];
    /* A rule surface that cannot store anything must SAY so rather than accept a rule it will lose. */
    _FLD.rulesNote = (r && r.migrated === false) ? 'Folder rules are not migrated on this environment (b132). You can still PREVIEW a rule — nothing will save.' : null;
  } catch (e) { _FLD.err = (e && e.message) || 'Could not read the rules.'; _FLD.rules = []; }
  _FLD.busy = false; _fldPaint();
}

/* ── metrics ──────────────────────────────────────────────────────────────────────────────────────────────────── */
function _mBox(label, value, hint, tone){
  var col = tone === 'bad' ? '#c0453b' : tone === 'warn' ? '#8a5a1e' : 'var(--ink)';
  return '<div style="flex:1;min-width:104px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff">'
    + '<div style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey)">' + esc(label) + '</div>'
    + '<div style="font-size:19px;font-weight:800;margin-top:3px;color:' + col + '">' + esc(String(value)) + '</div>'
    + (hint ? '<div style="font-size:10.5px;color:var(--grey);margin-top:2px">' + esc(hint) + '</div>' : '') + '</div>';
}
function _folderMetricsPane(){
  if (_FLD.busy && !_FLD.metrics) return '<div style="padding:18px;color:var(--grey);font-size:12.5px"><span class="spin"></span> measuring…</div>';
  var m = _FLD.metrics; if (!m) return '<div style="padding:18px;color:var(--grey);font-size:12.5px">No metrics yet.</div>';
  var c = m.clock || {}, d = m.disputes || {}, mo = m.money || {};
  var dash = function(v, suffix){ return (v === null || v === undefined) ? '—' : (v + (suffix || '')); };

  var money = (mo.by_currency || []).length
    ? (mo.by_currency || []).map(function(b){ return '<span style="display:inline-block;border:1px solid var(--line);border-radius:8px;padding:3px 9px;margin:0 6px 6px 0;font-size:12px"><b>' + esc(b.currency) + '</b> ' + esc(String(b.total)) + ' <span style="color:var(--grey)">· ' + b.chits + ' chit' + (b.chits === 1 ? '' : 's') + '</span></span>'; }).join('')
    : '<span style="font-size:12px;color:var(--grey)">nothing with an agreed value</span>';
  /* ⚠️ NEVER ONE TOTAL ACROSS CURRENCIES, and the reason is said on screen rather than left as a design note. */
  var moneyNote = (mo.mixed ? '<div style="font-size:11px;color:#8a5a1e;margin-top:2px">⚠️ More than one currency — these are <b>not</b> added together. A single total across currencies is a number that means nothing.</div>' : '')
    + (((mo.excluded || {}).awaiting_agreement) ? '<div style="font-size:11px;color:var(--grey);margin-top:2px">' + mo.excluded.awaiting_agreement + ' chit(s) have no agreed value yet and are excluded — they are not counted as zero.</div>' : '');

  return '<div style="padding:14px 18px">'
    + '<div style="display:flex;gap:9px;flex-wrap:wrap">'
    + _mBox('In this folder', m.count, (m.open || 0) + ' open · ' + (m.closed || 0) + ' closed')
    + _mBox('Unread', m.unread, m.unread ? 'nobody has opened these' : 'all seen', m.unread ? 'warn' : null)
    + _mBox('Overdue', m.overdue, 'open for ' + m.overdue_days + '+ days', m.overdue ? 'bad' : null)
    + _mBox('Oldest', dash(c.oldest_age_days, 'd'), 'the one nobody is working', (c.oldest_age_days > (m.overdue_days || 7) * 3) ? 'warn' : null)
    + '</div>'
    /* ⚠️ RESPONSE and RESOLUTION side by side, never merged. Together they show "we answer fast and finish never",
       which is the commonest way a team looks fine and is not. */
    + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:9px">'
    + _mBox('Typical age', dash(c.median_age_days, 'd'), 'median, not average')
    + _mBox('First touch', dash(c.median_first_touch_days, 'd'), 'time to being read')
    + _mBox('To close', dash(c.median_to_close_days, 'd'), 'time to finished')
    + _mBox('Disputed', dash(d.rate_pct, '%'), (d.open || 0) + ' open now', (d.open ? 'bad' : null))
    + '</div>'
    + '<div style="margin-top:14px"><div style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">Value</div>'
    + money + moneyNote + '</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:14px;line-height:1.5">A dash means <b>nothing to measure</b>, which is not the same as zero. '
    + '“Overdue” is <b>your</b> setting — change it in Settings → Policy flags, and every folder and scorecard follows.</div>'
    + '</div>';
}

/* ── rules ────────────────────────────────────────────────────────────────────────────────────────────────────── */
var _RULE_HELP = {
  from: 'counterparty name contains', subject: 'subject contains', text: 'anywhere: subject, party, or the message',
  purpose: 'order · invoice · receipt · inquiry · delivery_note · general', direction: 'sent · received',
  status: 'current status', channel: 'whatsapp · email · sms · web',
  min_amount: 'value at least', max_amount: 'value at most',
  has_dispute: 'true / false', unread: 'true / false', older_than_days: 'older than N days',
};
function ruleDraftNew(){ _FLD.draft = { name: '', term: 'from', val: '', enabled: true }; _FLD.preview = null; _fldPaint(); }
function ruleDraftCancel(){ _FLD.draft = null; _FLD.preview = null; _fldPaint(); }
function ruleDraftSet(k, v){ _FLD.draft = _FLD.draft || {}; _FLD.draft[k] = v; if (k !== 'name') _FLD.preview = null; }
function _draftWhen(){
  var d = _FLD.draft || {}; var w = {};
  if (!d.term || !String(d.val).trim()) return null;
  var t = d.term, v = String(d.val).trim();
  if (t === 'min_amount' || t === 'max_amount' || t === 'older_than_days') w[t] = Number(v);
  else if (t === 'has_dispute' || t === 'unread') w[t] = (v === 'true' || v === '1' || v === 'yes');
  else w[t] = v;
  return w;
}
/**
 * ⚠️ PREVIEW BEFORE SAVE, AND IT IS THE POINT OF THIS SCREEN. A rule is a promise about the future written by
 * someone who cannot see it. Running it against chits that already exist turns "I think this catches Ramesh's
 * invoices" into a list you can read before committing to it.
 */
async function rulePreview(){
  var w = _draftWhen(); if (!w) { _FLD.err = 'Fill in the value first.'; _fldPaint(); return; }
  _FLD.busy = true; _FLD.err = null; _fldPaint();
  try { _FLD.preview = await api('folderRulePreview', { body: { when: w } }); }
  catch (e) { _FLD.err = (e && e.message) || 'Could not preview.'; }
  _FLD.busy = false; _fldPaint();
}
async function ruleSave(){
  var w = _draftWhen(); if (!w) { _FLD.err = 'Fill in the value first.'; _fldPaint(); return; }
  _FLD.busy = true; _FLD.err = null; _fldPaint();
  try {
    await api('folderRuleCreate', { params: { id: UI.folderSel }, body: { name: (_FLD.draft || {}).name || '', when: w } });
    _FLD.draft = null; _FLD.preview = null; _FLD.rules = null;
    await loadFolderRules();
    if (typeof toast === 'function') toast('Rule saved — it files new arrivals from now on');
  } catch (e) { _FLD.err = (e && e.message) || 'Could not save the rule.'; _FLD.busy = false; _fldPaint(); }
}
async function ruleToggle(id, on){
  try { await api('folderRuleUpdate', { params: { rule_id: id }, body: { enabled: !!on } }); _FLD.rules = null; await loadFolderRules(); }
  catch (e) { _FLD.err = (e && e.message) || 'Could not change that.'; _fldPaint(); }
}
async function ruleDelete(id){
  if (!confirm('Delete this rule?\n\nChits already filed stay where they are — a rule only decides what happens next.')) return;
  try { await api('folderRuleDelete', { params: { rule_id: id } }); _FLD.rules = null; await loadFolderRules(); }
  catch (e) { _FLD.err = (e && e.message) || 'Could not delete it.'; _fldPaint(); }
}

function _ruleRow(r){
  var terms = Object.keys(r.when || {}).map(function(k){ return '<span style="font-family:ui-monospace,Menlo,monospace;font-size:11.5px">' + esc(k) + '</span> <b>' + esc(String(r.when[k])) + '</b>'; }).join(' <span style="color:var(--grey)">and</span> ');
  return '<div style="border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-bottom:8px;background:#fff">'
    + '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-testid="rule-enabled" ' + (r.enabled ? 'checked' : '') + ' onchange="ruleToggle(\'' + esc(r.rule_id) + '\',this.checked)"><span style="font-weight:700;font-size:13px">' + esc(r.name || 'Rule') + '</span></label>'
    + '<span style="margin-left:auto;font-size:11px;color:#c0453b;cursor:pointer" onclick="ruleDelete(\'' + esc(r.rule_id) + '\')">Delete</span></div>'
    + '<div style="font-size:12.5px;margin-top:6px">When ' + terms + ' → file here</div>'
    /* Observability: a rule that quietly stopped matching should be visible, not assumed to be working. */
    + '<div style="font-size:11px;color:var(--grey);margin-top:4px">'
    + (r.match_count ? ('filed ' + r.match_count + ' chit' + (r.match_count == 1 ? '' : 's') + (r.last_matched_at ? ' · last ' + esc(String(r.last_matched_at).slice(0, 10)) : '')) : 'has not matched anything yet')
    + '</div></div>';
}

function _folderRulesPane(){
  if (_FLD.busy && _FLD.rules === null) return '<div style="padding:18px;color:var(--grey);font-size:12.5px"><span class="spin"></span> reading rules…</div>';
  var rules = _FLD.rules || [];
  var d = _FLD.draft;
  var out = '<div style="padding:14px 18px">';

  out += '<div style="font-size:11.5px;color:var(--grey);line-height:1.55;margin-bottom:10px">'
    + 'A rule files <b>new arrivals</b> into this folder automatically. '
    + '⚠️ It only <b>files</b> — it never changes a chit’s status, value or counterparty. Filing is a view on your own copy; anything more belongs to a person.</div>';

  if (_FLD.rulesNote) out += '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:11.5px;color:#6b5a36;margin-bottom:9px">' + esc(_FLD.rulesNote) + '</div>';
  if (_FLD.err) out += '<div style="color:#c0453b;font-size:12px;margin-bottom:8px">' + esc(_FLD.err) + '</div>';

  out += rules.length ? rules.map(_ruleRow).join('') : '<div style="color:var(--grey);font-size:12.5px;padding:6px 0 12px">No rules yet. Everything arrives unfiled until you add one.</div>';

  if (!d) {
    out += '<button class="composebtn" data-testid="rule-new" onclick="ruleDraftNew()">+ Add a rule</button>';
  } else {
    var opts = Object.keys(_RULE_HELP).map(function(k){ return '<option value="' + k + '"' + (d.term === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('');
    out += '<div style="border:1px solid var(--line);border-radius:11px;padding:12px 13px;background:var(--paper)">'
      + '<div style="font-weight:700;font-size:12.5px;margin-bottom:8px">New rule</div>'
      + '<input class="inp" data-testid="rule-name" placeholder="Name it (optional) — e.g. Ramesh invoices" value="' + esc(d.name || '') + '" oninput="ruleDraftSet(\'name\',this.value)" style="margin-bottom:8px">'
      + '<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">'
      + '<span style="font-size:12.5px">When</span>'
      + '<select class="inp" data-testid="rule-term" style="max-width:150px" onchange="ruleDraftSet(\'term\',this.value);_fldPaint()">' + opts + '</select>'
      + '<input class="inp" data-testid="rule-value" style="flex:1;min-width:130px" placeholder="' + esc(_RULE_HELP[d.term] || '') + '" value="' + esc(d.val || '') + '" oninput="ruleDraftSet(\'val\',this.value)">'
      + '<span style="font-size:12.5px">→ file here</span></div>'
      + '<div style="font-size:11px;color:var(--grey);margin-top:5px">' + esc(_RULE_HELP[d.term] || '') + '</div>'
      /* ⚠️ ONE TERM PER RULE, ON PURPOSE. Mixed AND/OR is what makes Outlook rules unpredictable past a handful:
         nobody can hold the precedence in their head, so the rule that fires is not the rule that was meant.
         Two conditions = two rules, in order — which is legible. */
      + '<div style="font-size:11px;color:var(--grey);margin-top:3px">One condition per rule. Need two? Make two rules — they run in order, and the first match wins.</div>'
      + '<div style="display:flex;gap:8px;margin-top:10px">'
      + '<button data-testid="rule-preview" onclick="rulePreview()" style="border:1px solid var(--line);background:#fff;border-radius:9px;padding:9px 15px;font-size:13px;font-weight:700;cursor:pointer">🔎 What would this catch?</button>'
      + '<button class="composebtn" data-testid="rule-save" onclick="ruleSave()">Save rule</button>'
      + '<button onclick="ruleDraftCancel()" style="border:1px solid var(--line);background:#fff;border-radius:9px;padding:9px 15px;font-size:13px;cursor:pointer;color:var(--grey)">Cancel</button></div>';

    if (_FLD.preview) {
      var p = _FLD.preview;
      out += '<div style="margin-top:11px;border-top:1px dashed var(--line);padding-top:9px">'
        + '<div style="font-size:12.5px;font-weight:700">' + p.matched + ' of your last ' + p.scanned + ' chits would have been filed here</div>'
        + (p.matched ? '<div style="margin-top:5px">' + p.sample.map(function(s){
            return '<div style="font-size:11.5px;padding:3px 0;border-top:1px solid #f0f2f4"><b>' + esc(s.subject || '(no subject)') + '</b> <span style="color:var(--grey)">· ' + esc(s.counterparty || '—') + ' · ' + esc(String(s.created_at || '').slice(0, 10)) + '</span></div>'; }).join('')
          + (p.matched > p.sample.length ? '<div style="font-size:11px;color:var(--grey);margin-top:4px">…and ' + (p.matched - p.sample.length) + ' more</div>' : '') + '</div>'
          : '<div style="font-size:11.5px;color:#8a5a1e;margin-top:4px">⚠️ Nothing matched. A rule that catches nothing looks enabled and does nothing — check the term before saving.</div>')
        + '<div style="font-size:11px;color:var(--grey);margin-top:6px">This is a preview only. Saving affects <b>new arrivals</b>; nothing already filed moves.</div></div>';
    }
    out += '</div>';
  }
  return out + '</div>';
}
