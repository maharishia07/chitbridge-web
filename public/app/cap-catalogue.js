/* cap-catalogue.js — the ENHANCED catalogue setup (local prototype, not promoted).
 *
 * Athi's model: ONE "face" per catalogue (not per item). Face = purpose · one storefront method · facets
 * (variants/sourcing/standards/media). Currency + country INHERITED from entity Settings. Items conform.
 *
 * Setup is TWO PANELS: left = choose (adopt a template via dropdown) OR build (state purpose + FEED your
 * existing inventory — CSV/ERP — which we STUDY and turn into a suggested model); right = a LIVE preview of
 * "how the catalogue will look". Commit → the face view. Draft-only (localStorage). Uses catalogue-model.js.
 */

var CATF_METHODS = [
  { k: 'cart',     label: 'Cart (qty × price)',   hint: 'a shop — pick quantity, pay the price (veg market, retail)' },
  { k: 'qty',      label: 'Quantity only',        hint: 'order a count, no price shown' },
  { k: 'range',    label: 'Price as a range',     hint: 'price moves within a band (commodities)' },
  { k: 'qtyprice', label: 'Both negotiable',      hint: 'buyer proposes quantity and price (tenders, trade)' },
  { k: 'text',     label: 'Information only',      hint: 'a listing, nothing to order' },
];
var CATF_KB = {
  veg:    { title: 'Veg market',       method: 'cart',     facets: { variants: true },                                   product: 'Vegetables', baseUnit: 'kg' },
  retail: { title: 'Retail shop',      method: 'cart',     facets: {},                                                   product: 'Products',   baseUnit: 'piece' },
  gold:   { title: 'Gold / bullion',   method: 'range',    facets: { variants: true, standards: true, sourcing: true },  product: 'Gold bar',   baseUnit: 'g' },
  paint:  { title: 'Royale Paint (finishes)', method: 'cart', facets: { variants: true, media: true, sourcing: true }, product: 'Royale Play finish', baseUnit: 'litre' },
  pharma: { title: 'Pharma',           method: 'cart',     facets: { variants: true, standards: true, sourcing: true },  product: 'Pharma lot', baseUnit: 'unit' },
  trade:  { title: 'Trade / export',   method: 'qtyprice', facets: { standards: true, sourcing: true },                  product: 'Goods',      baseUnit: 'unit' },
};
var CATF_FACETS = [
  { k: 'variants',  label: 'Variants & units', hint: 'multiple sizes / sold by kg, litre, pack — with unit conversions' },
  { k: 'sourcing',  label: 'Where data comes from', hint: 'each field: ERP · customer · AI-computed · stored in CB (four legs)' },
  { k: 'standards', label: 'Standards', hint: 'HS code · GS1 — by reference' },
  { k: 'media',     label: 'Images & video', hint: 'your own, or inherited from a source / blueprint' },
];
/* what a COMPLETE catalogue for a purpose needs — the theme: build what is NOT in the ERP/data (the gap CB fills). */
var CATF_REQUIRED = {
  gold:   [{ name: 'fineness', leg: 'cb' }, { name: 'assay_cert', leg: 'cb' }, { name: 'bar_serial', leg: 'cb' }, { name: 'hs_code', leg: 'standard' }],
  coffee: [{ name: 'origin_farm', leg: 'cb' }, { name: 'varietal', leg: 'cb' }, { name: 'cupping_score', leg: 'cb' }, { name: 'moisture_pct', leg: 'system' }, { name: 'hs_code', leg: 'standard' }],
  pharma: [{ name: 'batch_no', leg: 'cb' }, { name: 'active_ingredient', leg: 'cb' }, { name: 'expiry', leg: 'cb' }, { name: 'storage_temp', leg: 'system' }],
  paint:  [{ name: 'texture_family', leg: 'cb' }, { name: 'colour_combination', leg: 'cb' }, { name: 'sheen', leg: 'cb' }, { name: 'coverage_sqft_per_litre', leg: 'cb' }, { name: 'stock_litres', leg: 'system', via: 'ERP' }, { name: 'room_area_sqft', leg: 'customer' }, { name: 'litres_needed', leg: 'compute', via: 'AI' }],
  veg:    [{ name: 'grade', leg: 'cb' }, { name: 'source_farm', leg: 'cb' }],
  retail: [{ name: 'brand', leg: 'cb' }],
  trade:  [{ name: 'hs_code', leg: 'standard' }, { name: 'incoterm', leg: 'customer' }, { name: 'origin_country', leg: 'cb' }],
};
function _catfVerticalFromPurpose(p){ var s = (p || '').toLowerCase();
  if (/gold|bullion/.test(s)) return 'gold'; if (/coffee|bean/.test(s)) return 'coffee';
  if (/pharma|drug|medicine|\blot\b/.test(s)) return 'pharma'; if (/paint|finish|colou?r/.test(s)) return 'paint';
  if (/veg|vegetable|grocery|produce/.test(s)) return 'veg'; if (/export|import|customs|\btrade\b/.test(s)) return 'trade';
  if (/retail|\bshop\b|\bstore\b/.test(s)) return 'retail'; return null;
}
/* what ADOPTION brings from the source (by reference) — the owner only sets the price. Kept inside the catalogue. */
// the REAL Royale Play source (beta-royale-play@v1, live on shop CB3D5L4UFT) — design by reference, owner sets price only
var CATF_SOURCE_ITEMS = {
  paint: [
    { product: 'Tussar', texture_family: 'weave', sheen: 'metallic', coats: '1 base + 2 effect', region: 'East', combination: 'Silk Route · Raw Silk + Bronze Glow', _media: true },
    { product: 'Madras Check', texture_family: 'check', sheen: 'matte', coats: '1 base + 1 effect', region: 'South', combination: 'Rustic Grid · Terracotta + Slate', _media: true },
    { product: 'Ikkat', texture_family: 'thread', sheen: 'pearl', coats: '1 base + 2 effect', region: 'South', combination: 'Blurred Weave · Teal Blur + Ivory', _media: true },
    { product: 'Bandhej', texture_family: 'tie-dye', sheen: 'matte', coats: '1 base + 2 effect', region: 'West', combination: 'Desert Bloom · Madder Red + Sand', _media: true },
  ],
};

