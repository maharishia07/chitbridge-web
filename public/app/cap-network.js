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
  return { entity_id: ver.entity.identity_id, token: ver.token, name: name, email: email };
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
    UI.net.nodes.push({ key: _netKey(), name: m.name, entity_id: m.entity_id, token: m.token, email: m.email, key_policy: 'loose', chit_id: null, parent_key: null, product: null, qty: null, unit: null });
    UI.net.sel = UI.net.nodes[UI.net.nodes.length - 1].key;
  } catch (e) { if (typeof toast === 'function') toast(e.message || 'Provisioning failed'); }
  UI.net.busy = false; if (typeof renderApp === 'function') renderApp();
}
async function netAddChild(parentKey){
  var P = _netNode(parentKey); if (!P) return;
  if (P.key_policy === 'handed_over' || !P.token) { if (typeof toast === 'function') toast('“' + P.name + '” was handed over — its own operator adds its children now, not you.'); return; }
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
    UI.net.nodes.push({ key: _netKey(), name: m.name, entity_id: m.entity_id, token: m.token, email: m.email, key_policy: 'loose', chit_id: sent.chit_id, parent_key: parentKey, product: product, qty: qty, unit: 'kg' });
    UI.net.sel = UI.net.nodes[UI.net.nodes.length - 1].key;
  } catch (e) { if (typeof toast === 'function') toast(e.message || 'Add failed'); }
  UI.net.busy = false; if (typeof renderApp === 'function') renderApp();
}
function netSelect(key){ _netInit(); UI.net.sel = key; if (typeof renderApp === 'function') renderApp(); }
// The tighten dial: hand over a node's key. The operator DROPS its token (can no longer act as / read the node),
// the policy flips to handed_over (tighten-only — no reclaim), and its operator gets a first-time key. Making the
// node's private schema unreachable even from HQ is what makes "the schema will not be exposed" actually true.
function netHandover(key){
  var n = _netNode(key); if (!n || n.key_policy === 'handed_over') return;
  var go = function(){
    n.key_policy = 'handed_over';
    var handedEmail = n.email; n.token = null;   // operator drops the operational key
    if (typeof renderApp === 'function') renderApp();
    var body = '<div style="padding:16px 18px">'
      + '<div style="font-size:13px;color:#3a4048;line-height:1.55">You handed over <b>' + esc(n.name) + '</b>. You no longer hold its key — it runs its own operations now. You keep <b>deactivate</b> authority.</div>'
      + '<div style="margin-top:14px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#f7f9fb">'
        + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin-bottom:6px">FIRST-TIME KEY — give this to its operator</div>'
        + '<div style="font-size:12.5px;font-family:monospace">sign-in: ' + esc(handedEmail || '(node email)') + '</div>'
        + '<div style="font-size:12.5px;font-family:monospace">code: 123456</div>'
        + '<div style="font-size:11px;color:var(--grey);margin-top:7px">They sign in with this, then change it to their own — after which even you can\'t reach it. (Credential rotation is the next layer.)</div>'
      + '</div></div>';
    if (typeof modal === 'function') modal('<div class="mhd"><div class="t">🔒 Key handed over</div></div><div class="mbody" style="padding:0">' + body + '</div>');
    else if (typeof toast === 'function') toast('Handed over ' + n.name);
  };
  if (typeof confirmAsk === 'function') confirmAsk('Hand over the key', 'Hand over <b>' + esc(n.name) + '</b>? You will <b>drop its key</b> — you can no longer act as it or read its private data. This <b>can\'t be undone</b> (tighten-only).', 'Hand over', go, true);
  else if (typeof window !== 'undefined' && window.confirm('Hand over ' + n.name + '? You drop its key permanently.')) go();
}
function netTraceFrom(chitId){
  UI.traceId = chitId; UI.nav = 'traceability';
  if (typeof ensureCap === 'function') ensureCap('traceability').then(function(){ if (typeof runTrace === 'function') runTrace('forward'); }).catch(function(){});
  if (typeof renderApp === 'function') renderApp();
}

