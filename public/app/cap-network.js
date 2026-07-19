/* app/cap-network.js — NETWORK provisioning (Option 1: a new, owner-provisioned network). Lazy via ensureCap('network').
 * Two panels: LEFT = the tree you build (parties); RIGHT = the selected node + "add child". Each node is a REAL
 * entity the operator mints (owner holds its first-time key — loose policy for now; the tighten/hand-over dial is next).
 * "Add child" hands a batch DOWN: it sends the traceable handoff parent→child FROM the parent's key, tagged with this
 * network id + the operator, so the tree you build IS the traceability tree. Reuses register/verify/send — no new backend. */

function _netBase(){ return (typeof CFG !== 'undefined' && CFG.API_BASE) || ''; }
async function _netFetch(path, method, token, body){
  var res = await fetch(_netBase() + path, { method: method || 'GET', cache: 'no-store',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined });
  var j = {}; try { j = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((j && (j.message || j.error)) || ('API ' + res.status));
  return j;
}
// Provision a real entity node (owner mints it and holds its key).
async function _netMint(name){
  var email = 'node-' + String(name || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e5) + '@node.cb';
  var reg = await _netFetch('/api/entities/register', 'POST', null, { display_name: name, email: email });
  var otp = reg.dev_otp || '123456';
  var ver = await _netFetch('/api/entities/verify', 'POST', null, { email: email, otp: otp });
  return { entity_id: ver.entity.identity_id, token: ver.token, name: name };
}
function _netNode(key){ return (UI.net && UI.net.nodes || []).find(function(n){ return n.key === key; }); }
function _netKey(){ return 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4); }
function _netInit(){ if (!UI.net) UI.net = { id: null, purpose: '', nodes: [], sel: null, busy: false }; }

function netNewNetwork(){
  var name = (typeof prompt === 'function') ? prompt('Name this network (its purpose):', 'Supply chain') : 'Network';
  if (name === null) return;
  UI.net = { id: 'net-' + Date.now().toString(36), purpose: (name || 'Network'), nodes: [], sel: null, busy: false };
  if (typeof renderApp === 'function') renderApp();
}
async function netAddRoot(){
  _netInit(); if (!UI.net.id) { netNewNetwork(); return; }
  var name = (typeof prompt === 'function') ? prompt('Root node — the source (e.g. Aurex API):', '') : '';
  if (!name || !name.trim()) return;
  UI.net.busy = true; if (typeof renderApp === 'function') renderApp();
  try { var m = await _netMint(name.trim());
    UI.net.nodes.push({ key: _netKey(), name: m.name, entity_id: m.entity_id, token: m.token, chit_id: null, parent_key: null, product: null, qty: null, unit: null });
    UI.net.sel = UI.net.nodes[UI.net.nodes.length - 1].key;
  } catch (e) { if (typeof toast === 'function') toast(e.message || 'Provisioning failed'); }
  UI.net.busy = false; if (typeof renderApp === 'function') renderApp();
}
async function netAddChild(parentKey){
  var P = _netNode(parentKey); if (!P) return;
  if (!SESSION.entityId) { if (typeof toast === 'function') toast('Operator not loaded — reload and sign in again.'); return; }
  var name = (typeof prompt === 'function') ? prompt('New node — who receives (e.g. Distributor Mumbai):', '') : ''; if (!name || !name.trim()) return;
  var product = (typeof prompt === 'function') ? prompt('Batch / product handed to it:', P.product || 'FG-PC-6621') : 'BATCH'; if (product === null) return;
  var qty = parseFloat((typeof prompt === 'function') ? prompt('Quantity (kg):', '8') : '8') || 0;
  UI.net.busy = true; if (typeof renderApp === 'function') renderApp();
  try {
    var m = await _netMint(name.trim());
    var trace = { product: product, qty: qty, unit: 'kg', network: { id: UI.net.id, operator: SESSION.entityId } };
    if (P.chit_id) trace.parents = [P.chit_id]; else trace.is_origin = true;   // root's first outbound = the origin edge
    var sent = await _netFetch('/api/chits/send', 'POST', P.token, { receivers: [{ entity_id: m.entity_id }], purpose: 'delivery_note',
      manual_subject: P.name + ' → ' + m.name + ': ' + product, line_items: [{ name: product, quantity: qty, unit: 'kg', price: 0, total: 0 }], trace: trace });
    UI.net.nodes.push({ key: _netKey(), name: m.name, entity_id: m.entity_id, token: m.token, chit_id: sent.chit_id, parent_key: parentKey, product: product, qty: qty, unit: 'kg' });
    UI.net.sel = UI.net.nodes[UI.net.nodes.length - 1].key;
  } catch (e) { if (typeof toast === 'function') toast(e.message || 'Add failed'); }
  UI.net.busy = false; if (typeof renderApp === 'function') renderApp();
}
function netSelect(key){ _netInit(); UI.net.sel = key; if (typeof renderApp === 'function') renderApp(); }
function netTraceFrom(chitId){
  UI.traceId = chitId; UI.nav = 'traceability';
  if (typeof ensureCap === 'function') ensureCap('traceability').then(function(){ if (typeof runTrace === 'function') runTrace('forward'); }).catch(function(){});
  if (typeof renderApp === 'function') renderApp();
}