/* ---- per-entity face draft (localStorage; server persistence is a later slice) ---- */
function _catfKey(){ return 'cb_catface_' + (SESSION.entityId || SESSION.entity || 'anon'); }
function _catfLoad(){ try { var s = localStorage.getItem(_catfKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function _catfSave(){ try { if (UI.catf) localStorage.setItem(_catfKey(), JSON.stringify(UI.catf)); } catch (e) {} }
function _catfInit(){ if (UI.catf === undefined) UI.catf = _catfLoad(); if (!UI.catfMode) UI.catfMode = 'adopt'; }
function _catfCcy(){ return (typeof SESSION !== 'undefined' && SESSION.currency) || 'INR'; }
function _catfCountry(){ return (typeof SESSION !== 'undefined' && SESSION.country) || 'IN'; }
function _catfMoney(v){ return (typeof fmtMoney === 'function') ? fmtMoney(v, _catfCcy()) : (_catfCcy() + ' ' + v); }
function _catfFacets(f){ return Object.assign({ variants: false, sourcing: false, standards: false, media: false }, (f && f.facets) || {}); }

/* ---- adopt / build → a face draft ---- */
function _catfFromTemplate(key){
  var t = CATF_KB[key] || {}; var c = CBCatalogue.ensure({ story: '', product: t.product || '', baseUnit: t.baseUnit || '' });
  return { method: t.method || 'cart', facets: _catfFacets({ facets: t.facets }), adoptedFrom: t.title || key, templateKey: key, required: CATF_REQUIRED[key] || [], catalogue: c };
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
  return { method: method, facets: facets, adoptedFrom: '', catalogue: CBCatalogue.ensure({ story: purpose || '', product: '', baseUnit: '' }) };
}

/* ---- STUDY existing inventory (CSV now; ERP via connector later): columns → a suggested model ---- */
function _catfParseCSV(text){
  var lines = (text || '').trim().split(/\r?\n/).filter(function(l){ return l.trim(); });
  if (!lines.length) return { headers: [], rows: [] };
  var sp = function(l){ return l.split(',').map(function(x){ return x.trim().replace(/^"|"$/g, ''); }); };
  return { headers: sp(lines[0]), rows: lines.slice(1, 60).map(sp) };
}
function _catfColKind(name, samples){
  var n = (name || '').toLowerCase();
  if (/^(name|item|product|title|particular|desc)/.test(n)) return { role: 'name' };
  if (/(price|rate|mrp|cost|amount)/.test(n)) return { role: 'price' };
  if (/(qty|quantity|stock|inventory|on.?hand|balance)/.test(n)) return { role: 'field', leg: 'system', via: 'ERP', type: 'number' };
  if (/(unit|uom|measure)/.test(n)) return { role: 'unit' };
  if (/(hs|hsn|sku|code|barcode|gtin|ean|batch|serial)/.test(n)) return { role: 'code' };
  var num = samples.length && samples.every(function(s){ return s === '' || !isNaN(parseFloat(s)); });
  return { role: 'field', leg: 'cb', via: '', type: num ? 'number' : 'text' };
}
function _catfStudy(purpose, csv){
  var draft = _catfInfer(purpose); draft.adoptedFrom = '';
  var p = _catfParseCSV(csv);
  if (p.headers.length) {
    var c = draft.catalogue; c.fields = []; var nameCol = -1, unitCol = -1, priceCol = -1;
    p.headers.forEach(function(h, i){
      var samples = p.rows.map(function(r){ return r[i]; }).filter(function(x){ return x != null && x !== ''; }).slice(0, 8);
      var k = _catfColKind(h, samples);
      if (k.role === 'name') nameCol = i;
      else if (k.role === 'unit') { unitCol = i; draft.facets.variants = true; }
      else if (k.role === 'price') priceCol = i;
      else if (k.role === 'code') { draft.facets.standards = true; c.fields.push({ name: h, leg: 'cb', via: '', type: 'text' }); }
      else { if (k.leg === 'system') draft.facets.sourcing = true; c.fields.push({ name: h, leg: k.leg, via: k.via || '', type: k.type || 'text' }); }
    });
    if (nameCol >= 0 && p.rows[0]) c.product = p.rows[0][nameCol] || c.product;
    if (unitCol >= 0 && p.rows[0]) c.baseUnit = p.rows[0][unitCol] || c.baseUnit;
    draft.catalogue = CBCatalogue.ensure(c);
    draft.mapping = p.headers.map(function(h, i){ var k = _catfColKind(h, p.rows.map(function(r){ return r[i]; })); return { col: h, role: (i === nameCol ? 'name' : i === unitCol ? 'unit' : i === priceCol ? 'price' : k.role), leg: k.leg, via: k.via }; });
    draft.sampleRows = p.rows.slice(0, 4).map(function(r){ return { name: nameCol >= 0 ? r[nameCol] : (r[0] || ''), unit: unitCol >= 0 ? r[unitCol] : '', price: priceCol >= 0 ? r[priceCol] : '' }; });
    draft.studied = { cols: p.headers.length, rows: p.rows.length };
  }
  return draft;
}

/* ---- SOURCE the model from knowledge (no data needed): purpose → full, populated, visible catalogue ---- */
function _catfSampleVal(name, i){ var n = (name || '').toLowerCase();
  if (/fineness|purity/.test(n)) return ['999.9', '995.0', '916.0'][i % 3];
  if (/price|rate|cost|mrp/.test(n)) return [40, 30, 25][i % 3];
  if (/score|cupping/.test(n)) return [88, 86, 84][i % 3];
  if (/pct|moisture/.test(n)) return [11.2, 10.8, 11.9][i % 3];
  if (/temp/.test(n)) return [18, 4, -2][i % 3];
  if (/expiry|date/.test(n)) return '2027-0' + ((i % 9) + 1);
  if (/texture/.test(n)) return ['Metallica', 'Sparkle', 'Pearl'][i % 3];
  if (/colou?r_comb|colou?r/.test(n)) return ['Ivory + Gold', 'Blue + Silver', 'Rose + Pearl'][i % 3];
  if (/sheen/.test(n)) return ['Satin', 'Matte', 'Gloss'][i % 3];
  if (/coverage/.test(n)) return [140, 120, 160][i % 3];
  if (/stock/.test(n)) return [320, 150, 410][i % 3];
  if (/room_area|sqft|area/.test(n)) return [180, 240, 120][i % 3];
  if (/litres_needed|needed/.test(n)) return [6, 10, 4][i % 3];
  if (/farm|origin|source|country/.test(n)) return ['Estate A', 'Estate B', 'Estate C'][i % 3];
  if (/serial|batch|\blot\b|\bno\b|code|cert/.test(n)) return (name.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'ID') + '-' + String(i + 1).padStart(3, '0');
  return name + ' ' + (i + 1);
}
function _catfKnowledgeItems(vertical, c){
  var base = (CATF_KB[vertical] || {}).product || c.product || 'Item';
  var suffix = vertical === 'gold' ? ['100 g', '1 kg', '50 g'] : vertical === 'coffee' ? ['Ethiopia G1', 'Colombia', 'Brazil'] : vertical === 'paint' ? ['Sunlit Ivory', 'Royale Aspira', 'Pearl Glow'] : ['A', 'B', 'C'];
  return [0, 1, 2].map(function(i){
    var vals = {}; (c.fields || []).forEach(function(f){ vals[f.name] = _catfSampleVal(f.name, i); });
    return { name: base + ' · ' + suffix[i], unit: c.baseUnit || '', price: _catfSampleVal('price', i), values: vals };
  });
}
function _catfSourceModel(vertical, purpose){
  var t = CATF_KB[vertical] || {}; var req = CATF_REQUIRED[vertical] || [];
  var c = CBCatalogue.ensure({ story: purpose || '', product: t.product || (vertical && vertical !== 'generic' ? (vertical[0].toUpperCase() + vertical.slice(1)) : 'Your catalogue'), baseUnit: t.baseUnit || '' });
  var facets = _catfFacets({ facets: t.facets });
  if (!req.length) req = [{ name: 'specification', leg: 'cb' }, { name: 'stock', leg: 'system' }];   // generic gap when the vertical is unknown
  req.forEach(function(r){
    if (r.leg === 'standard') { facets.standards = true; return; }
    if (r.leg === 'system') facets.sourcing = true;
    c.fields.push({ name: r.name, leg: r.leg, via: r.via || (r.leg === 'system' ? 'ERP' : r.leg === 'compute' ? 'AI' : ''), type: /price|score|pct|weight|temp|qty|stock|count|fineness|sqft|litres|coverage|needed|area/.test(r.name) ? 'number' : /expiry|date/.test(r.name) ? 'date' : 'text' });
  });
  var draft = { method: t.method || _catfInfer(purpose).method, facets: facets, adoptedFrom: t.title || '', templateKey: vertical, required: req, sourced: true, catalogue: CBCatalogue.ensure(c) };
  draft.sampleRows = _catfKnowledgeItems(vertical, draft.catalogue);
  draft.items = (CATF_SOURCE_ITEMS[vertical] || []).map(function(it){ return Object.assign({ _src: 'reference', price: null }, it); });   // adoption brings the source's items; owner only sets price
  return draft;
}

/* ---- actions ---- */
function catfMode(m){ UI.catfMode = m; renderApp(); }
/* the maximum datatype palette — the grammar the AI composes any catalogue from in real time (templates are just a stub) */
function catfShowPalette(){
  var P = CBCatalogue.PALETTE();
  var chip = function(t){ return '<span style="display:inline-block;font-size:11px;background:#eef2f7;border-radius:6px;padding:2px 8px;margin:2px 4px 2px 0">' + esc(t) + '</span>'; };
  var section = function(title, inner){ return '<div style="margin-top:13px"><div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">' + esc(title) + '</div><div style="margin-top:5px">' + inner + '</div></div>'; };
  var dt = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px">' + P.datatypes.map(function(d){ return '<div style="font-size:11.5px;padding:1px 0"><b>' + esc(d.label) + '</b> <span style="color:var(--grey)">— ' + esc(d.note) + '</span></div>'; }).join('') + '</div>';
  var body = '<div style="padding:14px 18px;max-height:70vh;overflow:auto">'
    + '<div style="font-size:12.5px;color:var(--grey);line-height:1.6">We can\'t pre-design every catalogue. The code fixes this <b>grammar</b> — the maximum datatypes/primitives — and an <b>AI composes any catalogue from it in real time</b>. The templates are just a stub for now.</div>'
    + section('DATATYPES · ' + P.datatypes.length, dt)
    + section('ORIGIN — the four legs', P.legs.map(function(l){ return chip(l.short); }).join(''))
    + section('STOREFRONT METHODS (one per catalogue)', P.methods.map(function(m){ return chip(m.label); }).join(''))
    + section('FACETS (deepen when needed)', P.facets.map(chip).join(''))
    + section('PRICING', P.pricingModels.map(chip).join('') + ' <span style="color:var(--grey);font-size:11px">· held</span> ' + P.priceBy.map(function(b){ return chip('by ' + b); }).join(''))
    + section('STANDARDS (by reference)', P.standards.map(chip).join(''))
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:14px">Anything a real catalogue needs is a combination of these. The AI picks + arranges them per purpose, in real time.</div>'
    + '</div>';
  if (typeof modal === 'function') modal('<div class="mhd"><div class="t">🎛 Datatype palette — what the AI composes from</div></div><div class="mbody" style="padding:0">' + body + '</div>', true);
  else if (typeof toast === 'function') toast('Palette: ' + P.datatypes.length + ' datatypes');
}
function catfPreviewTemplate(key){ UI.catfDraft = key ? _catfSourceModel(key, '') : null; UI.catfPick = key; renderApp(); }   // adopt = source the full visible model
function catfStudy(){ var p = (val('catf_purpose') || '').trim(); var csv = (val('catf_csv') || '');
  if (!p && !csv.trim()) { if (typeof toast === 'function') toast('Describe the purpose (we source the rest), or paste inventory.'); return; }
  UI.catfDraft = csv.trim() ? _catfStudy(p, csv) : _catfSourceModel(_catfVerticalFromPurpose(p) || 'generic', p);   // no data → source from knowledge
  renderApp(); }
function catfCommit(){ if (!UI.catfDraft) return; UI.catf = UI.catfDraft; UI.catfDraft = null; _catfSave(); renderApp(); }
function catfSetPurpose(v){ if (UI.catf) { UI.catf.catalogue.story = v; _catfSave(); } }
function catfSetMethod(v){ if (UI.catf) { UI.catf.method = v; _catfSave(); renderApp(); } }
function catfToggleFacet(k){ if (!UI.catf) return; UI.catf.facets = _catfFacets(UI.catf); UI.catf.facets[k] = !UI.catf.facets[k]; _catfSave(); renderApp(); }
function catfReset(){ if (typeof confirm === 'function' && !confirm('Start the catalogue setup over? (items are not affected)')) return; UI.catf = null; UI.catfDraft = null; UI.catfPick = ''; try { localStorage.removeItem(_catfKey()); } catch (e) {} renderApp(); }

/* ---- ADOPTED RENDERER: json-editor (MIT) renders an item-entry form straight from our JSON Schema.
   Lazy-loaded (535KB) only when the designer fills an item — no schema/form code of our own. ---- */
var _jePromise = null;
function _catfLoadJE(){
  if (typeof window !== 'undefined' && window.JSONEditor) return Promise.resolve();
  if (_jePromise) return _jePromise;
  _jePromise = new Promise(function(res, rej){ var s = document.createElement('script'); s.src = '/app/vendor/json-editor.min.js'; s.async = true; s.onload = function(){ res(); }; s.onerror = function(){ _jePromise = null; rej(new Error('load failed')); }; document.head.appendChild(s); });
  return _jePromise;
}
function catfFillItem(){
  var f = UI.catf || UI.catfDraft; if (!f) { if (typeof toast === 'function') toast('Set up a catalogue first.'); return; }
  var c = CBCatalogue.ensure(f.catalogue);
  var full = CBCatalogue.toJSONSchema(c, { method: f.method, currency: _catfCcy(), facets: _catfFacets(f) });
  // ADD FORM = only the fields the OWNER types: identity + unit + the CB gap. Hide system-fed (ERP), computed (AI),
  // at-order (customer), and by-reference (standards) — those aren't typed here.
  var props = {}; Object.keys(full.properties || {}).forEach(function(k){ var p = full.properties[k]; var leg = p['x-cb-leg']; var role = p['x-cb-role']; if (role === 'identity' || role === 'unit' || !leg || leg === 'cb') props[k] = p; });
  if (['cart', 'range', 'qtyprice'].indexOf(f.method) >= 0 && !props.price) props.price = { type: 'number', title: 'Price (' + _catfCcy() + ')' };
  var schema = Object.assign({}, full, { properties: props }); delete schema['$schema'];
  window._catfSchema = schema;
  var style = '<style>#cat_je > div > h3,#cat_je .je-object__title{font-size:13px;font-weight:700;margin:0}#cat_je label{display:block;font-size:11px;color:#6a707a;font-weight:600;margin:9px 0 3px}#cat_je input[type=text],#cat_je input[type=number],#cat_je select,#cat_je textarea{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:7px;font-size:13px;background:var(--paper,#fff)}#cat_je .je-indented-panel{border:none;padding:0;margin:0}#cat_je p.je-object__title + *{margin-top:0}#cat_je .je-header{margin-bottom:2px}</style>';
  modal('<div class="mhd"><div class="t">Add an item</div></div><div class="mbody" style="padding:0"><div style="padding:14px 18px">' + style + '<div style="font-size:11.5px;color:var(--grey);margin-bottom:12px">Fill in the details for this item.</div><div id="cat_je" style="color:var(--grey);font-size:12px">…</div><div id="cat_je_out" style="margin-top:12px"></div><div style="display:flex;gap:8px;margin-top:16px"><button class="pri" onclick="catfCaptureItem()" style="padding:9px 16px">Save item</button><button onclick="closeModal()" style="padding:9px 16px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--grey)">Cancel</button></div></div></div>', true);
  _catfLoadJE().then(function(){
    setTimeout(function(){ var el = document.getElementById('cat_je'); if (!el) return; el.innerHTML = '';
      try { if (window._catfJE) { try { window._catfJE.destroy(); } catch (e) {} } window._catfJE = new window.JSONEditor(el, { schema: window._catfSchema, theme: 'html', disable_edit_json: true, disable_properties: true, disable_collapse: true, no_additional_properties: true }); } catch (e) { el.innerHTML = '<div style="color:#a5382e;font-size:12px">json-editor failed: ' + esc(e.message) + '</div>'; }
    }, 40);
  }).catch(function(){ var el = document.getElementById('cat_je'); if (el) el.innerHTML = '<div style="color:#a5382e;font-size:12px">Could not load the json-editor library (/app/vendor/json-editor.min.js).</div>'; });
}
function catfCaptureItem(){
  if (!window._catfJE) return; var v; try { v = window._catfJE.getValue(); } catch (e) { return; }
  if (UI.catf) {   // committed catalogue → SAVE to the real catalogue via the existing products API (behind the scenes)
    var item = Object.assign({ _src: 'manual' }, v || {});
    var item_data = Object.assign({}, v || {}, { name: (v && (v.product || v.name)) || 'item' });   // existing catalogue reads item_data.name/unit/price
    UI.catf.items = UI.catf.items || []; UI.catf.items.push(item); _catfSave();   // keep a local copy for the instant customer preview
    if (typeof closeModal === 'function') closeModal();
    if (typeof api === 'function') {
      api('prodAdd', { body: { item_data: item_data } })
        .then(function(){ if (typeof toast === 'function') toast('Item saved to your catalogue ✓'); renderApp(); })
        .catch(function(e){ if (typeof toast === 'function') toast('Saved on this device — server save failed' + (e && e.message ? ': ' + e.message : '')); renderApp(); });
    } else { if (typeof toast === 'function') toast('Item added ✓'); renderApp(); }
    return;
  }
  var out = document.getElementById('cat_je_out'); if (!out) return;   // draft preview → just show the JSON
  out.innerHTML = '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em">CAPTURED ITEM — conforms to the schema</div>'
    + '<pre style="background:#0f1720;color:#d6e2f0;border-radius:8px;padding:10px 12px;font-size:11px;overflow:auto;max-height:30vh;margin-top:6px;white-space:pre">' + esc(JSON.stringify(v, null, 2)) + '</pre>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:4px">A real catalogue_item — this is the JSON that gets sealed onto the chit.</div>';
}
function _catfItemToRow(it){ it = it || {}; var name = it.product || it.name || 'item'; var unit = it.unit || ''; var price = (it.price != null ? it.price : (it.rate != null ? it.rate : '')); var values = {}; Object.keys(it).forEach(function(k){ if (k.charAt(0) !== '_' && ['product', 'name', 'unit', 'price', 'rate'].indexOf(k) < 0 && it[k] !== '' && it[k] != null) values[k] = it[k]; }); return { name: name, unit: unit, price: price, values: values }; }
function catfCustomerPreview(){
  var f = UI.catf; if (!f) return; var c = CBCatalogue.ensure(f.catalogue); var facets = _catfFacets(f);
  var items = (f.items || []).map(_catfItemToRow);
  var tmp = Object.assign({}, f, items.length ? { sampleRows: items } : {});
  if (typeof modal === 'function') modal('<div class="mhd"><div class="t">👁 Customer experience — end to end</div></div><div class="mbody" style="padding:0"><div style="padding:14px 18px;max-height:72vh;overflow:auto">' + _catfAppearsTab(tmp, c, facets) + '</div></div>', true);
}

/* ---- render ---- */
function catalogueSetupScreen(){
  _catfInit();
  return UI.catf ? _catfFaceView() : _catfTwoPanelSetup();
}

function _catfSettingsNote(){ return 'Currency <b>' + esc(_catfCcy()) + '</b> · country <b>' + esc(_catfCountry()) + '</b> — from <b>Settings</b> (set at registration), inherited here.'; }

/* ===== two-panel SETUP: left = choose/feed · right = live "how it looks" ===== */
function _catfTwoPanelSetup(){
  var mode = UI.catfMode || 'adopt';
  var seg = function(m, l){ var on = mode === m; return '<button onclick="catfMode(\'' + m + '\')" style="border:1px solid var(--line);background:' + (on ? 'var(--ink,#1c2128)' : '#fff') + ';color:' + (on ? '#fff' : 'var(--grey)') + ';font-size:12px;font-weight:700;padding:6px 14px;cursor:pointer">' + l + '</button>'; };
  var left = '<div style="font-size:17px;font-weight:800">🗂️ Set up your catalogue</div>'
    + '<div style="font-size:12px;color:var(--grey);margin:6px 0 4px;line-height:1.6">One <b>face</b> for the whole catalogue — one purpose, one way of selling. Items conform.</div>'
    + '<div style="font-size:11px;color:var(--grey);margin-bottom:6px">' + _catfSettingsNote() + '</div>'
    + '<div style="margin-bottom:12px"><span onclick="catfShowPalette()" style="cursor:pointer;font-size:11px;color:var(--blue);font-weight:600">🎛 The datatype palette the AI composes from →</span></div>'
    + '<div style="display:inline-flex;border-radius:9px;overflow:hidden;border:1px solid var(--line)">' + seg('adopt', '🔎 Adopt a template') + seg('build', '🛠 Build from purpose') + '</div>';

  if (mode === 'adopt') {
    var opts = '<option value="">— choose a template —</option>' + Object.keys(CATF_KB).map(function(k){ return '<option value="' + k + '"' + (UI.catfPick === k ? ' selected' : '') + '>' + esc(CATF_KB[k].title) + '</option>'; }).join('');
    left += '<label style="font-size:11px;color:var(--grey);display:block;margin-top:16px">Template <span style="color:var(--faint,#8a929e)">(if you know what it is)</span></label>'
      + '<select onchange="catfPreviewTemplate(this.value)" style="margin-top:5px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;font-size:13px;min-width:220px">' + opts + '</select>'
      + '<div style="font-size:11px;color:var(--grey);margin-top:8px;font-style:italic">Pick one → the right panel shows how that catalogue looks.</div>';
  } else {
    left += '<label style="font-size:11px;color:var(--grey);display:block;margin-top:16px">Purpose</label>'
      + '<textarea id="catf_purpose" placeholder="e.g. Sell vegetables by the kg · or · reorder cable stock from ERP by EOQ" rows="2" style="width:100%;margin-top:5px;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:13px;resize:vertical"></textarea>'
      + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:12px">Feed your existing inventory <span style="color:var(--faint,#8a929e)">(so we can meet the purpose)</span></label>'
      + '<div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap"><span style="font-size:11px;border:1px solid var(--line);border-radius:7px;padding:4px 10px;background:#f5f7f9;color:var(--grey)">📄 CSV (paste below)</span><span title="via connector — later slice" style="font-size:11px;border:1px dashed var(--line);border-radius:7px;padding:4px 10px;color:var(--faint,#8a929e)">🔗 ERP · CSV upload (soon)</span></div>'
      + '<textarea id="catf_csv" placeholder="name,unit,price,stock,hsn\nTomato,kg,40,120,0702\nOnion,kg,30,300,0703" rows="5" style="width:100%;margin-top:6px;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:12px;font-family:monospace;resize:vertical"></textarea>'
      + '<button class="pri" onclick="catfStudy()" style="margin-top:8px;padding:9px 15px">Study &amp; suggest a model →</button>'
      + '<div style="font-size:11px;color:var(--grey);margin-top:6px;font-style:italic">We study the columns (stock → ERP feed, price → pricing, HSN → standards, …) and propose the model on the right.</div>';
  }

  var right = _catfDraftPreview(UI.catfDraft);
  return '<div style="display:flex;height:100%;min-height:0">'
    + '<div style="flex:0 0 47%;max-width:560px;border-right:1px solid var(--line);overflow-y:auto;padding:20px 18px">' + left + '</div>'
    + '<div style="flex:1;min-width:0;overflow-y:auto;padding:20px 18px;background:#fbfdff">' + right + '</div>'
    + '</div>';
}

/* right panel: how the (pending) catalogue will look */
function _catfDraftPreview(f){
  if (!f) return '<div style="color:var(--grey);font-size:13px;max-width:340px;margin-top:40px;text-align:center;margin-left:auto;margin-right:auto"><div style="font-size:34px">👁️</div><div style="font-weight:700;margin-top:6px">How it will look</div><div style="margin-top:4px">Pick a template, or study your inventory — and this side shows the catalogue we\'ll create.</div></div>';
  var c = CBCatalogue.ensure(f.catalogue), facets = _catfFacets(f);
  var methLabel = (CATF_METHODS.filter(function(m){ return m.k === f.method; })[0] || {}).label || f.method;
  var facetChips = CATF_FACETS.filter(function(x){ return facets[x.k]; }).map(function(x){ return '<span style="font-size:10.5px;color:#2c7a43;background:#e6f4ec;border-radius:5px;padding:2px 8px;margin:2px 4px 0 0;display:inline-block">' + esc(x.label) + '</span>'; }).join('') || '<span style="font-size:11px;color:var(--grey)">simple — name & price only</span>';
  var head = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">👁️ HOW YOUR CATALOGUE WILL LOOK</div>'
    + '<div style="margin-top:8px;padding:11px 13px;border:1px solid var(--line);border-radius:10px;background:#fff">'
    + '<div style="font-weight:700;font-size:14px">' + esc(c.product || 'Your catalogue') + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:3px">sells by <b>' + esc(methLabel) + '</b> · in <b>' + esc(_catfCcy()) + '</b>' + (f.adoptedFrom ? ' · adopted <b>' + esc(f.adoptedFrom) + '</b>' : f.studied ? ' · from your <b>' + f.studied.cols + ' columns / ' + f.studied.rows + ' rows</b>' : ' · built from purpose') + '</div>'
    + '<div style="margin-top:7px">' + facetChips + '</div></div>';
  var tab = UI.catfPTab || 'holds';
  var tabBar = '<div style="display:flex;gap:5px;margin-top:14px;flex-wrap:wrap">' + [['holds', '📋 What it holds'], ['appears', '🧾 How it appears in a chit'], ['schema', '📐 JSON Schema']].map(function(t){ var on = tab === t[0]; return '<span onclick="catfPTab(\'' + t[0] + '\')" style="cursor:pointer;font-size:11.5px;font-weight:600;padding:5px 13px;border-radius:14px;border:1px solid ' + (on ? '#2c5aa0' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--grey)') + ';background:' + (on ? '#2c5aa0' : '#fff') + '">' + t[1] + '</span>'; }).join('') + '</div>';
  var body = tab === 'appears' ? _catfAppearsTab(f, c, facets) : tab === 'schema' ? _catfSchemaTab(f, c, facets) : _catfHoldsTab(f, c, facets);
  return head + tabBar + '<div style="margin-top:12px">' + body + '</div>'
    + '<button class="pri" onclick="catfCommit()" style="margin-top:16px;padding:10px 18px">Use this catalogue ✓</button>';
}
function catfPTab(t){ UI.catfPTab = t; renderApp(); }

/* TAB 1 — what the catalogue holds (the structure) */
function _catfHoldsTab(f, c, facets){
  var mapping = (f.mapping && f.mapping.length) ? '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">STUDIED YOUR COLUMNS →</div>'
    + '<div style="margin-top:6px">' + f.mapping.map(function(m){ var badge = m.role === 'name' ? ['identity', '#2c5aa0'] : m.role === 'price' ? ['price', '#b07b1e'] : m.role === 'unit' ? ['unit', '#8a5a1e'] : m.role === 'code' ? ['standard', '#8a5cc4'] : m.leg === 'system' ? [(m.via || 'ERP') + ' feed', '#b07b1e'] : ['stored in CB', '#2c7a43']; return '<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;padding:2px 0"><span style="font-family:monospace;color:var(--grey);min-width:120px">' + esc(m.col) + '</span><span style="color:#9aa3a7">→</span><span style="font-size:10px;font-weight:700;color:' + badge[1] + ';background:' + badge[1] + '18;border-radius:4px;padding:1px 7px">' + esc(badge[0]) + '</span></div>'; }).join('') + '</div>' : '';
  var chain = CBCatalogue.routeChain(c);
  var legMeta = { system: ['From your systems (ERP/IoT)', '#b07b1e'], customer: ['From the customer', '#2b6f8f'], compute: ['Computed by co-assist', '#8a5cc4'], cb: ['Stored in CB — the gap', '#2c7a43'] };
  var visRows = ['system', 'customer', 'compute', 'cb'].map(function(k){ var fs = (chain[k] || []).filter(function(x){ return !x.identity; }).map(function(x){ return x.name + (x.via ? ' · ' + x.via : ''); }); if (!fs.length) return ''; var mm = legMeta[k]; return '<div style="font-size:11.5px;padding:3px 0;line-height:1.5"><span style="font-size:9.5px;font-weight:700;color:' + mm[1] + ';background:' + mm[1] + '1a;border-radius:4px;padding:1px 6px">' + esc(mm[0]) + '</span> <span style="color:#3a4048">' + fs.map(esc).join(' · ') + '</span></div>'; }).join('');
  if (facets.standards) visRows += '<div style="font-size:11.5px;padding:3px 0"><span style="font-size:9.5px;font-weight:700;color:#6a4fa0;background:#6a4fa01a;border-radius:4px;padding:1px 6px">Standards</span> <span style="color:#3a4048">HS / GS1 — by reference</span></div>';
  if (facets.media) visRows += '<div style="font-size:11.5px;padding:3px 0"><span style="font-size:9.5px;font-weight:700;color:#7a5e22;background:#f6ecd8;border-radius:4px;padding:1px 6px">Media</span> <span style="color:#3a4048">images / video</span></div>';
  var vis = visRows ? '<div style="' + (mapping ? 'margin-top:12px;' : '') + 'font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">WHAT THE CATALOGUE HOLDS ' + (f.sourced ? '<span style="font-weight:500;color:var(--grey)">— sourced (not in your data yet)</span>' : '') + '</div><div style="margin-top:6px">' + visRows + '</div>' : '';
  var rows = (f.sampleRows && f.sampleRows.length) ? f.sampleRows : [{ name: c.product || 'Sample item', unit: facets.variants ? (c.baseUnit || 'unit') : '', price: '' }];
  var items = '<div style="margin-top:14px;font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em">SAMPLE ITEMS (as records)</div><div style="margin-top:6px">'
    + rows.map(function(r){ var price = r.price !== '' && r.price != null ? _catfMoney(r.price) : (f.method === 'cart' ? _catfMoney(40) : '');
      var vals = r.values ? Object.keys(r.values).slice(0, 4).map(function(kk){ return esc(kk) + '=' + esc(r.values[kk]); }).join(' · ') : '';
      return '<div style="padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:#fff;margin-bottom:5px"><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;font-size:12.5px">' + esc(r.name || 'item') + '</span>' + (r.unit ? '<span style="font-size:10px;color:#7a5e22;background:var(--gold-soft,#f6ecd8);border-radius:4px;padding:1px 6px">' + esc(r.unit) + '</span>' : '') + (price ? '<span style="margin-left:auto;font-weight:700;font-size:12.5px">' + esc(price) + '</span>' : '') + '</div>' + (vals ? '<div style="font-size:10px;color:var(--faint,#8a929e);margin-top:4px;font-family:monospace">' + vals + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  return mapping + vis + items;
}

/* TAB 3 — the catalogue as STANDARD JSON Schema (what an AI emits; RJSF/JSON Forms/json-editor render it). Adopt, don't reinvent. */
function _catfSchemaTab(f, c, facets){
  var schema = CBCatalogue.toJSONSchema(c, { method: f.method, currency: _catfCcy(), facets: facets });
  var json = JSON.stringify(schema, null, 2);
  return '<div style="font-size:11.5px;color:var(--grey);line-height:1.6">This is the catalogue as <b>standard JSON Schema</b> — what an AI emits per purpose, and what any renderer (<b>react-jsonschema-form · JSON Forms · json-editor</b>) turns into a form for free. We add only the CB-unique overlay: <code style="background:#eef2f7;padding:1px 4px;border-radius:3px">x-cb-leg</code> (where each field comes from) and <code style="background:#eef2f7;padding:1px 4px;border-radius:3px">x-cb-seal</code>.</div>'
    + '<pre style="margin-top:10px;background:#0f1720;color:#d6e2f0;border-radius:9px;padding:12px 14px;font-size:11px;line-height:1.5;overflow:auto;max-height:52vh;white-space:pre">' + esc(json) + '</pre>'
    + '<div style="margin-top:10px"><button class="pri" onclick="catfFillItem()" style="padding:8px 14px">▶ Render this schema as a form (json-editor)</button></div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:6px">Adopt the standard, arrange it our way. The four legs ride as x-cb-leg; everything else is off-the-shelf.</div>';
}
function _catfMethodControl(method, price){
  var p = price != null && price !== '' ? _catfMoney(price) : _catfMoney(40);
  var btn = 'background:#2c5aa0;color:#fff;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:600';
  if (method === 'text') return '<span style="font-size:11px;color:var(--grey)">information only</span>';
  if (method === 'cart') return '<span style="font-size:11px;color:var(--grey)">Qty ▢ × ' + esc(p) + '</span> <span style="' + btn + '">Add</span>';
  if (method === 'range') return '<span style="font-size:11px;color:var(--grey)">' + esc(_catfMoney(3200)) + ' – ' + esc(_catfMoney(3600)) + '</span> <span style="' + btn + '">Order</span>';
  if (method === 'qty') return '<span style="font-size:11px;color:var(--grey)">Qty ▢</span> <span style="' + btn + '">Order</span>';
  return '<span style="font-size:11px;color:var(--grey)">Qty ▢ · your price ▢</span> <span style="' + btn + '">Offer</span>';
}

/* TAB 2 — the customer front: the Amazon-style END-TO-END experience (browse → product → cart → order = chit) */
function _catfAppearsTab(f, c, facets){
  var rows = (f.sampleRows && f.sampleRows.length) ? f.sampleRows.slice(0, 3) : [{ name: c.product || 'Item', unit: c.baseUnit || '', price: 40, values: {} }];
  var visFields = (c.fields || []).slice(0, 4);
  var ccy = _catfCcy();
  var priceOf = function(r){ return (r.price != null && r.price !== '') ? r.price : 40; };
  var step = function(n, title, inner){ return '<div style="border:1px solid var(--line);border-radius:11px;background:#fff;padding:11px 13px;margin-top:8px"><div style="font-size:10px;font-weight:800;color:#2c5aa0;letter-spacing:.04em;margin-bottom:8px">' + n + ' · ' + title + '</div>' + inner + '</div>'; };
  var arrow = '<div style="text-align:center;color:#c8d0d9;font-size:15px;line-height:1.1">↓</div>';
  // 1 · browse (listing grid)
  var browse = '<div style="display:flex;gap:8px;flex-wrap:wrap">' + rows.map(function(r){ return '<div style="width:132px;border:1px solid var(--line);border-radius:9px;padding:8px 9px;background:#fff">' + (facets.media ? '<div style="height:46px;border-radius:6px;background:linear-gradient(135deg,#eef1f5,#dde3ea);margin-bottom:6px"></div>' : '') + '<div style="font-weight:600;font-size:11.5px;line-height:1.2">' + esc(r.name || 'item') + '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span style="font-weight:700;font-size:11.5px">' + esc(_catfMoney(priceOf(r))) + '</span><span style="background:#2c5aa0;color:#fff;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600">' + (f.method === 'cart' ? 'Add' : 'View') + '</span></div></div>'; }).join('') + '</div>';
  // 2 · product detail
  var p0 = rows[0] || {};
  var spec = visFields.map(function(fl){ var v = (p0.values && p0.values[fl.name]) || _catfSampleVal(fl.name, 0); return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px dashed var(--line)"><span style="color:var(--grey)">' + esc(fl.name) + '</span><span style="font-family:monospace">' + esc(v) + '</span></div>'; }).join('');
  var detail = '<div style="display:flex;gap:11px">' + (facets.media ? '<div style="width:86px;height:86px;border-radius:9px;background:linear-gradient(135deg,#eef1f5,#dde3ea);flex:none"></div>' : '') + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">' + esc(p0.name || c.product || 'Item') + '</div><div style="font-weight:800;font-size:15px;margin-top:2px">' + esc(_catfMoney(priceOf(p0))) + (p0.unit ? ' <span style="font-size:11px;color:var(--grey);font-weight:400">/ ' + esc(p0.unit) + '</span>' : '') + '</div>' + (spec ? '<div style="margin-top:8px">' + spec + '</div>' : '') + '<div style="margin-top:10px">' + _catfMethodControl(f.method, p0.price) + '</div></div></div>';
  // 3 · cart & checkout
  var qty = 3; var up = parseFloat(priceOf(p0)) || 40; var tot = f.method === 'cart' ? up * qty : up;
  var cart = '<div style="display:flex;justify-content:space-between;font-size:12px"><span>' + esc(p0.name || 'Item') + ' × ' + qty + '</span><span style="font-weight:600">' + esc(_catfMoney(tot)) + '</span></div><div style="display:flex;justify-content:space-between;margin-top:6px;border-top:1px solid var(--line);padding-top:6px"><span style="font-weight:700">Total (' + esc(ccy) + ')</span><span style="font-weight:800">' + esc(_catfMoney(tot)) + '</span></div><div style="text-align:right;margin-top:9px"><span style="background:#2c7a43;color:#fff;border-radius:6px;padding:5px 14px;font-size:11.5px;font-weight:600">Place order</span></div>';
  // 4 · order placed → the chit (final output, both sides keep a copy)
  var fieldLines = visFields.map(function(fl){ var v = (p0.values && p0.values[fl.name]) || _catfSampleVal(fl.name, 0); return '<div style="display:flex;justify-content:space-between;font-size:10.5px;padding:1px 0"><span style="color:var(--grey)">' + esc(fl.name) + '</span><span style="font-family:monospace;color:var(--faint,#8a929e)">' + esc(v) + '</span></div>'; }).join('');
  var chit = '<div style="max-width:280px;margin:0 auto;border:1px solid var(--line);border-top:3px solid #2c5aa0;border-radius:10px;padding:11px 12px;background:#fbfdff"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;font-size:12.5px">' + esc(p0.name || 'Item') + '</span><span style="font-size:9.5px;color:#2c7a43;font-weight:700">✓ placed</span></div><div style="font-size:11px;color:var(--grey);margin-top:3px">Qty ' + qty + (f.method === 'cart' ? ' · ' + esc(_catfMoney(tot)) : '') + (p0.unit ? ' ' + esc(p0.unit) : '') + '</div>' + (fieldLines ? '<div style="margin-top:6px;border-top:1px dashed var(--line);padding-top:5px">' + fieldLines + '</div>' : '') + '<div style="border-top:1px dashed var(--line);margin-top:8px;padding-top:5px;font-size:9.5px;color:var(--faint,#8a929e);font-family:monospace">🔒 sealed · arrives on the rail · both parties keep a copy</div></div>';
  return '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em">🛍 CUSTOMER EXPERIENCE — end to end</div>'
    + step('1', 'Browse the storefront', browse) + arrow
    + step('2', 'Open a product', detail) + arrow
    + step('3', 'Cart &amp; checkout', cart) + arrow
    + step('4', 'Order placed → the chit', chit)
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:8px">This is what your customer experiences — and the chit is what both sides keep.</div>';
}

/* the items under this face — each tagged by SOURCE (reference / manual / ERP). For referenced items the owner only sets price. */
function _catfSrcTag(src){ return src === 'reference' ? ['📎 from source', '#6a44a8'] : src === 'erp' ? ['🔗 from ERP', '#b07b1e'] : ['✍ entered', '#2c7a43']; }
function _catfItemsHtml(f){
  var items = (f.items || []); if (!items.length) return '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:18px">YOUR ITEMS · 0</div><div style="font-size:11px;color:var(--grey);padding:4px 0">No items yet — adopt a source, add manually, or pull from ERP.</div>';
  var needPrice = items.filter(function(it){ return it.price == null || it.price === ''; }).length;
  var rows = items.map(function(it, i){
    var t = _catfSrcTag(it._src);
    var attrs = Object.keys(it).filter(function(k){ return ['product', 'name', 'price', 'unit', '_src', '_media', 'rate'].indexOf(k) < 0 && it[k] != null && it[k] !== ''; }).slice(0, 3).map(function(k){ return esc(k) + ': ' + esc(it[k]); }).join(' · ');
    var priceCell = (it.price != null && it.price !== '')
      ? '<span style="font-weight:700;font-size:12px">' + esc(_catfMoney(it.price)) + '</span> <span onclick="catfEditPrice(' + i + ')" style="cursor:pointer;color:var(--blue);font-size:10px">edit</span>'
      : '<input type="number" placeholder="set price" onchange="catfSetItemPrice(' + i + ',this.value)" title="the ONLY thing you enter for a referenced item" style="width:92px;padding:4px 7px;border:1px solid #d98b84;border-radius:6px;font-size:12px;background:#fbeeec">';
    return '<div style="border:1px solid var(--line);border-radius:9px;padding:8px 11px;margin-top:5px;background:#fff"><div style="display:flex;align-items:center;gap:8px">'
      + (it._media ? '<span style="width:22px;height:22px;border-radius:5px;background:linear-gradient(135deg,#eef1f5,#dde3ea);flex:none"></span>' : '')
      + '<span style="font-weight:600;font-size:12.5px">' + esc(it.product || it.name || 'item') + '</span>'
      + '<span style="font-size:9.5px;font-weight:700;color:' + t[1] + ';background:' + t[1] + '18;border-radius:4px;padding:1px 6px">' + t[0] + '</span>'
      + '<span style="margin-left:auto">' + priceCell + '</span></div>'
      + (attrs ? '<div style="font-size:10.5px;color:var(--grey);margin-top:3px">' + attrs + (it._src === 'reference' ? ' <span style="color:#6a44a8">· referenced, kept inside</span>' : '') + '</div>' : '') + '</div>';
  }).join('');
  return '<div style="font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:18px">YOUR ITEMS · ' + items.length + (needPrice ? ' <span style="color:#a5382e;font-weight:600">· ' + needPrice + ' need a price</span>' : ' <span style="color:#2c7a43">· ready</span>') + '</div><div style="margin-top:4px">' + rows + '</div>';
}
function catfSetItemPrice(i, v){ if (!UI.catf || !UI.catf.items || !UI.catf.items[i]) return; var x = parseFloat(v); UI.catf.items[i].price = (v === '' || isNaN(x)) ? null : x; _catfSave(); renderApp(); }
function catfEditPrice(i){ if (!UI.catf || !UI.catf.items || !UI.catf.items[i]) return; UI.catf.items[i].price = null; _catfSave(); renderApp(); }
function catfSyncERP(){ if (!UI.catf) { if (typeof toast === 'function') toast('Set up a catalogue first.'); return; } UI.catf.items = UI.catf.items || []; UI.catf.items.push({ _src: 'erp', product: 'Royale Matt (from ERP)', texture_family: 'Matt', colour_combination: 'White', sheen: 'Matte', coverage_sqft_per_litre: 150, stock_litres: 240, price: 520 }); _catfSave(); if (typeof toast === 'function') toast('Pulled 1 item from ERP (stub) — its data + price came in'); renderApp(); }

/* ===== committed FACE view (after "Use this catalogue") ===== */
function _catfFaceView(){
  var f = UI.catf, c = CBCatalogue.ensure(f.catalogue), facets = _catfFacets(f);
  var methOpts = CATF_METHODS.map(function(m){ return '<option value="' + m.k + '"' + (f.method === m.k ? ' selected' : '') + '>' + m.label + '</option>'; }).join('');
  var methHint = (CATF_METHODS.filter(function(m){ return m.k === f.method; })[0] || {}).hint || '';
  var facetRows = CATF_FACETS.map(function(x){ var on = !!facets[x.k];
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">'
      + '<div style="flex:1"><div style="font-weight:600;font-size:12.5px;color:' + (on ? '#1c2128' : 'var(--grey)') + '">' + esc(x.label) + '</div><div style="font-size:11px;color:var(--grey)">' + esc(x.hint) + '</div></div>'
      + '<span onclick="catfToggleFacet(\'' + x.k + '\')" style="cursor:pointer;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:14px;border:1px solid ' + (on ? '#2c7a43' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--blue)') + ';background:' + (on ? '#2c7a43' : '#fff') + '">' + (on ? '✓ on' : '＋ add') + '</span></div>';
  }).join('');
  var inner = '<div style="max-width:660px">'
    + '<div style="display:flex;align-items:center;gap:10px"><div style="font-size:18px;font-weight:800">🗂️ Catalogue face</div>' + (f.adoptedFrom ? '<span style="font-size:10.5px;font-weight:700;color:#2c5aa0;background:#eef2f7;border-radius:5px;padding:2px 8px">adopted · ' + esc(f.adoptedFrom) + '</span>' : '<span style="font-size:10.5px;font-weight:700;color:#6a4fa0;background:#efeafa;border-radius:5px;padding:2px 8px">built from your data</span>') + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:4px">One face for the whole catalogue — every item conforms. ' + _catfSettingsNote() + '</div>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:14px">Purpose</label>'
    + '<textarea oninput="catfSetPurpose(this.value)" rows="2" style="width:100%;margin-top:4px;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:9px;font-size:13px;resize:vertical">' + esc(c.story || '') + '</textarea>'
    + '<label style="font-size:11px;color:var(--grey);display:block;margin-top:12px">How the store sells <span style="color:var(--faint,#8a929e)">— one method for the whole catalogue</span></label>'
    + '<select onchange="catfSetMethod(this.value)" style="margin-top:4px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:13px">' + methOpts + '</select>'
    + '<div style="font-size:11px;color:var(--grey);font-style:italic;margin-top:3px">' + esc(methHint) + '</div>'
    + '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:16px">DEEPEN THE CATALOGUE <span style="font-weight:500;color:var(--grey)">— add only what this business needs</span></div>'
    + '<div style="margin-top:6px">' + facetRows + '</div>'
    + _catfItemsHtml(f)
    + '<div style="font-size:10.5px;color:var(--grey);margin-top:16px">Item data comes three ways — <b>📎 from the source</b> (owner sets price only) · <b>✍ entered</b> · <b>🔗 from ERP</b>:</div>'
    + '<div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">'
    + '<button class="pri" onclick="catfFillItem()" style="padding:9px 15px">＋ Add manually</button>'
    + '<button onclick="catfSyncERP()" style="padding:9px 15px;border:1px solid #b07b1e;border-radius:9px;background:#fff;color:#b07b1e;font-weight:600">🔗 From ERP</button>'
    + '<button onclick="catfCustomerPreview()" style="padding:9px 15px;border:1px solid #2c7a43;border-radius:9px;background:#fff;color:#2c7a43;font-weight:600">👁 Customer experience</button>'
    + '<button onclick="catfReset()" style="padding:9px 15px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--grey)">↺ Start over</button>'
    + '</div></div>';
  return '<div style="flex:1;min-height:0;overflow-y:auto;padding:22px 20px">' + inner + '</div>';
}
