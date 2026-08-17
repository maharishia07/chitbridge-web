/* cap-catalogue.js — CATALOGUE SETUP capability (⚙ Set up (new)). LIVE in prod (main). Lazy-loaded. Gate: `npm run check`.
 *
 * MODEL: ONE "face" per catalogue (not per item) — purpose · one storefront method · units (multi) · facets. Currency +
 * country inherited from entity Settings. Items conform to the face. Built on catalogue-model.js (CBCatalogue): JSON
 * Schema 2020-12 · RFC 7386 merge-patch · MDM golden-record + survivorship · GS1 SKU (adopt-don't-reinvent — see the
 * 📐 standards panel). The CB-unique layer (four-leg provenance · chit/seal · per-copy · governance) rides on top.
 *
 * FLOW: a 6-step wizard (_catfWizard) → committed face (_catfFaceView).
 *   Step 1 Vertical  — purpose → suggested fields + the catalogue's unit SET (multi-select).
 *   Step 2 Blueprint — adopt a SOURCE catalogue (b78 catalogue_source) BY REFERENCE (shared design, own price) or by
 *                      VALUE (copy). Picker is searchable + filtered by vertical FAMILY (_catfGroupOf: food/materials/…).
 *   Step 3 ERP       — capture the field→ERP/Tally mapping (the connector executes the pull at runtime).
 *   Step 4 Manual    — bring items without typing: CSV/Excel paste · photos (matched by filename) · type-a-few.
 *   Step 5/6 Price·Tax → cwFinish.
 *
 * PERSISTENCE (all real, prod): owned+priced items → catalogue_items via prodAdd (the classic Catalogue screen owns
 * R/U/D; '🗂️ Manage in Catalogue' hands off). By-REFERENCE adoptions → catalogue_adoption (b75) — reference and value
 * are MUTUALLY EXCLUSIVE (no double-create). Face config → catalogue_face (b112, server truth + localStorage cache,
 * mirrors the cap-network _net* sync). '📢 Publish as blueprint' → catalogue_source (b78). '✨ Enrich (AI)' → the
 * deployed /api/governance/ai-draft with the catalogue-enrich skill (b113): local/botanical names that travel in the
 * blueprint. Photos ride the blueprint as downscaled thumbnails.
 *
 * VERTICAL-AGNOSTIC (SPEC-adoption-generalize, built): step-1 units are the catalogue's ALLOWED SET and each item
 * picks its own from it (_cwItemUnit / catfSetItemUnit) — Tomato kg · Egg count in one catalogue. Commercials are
 * GENERIC {price, unit}, not price_per_litre; every reader falls back to price_per_litre so adoptions made before
 * this keep rendering. The referenced display (app.html refFinishRow/refFinishDetail, shop.html finishCard) is
 * presence-driven, so paint keeps its swatches/combos and veg shows no paint artifacts.
 * Regression: `npm run check:adoption` (11 assertions, cases 1-3) + e2e catalogue-wizard/meat-blueprint (cases 4-5).
 *
 * KNOWN GAPS (spec'd, not built): photo→item OCR/vision → C:\dev\SPEC-catalogue-photo-vision.md.
 */

