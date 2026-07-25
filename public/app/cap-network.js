/* app/cap-network.js — DESIGN-FIRST network builder. Lazy via ensureCap('network').
 * DESIGN a tree under your OWN entity (top node) — a DRAFT; nothing is minted while you design.
 *   OWNED   (branch / unit / depot) — part of you; at Build → a real entity + a login key YOU hold (Co-assist pattern).
 *   PARTNER (external business)      — a peer under the network; at Build → a handshake (no key). Its catalogue is visible here.
 * Each node declares a PURPOSE (line 1) and WHAT IT HOLDS via capability checkboxes. Ticking one EXPANDS its config:
 *   🗂️ Catalogue → catalogue spec (common-catalogue pick → fields, commercial method, max-items constraint).
 *   🛒 Storefront → exposure (public / protected). Off ⇒ private/internal.
 *   (Co-assists · Transact · Trade-ready · Dispute — checkboxes now; their expansions come in later slices.)
 * Draft persists per-entity (localStorage), survives reopen. "Build" (mint owned + handshake partners) is DEFERRED.
 * (Mint helpers from the previous version kept below, dormant, for the Build step.) */

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

/* ---- capabilities a node can HOLD (checkboxes) ---- */
var NET_CAPS = [
  { k: 'catalogue',  icon: '🗂️', label: 'Catalogue' },
  { k: 'storefront', icon: '🛒', label: 'Storefront' },
  { k: 'coassist',   icon: '🧑‍🤝‍🧑', label: 'Co-assists' },
  { k: 'transact',   icon: '🔄', label: 'Transact' },
  { k: 'tradeready', icon: '🛡️', label: 'Trade-ready' },
  { k: 'dispute',    icon: '⚖️', label: 'Dispute' },
];
function _capMeta(k){ for (var i = 0; i < NET_CAPS.length; i++) if (NET_CAPS[i].k === k) return NET_CAPS[i]; return null; }

/* ---- catalogue spec vocabulary ---- */
var CAT_SOURCES = ['manual', 'erp', 'iot', 'ai'];
var CAT_TYPES = ['text', 'number', 'choice', 'range', 'date'];
var CAT_METHODS = [
  { k: 'text',     label: 'Text only',          hint: 'no quantity, no price — information only' },
  { k: 'qty',      label: 'Quantity only',      hint: 'order a count; no price' },
  { k: 'cart',     label: 'Cart (qty + price)', hint: 'standard: quantity × price' },
  { k: 'range',    label: 'Price as a range',   hint: 'price varies within a band' },
  { k: 'qtyprice', label: 'Price + qty vary',   hint: 'both negotiable per order' },
];
var CAT_TEMPLATES = {
  custom:  { label: 'Custom (build your own)', fields: [] },
  timber:  { label: 'Timber',     fields: [{ name: 'species', source: 'manual', type: 'text' }, { name: 'grade', source: 'manual', type: 'choice' }, { name: 'moisture_pct', source: 'iot', type: 'number' }, { name: 'weight_kg', source: 'iot', type: 'number' }, { name: 'stock_qty', source: 'erp', type: 'number' }, { name: 'price_per_m3', source: 'erp', type: 'number' }] },
  gold:    { label: 'Gold bar',   fields: [{ name: 'bar_serial', source: 'manual', type: 'text' }, { name: 'fineness', source: 'iot', type: 'number' }, { name: 'fine_weight_g', source: 'iot', type: 'number' }, { name: 'source_mine', source: 'manual', type: 'text' }, { name: 'spot_price', source: 'erp', type: 'number' }] },
  pharma:  { label: 'Pharma lot', fields: [{ name: 'batch_no', source: 'manual', type: 'text' }, { name: 'active_ingredient', source: 'manual', type: 'text' }, { name: 'assay_pct', source: 'iot', type: 'number' }, { name: 'storage_temp', source: 'iot', type: 'number' }, { name: 'expiry', source: 'manual', type: 'date' }, { name: 'stock_qty', source: 'erp', type: 'number' }] },
  drone:   { label: 'Drone',      fields: [{ name: 'model', source: 'manual', type: 'text' }, { name: 'serial_no', source: 'manual', type: 'text' }, { name: 'battery_health', source: 'iot', type: 'number' }, { name: 'flight_hours', source: 'iot', type: 'number' }, { name: 'unit_price', source: 'erp', type: 'number' }] },
};

