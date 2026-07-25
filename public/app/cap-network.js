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
var CAT_TYPES = CBCatalogue.TYPES;
var CAT_METHODS = [
  { k: 'text',     label: 'Text only',          hint: 'no quantity, no price — information only' },
  { k: 'qty',      label: 'Quantity only',      hint: 'order a count; no price' },
  { k: 'cart',     label: 'Cart (qty + price)', hint: 'standard: quantity × price' },
  { k: 'range',    label: 'Price as a range',   hint: 'price varies within a band' },
  { k: 'qtyprice', label: 'Price + qty vary',   hint: 'both negotiable per order' },
];
var CAT_TEMPLATES = {
  custom:  { label: 'Custom (build your own)', baseUnit: '', fields: [] },
  timber:  { label: 'Timber',     baseUnit: 'm3', fields: [{ name: 'species', source: 'manual', type: 'text' }, { name: 'grade', source: 'manual', type: 'choice' }, { name: 'moisture_pct', source: 'iot', type: 'number' }, { name: 'weight_kg', source: 'iot', type: 'number' }, { name: 'stock_qty', source: 'erp', type: 'number' }] },
  gold:    { label: 'Gold bar',   baseUnit: 'g', fields: [{ name: 'bar_serial', source: 'manual', type: 'text' }, { name: 'fineness', source: 'iot', type: 'number' }, { name: 'fine_weight_g', source: 'iot', type: 'number' }, { name: 'source_mine', source: 'manual', type: 'text' }] },
  pharma:  { label: 'Pharma lot', baseUnit: 'unit', fields: [{ name: 'batch_no', source: 'manual', type: 'text' }, { name: 'active_ingredient', source: 'manual', type: 'text' }, { name: 'assay_pct', source: 'iot', type: 'number' }, { name: 'storage_temp', source: 'iot', type: 'number' }, { name: 'expiry', source: 'manual', type: 'date' }, { name: 'stock_qty', source: 'erp', type: 'number' }] },
  drone:   { label: 'Drone',      baseUnit: 'unit', fields: [{ name: 'model', source: 'manual', type: 'text' }, { name: 'serial_no', source: 'manual', type: 'text' }, { name: 'battery_health', source: 'iot', type: 'number' }, { name: 'flight_hours', source: 'iot', type: 'number' }] },
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
var CAT_LOADS = ['manual', 'ERP sync', 'CSV', 'Excel', 'on-demand'];        // how the LIST (catalogue) is built
var OFF_RAIL_CHANNELS = ['WhatsApp', 'email', 'scan'];    // off-rail capture inlets — a message to a handle you own → captured to a chit
var COLLECT_CADENCE = ['per order', 'regular'];
// The four-leg information chain: every required field is routed to ONE origin leg; the record is then fed back to systems.
// Vocabulary + catalogue shape come from the shared model (app/catalogue-model.js). ONE definition — the UI and headless consumers (e.g. the EOQ harness) route through it.
var CAT_LEGS = CBCatalogue.LEGS;
var STD_SCHEMES = CBCatalogue.STD_SCHEMES;
var PRICE_BASIS = CBCatalogue.PRICE_BASIS;
var PRICE_BY = CBCatalogue.PRICE_BY;
function _viaFor(leg){ return CBCatalogue.viaFor(leg); }   // system → ERP/IoT · compute → AI/ERP

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
    if (n.holds.indexOf('catalogue') >= 0 && !n.catalogue) n.catalogue = { template: 'custom', fields: [] };
    if (n.holds.indexOf('storefront') >= 0) { if (!n.exposure) n.exposure = 'public'; _ensureOrder(n); }
    if (n.holds.indexOf('coassist') >= 0) n.coassist = _normCoassist(n.coassist);
    if (n.holds.indexOf('transact') >= 0 && !n.transact) n.transact = { flow: 'both', copyOperator: true };
    if (n.holds.indexOf('tradeready') >= 0 && !n.tradeready) n.tradeready = { mode: 'inherit', certs: [] };
    if (n.holds.indexOf('dispute') >= 0 && !n.dispute) n.dispute = { informed: true };
  });
}
function _netKey(){ return 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4); }
function _netNode(key){ return (UI.net && UI.net.nodes || []).find(function(n){ return n.key === key; }); }
function loadNetwork(){ _netInit(); }   // override the legacy loader — design-first renders from the draft, no server fetch
function _netRerender(){   // keep the detail pane's scroll position stable across re-render (no more jumping)
  var p = (typeof document !== 'undefined') ? document.getElementById('netDetailPane') : null; var st = p ? p.scrollTop : 0;
  if (typeof renderApp === 'function') renderApp();
  var p2 = (typeof document !== 'undefined') ? document.getElementById('netDetailPane') : null; if (p2) p2.scrollTop = st;
}

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
  var n = { key: _netKey(), name: name.trim(), parent_key: parentKey, owned: true, holds: ['catalogue'], purpose: '', catalogue: { template: 'custom', fields: [] } };
  UI.net.nodes.push(n); UI.net.sel = n.key; UI.net.openCap = 'catalogue'; UI.net.built = false;
  _netSave(); _netRerender();
}
function netAddPartner(parentKey){
  _netInit(); if (!UI.net) return;
  var P = _netNode(parentKey); if (!P) return;
  var name = (typeof prompt === 'function') ? prompt('Partner — an INDEPENDENT business joining under "' + P.name + '" (you won\'t hold its key; its catalogue shows here):', '') : '';
  if (!name || !name.trim()) return;
  var n = { key: _netKey(), name: name.trim(), parent_key: parentKey, owned: false, holds: ['catalogue'], purpose: '', catalogue: { template: 'custom', fields: [] } };
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
    if (capKey === 'catalogue' && !n.catalogue) n.catalogue = { template: 'custom', fields: [] };
    if (capKey === 'storefront') { if (!n.exposure) n.exposure = 'public'; _ensureOrder(n); }
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
function _ensureCat(n){ if (!n.catalogue) n.catalogue = {}; return CBCatalogue.ensure(n.catalogue); }   // shape + migration live in the shared model
function netSetCatLoad(key, v){ var n = _netNode(key); if (!n) return; _ensureCat(n).loadedBy = v; _netMark(); _netRerender(); }
/* catalogue purpose (the story that drives the gap analysis) + feed-back destinations */
function netSetCatStory(key, v){ var n = _netNode(key); if (!n) return; _ensureCat(n).story = v; _netSave(); }   // no re-render while typing
function netAddFeedback(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).feedback.push({ system: '', format: '', onRail: false }); _netMark(); _netRerender(); }
function netDelFeedback(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).feedback.splice(i, 1); _netMark(); _netRerender(); }
function netSetFeedback(key, i, v){ var n = _netNode(key); if (!n) return; var fb = _ensureCat(n).feedback; if (i >= 0 && i < fb.length) { fb[i].system = v; _netMark(); } }   // no re-render while typing
function netCatTab(key, tab){ if (UI.net) UI.net.catTab = tab; _netRerender(); }   // which catalogue sub-panel is showing (few inputs at a time)
function netExportCat(key){   // export the node's catalogue draft as JSON — the harness (and later Build) reads this exact shape
  var n = _netNode(key); if (!n) return; var c = _ensureCat(n);
  var payload = { node: n.name, key: n.key, catalogue: c, order: (n.holds || []).indexOf('storefront') >= 0 ? _ensureOrder(n) : undefined };
  try {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'catalogue-' + ((c.product || 'draft').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'draft') + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 100);
    if (typeof toast === 'function') toast('Draft exported');
  } catch (e) { if (typeof toast === 'function') toast('Export failed'); }
}
/* catalogue Part B — known-as: the same item's local code/name in each system (a reference, never a mirror) */
function netAddRef(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).refs.push({ system: '', code: '' }); _netMark(); _netRerender(); }
function netDelRef(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).refs.splice(i, 1); _netMark(); _netRerender(); }
function netSetRef(key, i, prop, v){ var n = _netNode(key); if (!n) return; var r = _ensureCat(n).refs; if (i >= 0 && i < r.length) { r[i][prop] = v; _netMark(); if (prop === 'system') _netRerender(); } }   // code via oninput: no re-render
/* G3 · BOM — related line items a reorder cascades to */
function netAddBom(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).bom.push({ item: '', qty: 1 }); _netMark(); _netRerender(); }
function netDelBom(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).bom.splice(i, 1); _netMark(); _netRerender(); }
function netSetBom(key, i, prop, v){ var n = _netNode(key); if (!n) return; var b = _ensureCat(n).bom; if (i < 0 || i >= b.length) return; if (prop === 'qty') { var x = parseFloat(v); b[i].qty = (v === '' || isNaN(x) || x < 0) ? 0 : x; _netMark(); } else { b[i][prop] = v; _netMark(); } }   // item via oninput: no re-render
/* G1 · loop — when a watched signal crosses a threshold, take an action */
function netAddTrigger(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).triggers.push({ watch: 'stock', op: 'below', value: '', action: 'reorder', target: '' }); _netMark(); _netRerender(); }
function netDelTrigger(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).triggers.splice(i, 1); _netMark(); _netRerender(); }
function netSetTrigger(key, i, prop, v){ var n = _netNode(key); if (!n) return; var t = _ensureCat(n).triggers; if (i >= 0 && i < t.length) { t[i][prop] = v; _netMark(); if (prop === 'op' || prop === 'action') _netRerender(); } }   // text via oninput: no re-render
/* G4 · outbound adapter — the format + on/off-rail of each feed-back destination */
function netSetFeedbackFmt(key, i, prop, v){ var n = _netNode(key); if (!n) return; var fb = _ensureCat(n).feedback; if (i < 0 || i >= fb.length) return; if (prop === 'onRail') { fb[i].onRail = !fb[i].onRail; _netMark(); _netRerender(); } else { fb[i][prop] = v; _netMark(); } }   // format via oninput: no re-render
/* Part C · standards — external classification, by reference (HS / GS1 / Schema.org) */
function netAddStd(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).standards.push({ scheme: 'HS', code: '', label: '' }); _netMark(); _netRerender(); }
function netDelStd(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).standards.splice(i, 1); _netMark(); _netRerender(); }
function netSetStd(key, i, prop, v){ var n = _netNode(key); if (!n) return; var s = _ensureCat(n).standards; if (i >= 0 && i < s.length) { s[i][prop] = v; _netMark(); if (prop === 'scheme') _netRerender(); } }   // code/label via oninput: no re-render
/* Part D · pricing — governance context + priced entries (by ref / by value) */
function netSetContext(key, prop, v){ var n = _netNode(key); if (!n) return; _ensureCat(n).context[prop] = v; _netSave(); }   // currency/region text: no re-render while typing
function netAddPrice(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).pricing.push({ label: '', basis: 'global', by: 'ref', source: '', amount: null, currency: '', region: '', validFrom: '', validTo: '' }); _netMark(); _netRerender(); }
function netDelPrice(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).pricing.splice(i, 1); _netMark(); _netRerender(); }
function netSetPrice(key, i, prop, v){ var n = _netNode(key); if (!n) return; var p = _ensureCat(n).pricing; if (i < 0 || i >= p.length) return; if (prop === 'amount') { var x = parseFloat(v); p[i].amount = (v === '' || isNaN(x)) ? null : x; _netMark(); } else { p[i][prop] = v; _netMark(); if (prop === 'basis' || prop === 'by') _netRerender(); } }   // text via oninput: no re-render
/* catalogue Part A — identity + order (product · variants · base + alternative units) */
function netSetCatProduct(key, v){ var n = _netNode(key); if (!n) return; _ensureCat(n).product = v; _netSave(); }
function netSetBaseUnit(key, v){ var n = _netNode(key); if (!n) return; _ensureCat(n).baseUnit = v; _netSave(); }
function netAddVariant(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).variants.push({ name: '' }); _netMark(); _netRerender(); }
function netDelVariant(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).variants.splice(i, 1); _netMark(); _netRerender(); }
function netSetVariant(key, i, v){ var n = _netNode(key); if (!n) return; var a = _ensureCat(n).variants; if (i >= 0 && i < a.length) { a[i].name = v; _netMark(); } }
function netAddAltUnit(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).altUnits.push({ unit: '', num: 1, den: 1 }); _netMark(); _netRerender(); }
function netDelAltUnit(key, i){ var n = _netNode(key); if (!n) return; _ensureCat(n).altUnits.splice(i, 1); _netMark(); _netRerender(); }
function netSetAltUnit(key, i, prop, v){ var n = _netNode(key); if (!n) return; var a = _ensureCat(n).altUnits; if (i < 0 || i >= a.length) return; if (prop === 'num' || prop === 'den') { var x = parseInt(v, 10); a[i][prop] = (v === '' || isNaN(x) || x < 1) ? 1 : x; _netMark(); } else { a[i][prop] = v; _netMark(); } }
function _srcBacked(n, src){ if (src === 'manual') return true; if ((n.holds || []).indexOf('coassist') < 0) return false; var cc = _normCoassist(n.coassist); if (src === 'erp') return cc.erp.connectors.length > 0; if (src === 'iot') return (cc.iot.connections || []).length > 0; if (src === 'ai') return cc.ai.count > 0; return true; }
// A 'system feed' / 'computed' leg is only real if the node carries the matching co-assist (ERP connector, IoT connection, or AI slot).
function _legBacked(n, f){
  if (f.leg !== 'system' && f.leg !== 'compute') return true;
  if ((n.holds || []).indexOf('coassist') < 0) return false;
  var cc = _normCoassist(n.coassist);
  if (f.leg === 'compute') return f.via === 'ERP' ? cc.erp.connectors.length > 0 : cc.ai.count > 0;
  return f.via === 'IoT' ? (cc.iot.connections || []).length > 0 : cc.erp.connectors.length > 0;
}
function netSetCatTemplate(key, tpl){
  var n = _netNode(key); if (!n) return; var c = _ensureCat(n); c.template = tpl;
  var t = CAT_TEMPLATES[tpl]; if (t && tpl !== 'custom') { c.fields = t.fields.map(function(f){ return { name: f.name, source: f.source, type: f.type || 'text' }; }); if (t.baseUnit) c.baseUnit = t.baseUnit; if (!c.product) c.product = t.label; }
  _netMark(); _netRerender();
}
/* order form (lives under Storefront): commercial method + max + collect-back + how the CHIT arrives */
function _ensureOrder(n){
  if (!n.order) { var lc = n.catalogue || {}; n.order = { method: lc.method || 'cart', maxItems: (lc.maxItems != null ? lc.maxItems : null), collectBack: [], inlets: [] }; if (lc.method !== undefined) delete lc.method; if (lc.maxItems !== undefined) delete lc.maxItems; }
  if (!n.order.collectBack) n.order.collectBack = [];
  if (!n.order.inlets) n.order.inlets = [];
  if (n.order.chitChannel) { if (['WhatsApp', 'email', 'scan'].indexOf(n.order.chitChannel) >= 0) n.order.inlets.push({ channel: n.order.chitChannel, handle: '' }); delete n.order.chitChannel; }
  if (!n.order.method) n.order.method = 'cart';
  if (!n.order.attachments) n.order.attachments = [];
  if (!n.order.states) n.order.states = [];   // G2 · lifecycle states the chit moves through
  if (n.order.notes === undefined) n.order.notes = '';
  return n.order;
}
/* G2 · state machine — the ordered lifecycle states a chit moves through (open→fulfilled→closed) */
function netAddState(key){ var n = _netNode(key); if (!n) return; _ensureOrder(n).states.push({ name: '' }); _netMark(); _netRerender(); }
function netDelState(key, i){ var n = _netNode(key); if (!n) return; _ensureOrder(n).states.splice(i, 1); _netMark(); _netRerender(); }
function netSetState(key, i, v){ var n = _netNode(key); if (!n) return; var s = _ensureOrder(n).states; if (i >= 0 && i < s.length) { s[i].name = v; _netMark(); } }   // via oninput: no re-render
function netMoveState(key, i, dir){ var n = _netNode(key); if (!n) return; var s = _ensureOrder(n).states; var j = i + dir; if (i < 0 || i >= s.length || j < 0 || j >= s.length) return; var t = s[i]; s[i] = s[j]; s[j] = t; _netMark(); _netRerender(); }
function netSetOrderMethod(key, m){ var n = _netNode(key); if (!n) return; _ensureOrder(n).method = m; _netMark(); _netRerender(); }
function netSetOrderMax(key, v){ var n = _netNode(key); if (!n) return; var num = parseInt(v, 10); _ensureOrder(n).maxItems = (v === '' || isNaN(num)) ? null : num; _netSave(); }   // no re-render while typing
function netAddInlet(key){ var n = _netNode(key); if (!n) return; _ensureOrder(n).inlets.push({ channel: 'WhatsApp', handle: '' }); _netMark(); _netRerender(); }
function netDelInlet(key, i){ var n = _netNode(key); if (!n) return; _ensureOrder(n).inlets.splice(i, 1); _netMark(); _netRerender(); }
function netSetInlet(key, i, prop, val){ var n = _netNode(key); if (!n) return; var il = _ensureOrder(n).inlets; if (i >= 0 && i < il.length) { il[i][prop] = val; _netMark(); if (prop === 'channel') _netRerender(); } }   // handle via oninput: no re-render
function netAddAttach(key){ var n = _netNode(key); if (!n) return; _ensureOrder(n).attachments.push({ name: '' }); _netMark(); _netRerender(); }
function netDelAttach(key, i){ var n = _netNode(key); if (!n) return; _ensureOrder(n).attachments.splice(i, 1); _netMark(); _netRerender(); }
function netSetAttach(key, i, val){ var n = _netNode(key); if (!n) return; var a = _ensureOrder(n).attachments; if (i >= 0 && i < a.length) { a[i].name = val; _netMark(); } }   // no re-render while typing
function netSetOrderNotes(key, val){ var n = _netNode(key); if (!n) return; _ensureOrder(n).notes = val; _netSave(); }   // no re-render while typing
function netAddCollectBack(key){ var n = _netNode(key); if (!n) return; _ensureOrder(n).collectBack.push({ name: '', cadence: 'per order' }); _netMark(); _netRerender(); }
function netDelCollectBack(key, i){ var n = _netNode(key); if (!n) return; _ensureOrder(n).collectBack.splice(i, 1); _netMark(); _netRerender(); }
function netSetCollectBack(key, i, prop, val){ var n = _netNode(key); if (!n) return; var cb = _ensureOrder(n).collectBack; if (i >= 0 && i < cb.length) { cb[i][prop] = val; _netMark(); if (prop === 'cadence') _netRerender(); } }   // name via oninput: no re-render
function netAddCatField(key){ var n = _netNode(key); if (!n) return; _ensureCat(n).fields.push({ name: '', leg: 'cb', via: '', type: 'text' }); _netMark(); _netRerender(); }   // default leg = the gap CB fills
function netDelCatField(key, i){ var n = _netNode(key); if (!n) return; var c = _ensureCat(n); c.fields.splice(i, 1); _netMark(); _netRerender(); }
function netSetCatField(key, i, prop, val){ var n = _netNode(key); if (!n) return; var c = _ensureCat(n); var f = c.fields[i]; if (!f) return; f[prop] = val; if (prop === 'leg') f.via = (val === 'system' || val === 'compute') ? _viaFor(val)[0] : ''; _netMark(); if (prop !== 'name') _netRerender(); }   // name via oninput: no re-render
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
/* Build DRY-RUN — reads the design (via the shared model's deriveComputeJob) and shows the exact
   wiring plan against EXISTING capabilities. It CALLS NOTHING and mints NOTHING. The real mint is
   the gated next phase (human live-run). This is G7 (build contract) + the safe half of G8. */
