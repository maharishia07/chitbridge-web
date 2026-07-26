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
  return UI.catf ? _catfFaceView() : _catfWizard();
}

/* ===================== SETUP WIZARD — fill the catalogue step by step (each source optional / partial) ===================== */
var CW_STEPS = ['Vertical', 'Blueprint', 'From ERP', 'Manual', 'Price', 'Tax · finish'];
function _cwLoggedIn(){ return typeof SESSION !== 'undefined' && !!SESSION.token; }
function _cwInit(){
  if (!UI.cw) UI.cw = { step: 1, vertical: '', source: '', built: null, chosen: {}, erp: {}, manual: {}, prices: {}, tax: { label: 'GST', rate: '' } };
  if (UI._cwSources === undefined) { UI._cwSources = null; if (_cwLoggedIn()) api('catalogueSources').then(function(r){ UI._cwSources = (Array.isArray(r) ? r : (r && r.data) || []); renderApp(); }).catch(function(){ UI._cwSources = []; }); else UI._cwSources = []; }
}
// a small field LIBRARY, grouped in sections — the AI suggests from these per purpose (stub for the real AI)
var CW_FIELD_LIB = {
  Identity: [{ name: 'product_name', type: 'text' }, { name: 'brand', type: 'text' }, { name: 'grade', type: 'text' }],
  'Chemical make-up': [{ name: 'chemical_composition', type: 'text' }, { name: 'cas_number', type: 'text' }, { name: 'base_type', type: 'choice' }, { name: 'colour', type: 'choice' }, { name: 'finish', type: 'choice' }],
  Properties: [{ name: 'viscosity', type: 'number' }, { name: 'density', type: 'number' }, { name: 'ph', type: 'number' }, { name: 'voc_content', type: 'number' }, { name: 'coverage_sqft_per_litre', type: 'number' }],
  'Packaging & unit': [{ name: 'pack_size', type: 'number' }, { name: 'shelf_life', type: 'date' }],
  Compliance: [{ name: 'hazard_class', type: 'choice' }, { name: 'msds_ref', type: 'text' }, { name: 'hs_code', type: 'text' }],
};
function _cwSuggestFields(purpose){
  var s = (purpose || '').toLowerCase(); var sections = ['Identity'];
  if (/chemical|paint|coating|ink|adhesive|resin|solvent|lacquer|primer/.test(s)) sections.push('Chemical make-up', 'Properties', 'Compliance');
  sections.push('Packaging & unit');
  if (/export|import|trade|customs/.test(s) && sections.indexOf('Compliance') < 0) sections.push('Compliance');
  var out = []; sections.forEach(function(sec){ (CW_FIELD_LIB[sec] || []).forEach(function(f){ out.push({ section: sec, name: f.name, type: f.type, on: true, leg: 'cb' }); }); });
  return out;
}
function cwUnderstand(){ var w = UI.cw; var p = (val('cw_purpose') || '').trim(); if (!p) { if (typeof toast === 'function') toast('Describe the catalogue first.'); return; } w.purpose = p; w.vertical = _catfVerticalFromPurpose(p) || w.vertical || ''; w.fieldSel = _cwSuggestFields(p); if (!w.unitType) w.unitType = (CATF_KB[w.vertical] && CATF_KB[w.vertical].baseUnit) || 'litre'; renderApp(); }
function cwToggleField(idx){ var f = UI.cw.fieldSel && UI.cw.fieldSel[idx]; if (f) { f.on = !f.on; renderApp(); } }
function cwSetUnit(u){ UI.cw.unitType = u; }
function _cwRequired(w){ if (w.fieldSel && w.fieldSel.length) return w.fieldSel.filter(function(f){ return f.on; }).map(function(f){ return { name: f.name, leg: f.leg || 'cb' }; }); return CATF_REQUIRED[w.vertical] || []; }
function _cwBpFields(w){ var it = w.built && w.built.finishes && w.built.finishes[0]; return it ? Object.keys(it).filter(function(k){ return ['commercials', 'combinations'].indexOf(k) < 0 && it[k] != null && it[k] !== ''; }) : []; }
function _cwNorm(n){ n = (n || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (n === 'productname' || n === 'product' || n === 'item' || n === 'title') return 'name'; if (n === 'colour') return 'color'; return n; }
function _cwCovered(w){ var m = {}; _cwBpFields(w).forEach(function(k){ m[_cwNorm(k)] = 'blueprint'; }); Object.keys(w.erpMap || {}).forEach(function(k){ var mm = w.erpMap[k]; if (mm && mm.system && mm.system !== '—') m[_cwNorm(k)] = 'erp'; }); Object.keys(w.manual || {}).forEach(function(k){ if (w.manual[k] !== '' && w.manual[k] != null) m[_cwNorm(k)] = 'manual'; }); return m; }
function _cwRemaining(w){ var cov = _cwCovered(w); return _cwRequired(w).filter(function(r){ return !cov[_cwNorm(r.name)]; }); }

function _catfWizard(){
  _cwInit(); var w = UI.cw, step = w.step;
  var bar = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">' + CW_STEPS.map(function(s, i){ var n = i + 1, on = n === step, done = n < step; return '<span onclick="cwGo(' + n + ')" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:' + (on ? '#2c5aa0' : done ? '#2c7a43' : 'var(--grey)') + '"><span style="width:19px;height:19px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9.5px;background:' + (on ? '#2c5aa0' : done ? '#2c7a43' : '#eef1f5') + ';color:' + (on || done ? '#fff' : 'var(--grey)') + '">' + (done ? '✓' : n) + '</span>' + esc(s) + '</span>' + (n < CW_STEPS.length ? '<span style="color:#c8d0d9">›</span>' : ''); }).join('') + '</div>';
  var raw = [null, _cwStep1, _cwStep2, _cwStep3, _cwStep4, _cwStep5, _cwStep6][step](w);
  var body = (step === 1 || step === 2) ? raw : _cwTwo(raw, _cwPreview(w));   // steps 1 & 2 own their two-panel; 3–6 get the running preview on the right
  var nav = '<div style="display:flex;gap:10px;margin-top:20px;align-items:center">'
    + (step > 1 ? '<button onclick="cwBack()" style="padding:9px 16px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--grey)">‹ Back</button>' : '')
    + (step < 6 ? '<button class="pri" onclick="cwNext()" style="padding:9px 18px">Next ›</button>' : '<button class="pri" onclick="cwFinish()" style="padding:9px 18px">✓ Finish — go live</button>')
    + (step < 6 ? '<span onclick="cwFinish()" style="cursor:pointer;font-size:11.5px;color:var(--blue)">or finish now (partial is fine)</span>' : '')
    + '<span onclick="cwCancel()" style="cursor:pointer;font-size:11.5px;color:var(--grey);margin-left:auto">Cancel</span></div>';
  return '<div style="flex:1;min-height:0;overflow-y:auto;padding:22px"><div style="max-width:940px"><div style="font-size:19px;font-weight:800">🗂️ Set up your catalogue</div><div style="font-size:11.5px;color:var(--grey);margin:4px 0 16px">Currency <b>' + esc(_catfCcy()) + '</b> — from Settings · fill as much as you can, in order; each step is optional.</div>' + bar + body + nav + '</div></div>';
}
/* two-panel wrapper + the running "catalogue so far" preview (the right side, shared across steps 2–6) */
function _cwTwo(left, right){ return '<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:0 0 46%;min-width:280px;max-width:410px">' + left + '</div><div style="flex:1;min-width:260px;border-left:1px solid var(--line);padding-left:18px">' + right + '</div></div>'; }
function _cwPreview(w){
  var fields = _cwRequired(w), cov = _cwCovered(w);
  var items = (w.built && w.built.finishes || []).filter(function(it){ return w.chosen[it.name] !== false; });
  var title = (w.built && w.built.title) || (CATF_KB[w.vertical] && CATF_KB[w.vertical].product) || (w.purpose ? 'Your catalogue' : '—');
  var head = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">YOUR CATALOGUE SO FAR</div>'
    + '<div style="margin-top:6px;font-size:12.5px;font-weight:700">' + esc(title) + '</div>'
    + '<div style="font-size:10.5px;color:var(--grey)">cart · ' + esc(_catfCcy()) + ' · sold by ' + esc(w.unitType || 'unit') + (w.source ? ' · blueprint ' + esc(w.source) : '') + '</div>';
  var fieldsHtml = fields.length ? '<div style="margin-top:11px;font-size:10px;font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Fields</div>' + fields.map(function(f){ var src = cov[_cwNorm(f.name)]; var b = src === 'blueprint' ? ['📎 blueprint', '#6a44a8'] : src === 'erp' ? ['🔗 ERP', '#b07b1e'] : src === 'manual' ? ['✍ you', '#2c7a43'] : ['· to fill', '#9aa3a7']; return '<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;padding:1px 0"><span style="flex:1;color:#3a4048">' + esc(f.name) + '</span><span style="font-size:9px;font-weight:700;color:' + b[1] + ';background:' + b[1] + '18;border-radius:4px;padding:1px 6px">' + b[0] + '</span></div>'; }).join('') : '';
  var itemsHtml = items.length ? '<div style="margin-top:11px;font-size:10px;font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Items · ' + items.length + '</div>' + items.slice(0, 7).map(function(it){ var p = w.prices[it.name]; return '<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;padding:1px 0"><span style="flex:1">' + esc(it.name) + '</span><span style="font-weight:600;color:' + (p != null && p !== '' ? '#1c2128' : '#a5382e') + '">' + (p != null && p !== '' ? esc(_catfMoney(p)) : 'no price') + '</span></div>'; }).join('') : '';
  var taxHtml = (w.tax && w.tax.rate) ? '<div style="margin-top:9px;font-size:11px;color:var(--grey)">Tax: ' + esc(w.tax.label || 'GST') + ' ' + esc(w.tax.rate) + '%</div>' : '';
  return head + fieldsHtml + itemsHtml + taxHtml;
}
function _cwStep1(w){
  var left = '<div style="font-size:13px;color:#3a4048;margin-bottom:8px">Tell me the <b>purpose</b> — the exact catalogue you want.</div>'
    + '<textarea id="cw_purpose" placeholder="e.g. a chemical catalogue especially focusing on paint" rows="4" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:13px;resize:vertical">' + esc(w.purpose || '') + '</textarea>'
    + '<button class="pri" onclick="cwUnderstand()" style="margin-top:8px;padding:9px 15px">Understand → suggest fields</button>'
    + (w.vertical ? '<div style="font-size:11px;color:var(--grey);margin-top:8px">reads as: <b>' + esc(w.vertical) + '</b></div>' : '');
  var right;
  if (w.fieldSel && w.fieldSel.length) {
    var secs = {}, order = []; w.fieldSel.forEach(function(f){ if (!secs[f.section]) { secs[f.section] = []; order.push(f.section); } secs[f.section].push(f); });
    var on = w.fieldSel.filter(function(f){ return f.on; }).length;
    right = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-bottom:8px">FIELDS TO STORE <span style="font-weight:500;color:var(--grey)">— pick what this catalogue keeps</span></div>'
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><span style="font-size:11px;color:var(--grey)">Sold by (unit)</span><select onchange="cwSetUnit(this.value)" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-size:12px">' + ['litre', 'kg', 'piece', 'unit', 'tonne', 'pack', 'metre'].map(function(u){ return '<option' + ((w.unitType || 'litre') === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div>'
      + order.map(function(sec){ return '<div style="margin-bottom:11px"><div style="font-size:10.5px;font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">' + esc(sec) + '</div>' + secs[sec].map(function(f){ var idx = w.fieldSel.indexOf(f); return '<label style="display:flex;align-items:center;gap:8px;padding:2px 0;cursor:pointer"><input type="checkbox" ' + (f.on ? 'checked' : '') + ' onchange="cwToggleField(' + idx + ')"><span style="font-size:12px;font-weight:' + (f.on ? 600 : 400) + ';color:' + (f.on ? '#1c2128' : 'var(--grey)') + '">' + esc(f.name) + '</span><span style="font-size:9.5px;color:#9aa3a7;background:#eef1f5;border-radius:4px;padding:1px 6px">' + esc(f.type) + '</span>' + (f._bp ? '<span style="font-size:9px;color:#6a44a8" title="from blueprint">📎</span>' : f._added ? '<span style="font-size:9px;color:#2c7a43" title="you added">＋</span>' : '') + '</label>'; }).join('') + '</div>'; }).join('')
      + '<div style="font-size:10.5px;color:#2c7a43;font-style:italic;border-top:1px solid var(--line);padding-top:8px">' + on + ' fields selected · sold by ' + esc(w.unitType || 'unit') + '</div>'
      + '<div style="margin-top:8px"><div style="font-size:10px;font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Add a data type</div><div style="display:flex;gap:6px;margin-top:5px"><input id="cw_newfield" placeholder="field name" style="flex:1;min-width:0;padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px"><select id="cw_newtype" style="padding:5px;border:1px solid var(--line);border-radius:6px;font-size:11px">' + ['text', 'number', 'choice', 'date', 'boolean'].map(function(t){ return '<option>' + t + '</option>'; }).join('') + '</select><button onclick="cwAddCustomField()" style="padding:5px 10px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--blue);font-weight:600;font-size:11px;cursor:pointer">Add</button></div><div style="font-size:10px;color:var(--grey);margin-top:4px">Uncheck any you don\'t need · add any that are missing. Adopting a blueprint (step 2) adds its fields here too 📎.</div></div>';
  } else {
    right = '<div style="color:var(--grey);font-size:12.5px;text-align:center;margin-top:44px">Describe the catalogue on the left →<br>I\'ll suggest the fields to store, grouped in sections, for you to pick.</div>';
  }
  return '<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:0 0 300px;max-width:340px">' + left + '</div><div style="flex:1;min-width:280px;border-left:1px solid var(--line);padding-left:18px">' + right + '</div></div>';
}
// Step 2 is its own master-detail two-panel: LEFT = the fields (with the selected product's values) · RIGHT = the products
function _cwStep2(w){ return _cwTwo(_cwStep2Fields(w), _cwStep2Products(w)); }
function _cwStep2Fields(w){
  var fields = (w.fieldSel || []).filter(function(f){ return f.on; });
  var sel = w.sel ? (w.built && w.built.finishes || []).filter(function(it){ return it.name === w.sel; })[0] : null;
  var head = '<div style="font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">FIELDS' + (sel ? ' <span style="color:#6a44a8">· ' + esc(sel.name) + '</span>' : '') + '</div>';
  if (!fields.length) return head + '<div style="font-size:12px;color:var(--grey);margin-top:8px">Pick fields in step 1 first. Adopting a blueprint (right) adds its fields here.</div>';
  var rows = fields.map(function(f){ var v = sel ? sel[f._bpKey || f.name] : undefined; var vstr = (v == null) ? '' : (Array.isArray(v) ? v.map(function(x){ return (x && typeof x === 'object') ? (x.name || '') : x; }).join(', ') : (typeof v === 'object' ? (v.name || JSON.stringify(v)) : String(v))); return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px dashed var(--line);font-size:11.5px"><span style="flex:0 0 148px;color:#3a4048">' + esc(f.name) + (f._bp ? ' <span style="color:#6a44a8;font-size:9px">📎</span>' : f._added ? ' <span style="color:#2c7a43;font-size:9px">＋</span>' : '') + '</span><span style="flex:1;color:' + (vstr ? '#1c2128' : '#9aa3a7') + '">' + (sel ? (vstr ? esc(vstr) : '—') : '<span style="font-size:10px">value shows when you click a product ›</span>') + '</span></div>'; }).join('');
  var refF = fields.filter(function(f){ return f._bp; }).map(function(f){ return f.name; });
  var todo = fields.filter(function(f){ return !f._bp; }).map(function(f){ return f.name; });
  var mode = w.adoptMode || 'reference';
  var summary = w.source ? '<div style="margin-top:6px;font-size:10.5px;line-height:1.6;border-bottom:1px solid var(--line);padding-bottom:8px">'
    + '<div><span style="color:' + (mode === 'value' ? '#2c5aa0' : '#6a44a8') + ';font-weight:700">' + (mode === 'value' ? '📋 filled by value · ' : '📎 filled by reference · ') + refF.length + '</span> <span style="color:var(--grey)">' + esc(refF.join(' · ') || '—') + '</span></div>'
    + (todo.length ? '<div><span style="color:#2c7a43;font-weight:700">✍ you still fill · ' + todo.length + '</span> <span style="color:var(--grey)">' + esc(todo.join(' · ')) + '</span></div>' : '')
    + '</div>' : '';
  var swatches = (sel && sel.combinations && sel.combinations.length) ? '<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px"><div style="font-size:10px;font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Colour combinations</div>' + sel.combinations.map(_cwCombo).join('') + '</div>' : '';
  return head + summary + '<div style="margin-top:8px">' + rows + '</div>' + swatches;
}
/* render products with the blueprint's OWN look & feel — colour swatches, chips, accent, story */
function _cwSwatch(c){ return '<span title="' + esc((c.name || '') + ' ' + (c.hex || '')) + '" style="display:inline-block;width:15px;height:15px;border-radius:50%;background:' + esc(c.hex || '#ccc') + ';border:1px solid rgba(0,0,0,.15);vertical-align:middle;margin-right:2px"></span>'; }
function _cwCombo(cm){ return '<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span>' + ((cm.colours || []).map(_cwSwatch).join('')) + '</span><span style="font-size:10px;color:#3a4048;font-weight:600">' + esc(cm.name || '') + '</span></div>'; }
function _cwProductCard(w, it){
  var on = w.chosen[it.name] !== false, seld = w.sel === it.name;
  var accent = (w.built && w.built.formatting && w.built.formatting.accent) || '#6a44a8';
  var nm = esc(it.name).replace(/'/g, "\\'");
  var chips = [it.texture_family, it.region].filter(Boolean).map(function(c){ return '<span style="font-size:9.5px;background:' + accent + '18;color:' + accent + ';border-radius:4px;padding:1px 6px">' + esc(c) + '</span>'; }).join('') + (it.effect || []).map(function(e){ return '<span style="font-size:9.5px;background:#f3f0e8;color:#7a5e22;border-radius:4px;padding:1px 6px">' + esc(e) + '</span>'; }).join('');
  var combos = (it.combinations || []).slice(0, 2).map(_cwCombo).join('');
  return '<div onclick="cwSelectProduct(\'' + nm + '\')" style="border:1px solid ' + (seld ? accent : 'var(--line)') + ';border-radius:11px;padding:10px 12px;margin-top:6px;background:' + (seld ? accent + '0c' : '#fff') + ';cursor:pointer">'
    + '<div style="display:flex;align-items:center;gap:8px"><input type="checkbox" ' + (on ? 'checked' : '') + ' onclick="event.stopPropagation()" onchange="cwToggleItem(\'' + nm + '\')"><span style="font-weight:700;font-size:13px">' + esc(it.name) + '</span><span style="font-size:10px;color:#9aa3a7">' + esc(it.scale || '') + (it.sheen ? ' · ' + esc(it.sheen) : '') + '</span><span style="margin-left:auto;color:' + accent + ';font-weight:700">' + (seld ? '▸' : '') + '</span></div>'
    + (it.inspiration ? '<div style="font-size:11px;color:#6a707a;margin:5px 0;line-height:1.45">' + esc(it.inspiration) + '</div>' : '')
    + (chips ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">' + chips + '</div>' : '')
    + (combos ? '<div style="margin-top:6px">' + combos + '</div>' : '')
    + '</div>';
}
function _cwStep2Products(w){
  var srcs = UI._cwSources;
  var picker = (srcs === null) ? '<div style="color:var(--grey);font-size:12px">loading blueprints…</div>' : '<select onchange="cwPickSource(this.value)" style="padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;width:100%;box-sizing:border-box"><option value="">— pick a blueprint / skip —</option>' + srcs.map(function(s){ return '<option value="' + esc(s.key) + '"' + (w.source === s.key ? ' selected' : '') + '>' + esc(s.title) + ' (' + s.item_count + ')</option>'; }).join('') + '</select>';
  var rights = w.source ? '<div style="margin-top:6px;font-size:10.5px;color:#2e7a45">🔓 Rights ok <span style="color:var(--grey)">— you may use this blueprint (distributor grant)</span></div>' : '';
  var mode = w.adoptMode || 'reference';
  var modeToggle = w.source ? '<div style="margin-top:8px;font-size:11px;color:#3a4048">by: <span onclick="cwSetAdoptMode(\'reference\')" style="cursor:pointer;font-weight:700;padding:2px 9px;border-radius:11px;border:1px solid ' + (mode === 'reference' ? '#2c7a43' : 'var(--line)') + ';color:' + (mode === 'reference' ? '#fff' : 'var(--grey)') + ';background:' + (mode === 'reference' ? '#2c7a43' : '#fff') + '">reference</span> <span onclick="cwSetAdoptMode(\'value\')" style="cursor:pointer;font-weight:700;padding:2px 9px;border-radius:11px;border:1px solid ' + (mode === 'value' ? '#2c5aa0' : 'var(--line)') + ';color:' + (mode === 'value' ? '#fff' : 'var(--grey)') + ';background:' + (mode === 'value' ? '#2c5aa0' : '#fff') + '">value</span></div>' : '';
  var products = (w.built && w.built.finishes) ? '<div style="margin-top:12px;display:flex;align-items:center;gap:8px"><span style="font-size:11px;font-weight:800;color:#6a44a8;letter-spacing:.05em">PRODUCTS · ' + w.built.finishes.length + '</span><span style="font-size:9.5px;color:var(--grey)">tick to sell · click to inspect</span><span onclick="cwChooseAll(true)" style="cursor:pointer;font-size:10px;color:var(--blue);margin-left:auto">all</span><span style="color:#c8d0d9">·</span><span onclick="cwChooseAll(false)" style="cursor:pointer;font-size:10px;color:var(--blue)">none</span></div>' + w.built.finishes.map(function(it){ return _cwProductCard(w, it); }).join('') : '';
  return '<div style="font-size:12.5px;color:#3a4048;margin-bottom:8px">Pick a <b>blueprint</b> — a ready, structured catalogue of this sort. Its <b>products</b> list here; tick the ones you sell, click one to see its field values on the left. <b>No blueprint? Skip.</b></div>' + picker + rights + modeToggle + products;
}
function _cwStep3(w){
  var fields = (w.fieldSel || []).filter(function(f){ return f.on; });
  var systems = ['—', 'ERP', 'Tally', 'SAP', 'Other'];
  w.erpMap = w.erpMap || {};
  var mapped = Object.keys(w.erpMap).filter(function(k){ return w.erpMap[k] && w.erpMap[k].system && w.erpMap[k].system !== '—'; }).length;
  var rows = fields.map(function(f){ var m = w.erpMap[f.name] || {}; var sys = m.system || '—'; var esn = f.name.replace(/'/g, "\\'");
    var sysSel = '<select onchange="cwSetMapSys(\'' + esn + '\',this.value)" style="font-size:11px;padding:4px;border:1px solid var(--line);border-radius:6px">' + systems.map(function(s){ return '<option' + (sys === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>';
    var ref = sys !== '—' ? '<input value="' + esc(m.ref || '') + '" oninput="cwSetMapRef(\'' + esn + '\',this.value)" placeholder="field / code in ' + esc(sys) + '" style="flex:1;min-width:0;font-size:11px;padding:4px 7px;border:1px solid var(--line);border-radius:6px">' : '<span style="font-size:10.5px;color:var(--grey);flex:1">' + (f._bp ? '📎 from blueprint' : 'not mapped') + '</span>';
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--line)"><span style="flex:0 0 138px;font-size:11.5px;color:#3a4048">' + esc(f.name) + (f._bp ? ' <span style="color:#6a44a8;font-size:9px">📎</span>' : '') + '</span>' + sysSel + ref + '</div>';
  }).join('');
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">Map fields to your <b>own systems (ERP / Tally / SAP)</b> so they sync from there. These <b>mapping rules are saved with the catalogue design</b> and stay for each selected item. <b>Nothing from ERP? Skip.</b></div>' + rows + (mapped ? '<div style="font-size:10.5px;color:#b07b1e;margin-top:8px">🔗 ' + mapped + ' field(s) mapped to your systems — saved as references with the design.</div>' : '');
}
function _cwStep4(w){
  var rem = _cwRemaining(w).filter(function(r){ return r.leg !== 'compute'; });
  var extra = Object.keys(w.manual || {});
  var body = rem.length ? rem.map(function(r){ return '<div style="display:flex;align-items:center;gap:9px;padding:5px 0"><span style="font-size:12px;color:var(--grey);min-width:150px">' + esc(r.name) + '</span><input value="' + esc(w.manual[r.name] || '') + '" oninput="cwSetManual(\'' + r.name + '\',this.value)" placeholder="value" style="flex:1;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12px"></div>'; }).join('') : '<div style="font-size:12px;color:#2c7a43">Nothing left — the blueprint / ERP covered it.</div>';
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">Fill anything still missing <b>by hand</b>. (These are the fields not covered by the blueprint or ERP.)</div>' + body;
}
function _cwStep5(w){
  var pk = Object.keys(w.erpMap || {}).filter(function(k){ return /price|rate|mrp/i.test(k) && w.erpMap[k] && w.erpMap[k].system && w.erpMap[k].system !== '—'; })[0];
  if (pk) return '<div style="font-size:13px;color:#3a4048">Price comes from your <b>' + esc(w.erpMap[pk].system) + '</b> (' + esc(w.erpMap[pk].ref || 'mapped') + ') — nothing to set here.</div>';
  var items = (w.built && w.built.finishes || []).filter(function(it){ return w.chosen[it.name] !== false; });
  if (!items.length) items = [{ name: (CATF_KB[w.vertical] && CATF_KB[w.vertical].product) || 'Item' }];
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">Set your <b>price</b> per item (' + esc(_catfCcy()) + '). You can change these anytime later.</div>'
    + items.map(function(it){ return '<div style="display:flex;align-items:center;gap:9px;padding:6px 10px;border:1px solid var(--line);border-radius:9px;margin-top:5px;background:#fff"><span style="font-weight:600;font-size:12.5px;flex:1">' + esc(it.name) + '</span><span style="color:var(--grey);font-size:11px">' + esc(_catfCcy()) + '</span><input type="number" value="' + (w.prices[it.name] != null ? w.prices[it.name] : '') + '" oninput="cwSetPrice(\'' + esc(it.name).replace(/'/g, "\\'") + '\',this.value)" placeholder="price" style="width:100px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px"></div>'; }).join('');
}
function _cwStep6(w){
  var priced = Object.keys(w.prices).filter(function(k){ return w.prices[k] != null && w.prices[k] !== ''; }).length;
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">Set <b>tax</b>, then go live.</div>'
    + '<div style="display:flex;gap:8px;align-items:center"><input value="' + esc(w.tax.label || 'GST') + '" oninput="cwSetTax(\'label\',this.value)" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12px"><input type="number" value="' + esc(w.tax.rate || '') + '" oninput="cwSetTax(\'rate\',this.value)" placeholder="18" style="width:70px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12px"><span style="font-size:12px;color:var(--grey)">%</span></div>'
    + '<div style="margin-top:14px;padding:11px 13px;border:1px solid #cfe6cf;border-radius:9px;background:#eef7ee;font-size:12px;color:#2e7a45">On finish: your entity <b>adopts</b> the blueprint (reference) + your <b>' + priced + ' price(s)</b>' + (w.source ? '' : ' — <i>no blueprint, so it saves your manual items</i>') + '. It goes <b>live</b> on your storefront. Half-filled is fine — you can add the rest anytime.</div>';
}
/* wizard actions */
function cwGo(n){ if (n <= UI.cw.step || n === UI.cw.step + 1) { UI.cw.step = n; renderApp(); } }
function cwNext(){ var w = UI.cw; if (w.step === 1 && !w.vertical) { if (typeof toast === 'function') toast('Pick a vertical first.'); return; } if (w.step < 6) w.step++; renderApp(); }
function cwBack(){ if (UI.cw.step > 1) UI.cw.step--; renderApp(); }
function cwCancel(){ UI.cw = null; renderApp(); }
function cwSetVertical(v){ UI.cw.vertical = v; renderApp(); }
function cwPickSource(key){ var w = UI.cw; w.source = key; w.built = null; if (!key) { renderApp(); return; } if (typeof toast === 'function') toast('Loading blueprint…'); api('catalogueStruct', { body: { source: key } }).then(function(r){ w.built = r; w.chosen = {}; w.sel = null; (r.finishes || []).forEach(function(it){ w.chosen[it.name] = true; if (it.commercials && it.commercials.price_per_litre != null) w.prices[it.name] = it.commercials.price_per_litre; }); _cwMergeBpFields(w); renderApp(); }).catch(function(e){ if (typeof toast === 'function') toast('Load failed: ' + ((e && e.message) || '')); }); }
// the blueprint's data items become fields too — match an existing selected field by name, or add it. So the
// vertical field selection ends up holding ALL adopted data items.
function _cwMergeBpFields(w){ w.fieldSel = w.fieldSel || []; var have = {}; w.fieldSel.forEach(function(f){ have[_cwNorm(f.name)] = f; }); _cwBpFields(w).forEach(function(key){ var e = have[_cwNorm(key)]; if (e) { e.on = true; e._bp = true; e._bpKey = key; } else { var nf = { section: 'From blueprint', name: key, type: 'text', on: true, leg: 'cb', _bp: true, _bpKey: key }; w.fieldSel.push(nf); have[_cwNorm(key)] = nf; } }); }
function cwAddCustomField(){ var w = UI.cw; var name = (val('cw_newfield') || '').trim(); if (!name) { if (typeof toast === 'function') toast('Name the field first.'); return; } var type = val('cw_newtype') || 'text'; w.fieldSel = w.fieldSel || []; if (w.fieldSel.some(function(f){ return f.name.toLowerCase() === name.toLowerCase(); })) { if (typeof toast === 'function') toast('That field already exists.'); return; } w.fieldSel.push({ section: 'Added', name: name, type: type, on: true, leg: 'cb', _added: true }); renderApp(); }
function cwSetAdoptMode(m){ UI.cw.adoptMode = m; renderApp(); }
function cwChooseAll(v){ var w = UI.cw; (w.built && w.built.finishes || []).forEach(function(it){ w.chosen[it.name] = v; }); renderApp(); }
function cwSelectProduct(name){ UI.cw.sel = (UI.cw.sel === name) ? null : name; renderApp(); }
function cwSetMapSys(field, sys){ var w = UI.cw; w.erpMap = w.erpMap || {}; if (sys === '—') delete w.erpMap[field]; else { w.erpMap[field] = w.erpMap[field] || {}; w.erpMap[field].system = sys; } renderApp(); }
function cwSetMapRef(field, ref){ var w = UI.cw; w.erpMap = w.erpMap || {}; if (w.erpMap[field]) w.erpMap[field].ref = ref; }
function cwToggleItem(name){ UI.cw.chosen[name] = UI.cw.chosen[name] === false; renderApp(); }
function cwToggleErp(f){ if (UI.cw.erp[f]) delete UI.cw.erp[f]; else UI.cw.erp[f] = true; renderApp(); }
function cwSetErpRef(f, v){ UI.cw.erp[f] = v || true; }
function cwSetManual(f, v){ UI.cw.manual[f] = v; }
function cwSetPrice(name, v){ UI.cw.prices[name] = v; }
function cwSetTax(k, v){ UI.cw.tax[k] = v; }
function cwFinish(){
  var w = UI.cw;
  var chosenFinishes = (w.built && w.built.finishes || []).filter(function(it){ return w.chosen[it.name] !== false; });
  var com = {}; chosenFinishes.forEach(function(it){ var p = w.prices[it.name]; if (p != null && p !== '') com[it.name] = { price_per_litre: Number(p) }; });
  var toLive = function(){
    UI.catf = { method: 'cart', facets: { variants: true, media: !!w.source, sourcing: Object.keys(w.erpMap || {}).length > 0 }, adoptedFrom: (w.built && w.built.title) || '', _source: w.source || '', tax: w.tax, erpMap: w.erpMap,
      catalogue: CBCatalogue.ensure({ product: (w.built && w.built.title) || (CATF_KB[w.vertical] && CATF_KB[w.vertical].product) || 'Catalogue', baseUnit: (CATF_KB[w.vertical] && CATF_KB[w.vertical].baseUnit) || 'unit' }),
      items: chosenFinishes.length ? chosenFinishes.map(function(it){ return { _src: (w.adoptMode === 'value' ? 'value' : 'reference'), product: it.name, texture_family: it.texture_family, sheen: it.sheen, region: it.region, price: (w.prices[it.name] != null && w.prices[it.name] !== '') ? Number(w.prices[it.name]) : null, _media: true }; })
        : [{ _src: 'manual', product: (w.manual.name || (CATF_KB[w.vertical] && CATF_KB[w.vertical].product) || 'Item'), price: (w.prices[Object.keys(w.prices)[0]] != null ? Number(w.prices[Object.keys(w.prices)[0]]) : null) }] };
    _catfSave(); UI.cw = null; if (typeof toast === 'function') toast('Catalogue is live ✓'); renderApp();
  };
  if (w.source && Object.keys(com).length && typeof api === 'function') {
    if (typeof toast === 'function') toast('Publishing…');
    api('catalogueAdopt', { body: { source: w.source, commercials: com } }).then(toLive).catch(function(e){ if (typeof toast === 'function') toast('Saved locally — publish failed: ' + ((e && e.message) || '')); toLive(); });
  } else { toLive(); }
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
function _catfSrcTag(src){ return src === 'reference' ? ['📎 by reference', '#6a44a8'] : src === 'value' ? ['📋 by value (copy)', '#2c5aa0'] : src === 'erp' ? ['🔗 from ERP', '#b07b1e'] : ['✍ entered', '#2c7a43']; }
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
function catfSetItemPrice(i, v){ if (!UI.catf || !UI.catf.items || !UI.catf.items[i]) return; var x = parseFloat(v); UI.catf.items[i].price = (v === '' || isNaN(x)) ? null : x; _catfSave(); if (UI.catf._source) _catfRepublish(); renderApp(); }
function _catfRepublish(){   // price change on a live (adopted) catalogue = CRUD → re-persist commercials via the real API
  if (!UI.catf || !UI.catf._source || typeof api !== 'function') return;
  var com = {}; (UI.catf.items || []).forEach(function(it){ if (it.price != null && it.price !== '') com[it.product || it.name] = { price_per_litre: Number(it.price) }; });
  api('catalogueAdopt', { body: { source: UI.catf._source, commercials: com } }).then(function(){ if (typeof toast === 'function') toast('Price updated · live ✓'); }).catch(function(){});
}
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
