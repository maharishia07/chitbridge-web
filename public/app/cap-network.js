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
var COASSIST_KINDS = [
  { k: 'human', icon: '🧑', label: 'Human workforce' },
  { k: 'erp', icon: '🔗', label: 'ERP connectors' },
  { k: 'iot', icon: '📡', label: 'IoT devices / streams' },
  { k: 'ai', icon: '🤖', label: 'AI agents' },
];
var ERP_SYSTEMS = ['SAP', 'Oracle', 'NetSuite', 'Dynamics', 'Tally', 'Other'];
var AI_AUTONOMY = ['propose', 'authorize', 'confirm', 'delegate'];
var IOT_TYPES = ['Raspberry Pi', 'Industrial gateway', 'PLC', 'Direct sensor', 'Other'];
var CAT_LOADS = ['manual', 'ERP sync', 'WhatsApp', 'email', 'scan', 'Excel', 'on-demand'];

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
    if (n.holds.indexOf('coassist') >= 0) n.coassist = _normCoassist(n.coassist);
    if (n.holds.indexOf('transact') >= 0 && !n.transact) n.transact = { flow: 'both', copyOperator: true };
    if (n.holds.indexOf('tradeready') >= 0 && !n.tradeready) n.tradeready = { mode: 'inherit', certs: [] };
    if (n.holds.indexOf('dispute') >= 0 && !n.dispute) n.dispute = { informed: true };
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
    if (capKey === 'coassist' && !n.coassist) n.coassist = _defCoassist();
    if (capKey === 'transact' && !n.transact) n.transact = { flow: 'both', copyOperator: true };
    if (capKey === 'tradeready' && !n.tradeready) n.tradeready = { mode: 'inherit', certs: [] };
    if (capKey === 'dispute' && !n.dispute) n.dispute = { informed: true };
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
function _ensureCat(n){ if (!n.catalogue) n.catalogue = { template: 'custom', fields: [], method: 'cart', maxItems: null }; if (!n.catalogue.loadedBy) n.catalogue.loadedBy = 'manual'; return n.catalogue; }
function netSetCatLoad(key, v){ var n = _netNode(key); if (!n) return; _ensureCat(n).loadedBy = v; _netMark(); _netRerender(); }
function _srcBacked(n, src){ if (src === 'manual') return true; if ((n.holds || []).indexOf('coassist') < 0) return false; var cc = _normCoassist(n.coassist); if (src === 'erp') return cc.erp.connectors.length > 0; if (src === 'iot') return (cc.iot.connections || []).length > 0; if (src === 'ai') return cc.ai.count > 0; return true; }
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
  if (k === 'coassist') { var cc = _normCoassist(n.coassist); var p = []; if (cc.human.count) p.push(cc.human.count + ' human'); var iotDev = (cc.iot.connections || []).reduce(function(s, x){ return s + (parseInt(x.devices, 10) || 0); }, 0); if (iotDev || (cc.iot.connections || []).length) p.push(iotDev + ' IoT'); if (cc.erp.connectors.length) p.push(cc.erp.connectors.length + ' ERP'); if (cc.ai.count) p.push(cc.ai.count + ' AI'); return p.length ? p.join(' · ') : 'none set'; }
  if (k === 'transact') { var t = n.transact || {}; var f = t.flow || 'both'; var base = f === 'both' ? 'sends & receives' : (f === 'send' ? 'sends only' : 'receives only'); return base + (t.copyOperator !== false ? ' · HQ copied' : ''); }
  if (k === 'tradeready') { var tr = n.tradeready || {}; return tr.mode === 'own' ? ('own · ' + (tr.certs || []).length + ' cert' + ((tr.certs || []).length === 1 ? '' : 's')) : "network's certs"; }
  if (k === 'dispute') return (n.dispute || {}).informed !== false ? 'informed' : 'not involved';
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
  var loadOpts = CAT_LOADS.map(function(l){ return '<option value="' + l + '"' + ((c.loadedBy || 'manual') === l ? ' selected' : '') + '>' + l + '</option>'; }).join('');
  var used = {}; (c.fields || []).forEach(function(f){ if (f.source && f.source !== 'manual') used[f.source] = true; });
  var usedK = Object.keys(used);
  var srcNote = usedK.length ? ('<div style="font-size:11px;color:var(--grey);margin-top:6px;border-top:1px dotted var(--line);padding-top:5px">Field sources: ' + usedK.map(function(s){ var ok = _srcBacked(n, s); return '<b style="color:' + (ok ? '#2c7a43' : '#a5382e') + '">' + s.toUpperCase() + (ok ? ' ✓' : ' ⚠') + '</b>'; }).join(' · ') + (usedK.some(function(s){ return !_srcBacked(n, s); }) ? ' <span style="color:#a5382e">— add the matching co-assist to this node</span>' : '') + '</div>') : '';
  return '<div style="margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-left:3px solid #2c5aa0;border-radius:10px;background:#fbfdff">'
    + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">🗂️ CATALOGUE SPEC</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:8px">Common catalogue (sets the fields)</label>'
    + '<select onchange="netSetCatTemplate(\'' + n.key + '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;max-width:100%">' + tplOpts + '</select>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px">Populated by <span style="color:var(--faint,#8a929e)">(how the catalogue is fed)</span></label>'
    + '<select onchange="netSetCatLoad(\'' + n.key + '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px">' + loadOpts + '</select>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px">Fields <span style="color:var(--faint,#8a929e)">(name · where it comes from · type)</span></label>'
    + fields
    + '<div onclick="netAddCatField(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ add field</div>'
    + srcNote
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
    + opt('protected', 'Protected', 'Your <b>connected network / partners</b> can see it — <b>not</b> the public (HQ, other branches, partners).')
    + '<div style="font-size:11px;color:var(--grey);margin-top:8px">Untick <b>Storefront</b> above to keep this node <b>private</b> (internal — shown to no one).</div>'
    + '</div>';
}
/* setters for the four remaining panels */
/* co-assist: normalized shape + per-kind setters (Human roles · IoT gateways→devices · ERP system+label · AI role+autonomy) */
function _defCoassist(){ return { human: { count: 0, roles: [] }, iot: { connections: [] }, erp: { connectors: [] }, ai: { count: 0, role: '', autonomy: 'authorize' } }; }
function _normCoassist(ca){
  var d = _defCoassist(); ca = ca || {};
  if (typeof ca.human === 'number') d.human.count = ca.human; else if (ca.human) { d.human.count = ca.human.count || 0; d.human.roles = ca.human.roles || []; }
  if (typeof ca.iot === 'number') { if (ca.iot > 0) d.iot.connections = [{ type: 'Direct sensor', devices: ca.iot }]; }
  else if (ca.iot) { if (Array.isArray(ca.iot.connections)) d.iot.connections = ca.iot.connections; else if (ca.iot.gateways || ca.iot.devices) d.iot.connections = [{ type: 'Raspberry Pi', devices: ca.iot.devices || 0 }]; }
  if (typeof ca.erp === 'number') { for (var i = 0; i < ca.erp; i++) d.erp.connectors.push({ system: 'SAP', label: '' }); } else if (ca.erp) { d.erp.connectors = ca.erp.connectors || []; }
  if (typeof ca.ai === 'number') d.ai.count = ca.ai; else if (ca.ai) { d.ai.count = ca.ai.count || 0; d.ai.role = ca.ai.role || ''; d.ai.autonomy = ca.ai.autonomy || 'authorize'; }
  return d;
}
function _ca(n){ n.coassist = _normCoassist(n.coassist); return n.coassist; }
function netCaHuman(key, val){ var n = _netNode(key); if (!n) return; var x = parseInt(val, 10); _ca(n).human.count = (val === '' || isNaN(x) || x < 0) ? 0 : x; _netMark(); }
function netCaHumanAddRole(key){ var n = _netNode(key); if (!n) return; _ca(n).human.roles.push(''); _netMark(); _netRerender(); }
function netCaHumanDelRole(key, i){ var n = _netNode(key); if (!n) return; _ca(n).human.roles.splice(i, 1); _netMark(); _netRerender(); }
function netCaHumanSetRole(key, i, val){ var n = _netNode(key); if (!n) return; var r = _ca(n).human.roles; if (i >= 0 && i < r.length) { r[i] = val; _netMark(); } }
function netCaAddIot(key){ var n = _netNode(key); if (!n) return; _ca(n).iot.connections.push({ type: 'Raspberry Pi', devices: 0 }); _netMark(); _netRerender(); }
function netCaDelIot(key, i){ var n = _netNode(key); if (!n) return; _ca(n).iot.connections.splice(i, 1); _netMark(); _netRerender(); }
function netCaSetIot(key, i, prop, val){ var n = _netNode(key); if (!n) return; var cs = _ca(n).iot.connections; if (i < 0 || i >= cs.length) return; if (prop === 'devices') { var x = parseInt(val, 10); cs[i].devices = (val === '' || isNaN(x) || x < 0) ? 0 : x; _netMark(); } else { cs[i][prop] = val; _netMark(); _netRerender(); } }
function netCaAddErp(key){ var n = _netNode(key); if (!n) return; _ca(n).erp.connectors.push({ system: 'SAP', label: '' }); _netMark(); _netRerender(); }
function netCaDelErp(key, i){ var n = _netNode(key); if (!n) return; _ca(n).erp.connectors.splice(i, 1); _netMark(); _netRerender(); }
function netCaSetErp(key, i, prop, val){ var n = _netNode(key); if (!n) return; var e = _ca(n).erp.connectors; if (i >= 0 && i < e.length) { e[i][prop] = val; _netMark(); if (prop === 'system') _netRerender(); } }
function netCaAiCount(key, val){ var n = _netNode(key); if (!n) return; var x = parseInt(val, 10); _ca(n).ai.count = (val === '' || isNaN(x) || x < 0) ? 0 : x; _netMark(); }
function netCaAiRole(key, val){ var n = _netNode(key); if (!n) return; _ca(n).ai.role = val; _netMark(); }
function netCaAiAutonomy(key, val){ var n = _netNode(key); if (!n) return; _ca(n).ai.autonomy = val; _netMark(); _netRerender(); }
function netSetTransact(key, flow){ var n = _netNode(key); if (!n) return; n.transact = n.transact || {}; n.transact.flow = flow; _netMark(); _netRerender(); }
function netSetTransactCopy(key, v){ var n = _netNode(key); if (!n) return; n.transact = n.transact || {}; n.transact.copyOperator = !!v; _netMark(); _netRerender(); }
function netSetTradeMode(key, mode){ var n = _netNode(key); if (!n) return; n.tradeready = n.tradeready || { certs: [] }; n.tradeready.mode = mode; _netMark(); _netRerender(); }
function netAddCert(key){ var n = _netNode(key); if (!n) return; n.tradeready = n.tradeready || { mode: 'own', certs: [] }; n.tradeready.certs = n.tradeready.certs || []; n.tradeready.certs.push(''); _netMark(); _netRerender(); }
function netDelCert(key, i){ var n = _netNode(key); if (!n || !n.tradeready) return; (n.tradeready.certs || []).splice(i, 1); _netMark(); _netRerender(); }
function netSetCert(key, i, val){ var n = _netNode(key); if (!n || !n.tradeready || !n.tradeready.certs) return; if (i >= 0 && i < n.tradeready.certs.length) { n.tradeready.certs[i] = val; _netMark(); } }   // no re-render while typing
function netSetDispute(key, informed){ var n = _netNode(key); if (!n) return; n.dispute = n.dispute || {}; n.dispute.informed = !!informed; _netMark(); _netRerender(); }

