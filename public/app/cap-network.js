/* app/cap-network.js — DESIGN-FIRST network builder. Lazy via ensureCap('network').
 * You DESIGN a tree of nodes under your OWN entity (the top node) — a DRAFT. Nothing is minted while you design.
 * The draft persists per-entity (localStorage) so it survives closing and reopening the app. When the design is
 * done, "Build" is the confirm step that will create each node as a real entity + its login key — that step is
 * DEFERRED (wired in a later slice); until you confirm it, NO entities and NO keys are created.
 * Two panes, same style as before: LEFT = the tree; RIGHT = the selected node.
 * (The provisioning/mint helpers from the previous version are kept below, dormant, for the future Build step.) */

/* ---- mint helpers — DORMANT during design; used later by the Build/confirm step ---- */
function _netBase(){ return (typeof CFG !== 'undefined' && CFG.API_BASE) || ''; }
async function _netFetch(path, method, token, body){
  var res = await fetch(_netBase() + path, { method: method || 'GET', cache: 'no-store',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined });
  var j = {}; try { j = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((j && (j.message || j.error)) || ('API ' + res.status));
  return j;
}
async function _netMint(name){
  var email = 'node-' + String(name || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e5) + '@node.cb';
  var reg = await _netFetch('/api/entities/register', 'POST', null, { display_name: name, email: email });
  var otp = reg.dev_otp || '123456';
  var ver = await _netFetch('/api/entities/verify', 'POST', null, { email: email, otp: otp });
  return { entity_id: ver.entity.identity_id, token: ver.token, name: name, email: email };
}

/* ---- draft state + per-entity persistence (localStorage only; nothing hits the server) ---- */
var NET_ROLES = ['branch', 'unit', 'depot', 'supplier', 'distributor', 'storefront', 'partner'];
function _netDraftKey(){ return 'cb_netdraft_' + (SESSION.entityId || SESSION.entity || 'anon'); }
function _netSave(){ try { if (UI.net) localStorage.setItem(_netDraftKey(), JSON.stringify(UI.net)); } catch (e) {} }
function _netLoad(){ try { var s = localStorage.getItem(_netDraftKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function _netInit(){ if (UI.net === undefined || UI.net === null) UI.net = _netLoad() || null; }
function _netKey(){ return 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4); }
function _netNode(key){ return (UI.net && UI.net.nodes || []).find(function(n){ return n.key === key; }); }
function loadNetwork(){ _netInit(); }   // override the legacy loader — design-first renders from the draft, no server fetch
function _netRerender(){ if (typeof renderApp === 'function') renderApp(); }

function netNewNetwork(){
  var ent = SESSION.entity || SESSION.name || 'My entity';
  var purpose = (typeof prompt === 'function') ? prompt('Name this network (what it is for):', ent + ' network') : (ent + ' network');
  if (purpose === null) return;
  var rootKey = _netKey();
  UI.net = { id: 'net-' + Date.now().toString(36), purpose: (purpose || ent + ' network'), built: false,
    nodes: [{ key: rootKey, name: ent, parent_key: null, role: 'operator', note: 'This entity — the top of the network.' }], sel: rootKey };
  _netSave(); _netRerender();
}
function netAddChild(parentKey){
  _netInit(); if (!UI.net) return;
  var P = _netNode(parentKey); if (!P) return;
  var name = (typeof prompt === 'function') ? prompt('New node under "' + P.name + '" (a branch, unit, depot, supplier, distributor…):', '') : '';
  if (!name || !name.trim()) return;
  var n = { key: _netKey(), name: name.trim(), parent_key: parentKey, role: 'branch', note: '' };
  UI.net.nodes.push(n); UI.net.sel = n.key; UI.net.built = false;
  _netSave(); _netRerender();
}
function netSelect(key){ _netInit(); if (UI.net) UI.net.sel = key; _netRerender(); }
function netRename(key){
  var n = _netNode(key); if (!n) return;
  var name = (typeof prompt === 'function') ? prompt('Rename node:', n.name) : n.name;
  if (name === null || !name.trim()) return;
  n.name = name.trim(); UI.net.built = false; _netSave(); _netRerender();
}
function netSetRole(key, role){ var n = _netNode(key); if (!n) return; n.role = role; UI.net.built = false; _netSave(); _netRerender(); }
function netSetNote(key, val){ var n = _netNode(key); if (!n) return; n.note = val; _netSave(); }   // no re-render while typing
function _netDescendants(key, acc){ acc = acc || []; (UI.net.nodes || []).forEach(function(n){ if (n.parent_key === key){ acc.push(n.key); _netDescendants(n.key, acc); } }); return acc; }
function netDelete(key){
  var n = _netNode(key); if (!n) return;
  if (!n.parent_key){ if (typeof toast === 'function') toast('The top node is your entity — it stays.'); return; }
  var cnt = _netDescendants(key).length;
  var go = function(){
    var kill = _netDescendants(key); kill.push(key);
    UI.net.nodes = UI.net.nodes.filter(function(x){ return kill.indexOf(x.key) < 0; });
    if (kill.indexOf(UI.net.sel) >= 0) UI.net.sel = n.parent_key;
    UI.net.built = false; _netSave(); _netRerender();
  };
  if (typeof confirmAsk === 'function') confirmAsk('Remove node', 'Remove <b>' + esc(n.name) + '</b>' + (cnt ? ' and its ' + cnt + ' sub-node' + (cnt === 1 ? '' : 's') : '') + ' from the design? Nothing was created yet, so nothing is lost.', 'Remove', go, true);
  else if (typeof window !== 'undefined' && window.confirm('Remove ' + n.name + '?')) go();
}
function netStartOver(){
  var go = function(){ try { localStorage.removeItem(_netDraftKey()); } catch (e) {} UI.net = null; _netRerender(); };
  if (typeof confirmAsk === 'function') confirmAsk('Start over', 'Discard this design and start a new one? Nothing was created on the server, so nothing is lost there.', 'Start over', go, true);
  else go();
}
function netBuild(){
  _netInit(); if (!UI.net) return;
  var n = (UI.net.nodes || []).length - 1;   // exclude the entity/top node
  var body = '<div style="padding:16px 18px">'
    + '<div style="font-size:13px;color:#3a4048;line-height:1.6">Your design is <b>saved</b>. Building will create <b>' + n + ' node' + (n === 1 ? '' : 's') + '</b> as real entities, each with its own login key — the same way a Co-assist gets a key.</div>'
    + '<div style="margin-top:12px;padding:11px 13px;border:1px solid var(--line);border-radius:10px;background:#f7f9fb;font-size:12.5px;color:var(--grey)">🔒 <b>Not wired yet.</b> This is the confirm step — we build it next. Until you run it, <b>no entities and no keys are created</b>; your design just stays here, ready.</div>'
    + '</div>';
  if (typeof modal === 'function') modal('<div class="mhd"><div class="t">🔨 Ready to build</div></div><div class="mbody" style="padding:0">' + body + '</div>');
  else if (typeof toast === 'function') toast('Design saved — the Build step comes next.');
}

/* ---- render (two panes, same style) ---- */
function _netTree(parentKey, depth){
  var kids = (UI.net.nodes || []).filter(function(n){ return n.parent_key === (parentKey || null); });
  return kids.map(function(n){ var sel = UI.net.sel === n.key;
    return '<div onclick="netSelect(\'' + n.key + '\')" style="cursor:pointer;padding:7px 9px;padding-left:' + (9 + depth * 16) + 'px;border-radius:8px;font-size:12.5px;' + (sel ? 'background:#eef4fc;color:#2c5aa0;font-weight:700' : 'color:#3a4048') + '">'
      + (n.parent_key ? '└ ' : '◆ ') + esc(n.name)
      + '<span style="color:var(--grey);font-weight:400;font-size:11px"> · ' + esc(n.role || 'node') + '</span>'
      + '</div>' + _netTree(n.key, depth + 1);
  }).join('');
}
function networkScreen(){
  _netInit();
  if (!UI.net) {
    var ent = SESSION.entity || SESSION.name || 'your entity';
    return '<div style="padding:44px 22px;max-width:560px"><div style="font-size:19px;font-weight:800">🔗 Design your network</div>'
      + '<div style="font-size:13px;color:var(--grey);margin:8px 0 8px;line-height:1.6">Draw your structure first — <b>' + esc(ent) + '</b> is the top node, and you add branches, units, depots or partners beneath it. This is a <b>design</b>: it saves here and survives closing the app. <b>Nothing is created</b> until you choose to Build.</div>'
      + '<button class="pri" onclick="netNewNetwork()" style="padding:10px 16px;margin-top:10px">＋ Start designing</button></div>';
  }
  var tree = _netTree(null, 0) || '<div style="color:var(--grey);font-size:12px;padding:8px 6px">No nodes yet.</div>';
  var sel = UI.net.sel ? _netNode(UI.net.sel) : null;
  var right = sel ? _netNodeView(sel) : '<div style="padding:24px;color:var(--grey);font-size:13px">Select a node to edit it, or add a child under it.</div>';
  var count = (UI.net.nodes || []).length - 1;
  return '<div style="display:flex;height:100%;min-height:0">'
    + '<div style="width:300px;border-right:1px solid var(--line);overflow:auto;padding:12px 8px;flex:0 0 auto">'
      + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;padding:2px 8px 3px">' + esc(UI.net.purpose || 'NETWORK') + '</div>'
      + '<div style="font-size:10px;color:#8a94a3;padding:0 8px 10px">design · saved on this device</div>'
      + tree
      + '<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">'
        + '<button class="pri" onclick="netBuild()" style="width:calc(100% - 16px);margin:0 8px;padding:9px">🔨 Build network' + (count ? ' (' + count + ')' : '') + '</button>'
        + '<div style="font-size:11px;color:var(--grey);padding:8px 8px 2px">' + (count ? count + ' node' + (count === 1 ? '' : 's') + ' designed · nothing created yet' : 'add nodes, then build') + '</div>'
        + '<div style="font-size:11px;color:var(--blue);padding:6px 8px;cursor:pointer" onclick="netStartOver()">↺ Start over</div>'
      + '</div>'
      + '</div>'
    + '<div style="flex:1;overflow:auto;min-width:0">' + right + '</div></div>';
}
function _netNodeView(n){
  var isRoot = !n.parent_key;
  var childCount = (UI.net.nodes || []).filter(function(x){ return x.parent_key === n.key; }).length;
  var roleOpts = NET_ROLES.map(function(r){ return '<option value="' + r + '"' + (n.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('');
  return '<div style="padding:16px 20px;max-width:540px">'
    + '<div style="font-size:18px;font-weight:800">' + (isRoot ? '◆ ' : '') + esc(n.name) + (isRoot ? '<span style="font-size:10px;font-weight:800;color:#2c5aa0;background:#eaf1fb;border-radius:6px;padding:2px 7px;margin-left:9px;vertical-align:middle">TOP · YOUR ENTITY</span>' : '') + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:2px">' + (isRoot ? 'The top of the network — your own entity.' : 'a node under ' + esc((_netNode(n.parent_key) || {}).name || '')) + ' · ' + childCount + ' child' + (childCount === 1 ? '' : 'ren') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px">'
      + '<button class="pri" onclick="netAddChild(\'' + n.key + '\')" style="padding:8px 13px">＋ Add node under this</button>'
      + (isRoot ? '' : '<button onclick="netRename(\'' + n.key + '\')" style="padding:8px 13px">✏️ Rename</button><button onclick="netDelete(\'' + n.key + '\')" style="padding:8px 13px">🗑️ Remove</button>')
    + '</div>'
    + (isRoot ? '' :
        '<div style="margin-top:16px;padding:13px 15px;border:1px solid var(--line);border-radius:11px;background:#fff">'
        + '<label style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em">ROLE IN THE NETWORK</label>'
        + '<select onchange="netSetRole(\'' + n.key + '\', this.value)" style="display:block;margin-top:6px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;font-size:13px">' + roleOpts + '</select>'
        + '<label style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;display:block;margin-top:12px">NOTE (what it does)</label>'
        + '<input value="' + esc(n.note || '') + '" oninput="netSetNote(\'' + n.key + '\', this.value)" placeholder="e.g. handles East-region depots" style="width:100%;margin-top:6px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:13px;box-sizing:border-box">'
        + '</div>')
    + '<div style="margin-top:16px;font-size:11.5px;color:var(--grey);line-height:1.55">When the design is done, <b>Build</b> turns each node into a real entity with its own login key. Until then this is just a plan — saved, nothing created.</div>'
    + '</div>';
}
