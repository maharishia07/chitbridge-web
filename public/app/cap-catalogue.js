/* cap-catalogue.js — the ENHANCED catalogue setup (local prototype, not promoted).
 *
 * Athi's model: ONE "face" per catalogue (not per item). The face = purpose · storefront method (one) ·
 * facets (variants/sourcing/standards/media). Currency + country are INHERITED from entity Settings — the
 * catalogue never decides them. Items conform to the face; only their count/values vary.
 *
 * Flow: blank catalogue → ADOPT a known template (existing knowledge) OR BUILD from purpose (infer) → face
 * setup (progressive '＋' — deepen the whole catalogue only when needed) → sample item preview.
 *
 * Draft-only (localStorage per entity). Uses the shared model (catalogue-model.js / CBCatalogue). Slice 1 =
 * the face; conforming-item CRUD reuses the existing products API in a later slice.
 */

/* storefront method — ONE per catalogue (a cart catalogue is all cart; no per-row mixing) */
var CATF_METHODS = [
  { k: 'cart',     label: 'Cart (qty × price)',   hint: 'a shop — pick quantity, pay the price (veg market, retail)' },
  { k: 'qty',      label: 'Quantity only',        hint: 'order a count, no price shown' },
  { k: 'range',    label: 'Price as a range',     hint: 'price moves within a band (commodities)' },
  { k: 'qtyprice', label: 'Both negotiable',      hint: 'buyer proposes quantity and price (tenders, trade)' },
  { k: 'text',     label: 'Information only',      hint: 'a listing, nothing to order' },
];

/* known templates — "adopt if you know it". Small seed KB; the real one grows / an AI proposes it. */
var CATF_KB = {
  veg:    { title: 'Veg market',   method: 'cart',     facets: { variants: true },                          product: 'Vegetables',        baseUnit: 'kg' },
  retail: { title: 'Retail shop',  method: 'cart',     facets: {},                                          product: 'Products',          baseUnit: 'piece' },
  gold:   { title: 'Gold / bullion', method: 'range',  facets: { variants: true, standards: true, sourcing: true }, product: 'Gold bar',  baseUnit: 'g' },
  paint:  { title: 'Paint / finishes', method: 'cart', facets: { variants: true, media: true },              product: 'Finishes',          baseUnit: 'litre' },
  pharma: { title: 'Pharma',       method: 'cart',     facets: { variants: true, standards: true, sourcing: true }, product: 'Pharma lot', baseUnit: 'unit' },
  trade:  { title: 'Trade / export', method: 'qtyprice', facets: { standards: true, sourcing: true },        product: 'Goods',             baseUnit: 'unit' },
};