function _buildPlanNode(n){
  var owned = !n.root && n.owned, partner = !n.owned, holds = n.holds || [], lines = [], warns = [];
  if (n.root) lines.push('anchor: the top entity (you) — no new entity');
  else if (owned) lines.push('register <b>entity</b> + issue a <b>login key</b> (co-assist pattern)');
  else lines.push('send a <b>handshake</b> — independent business, <b>no key held</b>');
  if (holds.indexOf('catalogue') >= 0) {
    var c = _ensureCat(n), job = CBCatalogue.deriveComputeJob(c);
    lines.push('catalogue <b>' + esc(c.product || '(unnamed)') + '</b> · ' + (c.variants || []).length + ' variant(s) · base ' + esc(c.baseUnit || '—'));
    if (job.standards.length) lines.push('· ' + job.standards.length + ' standard(s) <i>by reference</i> (' + job.standards.map(function(s){ return esc(s.scheme); }).join(', ') + ')');
    if (job.pricing.length) lines.push('· ' + job.pricing.length + ' price(s) in ' + esc([job.context.currency, job.context.region].filter(Boolean).join(' · ') || 'no context') + ' (' + job.pricing.map(function(p){ return p.by; }).join('/') + ')');
    if (job.feeds.length) lines.push('· bind ' + job.feeds.length + ' <b>system-fed</b> field(s) to connector(s)');
    if (job.computed.length) lines.push('· ' + job.computed.length + ' <b>computed</b> field(s) → co-assist computes, <b>rail seals</b>');
    if (job.fromCustomer.length) lines.push('· ' + job.fromCustomer.length + ' customer-collected field(s)');
    if (job.stored.length) lines.push('· ' + job.stored.length + ' CB-stored field(s) <i>(the gap)</i>');
    if (job.bom.length) lines.push('· ' + job.bom.length + ' BOM component(s)');
    if (job.triggers.length) lines.push('· wire ' + job.triggers.length + ' <b>loop</b> trigger(s)');
    if (job.feedback.length) lines.push('· ' + job.feedback.length + ' <b>feed-back adapter(s)</b>: ' + job.feedback.map(function(f){ return esc(f.system) + (f.onRail ? ' (chit)' : ' (' + esc(f.format || '?') + ')'); }).join(', '));
    (c.fields || []).forEach(function(f){ if ((f.leg === 'system' || f.leg === 'compute') && !_legBacked(n, f)) warns.push('“' + esc(f.name || '?') + '” needs ' + (f.leg === 'compute' ? esc(f.via) + ' (AI/ERP)' : 'a ' + esc(f.via) + ' connector') + ' this node doesn\'t carry'); });
    CBCatalogue.validate(c).issues.forEach(function(iss){ warns.push(esc(iss)); });
  }
  if (holds.indexOf('storefront') >= 0) { var o = _ensureOrder(n); lines.push('storefront: ' + esc(n.exposure || 'public') + ' · order ' + esc(o.method || 'cart') + ((o.states || []).length ? ' · ' + o.states.length + ' lifecycle state(s)' : '')); }
  if (holds.indexOf('coassist') >= 0) { var cc = _normCoassist(n.coassist); var p = []; if (cc.human.count) p.push(cc.human.count + ' human'); if ((cc.iot.connections || []).length) p.push((cc.iot.connections || []).length + ' IoT'); if (cc.erp.connectors.length) p.push(cc.erp.connectors.length + ' ERP'); if (cc.ai.count) p.push(cc.ai.count + ' AI slot'); lines.push('co-assists: ' + (p.join(' · ') || 'none set')); }
  if (holds.indexOf('transact') >= 0) { var tr = n.transact || {}; lines.push('transact: ' + esc(tr.flow || 'both') + (tr.copyOperator ? ' · copy operator (traceability + MIS)' : '')); }
  if (holds.indexOf('tradeready') >= 0) { var tt = n.tradeready || {}; lines.push('trade-ready: ' + (tt.mode === 'own' ? (tt.certs || []).length + ' own cert(s)' : 'inherit network certs')); }
  if (holds.indexOf('dispute') >= 0) { lines.push('dispute: ' + ((n.dispute || {}).informed ? 'informed party (per-party scoping)' : 'not involved')); }
  return { node: n, owned: owned, partner: partner, lines: lines, warns: warns };
}
function netBuild(){
  _netInit(); if (!UI.net) return;
  var nodes = (UI.net.nodes || []);
  var plans = nodes.map(_buildPlanNode);
  var t = { owned: 0, partners: 0, cat: 0, co: 0, trig: 0, adapt: 0, std: 0, price: 0, warn: 0 };
  plans.forEach(function(p){ if (p.owned) t.owned++; if (p.partner) t.partners++; t.warn += p.warns.length; });
  nodes.forEach(function(n){ var h = n.holds || []; if (h.indexOf('catalogue') >= 0) { var job = CBCatalogue.deriveComputeJob(_ensureCat(n)); t.cat++; t.trig += job.triggers.length; t.adapt += job.feedback.length; t.std += job.standards.length; t.price += job.pricing.length; } if (h.indexOf('coassist') >= 0) { var cc = _normCoassist(n.coassist); t.co += (cc.human.count ? 1 : 0) + cc.erp.connectors.length + (cc.iot.connections || []).length + (cc.ai.count ? 1 : 0); } });
  var chip = function(v, label){ return '<span style="display:inline-block;font-size:11.5px;background:#eef2f7;border-radius:6px;padding:2px 8px;margin:2px 4px 2px 0"><b>' + v + '</b> ' + label + '</span>'; };
  var totals = '<div style="padding:12px 16px;border-bottom:1px solid var(--line)">'
    + chip(t.owned, 'entities + keys') + chip(t.partners, 'partner handshake' + (t.partners === 1 ? '' : 's')) + chip(t.cat, 'catalogue' + (t.cat === 1 ? '' : 's')) + chip(t.co, 'co-assists') + chip(t.std, 'standards') + chip(t.price, 'prices') + chip(t.trig, 'triggers') + chip(t.adapt, 'adapters')
    + (t.warn ? '<span style="display:inline-block;font-size:11.5px;background:#fbeeec;color:#a5382e;border-radius:6px;padding:2px 8px;margin:2px 4px"><b>' + t.warn + '</b> ⚠ to resolve</span>' : '<span style="display:inline-block;font-size:11.5px;color:#2c7a43;padding:2px 8px">✓ no blockers</span>')
    + '</div>';
  var blocks = plans.filter(function(p){ return !p.node.root || p.lines.length > 1; }).map(function(p){
    var n = p.node;
    var badge = n.root ? 'ANCHOR' : (p.owned ? 'OWNED · entity+key' : 'PARTNER · handshake');
    var bcol = n.root ? '#6b6f86' : (p.owned ? '#2c5aa0' : '#8a5a1e');
    var rows = p.lines.map(function(l){ return '<div style="font-size:12px;color:#3a4048;line-height:1.55;padding:1px 0">' + (l.indexOf('·') === 0 ? '<span style="color:var(--grey);padding-left:12px">' + l + '</span>' : '▸ ' + l) + '</div>'; }).join('');
    var w = p.warns.length ? '<div style="margin-top:6px;padding:6px 9px;border:1px solid #e6c4bf;border-radius:7px;background:#fbeeec;font-size:11px;color:#a5382e">' + p.warns.map(function(x){ return '⚠ ' + x; }).join('<br>') + '</div>' : '';
    return '<div style="padding:11px 16px;border-bottom:1px solid var(--line)">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:13px">' + esc(n.name) + '</b><span style="font-size:9.5px;font-weight:700;letter-spacing:.03em;color:' + bcol + ';border:1px solid ' + bcol + '55;border-radius:4px;padding:1px 5px">' + badge + '</span></div>'
      + rows + w + '</div>';
  }).join('');
  var gate = '<div style="padding:13px 16px">'
    + '<div style="padding:11px 13px;border:1px solid #b7a3d6;border-radius:10px;background:#f7f4fc;font-size:12.5px;color:#5a4a86;line-height:1.6">🔒 <b>Dry-run — nothing was created.</b> This is the exact plan Build would run against the existing capabilities. The real mint (entities, keys, catalogue records, connector bindings) is the <b>gated next phase</b> and needs a <b>human live-run</b>.</div>'
    + '<button disabled style="margin-top:11px;width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);background:#eef1f5;color:#9aa2ad;font-weight:600;font-size:13px;cursor:not-allowed">🔨 Mint for real — human live-run required (not wired)</button>'
    + '</div>';
  var body = '<div style="max-height:66vh;overflow:auto">' + totals + blocks + gate + '</div>';
  if (typeof modal === 'function') modal('<div class="mhd"><div class="t">🔨 Build plan — dry-run</div></div><div class="mbody" style="padding:0">' + body + '</div>', true);
  else if (typeof toast === 'function') toast('Build dry-run ready.');
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
    + '<div id="netDetailPane" style="flex:1;overflow:auto;min-width:0">' + right + '</div></div>';
}
function _capSummary(n, k){
  if (k === 'catalogue') { var c = n.catalogue || {}; var nf = (c.fields || []).length; return nf + ' field' + (nf === 1 ? '' : 's') + ' · ' + (c.loadedBy || 'manual'); }
  if (k === 'storefront') { var o = n.order || {}; var ml = (CAT_METHODS.filter(function(x){ return x.k === (o.method || 'cart'); })[0] || {}).label || ''; return (n.exposure || 'public') + ' · ' + ml; }
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
  var legOpts = CAT_LEGS.map(function(l){ return '<option value="' + l.k + '"' + (f.leg === l.k ? ' selected' : '') + '>' + l.short + '</option>'; }).join('');
  var typOpts = CAT_TYPES.map(function(t){ return '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('');
  var viaSel = '';
  if (f.leg === 'system' || f.leg === 'compute') {
    var viaList = _viaFor(f.leg);
    var viaOpts = viaList.map(function(v){ return '<option value="' + v + '"' + ((f.via || viaList[0]) === v ? ' selected' : '') + '>' + v + '</option>'; }).join('');
    var ok = _legBacked(n, f);
    viaSel = '<select onchange="netSetCatField(\'' + n.key + '\',' + i + ',\'via\',this.value)" title="' + (ok ? 'co-assist present' : 'no matching co-assist on this node') + '" style="font-size:11px;padding:4px;border:1px solid ' + (ok ? 'var(--line)' : '#d98b84') + ';border-radius:6px;background:' + (ok ? '#fff' : '#fbeeec') + '">' + viaOpts + '</select>';
  }
  var col = (CAT_LEGS.filter(function(l){ return l.k === f.leg; })[0] || {}).col || ['#6b6f86', '#e8e9f0'];
  return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0;border-left:3px solid ' + col[0] + ';padding-left:7px">'
    + '<input value="' + esc(f.name || '') + '" oninput="netSetCatField(\'' + n.key + '\',' + i + ',\'name\',this.value)" placeholder="what you need to know" style="flex:1;min-width:0;font-size:12px;padding:5px 7px;border:1px solid var(--line);border-radius:6px">'
    + '<select onchange="netSetCatField(\'' + n.key + '\',' + i + ',\'leg\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + legOpts + '</select>'
    + viaSel
    + '<select onchange="netSetCatField(\'' + n.key + '\',' + i + ',\'type\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + typOpts + '</select>'
    + '<span onclick="netDelCatField(\'' + n.key + '\',' + i + ')" title="remove" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 4px">×</span>'
    + '</div>';
}
function _catConfig(n){
  var c = _ensureCat(n);
  var fields = (c.fields || []).map(function(f, i){ return _catFieldRow(n, f, i); }).join('') || '<div style="font-size:11px;color:var(--grey);padding:2px 0">No requirements yet — add what this catalogue must know, then route each to a leg.</div>';
  var loadOpts = CAT_LOADS.map(function(l){ return '<option value="' + l + '"' + ((c.loadedBy || 'manual') === l ? ' selected' : '') + '>' + l + '</option>'; }).join('');
  var unbacked = (c.fields || []).filter(function(f){ return (f.leg === 'system' || f.leg === 'compute') && !_legBacked(n, f); });
  var legNote = unbacked.length ? ('<div style="font-size:11px;color:#a5382e;margin-top:6px;border-top:1px dotted var(--line);padding-top:5px">⚠ ' + unbacked.length + ' field' + (unbacked.length > 1 ? 's' : '') + ' needing a co-assist that this node doesn\'t carry — add the ERP / IoT / AI co-assist, or route ' + (unbacked.length > 1 ? 'them' : 'it') + ' to another leg.</div>') : '';
  var legLegend = CAT_LEGS.map(function(l){ return '<span style="font-size:10px;color:' + l.col[0] + ';background:' + l.col[1] + ';border-radius:4px;padding:1px 6px;margin-right:4px">' + l.short + '</span>'; }).join('');
  var _in = 'font-size:11.5px;padding:5px 7px;border:1px solid var(--line);border-radius:6px';
  var variantRows = (c.variants || []).map(function(v, i){ return '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><input value="' + esc(v.name || '') + '" oninput="netSetVariant(\'' + n.key + '\',' + i + ',this.value)" placeholder="variant (e.g. Sunlit Ivory · Matte · 4L)" style="flex:1;min-width:0;' + _in + '"><span onclick="netDelVariant(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('');
  var altRows = (c.altUnits || []).map(function(u, i){ return '<div style="display:flex;gap:4px;align-items:center;padding:2px 0"><input value="' + esc(u.unit || '') + '" oninput="netSetAltUnit(\'' + n.key + '\',' + i + ',\'unit\',this.value)" placeholder="unit" style="width:66px;' + _in + '"><span style="font-size:10px;color:var(--grey)">1=</span><input type="number" min="1" value="' + (u.num || 1) + '" oninput="netSetAltUnit(\'' + n.key + '\',' + i + ',\'num\',this.value)" style="width:48px;' + _in + '"><span style="font-size:10px;color:var(--grey)">/</span><input type="number" min="1" value="' + (u.den || 1) + '" oninput="netSetAltUnit(\'' + n.key + '\',' + i + ',\'den\',this.value)" style="width:48px;' + _in + '"><span style="font-size:10px;color:var(--grey)">' + esc(c.baseUnit || 'base') + '</span><span onclick="netDelAltUnit(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('');
  var partA = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">A · IDENTITY + ORDER</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:8px">Product (browse name)</label>'
    + '<input value="' + esc(c.product || '') + '" oninput="netSetCatProduct(\'' + n.key + '\',this.value)" placeholder="product / family name" style="width:100%;margin-top:4px;box-sizing:border-box;' + _in + '">'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:9px">Variants <span style="color:var(--faint,#8a929e)">(the orderable unit — the chit freezes the variant; none = product is its own)</span></label>'
    + variantRows + '<div onclick="netAddVariant(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:4px 0">＋ variant</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:6px">Base unit <span style="color:var(--faint,#8a929e)">(lowest indivisible — kg, litre)</span></label>'
    + '<input value="' + esc(c.baseUnit || '') + '" oninput="netSetBaseUnit(\'' + n.key + '\',this.value)" placeholder="e.g. kg" style="width:120px;margin-top:4px;' + _in + '">'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:9px">Alternative units <span style="color:var(--faint,#8a929e)">(integer conversion — 1 crate = 20/1 kg)</span></label>'
    + altRows + '<div onclick="netAddAltUnit(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:4px 0">＋ unit</div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:2px">Orderable unit is resolved by the buyer\'s tier; unit + factor freeze on the chit.</div>';
  var refRows = (c.refs || []).map(function(r, i){ return '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><input value="' + esc(r.system || '') + '" oninput="netSetRef(\'' + n.key + '\',' + i + ',\'system\',this.value)" placeholder="system (ERP, Tally, Supplier A)" style="width:150px;' + _in + '"><input value="' + esc(r.code || '') + '" oninput="netSetRef(\'' + n.key + '\',' + i + ',\'code\',this.value)" placeholder="their code / local name" style="flex:1;min-width:0;' + _in + '"><span onclick="netDelRef(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('');
  var partB = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:14px;border-top:1px solid var(--line);padding-top:9px">B · KNOWN AS <span style="font-weight:500;color:var(--faint,#8a929e);letter-spacing:0">(the same item — its name in each system)</span></div>'
    + refRows + '<div onclick="netAddRef(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:4px 0">＋ system name</div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:2px">CB stores the reference {system · their code}, not their data — so it can gather from, and order in, each system\'s own name.</div>';
  var bomRows = (c.bom || []).map(function(b, i){ return '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><input value="' + esc(b.item || '') + '" oninput="netSetBom(\'' + n.key + '\',' + i + ',\'item\',this.value)" placeholder="component / related item" style="flex:1;min-width:0;' + _in + '"><span style="font-size:10px;color:var(--grey)">×</span><input type="number" min="0" step="any" value="' + (b.qty != null ? b.qty : 1) + '" oninput="netSetBom(\'' + n.key + '\',' + i + ',\'qty\',this.value)" style="width:64px;' + _in + '"><span style="font-size:10px;color:var(--grey)">' + esc(c.baseUnit || 'unit') + '</span><span onclick="netDelBom(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('');
  var partBOM = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:14px;border-top:1px solid var(--line);padding-top:9px">MADE OF <span style="font-weight:500;color:var(--faint,#8a929e);letter-spacing:0">(related line items — a reorder cascades to these)</span></div>'
    + bomRows + '<div onclick="netAddBom(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:4px 0">＋ component</div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:2px">Ordering the parent proposes its components (a BOM), not a full MRP explosion.</div>';
  // Part C · standards (by reference)
  var stdRows = (c.standards || []).map(function(s, i){ var scOpts = STD_SCHEMES.map(function(x){ return '<option' + (s.scheme === x ? ' selected' : '') + '>' + x + '</option>'; }).join(''); return '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><select onchange="netSetStd(\'' + n.key + '\',' + i + ',\'scheme\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + scOpts + '</select><input value="' + esc(s.code || '') + '" oninput="netSetStd(\'' + n.key + '\',' + i + ',\'code\',this.value)" placeholder="code (e.g. 8544.49)" style="width:120px;' + _in + '"><input value="' + esc(s.label || '') + '" oninput="netSetStd(\'' + n.key + '\',' + i + ',\'label\',this.value)" placeholder="what it classifies (optional)" style="flex:1;min-width:0;' + _in + '"><span onclick="netDelStd(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('');
  var partStd = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:14px;border-top:1px solid var(--line);padding-top:9px">C · STANDARDS <span style="font-weight:500;color:var(--faint,#8a929e);letter-spacing:0">(classification — by reference, never mirrored)</span></div>'
    + stdRows + '<div onclick="netAddStd(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:4px 0">＋ standard</div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:2px">HS / GS1 / Schema.org codes point OUT to the authority; CB holds the reference, not the scheme.</div>';
  // Part D · pricing (governance context + by ref / by value)
  var ctx = c.context || { currency: '', region: '' };
  var priceRows = (c.pricing || []).map(function(p, i){
    var basisOpts = PRICE_BASIS.map(function(b){ return '<option' + (p.basis === b ? ' selected' : '') + '>' + b + '</option>'; }).join('');
    var byOpts = PRICE_BY.map(function(b){ return '<option value="' + b + '"' + (p.by === b ? ' selected' : '') + '>by ' + b + '</option>'; }).join('');
    var valField = p.by === 'value'
      ? '<input type="number" step="any" value="' + (p.amount != null ? p.amount : '') + '" oninput="netSetPrice(\'' + n.key + '\',' + i + ',\'amount\',this.value)" placeholder="amount" style="width:88px;' + _in + '"><input value="' + esc(p.currency || '') + '" oninput="netSetPrice(\'' + n.key + '\',' + i + ',\'currency\',this.value)" placeholder="' + esc(ctx.currency || 'ccy') + '" style="width:56px;' + _in + '">'
      : '<input value="' + esc(p.source || '') + '" oninput="netSetPrice(\'' + n.key + '\',' + i + ',\'source\',this.value)" placeholder="source ref (LBMA fix · SAP ZPR0 · buyer offer)" style="flex:1;min-width:0;' + _in + '">';
    return '<div style="border:1px solid var(--line);border-radius:8px;padding:7px 9px;margin-top:6px">'
      + '<div style="display:flex;gap:6px;align-items:center"><input value="' + esc(p.label || '') + '" oninput="netSetPrice(\'' + n.key + '\',' + i + ',\'label\',this.value)" placeholder="price label (list · trade · spot)" style="flex:1;min-width:0;' + _in + '"><span onclick="netDelPrice(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
      + '<div style="display:flex;gap:6px;align-items:center;margin-top:5px"><select onchange="netSetPrice(\'' + n.key + '\',' + i + ',\'basis\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + basisOpts + '</select><select onchange="netSetPrice(\'' + n.key + '\',' + i + ',\'by\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + byOpts + '</select>' + valField + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center;margin-top:5px;font-size:10px;color:var(--grey)">valid <input type="date" value="' + esc(p.validFrom || '') + '" onchange="netSetPrice(\'' + n.key + '\',' + i + ',\'validFrom\',this.value)" style="' + _in + '">→<input type="date" value="' + esc(p.validTo || '') + '" onchange="netSetPrice(\'' + n.key + '\',' + i + ',\'validTo\',this.value)" style="' + _in + '"> · region <input value="' + esc(p.region || '') + '" oninput="netSetPrice(\'' + n.key + '\',' + i + ',\'region\',this.value)" placeholder="' + esc(ctx.region || 'inherit') + '" style="width:78px;' + _in + '"><span style="margin-left:auto;font-size:9.5px;font-weight:600;color:' + (p.by === 'value' ? '#2c7a43' : '#8a5cc4') + '">' + (p.by === 'value' ? 'frozen' : 'loose · resolves at seal') + '</span></div>'
      + '</div>';
  }).join('') || '<div style="font-size:11px;color:var(--grey);padding:2px 0">No prices — information-only catalogue.</div>';
  var partPricing = '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px"><b style="font-weight:800;color:#2c5aa0;letter-spacing:.05em">D · PRICING</b> <span style="color:var(--faint,#8a929e)">— governed by context; by ref (loose) or by value (frozen)</span></label>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;padding:6px 9px;border:1px dashed var(--line);border-radius:8px;background:#fbfdff"><span style="font-size:10.5px;color:var(--grey)">Context governs →</span><input value="' + esc(ctx.currency || '') + '" oninput="netSetContext(\'' + n.key + '\',\'currency\',this.value)" placeholder="currency (INR)" style="width:108px;' + _in + '"><input value="' + esc(ctx.region || '') + '" oninput="netSetContext(\'' + n.key + '\',\'region\',this.value)" placeholder="region (IN)" style="width:108px;' + _in + '"></div>'
    + priceRows + '<div onclick="netAddPrice(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:5px 0">＋ price</div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:2px">Currency &amp; region inherit the context unless overridden. A by-ref price (and its FX rate) freezes only when the chit is sealed.</div>';
  var fbRows = (c.feedback || []).map(function(fb, i){
    var onRail = !!fb.onRail;
    var railBtn = '<span onclick="netSetFeedbackFmt(\'' + n.key + '\',' + i + ',\'onRail\')" title="is this party on C&B?" style="cursor:pointer;font-size:10px;font-weight:700;padding:3px 9px;border-radius:12px;border:1px solid ' + (onRail ? '#2c7a43' : 'var(--line)') + ';color:' + (onRail ? '#fff' : 'var(--grey)') + ';background:' + (onRail ? '#2c7a43' : '#fff') + '">' + (onRail ? 'on C&B' : 'off-rail') + '</span>';
    var fmt = onRail ? '<span style="font-size:11px;color:#2c7a43;flex:1">native chit — CB delivers it directly</span>' : '<input value="' + esc(fb.format || '') + '" oninput="netSetFeedbackFmt(\'' + n.key + '\',' + i + ',\'format\',this.value)" placeholder="their format (EDI 850, cXML PO, PDF…)" style="flex:1;min-width:0;' + _in + '">';
    return '<div style="border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin-top:5px"><div style="display:flex;gap:6px;align-items:center"><input value="' + esc(fb.system || '') + '" oninput="netSetFeedback(\'' + n.key + '\',' + i + ',this.value)" placeholder="system / party to feed back (SAP, Supplier A)" style="flex:1;min-width:0;' + _in + '">' + railBtn + '<span onclick="netDelFeedback(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div><div style="display:flex;gap:6px;align-items:center;margin-top:5px">' + fmt + '</div></div>';
  }).join('');
  var trigRows = (c.triggers || []).map(function(t, i){
    var opSel = ['below', 'above', 'equals'].map(function(o){ return '<option' + (t.op === o ? ' selected' : '') + '>' + o + '</option>'; }).join('');
    var actSel = ['reorder', 'alert', 'feed back'].map(function(a){ return '<option' + (t.action === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    var sm = 'font-size:11px;padding:4px 5px;border:1px solid var(--line);border-radius:6px';
    return '<div style="border:1px solid var(--line);border-radius:8px;padding:7px 9px;margin-top:5px;display:flex;gap:5px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--grey)">'
      + 'When <input value="' + esc(t.watch || '') + '" oninput="netSetTrigger(\'' + n.key + '\',' + i + ',\'watch\',this.value)" placeholder="stock" style="width:78px;' + sm + '">'
      + ' is <select onchange="netSetTrigger(\'' + n.key + '\',' + i + ',\'op\',this.value)" style="' + sm + '">' + opSel + '</select>'
      + ' <input value="' + esc(t.value || '') + '" oninput="netSetTrigger(\'' + n.key + '\',' + i + ',\'value\',this.value)" placeholder="EOQ / min" style="width:70px;' + sm + '">'
      + ' → <select onchange="netSetTrigger(\'' + n.key + '\',' + i + ',\'action\',this.value)" style="' + sm + '">' + actSel + '</select>'
      + ' to <input value="' + esc(t.target || '') + '" oninput="netSetTrigger(\'' + n.key + '\',' + i + ',\'target\',this.value)" placeholder="supplier / system" style="width:110px;' + sm + '">'
      + '<span onclick="netDelTrigger(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px;margin-left:auto">×</span></div>';
  }).join('') || '<div style="font-size:11px;color:var(--grey);padding:2px 0">No triggers — the catalogue is static (a human decides when to act).</div>';
  // ---- five focused tabs: a human fills a few things at a time (no more one long scroll) ----
  var tab = (UI.net && UI.net.catTab) || 'purpose';
  var nfields = (c.fields || []).length;
  var TABS = [
    { k: 'purpose', label: 'Purpose' },
    { k: 'identity', label: 'Identity' },
    { k: 'reqs', label: 'Requirements' + (nfields ? ' · ' + nfields : '') },
    { k: 'pricing', label: 'Pricing' + ((c.pricing || []).length ? ' · ' + c.pricing.length : '') },
    { k: 'loop', label: 'Loop' + ((c.triggers || []).length ? ' · ' + c.triggers.length : '') },
    { k: 'feedback', label: 'Feed back' + ((c.feedback || []).length ? ' · ' + c.feedback.length : '') },
    { k: 'chain', label: '🔗 Chain' },
  ];
  var tabBar = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:9px">' + TABS.map(function(t){ var on = tab === t.k;
    return '<span onclick="netCatTab(\'' + n.key + '\',\'' + t.k + '\')" style="cursor:pointer;font-size:11px;font-weight:600;padding:4px 11px;border-radius:14px;border:1px solid ' + (on ? '#2c5aa0' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--grey)') + ';background:' + (on ? '#2c5aa0' : '#fff') + '">' + t.label + '</span>'; }).join('') + '</div>';
  var body = '';
  if (tab === 'purpose') {
    body = '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px">Purpose <span style="color:var(--faint,#8a929e)">(what this catalogue is for — in your words)</span></label>'
      + '<textarea oninput="netSetCatStory(\'' + n.key + '\',this.value)" onchange="netCatTab(\'' + n.key + '\',\'purpose\')" placeholder="e.g. Gather stock from ERP + Tally, work out the reorder, and send POs to my suppliers by EOQ." rows="3" style="width:100%;margin-top:4px;box-sizing:border-box;resize:vertical;' + _in + '">' + esc(c.story || '') + '</textarea>'
      + '<div style="margin-top:6px;padding:7px 9px;border:1px dashed #b7a3d6;border-radius:8px;background:#f7f4fc;font-size:10.5px;color:#6a4fa0">🤖 An AI assistant will read this, pull the canonical fields for this material / service, check them against your existing systems, and propose the routing. <i>Wiring later — route by hand for now.</i></div>'
      + _catInfer(n)
      + '<div style="font-size:10.5px;color:var(--grey);margin-top:8px">Next: <b>Identity</b> → name the product · <b>Requirements</b> → route each field · <b>Feed back</b> → where it goes · <b>Chain</b> → the finished picture.</div>';
  } else if (tab === 'identity') {
    body = partA + partB + partStd + partBOM;
  } else if (tab === 'pricing') {
    body = partPricing;
  } else if (tab === 'loop') {
    body = '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px"><b style="font-weight:800;color:#2c5aa0;letter-spacing:.05em">LOOP</b> <span style="color:var(--faint,#8a929e)">— when a watched signal crosses a threshold, act automatically</span></label>'
      + trigRows + '<div onclick="netAddTrigger(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:5px 0">＋ trigger</div>'
      + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:2px">The signal is usually a Computed value (e.g. EOQ) or a System-fed one (e.g. stock). The action fires down a Feed-back destination.</div>';
  } else if (tab === 'reqs') {
    body = '<div style="margin-top:10px"><b style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">REQUIREMENTS</b> <span style="color:var(--faint,#8a929e)">— what you need to know, and where each part comes from</span></div>'
      + '<div style="margin:6px 0 2px">' + legLegend + '</div>'
      + fields
      + '<div onclick="netAddCatField(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ requirement</div>'
      + legNote
      + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px">List is built by <span style="color:var(--faint,#8a929e)">(how the catalogue itself is loaded)</span></label>'
      + '<select onchange="netSetCatLoad(\'' + n.key + '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px">' + loadOpts + '</select>';
  } else if (tab === 'feedback') {
    body = '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px"><b style="font-weight:800;color:#2c5aa0;letter-spacing:.05em">FEED BACK</b> <span style="color:var(--faint,#8a929e)">— once complete, push the record to these systems (with a receipt)</span></label>'
      + fbRows + '<div onclick="netAddFeedback(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:11.5px;font-weight:600;padding:4px 0">＋ system to feed back</div>'
      + '<div style="font-size:10.5px;color:var(--grey);margin-top:6px">Nothing here = CB is the end of the chain (it just holds the record).</div>';
  } else {
    body = _catChain(n) + _catRecordPreview(n)
      + '<div onclick="netExportCat(\'' + n.key + '\')" style="cursor:pointer;display:inline-block;margin-top:10px;font-size:11.5px;font-weight:600;color:var(--blue);border:1px solid var(--line);border-radius:7px;padding:5px 11px">⤓ Export draft (JSON)</div>'
      + '<div style="font-size:10.5px;color:var(--grey);margin-top:4px">Feeds the compute→seal harness — the design drives the run.</div>';
  }
  return '<div style="margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-left:3px solid #2c5aa0;border-radius:10px;background:#fbfdff">'
    + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">🗂️ CATALOGUE — complete the information chain</div>'
    + tabBar
    + '<div style="margin-top:6px">' + body + '</div>'
    + '</div>';
}
function _methodControl(m){
  var inp = 'display:inline-block;border:1px solid var(--line);border-radius:5px;padding:2px 8px;font-size:11.5px;color:var(--grey);background:#f5f7f9';
  var btn = 'display:inline-block;background:#2c5aa0;color:#fff;border-radius:5px;padding:3px 10px;font-size:11.5px;font-weight:600';
  if (m === 'text') return '<span style="font-size:11.5px;color:var(--grey)">Information only — nothing to order.</span>';
  if (m === 'qty') return '<span style="' + inp + '">Qty ▢</span> &nbsp; <span style="' + btn + '">Order</span>';
  if (m === 'cart') return '<span style="' + inp + '">Qty ▢</span> <span style="font-size:11.5px;color:var(--grey)">× ₹ price</span> &nbsp; <span style="' + btn + '">Add to cart</span>';
  if (m === 'range') return '<div style="font-size:11.5px;color:var(--grey)">₹ min ──●────── ₹ max</div><div style="margin-top:5px"><span style="' + inp + '">Qty ▢</span> &nbsp; <span style="' + btn + '">Order</span></div>';
  if (m === 'qtyprice') return '<span style="' + inp + '">Qty ▢</span> <span style="' + inp + '">Your price ▢</span> &nbsp; <span style="' + btn + '">Send offer</span>';
  return '';
}
function _methodPreview(m){
  var inner = _methodControl(m); if (!inner) return '';
  return '<div style="margin-top:6px;padding:9px 10px;border:1px dashed var(--line-strong,#c8d0d9);border-radius:8px;background:#fff"><div style="font-size:10px;color:var(--faint,#8a929e);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Customer sees</div>' + inner + '</div>';
}
/* ---- the REAL OUTPUT visuals ---- */
function _sampleVal(type){ if (type === 'number') return '123.4'; if (type === 'choice') return 'A'; if (type === 'range') return '10–20'; if (type === 'date') return '2026-07-25'; return 'text'; }
function _srcBadge(src){
  var m = { erp: ['#b07b1e', '#f6ecd8'], iot: ['#22857a', '#daf0ec'], ai: ['#8a5cc4', '#efeafa'], manual: ['#6b6f86', '#e8e9f0'] };
  var col = m[src] || m.manual;
  return '<span style="font-size:9px;font-weight:700;text-transform:uppercase;color:' + col[0] + ';background:' + col[1] + ';border-radius:4px;padding:1px 5px">' + esc(src) + '</span>';
}
function _legBadge(leg){
  var l = CAT_LEGS.filter(function(x){ return x.k === leg; })[0] || { short: '—', col: ['#6b6f86', '#e8e9f0'] };
  return '<span style="font-size:9px;font-weight:700;text-transform:uppercase;color:' + l.col[0] + ';background:' + l.col[1] + ';border-radius:4px;padding:1px 5px">' + esc(l.short) + '</span>';
}
/* the headline: the four-leg information chain, drawn from the routed requirements */
function _catChain(n){
  var c = n.catalogue || {}; var fs = c.fields || [];
  var _cx = c.context || {}; var ctxLabel = [_cx.currency, _cx.region].filter(Boolean).map(esc).join(' · ');
  var chip = function(txt, col){ return '<span style="display:inline-block;font-size:10.5px;color:#1c2128;background:' + col[1] + ';border:1px solid ' + col[0] + '55;border-radius:5px;padding:1px 6px;margin:2px 3px 0 0">' + esc(txt) + '</span>'; };
  var fb = (c.feedback || []).filter(function(x){ return x.system; });
  if (!fs.length && !c.product && !fb.length) return '';
  var fbCol = ['#6a4fa0', '#efeafa'];
  var card = function(head, hint, col, itemsHtml, count){
    return '<div style="flex:1;min-width:118px;border:1px solid var(--line);border-top:3px solid ' + col[0] + ';border-radius:9px;padding:8px 9px;background:#fff">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:' + col[0] + '">' + esc(head) + ' <span style="color:var(--faint,#8a929e)">' + count + '</span></div>'
      + '<div style="font-size:9.5px;color:var(--grey);margin:1px 0 4px">' + esc(hint) + '</div>'
      + (itemsHtml || '<span style="font-size:10px;color:var(--faint,#8a929e)">—</span>')
      + '</div>';
  };
  var cards = CAT_LEGS.map(function(l){
    var items = fs.filter(function(f){ return f.leg === l.k; }).map(function(f){ return chip((f.name || '—') + ((l.k === 'system' || l.k === 'compute') && f.via ? ' · ' + f.via : ''), l.col); });
    if (l.k === 'cb') {   // identity + units are always CB-stored (the gap CB fills by definition)
      if (c.baseUnit) items.unshift(chip('units · ' + c.baseUnit, l.col));
      if (c.product) items.unshift(chip(c.product + ' (identity)', l.col));
    }
    return card(l.short, l.hint, l.col, items.join(''), items.length);
  }).join('');
  cards += card('Feed back', 'record pushed out', fbCol, fb.map(function(x){ return chip(x.system + (x.onRail ? ' · C&B' : (x.format ? ' · ' + x.format : '')), fbCol); }).join(''), fb.length);
  var trigs = (c.triggers || []).filter(function(t){ return t.watch || t.value; });
  var loopBanner = trigs.length ? ('<div style="margin-top:8px;padding:6px 10px;border:1px solid #cdbfe6;border-radius:8px;background:#f7f4fc;font-size:11px;color:#6a4fa0">⟳ ' + trigs.map(function(t){ return 'when <b>' + esc(t.watch || '?') + '</b> ' + esc(t.op || '') + ' <b>' + esc(t.value || '?') + '</b> → <b>' + esc(t.action || '') + '</b>' + (t.target ? ' to ' + esc(t.target) : ''); }).join(' · ') + '</div>') : '';
  var bomList = (c.bom || []).filter(function(b){ return b.item; });
  var bomBanner = bomList.length ? ('<div style="margin-top:6px;font-size:10.5px;color:var(--grey)">Made of: ' + bomList.map(function(b){ return esc(b.item) + '×' + (b.qty != null ? b.qty : 1); }).join(' · ') + ' <i>(reorder cascades)</i></div>') : '';
  var stds = (c.standards || []).filter(function(s){ return s.code || s.label; });
  var stdBanner = stds.length ? ('<div style="margin-top:6px;font-size:10.5px;color:var(--grey)">Standards: ' + stds.map(function(s){ return esc(s.scheme) + ' ' + esc(s.code || s.label); }).join(' · ') + ' <i>(by reference)</i></div>') : '';
  var prices = (c.pricing || []).filter(function(p){ return p.label || p.amount != null || p.source; });
  var priceBanner = prices.length ? ('<div style="margin-top:6px;font-size:10.5px;color:var(--grey)">Pricing: ' + prices.map(function(p){ var r = CBCatalogue.resolvePrice(c, p); return esc(r.label) + ' — ' + (p.by === 'value' ? (r.amount != null ? r.amount + ' ' + esc(r.currency || '') : 'value') : esc(p.source || 'ref')) + ' <i>[' + (p.by === 'value' ? 'frozen' : 'ref') + ']</i>'; }).join(' · ') + (ctxLabel ? ' · in ' + ctxLabel : '') + '</div>') : '';
  return '<div style="margin-top:12px;padding-top:9px;border-top:1px solid var(--line)">'
    + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-bottom:6px">🔗 INFORMATION CHAIN — how this catalogue is completed</div>'
    + '<div style="display:flex;gap:7px;flex-wrap:wrap">' + cards + '</div>'
    + loopBanner + bomBanner + stdBanner + priceBanner + '</div>';
}
/* a first, honest reading of the purpose story — rule-based today, the AI takes this over later */
function _catInfer(n){
  var s = ((n.catalogue || {}).story || '').toLowerCase();
  if (!s.trim()) return '';
  var systems = ['erp', 'sap', 'oracle', 'netsuite', 'dynamics', 'tally', 'quickbooks', 'zoho'].filter(function(t){ return s.indexOf(t) >= 0; });
  var feedsBack = /supplier|vendor|purchase order|\bpo\b|reorder|replenish|feed ?back|send.*to my/.test(s);
  var fromCust = /customer|buyer|client|order from|they send|storefront/.test(s);
  var computes = [];
  if (/eoq|reorder|replenish|economic order|min.?max|stock level/.test(s)) computes.push('reorder / EOQ');
  if (/combine|combined|consolidat|merge|aggregat/.test(s)) computes.push('combined view');
  var bits = [];
  if (systems.length) bits.push('<b style="color:#b07b1e">System feed</b> — ' + systems.map(function(x){ return x.toUpperCase(); }).join(', '));
  if (fromCust) bits.push('<b style="color:#2b6f8f">From customer</b> — order details at request time');
  if (computes.length) bits.push('<b style="color:#8a5cc4">Computed</b> — ' + computes.join(', ') + ' (a co-assist computes, the rail seals)');
  bits.push('<b style="color:#2c7a43">Store in CB</b> — the consolidated record (the gap CB fills)');
  if (feedsBack) bits.push('<b style="color:#6a4fa0">Feed back</b> — suppliers / the named system');
  return '<div style="margin-top:8px;padding:8px 10px;border:1px solid #bcd0e8;border-radius:8px;background:#f2f7fd">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#2c5aa0;margin-bottom:4px">Reading your purpose <span style="font-weight:500;color:var(--grey);text-transform:none">— a first guess; confirm it as you route the requirements</span></div>'
    + '<div style="font-size:11px;color:#1c2128;line-height:1.6">' + bits.join('<br>') + '</div></div>';
}
function _catRecordPreview(n){
  var c = n.catalogue || {}; var fs = c.fields || [];
  if (!fs.length && !c.product) return '';
  var name = c.product || (CAT_TEMPLATES[c.template] || {}).label || 'Item';
  var v0 = (c.variants || [])[0];
  var au = (c.altUnits || [])[0];
  var unitLine = c.baseUnit ? ('base ' + esc(c.baseUnit) + (au && au.unit ? ' · 1 ' + esc(au.unit) + ' = ' + (au.num || 1) + '/' + (au.den || 1) + ' ' + esc(c.baseUnit) : '')) : '';
  var refs = (c.refs || []).filter(function(r){ return r.system && r.code; });
  var refsLine = refs.length ? refs.map(function(r){ return esc(r.system) + ':' + esc(r.code); }).join(' · ') : '';
  var rows = fs.map(function(f){ return '<div style="display:flex;align-items:center;gap:8px;padding:2px 0;font-size:11.5px"><span style="flex:0 0 116px;color:var(--grey);font-family:monospace;overflow:hidden;text-overflow:ellipsis">' + esc(f.name || '—') + '</span><span style="flex:1;color:#1c2128">' + _sampleVal(f.type) + '</span>' + _legBadge(f.leg) + '</div>'; }).join('');
  return '<div style="margin-top:12px;padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:#fff">'
    + '<div style="font-size:10px;color:var(--faint,#8a929e);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">📄 Stored as a record — one item</div>'
    + '<div style="font-weight:700;font-size:12.5px">' + esc(name) + (v0 && v0.name ? ' <span style="font-weight:500;color:var(--grey);font-size:11px">▸ ' + esc(v0.name) + '</span>' : '') + '</div>'
    + (unitLine ? '<div style="font-size:10.5px;color:var(--grey);font-family:monospace;margin:2px 0 2px">' + unitLine + '</div>' : '')
    + (refsLine ? '<div style="font-size:10px;color:var(--faint,#8a929e);font-family:monospace;margin:1px 0 5px">known as ' + refsLine + '</div>' : '<div style="margin-bottom:4px"></div>')
    + rows
    + '<div style="border-top:1px dashed var(--line);margin-top:6px;padding-top:5px;font-size:10.5px;color:var(--grey);font-family:monospace">🔒 sealed · content_hash a1b2c3…  ·  loaded by ' + esc(c.loadedBy || 'manual') + '</div>'
    + '</div>';
}
function _chitPreview(n){
  var c = n.catalogue || {}; var fs = c.fields || [];
  var o = _ensureOrder(n);
  var e = n.exposure || 'public';
  var name = c.product || 'Item';
  var expBadge = '<span style="font-size:9px;font-weight:700;text-transform:uppercase;color:' + (e === 'public' ? '#2c7a43' : '#8a5a1e') + ';background:' + (e === 'public' ? '#e6f4ec' : '#f6ecd8') + ';border-radius:4px;padding:1px 5px">' + esc(e) + '</span>';
  var specRows = fs.slice(0, 6).map(function(f){ return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0"><span style="color:var(--grey)">' + esc(f.name || '—') + '</span><span style="color:var(--faint,#8a929e);font-family:monospace">' + _sampleVal(f.type) + '</span></div>'; }).join('') || '<div style="font-size:11px;color:var(--grey)">no fields</div>';
  var cb = (o.collectBack || []).filter(function(x){ return x.name; });
  var collectLine = cb.length ? '<div style="margin-top:7px;font-size:10.5px;color:#2b6f8f">You provide: <b>' + cb.map(function(x){ return esc(x.name); }).join(', ') + '</b></div>' : '';
  var arrive = ['on the rail'].concat((o.inlets || []).filter(function(x){ return x.channel; }).map(function(x){ return x.channel; })).join(' · ');
  var st = (o.states || []).filter(function(x){ return x.name; });
  var stateFlow = st.length ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px;align-items:center">' + st.map(function(x, i){ return (i ? '<span style="color:var(--faint,#8a929e);font-size:10px">→</span>' : '') + '<span style="font-size:9.5px;font-weight:600;color:#3a4048;background:#eef1f5;border-radius:4px;padding:1px 6px">' + esc(x.name) + '</span>'; }).join('') + '</div>' : '';
    + '<div style="margin-top:7px;max-width:290px;border:1px solid var(--line);border-top:3px solid #2c5aa0;border-radius:11px;box-shadow:0 1px 3px rgba(20,30,45,.08);padding:12px 13px;background:#fff">'
      + '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;font-size:13px">' + esc(name) + '</span>' + expBadge + '</div>'
      + '<div style="margin-top:6px">' + specRows + '</div>'
      + '<div style="margin-top:9px">' + _methodControl(o.method) + '</div>'
      + collectLine
      + stateFlow
      + '<div style="border-top:1px dashed var(--line);margin-top:9px;padding-top:5px;font-size:10px;color:var(--faint,#8a929e)">arrives: ' + esc(arrive) + '</div>'
    + '</div></div>';
}
function _storefrontConfig(n){
  var e = n.exposure || 'public';
  var o = _ensureOrder(n);
  var opt = function(val, label, hint){ var on = e === val;
    return '<div onclick="netSetExposure(\'' + n.key + '\',\'' + val + '\')" style="cursor:pointer;padding:8px 10px;border:1px solid ' + (on ? '#2c7a43' : 'var(--line)') + ';border-radius:8px;background:' + (on ? '#e6f4ec' : '#fff') + ';margin-top:6px">'
      + '<b style="font-size:12.5px;color:' + (on ? '#2c7a43' : '#3a4048') + '">' + (on ? '● ' : '○ ') + label + '</b>'
      + '<div style="font-size:11px;color:var(--grey);margin-top:2px">' + hint + '</div></div>'; };
  var view = '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em">👁️ VIEW — who sees it</div>'
    + opt('public', 'Public', 'Anyone / customers can see this in the storefront.')
    + opt('protected', 'Protected', 'Your <b>connected network / partners</b> — <b>not</b> the public.')
    + '<div style="font-size:11px;color:var(--grey);margin-top:8px">Untick <b>Storefront</b> above to keep this node <b>private</b> (internal — shown to no one).</div>';
  var methOpts = CAT_METHODS.map(function(m){ return '<option value="' + m.k + '"' + ((o.method || 'cart') === m.k ? ' selected' : '') + '>' + m.label + '</option>'; }).join('');
  var mh = (CAT_METHODS.filter(function(m){ return m.k === (o.method || 'cart'); })[0] || {}).hint || '';
  var inletRows = (o.inlets || []).map(function(il, i){ var chOpts = OFF_RAIL_CHANNELS.map(function(ch){ return '<option value="' + ch + '"' + (il.channel === ch ? ' selected' : '') + '>' + ch + '</option>'; }).join(''); return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><select onchange="netSetInlet(\'' + n.key + '\',' + i + ',\'channel\',this.value)" style="font-size:11.5px;padding:4px;border:1px solid var(--line);border-radius:6px">' + chOpts + '</select><input value="' + esc(il.handle || '') + '" oninput="netSetInlet(\'' + n.key + '\',' + i + ',\'handle\',this.value)" placeholder="the number / address customers use" style="flex:1;min-width:0;font-size:11.5px;padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span onclick="netDelInlet(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('');
  var cbRows = (o.collectBack || []).map(function(cb, i){
    var cadOpts = COLLECT_CADENCE.map(function(cd){ return '<option value="' + cd + '"' + (cb.cadence === cd ? ' selected' : '') + '>' + cd + '</option>'; }).join('');
    return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><input value="' + esc(cb.name || '') + '" oninput="netSetCollectBack(\'' + n.key + '\',' + i + ',\'name\',this.value)" placeholder="what to collect (e.g. delivery location)" style="flex:1;min-width:0;font-size:11.5px;padding:4px 7px;border:1px solid var(--line);border-radius:6px"><select onchange="netSetCollectBack(\'' + n.key + '\',' + i + ',\'cadence\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + cadOpts + '</select><span onclick="netDelCollectBack(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>';
  }).join('') || '<div style="font-size:11px;color:var(--grey);padding:2px 0">Nothing asked back.</div>';
  var order = '<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:9px"><div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em">📝 ORDER FORM — what the customer fills in</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:8px">How they order (commercial method)</label>'
    + '<select onchange="netSetOrderMethod(\'' + n.key + '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px">' + methOpts + '</select>'
    + '<div style="font-size:11px;color:var(--grey);font-style:italic;margin-top:3px">' + esc(mh) + '</div>'
    + _methodPreview(o.method)
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:10px">Max items per order <span style="color:var(--faint,#8a929e)">(optional)</span></label>'
    + '<input value="' + (o.maxItems != null ? esc(String(o.maxItems)) : '') + '" oninput="netSetOrderMax(\'' + n.key + '\',this.value)" type="number" min="1" placeholder="no limit" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;width:130px">'
    + '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">📥 COLLECT FROM CUSTOMER</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:3px">Info you ask the buyer to provide with the order (e.g. delivery address, a monthly forecast).</div>'
    + cbRows
    + '<div onclick="netAddCollectBack(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ collect field</div>'
    + '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">🛬 HOW ORDERS ARRIVE</div>'
    + '<div style="font-size:11.5px;color:#2c7a43;margin-top:5px;padding:6px 9px;border:1px solid #cfe0d6;border-radius:7px;background:#f4faf6">✓ <b>On the rail</b> — customers order at your storefront (they find you in ChitBridge).</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:8px">Off-rail inlets <span style="color:var(--faint,#8a929e)">(optional)</span> — a message to a channel <b>you own &amp; publish</b>, captured into a chit:</div>'
    + inletRows
    + '<div onclick="netAddInlet(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ add off-rail inlet</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:4px;font-style:italic">De-duplicated automatically — the same scan or message won\'t create a second chit (matched by content).</div>'
    + '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">🔄 LIFECYCLE — states the chit moves through</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:3px">Order the states (e.g. open → confirmed → fulfilled → closed). Each move is a sealed step; a dispute attaches to a state.</div>'
    + ((o.states || []).map(function(s, i){ var last = i === (o.states.length - 1); return '<div style="display:flex;gap:5px;align-items:center;padding:2px 0"><span style="font-size:10px;color:var(--faint,#8a929e);width:16px">' + (i + 1) + '</span><input value="' + esc(s.name || '') + '" oninput="netSetState(\'' + n.key + '\',' + i + ',this.value)" placeholder="state name" style="flex:1;min-width:0;font-size:11.5px;padding:4px 7px;border:1px solid var(--line);border-radius:6px">' + (i > 0 ? '<span onclick="netMoveState(\'' + n.key + '\',' + i + ',-1)" style="cursor:pointer;color:var(--grey);padding:0 3px">↑</span>' : '<span style="display:inline-block;width:14px"></span>') + (!last ? '<span onclick="netMoveState(\'' + n.key + '\',' + i + ',1)" style="cursor:pointer;color:var(--grey);padding:0 3px">↓</span>' : '<span style="display:inline-block;width:14px"></span>') + '<span onclick="netDelState(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('') || '<div style="font-size:11px;color:var(--grey);padding:2px 0">No states — a one-shot chit (created, done).</div>')
    + '<div onclick="netAddState(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ state</div>'
    + '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">📎 ATTACHMENTS &amp; NOTES</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-top:3px">Documents the chit carries, and any free-text note.</div>'
    + ((o.attachments || []).map(function(a, i){ return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><input value="' + esc(a.name || '') + '" oninput="netSetAttach(\'' + n.key + '\',' + i + ',this.value)" placeholder="document name (e.g. assay_cert.pdf)" style="flex:1;min-width:0;font-size:11.5px;padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span onclick="netDelAttach(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'; }).join('') || '<div style="font-size:11px;color:var(--grey);padding:2px 0">No attachments.</div>')
    + '<div onclick="netAddAttach(\'' + n.key + '\')" style="cursor:pointer;color:var(--blue);font-size:12px;font-weight:600;padding:5px 0">＋ add attachment</div>'
    + '<textarea oninput="netSetOrderNotes(\'' + n.key + '\',this.value)" placeholder="notes…" style="width:100%;margin-top:6px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12px;box-sizing:border-box;min-height:2.4rem;resize:vertical">' + esc(o.notes || '') + '</textarea>'
    + '</div>';
  return '<div style="margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-left:3px solid #2c7a43;border-radius:10px;background:#fbfefc">' + view + order + _chitPreview(n) + '</div>';
}
/* setters for the four remaining panels */
/* co-assist: normalized shape + per-kind setters (Human roles · IoT gateways→devices · ERP system+label · AI role+autonomy) */
function _defCoassist(){ return { human: { count: 0, roles: [] }, iot: { connections: [] }, erp: { connectors: [] }, ai: { count: 0, role: '', autonomy: 'authorize' } }; }
function _normCoassist(ca){
  var d = _defCoassist(); ca = ca || {};
  if (typeof ca.human === 'number') d.human.count = ca.human; else if (ca.human) { d.human.count = ca.human.count || 0; d.human.roles = ca.human.roles || []; }
  if (typeof ca.iot === 'number') { if (ca.iot > 0) d.iot.connections = [{ type: 'Direct sensor', count: 1, devices: ca.iot }]; }
  else if (ca.iot) { if (Array.isArray(ca.iot.connections)) d.iot.connections = ca.iot.connections.map(function(x){ return { type: x.type || 'Raspberry Pi', count: (x.count != null ? x.count : 1), devices: x.devices || 0 }; }); else if (ca.iot.gateways || ca.iot.devices) d.iot.connections = [{ type: 'Raspberry Pi', count: ca.iot.gateways || 1, devices: ca.iot.devices || 0 }]; }
  if (typeof ca.erp === 'number') { for (var i = 0; i < ca.erp; i++) d.erp.connectors.push({ system: 'SAP', label: '' }); } else if (ca.erp) { d.erp.connectors = ca.erp.connectors || []; }
  if (typeof ca.ai === 'number') d.ai.count = ca.ai; else if (ca.ai) { d.ai.count = ca.ai.count || 0; d.ai.role = ca.ai.role || ''; d.ai.autonomy = ca.ai.autonomy || 'authorize'; }
  return d;
}
function _ca(n){ n.coassist = _normCoassist(n.coassist); return n.coassist; }
function netCaHuman(key, val){ var n = _netNode(key); if (!n) return; var x = parseInt(val, 10); _ca(n).human.count = (val === '' || isNaN(x) || x < 0) ? 0 : x; _netMark(); }
function netCaHumanAddRole(key){ var n = _netNode(key); if (!n) return; _ca(n).human.roles.push(''); _netMark(); _netRerender(); }
function netCaHumanDelRole(key, i){ var n = _netNode(key); if (!n) return; _ca(n).human.roles.splice(i, 1); _netMark(); _netRerender(); }
function netCaHumanSetRole(key, i, val){ var n = _netNode(key); if (!n) return; var r = _ca(n).human.roles; if (i >= 0 && i < r.length) { r[i] = val; _netMark(); } }
function netCaAddIot(key){ var n = _netNode(key); if (!n) return; _ca(n).iot.connections.push({ type: 'Raspberry Pi', count: 1, devices: 0 }); _netMark(); _netRerender(); }
function netCaDelIot(key, i){ var n = _netNode(key); if (!n) return; _ca(n).iot.connections.splice(i, 1); _netMark(); _netRerender(); }
function netCaSetIot(key, i, prop, val){ var n = _netNode(key); if (!n) return; var cs = _ca(n).iot.connections; if (i < 0 || i >= cs.length) return; if (prop === 'devices' || prop === 'count') { var x = parseInt(val, 10); cs[i][prop] = (val === '' || isNaN(x) || x < 0) ? 0 : x; _netMark(); } else { cs[i][prop] = val; _netMark(); _netRerender(); } }
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
    return '<div style="display:flex;gap:5px;align-items:center;padding:3px 0;flex-wrap:wrap"><select onchange="netCaSetIot(\'' + n.key + '\',' + i + ',\'type\',this.value)" style="font-size:11.5px;padding:4px;border:1px solid var(--line);border-radius:6px">' + opts + '</select><span style="font-size:11px;color:var(--grey)">how many</span><input type="number" min="0" value="' + (io.count || '') + '" oninput="netCaSetIot(\'' + n.key + '\',' + i + ',\'count\',this.value)" placeholder="1" style="width:46px;font-size:11.5px;padding:4px 6px;border:1px solid var(--line);border-radius:6px"><span style="font-size:11px;color:var(--grey)">devices</span><input type="number" min="0" value="' + (io.devices || '') + '" oninput="netCaSetIot(\'' + n.key + '\',' + i + ',\'devices\',this.value)" placeholder="0" style="width:54px;font-size:11.5px;padding:4px 6px;border:1px solid var(--line);border-radius:6px"><span onclick="netCaDelIot(\'' + n.key + '\',' + i + ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>';
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
  if (k === 'storefront') return _storefrontConfig(n);
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