function _coassistConfig(n){
  var c = _ca(n);
  var roleChips = c.human.roles.map(function(r, i){ return '<span style="display:inline-flex;align-items:center;gap:3px;margin:0 5px 4px 0"><input value="' + esc(r) + '" oninput="netCaHumanSetRole(\'' + n.key + '\',' + i + ',this.value)" placeholder="role" style="width:96px;font-size:11.5px;padding:3px 6px;border:1px solid var(--line);border-radius:6px"><span onclick="netCaHumanDelRole(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700">×</span></span>'; }).join('');
  var human = '<div style="padding:9px 0;border-bottom:1px solid var(--line)">'
    + '<div style="display:flex;align-items:center;gap:8px"><span style="flex:1;font-size:12.5px;font-weight:600;color:#3a4048">🧑 Human workforce</span>'
      + '<span style="font-size:11px;color:var(--grey)">count</span><input type="number" min="0" value="' + (c.human.count || '') + '" oninput="netCaHuman(\'' + n.key + '\',this.value)" placeholder="0" style="width:64px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-size:12px"></div>'
    + '<div style="margin-top:6px">' + roleChips + '<span onclick="netCaHumanAddRole(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600">＋ role</span></div>'
    + '</div>';
  var iotRows = c.iot.connections.map(function(io, i){
    var opts = IOT_TYPES.map(function(t){ return '<option value="' + t + '"' + (io.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('');
    return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><select onchange="netCaSetIot(\'' + n.key + '\',' + i + ',\'type\',this.value)" style="font-size:11.5px;padding:4px;border:1px solid var(--line);border-radius:6px">' + opts + '</select><span style="font-size:11px;color:var(--grey)">devices</span><input type="number" min="0" value="' + (io.devices || '') + '" oninput="netCaSetIot(\'' + n.key + '\',' + i + ',\'devices\',this.value)" placeholder="0" style="width:58px;font-size:11.5px;padding:4px 6px;border:1px solid var(--line);border-radius:6px"><span onclick="netCaDelIot(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>';
  }).join('');
  var iot = '<div style="padding:9px 0;border-bottom:1px solid var(--line)"><span style="font-size:12.5px;font-weight:600;color:#3a4048">📡 IoT connections</span>'
    + '<div style="margin-top:5px">' + iotRows + '<span onclick="netCaAddIot(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600">＋ connection</span></div></div>';
  var erpRows = c.erp.connectors.map(function(e, i){
    var opts = ERP_SYSTEMS.map(function(s){ return '<option value="' + s + '"' + (e.system === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><select onchange="netCaSetErp(\'' + n.key + '\',' + i + ',\'system\',this.value)" style="font-size:11.5px;padding:4px;border:1px solid var(--line);border-radius:6px">' + opts + '</select><input value="' + esc(e.label || '') + '" oninput="netCaSetErp(\'' + n.key + '\',' + i + ',\'label\',this.value)" placeholder="label (e.g. SAP-Prod)" style="flex:1;min-width:0;font-size:11.5px;padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span onclick="netCaDelErp(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>';
  }).join('');
  var erp = '<div style="padding:9px 0;border-bottom:1px solid var(--line)"><span style="font-size:12.5px;font-weight:600;color:#3a4048">🔗 ERP connectors</span>'
    + '<div style="margin-top:5px">' + erpRows + '<span onclick="netCaAddErp(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600">＋ connector</span></div></div>';
  var auOpts = AI_AUTONOMY.map(function(a){ return '<option value="' + a + '"' + (c.ai.autonomy === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
  var ai = '<div style="padding:9px 0 2px">'
    + '<div style="display:flex;align-items:center;gap:8px"><span style="flex:1;font-size:12.5px;font-weight:600;color:#3a4048">🤖 AI agents</span>'
      + '<span style="font-size:11px;color:var(--grey)">count</span><input type="number" min="0" value="' + (c.ai.count || '') + '" oninput="netCaAiCount(\'' + n.key + '\',this.value)" placeholder="0" style="width:64px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-size:12px"></div>'
    + '<div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap"><input value="' + esc(c.ai.role || '') + '" oninput="netCaAiRole(\'' + n.key + '\',this.value)" placeholder="what it does" style="flex:1 0 110px;min-width:0;font-size:11.5px;padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span style="font-size:11px;color:var(--grey)">autonomy</span><select onchange="netCaAiAutonomy(\'' + n.key + '\',this.value)" style="font-size:11.5px;padding:4px;border:1px solid var(--line);border-radius:6px">' + auOpts + '</select></div>'
    + '</div>';
  return '<div style="padding:12px 13px;border:1px solid var(--line);border-left:3px solid #8a5cc4;border-radius:10px;background:#fbfaff">'
    + '<div style="font-size:11px;font-weight:800;color:#8a5cc4;letter-spacing:.05em">🧑‍🤝‍🧑 CO-ASSISTS — under THIS branch</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:3px">Each is created under this node (login <b>key@branch</b>), not the network.</div>'
    + '<div style="margin-top:4px">' + human + iot + erp + ai + '</div>'
    + '</div>';
}
function _radioOpt(onclick, on, label, hint, color, bg){
  return '<div onclick="' + onclick + '" style="cursor:pointer;padding:8px 10px;border:1px solid ' + (on ? color : 'var(--line)') + ';border-radius:8px;background:' + (on ? bg : '#fff') + ';margin-top:6px">'
    + '<b style="font-size:12.5px;color:' + (on ? color : '#3a4048') + '">' + (on ? '● ' : '○ ') + label + '</b>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:2px">' + hint + '</div></div>';
}
function _transactConfig(n){
  var f = (n.transact || {}).flow || 'both';
  var copy = (n.transact || {}).copyOperator !== false;
  return '<div style="padding:12px 13px;border:1px solid var(--line);border-left:3px solid #2b6f8f;border-radius:10px;background:#f9fcfd">'
    + '<div style="font-size:11px;font-weight:800;color:#2b6f8f;letter-spacing:.05em">🔄 TRANSACT — does it deal directly with others?</div>'
    + _radioOpt("netSetTransact('" + n.key + "','both')", f === 'both', 'Sends and receives', 'Talks to counterparties on its own — both directions.', '#2b6f8f', '#e4f0f4')
    + _radioOpt("netSetTransact('" + n.key + "','send')", f === 'send', 'Sends only', 'Hands records out (to customers / downstream).', '#2b6f8f', '#e4f0f4')
    + _radioOpt("netSetTransact('" + n.key + "','receive')", f === 'receive', 'Receives only', 'Takes records in (from suppliers / upstream).', '#2b6f8f', '#e4f0f4')
    + '<div style="font-size:11px;font-weight:800;color:#2b6f8f;letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">COPY THE OPERATOR (HQ)?</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:2px">If yes, HQ keeps a copy of this node\'s transactions — this is what powers <b>traceability</b> + <b>MIS</b> across the network.</div>'
    + _radioOpt("netSetTransactCopy('" + n.key + "',true)", copy, 'Yes — copy HQ', 'The operator sees this node\'s transactions.', '#2b6f8f', '#e4f0f4')
    + _radioOpt("netSetTransactCopy('" + n.key + "',false)", !copy, 'No — node only', 'Only the counterparties hold copies; HQ does not see them.', '#2b6f8f', '#e4f0f4')
    + '</div>';
}
function _tradereadyConfig(n){
  var tr = n.tradeready || {}; var mode = tr.mode || 'inherit'; var certs = tr.certs || [];
  var certList = mode === 'own' ? '<div style="margin-top:8px">'
    + (certs.length ? certs.map(function(c, i){ return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><input value="' + esc(c) + '" oninput="netSetCert(\'' + n.key + '\',' + i + ',this.value)" placeholder="certification (e.g. FSC, ISO 9001)" style="flex:1;font-size:12px;padding:5px 7px;border:1px solid var(--line);border-radius:6px"><span onclick="netDelCert(\'' + n.key + '\',' + i + ')" title="remove" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 4px">×</span></div>'; }).join('') : '<div style="font-size:11px;color:var(--grey)">No certifications yet.</div>')
    + '<div onclick="netAddCert(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ add certification</div></div>' : '';
  return '<div style="padding:12px 13px;border:1px solid var(--line);border-left:3px solid #22857a;border-radius:10px;background:#f8fdfc">'
    + '<div style="font-size:11px;font-weight:800;color:#22857a;letter-spacing:.05em">🛡️ TRADE-READY — certifications</div>'
    + _radioOpt("netSetTradeMode('" + n.key + "','own')", mode === 'own', 'Holds its own certifications', 'This node carries its own clearances.', '#22857a', '#daf0ec')
    + _radioOpt("netSetTradeMode('" + n.key + "','inherit')", mode === 'inherit', "Inherits the network's", "The network's certifications apply here (cascaded).", '#22857a', '#daf0ec')
    + certList
    + '</div>';
}
function _disputeConfig(n){
  var inf = (n.dispute || {}).informed !== false;
  return '<div style="padding:12px 13px;border:1px solid var(--line);border-left:3px solid #8a5cc4;border-radius:10px;background:#fbfaff">'
    + '<div style="font-size:11px;font-weight:800;color:#8a5cc4;letter-spacing:.05em">⚖️ DISPUTE — is this node in the loop?</div>'
    + _radioOpt("netSetDispute('" + n.key + "',true)", inf, 'Informed / involved', 'When a dispute touches this node, it is notified and can respond.', '#8a5cc4', '#efeafa')
    + _radioOpt("netSetDispute('" + n.key + "',false)", !inf, 'Not involved', "Disputes are handled above it; this node isn't notified.", '#8a5cc4', '#efeafa')
    + '</div>';
}
function _capDetail(n, k){
  if (k === 'catalogue') return _catConfig(n);
  if (k === 'storefront') return _exposureConfig(n);
  if (k === 'coassist') return _coassistConfig(n);
  if (k === 'transact') return _transactConfig(n);
  if (k === 'tradeready') return _tradereadyConfig(n);
  if (k === 'dispute') return _disputeConfig(n);
  var c = _capMeta(k) || {};
  return '<div style="padding:12px 14px;border:1px dashed var(--line-strong,#c8d0d9);border-radius:10px;background:#fafbfc;font-size:12.5px;color:var(--grey)">' + c.icon + ' <b>' + esc(c.label) + '</b> — no settings.</div>';
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
