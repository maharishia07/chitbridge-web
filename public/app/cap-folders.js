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
    folderChits:  {m:'GET',    p:'/api/chits/inbox',  ok:'y'},
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
  if(UI.folders===undefined){ loadFolders(); return '<div class="empty"><div class="t">Loading folders…</div></div>'; }
  var tree=_folderTree(null,0)||'<div style="color:var(--grey);font-size:12px;padding:8px 6px">No folders yet — create one below.</div>';
  var right= UI.folderSel ? _folderView() : '<div class="empty" style="padding:44px 16px;text-align:center;color:var(--grey)"><div style="font-size:34px">📁</div><div style="font-weight:700;margin-top:6px">Pick a folder</div><div style="font-size:12.5px;margin-top:4px">Or create one, then file chits into it with 📁 Move.</div></div>';
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
  try{ var r=await api('folderChits',{query:{folder:id, archived:UI.folderArch?1:0}}); UI.folderChits=(r&&(r.chits||r.rows||r.data||r.inbox))||[]; }
  catch(e){ UI.folderChits=[]; }
  var dp=document.getElementById('detailpane'); if(dp)dp.innerHTML=_folderView();
}
function _folderView(){
  var f=(UI.folders||[]).find(function(x){return x.folder_id===UI.folderSel;})||{name:'Folder'};
  var arch=!!UI.folderArch;
  var tab=function(on,label,onclick){ return '<span onclick="'+onclick+'" style="cursor:pointer;font-size:12px;font-weight:700;padding:5px 13px;border-radius:16px;'+(on?'background:var(--blue);color:#fff':'border:1px solid var(--line);color:#586069')+'">'+label+'</span>'; };
  var head='<div style="padding:14px 18px;border-bottom:1px solid var(--line)"><div style="font-size:17px;font-weight:800">📁 '+esc(f.name)+'</div>'
    +'<div style="font-size:11.5px;color:var(--grey);margin-top:2px">source = the sender / actor · destination = this folder</div>'
    +'<div style="display:flex;gap:6px;margin-top:11px;align-items:center">'+tab(!arch,'Current','setFolderArch(false)')+tab(arch,'Archive','setFolderArch(true)')
    +'<span style="margin-left:auto;font-size:11px;color:var(--blue);cursor:pointer" onclick="renameFolder(\''+UI.folderSel+'\')">Rename</span>'
    +'<span style="font-size:11px;color:#c0453b;cursor:pointer;margin-left:14px" onclick="deleteFolder(\''+UI.folderSel+'\')">Delete</span></div></div>';
  var list;
  if(UI.folderChits===undefined) list='<div style="padding:16px;color:var(--grey);font-size:12.5px">Loading…</div>';
  else if(!UI.folderChits.length) list='<div style="padding:22px 18px;color:var(--grey);font-size:12.5px">Nothing '+(arch?'in Archive':'here')+' yet. From Task, use 📁 Move to file a chit into this folder.</div>';
  else list=UI.folderChits.map(function(c){
    var subj=esc(c.manual_subject||c.auto_subject||'(no subject)'); var from=esc(c.sender_entity_display_name||''); var when=(typeof fmtAt==='function'?esc(fmtAt(c.created_at)):'');
    var openA=(typeof openChit==='function')?('openChit(\''+c.chit_id+'\')'):'';
    return '<div style="display:flex;gap:11px;padding:12px 18px;border-bottom:1px solid #f0f2f4;cursor:pointer" onclick="'+openA+'"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13.5px">'+subj+'</div><div style="font-size:11.5px;color:var(--grey);margin-top:2px">from '+from+'</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto"><span style="font-size:11px;color:var(--grey)">'+when+'</span><span style="font-size:11px;color:var(--blue);border:1px solid #cfe0f4;background:#f2f7fd;border-radius:8px;padding:2px 8px" onclick="event.stopPropagation();moveChit(\''+c.chit_id+'\')">📁 Move</span></div></div>';
  }).join('');
  return head+'<div style="overflow:auto">'+list+'</div>';
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