function _netTree(parentKey, depth){
  var kids = (UI.net.nodes || []).filter(function(n){ return n.parent_key === (parentKey || null); });
  return kids.map(function(n){ var sel = UI.net.sel === n.key;
    return '<div onclick="netSelect(\'' + n.key + '\')" style="cursor:pointer;padding:7px 9px;padding-left:' + (9 + depth * 16) + 'px;border-radius:8px;font-size:12.5px;' + (sel ? 'background:#eef4fc;color:#2c5aa0;font-weight:700' : 'color:#3a4048') + '">'
      + (n.parent_key ? '└ ' : '◆ ') + esc(n.name) + (n.key_policy === 'handed_over' ? ' 🔒' : '')
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
  var handed = n.key_policy === 'handed_over';
  var actions = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px">'
    + (handed
        ? '<span style="font-size:12px;color:var(--grey)">Handed over — its operator adds its own children now.</span>'
        : '<button class="pri" onclick="netAddChild(\'' + n.key + '\')" style="padding:8px 13px">＋ Add child (hand a batch down)</button>')
    + (n.chit_id ? '<button onclick="netTraceFrom(\'' + n.chit_id + '\')" style="padding:8px 13px">🧭 Trace from here</button>' : '')
    + '</div>';
  var pill = function(on, label, onColor){ return '<span style="padding:2px 9px;border-radius:20px;font-size:11px;font-weight:800;' + (on ? 'color:#fff;background:' + onColor : 'color:var(--grey);background:#eef1f4') + '">' + label + '</span>'; };
  var dial = '<div style="margin-top:16px;padding:13px 15px;border:1px solid ' + (handed ? '#bcd0ea' : 'var(--line)') + ';border-radius:11px;background:' + (handed ? '#f4f8fe' : '#fff') + '">'
    + '<div style="display:flex;align-items:center;gap:10px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em">KEY POLICY</div>'
      + '<div style="margin-left:auto;display:flex;align-items:center;gap:6px">' + pill(!handed, 'LOOSE', '#c98a2b') + '<span style="color:var(--grey);font-weight:800">→</span>' + pill(handed, 'HANDED OVER', '#2c5aa0') + '</div>'
    + '</div>'
    + '<div style="font-size:11px;color:#8a94a3;font-family:monospace;word-break:break-all;margin-top:9px">entity ' + esc(n.entity_id) + '</div>'
    + (handed
        ? '<div style="font-size:11.5px;color:#2c5aa0;margin-top:7px">✓ You dropped this node\'s key. It runs itself; you kept deactivate authority. Tighten-only — it can\'t be reclaimed.</div>'
        : '<div style="font-size:11.5px;color:var(--grey);margin-top:7px">You provisioned this node and hold its key <b>(loose)</b> — you can act as it. Hand over to make its schema private even from you.</div>'
          + '<button onclick="netHandover(\'' + n.key + '\')" style="padding:7px 12px;margin-top:10px">🔒 Hand over the key (tighten)</button>')
    + '</div>';
  return '<div style="padding:16px 20px">'
    + '<div style="font-size:18px;font-weight:800">' + (n.parent_key ? '' : '◆ ') + esc(n.name) + (handed ? '<span style="font-size:10px;font-weight:800;color:#2c5aa0;background:#eaf1fb;border-radius:6px;padding:2px 7px;margin-left:9px;vertical-align:middle">🔒 HANDED OVER</span>' : '') + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:2px">' + (n.parent_key ? ('received ' + esc(String(n.qty)) + esc(' ' + n.unit) + ' of ' + esc(n.product)) : 'source node — no inbound') + ' · ' + childCount + ' child' + (childCount === 1 ? '' : 'ren') + '</div>'
    + actions + dial + '</div>';
}
