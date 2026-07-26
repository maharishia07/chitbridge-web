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
  paint:  { title: 'Paint / finishes', method: 'cart',     facets: { variants: true, media: true },                      product: 'Finishes',   baseUnit: 'litre' },
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
  paint:  [{ name: 'finish', leg: 'cb' }, { name: 'coverage', leg: 'cb' }, { name: 'colour', leg: 'cb' }],
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
  if (/farm|origin|source|country/.test(n)) return ['Estate A', 'Estate B', 'Estate C'][i % 3];
  if (/serial|batch|\blot\b|\bno\b|code|cert/.test(n)) return (name.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'ID') + '-' + String(i + 1).padStart(3, '0');
  return name + ' ' + (i + 1);
}
function _catfKnowledgeItems(vertical, c){
  var base = (CATF_KB[vertical] || {}).product || c.product || 'Item';
  var suffix = vertical === 'gold' ? ['100 g', '1 kg', '50 g'] : vertical === 'coffee' ? ['Ethiopia G1', 'Colombia', 'Brazil'] : ['A', 'B', 'C'];
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
    c.fields.push({ name: r.name, leg: r.leg, via: r.leg === 'system' ? 'ERP' : '', type: /price|score|pct|weight|temp|qty|stock|count|fineness/.test(r.name) ? 'number' : /expiry|date/.test(r.name) ? 'date' : 'text' });
  });
  var draft = { method: t.method || _catfInfer(purpose).method, facets: facets, adoptedFrom: t.title || '', templateKey: vertical, required: req, sourced: true, catalogue: CBCatalogue.ensure(c) };
  draft.sampleRows = _catfKnowledgeItems(vertical, draft.catalogue);
  return draft;
}

/* ---- actions ---- */
function catfMode(m){ UI.catfMode = m; renderApp(); }
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
    + '<div style="font-size:11px;color:var(--grey);margin-bottom:12px">' + _catfSettingsNote() + '</div>'
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
  // studied column mapping
  var mapping = (f.mapping && f.mapping.length) ? '<div style="margin-top:12px;font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">STUDIED YOUR COLUMNS →</div>'
    + '<div style="margin-top:6px">' + f.mapping.map(function(m){ var badge = m.role === 'name' ? ['identity', '#2c5aa0'] : m.role === 'price' ? ['price', '#b07b1e'] : m.role === 'unit' ? ['unit', '#8a5a1e'] : m.role === 'code' ? ['standard', '#8a5cc4'] : m.leg === 'system' ? [(m.via || 'ERP') + ' feed', '#b07b1e'] : ['stored in CB', '#2c7a43']; return '<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;padding:2px 0"><span style="font-family:monospace;color:var(--grey);min-width:120px">' + esc(m.col) + '</span><span style="color:#9aa3a7">→</span><span style="font-size:10px;font-weight:700;color:' + badge[1] + ';background:' + badge[1] + '18;border-radius:4px;padding:1px 7px">' + esc(badge[0]) + '</span></div>'; }).join('') + '</div>' : '';
  // WHAT THE CATALOGUE HOLDS — full visibility of the sourced/studied model, by leg
  var chain = CBCatalogue.routeChain(c);
  var legMeta = { system: ['From your systems (ERP/IoT)', '#b07b1e'], customer: ['From the customer', '#2b6f8f'], compute: ['Computed by co-assist', '#8a5cc4'], cb: ['Stored in CB — the gap', '#2c7a43'] };
  var visRows = ['system', 'customer', 'compute', 'cb'].map(function(k){ var fs = (chain[k] || []).filter(function(x){ return !x.identity; }).map(function(x){ return x.name + (x.via ? ' · ' + x.via : ''); }); if (!fs.length) return ''; var mm = legMeta[k]; return '<div style="font-size:11.5px;padding:3px 0;line-height:1.5"><span style="font-size:9.5px;font-weight:700;color:' + mm[1] + ';background:' + mm[1] + '1a;border-radius:4px;padding:1px 6px">' + esc(mm[0]) + '</span> <span style="color:#3a4048">' + fs.map(esc).join(' · ') + '</span></div>'; }).join('');
  if (facets.standards) visRows += '<div style="font-size:11.5px;padding:3px 0"><span style="font-size:9.5px;font-weight:700;color:#6a4fa0;background:#6a4fa01a;border-radius:4px;padding:1px 6px">Standards</span> <span style="color:#3a4048">HS / GS1 — by reference</span></div>';
  if (facets.media) visRows += '<div style="font-size:11.5px;padding:3px 0"><span style="font-size:9.5px;font-weight:700;color:#7a5e22;background:#f6ecd8;border-radius:4px;padding:1px 6px">Media</span> <span style="color:#3a4048">images / video (own or from a source)</span></div>';
  var vis = visRows ? '<div style="margin-top:12px;font-size:11px;font-weight:800;color:#2c5aa0;letter-spacing:.05em">WHAT THE CATALOGUE HOLDS ' + (f.sourced ? '<span style="font-weight:500;color:var(--grey)">— sourced from knowledge (not in your data yet)</span>' : '') + '</div><div style="margin-top:6px">' + visRows + '</div>' : '';
  // sample items with values
  var rows = (f.sampleRows && f.sampleRows.length) ? f.sampleRows : [{ name: c.product || 'Sample item', unit: facets.variants ? (c.baseUnit || 'unit') : '', price: '' }];
  var items = '<div style="margin-top:14px;font-size:11px;font-weight:800;color:#2c7a43;letter-spacing:.05em">SAMPLE ITEMS</div><div style="margin-top:6px">'
    + rows.map(function(r){ var price = r.price !== '' && r.price != null ? _catfMoney(r.price) : (f.method === 'cart' ? _catfMoney(40) : '');
      var vals = r.values ? Object.keys(r.values).slice(0, 4).map(function(kk){ return esc(kk) + '=' + esc(r.values[kk]); }).join(' · ') : '';
      return '<div style="padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:#fff;margin-bottom:5px"><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;font-size:12.5px">' + esc(r.name || 'item') + '</span>' + (r.unit ? '<span style="font-size:10px;color:#7a5e22;background:var(--gold-soft,#f6ecd8);border-radius:4px;padding:1px 6px">' + esc(r.unit) + '</span>' : '') + (price ? '<span style="margin-left:auto;font-weight:700;font-size:12.5px">' + esc(price) + '</span>' : '') + '</div>' + (vals ? '<div style="font-size:10px;color:var(--faint,#8a929e);margin-top:4px;font-family:monospace">' + vals + '</div>' : '') + '</div>';
    }).join('') + '</div>'
    + '<div style="font-size:10.5px;color:var(--grey);font-style:italic;margin-top:2px">' + (f.sourced ? 'Sourced sample values — you replace them with your real ones.' : 'Every item conforms to this face.') + '</div>';
  return head + mapping + vis + items
    + '<button class="pri" onclick="catfCommit()" style="margin-top:16px;padding:10px 18px">Use this catalogue ✓</button>';
}

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
    + '<div style="display:flex;gap:10px;margin-top:16px">'
    + '<button class="pri" onclick="alert(\'Conforming-item management is the next slice.\')" style="padding:9px 15px">Manage items ›</button>'
    + '<button onclick="catfReset()" style="padding:9px 15px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--grey)">↺ Start over</button>'
    + '</div></div>';
  return '<div style="flex:1;min-height:0;overflow-y:auto;padding:22px 20px">' + inner + '</div>';
}