function _netTree(parentKey, depth){
  var kids = (UI.net.nodes || []).filter(function(n){ return n.parent_key === (parentKey || null); });
  return kids.map(function(n){ var sel = UI.net.sel === n.key;
    return '<div onclick="netSelect(\'' + n.key + '\')" style="cursor:pointer;padding:7px 9px;padding-left:' + (9 + depth * 16) + 'px;border-radius:8px;font-size:12.5px;' + (sel ? 'background:#eef4fc;color:#2c5aa0;font-weight:700' : 'color:#3a4048') + '">'
      + (n.parent_key ? '└ ' : '◆ ') + esc(n.name)
      + (n.qty != null && n.product ? '<span style="color:var(--grey);font-weight:400;font-size:11px"> · ' + esc(String(n.qty)) + esc(' ' + n.unit) + '</span>' : '')
      + '</div>' + _netTree(n.key, depth + 1);
  }).join('');
}
function networkScreen(){
  _netInit();
  if (!UI.net.id) {
    return '<div style="padding:44px 22px;max-width:540px"><div style="font-size:19px;font-weight:800">🔗 Build a network</div>'
      + '<div style="font-size:13px;color:var(--grey);margin:8px 0 18px;line-height:1.55">Provision a tree of nodes — each a real entity you own. Hand a batch down the tree and it becomes traceable end-to-end: flag the top and the whole reach lights up, flag a leaf and it walks back to source.</div>'
      + '<button class="pri" onclick="netNewNetwork()" style="padding:10px 16px">＋ New network</button></div>';
  }
  var tree = _netTree(null, 0) || '<div style="color:var(--grey);font-size:12px;padding:8px 6px">No nodes yet — add the root (source) below.</div>';
  var sel = UI.net.sel ? _netNode(UI.net.sel) : null;
  var right = sel ? _netNodeView(sel) : '<div style="padding:24px;color:var(--grey);font-size:13px">Select a node to hand a batch down from it — or add the root (source) on the left.</div>';
  return '<div style="display:flex;height:100%;min-height:0">'
    + '<div style="width:290px;border-right:1px solid var(--line);overflow:auto;padding:12px 8px;flex:0 0 auto">'
      + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;padding:2px 8px 3px">' + esc(UI.net.purpose || 'NETWORK') + '</div>'
      + '<div style="font-size:10px;color:#8a94a3;font-family:monospace;padding:0 8px 10px;word-break:break-all">' + esc(UI.net.id) + '</div>'
      + tree
      + '<div style="font-size:12px;color:var(--blue);padding:11px 8px 4px;cursor:pointer" onclick="netAddRoot()">＋ Add root (source)</div>'
      + (UI.net.busy ? '<div style="font-size:11px;color:var(--grey);padding:6px 8px">provisioning…</div>' : '')
      + '<div style="font-size:11px;color:var(--blue);padding:9px 8px;cursor:pointer;border-top:1px solid var(--line);margin-top:10px" onclick="netNewNetwork()">↺ Start a different network</div>'
      + '</div>'
    + '<div style="flex:1;overflow:auto;min-width:0">' + right + '</div></div>';
}
function _netNodeView(n){
  var childCount = (UI.net.nodes || []).filter(function(x){ return x.parent_key === n.key; }).length;
  return '<div style="padding:16px 20px">'
    + '<div style="font-size:18px;font-weight:800">' + (n.parent_key ? '' : '◆ ') + esc(n.name) + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:2px">' + (n.parent_key ? ('received ' + esc(String(n.qty)) + esc(' ' + n.unit) + ' of ' + esc(n.product)) : 'source node — no inbound') + ' · ' + childCount + ' child' + (childCount === 1 ? '' : 'ren') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">'
      + '<button class="pri" onclick="netAddChild(\'' + n.key + '\')" style="padding:8px 13px">＋ Add child (hand a batch down)</button>'
      + (n.chit_id ? '<button onclick="netTraceFrom(\'' + n.chit_id + '\')" style="padding:8px 13px">🧭 Trace from here</button>' : '')
    + '</div>'
    + '<div style="margin-top:16px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#fff">'
      + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin-bottom:6px">NODE KEY</div>'
      + '<div style="font-size:11px;color:#8a94a3;font-family:monospace;word-break:break-all">entity ' + esc(n.entity_id) + '</div>'
      + '<div style="font-size:11.5px;color:var(--grey);margin-top:6px">Provisioned by you — you currently hold its key <b>(loose)</b>. <i>Tighten / hand over — coming next.</i></div>'
    + '</div></div>';
}