/* ---- per-entity face draft (localStorage; server persistence is a later slice) ---- */
function _catfKey(){ return 'cb_catface_' + (SESSION.entityId || SESSION.entity || 'anon'); }
function _catfLoad(){ try { var s = localStorage.getItem(_catfKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function _catfSave(){ try { if (UI.catf) localStorage.setItem(_catfKey(), JSON.stringify(UI.catf)); } catch (e) {} }
function _catfInit(){ if (UI.catf === undefined) UI.catf = _catfLoad(); }
function _catfCcy(){ return (typeof SESSION !== 'undefined' && SESSION.currency) || 'INR'; }        // inherited from entity Settings
function _catfCountry(){ return (typeof SESSION !== 'undefined' && SESSION.country) || 'IN'; }
function _catfMoney(v){ return (typeof fmtMoney === 'function') ? fmtMoney(v, _catfCcy()) : (_catfCcy() + ' ' + v); }
function _catfFacets(f){ return Object.assign({ variants: false, sourcing: false, standards: false, media: false }, (f && f.facets) || {}); }

/* build a face from an adopted template, or inferred from the purpose text (reuses existing knowledge) */
function _catfFromTemplate(key){
  var t = CATF_KB[key] || {}; var c = CBCatalogue.ensure({ story: '', product: t.product || '', baseUnit: t.baseUnit || '' });
  return { method: t.method || 'cart', facets: _catfFacets({ facets: t.facets }), adoptedFrom: t.title || key, catalogue: c };
}
function _catfInfer(purpose){
  var s = (purpose || '').toLowerCase();
  var method = /tender|negotiat|export|trade|offer/.test(s) ? 'qtyprice'
    : /spot|commodity|range|bullion|gold/.test(s) ? 'range'
    : /listing|information|catalogue only|no price/.test(s) ? 'text'
    : /count|units? only/.test(s) ? 'qty' : 'cart';
  var facets = {
    variants: /size|variant|grade|colou?r|litre|kg|unit|pack/.test(s),
    sourcing: /erp|tally|sap|iot|sensor|ai|compute|reorder|eoq|stock/.test(s),
    standards: /hs code|gs1|organic|fairtrade|certif|compliance|regulat/.test(s),
    media: /image|photo|video|showcase|look|design|finish|colou?r/.test(s),
  };
  var c = CBCatalogue.ensure({ story: purpose || '', product: '', baseUnit: '' });
  return { method: method, facets: facets, adoptedFrom: '', catalogue: c };
}

/* ---- actions ---- */
function catfAdopt(key){ UI.catf = _catfFromTemplate(key); _catfSave(); renderApp(); }
function catfBuild(){ var p = (val('catf_purpose') || '').trim(); if (!p) { if (typeof toast === 'function') toast('Say what the catalogue is for first.'); return; } UI.catf = _catfInfer(p); UI.catf.catalogue.story = p; _catfSave(); renderApp(); }
function catfSetPurpose(v){ if (UI.catf) { UI.catf.catalogue.story = v; _catfSave(); } }   // no rerender while typing
function catfSetMethod(v){ if (UI.catf) { UI.catf.method = v; _catfSave(); renderApp(); } }
function catfToggleFacet(k){ if (!UI.catf) return; UI.catf.facets = _catfFacets(UI.catf); UI.catf.facets[k] = !UI.catf.facets[k]; _catfSave(); renderApp(); }
function catfReset(){ if (typeof confirm === 'function' && !confirm('Start the catalogue setup over? (items are not affected)')) return; UI.catf = null; try { localStorage.removeItem(_catfKey()); } catch (e) {} renderApp(); }

/* ---- render ---- */
function _catfWrap(inner){ return '<div style="flex:1;min-height:0;overflow-y:auto;padding:22px 20px">' + inner + '</div>'; }

function catalogueSetupScreen(){
  _catfInit();
  var ccy = _catfCcy(), country = _catfCountry();
  var settingsNote = '<div style="font-size:11px;color:var(--grey);margin-top:6px">Currency <b>' + esc(ccy) + '</b> · country <b>' + esc(country) + '</b> — from your <b>Settings</b> (set at registration), inherited here.</div>';

  if (!UI.catf) {
    var palette = Object.keys(CATF_KB).map(function(k){ var t = CATF_KB[k];
      return '<div onclick="catfAdopt(\'' + k + '\')" style="cursor:pointer;border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:150px;flex:1;background:#fff">'
        + '<div style="font-weight:700;font-size:13px">' + esc(t.title) + '</div>'
        + '<div style="font-size:11px;color:var(--grey);margin-top:2px">' + esc((CATF_METHODS.filter(function(m){ return m.k === t.method; })[0] || {}).label || t.method) + '</div></div>';
    }).join('');
    return _catfWrap('<div style="max-width:640px">'
      + '<div style="font-size:19px;font-weight:800">🗂️ Set up your catalogue</div>'
      + '<div style="font-size:13px;color:var(--grey);margin:8px 0;line-height:1.6">Your catalogue has <b>one face</b> — one purpose, one way of selling. Items conform to it; only their number grows. Start by adopting a known template, or describe your purpose and we\'ll build it.</div>'
      + settingsNote
      + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:16px">🔎 ADOPT A TEMPLATE <span style="font-weight:500;color:var(--grey)">— if you know what it is</span></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' + palette + '</div>'
      + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:18px;border-top:1px solid var(--line);padding-top:14px">🛠 BUILD FROM PURPOSE <span style="font-weight:500;color:var(--grey)">— if it\'s new</span></div>'
      + '<textarea id="catf_purpose" placeholder="e.g. Sell vegetables to local buyers by the kg" rows="2" style="width:100%;margin-top:8px;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:13px;resize:vertical"></textarea>'
      + '<button class="pri" onclick="catfBuild()" style="margin-top:8px;padding:9px 15px">Build my catalogue</button>'
      + '</div>');
  }

  // ---- face setup ----
  var f = UI.catf, c = CBCatalogue.ensure(f.catalogue), facets = _catfFacets(f);
  var methOpts = CATF_METHODS.map(function(m){ return '<option value="' + m.k + '"' + (f.method === m.k ? ' selected' : '') + '>' + m.label + '</option>'; }).join('');
  var methHint = (CATF_METHODS.filter(function(m){ return m.k === f.method; })[0] || {}).hint || '';
  var FACETS = [
    { k: 'variants', label: 'Variants & units', hint: 'multiple sizes / sold by kg, litre, pack — with unit conversions' },
    { k: 'sourcing', label: 'Where data comes from', hint: 'each field: ERP · customer · AI-computed · stored in CB (the four legs)' },
    { k: 'standards', label: 'Standards', hint: 'HS code · GS1 — by reference' },
    { k: 'media', label: 'Images & video', hint: 'your own, or inherited from a source / blueprint' },
  ];
  var facetRows = FACETS.map(function(x){ var on = !!facets[x.k];
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">'
      + '<div style="flex:1"><div style="font-weight:600;font-size:12.5px;color:' + (on ? '#1c2128' : 'var(--grey)') + '">' + esc(x.label) + '</div><div style="font-size:11px;color:var(--grey)">' + esc(x.hint) + '</div></div>'
      + '<span onclick="catfToggleFacet(\'' + x.k + '\')" style="cursor:pointer;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:14px;border:1px solid ' + (on ? '#2c7a43' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--blue)') + ';background:' + (on ? '#2c7a43' : '#fff') + '">' + (on ? '✓ on' : '＋ add') + '</span>'
      + '</div>';
  }).join('');

  return _catfWrap('<div style="max-width:660px">'
    + '<div style="display:flex;align-items:center;gap:10px"><div style="font-size:18px;font-weight:800">🗂️ Catalogue face</div>' + (f.adoptedFrom ? '<span style="font-size:10.5px;font-weight:700;color:#2c5aa0;background:#eef2f7;border-radius:5px;padding:2px 8px">adopted · ' + esc(f.adoptedFrom) + '</span>' : '<span style="font-size:10.5px;font-weight:700;color:#6a4fa0;background:#efeafa;border-radius:5px;padding:2px 8px">built from purpose</span>') + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:4px">One face for the whole catalogue — every item conforms. ' + settingsNote.replace(/^<div[^>]*>/, '<span style="color:var(--grey)">').replace(/<\/div>$/, '</span>') + '</div>'
    // purpose
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:14px">Purpose</label>'
    + '<textarea oninput="catfSetPurpose(this.value)" rows="2" style="width:100%;margin-top:4px;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:9px;font-size:13px;resize:vertical">' + esc(c.story || '') + '</textarea>'
    // method (one, uniform)
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:12px">How the store sells <span style="color:var(--faint,#8a929e)">— one method for the whole catalogue</span></label>'
    + '<select onchange="catfSetMethod(this.value)" style="margin-top:4px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:13px">' + methOpts + '</select>'
    + '<div style="font-size:11px;color:var(--grey);font-style:italic;margin-top:3px">' + esc(methHint) + '</div>'
    // facets (progressive)
    + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:16px">DEEPEN THE CATALOGUE <span style="font-weight:500;color:var(--grey)">— add only what this business needs</span></div>'
    + '<div style="margin-top:6px">' + facetRows + '</div>'
    // sample item under this face
    + _catfSamplePreview(f, c, facets)
    // actions
    + '<div style="display:flex;gap:10px;margin-top:16px">'
    + '<button class="pri" onclick="alert(\'Conforming-item management is the next slice.\')" style="padding:9px 15px">Manage items ›</button>'
    + '<button onclick="catfReset()" style="padding:9px 15px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--grey)">↺ Start over</button>'
    + '</div>'
    + '</div>');
}

/* a live sample item as it would appear UNDER this face — proves the face shapes every item uniformly */
function _catfSamplePreview(f, c, facets){
  var name = c.product || 'Sample item';
  var unit = facets.variants ? (c.baseUnit || 'unit') : '';
  var control = f.method === 'text' ? '<span style="font-size:11.5px;color:var(--grey)">information only</span>'
    : f.method === 'cart' ? '<span style="font-size:11.5px;color:var(--grey)">Qty ▢ × ' + esc(_catfMoney(40)) + '</span> <span style="background:#2c5aa0;color:#fff;border-radius:5px;padding:3px 10px;font-size:11.5px;font-weight:600">Add</span>'
    : f.method === 'range' ? '<span style="font-size:11.5px;color:var(--grey)">' + esc(_catfMoney(3200)) + ' – ' + esc(_catfMoney(3600)) + '</span>'
    : f.method === 'qty' ? '<span style="font-size:11.5px;color:var(--grey)">Qty ▢</span> <span style="background:#2c5aa0;color:#fff;border-radius:5px;padding:3px 10px;font-size:11.5px;font-weight:600">Order</span>'
    : '<span style="font-size:11.5px;color:var(--grey)">Qty ▢ · your price ▢</span> <span style="background:#2c5aa0;color:#fff;border-radius:5px;padding:3px 10px;font-size:11.5px;font-weight:600">Offer</span>';
  var tags = [];
  if (facets.sourcing) tags.push('sourced: ERP · customer · AI · CB');
  if (facets.standards) tags.push('HS / GS1 by ref');
  if (facets.media) tags.push('🖼 image / video');
  var tagLine = tags.length ? '<div style="font-size:10px;color:var(--faint,#8a929e);margin-top:6px">' + tags.map(esc).join(' · ') + '</div>' : '';
  return '<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px">'
    + '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-bottom:6px">A SAMPLE ITEM UNDER THIS FACE</div>'
    + '<div style="max-width:300px;border:1px solid var(--line);border-radius:11px;box-shadow:0 1px 3px rgba(20,30,45,.08);padding:12px 13px;background:#fff">'
    + (facets.media ? '<div style="height:70px;border-radius:8px;background:linear-gradient(135deg,#eef1f5,#dde3ea);display:flex;align-items:center;justify-content:center;color:#9aa3a7;font-size:11px;margin-bottom:8px">🖼 media (from source)</div>' : '')
    + '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:700;font-size:13.5px">' + esc(name) + '</span>' + (unit ? '<span style="font-size:10.5px;color:#7a5e22;background:var(--gold-soft,#f6ecd8);border-radius:5px;padding:1px 7px">' + esc(unit) + '</span>' : '') + '</div>'
    + '<div style="margin-top:9px">' + control + '</div>'
    + tagLine
    + '</div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:6px">Every item in this catalogue looks and sells this way — you only fill the values, never re-pick the type.</div>'
    + '</div>';
}