/* ---- draft state + per-entity persistence (localStorage only; nothing hits the server) ---- */
function _netDraftKey(){ return 'cb_netdraft_' + (SESSION.entityId || SESSION.entity || 'anon'); }
function _netSave(){ try { if (UI.net) localStorage.setItem(_netDraftKey(), JSON.stringify(UI.net)); } catch (e) {} }
function _netMark(){ if (UI.net) UI.net.built = false; _netSave(); }
function _netLoad(){ try { var s = localStorage.getItem(_netDraftKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function _netInit(){
  if (UI.net === undefined || UI.net === null) UI.net = _netLoad() || null;
  if (UI.net && UI.net.nodes) UI.net.nodes.forEach(function(n){          // upgrade older drafts to the current model
    if (n.owned === undefined) n.owned = true;
    if (!n.holds) n.holds = [];
    if (n.note && n.purpose === undefined) { n.purpose = n.note; delete n.note; }
    if (n.holds.indexOf('catalogue') >= 0 && !n.catalogue) n.catalogue = { template: 'custom', fields: [], method: 'cart', maxItems: null };
    if (n.holds.indexOf('storefront') >= 0 && !n.exposure) n.exposure = 'public';
  });
}
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
    nodes: [{ key: rootKey, name: ent, parent_key: null, owned: true, root: true, holds: [], purpose: 'This entity — the top of the network.' }], sel: rootKey };
  _netSave(); _netRerender();
}
function netAddChild(parentKey){
  _netInit(); if (!UI.net) return;
  var P = _netNode(parentKey); if (!P) return;
  var name = (typeof prompt === 'function') ? prompt('New OWNED node under "' + P.name + '" (a branch, unit or depot you own):', '') : '';
  if (!name || !name.trim()) return;
  var n = { key: _netKey(), name: name.trim(), parent_key: parentKey, owned: true, holds: ['catalogue'], purpose: '', catalogue: { template: 'custom', fields: [], method: 'cart', maxItems: null } };
  UI.net.nodes.push(n); UI.net.sel = n.key; UI.net.openCap = 'catalogue'; UI.net.built = false;
  _netSave(); _netRerender();
}
function netAddPartner(parentKey){
  _netInit(); if (!UI.net) return;
  var P = _netNode(parentKey); if (!P) return;
  var name = (typeof prompt === 'function') ? prompt('Partner — an INDEPENDENT business joining under "' + P.name + '" (you won\'t hold its key; its catalogue shows here):', '') : '';
  if (!name || !name.trim()) return;
  var n = { key: _netKey(), name: name.trim(), parent_key: parentKey, owned: false, holds: ['catalogue'], purpose: '', catalogue: { template: 'custom', fields: [], method: 'cart', maxItems: null } };
  UI.net.nodes.push(n); UI.net.sel = n.key; UI.net.openCap = 'catalogue'; UI.net.built = false;
  _netSave(); _netRerender();
}
function netSelect(key){ _netInit(); if (UI.net) { UI.net.sel = key; var _n = _netNode(key); UI.net.openCap = (_n && _n.holds && _n.holds[0]) || null; } _netRerender(); }
function netRename(key){
  var n = _netNode(key); if (!n) return;
  var name = (typeof prompt === 'function') ? prompt('Rename node:', n.name) : n.name;
  if (name === null || !name.trim()) return;
  n.name = name.trim(); _netMark(); _netRerender();
}
function netSetPurpose(key, val){ var n = _netNode(key); if (!n) return; n.purpose = val; _netSave(); }   // no re-render while typing
// Each capability is a clear YES / NO. Yes ⇒ the node holds it (and its detail opens). No ⇒ it doesn't. Sticky decision.
function netCapYes(key, capKey){
  var n = _netNode(key); if (!n) return; n.holds = n.holds || [];
  if (n.holds.indexOf(capKey) < 0) {
    n.holds.push(capKey);
    if (capKey === 'catalogue' && !n.catalogue) n.catalogue = { template: 'custom', fields: [], method: 'cart', maxItems: null };
    if (capKey === 'storefront' && !n.exposure) n.exposure = 'public';
  }
  if (UI.net.collapsed) delete UI.net.collapsed[capKey]; _netMark(); _netRerender();   // turning Yes shows its detail
}
function netCapNo(key, capKey){
  var n = _netNode(key); if (!n) return; n.holds = n.holds || [];
  var i = n.holds.indexOf(capKey); if (i >= 0) n.holds.splice(i, 1);
  if (UI.net.openCap === capKey) UI.net.openCap = null;
  _netMark(); _netRerender();
}
function netCapToggleOpen(key, capKey){   // collapse / expand a Yes capability's detail (each independent)
  UI.net.collapsed = UI.net.collapsed || {}; UI.net.collapsed[capKey] = !UI.net.collapsed[capKey]; _netRerender();
}
/* catalogue spec editing */
function _ensureCat(n){ if (!n.catalogue) n.catalogue = { template: 'custom', fields: [], method: 'cart', maxItems: null }; return n.catalogue; }
function netSetCatTemplate(key, tpl){
  var n = _netNode(key); if (!n) return; var c = _ensureCat(n); c.template = tpl;
  var t = CAT_TEMPLATES[tpl]; if (t && tpl !== 'custom') c.fields = t.fields.map(function(f){ return { name: f.name, source: f.source, type: f.type || 'text' }; });
  _netMark(); _netRerender();
}
function netSetCatMethod(key, m){ var n = _netNode(key); if (!n) return; _ensureCat(n).method = m; _netMark(); _netRerender(); }
function netSetCatMax(key, v){ var n = _netNode(key); if (!n) return; var num = parseInt(v, 10); _ensureCat(n).maxItems = (v === '' || isNaN(num)) ? null : num; _netSave(); }   // no re-render while typing
function netAddCatField(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).fields.push({ name: '', source: 'manual', type: 'text' }); _netMark(); _netRerender(); }
function netDelCatField(key, i){ var n = _netNode(key); if (!n) return; var c = _ensureCat(n); c.fields.splice(i, 1); _netMark(); _netRerender(); }
function netSetCatField(key, i, prop, val){ var n = _netNode(key); if (!n) return; var c = _ensureCat(n); if (c.fields[i]) { c.fields[i][prop] = val; _netMark(); if (prop !== 'name') _netRerender(); } }   // name via oninput: no re-render
function netSetExposure(key, val){ var n = _netNode(key); if (!n) return; n.exposure = val; _netMark(); _netRerender(); }
/* structure */
function _netDescendants(key, acc){ acc = acc || []; (UI.net.nodes || []).forEach(function(n){ if (n.parent_key === key){ acc.push(n.key); _netDescendants(n.key, acc); } }); return acc; }
function netDelete(key){
  var n = _netNode(key); if (!n) return;
  if (!n.parent_key){ if (typeof toast === 'function') toast('The top node is your entity — it stays.'); return; }
  var cnt = _netDescendants(key).length;
  var go = function(){
    var kill = _netDescendants(key); kill.push(key);
    UI.net.nodes = UI.net.nodes.filter(function(x){ return kill.indexOf(x.key) < 0; });
    if (kill.indexOf(UI.net.sel) >= 0) UI.net.sel = n.parent_key;
    _netMark(); _netRerender();
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
  var owned = (UI.net.nodes || []).filter(function(n){ return !n.root && n.owned; }).length;
  var partners = (UI.net.nodes || []).filter(function(n){ return !n.owned; }).length;
  var body = '<div style="padding:16px 18px">'
    + '<div style="font-size:13px;color:#3a4048;line-height:1.6">Your design is <b>saved</b>. Building will:</div>'
    + '<div style="font-size:13px;color:#3a4048;line-height:1.7;margin-top:8px">• create <b>' + owned + ' owned node' + (owned === 1 ? '' : 's') + '</b> as real entities, each with its own login key (like a Co-assist);<br>• send a handshake to <b>' + partners + ' partner' + (partners === 1 ? '' : 's') + '</b> (independent — no key held).</div>'
    + '<div style="margin-top:12px;padding:11px 13px;border:1px solid var(--line);border-radius:10px;background:#f7f9fb;font-size:12.5px;color:var(--grey)">🔒 <b>Not wired yet.</b> This is the confirm step — we build it next. Until you run it, <b>no entities and no keys are created</b>; your design just stays here, ready.</div>'
    + '</div>';
  if (typeof modal === 'function') modal('<div class="mhd"><div class="t">🔨 Ready to build</div></div><div class="mbody" style="padding:0">' + body + '</div>');
  else if (typeof toast === 'function') toast('Design saved — the Build step comes next.');
}

/* ---- render (two panes, same style) ---- */
function _capDots(n){ return (n.holds || []).map(function(k){ var c = _capMeta(k); return c ? c.icon : ''; }).join(''); }
function _netTree(parentKey, depth){
  var kids = (UI.net.nodes || []).filter(function(n){ return n.parent_key === (parentKey || null); });
  return kids.map(function(n){ var sel = UI.net.sel === n.key; var dots = _capDots(n);
    return '<div onclick="netSelect(\'' + n.key + '\')" style="cursor:pointer;padding:7px 9px;padding-left:' + (9 + depth * 16) + 'px;border-radius:8px;font-size:12.5px;' + (sel ? 'background:#eef4fc;color:#2c5aa0;font-weight:700' : 'color:#3a4048') + '">'
      + (n.parent_key ? '└ ' : '◆ ') + esc(n.name) + (n.owned ? '' : ' <span title="partner">🤝</span>')
      + (dots ? '<span style="font-size:10px;margin-left:5px;opacity:.9">' + dots + '</span>' : '')
      + '</div>' + _netTree(n.key, depth + 1);
  }).join('');
}
function networkScreen(){
  _netInit();
  if (!UI.net) {
    var ent = SESSION.entity || SESSION.name || 'your entity';
    return '<div style="padding:44px 22px;max-width:580px"><div style="font-size:19px;font-weight:800">🔗 Design your network</div>'
      + '<div style="font-size:13px;color:var(--grey);margin:8px 0 8px;line-height:1.6">Draw your structure first — <b>' + esc(ent) + '</b> is the top node. Add <b>owned</b> nodes (branches, units, depots) beneath it, or bring in a <b>partner</b> business. For each: a purpose, and tick <b>what it holds</b> (catalogue, storefront…) to fill in its spec. This is a <b>design</b>: it saves here and survives closing the app. <b>Nothing is created</b> until you choose to Build.</div>'
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
function _capSummary(n, k){
  if (k === 'catalogue') { var c = n.catalogue || {}; var nf = (c.fields || []).length; var m = (CAT_METHODS.filter(function(x){ return x.k === (c.method || 'cart'); })[0] || {}).label || ''; return nf + ' field' + (nf === 1 ? '' : 's') + ' · ' + m; }
  if (k === 'storefront') return 'exposure: ' + (n.exposure || 'public');
  return 'set up next';
}
function _yesNo(n, k, yes){
  return '<span style="display:inline-flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;flex:0 0 auto">'
    + '<span onclick="netCapNo(\'' + n.key + '\',\'' + k + '\')" style="cursor:pointer;padding:4px 12px;font-size:12px;font-weight:700;' + (!yes ? 'background:#eceef1;color:#3a4048' : 'background:#fff;color:var(--grey)') + '">No</span>'
    + '<span onclick="netCapYes(\'' + n.key + '\',\'' + k + '\')" style="cursor:pointer;padding:4px 12px;font-size:12px;font-weight:700;' + (yes ? 'background:#2c5aa0;color:#fff' : 'background:#fff;color:var(--grey)') + '">Yes</span>'
    + '</span>';
}
function _capRow(n, c){
  var yes = (n.holds || []).indexOf(c.k) >= 0;
  var open = yes && !(UI.net.collapsed && UI.net.collapsed[c.k]);
  var left = '<span ' + (yes ? 'onclick="netCapToggleOpen(\'' + n.key + '\',\'' + c.k + '\')" style="cursor:pointer;' : 'style="') + 'flex:1;min-width:0;display:flex;align-items:center;gap:8px">'
    + '<span style="font-size:15px">' + c.icon + '</span>'
    + '<span style="font-weight:700;font-size:13px;color:#1c2128">' + c.label + '</span>'
    + (yes ? '<span style="font-size:11px;color:var(--grey);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">· ' + esc(_capSummary(n, c.k)) + '</span><span style="margin-left:auto;color:var(--grey);font-size:11px;flex:0 0 auto">' + (open ? '▾' : '▸') + '</span>' : '')
    + '</span>';
  var head = '<div style="display:flex;align-items:center;gap:10px;padding:9px 2px">' + left + _yesNo(n, c.k, yes) + '</div>';
  var detail = (yes && open) ? '<div style="padding:0 2px 12px">' + _capDetail(n, c.k) + '</div>' : '';
  return '<div style="border-bottom:1px solid var(--line)">' + head + detail + '</div>';
}
function _capList(n){
  return '<div style="margin-top:8px;border-top:1px solid var(--line)">' + NET_CAPS.map(function(c){ return _capRow(n, c); }).join('') + '</div>';
}
function _catFieldRow(n, f, i){
  var srcOpts = CAT_SOURCES.map(function(s){ return '<option value="' + s + '"' + (f.source === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
  var typOpts = CAT_TYPES.map(function(t){ return '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('');
  return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0">'
    + '<input value="' + esc(f.name || '') + '" oninput="netSetCatField(\'' + n.key + '\',' + i + ',\'name\',this.value)" placeholder="field name" style="flex:1;min-width:0;font-size:12px;padding:5px 7px;border:1px solid var(--line);border-radius:6px">'
    + '<select onchange="netSetCatField(\'' + n.key + '\',' + i + ',\'source\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + srcOpts + '</select>'
    + '<select onchange="netSetCatField(\'' + n.key + '\',' + i + ',\'type\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + typOpts + '</select>'
    + '<span onclick="netDelCatField(\'' + n.key + '\',' + i + ')" title="remove" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 4px">×</span>'
    + '</div>';
}
function _catConfig(n){
  var c = _ensureCat(n);
  var tplOpts = Object.keys(CAT_TEMPLATES).map(function(k){ return '<option value="' + k + '"' + ((c.template || 'custom') === k ? ' selected' : '') + '>' + CAT_TEMPLATES[k].label + '</option>'; }).join('');
  var methOpts = CAT_METHODS.map(function(m){ return '<option value="' + m.k + '"' + ((c.method || 'cart') === m.k ? ' selected' : '') + '>' + m.label + '</option>'; }).join('');
  var mh = (CAT_METHODS.filter(function(m){ return m.k === (c.method || 'cart'); })[0] || {}).hint || '';
  var fields = (c.fields || []).map(function(f, i){ return _catFieldRow(n, f, i); }).join('') || '<div style="font-size:11px;color:var(--grey);padding:2px 0">No fields yet — pick a common catalogue, or add fields.</div>';
  return '<div style="margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-left:3px solid #2c5aa0;border-radius:10px;background:#fbfdff">'
    + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">🗂️ CATALOGUE SPEC</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:8px">Common catalogue (sets the fields)</label>'
    + '<select onchange="netSetCatTemplate(\'' + n.key + '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;max-width:100%">' + tplOpts + '</select>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px">Fields <span style="color:var(--faint,#8a929e)">(name · where it comes from · type)</span></label>'
    + fields
    + '<div onclick="netAddCatField(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ add field</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:8px">How customers order (commercial method)</label>'
    + '<select onchange="netSetCatMethod(\'' + n.key + '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px">' + methOpts + '</select>'
    + '<div style="font-size:11px;color:var(--grey);font-style:italic;margin-top:3px">' + esc(mh) + '</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px">Max items per order <span style="color:var(--faint,#8a929e)">(optional limit)</span></label>'
    + '<input value="' + (c.maxItems != null ? esc(String(c.maxItems)) : '') + '" oninput="netSetCatMax(\'' + n.key + '\',this.value)" type="number" min="1" placeholder="no limit" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;width:130px">'
    + '</div>';
}
function _exposureConfig(n){
  var e = n.exposure || 'public';
  var opt = function(val, label, hint){ var on = e === val;
    return '<div onclick="netSetExposure(\'' + n.key + '\',\'' + val + '\')" style="cursor:pointer;padding:8px 10px;border:1px solid ' + (on ? '#2c7a43' : 'var(--line)') + ';border-radius:8px;background:' + (on ? '#e6f4ec' : '#fff') + ';margin-top:6px">'
      + '<b style="font-size:12.5px;color:' + (on ? '#2c7a43' : '#3a4048') + '">' + (on ? '● ' : '○ ') + label + '</b>'
      + '<div style="font-size:11px;color:var(--grey);margin-top:2px">' + hint + '</div></div>'; };
  return '<div style="margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-left:3px solid #2c7a43;border-radius:10px;background:#fbfefc">'
    + '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em">🛒 EXPOSURE — shown to the outside world</div>'
    + opt('public', 'Public', 'Anyone / customers can see this catalogue in the storefront.')
    + opt('protected', 'Protected', 'Only businesses you\'re connected with can see it.')
    + '<div style="font-size:11px;color:var(--grey);margin-top:8px">Untick <b>Storefront</b> above to keep this node <b>private</b> (internal — shown to no one).</div>'
    + '</div>';
}
function _capDetail(n, k){
  if (k === 'catalogue') return _catConfig(n);
  if (k === 'storefront') return _exposureConfig(n);
  var c = _capMeta(k) || {};
  return '<div style="padding:12px 14px;border:1px dashed var(--line-strong,#c8d0d9);border-radius:10px;background:#fafbfc;font-size:12.5px;color:var(--grey)">'
    + c.icon + ' <b>' + esc(c.label) + '</b> — its settings come in the next slice; for now, Yes just marks that this node holds it.</div>';
}
function _netNodeView(n){
  var isRoot = !n.parent_key;
  var childCount = (UI.net.nodes || []).filter(function(x){ return x.parent_key === n.key; }).length;
  var badge = isRoot ? '<span style="font-size:10px;font-weight:800;color:#2c5aa0;background:#eaf1fb;border-radius:6px;padding:2px 7px;margin-left:9px;vertical-align:middle">TOP · YOUR ENTITY</span>'
    : (n.owned ? '<span style="font-size:10px;font-weight:800;color:#2c7a43;background:#e6f4ec;border-radius:6px;padding:2px 7px;margin-left:9px;vertical-align:middle">OWNED</span>'
               : '<span style="font-size:10px;font-weight:800;color:#8a5a1e;background:#f6ecd8;border-radius:6px;padding:2px 7px;margin-left:9px;vertical-align:middle">🤝 PARTNER</span>');
  var kindLine = isRoot ? 'The top of the network — your own entity.'
    : (n.owned ? 'An owned node — at Build it becomes a real entity with a login key <b>you hold</b>.'
               : 'An independent business — at Build it\'s a <b>handshake</b> (no key held). Its catalogue is visible here.');
  return '<div style="padding:16px 20px;max-width:560px">'
    + '<div style="font-size:18px;font-weight:800">' + (isRoot ? '◆ ' : '') + esc(n.name) + badge + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:2px">' + kindLine + ' · ' + childCount + ' child' + (childCount === 1 ? '' : 'ren') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px">'
      + '<button class="pri" onclick="netAddChild(\'' + n.key + '\')" style="padding:8px 13px">＋ Add owned node</button>'
      + '<button onclick="netAddPartner(\'' + n.key + '\')" style="padding:8px 13px">🤝 Add partner</button>'
      + (isRoot ? '' : '<button onclick="netRename(\'' + n.key + '\')" style="padding:8px 13px">✏️ Rename</button><button onclick="netDelete(\'' + n.key + '\')" style="padding:8px 13px">🗑️ Remove</button>')
    + '</div>'
    + (isRoot ? '' :
        '<div style="margin-top:16px"><label style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em">PURPOSE</label>'
        + '<input value="' + esc(n.purpose || '') + '" oninput="netSetPurpose(\'' + n.key + '\', this.value)" placeholder="what is this node for? (one line)" style="width:100%;margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;box-sizing:border-box"></div>')
    + '<div style="margin-top:16px;padding:13px 15px;border:1px solid var(--line);border-radius:11px;background:#fff">'
      + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em">WHAT THIS NODE HOLDS</div>'
      + '<div style="font-size:11px;color:var(--grey);margin-top:3px">For each, choose <b>Yes</b> or <b>No</b>. Yes opens its details right below.</div>'
      + _capList(n)
      + '</div>'
    + '<div style="margin-top:16px;font-size:11.5px;color:var(--grey);line-height:1.55">When the design is done, <b>Build</b> turns each owned node into a real entity + login key, and invites each partner by handshake. Until then this is just a plan — saved, nothing created.</div>'
    + '</div>';
}