// The ORDER METHOD decides what the buyer is asked for — and therefore WHAT DATA COMES BACK to the business on the
// order chit. `receives` states that plainly, so the choice is made on the data you want, not on the widget.
var CATF_METHODS = [
  { k: 'cart',     label: 'Cart (qty × price)',   hint: 'a shop — pick quantity, pay the price (veg market, retail)', receives: 'quantity · your price · line total' },
  { k: 'qty',      label: 'Quantity only',        hint: 'order a count, no price shown',                              receives: 'quantity only — you quote the price later' },
  { k: 'range',    label: 'Price as a range',     hint: 'price moves within a band (commodities)',                    receives: 'quantity · the band it was ordered within' },
  { k: 'qtyprice', label: 'Both negotiable',      hint: 'buyer proposes quantity and price (tenders, trade)',         receives: "quantity · the buyer's PROPOSED price — you accept or counter" },
  { k: 'choice',   label: 'Fixed options',        hint: 'a range, but only certain prices may be picked (grades, tiers)', receives: 'quantity · the option the buyer picked' },
  { k: 'text',     label: 'Information only',      hint: 'a listing; the buyer can send an enquiry',                  receives: 'a message — no order is placed' },
  { k: 'form',     label: 'A form to fill',        hint: 'the catalogue IS a set of forms (applications, requests, a help desk)', receives: 'the filled form — exactly the fields you declare' },
];
// Presets are LABELS over a declared schema (api lib/order-input.js). `pipeline` is the load-bearing part: commerce
// reprices against the catalogue; payload validates declared fields and carries them. A form has no price or
// quantity, which is precisely why it cannot run the commerce path.
var CATF_PIPELINE = { cart: 'commerce', qty: 'commerce', range: 'commerce', choice: 'commerce', qtyprice: 'commerce', text: 'payload', form: 'payload' };
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
  if (/meat|chicken|mutton|poultry|beef|pork|lamb|goat/.test(s)) return 'meat';
  if (/fish|seafood|prawn|shrimp|crab|squid/.test(s)) return 'fish';
  if (/fruit|mango|banana|apple|citrus/.test(s)) return 'fruit';
  if (/dairy|milk|cheese|paneer|curd|yog[hu]?urt|butter/.test(s)) return 'dairy';
  if (/veg|vegetable|grocery|produce/.test(s)) return 'veg'; if (/export|import|customs|\btrade\b/.test(s)) return 'trade';
  if (/retail|\bshop\b|\bstore\b/.test(s)) return 'retail'; return null;
}
// Blueprint FAMILY (Athi: tag as "eatable" so asking meat surfaces veg/meat/fish). Filtering is by family, not exact
// vertical. Derived from the vertical — no schema change.
var CATF_GROUPS = { food: ['veg', 'meat', 'fish', 'fruit', 'dairy', 'grocery', 'produce', 'poultry', 'bakery', 'coffee'], materials: ['paint', 'chemical', 'hardware', 'building'], precious: ['gold', 'silver', 'jewellery', 'gem'], health: ['pharma', 'medicine'] };
function _catfGroupOf(v){ v = (v || '').toLowerCase(); if (!v) return null; for (var g in CATF_GROUPS) { if (CATF_GROUPS[g].indexOf(v) >= 0) return g; } return null; }
/* what ADOPTION brings from the source (by reference) — the owner only sets the price. Kept inside the catalogue. */
// the REAL Royale Play source (beta-royale-play@v1, live on shop CB3D5L4UFT) — design by reference, owner sets price only
/* ---- per-entity face draft (localStorage; server persistence is a later slice) ---- */
function _catfKey(){ return 'cb_catface_' + (SESSION.entityId || SESSION.entity || 'anon'); }
function _catfDirtyKey(){ return 'cb_catfdirty_' + (SESSION.entityId || SESSION.entity || 'anon'); }
function _catfLoggedIn(){ return typeof SESSION !== 'undefined' && !!SESSION.token; }
function _catfIsDirty(){ try { return localStorage.getItem(_catfDirtyKey()) === '1'; } catch (e) { return false; } }
function _catfSetDirty(on){ try { if (on) localStorage.setItem(_catfDirtyKey(), '1'); else localStorage.removeItem(_catfDirtyKey()); } catch (e) {} }
function _catfLoad(){ try { var s = localStorage.getItem(_catfKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
// what we sync to the server: the config + a light item snapshot. Strip the big base64 _photo and the _lineage objects
// (items are the real store in catalogue_items; this face carries only a display snapshot). Keeps the jsonb small.
function _catfStripSync(catf){ try { var c = JSON.parse(JSON.stringify(catf)); if (c && Array.isArray(c.items)) c.items.forEach(function(it){ delete it._photo; delete it._lineage; }); return c; } catch (e) { return catf; } }
var _catfPushTimer = null;
function _catfPushServer(){
  if (!_catfLoggedIn() || typeof api !== 'function') return;
  try {
    api('catFacePut', { body: { face: UI.catf ? _catfStripSync(UI.catf) : {} } })
      .then(function(){ _catfSetDirty(false); })
      .catch(function(err){ _catfQueuePush();   // retry the latest state after an in-flight push / transient failure
        if (typeof toast === 'function' && !/Already working/.test((err && err.message) || '')) toast('Catalogue saved on this device — not synced yet'); });
  } catch (e) {}
}
function _catfQueuePush(){ if (!_catfLoggedIn()) return; if (_catfPushTimer) clearTimeout(_catfPushTimer); _catfPushTimer = setTimeout(_catfPushServer, 1500); }
function _catfFlush(){   // synchronous best-effort send on tab close / logout — keepalive lets it outlive the page
  if (!_catfLoggedIn() || !_catfIsDirty() || typeof CFG === 'undefined') return;
  try { fetch(CFG.API_BASE + '/api/catalogue-face', { method: 'PUT', keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SESSION.token },
    body: JSON.stringify({ face: UI.catf ? _catfStripSync(UI.catf) : {} }) }); } catch (e) {}
}
function _catfPullServer(){
  if (!_catfLoggedIn() || UI._catfPulled || UI._catfPulling || typeof api !== 'function') return;
  UI._catfPulling = true;   // guard concurrent pulls across re-renders (GET is not lock-guarded)
  try {
    api('catFaceGet').then(function(r){
      UI._catfPulling = false; UI._catfPulled = true;         // latch only on success — a failed pull retries next render
      if (_catfIsDirty()) { _catfPushServer(); return; }       // this device has unpushed edits → local wins; never overwrite with a stale server copy
      if (r && r.face && r.face.catalogue) {                   // server holds a committed face → adopt it
        UI.catf = r.face;
        try { localStorage.setItem(_catfKey(), JSON.stringify(UI.catf)); } catch (e) {}
        if (typeof renderApp === 'function') renderApp();
      } else if (UI.catf && UI.catf.catalogue) {               // server empty but this device has a face → migrate it up once
        _catfPushServer();
      }
    }).catch(function(){ UI._catfPulling = false; });          // leave _catfPulled false → retried on next render
  } catch (e) { UI._catfPulling = false; }
}
if (typeof window !== 'undefined' && !window._catfFlushBound) {   // bind the unload flush once
  window._catfFlushBound = true;
  window.addEventListener('pagehide', _catfFlush);
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') _catfFlush(); });
}
function _catfSave(){ try { if (UI.catf) localStorage.setItem(_catfKey(), JSON.stringify(UI.catf)); } catch (e) { if (typeof toast === 'function') toast('Couldn\'t save the catalogue locally — it may be too large (try fewer/smaller photos).'); } _catfSetDirty(true); _catfQueuePush(); }
function _catfInit(){ if (UI.catf === undefined) UI.catf = _catfLoad(); _catfPullServer(); }
function _catfCcy(){ return (typeof SESSION !== 'undefined' && SESSION.currency) || 'INR'; }
function _catfCountry(){ return (typeof SESSION !== 'undefined' && SESSION.country) || 'IN'; }
function _catfMoney(v){ return (typeof fmtMoney === 'function') ? fmtMoney(v, _catfCcy()) : (_catfCcy() + ' ' + v); }
function _catfFacets(f){ return Object.assign({ variants: false, sourcing: false, standards: false, media: false }, (f && f.facets) || {}); }

/* ---- CSV paste → rows (the bulk-import parser) ---- */
function _catfParseCSV(text){
  var lines = (text || '').trim().split(/\r?\n/).filter(function(l){ return l.trim(); });
  if (!lines.length) return { headers: [], rows: [] };
  // RFC-4180-ish line splitter: honours "quoted fields, embedded, commas" and "" escaped quotes.
  var sp = function(l){ var out = [], cur = '', q = false;
    for (var i = 0; i < l.length; i++) { var ch = l[i];
      if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else cur += ch; }
    out.push(cur.trim()); return out; };
  // ⚠️ WAS `lines.slice(1, 60)`. The only caller is cwImportCSV, which IMPORTS these rows — so a 400-row paste
  // brought in 59 and toasted "59 items imported" as though that were the whole file. A cap that silently drops
  // data and reports success is the worst kind. Parse everything; a caller that only wants a preview slices it.
  return { headers: sp(lines[0]), rows: lines.slice(1).map(sp) };
}

/* ---- sample values for the customer-experience preview ---- */
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
/**
 * The field-by-field map — "we call it `hsn`, what does an integrator call it?"
 *
 * ⚠️ THE GAPS AND CONFLICTS SECTIONS ARE THE POINT, not filler. A standards panel that lists only what we align
 * with is marketing; one that also names what we do NOT carry, and where we knowingly differ, is a reference
 * someone can act on. Both come straight from CBCatalogue — there is no second copy of this to drift.
 */
function catfFieldMapHTML(){
  var FS = (CBCatalogue.FIELD_STANDARDS || {}), GAPS = (CBCatalogue.FIELD_GAPS || []), CON = (CBCatalogue.FIELD_CONFLICTS || []);
  var keys = Object.keys(FS);
  if (!keys.length) return '';
  var hdr = function(t, sub){ return '<div style="font-size:var(--fs-1);font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:18px;border-top:1px solid var(--line);padding-top:11px">' + esc(t)
    + (sub ? '<span style="font-weight:500;color:var(--grey);letter-spacing:0;text-transform:none"> — ' + esc(sub) + '</span>' : '') + '</div>'; };
  var cell = function(v){ return (!v || v === '—') ? '<span style="color:#c3c9cf">—</span>' : esc(v); };
  var rows = keys.map(function(k){
    var f = FS[k];
    var warn = /^[⚠⭐✗]/.test(f.n || '') || /^✗/.test(f.m || '');
    return '<tr style="border-bottom:1px solid var(--line)">'
      + '<td style="padding:6px 8px 6px 0;font-weight:700;font-size:11.5px;white-space:nowrap;vertical-align:top">' + esc(k) + '</td>'
      + '<td style="padding:6px 8px;font-size:11.5px;vertical-align:top">' + cell(f.s) + '</td>'
      + '<td style="padding:6px 8px;font-size:11.5px;vertical-align:top">' + cell(f.m) + '</td>'
      + '<td style="padding:6px 8px;font-size:11.5px;vertical-align:top;color:#2c5aa0">' + cell(f.o) + '</td>'
      + '<td style="padding:6px 0 6px 8px;font-size:var(--fs-1);color:' + (warn ? '#8a6d1e' : 'var(--grey)') + ';line-height:1.45;vertical-align:top">' + esc(f.n || '') + '</td>'
      + '</tr>';
  }).join('');
  return hdr('FIELD BY FIELD', 'ours → theirs')
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-top:6px;min-width:640px">'
    + '<thead><tr style="border-bottom:2px solid var(--line)">'
    + ['ours', 'schema.org', 'Medusa', 'other', 'note'].map(function(h){
        return '<th style="text-align:left;padding:0 8px 5px 0;font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey)">' + h + '</th>'; }).join('')
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    + hdr('NOT CARRIED', 'named so the absence is a decision, not an oversight')
    + GAPS.map(function(g){ return '<div style="padding:7px 0;border-bottom:1px dashed var(--line)">'
        + '<span style="font-size:11.5px;font-weight:700">' + esc(g.key) + '</span>'
        + '<span style="font-size:var(--fs-1);color:var(--grey)"> · ' + esc(g.from) + '</span>'
        + '<div style="font-size:11.5px;color:var(--grey);line-height:1.5;margin-top:2px">' + esc(g.why) + '</div></div>'; }).join('')
    + hdr('WHERE WE DIFFER', 'recorded, not silently changed — renaming a live field is a migration')
    + CON.map(function(c){ return '<div style="padding:8px 0;border-bottom:1px dashed var(--line)">'
        + '<div style="font-size:11.5px;font-weight:700">' + esc(c.ours) + '</div>'
        + '<div style="font-size:11.5px;color:var(--grey);line-height:1.5;margin-top:2px">' + esc(c.issue) + '</div>'
        + '<div style="font-size:var(--fs-1);color:#2c5aa0;margin-top:3px">standard: ' + esc(c.standard) + '</div>'
        + '<div style="font-size:var(--fs-1);color:#8a6d1e;margin-top:2px">cost: ' + esc(c.cost) + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">fix: ' + esc(c.fix) + '</div></div>'; }).join('');
}
function catfStandardsModal(){
  var S = (CBCatalogue.STANDARDS || []);
  var badge = function(st){ var c = st === 'in code' ? ['#2c7a43', '#e6f4ec'] : st === 'by reference' ? ['#2c5aa0', '#e8eef7'] : st === 'vocabulary' ? ['#6a4fa0', '#efeafa'] : ['#8a6d1e', '#f6efd8']; return '<span style="font-size:var(--fs-1);font-weight:700;color:' + c[0] + ';background:' + c[1] + ';border-radius:5px;padding:2px 7px;white-space:nowrap">' + esc(st) + '</span>'; };
  var row = function(s){ return '<div style="padding:10px 0;border-bottom:1px solid var(--line)">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:13px;font-weight:700;color:#1c2128">' + esc(s.name) + '</span>' + badge(s.status) + '<span style="font-size:var(--fs-1);color:var(--grey)">' + esc(s.body) + '</span></div>'
    + '<div style="font-size:12px;color:var(--grey);margin-top:3px;line-height:1.5">' + esc(s.role) + '</div>'
    + '<div style="font-size:var(--fs-1);color:#9aa3a7;margin-top:3px">' + (s.where && s.where !== '—' ? 'in: <code>' + esc(s.where) + '</code> · ' : '') + '<a href="' + esc(s.spec) + '" target="_blank" rel="noopener" style="color:#2c5aa0">spec ↗</a></div>'
    + '</div>'; };
  var grp = function(title, st){ var rows = S.filter(function(s){ return s.status === st; }); return rows.length ? '<div style="font-size:var(--fs-1);font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:14px">' + esc(title) + '</div>' + rows.map(row).join('') : ''; };
  var body = '<div style="padding:14px 18px;max-height:72vh;overflow:auto">'
    + '<div style="font-size:var(--fs-2);color:var(--grey);line-height:1.6">This catalogue is <b>not bespoke</b> — it is assembled from open, named standards. We arrange existing pieces our own way; the CB-unique layer (four-leg provenance · chit/seal · per-copy · governance) rides on top.</div>'
    + grp('IMPLEMENTED IN CODE', 'in code')
    + grp('VOCABULARY ALIGNMENT (naming, not an engine)', 'vocabulary')
    + grp('HELD BY REFERENCE (link out, never mirror)', 'by reference')
    + grp('ON THE ROADMAP', 'roadmap')
    + '<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:14px">Multi-source fill + smooth modification = <b>PIM</b> built on <b>MDM golden records</b>, edited with <b>RFC 7386 JSON Merge Patch</b>, de-duplicated by <b>GS1 GTIN/SKU</b>. Cross-company sync (GDSN) is the same discipline, later.</div>'
    + catfFieldMapHTML()
    + '</div>';
  if (typeof modal === 'function') modal('<div class="mhd"><div class="t">📐 Built on open standards</div></div><div class="mbody" style="padding:0">' + body + '</div>', true);
  else if (typeof toast === 'function') toast((CBCatalogue.STANDARDS || []).length + ' standards adopted');
}
   // adopt = source the full visible model
function catfSetPurpose(v){ if (UI.catf) { UI.catf.catalogue.story = v; _catfSave(); } }
function catfSetMethod(v){ if (UI.catf) { UI.catf.method = v; _catfSave(); renderApp(); } }
function catfToggleFacet(k){ if (!UI.catf) return; UI.catf.facets = _catfFacets(UI.catf); UI.catf.facets[k] = !UI.catf.facets[k]; _catfSave(); renderApp(); }
function catfReset(){
  confirmAsk('Start the catalogue setup over?',
    'The setup choices are cleared and you begin again.'
    + '<div style="margin-top:7px">Your <b>items are not affected</b> — nothing in the catalogue is removed.</div>',
    'Start over', _catfReset, true);
}
function _catfReset(){ UI.catf = null; UI.catfDraft = null; UI.catfPick = ''; try { localStorage.removeItem(_catfKey()); } catch (e) {} _catfSetDirty(true); _catfQueuePush(); renderApp(); }
// Hand off to the REAL catalogue screen — the owned items were persisted via prodAdd; view/edit/delete live there.
function catfManage(){ UI.nav = 'catalogue'; if (typeof renderApp === 'function') renderApp(); if (typeof loadCatalogue === 'function') loadCatalogue(); }
// PUBLISH AS BLUEPRINT (source-as-entity, b78): turn this store's catalogue into an adoptable source other stores
// inherit BY REFERENCE (names + design travel; each distributor overlays its OWN unit + price). Price is NOT published
// (it's the per-distributor commercial); underscore meta + objects are stripped.
function _catfSourceItems(f){
  return (f.items || []).map(function(it){ var d = {};
    Object.keys(it).forEach(function(k){ if (k.charAt(0) !== '_' && ['price', 'rate', 'sku'].indexOf(k) < 0 && typeof it[k] !== 'object' && it[k] != null && it[k] !== '') d[k] = it[k]; });
    d.name = it.product || it.name || '';
    if (it._photo || it.photo) d.photo = it._photo || it.photo;   // the picture travels in the blueprint (by reference)
    return d; }).filter(function(d){ return d.name; });
}
// ATTACH PHOTOS TO ITEMS BY FILENAME — the veg flow: names via CSV, photos separately. Tomato.jpg → the "Tomato"
// item. Downscaled thumbnail on the item; travels in the blueprint on publish (via _catfSourceItems.photo).
function catfPhotoAttachBtn(){ var el = document.getElementById('catf_photo_input'); if (el) el.click(); }
function catfAddPhotos(input){
  var files = (input && input.files) ? Array.prototype.slice.call(input.files) : []; if (!files.length) return;
  var f = UI.catf; if (!f) { input.value = ''; return; }
  var items = f.items || [];
  var norm = function(s){ return String(s || '').toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, ''); };
  var pending = files.length, matched = 0, unmatched = [];
  var done = function(){ pending--; if (pending <= 0) { _catfSave(); if (typeof toast === 'function') toast(matched + ' photo(s) matched' + (unmatched.length ? ' · unmatched: ' + unmatched.join(', ') : '')); renderApp(); } };
  files.forEach(function(file){
    if (!/^image\//.test(file.type || '')) { done(); return; }
    var fn = norm(file.name);
    var it = items.filter(function(x){ return norm(x.product || x.name) === fn; })[0]
          || items.filter(function(x){ var n = norm(x.product || x.name); return n && fn && (n.indexOf(fn) >= 0 || fn.indexOf(n) >= 0); })[0];
    if (!it) { unmatched.push(file.name); done(); return; }
    var rd = new FileReader();
    rd.onload = function(){ _cwDownscale(rd.result, 360, function(small){ it._photo = small; matched++; done(); }); };
    rd.onerror = done; rd.readAsDataURL(file);
  });
  input.value = '';
}
// AI ENRICH (catalogue-enrich skill, b113, via the deployed /ai-draft). Fills local names + botanical name + category
// onto the item names — reference gap-fill. These become item fields, so they travel in the blueprint on publish.
function catfEnrichAI(){
  var f = UI.catf; if (!f || typeof api !== 'function') return;
  var names = (f.items || []).map(function(it){ return it.product || it.name; }).filter(Boolean);
  if (!names.length) { if (typeof toast === 'function') toast('Add some items first, then enrich.'); return; }
  if (typeof toast === 'function') toast('Enriching ' + names.length + ' item(s) with AI…');
  api('catEnrich', { body: { skill_id: 'catalogue-enrich', context: { names: names, vertical: f.vertical || '' } } }).then(function(r){
    var map = (r && r.data) || null;
    if (!map || typeof map !== 'object') { if (typeof toast === 'function') toast('AI returned nothing to apply.'); return; }
    var n = 0;
    (f.items || []).forEach(function(it){ var e = map[it.product || it.name]; if (e && typeof e === 'object') { ['local_names', 'botanical_name', 'category'].forEach(function(k){ if (e[k] != null && e[k] !== '') it[k] = e[k]; }); n++; } });
    _catfSave();
    if (typeof toast === 'function') toast('Enriched ' + n + ' item(s) ✓ — local & botanical names added');
    renderApp();
  }).catch(function(err){ if (typeof toast === 'function') toast('Enrich failed: ' + ((err && err.message) || 'error')); });
}
function catfPublishBlueprint(){
  var f = UI.catf; if (!f || typeof api !== 'function') return;
  var c = CBCatalogue.ensure(f.catalogue);
  var items = _catfSourceItems(f);
  if (!items.length) { if (typeof toast === 'function') toast('Add some items first, then publish as a blueprint.'); return; }
  var slug = String(SESSION.entity || SESSION.entityId || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'store';
  var source_key = slug + '@v1';
  var keys = {}; items.forEach(function(d){ Object.keys(d).forEach(function(k){ if (k !== 'name') keys[k] = true; }); });
  var fields = [{ key: 'name', label: c.product || 'Item', type: 'text' }].concat(Object.keys(keys).map(function(k){ return { key: k, label: k.replace(/_/g, ' '), type: 'text' }; }));
  // one allowed unit → name it in the commercials label; several → items carry their own unit, so keep the label generic.
  var unit = (f.units && f.units.length === 1) ? f.units[0] : ((f.units && f.units.length) ? '' : (c.baseUnit || 'unit'));
  var body = { source_key: source_key, version: 'v1', for_vertical: f.vertical || '', title: (String(SESSION.entity || '') + ' — ' + (c.product || 'Catalogue')).trim(), collection: c.product || '',
    schema: { name: c.product || 'Item', fields: fields }, items: items,
    commercials_fields: [{ key: 'price', label: unit ? ('Price / ' + unit) : 'Price', type: 'money' }],
    experience: { note: c.story || '' }, formatting: {} };
  if (typeof toast === 'function') toast('Publishing blueprint…');
  api('catSourcePut', { body: body }).then(function(r){
    if (r && r.ok) {
      if (typeof toast === 'function') toast('Published as blueprint ✓');
      if (typeof modal === 'function') modal('<div class="mhd"><div class="t">📢 Published as a blueprint</div></div><div class="mbody" style="padding:16px 18px"><div style="font-size:13px;color:#3a4048;line-height:1.6">Your catalogue is now an <b>adoptable blueprint</b>. In <b>another store</b>, open <b>🗂️ Catalogue → ⚙ Set up (new) → Blueprint</b> and pick:'
        + '<div style="margin-top:8px;font-weight:700;color:#2c5aa0">' + esc(body.title) + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">source <code>' + esc(source_key) + '</code> · ' + items.length + ' item(s)' + (f.vertical ? ' · ' + esc(f.vertical) : '') + '</div>'
        + '<div style="margin-top:10px">Each distributor sets its <b>own unit + price</b> (e.g. wholesale in <b>ton</b>, retail in <b>kg</b>) — the names &amp; design travel <b>by reference</b>, not copied.</div></div></div>', true);
    } else if (typeof toast === 'function') toast('Publish failed: ' + ((r && r.error) || 'unknown'));
  }).catch(function(e){ if (typeof toast === 'function') toast('Publish failed: ' + ((e && e.message) || '')); });
}

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
  /* The category shelf is read ONCE, before the schema is built, then cached — the enum has to exist at the
     moment json-editor renders, and re-opening the form must not re-fetch. `cbCatgLive` resolves even on
     failure, so a dead shelf costs the dropdown and nothing else. */
  /* ⚠️ BOTH SHELVES, ONE GATE. Order models need the same treatment for the same reason — the enum must exist
     at the moment json-editor renders — and gating them separately would re-enter this function twice and
     rebuild the form under the user. Both resolve even on failure, so a dead shelf costs a dropdown, not the
     form. */
  if (_CATG === null || cbDefsCached('ordermodel') === null) {
    Promise.all([cbCatgLive(), cbOrderLive()]).then(function(){ catfFillItem(); });
    return;
  }
  var c = CBCatalogue.ensure(f.catalogue);
  var full = CBCatalogue.toJSONSchema(c, { method: f.method, currency: _catfCcy(), facets: _catfFacets(f) });
  // ADD FORM = only the fields the OWNER types: identity + unit + the CB gap. Hide system-fed (ERP), computed (AI),
  // at-order (customer), and by-reference (standards) — those aren't typed here.
  var props = {}; Object.keys(full.properties || {}).forEach(function(k){ var p = full.properties[k]; var leg = p['x-cb-leg']; var role = p['x-cb-role']; if (role === 'identity' || role === 'unit' || !leg || leg === 'cb') props[k] = p; });
  if (['cart', 'range', 'qtyprice'].indexOf(f.method) >= 0 && !props.price) props.price = { type: 'number', title: 'Price (' + _catfCcy() + ')' };
  var schema = Object.assign({}, full, { properties: props }); delete schema['$schema'];
  /**
   * ⭐ CATEGORY, INJECTED AS AN ENUM — the form already renders an enum as a <select>, so the pick costs no new
   * widget. `enum` carries definition_ids and `options.enum_titles` carries the names: json-editor shows the
   * title and stores the value, which is exactly the refer-don't-copy rule expressed in a form library.
   *
   * ⚠️ IT IS NOT REQUIRED, and that is a decision. An item with no category is Uncategorised — countable,
   * chip-visible, fixable later. Blocking the save until someone classifies a product is how a catalogue stops
   * being filled in at all.
   */
  var cats = _CATG || [];
  if (cats.length) {
    schema.properties = Object.assign({}, schema.properties, { category: {
      type: 'string', title: 'Category',
      enum: [''].concat(cats.map(function(c){ return c.id; })),
      options: { enum_titles: ['— none —'].concat(cats.map(function(c){ return c.name; })) }
    } });
  }
  /**
   * ⭐⭐ ORDER MODEL, ADOPTED BY REFERENCE (backlog 17) — the same enum trick as category above, for the same
   * reason: `enum` carries definition_ids, `enum_titles` carries the names. The product stores the ID, so
   * "Carton of 6" is corrected in one place instead of retyped on fifty items.
   *
   * ⚠️ NARROWED BY WHAT THIS CATALOGUE CAN SELL (backlog 18) — a text catalogue offers none at all, and the
   * field simply does not appear rather than offering a choice that cannot work.
   *
   * ⚠️ NOT REQUIRED. A product with no order model falls to the inline default, exactly as before; making this
   * mandatory would block the save on a decision most owners have no reason to make on item one.
   */
  var oms = (typeof cbDefsCached === 'function' && cbDefsCached('ordermodel')) || [];
  var allowed = (typeof CBCatalogue !== 'undefined' && CBCatalogue.modelsForMethod)
    ? CBCatalogue.modelsForMethod(f.method) : null;
  var omPick = oms.filter(function(d){ return !allowed || allowed.indexOf(d.sub) >= 0; });
  if (omPick.length) {
    schema.properties = Object.assign({}, schema.properties, { order_ref: {
      type: 'string', title: 'Order model',
      enum: [''].concat(omPick.map(function(d){ return d.definition_id; })),
      options: { enum_titles: ['— default —'].concat(omPick.map(function(d){ return d.name + ' (' + d.sub + ')'; })) }
    } });
  }
  window._catfSchema = schema;
  var style = '<style>#cat_je > div > h3,#cat_je .je-object__title{font-size:13px;font-weight:700;margin:0}#cat_je label{display:block;font-size:var(--fs-1);color:#6a707a;font-weight:600;margin:9px 0 3px}#cat_je input[type=text],#cat_je input[type=number],#cat_je select,#cat_je textarea{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--paper,#fff)}#cat_je .je-indented-panel{border:none;padding:0;margin:0}#cat_je p.je-object__title + *{margin-top:0}#cat_je .je-header{margin-bottom:2px}</style>';
  modal('<div class="mhd"><div class="t">Add an item</div></div><div class="mbody" style="padding:0"><div style="padding:14px 18px">' + style + '<div style="font-size:11.5px;color:var(--grey);margin-bottom:12px">Fill in the details for this item.</div><div id="cat_je" style="color:var(--grey);font-size:12px">…</div><div id="cat_je_out" style="margin-top:12px"></div><div style="display:flex;gap:8px;margin-top:16px;align-items:center"><button class="pri" onclick="catfCaptureItem()" style="padding:9px 16px">Save item</button><button onclick="closeModal()" style="padding:9px 16px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--grey)">Cancel</button><button data-testid="catg-new" onclick="catfNewCategory()" style="margin-left:auto;padding:9px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--blue);font-weight:600">＋ New category</button></div></div></div>', true);
  _catfLoadJE().then(function(){
    setTimeout(function(){ var el = document.getElementById('cat_je'); if (!el) return; el.innerHTML = '';
      try { if (window._catfJE) { try { window._catfJE.destroy(); } catch (e) {} } window._catfJE = new window.JSONEditor(el, { schema: window._catfSchema, theme: 'html', disable_edit_json: true, disable_properties: true, disable_collapse: true, no_additional_properties: true });
        /* ⚠️ RESTORED HERE, NOT ON A TIMER. Creating a category re-opens this form, and everything already typed
           has to come back. A `setTimeout` in the caller would be guessing at when the editor exists; this is the
           one place that KNOWS, because it just built it. */
        if (window._catfPending) { try { window._catfJE.setValue(window._catfPending); } catch (e) {} window._catfPending = null; }
      } catch (e) { el.innerHTML = '<div style="color:#a5382e;font-size:12px">json-editor failed: ' + esc(e.message) + '</div>'; }
    }, 40);
  }).catch(function(){ var el = document.getElementById('cat_je'); if (el) el.innerHTML = '<div style="color:#a5382e;font-size:12px">Could not load the json-editor library (/app/vendor/json-editor.min.js).</div>'; });
}
/** ⭐ The second half of Athi's ask — *"create category should be there"* — without leaving the item form.
 *  What is already typed is carried through and the new category comes back selected. */
function catfNewCategory(){
  var keep = null; try { keep = window._catfJE && window._catfJE.getValue(); } catch (e) {}
  cbCatgAskNew(function(c){
    if (keep) { keep.category = c.id; window._catfPending = keep; }
    catfFillItem();     // rebuilds the schema, so the enum now contains the category that was just created
  });
}
function catfCaptureItem(){
  if (!window._catfJE) return; var v; try { v = window._catfJE.getValue(); } catch (e) { return; }
  if (UI.catf) {   // committed catalogue → SAVE to the real catalogue via the existing products API (behind the scenes)
    var item = Object.assign({ _src: 'manual' }, v || {});
    var item_data = Object.assign({}, v || {}, { name: (v && (v.product || v.name)) || 'item' });   // existing catalogue reads item_data.name/unit/price
    /**
     * ⭐ BOTH THE ID AND THE NAME, ON PURPOSE — and this is the one place the two-in-one is not a duplicate.
     *
     * `category` is the definition_id: MY reference, so renaming in Definitions renames it on my screens.
     * `category_name` is a VALUE, written once, for everyone who is not me — a counterparty holding this item in
     * their copy cannot resolve my definition_id and never will. [[reference-cb-core-principle]]: a reference is
     * only resolvable inside the entity that owns it; anything that must cross the boundary crosses as a copy.
     *
     * ⚠️ The copy is deliberately NOT kept in step with a later rename. My renaming a shelf is not an event that
     * should silently relabel a product already sitting in someone else's catalogue.
     */
    if (item_data.category) {
      var _c = (_CATG || []).filter(function(c){ return c.id === item_data.category; })[0];
      if (_c) item_data.category_name = _c.name;
    } else { delete item_data.category; }   // '— none —' is the empty enum value; store nothing rather than ''
    /**
     * ⭐⭐ THE ORDER MODEL IS STORED AS A POINTER, AND ONLY A POINTER (backlog 17).
     *
     * `order_ref` is a form field; the stored shape is `order: { ref }`. ⚠️ NO COPY OF THE VALUES IS KEPT HERE —
     * that is the entire difference between this and typing `pack, step 6` on fifty items. A copy would go stale
     * the moment the definition is corrected, and the product would then disagree with its own model with no way
     * to tell which was meant. The values are frozen onto the CHIT at the mint, where being fixed is the point.
     * ⚠️ Unlike `category`, no `_name` twin is written. A category name is denormalised for a counterparty who
     * cannot resolve my ids; an order model's terms reach them through the frozen snapshot instead, which is
     * both the copy AND the pointer — strictly better than a loose name.
     */
    if (item_data.order_ref) { item_data.order = { ref: item_data.order_ref }; }
    delete item_data.order_ref;
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
  out.innerHTML = '<div style="font-size:var(--fs-1);font-weight:800;color:#2c7a43;letter-spacing:.05em">CAPTURED ITEM — conforms to the schema</div>'
    + '<pre style="background:#0f1720;color:#d6e2f0;border-radius:9px;padding:10px 12px;font-size:var(--fs-1);overflow:auto;max-height:30vh;margin-top:6px;white-space:pre">' + esc(JSON.stringify(v, null, 2)) + '</pre>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:4px">A real catalogue_item — this is the JSON that gets sealed onto the chit.</div>';
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
/**
 * ⚠️ THE LIST MOVED TO THE MODEL (catalogue-model.js · UNITS). This is now an alias, not a declaration — the
 * wizard is a screen and had no business owning the registry every line item depends on. Keeping the CW_UNITS
 * name means the two call sites below are untouched, so this is a move with no behaviour change to review.
 *
 * ⚠️ The fallback is deliberately EMPTY rather than a second copy of the list. If the model ever fails to load,
 * an empty unit picker is a visible fault; a quietly-duplicated list is the exact drift being removed — that is
 * how CATF_METHODS and METHODS came to disagree by four values without anyone noticing.
 */
var CW_UNITS = (typeof CBCatalogue !== 'undefined' && CBCatalogue.UNITS) ? CBCatalogue.UNITS : [];
/* ══ CATEGORIES — the adoption side of a definition ═══════════════════════════════════════════════════════════
 * ⭐ BACKLOG 15, Athi 2026-08-16: *"so we have to have list category and create category should be there."*
 *
 * Definitions could author a category, publish it live, and toast *"Live — it can be adopted now."* — with
 * nowhere in the product to adopt it. This is that nowhere, filled: the item form offers the live ones, and
 * makes a new one without leaving the form.
 *
 * ⚠️ WHAT IS STORED IS THE definition_id. Never the name. Rename the category in Definitions and every product
 * follows, because no product ever copied the word. This is the same rule that keeps the Constitution single —
 * declare once, refer everywhere — and it is the reason a category needs no freeze semantics: there is nothing
 * in it that could change the meaning of a stamped chit.
 */
/* ⚠️  /  LIVE IN core.js — compose (app.html) needs the shelf and this
   capability is lazy-loaded, so the loader cannot live behind the lazy load. Authoring stays here. */
/** ⭐ Inline create, PUBLISHED LIVE. A draft would not appear in the picker that just sent you here — you would
 *  create a category and watch it not arrive. Two calls because the API separates authoring from publishing;
 *  that separation is right for Definitions and merely invisible here. */
async function cbCatgCreate(name){
  name = String(name || '').trim();
  if (name.length < 2) throw new Error('Give the category a name of at least 2 characters.');
  var dup = (_CATG || []).filter(function(c){ return c.name.toLowerCase() === name.toLowerCase(); })[0];
  if (dup) return dup;      // ⚠️ Silently reusing the existing one beats minting a second shelf with one name.
  var r = await api('defAdd', { body: { kind: 'category', sub_kind: null, name: name, note: '', rules: {} } });
  var id = r && (r.definition_id || (r.definition && r.definition.definition_id));
  if (!id) throw new Error('Created, but the server did not return an id.');
  await api('defSave', { params: { id: id }, body: { status: 'live' } });
  await cbCatgLive(true);
  return { id: id, name: name };
}
/** The dialog — `promptAsk` (app.html), the in-app text prompt. It owns the focus, the Enter key, the trim and
 *  the read-before-close ordering, so nothing about those is decided here. */
function cbCatgAskNew(onDone){
  if (typeof promptAsk !== 'function') return;
  promptAsk('New category', { label:'What is it called?', placeholder:'e.g. Fasteners', maxlength:60,
    okLabel:'Create',
    hint:'It goes on the shelf as <b>live</b>, so you can use it straight away. Rename it any time under '
       + 'Definitions — your products follow the rename.' },
    function(v){
      cbCatgCreate(v).then(function(c){ toast('“' + c.name + '” added ✓'); if (onDone) onDone(c); })
                     .catch(function(e){ toast((e && e.message) || 'Could not create that.'); });
    });
}
function cwToggleUnit(u){ var w = UI.cw; w.units = w.units || []; var i = w.units.indexOf(u); if (i >= 0) w.units.splice(i, 1); else w.units.push(u); renderApp(); }
function cwAddUnit(){ var w = UI.cw; var u = (val('cw_newunit') || '').trim(); if (!u) return; w.units = w.units || []; if (w.units.indexOf(u) < 0) w.units.push(u); renderApp(); }
function _cwLoggedIn(){ return typeof SESSION !== 'undefined' && !!SESSION.token; }
function _cwInit(){
  if (!UI.cw) UI.cw = { step: 1, vertical: '', source: '', built: null, chosen: {}, erp: {}, manual: {}, prices: {}, itemUnits: {}, method: '', tax: { label: 'GST', rate: '' } };
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
function cwUnderstand(){ var w = UI.cw; var p = (val('cw_purpose') || '').trim(); if (!p) { if (typeof toast === 'function') toast('Describe the catalogue first.'); return; } w.purpose = p; w.vertical = _catfVerticalFromPurpose(p) || w.vertical || ''; w.fieldSel = _cwSuggestFields(p); if (!(w.units && w.units.length)) w.units = [(CATF_KB[w.vertical] && CATF_KB[w.vertical].baseUnit) || 'litre'];
  if (!w.method) w.method = (CATF_KB[w.vertical] && CATF_KB[w.vertical].method) || 'cart';   // the vertical's own default (gold → range, trade → qtyprice)
  renderApp(); }
function cwToggleField(idx){ var f = UI.cw.fieldSel && UI.cw.fieldSel[idx]; if (f) { f.on = !f.on; renderApp(); } }
function _cwUnitStr(w){ return (w.units && w.units.length) ? w.units.join(' · ') : 'unit'; }
function _cwRequired(w){ if (w.fieldSel && w.fieldSel.length) return w.fieldSel.filter(function(f){ return f.on; }).map(function(f){ return { name: f.name, leg: f.leg || 'cb' }; }); return CATF_REQUIRED[w.vertical] || []; }
function _cwBpFields(w){ var it = w.built && w.built.finishes && w.built.finishes[0]; return it ? Object.keys(it).filter(function(k){ return ['commercials', 'combinations'].indexOf(k) < 0 && it[k] != null && it[k] !== ''; }) : []; }
function _cwNorm(n){ n = (n || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (n === 'productname' || n === 'product' || n === 'item' || n === 'title') return 'name'; if (n === 'colour') return 'color'; return n; }
function _cwCovered(w){ var m = {}; _cwBpFields(w).forEach(function(k){ m[_cwNorm(k)] = 'blueprint'; }); Object.keys(w.erpMap || {}).forEach(function(k){ var mm = w.erpMap[k]; if (mm && mm.system && mm.system !== '—') m[_cwNorm(k)] = 'erp'; }); Object.keys(w.manual || {}).forEach(function(k){ if (w.manual[k] !== '' && w.manual[k] != null) m[_cwNorm(k)] = 'manual'; }); return m; }
function _cwRemaining(w){ var cov = _cwCovered(w); return _cwRequired(w).filter(function(r){ return !cov[_cwNorm(r.name)]; }); }

function _catfWizard(){
  _cwInit(); var w = UI.cw, step = w.step;
  var bar = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">' + CW_STEPS.map(function(s, i){ var n = i + 1, on = n === step, done = n < step; return '<span onclick="cwGo(' + n + ')" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-1);font-weight:600;color:' + (on ? '#2c5aa0' : done ? '#2c7a43' : 'var(--grey)') + '"><span style="width:19px;height:19px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:var(--fs-1);background:' + (on ? '#2c5aa0' : done ? '#2c7a43' : '#eef1f5') + ';color:' + (on || done ? '#fff' : 'var(--grey)') + '">' + (done ? '✓' : n) + '</span>' + esc(s) + '</span>' + (n < CW_STEPS.length ? '<span style="color:#c8d0d9">›</span>' : ''); }).join('') + '</div>';
  var raw = [null, _cwStep1, _cwStep2, _cwStep3, _cwStep4, _cwStep5, _cwStep6][step](w);
  var body = (step === 1 || step === 2) ? raw : _cwTwo(raw, _cwPreview(w));   // steps 1 & 2 own their two-panel; 3–6 get the running preview on the right
  var nav = '<div style="display:flex;gap:10px;margin-top:20px;align-items:center">'
    + (step > 1 ? '<button onclick="cwBack()" style="padding:9px 16px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--grey)">‹ Back</button>' : '')
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
  var head = '<div style="font-size:var(--fs-1);font-weight:800;color:#2c5aa0;letter-spacing:.05em">YOUR CATALOGUE SO FAR</div>'
    + '<div style="margin-top:6px;font-size:var(--fs-2);font-weight:700">' + esc(title) + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey)">cart · ' + esc(_catfCcy()) + ' · sold by ' + esc(_cwUnitStr(w)) + (w.source ? ' · blueprint ' + esc(w.source) : '') + '</div>';
  var fieldsHtml = fields.length ? '<div style="margin-top:11px;font-size:var(--fs-1);font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Fields</div>' + fields.map(function(f){ var src = cov[_cwNorm(f.name)]; var b = src === 'blueprint' ? ['📎 blueprint', '#6a44a8'] : src === 'erp' ? ['🔗 ERP', '#b07b1e'] : src === 'manual' ? ['✍ you', '#2c7a43'] : ['· to fill', '#9aa3a7']; return '<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;padding:1px 0"><span style="flex:1;color:#3a4048">' + esc(f.name) + '</span><span style="font-size:var(--fs-1);font-weight:700;color:' + b[1] + ';background:' + b[1] + '18;border-radius:4px;padding:1px 6px">' + b[0] + '</span></div>'; }).join('') : '';
  var itemsHtml = items.length ? '<div style="margin-top:11px;font-size:var(--fs-1);font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Items · ' + items.length + '</div>' + items.slice(0, 7).map(function(it){ var p = w.prices[it.name]; return '<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;padding:1px 0"><span style="flex:1">' + esc(it.name) + '</span><span style="font-weight:600;color:' + (p != null && p !== '' ? '#1c2128' : '#a5382e') + '">' + (p != null && p !== '' ? esc(_catfMoney(p)) : 'no price') + '</span></div>'; }).join('') : '';
  var taxHtml = (w.tax && w.tax.rate) ? '<div style="margin-top:9px;font-size:var(--fs-1);color:var(--grey)">Tax: ' + esc(w.tax.label || 'GST') + ' ' + esc(w.tax.rate) + '%</div>' : '';
  return head + fieldsHtml + itemsHtml + taxHtml;
}
// HOW CUSTOMERS ORDER — the same chip pattern as "Sold by", but single-select. This is the question "what data do I
// want back from a buyer?", so each option states what the order chit will CARRY, not just what the widget looks like.
// Defaults from the vertical (CATF_KB: gold → range, trade → qtyprice), and the wizard now honours that choice —
// it used to hardcode 'cart' at finish regardless of what the vertical declared.
function _cwMethod(w){ return w.method || (CATF_KB[w.vertical] && CATF_KB[w.vertical].method) || 'cart'; }
function cwSetMethod(k){ UI.cw.method = k; renderApp(); }
function _cwMethodBlock(w){
  var cur = _cwMethod(w);
  var sel = CATF_METHODS.filter(function(m){ return m.k === cur; })[0] || CATF_METHODS[0];
  var chip = function(m){ var on = m.k === cur;
    return '<span data-testid="cw-method-' + esc(m.k) + '" onclick="cwSetMethod(\'' + esc(m.k) + '\')" title="' + esc(m.hint) + '" style="cursor:pointer;font-size:var(--fs-1);font-weight:600;padding:3px 10px;border-radius:13px;border:1px solid ' + (on ? '#2c5aa0' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--grey)') + ';background:' + (on ? '#2c5aa0' : '#fff') + '">' + (on ? '✓ ' : '') + esc(m.label) + '</span>'; };
  return '<div style="margin-bottom:14px">'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:5px">How customers order <span style="color:#9aa3a7">— this decides what data comes back to you on the order</span></div>'
    + '<div style="display:flex;gap:5px;flex-wrap:wrap">' + CATF_METHODS.map(chip).join('') + '</div>'
    + '<div style="margin-top:6px;font-size:var(--fs-1);color:#2c5aa0;background:#eef4fc;border:1px solid #cfe0f4;border-radius:6px;padding:5px 9px">'
    + '<b>You receive:</b> ' + esc(sel.receives) + '</div></div>';
}
function _cwStep1(w){
  var left = '<div style="font-size:13px;color:#3a4048;margin-bottom:8px">Tell me the <b>purpose</b> — the exact catalogue you want.</div>'
    + '<textarea id="cw_purpose" placeholder="e.g. a chemical catalogue especially focusing on paint" rows="4" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:13px;resize:vertical">' + esc(w.purpose || '') + '</textarea>'
    + '<button class="pri" onclick="cwUnderstand()" style="margin-top:8px;padding:9px 15px">Understand → suggest fields</button>'
    + (w.vertical ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:8px">reads as: <b>' + esc(w.vertical) + '</b></div>' : '');
  var right;
  if (w.fieldSel && w.fieldSel.length) {
    var secs = {}, order = []; w.fieldSel.forEach(function(f){ if (!secs[f.section]) { secs[f.section] = []; order.push(f.section); } secs[f.section].push(f); });
    var on = w.fieldSel.filter(function(f){ return f.on; }).length;
    right = '<div style="font-size:var(--fs-1);font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-bottom:8px">FIELDS TO STORE <span style="font-weight:500;color:var(--grey)">— pick what this catalogue keeps</span></div>'
      + (function(){ var us = w.units || []; var chip = function(u, known){ var on = us.indexOf(u) >= 0; return '<span onclick="cwToggleUnit(\'' + esc(u).replace(/'/g, "\\'") + '\')" style="cursor:pointer;font-size:var(--fs-1);font-weight:600;padding:3px 10px;border-radius:13px;border:1px solid ' + (on ? '#2c7a43' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--grey)') + ';background:' + (on ? '#2c7a43' : '#fff') + '">' + (on ? '✓ ' : '') + esc(u) + (on && !known ? ' ×' : '') + '</span>'; };
        var extra = us.filter(function(u){ return CW_UNITS.indexOf(u) < 0; });
        return '<div style="margin-bottom:14px"><div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:5px">Sold by <span style="color:#9aa3a7">— pick every unit this catalogue uses (products can differ: kg · litre · count…)</span></div>'
          + '<div style="display:flex;gap:5px;flex-wrap:wrap">' + CW_UNITS.map(function(u){ return chip(u, true); }).join('') + extra.map(function(u){ return chip(u, false); }).join('') + '</div>'
          + '<div style="display:flex;gap:6px;margin-top:7px"><input id="cw_newunit" placeholder="add a unit (e.g. drum, coil)" style="width:170px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;font-size:11.5px"><button onclick="cwAddUnit()" style="padding:4px 11px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--blue);font-weight:600;font-size:var(--fs-1);cursor:pointer">Add</button></div></div>'; })()
      + _cwMethodBlock(w)
      + order.map(function(sec){ return '<div style="margin-bottom:11px"><div style="font-size:var(--fs-1);font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">' + esc(sec) + '</div>' + secs[sec].map(function(f){ var idx = w.fieldSel.indexOf(f); return '<label style="display:flex;align-items:center;gap:8px;padding:2px 0;cursor:pointer"><input type="checkbox" ' + (f.on ? 'checked' : '') + ' onchange="cwToggleField(' + idx + ')"><span style="font-size:12px;font-weight:' + (f.on ? 600 : 400) + ';color:' + (f.on ? '#1c2128' : 'var(--grey)') + '">' + esc(f.name) + '</span><span style="font-size:var(--fs-1);color:#9aa3a7;background:#eef1f5;border-radius:4px;padding:1px 6px">' + esc(f.type) + '</span>' + (f._bp ? '<span style="font-size:var(--fs-1);color:#6a44a8" title="from blueprint">📎</span>' : f._added ? '<span style="font-size:var(--fs-1);color:#2c7a43" title="you added">＋</span>' : '') + '</label>'; }).join('') + '</div>'; }).join('')
      + '<div style="font-size:var(--fs-1);color:#2c7a43;font-style:italic;border-top:1px solid var(--line);padding-top:8px">' + on + ' fields selected · sold by ' + esc(_cwUnitStr(w)) + '</div>'
      + '<div style="margin-top:8px"><div style="font-size:var(--fs-1);font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Add a data type</div><div style="display:flex;gap:6px;margin-top:5px"><input id="cw_newfield" placeholder="field name" style="flex:1;min-width:0;padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px"><select id="cw_newtype" style="padding:5px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-1)">' + ['text', 'number', 'choice', 'date', 'boolean'].map(function(t){ return '<option>' + t + '</option>'; }).join('') + '</select><button onclick="cwAddCustomField()" style="padding:5px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--blue);font-weight:600;font-size:var(--fs-1);cursor:pointer">Add</button></div><div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">Uncheck any you don\'t need · add any that are missing. Adopting a blueprint (step 2) adds its fields here too 📎.</div></div>';
  } else {
    right = '<div style="color:var(--grey);font-size:var(--fs-2);text-align:center;margin-top:44px">Describe the catalogue on the left →<br>I\'ll suggest the fields to store, grouped in sections, for you to pick.</div>';
  }
  return '<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:0 0 300px;max-width:340px">' + left + '</div><div style="flex:1;min-width:280px;border-left:1px solid var(--line);padding-left:18px">' + right + '</div></div>';
}
// Step 2 is its own master-detail two-panel: LEFT = the fields (with the selected product's values) · RIGHT = the products
function _cwStep2(w){ return _cwTwo(_cwStep2Fields(w), _cwStep2Products(w)); }
function _cwStep2Fields(w){
  var fields = (w.fieldSel || []).filter(function(f){ return f.on; });
  var sel = w.sel ? (w.built && w.built.finishes || []).filter(function(it){ return it.name === w.sel; })[0] : null;
  var head = '<div style="font-size:var(--fs-1);font-weight:800;color:#2c5aa0;letter-spacing:.05em">FIELDS' + (sel ? ' <span style="color:#6a44a8">· ' + esc(sel.name) + '</span>' : '') + '</div>';
  if (!fields.length) return head + '<div style="font-size:12px;color:var(--grey);margin-top:8px">Pick fields in step 1 first. Adopting a blueprint (right) adds its fields here.</div>';
  var rows = fields.map(function(f){ var v = sel ? sel[f._bpKey || f.name] : undefined; var vstr = (v == null) ? '' : (Array.isArray(v) ? v.map(function(x){ return (x && typeof x === 'object') ? (x.name || '') : x; }).join(', ') : (typeof v === 'object' ? (v.name || JSON.stringify(v)) : String(v))); return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px dashed var(--line);font-size:11.5px"><span style="flex:0 0 148px;color:#3a4048">' + esc(f.name) + (f._bp ? ' <span style="color:#6a44a8;font-size:var(--fs-1)">📎</span>' : f._added ? ' <span style="color:#2c7a43;font-size:var(--fs-1)">＋</span>' : '') + '</span><span style="flex:1;color:' + (vstr ? '#1c2128' : '#9aa3a7') + '">' + (sel ? (vstr ? esc(vstr) : '—') : '<span style="font-size:var(--fs-1)">value shows when you click a product ›</span>') + '</span></div>'; }).join('');
  var refF = fields.filter(function(f){ return f._bp; }).map(function(f){ return f.name; });
  var todo = fields.filter(function(f){ return !f._bp; }).map(function(f){ return f.name; });
  var mode = w.adoptMode || 'reference';
  var summary = w.source ? '<div style="margin-top:6px;font-size:var(--fs-1);line-height:1.6;border-bottom:1px solid var(--line);padding-bottom:8px">'
    + '<div><span style="color:' + (mode === 'value' ? '#2c5aa0' : '#6a44a8') + ';font-weight:700">' + (mode === 'value' ? '📋 filled by value · ' : '📎 filled by reference · ') + refF.length + '</span> <span style="color:var(--grey)">' + esc(refF.join(' · ') || '—') + '</span></div>'
    + (todo.length ? '<div><span style="color:#2c7a43;font-weight:700">✍ you still fill · ' + todo.length + '</span> <span style="color:var(--grey)">' + esc(todo.join(' · ')) + '</span></div>' : '')
    + '</div>' : '';
  var swatches = (sel && sel.combinations && sel.combinations.length) ? '<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px"><div style="font-size:var(--fs-1);font-weight:700;color:#6a707a;text-transform:uppercase;letter-spacing:.04em">Colour combinations</div>' + sel.combinations.map(_cwCombo).join('') + '</div>' : '';
  return head + summary + '<div style="margin-top:8px">' + rows + '</div>' + swatches;
}
/* render products with the blueprint's OWN look & feel — colour swatches, chips, accent, story */
function _cwSwatch(c){ return '<span title="' + esc((c.name || '') + ' ' + (c.hex || '')) + '" style="display:inline-block;width:15px;height:15px;border-radius:50%;background:' + esc(c.hex || '#ccc') + ';border:1px solid rgba(0,0,0,.15);vertical-align:middle;margin-right:2px"></span>'; }
function _cwCombo(cm){ return '<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span>' + ((cm.colours || []).map(_cwSwatch).join('')) + '</span><span style="font-size:var(--fs-1);color:#3a4048;font-weight:600">' + esc(cm.name || '') + '</span></div>'; }
function _cwProductCard(w, it){
  var on = w.chosen[it.name] !== false, seld = w.sel === it.name;
  var accent = (w.built && w.built.formatting && w.built.formatting.accent) || '#6a44a8';
  var nm = esc(it.name).replace(/'/g, "\\'");
  var chips = [it.texture_family, it.region].filter(Boolean).map(function(c){ return '<span style="font-size:var(--fs-1);background:' + accent + '18;color:' + accent + ';border-radius:4px;padding:1px 6px">' + esc(c) + '</span>'; }).join('') + (it.effect || []).map(function(e){ return '<span style="font-size:var(--fs-1);background:#f3f0e8;color:#7a5e22;border-radius:4px;padding:1px 6px">' + esc(e) + '</span>'; }).join('');
  var combos = (it.combinations || []).slice(0, 2).map(_cwCombo).join('');
  return '<div onclick="cwSelectProduct(\'' + nm + '\')" style="border:1px solid ' + (seld ? accent : 'var(--line)') + ';border-radius:12px;padding:10px 12px;margin-top:6px;background:' + (seld ? accent + '0c' : '#fff') + ';cursor:pointer">'
    + (it.photo ? '<div style="height:96px;background:#f4f6f8 center/cover no-repeat;background-image:url(' + it.photo + ');border-radius:9px;margin-bottom:7px"></div>' : '')
    + '<div style="display:flex;align-items:center;gap:8px"><input type="checkbox" ' + (on ? 'checked' : '') + ' onclick="event.stopPropagation()" onchange="cwToggleItem(\'' + nm + '\')"><span style="font-weight:700;font-size:13px">' + esc(it.name) + '</span><span style="font-size:var(--fs-1);color:#9aa3a7">' + esc(it.scale || '') + (it.sheen ? ' · ' + esc(it.sheen) : '') + '</span><span style="margin-left:auto;color:' + accent + ';font-weight:700">' + (seld ? '▸' : '') + '</span></div>'
    + (it.inspiration ? '<div style="font-size:var(--fs-1);color:#6a707a;margin:5px 0;line-height:1.45">' + esc(it.inspiration) + '</div>' : '')
    + (chips ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">' + chips + '</div>' : '')
    + (combos ? '<div style="margin-top:6px">' + combos + '</div>' : '')
    + '</div>';
}
function _cwStep2Products(w){
  var srcs = UI._cwSources;
  var picker;
  if (srcs === null) picker = '<div style="color:var(--grey);font-size:12px">loading blueprints…</div>';
  else {
    var q = (w.bpQuery || '').toLowerCase().trim();
    var all = srcs || [];
    var storeGroup = _catfGroupOf(w.vertical);
    var matchVert = function(s){ if (w.bpAll) return true; if (!s.for_vertical) return true; if (storeGroup) return _catfGroupOf(s.for_vertical) === storeGroup; return !w.vertical || s.for_vertical === w.vertical; };
    var filtered = all.filter(function(s){ return matchVert(s) && (!q || (((s.title || '') + ' ' + (s.for_entity || '') + ' ' + (s.for_vertical || '')).toLowerCase().indexOf(q) >= 0)); });
    var otherCount = all.filter(function(s){ return !matchVert(s); }).length;
    var scopeLabel = w.bpAll ? 'All types' : (storeGroup ? (storeGroup + ' family' + (w.vertical ? ' · ' + esc(w.vertical) : '')) : ('For ' + esc(w.vertical || 'your catalogue')));
    var search = '<input id="cw_bp_search" value="' + esc(w.bpQuery || '') + '" oninput="cwSetBpQuery(this.value)" placeholder="🔎 search blueprints…" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--line);border-radius:9px;font-size:var(--fs-2)">';
    var scope = '<div style="font-size:var(--fs-1);color:var(--grey);margin:6px 0">' + scopeLabel + ' · ' + filtered.length + ' blueprint(s)'
      + ((otherCount && !w.bpAll) ? ' · <span onclick="cwToggleBpAll()" style="cursor:pointer;color:var(--blue);font-weight:600">show all (' + otherCount + ' other)</span>' : ((w.bpAll && w.vertical) ? ' · <span onclick="cwToggleBpAll()" style="cursor:pointer;color:var(--blue);font-weight:600">only ' + esc(w.vertical) + '</span>' : '')) + '</div>';
    var skipRow = '<div onclick="cwPickSource(\'\')" style="cursor:pointer;padding:7px 11px;border-bottom:1px solid var(--line);background:' + (!w.source ? '#f4f6f8' : '#fff') + ';font-size:12px;color:var(--grey)">— skip (build without a blueprint) —</div>';
    var rows = filtered.map(function(s){ var on = w.source === s.key;
      return '<div onclick="cwPickSource(\'' + esc(s.key) + '\')" style="cursor:pointer;padding:8px 11px;border-bottom:1px solid var(--line);background:' + (on ? '#eef4ff' : '#fff') + '">'
        + '<div style="display:flex;align-items:center;gap:8px"><span style="font-weight:' + (on ? 700 : 600) + ';font-size:var(--fs-2)">' + esc(s.title) + '</span>'
        + (s.for_vertical ? '<span style="font-size:var(--fs-1);color:#6a44a8;background:#efeafa;border-radius:4px;padding:1px 6px">' + esc(s.for_vertical) + '</span>' : '')
        + '<span style="margin-left:auto;font-size:var(--fs-1);color:var(--grey)">' + s.item_count + ' item(s)</span></div>'
        + (s.for_entity ? '<div style="font-size:var(--fs-1);color:#9aa3a7;margin-top:1px">' + esc(s.for_entity) + '</div>' : '') + '</div>'; }).join('');
    var empty = '<div style="font-size:11.5px;color:var(--grey);padding:9px 11px">No blueprints' + (q ? ' match “' + esc(q) + '”' : ((w.vertical && !w.bpAll) ? ' for ' + esc(w.vertical) : '')) + '.' + ((otherCount && !w.bpAll) ? ' <span onclick="cwToggleBpAll()" style="cursor:pointer;color:var(--blue);font-weight:600">Show all verticals.</span>' : '') + '</div>';
    picker = search + scope + '<div style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:9px">' + skipRow + (filtered.length ? rows : empty) + '</div>';
  }
  var rights = w.source ? '<div style="margin-top:6px;font-size:var(--fs-1);color:#2e7a45">🔓 Rights ok <span style="color:var(--grey)">— you may use this blueprint (distributor grant)</span></div>' : '';
  var mode = w.adoptMode || 'reference';
  var modeToggle = w.source ? '<div style="margin-top:8px;font-size:var(--fs-1);color:#3a4048">by: <span onclick="cwSetAdoptMode(\'reference\')" style="cursor:pointer;font-weight:700;padding:2px 9px;border-radius:12px;border:1px solid ' + (mode === 'reference' ? '#2c7a43' : 'var(--line)') + ';color:' + (mode === 'reference' ? '#fff' : 'var(--grey)') + ';background:' + (mode === 'reference' ? '#2c7a43' : '#fff') + '">reference</span> <span onclick="cwSetAdoptMode(\'value\')" style="cursor:pointer;font-weight:700;padding:2px 9px;border-radius:12px;border:1px solid ' + (mode === 'value' ? '#2c5aa0' : 'var(--line)') + ';color:' + (mode === 'value' ? '#fff' : 'var(--grey)') + ';background:' + (mode === 'value' ? '#2c5aa0' : '#fff') + '">value</span></div>' : '';
  var products = (w.built && w.built.finishes) ? '<div style="margin-top:12px;display:flex;align-items:center;gap:8px"><span style="font-size:var(--fs-1);font-weight:800;color:#6a44a8;letter-spacing:.05em">PRODUCTS · ' + w.built.finishes.length + '</span><span style="font-size:var(--fs-1);color:var(--grey)">tick to sell · click to inspect</span><span onclick="cwChooseAll(true)" style="cursor:pointer;font-size:var(--fs-1);color:var(--blue);margin-left:auto">all</span><span style="color:#c8d0d9">·</span><span onclick="cwChooseAll(false)" style="cursor:pointer;font-size:var(--fs-1);color:var(--blue)">none</span></div>' + w.built.finishes.map(function(it){ return _cwProductCard(w, it); }).join('') : '';
  return '<div style="font-size:var(--fs-2);color:#3a4048;margin-bottom:8px">Pick a <b>blueprint</b> — a ready, structured catalogue of this sort. Its <b>products</b> list here; tick the ones you sell, click one to see its field values on the left. <b>No blueprint? Skip.</b></div>' + picker + rights + modeToggle + products;
}
function _cwStep3(w){
  var fields = (w.fieldSel || []).filter(function(f){ return f.on; });
  var systems = ['—', 'ERP', 'Tally', 'SAP', 'Other'];
  w.erpMap = w.erpMap || {};
  var mapped = Object.keys(w.erpMap).filter(function(k){ return w.erpMap[k] && w.erpMap[k].system && w.erpMap[k].system !== '—'; }).length;
  var rows = fields.map(function(f){ var m = w.erpMap[f.name] || {}; var sys = m.system || '—'; var esn = f.name.replace(/'/g, "\\'");
    var sysSel = '<select onchange="cwSetMapSys(\'' + esn + '\',this.value)" style="font-size:var(--fs-1);padding:4px;border:1px solid var(--line);border-radius:6px">' + systems.map(function(s){ return '<option' + (sys === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>';
    var ref = sys !== '—' ? '<input value="' + esc(m.ref || '') + '" oninput="cwSetMapRef(\'' + esn + '\',this.value)" placeholder="field / code in ' + esc(sys) + '" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px">' : '<span style="font-size:var(--fs-1);color:var(--grey);flex:1">' + (f._bp ? '📎 from blueprint' : 'not mapped') + '</span>';
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--line)"><span style="flex:0 0 138px;font-size:11.5px;color:#3a4048">' + esc(f.name) + (f._bp ? ' <span style="color:#6a44a8;font-size:var(--fs-1)">📎</span>' : '') + '</span>' + sysSel + ref + '</div>';
  }).join('');
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">Map fields to your <b>own systems (ERP / Tally / SAP)</b> so they sync from there. These <b>mapping rules are saved with the catalogue design</b> and stay for each selected item. <b>Nothing from ERP? Skip.</b></div>' + rows + (mapped ? '<div style="font-size:var(--fs-1);color:#b07b1e;margin-top:8px">🔗 ' + mapped + ' field(s) mapped to your systems — saved as references with the design.</div>' : '');
}
function _cwStep4(w){
  var mode = w.bulkMode || 'csv';
  var seg = function(m, l){ var on = mode === m; return '<span onclick="cwBulkMode(\'' + m + '\')" style="cursor:pointer;font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:13px;border:1px solid ' + (on ? '#2c5aa0' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--grey)') + ';background:' + (on ? '#2c5aa0' : '#fff') + '">' + l + '</span>'; };
  var bar = '<div style="display:flex;gap:5px;margin-bottom:12px;flex-wrap:wrap">' + seg('csv', '📄 List (CSV/Excel)') + seg('few', '✍ Type a few') + seg('photos', '📷 Photos only') + '</div>';
  var body;
  if (mode === 'csv') {
    var n = (w.manualItems || []).filter(function(i){ return i._src === 'csv'; }).length;
    body = '<div style="font-size:var(--fs-2);color:#3a4048;margin-bottom:8px">Have a list? <b>Export to CSV from Excel / Tally</b> and paste it (first row = column names). We map columns to your fields — no typing.</div>'
      + '<textarea id="cw_bulk_csv" placeholder="name,price,pack_size,hsn\nRoyale Matt,520,4,3209\nRoyale Shyne,610,4,3209" rows="5" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:12px;font-family:monospace;resize:vertical"></textarea>'
      + '<button class="pri" onclick="cwImportCSV()" style="margin-top:8px;padding:8px 15px">Import rows</button>'
      + (n ? '<div style="margin-top:8px;font-size:11.5px;color:#2c7a43">✓ ' + n + ' item(s) imported from CSV — they\'ll be in your catalogue.</div>' : '')
      + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;font-style:italic">Excel? Save-as CSV. Hundreds of rows work in one paste.</div>';
  } else if (mode === 'few') {
    var rem = _cwRemaining(w).filter(function(r){ return r.leg !== 'compute'; });
    body = '<div style="font-size:var(--fs-2);color:#3a4048;margin-bottom:8px">Just a few? Fill the remaining fields by hand (or use ＋ Add item on the finished catalogue).</div>'
      + (rem.length ? rem.map(function(r){ return '<div style="display:flex;align-items:center;gap:9px;padding:4px 0"><span style="font-size:12px;color:var(--grey);min-width:150px">' + esc(r.name) + '</span><input value="' + esc(w.manual[r.name] || '') + '" oninput="cwSetManual(\'' + r.name + '\',this.value)" placeholder="value" style="flex:1;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px"></div>'; }).join('') : '<div style="font-size:12px;color:#2c7a43">Nothing left — the blueprint / ERP covered it.</div>');
  } else {
    var ph = w.photos || []; var committed = (w.manualItems || []).filter(function(i){ return i._src === 'capture'; }).length;
    body = '<div style="font-size:var(--fs-2);color:#3a4048;margin-bottom:8px">Only have <b>photos or product labels</b>? Add the pictures — each becomes an item. You confirm the name &amp; price (the same human-confirm step the <b>Capture</b> connector uses).</div>'
      + '<input id="cw_photo_input" type="file" accept="image/*" multiple style="display:none" onchange="cwPhotoPick(this)">'
      + '<button class="pri" onclick="cwPhotoBtn()" style="padding:8px 15px">📷 Add photos</button>'
      /**
       * ⚠️ READING IS A SEPARATE, DELIBERATE PRESS. It is not folded into "Add photos" because it COSTS — a vision
       * call per batch, on a shared key, for someone who is cash-light. An automatic read on every pick would spend
       * on photos the owner only meant to attach. So: add freely, read when you choose.
       */
      + (ph.length ? '<button data-testid="cw-photo-read" onclick="cwPhotosRead()" ' + (w._phBusy ? 'disabled ' : '')
          + 'style="margin-left:8px;padding:8px 15px;border:1px solid #6d5bd0;border-radius:9px;background:var(--card);color:#6d5bd0;font-weight:600;cursor:pointer">'
          + (w._phBusy ? '✨ Reading…' : '✨ Read the labels') + '</button>' : '')
      + (w._phErr ? '<div style="margin-top:8px;background:#fbeceb;border:1px solid #f0c9c6;border-radius:9px;padding:8px 11px;font-size:12px;color:var(--disp)">' + esc(w._phErr) + '</div>' : '')
      + (w._phNote ? '<div style="margin-top:8px;background:#f7f6fd;border:1px solid #e4dff6;border-radius:9px;padding:8px 11px;font-size:12px;color:#4a3f7a">' + esc(w._phNote) + '</div>' : '')
      + (ph.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;margin-top:12px">'
          + ph.map(function(p){ return '<div style="border:1px solid var(--line);border-radius:9px;padding:8px;background:var(--card)">'
            + '<div style="height:88px;background:#f4f6f8 center/cover no-repeat;background-image:url(' + p.url + ');border-radius:6px"></div>'
            /**
             * ⚠️ A PROPOSAL MUST NOT LOOK LIKE SOMETHING YOU TYPED. An AI-filled name and price get a purple frame
             * and a "proposed" tag, and the tag CLEARS the moment the owner edits the field — because at that point
             * it is theirs, not the model's. Without that distinction someone confirming a screenful of cards
             * cannot tell which values they actually checked.
             */
            + (p._ai ? '<div style="margin-top:6px;font-size:var(--fs-1);font-weight:800;color:#6d5bd0;background:#f0ecfb;border-radius:5px;padding:1px 6px;display:inline-block">✨ proposed — check it</div>' : '')
            + '<input value="' + esc(p.name || '') + '" oninput="cwSetPhotoField(\'' + p.id + '\',\'name\',this.value)" placeholder="item name" style="width:100%;box-sizing:border-box;margin-top:6px;padding:5px 7px;border:1px solid ' + (p._ai ? '#c9bdf0' : 'var(--line)') + ';border-radius:6px;font-size:11.5px">'
            + '<div style="display:flex;gap:5px;margin-top:5px;align-items:center"><span style="font-size:var(--fs-1);color:var(--grey)">' + esc(_catfCcy()) + '</span><input type="number" value="' + (p.price != null ? p.price : '') + '" oninput="cwSetPhotoField(\'' + p.id + '\',\'price\',this.value)" placeholder="price" style="flex:1;min-width:0;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-size:11.5px"><span onclick="cwPhotoRemove(\'' + p.id + '\')" style="cursor:pointer;color:#b23;font-size:15px;line-height:1" title="remove">×</span></div>'
            + '</div>'; }).join('') + '</div>'
          + '<button onclick="cwPhotosCommit()" style="margin-top:10px;padding:8px 15px;border:1px solid #2c7a43;border-radius:9px;background:var(--card);color:#2c7a43;font-weight:600">✓ Add ' + ph.length + ' photo' + (ph.length > 1 ? 's' : '') + ' to catalogue</button>'
          + (committed ? '<div style="margin-top:7px;font-size:11.5px;color:#2c7a43">✓ ' + committed + ' photo item(s) in your catalogue.</div>' : '')
        : '')
      /* ⚠️ This line used to say the co-assist was "text-only today". It is not, as of b127 — and a footnote that
         still says a feature is missing while the button for it sits above is worse than no footnote. */
      + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:12px;font-style:italic">Photos are downscaled and stored on the item. <b>✨ Read the labels</b> asks the co-assist to read what it can SEE into the cards — always a <b>proposal you check</b>, never a value it commits, and it fills only empty fields so anything you typed stays yours.</div>';
  }
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">How do you have your items? Don\'t type hundreds — bring a <b>list</b> (CSV/Excel) or <b>photos</b>.</div>' + bar + body;
}
function _cwStep5(w){
  // "Information only" is a listing — there is nothing to order, so there is no price to collect.
  // the PAYLOAD pipeline receives declared data, not a purchase — there is nothing to price.
  if (CATF_PIPELINE[_cwMethod(w)] === 'payload') {
    var _mp = CATF_METHODS.filter(function(m){ return m.k === _cwMethod(w); })[0] || {};
    return '<div style="font-size:13px;color:#3a4048">This catalogue receives <b>' + esc(_mp.receives || 'data') + '</b> — nothing is bought, so no prices are collected. Change <b>How customers order</b> in step 1 if you want to take orders.</div>';
  }
  var pk = Object.keys(w.erpMap || {}).filter(function(k){ return /price|rate|mrp/i.test(k) && w.erpMap[k] && w.erpMap[k].system && w.erpMap[k].system !== '—'; })[0];
  if (pk) return '<div style="font-size:13px;color:#3a4048">Price comes from your <b>' + esc(w.erpMap[pk].system) + '</b> (' + esc(w.erpMap[pk].ref || 'mapped') + ') — nothing to set here.</div>';
  var items = (w.built && w.built.finishes || []).filter(function(it){ return w.chosen[it.name] !== false; });
  if (!items.length) items = [{ name: (CATF_KB[w.vertical] && CATF_KB[w.vertical].product) || 'Item' }];
  // Step-1 units are the catalogue's ALLOWED SET; each item picks its own from it (Tomato kg · Egg count · Milk litre).
  var units = _cwUnitSet(w);
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">Set your <b>price</b> per item (' + esc(_catfCcy()) + ')' + (units.length > 1 ? ' and the <b>unit</b> it sells by' : '') + '. You can change these anytime later.</div>'
    + items.map(function(it){ var nm = esc(it.name).replace(/'/g, "\\'");
        return '<div style="display:flex;align-items:center;gap:9px;padding:6px 10px;border:1px solid var(--line);border-radius:9px;margin-top:5px;background:var(--card)"><span style="font-weight:600;font-size:var(--fs-2);flex:1">' + esc(it.name) + '</span><span style="color:var(--grey);font-size:var(--fs-1)">' + esc(_catfCcy()) + '</span>'
        + '<input type="number" value="' + (w.prices[it.name] != null ? w.prices[it.name] : '') + '" oninput="cwSetPrice(\'' + nm + '\',this.value)" placeholder="price" style="width:92px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px">'
        + _cwUnitSelect(units, _cwItemUnit(w, it), 'cwSetItemUnit(\'' + nm + '\',this.value)') + '</div>'; }).join('');
}
// the allowed unit set (step 1) + the item's own choice from it, defaulting to the first.
function _cwUnitSet(w){ return (w.units && w.units.length) ? w.units.slice() : [(CATF_KB[w.vertical] && CATF_KB[w.vertical].baseUnit) || 'unit']; }
function _cwItemUnit(w, it){ var s = _cwUnitSet(w); var u = (w.itemUnits || {})[it.name]; return (u && s.indexOf(u) >= 0) ? u : s[0]; }
function _cwUnitSelect(units, sel, onchange){
  return '<select data-testid="cw-item-unit" onchange="' + onchange + '" title="unit this item sells by" style="padding:5px 6px;border:1px solid var(--line);border-radius:6px;font-size:12px;background:var(--card);color:#3a4048">'
    + units.map(function(u){ return '<option value="' + esc(u) + '"' + (u === sel ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select>';
}
function cwSetItemUnit(name, u){ UI.cw.itemUnits = UI.cw.itemUnits || {}; UI.cw.itemUnits[name] = u; }
function _cwStep6(w){
  var priced = Object.keys(w.prices).filter(function(k){ return w.prices[k] != null && w.prices[k] !== ''; }).length;
  var _m = CATF_METHODS.filter(function(m){ return m.k === _cwMethod(w); })[0] || CATF_METHODS[0];
  return '<div style="font-size:13px;color:#3a4048;margin-bottom:10px">Set <b>tax</b>, then go live.</div>'
    + '<div style="display:flex;gap:8px;align-items:center"><input value="' + esc(w.tax.label || 'GST') + '" oninput="cwSetTax(\'label\',this.value)" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px"><input type="number" value="' + esc(w.tax.rate || '') + '" oninput="cwSetTax(\'rate\',this.value)" placeholder="18" style="width:70px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px"><span style="font-size:12px;color:var(--grey)">%</span></div>'
    + '<div style="margin-top:12px;padding:9px 12px;border:1px solid #cfe0f4;border-radius:9px;background:#eef4fc;font-size:11.5px;color:#2c5aa0">Orders arrive as <b>' + esc(_m.label) + '</b> — you receive <b>' + esc(_m.receives) + '</b>.</div>'
    + '<div style="margin-top:10px;padding:11px 13px;border:1px solid #cfe6cf;border-radius:9px;background:#eef7ee;font-size:12px;color:#2e7a45">On finish: your entity <b>adopts</b> the blueprint (reference) + your <b>' + priced + ' price(s)</b>' + (w.source ? '' : ' — <i>no blueprint, so it saves your manual items</i>') + '. It goes <b>live</b> on your storefront. Half-filled is fine — you can add the rest anytime.</div>';
}
/* wizard actions */
function cwGo(n){ if (n <= UI.cw.step || n === UI.cw.step + 1) { UI.cw.step = n; renderApp(); } }
function cwNext(){ var w = UI.cw; if (w.step === 1 && !w.vertical) { if (typeof toast === 'function') toast('Pick a vertical first.'); return; } if (w.step < 6) w.step++; renderApp(); }
function cwBack(){ if (UI.cw.step > 1) UI.cw.step--; renderApp(); }
function cwCancel(){ UI.cw = null; renderApp(); }
function cwSetBpQuery(v){ UI.cw.bpQuery = v; renderApp(); var el = document.getElementById('cw_bp_search'); if (el) { el.focus(); var n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) {} } }
function cwToggleBpAll(){ UI.cw.bpAll = !UI.cw.bpAll; renderApp(); }
function cwPickSource(key){ var w = UI.cw; w.source = key; w.built = null; if (!key) { renderApp(); return; } if (typeof toast === 'function') toast('Loading blueprint…'); api('catalogueStruct', { body: { source: key } }).then(function(r){ w.built = r; w.chosen = {}; w.sel = null; w.itemUnits = w.itemUnits || {}; (r.finishes || []).forEach(function(it){ w.chosen[it.name] = true; var c = it.commercials || {};
      var pv = (c.price != null && c.price !== '') ? c.price : c.price_per_litre;                 // generic {price,unit}, falling back to the pre-generic paint shape
      if (pv != null) w.prices[it.name] = pv;
      var u = c.unit || it.unit; if (u) w.itemUnits[it.name] = u; }); _cwMergeBpFields(w); renderApp(); }).catch(function(e){ if (typeof toast === 'function') toast('Load failed: ' + ((e && e.message) || '')); }); }
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
function cwSetManual(f, v){ UI.cw.manual[f] = v; }
function cwBulkMode(m){ UI.cw.bulkMode = m; renderApp(); }
function cwImportCSV(){
  var w = UI.cw; var text = val('cw_bulk_csv') || ''; var p = _catfParseCSV(text);
  if (!p.headers.length) { if (typeof toast === 'function') toast('Paste some CSV first.'); return; }
  var idx = function(re){ for (var i = 0; i < p.headers.length; i++) if (re.test(p.headers[i])) return i; return -1; };
  var nameIdx = idx(/name|item|product|title/i); if (nameIdx < 0) nameIdx = 0;
  var priceIdx = idx(/price|rate|mrp|cost/i);
  w.manualItems = (w.manualItems || []).filter(function(i){ return i._src !== 'csv'; });
  p.rows.forEach(function(r){ if (!r[nameIdx]) return; var it = { _src: 'csv', product: r[nameIdx] }; p.headers.forEach(function(h, i){ if (i !== nameIdx && r[i] != null && r[i] !== '') it[h] = r[i]; }); if (priceIdx >= 0) { var pv = parseFloat(r[priceIdx]); if (!isNaN(pv)) it.price = pv; } w.manualItems.push(it); });
  if (typeof toast === 'function') toast(w.manualItems.filter(function(i){ return i._src === 'csv'; }).length + ' items imported'); renderApp();
}
// ── Photos → catalogue items (reuses the item pipeline; Capture's human-confirm gate kept: owner sets name/price) ──
var _cwPhotoSeq = 0;
function cwPhotoBtn(){ var el = document.getElementById('cw_photo_input'); if (el) el.click(); }
function _cwDownscale(dataUrl, maxPx, cb){ try { var img = new Image(); img.onload = function(){ var iw = img.width || 1, ih = img.height || 1; var s = Math.min(1, maxPx / Math.max(iw, ih)); var cw = Math.max(1, Math.round(iw * s)), ch = Math.max(1, Math.round(ih * s)); var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.getContext('2d').drawImage(img, 0, 0, cw, ch); try { cb(cv.toDataURL('image/jpeg', 0.72)); } catch (e) { cb(dataUrl); } }; img.onerror = function(){ cb(dataUrl); }; img.src = dataUrl; } catch (e) { cb(dataUrl); } }
function cwPhotoPick(input){ var files = (input && input.files) ? Array.prototype.slice.call(input.files) : []; if (!files.length) return; var w = UI.cw; w.photos = w.photos || []; var pending = files.length;
  var done = function(){ pending--; if (pending <= 0) renderApp(); };
  files.forEach(function(file){ if (!/^image\//.test(file.type || '')) { done(); return; } var rd = new FileReader(); rd.onload = function(){ _cwDownscale(rd.result, 360, function(small){ w.photos.push({ id: 'ph' + (++_cwPhotoSeq), name: String(file.name || 'Item').replace(/\.[^.]+$/, ''), price: '', url: small }); done(); }); }; rd.onerror = done; rd.readAsDataURL(file); });
  input.value = '';
}
function cwSetPhotoField(id, field, v){
  (UI.cw.photos || []).forEach(function(p){
    if (p.id !== id) return;
    p[field] = v;
    // ⚠️ EDITING CLEARS "proposed". The value is now the owner's, not the model's, and the card must stop
    // implying otherwise — provenance that survives a human overwriting it is a lie about who said what.
    p._ai = false;
  });
}
/**
 * cwPhotosRead — ask the co-assist to read the labels, and PRE-FILL the same cards. (SPEC-catalogue-photo-vision.md)
 *
 * ⚠️ IT PROPOSES INTO THE EXISTING CARDS AND COMMITS NOTHING. cwPhotosCommit is untouched: the owner still edits
 * and still presses "Add to catalogue". A read that wrote straight into the catalogue would put a model's guess
 * about a price into a record that other people trade against.
 *
 * ⚠️ IT NEVER OVERWRITES SOMETHING YOU TYPED. A card you have already named keeps your name; the proposal only
 * fills what is still empty. Your work outranks a suggestion.
 */
async function cwPhotosRead(){
  var w = UI.cw, ph = (w.photos || []).filter(function(p){ return !!p.url; });
  if (!ph.length) return;
  w._phErr = null; w._phNote = null; w._phBusy = true; renderApp();
  /* The engine caps at 4 per call, so batch — and SAY how many are going, because a silent partial read looks
     like the model simply missed the rest. */
  var BATCH = 4, filled = 0, read = 0;
  try {
    for (var i = 0; i < ph.length; i += BATCH) {
      var slice = ph.slice(i, i + BATCH);
      var images = slice.map(function(p){
        var m = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(p.url || '');
        return m ? { mime: m[1], b64: m[2] } : null;
      }).filter(Boolean);
      if (!images.length) continue;
      var out = await api('photoExtract', { body: { images: images } });
      var items = (out && out.data && out.data.items) || [];
      read += images.length;
      /* ⚠️ POSITIONAL, and that is a real limit worth stating: the model returns items in the order it read them,
         which for one-product-per-photo lines up and for a price-list photo does not. So a batch that returns a
         different count than it was given is reported rather than smeared across the cards. */
      if (items.length === slice.length) {
        slice.forEach(function(p, k){
          var it = items[k] || {};
          if (!String(p.name || '').trim() && it.name) { p.name = it.name; p._ai = true; filled++; }
          if ((p.price === '' || p.price == null) && it.price) { p.price = it.price; p._ai = true; }
        });
      } else if (items.length) {
        w._phNote = 'Read ' + items.length + ' item(s) from ' + slice.length + ' photo(s) — the counts differ, so nothing was filled in automatically for that batch. A photo of a price LIST holds several items; these cards are one item each.';
      }
    }
    if (!w._phNote) {
      w._phNote = filled
        ? 'Read ' + read + ' photo(s) — ' + filled + ' field(s) proposed. Check each one: they are the model\'s reading, not yours, until you edit or confirm them.'
        : 'Read ' + read + ' photo(s) and could not make anything out. Nothing was filled in — type the details instead.';
    }
  } catch (e) {
    var m = (e && e.message) || '';
    /* ⚠️ AI OFF IS NOT A BROKEN SCREEN (spec case 8). The manual flow still works and must be seen to. */
    w._phErr = /not connected|503/i.test(m)
      ? 'The co-assist is not connected on this environment, so labels cannot be read automatically. Everything else still works — set the name and price yourself.'
      : (m || 'Could not read the photos.');
  }
  w._phBusy = false; renderApp();
}
function cwPhotoRemove(id){ var w = UI.cw; w.photos = (w.photos || []).filter(function(p){ return p.id !== id; }); renderApp(); }
function cwPhotosCommit(){ var w = UI.cw; var ph = w.photos || []; if (!ph.length) { if (typeof toast === 'function') toast('Add some photos first.'); return; }
  w.manualItems = (w.manualItems || []).filter(function(i){ return i._src !== 'capture'; });
  var seen = {};   // de-dupe names within the batch so two photos never collide on one SKU and drop an image
  ph.forEach(function(p, i){ var base = (p.name && p.name.trim()) || ('Photo ' + (i + 1)); var nm = base; if (seen[base]) { nm = base + ' (' + (seen[base] + 1) + ')'; seen[base]++; } else seen[base] = 1;
    var it = { _src: 'capture', product: nm, _photo: p.url, _media: true }; var pv = parseFloat(p.price); if (!isNaN(pv)) it.price = pv; w.manualItems.push(it); });
  if (typeof toast === 'function') toast(ph.length + ' photo item(s) added'); renderApp();
}
function cwSetPrice(name, v){ UI.cw.prices[name] = v; }
function cwSetTax(k, v){ UI.cw.tax[k] = v; }
// Golden item → catalogue_items item_data. Keeps the whole record (sku/hsn/_src/_lineage…) in the JSONB; sets the
// name/unit the classic catalogue screen reads (pName/pUnit/pCode). Drops the client-only _pid.
function _catfProductData(it, unit){ var d = {};
  // business fields only — strip ALL underscore meta (_photo base64, _lineage, _src, _media, _pid): those are
  // client/prototype metadata, not catalogue columns (a big base64 _photo would also bloat/break the write).
  Object.keys(it).forEach(function(k){ if (k.charAt(0) !== '_' && typeof it[k] !== 'object') d[k] = it[k]; });
  d.name = it.product || it.name || 'Item'; if (!d.unit) d.unit = unit || 'unit'; if (!d.code && (it.sku || it.hsn)) d.code = it.sku || it.hsn; return d; }
function cwFinish(){
  var w = UI.cw;
  var chosenFinishes = (w.built && w.built.finishes || []).filter(function(it){ return w.chosen[it.name] !== false; });
  var units = _cwUnitSet(w);
  // GENERIC commercials: {price, unit} per item — not price_per_litre. The unit is the item's own pick from the
  // catalogue's allowed set, so one catalogue can hold Tomato/kg + Egg/count. (Readers still fall back to
  // price_per_litre so adoptions made before this keep rendering.)
  var com = {}; chosenFinishes.forEach(function(it){ var p = w.prices[it.name]; if (p != null && p !== '') com[it.name] = { price: Number(p), unit: _cwItemUnit(w, it) }; });
  // Build the golden records (MDM) — one item per SKU via RFC 7386 merge-patch.
  var acc = []; var srcMode = (w.adoptMode === 'value' ? 'value' : 'reference');
  chosenFinishes.forEach(function(it){ var pr = w.prices[it.name]; var inc = { sku: it.name, product: it.name, texture_family: it.texture_family, sheen: it.sheen, region: it.region, unit: _cwItemUnit(w, it), _media: true }; if (pr != null && pr !== '') inc.price = Number(pr); CBCatalogue.upsertItem(acc, inc, { source: srcMode }); });
  (w.manualItems || []).forEach(function(it){ var inc = {}; Object.keys(it).forEach(function(k){ if (k !== '_src' && it[k] != null && it[k] !== '') inc[k] = it[k]; }); if (!inc.sku && inc.product) inc.sku = inc.product; CBCatalogue.upsertItem(acc, inc, { source: it._src === 'csv' ? 'csv' : it._src === 'capture' ? 'capture' : 'manual' }); });
  if (!acc.length) { var pr0 = w.prices[Object.keys(w.prices)[0]]; var one = { product: (w.manual.name || (CATF_KB[w.vertical] && CATF_KB[w.vertical].product) || 'Item') }; if (pr0 != null && pr0 !== '') one.price = Number(pr0); CBCatalogue.upsertItem(acc, one, { source: 'manual' }); }

  var toLive = function(){
    // the DECLARATION the storefront reads. `method` stays for back-compat; `order_input` is the contract.
    UI.catf = { method: _cwMethod(w), order_input: { preset: _cwMethod(w), pipeline: CATF_PIPELINE[_cwMethod(w)] || 'commerce' },
      units: units, vertical: w.vertical || '', facets: { variants: true, media: !!w.source, sourcing: Object.keys(w.erpMap || {}).length > 0 }, adoptedFrom: (w.built && w.built.title) || '', _source: w.source || '', tax: w.tax, erpMap: w.erpMap,
      catalogue: CBCatalogue.ensure({ story: w.purpose || '', product: (w.built && w.built.title) || (CATF_KB[w.vertical] && CATF_KB[w.vertical].product) || 'Catalogue', baseUnit: units[0], altUnits: units.slice(1) }),
      items: acc };
    _catfSave(); UI.cw = null; if (typeof toast === 'function') toast('Catalogue is live ✓'); renderApp();
  };

  // Persist OWNED, PRICED items into the REAL catalogue (catalogue_items via prodAdd — the same store the classic
  // Catalogue screen manages, WITH RLS). By-REFERENCE items are NOT copied (adoption store). Items with no price yet
  // stay as face drafts (the API requires a price to go live) — the face flags them "need a price".
  var owned = acc.filter(function(it){ return it._src !== 'reference'; });
  var priced = owned.filter(function(it){ return it.price != null && it.price !== ''; });
  var unpriced = owned.length - priced.length;
  var persistProducts = function(next){
    if (!(typeof api === 'function') || !priced.length) { if (unpriced && typeof toast === 'function') toast(unpriced + ' item(s) need a price before they go live.'); return next(); }
    if (typeof toast === 'function') toast('Adding ' + priced.length + ' item(s) to your Catalogue…');
    var i = 0, ok = 0;
    var step = function(){
      if (i >= priced.length) { if (typeof toast === 'function') toast(ok + ' item(s) added to Catalogue' + (unpriced ? ' · ' + unpriced + ' still need a price' : '') + ' ✓'); return next(); }
      var it = priced[i++];
      api('prodAdd', { body: { item_data: _catfProductData(it, units[0]) } })
        .then(function(r){ var id = r && r.item && (r.item.item_id || r.item.id); if (id) it._pid = id; ok++; step(); })
        .catch(function(){ step(); });   // one failure shouldn't abort the batch; the item still shows in the face
    };
    step();
  };

  // Reference vs value are MUTUALLY EXCLUSIVE (no double-create):
  //   • reference (default) → catalogueAdopt only — shared items shown REFERENCED, your price overlaid. NOT copied to products.
  //   • by value (copy)     → prodAdd only — the items become your OWN products. NOT referenced.
  // (owned already excludes _src==='reference', so reference-mode blueprint items never reach prodAdd.)
  var isValue = (w.adoptMode === 'value');
  var afterAdopt = function(){ persistProducts(toLive); };
  if (w.source && Object.keys(com).length && !isValue && typeof api === 'function') {
    /**
     * ⚠️ ASK BEFORE ADOPTING, AND SAY WHAT IS NOT PRICED.
     *
     * Athi, 2026-08-06: *"it quickly adopts, no confirmation messages etc. I have added price for two items, but
     * not for others."*
     *
     * Both halves were real. Adoption is a governance act — you take on another brand's catalogue by reference and
     * it appears in your shop — and it happened on a click with no statement of what was about to occur.
     *
     * And the second half was worse: the unpriced ones were LISTED. Reproduced on a throwaway shop — six finishes
     * adopted, two priced, and the storefront advertised all six. The four without a price showed a dash and were
     * refused at the till. The server now hides an unpriced line from a shop that shows prices; this tells the
     * owner BEFORE they get there, because a hidden product they meant to sell is its own kind of surprise.
     */
    var picked = (w.chosen ? Object.keys(w.chosen).filter(function(k){ return w.chosen[k] !== false; }) : []);
    var priced = Object.keys(com).filter(function(k){
      var c = com[k] || {}; var p = c.price; var a = (p && typeof p === 'object') ? p.amount : p;
      return a !== undefined && a !== null && a !== '' && isFinite(Number(a));
    });
    var noPrice = Math.max(0, picked.length - priced.length);
    var li = function(t){ return '<div style="display:flex;gap:7px;margin-top:5px"><span>•</span><span>' + t + '</span></div>'; };
    var msg = li('<b>' + priced.length + '</b> item' + (priced.length===1?'':'s') + ' with your price — these <b>go live</b>')
      + (noPrice ? li('<b>' + noPrice + '</b> item' + (noPrice===1?'':'s') + ' with <b>no price</b> — adopted, but <b>not shown in your shop</b> until you price them') : '')
      + '<div style="margin-top:9px">The brand keeps its names, images and colours. <b>You own only your prices.</b></div>';
    /* ⚠️ afterAdopt RUNS ON EVERY PATH — it persists the OWNED items, which have nothing to do with whether you
       adopt the brand by reference. Saying no to the reference adopt must not silently drop the items you typed
       yourself. Hence the 6th argument: Cancel, Escape and the backdrop all reach it. */
    confirmAsk('Adopt “' + esc((w.built && w.built.title) || w.source) + '” into your catalogue?', msg, 'Adopt',
      function(){
        if (typeof toast === 'function') toast('Adopting by reference…');
        api('catalogueAdopt', { body: { source: w.source, commercials: com } }).then(afterAdopt).catch(function(e){ if (typeof toast === 'function') toast('Reference adopt failed: ' + ((e && e.message) || '')); afterAdopt(); });
      }, false, afterAdopt);
  } else { afterAdopt(); }
}

function _catfSettingsNote(){ return 'Currency <b>' + esc(_catfCcy()) + '</b> · country <b>' + esc(_catfCountry()) + '</b> — from <b>Settings</b> (set at registration), inherited here.'; }

/* ===== two-panel SETUP: left = choose/feed · right = live "how it looks" ===== */

/* right panel: how the (pending) catalogue will look */

/* TAB 1 — what the catalogue holds (the structure) */

/* TAB 3 — the catalogue as STANDARD JSON Schema (what an AI emits; RJSF/JSON Forms/json-editor render it). Adopt, don't reinvent. */
function _catfMethodControl(method, price){
  var p = price != null && price !== '' ? _catfMoney(price) : _catfMoney(40);
  var btn = 'background:#2c5aa0;color:#fff;border-radius:5px;padding:3px 10px;font-size:var(--fs-1);font-weight:600';
  if (method === 'text') return '<span style="font-size:var(--fs-1);color:var(--grey)">information only</span>';
  if (method === 'cart') return '<span style="font-size:var(--fs-1);color:var(--grey)">Qty ▢ × ' + esc(p) + '</span> <span style="' + btn + '">Add</span>';
  if (method === 'range') return '<span style="font-size:var(--fs-1);color:var(--grey)">' + esc(_catfMoney(3200)) + ' – ' + esc(_catfMoney(3600)) + '</span> <span style="' + btn + '">Order</span>';
  if (method === 'qty') return '<span style="font-size:var(--fs-1);color:var(--grey)">Qty ▢</span> <span style="' + btn + '">Order</span>';
  return '<span style="font-size:var(--fs-1);color:var(--grey)">Qty ▢ · your price ▢</span> <span style="' + btn + '">Offer</span>';
}

/* TAB 2 — the customer front: the Amazon-style END-TO-END experience (browse → product → cart → order = chit) */
function _catfAppearsTab(f, c, facets){
  var rows = (f.sampleRows && f.sampleRows.length) ? f.sampleRows.slice(0, 3) : [{ name: c.product || 'Item', unit: c.baseUnit || '', price: 40, values: {} }];
  var visFields = (c.fields || []).slice(0, 4);
  var ccy = _catfCcy();
  var priceOf = function(r){ return (r.price != null && r.price !== '') ? r.price : 40; };
  var step = function(n, title, inner){ return '<div style="border:1px solid var(--line);border-radius:12px;background:var(--card);padding:11px 13px;margin-top:8px"><div style="font-size:var(--fs-1);font-weight:800;color:#2c5aa0;letter-spacing:.04em;margin-bottom:8px">' + n + ' · ' + title + '</div>' + inner + '</div>'; };
  var arrow = '<div style="text-align:center;color:#c8d0d9;font-size:15px;line-height:1.1">↓</div>';
  // 1 · browse (listing grid)
  var browse = '<div style="display:flex;gap:8px;flex-wrap:wrap">' + rows.map(function(r){ return '<div style="width:132px;border:1px solid var(--line);border-radius:9px;padding:8px 9px;background:var(--card)">' + (facets.media ? '<div style="height:46px;border-radius:6px;background:linear-gradient(135deg,#eef1f5,#dde3ea);margin-bottom:6px"></div>' : '') + '<div style="font-weight:600;font-size:11.5px;line-height:1.2">' + esc(r.name || 'item') + '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span style="font-weight:700;font-size:11.5px">' + esc(_catfMoney(priceOf(r))) + '</span><span style="background:#2c5aa0;color:#fff;border-radius:4px;padding:2px 7px;font-size:var(--fs-1);font-weight:600">' + (f.method === 'cart' ? 'Add' : 'View') + '</span></div></div>'; }).join('') + '</div>';
  // 2 · product detail
  var p0 = rows[0] || {};
  var spec = visFields.map(function(fl){ var v = (p0.values && p0.values[fl.name]) || _catfSampleVal(fl.name, 0); return '<div style="display:flex;justify-content:space-between;font-size:var(--fs-1);padding:2px 0;border-bottom:1px dashed var(--line)"><span style="color:var(--grey)">' + esc(fl.name) + '</span><span style="font-family:monospace">' + esc(v) + '</span></div>'; }).join('');
  var detail = '<div style="display:flex;gap:11px">' + (facets.media ? '<div style="width:86px;height:86px;border-radius:9px;background:linear-gradient(135deg,#eef1f5,#dde3ea);flex:none"></div>' : '') + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:var(--fs-3)">' + esc(p0.name || c.product || 'Item') + '</div><div style="font-weight:800;font-size:15px;margin-top:2px">' + esc(_catfMoney(priceOf(p0))) + (p0.unit ? ' <span style="font-size:var(--fs-1);color:var(--grey);font-weight:400">/ ' + esc(p0.unit) + '</span>' : '') + '</div>' + (spec ? '<div style="margin-top:8px">' + spec + '</div>' : '') + '<div style="margin-top:10px">' + _catfMethodControl(f.method, p0.price) + '</div></div></div>';
  // 3 · cart & checkout
  var qty = 3; var up = parseFloat(priceOf(p0)) || 40; var tot = f.method === 'cart' ? up * qty : up;
  var cart = '<div style="display:flex;justify-content:space-between;font-size:12px"><span>' + esc(p0.name || 'Item') + ' × ' + qty + '</span><span style="font-weight:600">' + esc(_catfMoney(tot)) + '</span></div><div style="display:flex;justify-content:space-between;margin-top:6px;border-top:1px solid var(--line);padding-top:6px"><span style="font-weight:700">Total (' + esc(ccy) + ')</span><span style="font-weight:800">' + esc(_catfMoney(tot)) + '</span></div><div style="text-align:right;margin-top:9px"><span style="background:#2c7a43;color:#fff;border-radius:6px;padding:5px 14px;font-size:11.5px;font-weight:600">Place order</span></div>';
  // 4 · order placed → the chit (final output, both sides keep a copy)
  var fieldLines = visFields.map(function(fl){ var v = (p0.values && p0.values[fl.name]) || _catfSampleVal(fl.name, 0); return '<div style="display:flex;justify-content:space-between;font-size:var(--fs-1);padding:1px 0"><span style="color:var(--grey)">' + esc(fl.name) + '</span><span style="font-family:monospace;color:var(--faint,#8a929e)">' + esc(v) + '</span></div>'; }).join('');
  var chit = '<div style="max-width:280px;margin:0 auto;border:1px solid var(--line);border-top:3px solid #2c5aa0;border-radius:9px;padding:11px 12px;background:#fbfdff"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;font-size:var(--fs-2)">' + esc(p0.name || 'Item') + '</span><span style="font-size:var(--fs-1);color:#2c7a43;font-weight:700">✓ placed</span></div><div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">Qty ' + qty + (f.method === 'cart' ? ' · ' + esc(_catfMoney(tot)) : '') + (p0.unit ? ' ' + esc(p0.unit) : '') + '</div>' + (fieldLines ? '<div style="margin-top:6px;border-top:1px dashed var(--line);padding-top:5px">' + fieldLines + '</div>' : '') + '<div style="border-top:1px dashed var(--line);margin-top:8px;padding-top:5px;font-size:var(--fs-1);color:var(--faint,#8a929e);font-family:monospace">🔒 sealed · arrives on the rail · both parties keep a copy</div></div>';
  return '<div style="font-size:var(--fs-1);font-weight:800;color:#2c7a43;letter-spacing:.05em">🛍 CUSTOMER EXPERIENCE — end to end</div>'
    + step('1', 'Browse the storefront', browse) + arrow
    + step('2', 'Open a product', detail) + arrow
    + step('3', 'Cart &amp; checkout', cart) + arrow
    + step('4', 'Order placed → the chit', chit)
    + '<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:8px">This is what your customer experiences — and the chit is what both sides keep.</div>';
}

/* the items under this face — each tagged by SOURCE (reference / manual / ERP). For referenced items the owner only sets price. */
function _catfSrcTag(src){ return src === 'reference' ? ['📎 by reference', '#6a44a8'] : src === 'value' ? ['📋 by value (copy)', '#2c5aa0'] : src === 'erp' ? ['🔗 from ERP', '#b07b1e'] : src === 'csv' ? ['📄 imported', '#2c7a43'] : src === 'capture' ? ['📷 photo', '#6a4fa0'] : ['✍ entered', '#2c7a43']; }
function _catfItemsHtml(f){
  var items = (f.items || []); if (!items.length) return '<div style="font-size:var(--fs-1);font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:18px">YOUR ITEMS · 0</div><div style="font-size:var(--fs-1);color:var(--grey);padding:4px 0">No items yet — adopt a source, add manually, or pull from ERP.</div>';
  var needPrice = items.filter(function(it){ return it.price == null || it.price === ''; }).length;
  var rows = items.map(function(it, i){
    var t = _catfSrcTag(it._src);
    var attrs = Object.keys(it).filter(function(k){ return k.charAt(0) !== '_' && ['product', 'name', 'price', 'unit', 'rate'].indexOf(k) < 0 && it[k] != null && it[k] !== '' && typeof it[k] !== 'object'; }).slice(0, 3).map(function(k){ return esc(k) + ': ' + esc(it[k]); }).join(' · ');
    var priceCell = (it.price != null && it.price !== '')
      ? '<span style="font-weight:700;font-size:12px">' + esc(_catfMoney(it.price)) + '</span> <span onclick="catfEditPrice(' + i + ')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-1)">edit</span>'
      : '<input type="number" placeholder="set price" onchange="catfSetItemPrice(' + i + ',this.value)" title="the ONLY thing you enter for a referenced item" style="width:92px;padding:4px 7px;border:1px solid #d98b84;border-radius:6px;font-size:12px;background:#fbeeec">';
    return '<div style="border:1px solid var(--line);border-radius:9px;padding:8px 11px;margin-top:5px;background:var(--card)"><div style="display:flex;align-items:center;gap:8px">'
      + ((it._photo || it.photo) ? '<span style="width:26px;height:26px;border-radius:5px;background:#f4f6f8 center/cover no-repeat;background-image:url(' + (it._photo || it.photo) + ');flex:none"></span>' : (it._media ? '<span style="width:22px;height:22px;border-radius:5px;background:linear-gradient(135deg,#eef1f5,#dde3ea);flex:none"></span>' : ''))
      + '<span style="font-weight:600;font-size:var(--fs-2)">' + esc(it.product || it.name || 'item') + '</span>'
      + '<span style="font-size:var(--fs-1);font-weight:700;color:' + t[1] + ';background:' + t[1] + '18;border-radius:4px;padding:1px 6px">' + t[0] + '</span>'
      + '<span style="margin-left:auto;display:flex;align-items:center;gap:6px">' + _catfUnitCell(f, it, i) + priceCell + '</span></div>'
      + (attrs ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">' + attrs + (it._src === 'reference' ? ' <span style="color:#6a44a8">· referenced, kept inside</span>' : '') + '</div>' : '') + '</div>';
  }).join('');
  return '<div style="font-size:var(--fs-1);font-weight:800;color:#2c7a43;letter-spacing:.05em;margin-top:18px">YOUR ITEMS · ' + items.length + (needPrice ? ' <span style="color:#a5382e;font-weight:600">· ' + needPrice + ' need a price</span>' : ' <span style="color:#2c7a43">· ready</span>') + '</div><div style="margin-top:4px">' + rows + '</div>';
}
// PER-ITEM UNIT on the face row: the catalogue's units are the allowed SET, each item picks its own from it.
// One unit → a plain label (nothing to choose); several → a dropdown.
function _catfUnitCell(f, it, i){
  var units = (f.units && f.units.length) ? f.units : []; if (!units.length) return '';
  var sel = (units.indexOf(it.unit) >= 0) ? it.unit : units[0];
  if (units.length === 1) return '<span style="font-size:var(--fs-1);color:var(--grey)">/ ' + esc(sel) + '</span>';
  return '<select data-testid="catf-item-unit" onchange="catfSetItemUnit(' + i + ',this.value)" title="unit this item sells by" style="padding:3px 5px;border:1px solid var(--line);border-radius:5px;font-size:var(--fs-1);background:var(--card);color:#3a4048">'
    + units.map(function(u){ return '<option value="' + esc(u) + '"' + (u === sel ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select>';
}
function catfSetItemUnit(i, u){ if (!UI.catf || !UI.catf.items || !UI.catf.items[i]) return; UI.catf.items[i].unit = u; _catfSave(); if (UI.catf._source) _catfRepublish(); renderApp(); }
function catfSetItemPrice(i, v){ if (!UI.catf || !UI.catf.items || !UI.catf.items[i]) return; var x = parseFloat(v); UI.catf.items[i].price = (v === '' || isNaN(x)) ? null : x; _catfSave(); if (UI.catf._source) _catfRepublish(); renderApp(); }
function _catfRepublish(){   // price change on a live (adopted) catalogue = CRUD → re-persist commercials via the real API
  if (!UI.catf || !UI.catf._source || typeof api !== 'function') return;
  var f = UI.catf; var units = (f.units && f.units.length) ? f.units : [];
  var com = {}; (f.items || []).forEach(function(it){ if (it.price != null && it.price !== '') com[it.product || it.name] = { price: Number(it.price), unit: it.unit || units[0] || '' }; });
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
      + '<div style="flex:1"><div style="font-weight:600;font-size:var(--fs-2);color:' + (on ? '#1c2128' : 'var(--grey)') + '">' + esc(x.label) + '</div><div style="font-size:var(--fs-1);color:var(--grey)">' + esc(x.hint) + '</div></div>'
      + '<span onclick="catfToggleFacet(\'' + x.k + '\')" style="cursor:pointer;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:14px;border:1px solid ' + (on ? '#2c7a43' : 'var(--line)') + ';color:' + (on ? '#fff' : 'var(--blue)') + ';background:' + (on ? '#2c7a43' : '#fff') + '">' + (on ? '✓ on' : '＋ add') + '</span></div>';
  }).join('');
  var inner = '<div style="max-width:660px">'
    + '<div style="display:flex;align-items:center;gap:10px"><div style="font-size:18px;font-weight:800">🗂️ Catalogue face</div>' + (f.adoptedFrom ? '<span style="font-size:var(--fs-1);font-weight:700;color:#2c5aa0;background:#eef2f7;border-radius:5px;padding:2px 8px">adopted · ' + esc(f.adoptedFrom) + '</span>' : '<span style="font-size:var(--fs-1);font-weight:700;color:#6a4fa0;background:#efeafa;border-radius:5px;padding:2px 8px">built from your data</span>') + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:4px">One face for the whole catalogue — every item conforms. ' + _catfSettingsNote() + '</div>'
    + '<label style="font-size:var(--fs-1);color:var(--grey);display:block;margin-top:14px">Purpose</label>'
    + '<textarea oninput="catfSetPurpose(this.value)" rows="2" style="width:100%;margin-top:4px;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:9px;font-size:13px;resize:vertical">' + esc(c.story || '') + '</textarea>'
    + '<label style="font-size:var(--fs-1);color:var(--grey);display:block;margin-top:12px">How the store sells <span style="color:var(--faint,#8a929e)">— one method for the whole catalogue</span></label>'
    + '<select onchange="catfSetMethod(this.value)" style="margin-top:4px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;font-size:13px">' + methOpts + '</select>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:3px">' + esc(methHint) + '</div>'
    + ((f.units && f.units.length) || (c.altUnits && c.altUnits.length) ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:10px">Sold by <span style="color:#1c2128;font-weight:600">' + esc((f.units && f.units.length) ? f.units.join(' · ') : [c.baseUnit].concat(c.altUnits || []).join(' · ')) + '</span> <span style="color:var(--faint,#8a929e)">— items may use any of these</span></div>' : '')
    + '<div style="font-size:var(--fs-1);font-weight:800;color:#2c5aa0;letter-spacing:.05em;margin-top:16px">DEEPEN THE CATALOGUE <span style="font-weight:500;color:var(--grey)">— add only what this business needs</span></div>'
    + '<div style="margin-top:6px">' + facetRows + '</div>'
    + _catfItemsHtml(f)
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:16px">Item data comes three ways — <b>📎 from the source</b> (owner sets price only) · <b>✍ entered</b> · <b>🔗 from ERP</b>:</div>'
    + '<div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">'
    + '<button class="pri" onclick="catfFillItem()" style="padding:9px 15px">＋ Add manually</button>'
    + '<button onclick="catfSyncERP()" style="padding:9px 15px;border:1px solid #b07b1e;border-radius:9px;background:var(--card);color:#b07b1e;font-weight:600">🔗 From ERP</button>'
    + '<button onclick="catfCustomerPreview()" style="padding:9px 15px;border:1px solid #2c7a43;border-radius:9px;background:var(--card);color:#2c7a43;font-weight:600">👁 Customer experience</button>'
    + '<button onclick="catfManage()" style="padding:9px 15px;border:1px solid #2c5aa0;border-radius:9px;background:var(--card);color:#2c5aa0;font-weight:600">🗂️ Manage in Catalogue</button>'
    + '<input id="catf_photo_input" type="file" accept="image/*" multiple style="display:none" onchange="catfAddPhotos(this)">'
    + '<button onclick="catfPhotoAttachBtn()" style="padding:9px 15px;border:1px solid #2c7a43;border-radius:9px;background:var(--card);color:#2c7a43;font-weight:600">📷 Add photos</button>'
    + '<button onclick="catfEnrichAI()" style="padding:9px 15px;border:1px solid #b07b1e;border-radius:9px;background:var(--card);color:#b07b1e;font-weight:600">✨ Enrich (AI)</button>'
    + '<button onclick="catfPublishBlueprint()" style="padding:9px 15px;border:1px solid #6a4fa0;border-radius:9px;background:var(--card);color:#6a4fa0;font-weight:600">📢 Publish as blueprint</button>'
    + '<button onclick="catfReset()" style="padding:9px 15px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--grey)">↺ Start over</button>'
    + '</div>'
    + '<div style="margin-top:14px;font-size:var(--fs-1);color:var(--grey)">Items are <b>golden records</b> — each source (blueprint · ERP · CSV · capture) merges into one item, keyed by SKU, edited via JSON Merge Patch. <span onclick="catfStandardsModal()" style="cursor:pointer;color:var(--blue);font-weight:600">📐 Built on open standards →</span></div>'
    + '</div>';
  return '<div style="flex:1;min-height:0;overflow-y:auto;padding:22px 20px">' + inner + '</div>';
}
