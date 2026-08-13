/* catalogue-model.js — THE canonical catalogue model (single source of truth).
 *
 * Framework-agnostic and DOM-free. Loaded as a plain <script> in the browser (attaches the
 * global `CBCatalogue`) AND require()-able in Node (module.exports). The UI (cap-network.js)
 * and any headless consumer (e.g. the EOQ compute→seal harness) MUST route the catalogue
 * shape, migration, and derivations through here — so there is exactly one definition.
 *
 * A catalogue draft (per node):
 *   { story, product, variants:[{name}], baseUnit, altUnits:[{unit,num,den}],
 *     refs:[{system,code}], bom:[{item,qty}], loadedBy,
 *     fields:[{name, leg, via, type}],           // leg ∈ system|customer|compute|cb ; via ∈ ERP|IoT|AI
 *     triggers:[{watch,op,value,action,target}], // the loop
 *     feedback:[{system,format,onRail}] }         // outbound adapter
 */
(function (root, factory) {
  var M = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;   // Node
  if (root) root.CBCatalogue = M;                                            // browser global
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---- vocabulary (the one place these live) ----
  var LEGS = [
    { k: 'system',   label: 'Fed by system',          short: 'System feed',   hint: 'already exists in ERP / IoT — sync it in',              col: ['#b07b1e', '#f6ecd8'] },
    { k: 'customer', label: 'Collected from customer', short: 'From customer', hint: 'known only at order time — capture it',                  col: ['#2b6f8f', '#dcecf3'] },
    { k: 'compute',  label: 'Computed by co-assist',   short: 'Computed',      hint: 'a co-assist (AI / ERP) computes it, the rail seals it',  col: ['#8a5cc4', '#efeafa'] },
    { k: 'cb',       label: 'Stored in CB',            short: 'Store in CB',   hint: 'has no home today — the gap CB fills',                   col: ['#2c7a43', '#e6f4ec'] },
  ];
  var TYPES = ['text', 'number', 'choice', 'range', 'date'];
  // Part C · standards — external classification schemes, always BY REFERENCE (link out, never mirror).
  var STD_SCHEMES = ['HS', 'GS1 GPC', 'Schema.org', 'UNSPSC', 'custom'];
  // Part D · pricing — where a price ORIGINATES (basis) and how it is HELD (by ref = loose/resolved at seal · by value = frozen).
  var PRICE_BASIS = ['global', 'system', 'user', 'manual'];   // global market stage · ERP/system · user choice at order · hand-entered
  var PRICE_BY = ['ref', 'value'];                            // ref → resolved from source at seal (loose) · value → frozen amount now
  function viaFor(leg) { return leg === 'compute' ? ['AI', 'ERP'] : ['ERP', 'IoT']; }

  // ---- THE MAXIMUM DATATYPE PALETTE ----
  // We cannot pre-design every catalogue. So the code fixes the GRAMMAR (the full set of primitives), and an AI
  // composes any catalogue from it in real time. This is that grammar — the maximum datatypes as code.
  var DATATYPES = [
    { k: 'text',         label: 'Text',                    note: 'a short string' },
    { k: 'longtext',     label: 'Long text',               note: 'description / notes' },
    { k: 'number',       label: 'Number',                  note: 'decimal quantity' },
    { k: 'integer',      label: 'Whole number',            note: 'count' },
    { k: 'boolean',      label: 'Yes / No',                note: 'a flag' },
    { k: 'date',         label: 'Date',                    note: 'expiry, harvest' },
    { k: 'datetime',     label: 'Date & time',             note: 'timestamped event' },
    { k: 'choice',       label: 'Choice (one)',            note: 'grade, colour — pick one' },
    { k: 'multichoice',  label: 'Choice (many)',           note: 'tags, effects' },
    { k: 'range',        label: 'Range (min–max)',         note: 'a band' },
    { k: 'money',        label: 'Money',                   note: 'amount + currency (from context)' },
    { k: 'quantity',     label: 'Quantity',                note: 'value + unit' },
    { k: 'unit',         label: 'Unit + conversions',      note: 'base unit + integer factors' },
    { k: 'standard_ref', label: 'Standard reference',      note: 'HS / GS1 — by reference' },
    { k: 'external_ref', label: 'External reference',      note: 'system + id (ERP/PIM code)' },
    { k: 'media',        label: 'Image / video / file',    note: 'own or inherited from source' },
    { k: 'url',          label: 'Link',                    note: 'spec sheet, page' },
    { k: 'geo',          label: 'Location',                note: 'origin, delivery point' },
    { k: 'formula',      label: 'Computed (formula)',      note: 'derived by a co-assist, then sealed' },
  ];
  var METHODS = [   // how the whole catalogue sells (one per catalogue)
    { k: 'cart',     label: 'Cart (qty × price)' }, { k: 'qty', label: 'Quantity only' },
    { k: 'range',    label: 'Price as a range' },   { k: 'qtyprice', label: 'Both negotiable' },
    { k: 'text',     label: 'Information only' },    { k: 'subscription', label: 'Subscription / recurring' },
    { k: 'quote',    label: 'Quote / tender' },
  ];
  var FACETS = ['identity', 'variants', 'units', 'standards', 'media', 'bom', 'pricing', 'loop', 'feedback'];
  var PRICING_MODELS = ['fixed', 'range', 'tiered', 'market-ref', 'negotiated'];
  // the whole grammar, in one place — what the AI composes from
  function PALETTE(){ return { datatypes: DATATYPES, legs: LEGS, viaFor: viaFor, methods: METHODS, facets: FACETS, pricingModels: PRICING_MODELS, standards: STD_SCHEMES, priceBy: PRICE_BY, priceBasis: PRICE_BASIS }; }
  function leg(k) { for (var i = 0; i < LEGS.length; i++) if (LEGS[i].k === k) return LEGS[i]; return null; }

  // ---- normalize / migrate a draft to the current shape (moved out of the UI's _ensureCat) ----
  function ensure(c) {
    c = c || {};
    if (!c.fields) c.fields = [];
    if (!c.loadedBy) c.loadedBy = 'manual';
    if (c.story === undefined) c.story = '';
    if (!c.feedback) c.feedback = [];
    if (!c.refs) c.refs = [];
    if (!c.bom) c.bom = [];
    if (!c.triggers) c.triggers = [];
    if (c.product === undefined) c.product = '';
    if (!c.variants) c.variants = [];
    if (c.baseUnit === undefined) c.baseUnit = '';
    if (!c.altUnits) c.altUnits = [];
    // governance context: currency + region the catalogue is priced/read in; prices inherit these when blank.
    if (!c.context) c.context = { currency: '', region: '' };
    if (c.context.currency === undefined) c.context.currency = '';
    if (c.context.region === undefined) c.context.region = '';
    if (!c.standards) c.standards = [];   // Part C · [{scheme, code, label}] — by reference
    if (!c.pricing) c.pricing = [];       // Part D · [{label, basis, by, source, amount, currency, region, validFrom, validTo}]
    c.pricing.forEach(function (p) {
      if (!p.basis) p.basis = 'global';
      if (!p.by) p.by = 'ref';
      if (p.source === undefined) p.source = '';
      if (p.amount === undefined) p.amount = null;
      if (p.currency === undefined) p.currency = '';
      if (p.region === undefined) p.region = '';
      if (p.validFrom === undefined) p.validFrom = '';
      if (p.validTo === undefined) p.validTo = '';
    });
    c.fields.forEach(function (f) {
      if (!f.leg) {                                   // migrate the old {source} shape
        if (f.source === 'erp') { f.leg = 'system'; f.via = 'ERP'; }
        else if (f.source === 'iot') { f.leg = 'system'; f.via = 'IoT'; }
        else { f.leg = 'cb'; }
      }
      if ((f.leg === 'system' || f.leg === 'compute') && !f.via) f.via = viaFor(f.leg)[0];
    });
    c.feedback.forEach(function (fb) { if (fb.format === undefined) fb.format = ''; if (fb.onRail === undefined) fb.onRail = false; });
    return c;
  }

  // ---- unit resolution: how many base units is one `unit`? (integer num/den, per Part A) ----
  function toBase(c, unit, qty) {
    qty = qty == null ? 1 : qty;
    if (!unit || unit === c.baseUnit) return qty;
    var u = (c.altUnits || []).filter(function (x) { return x.unit === unit; })[0];
    if (!u) return null;                              // unknown unit — caller decides
    return qty * (u.num || 1) / (u.den || 1);
  }

  // ---- resolve a price against the catalogue's governance context (currency/region inherited when blank).
  // by 'value' → a frozen amount now; by 'ref' → loose, resolved from `source` at seal (FX freezes then, not here).
  function resolvePrice(c, p) {
    c = ensure(c);
    return {
      label: p.label || (p.basis + ' price'),
      basis: p.basis, by: p.by, source: p.source,
      amount: p.by === 'value' ? p.amount : null,
      currency: p.currency || c.context.currency || '',
      region: p.region || c.context.region || '',
      validFrom: p.validFrom, validTo: p.validTo,
      state: p.by === 'value' ? 'frozen (by value)' : 'loose (by ref — resolves at seal)',
    };
  }

  // ---- the four-leg chain as DATA (the UI draws it; the harness reasons over it) ----
  function routeChain(c) {
    c = ensure(c);
    var out = { system: [], customer: [], compute: [], cb: [], feedback: [] };
    c.fields.forEach(function (f) { (out[f.leg] || out.cb).push({ name: f.name, via: f.via, type: f.type }); });
    if (c.product) out.cb.unshift({ name: c.product + ' (identity)', identity: true });
    if (c.baseUnit) out.cb.unshift({ name: 'units · ' + c.baseUnit, identity: true });
    out.feedback = (c.feedback || []).filter(function (x) { return x.system; })
      .map(function (x) { return { system: x.system, format: x.format, onRail: !!x.onRail }; });
    return out;
  }

  // ---- derive the COMPUTE JOB: what a co-assist must compute, what feeds it, where the result goes.
  // This is the bridge from a design draft to a runnable co-assist→seal loop.
  function deriveComputeJob(c) {
    c = ensure(c);
    var feeds = c.fields.filter(function (f) { return f.leg === 'system'; })
      .map(function (f) { return { name: f.name, via: f.via, type: f.type }; });
    var computed = c.fields.filter(function (f) { return f.leg === 'compute'; })
      .map(function (f) { return { name: f.name, via: f.via, type: f.type }; });
    var fromCustomer = c.fields.filter(function (f) { return f.leg === 'customer'; }).map(function (f) { return f.name; });
    var stored = c.fields.filter(function (f) { return f.leg === 'cb'; }).map(function (f) { return f.name; });
    return {
      product: c.product,
      context: c.context,           // governance: currency + region prices/refs resolve under
      known_as: (c.refs || []).filter(function (r) { return r.system && r.code; }),
      standards: (c.standards || []).filter(function (s) { return s.code || s.label; }),   // Part C · by reference
      pricing: (c.pricing || []).map(function (p) { return resolvePrice(c, p); }),          // Part D · by ref / by value
      bom: (c.bom || []).filter(function (b) { return b.item; }),
      feeds: feeds,                 // inputs to the co-assist (from ERP/IoT)
      computed: computed,           // what the co-assist outputs (then sealed)
      fromCustomer: fromCustomer,
      stored: stored,
      triggers: (c.triggers || []).filter(function (t) { return t.watch || t.value; }),
      feedback: (c.feedback || []).filter(function (x) { return x.system; }),
      runnable: computed.length > 0 && (c.triggers || []).some(function (t) { return t.action; }),
    };
  }

  // ---- what the sealed record's inputs should be: the system-fed values, keyed by field name ----
  function canonicalInputs(c, feedValues) {
    c = ensure(c);
    var inputs = { product: c.product };
    c.fields.filter(function (f) { return f.leg === 'system'; }).forEach(function (f) {
      inputs[f.name] = feedValues && (f.name in feedValues) ? feedValues[f.name] : null;
    });
    (c.refs || []).forEach(function (r) { if (r.system && r.code) { inputs.known_as = inputs.known_as || {}; inputs.known_as[r.system] = r.code; } });
    return inputs;
  }

  // ---- ADOPT the standard: emit the catalogue AS JSON Schema (+ our x-cb-* overlay for the four legs / seal).
  // This is what an AI would emit per purpose (LLMs speak JSON Schema); RJSF / JSON Forms / json-editor render it
  // for free. We only add the CB-unique bits as extension keywords. Our model stays a thin PROFILE over the standard.
  function _jkey(n){ return (n || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field'; }
  var TYPE_TO_JSONSCHEMA = {
    text: { type: 'string' }, number: { type: 'number' }, date: { type: 'string', format: 'date' },
    choice: { type: 'string' }, range: { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' } } },
  };
  function toJSONSchema(c, opts) {
    c = ensure(c); opts = opts || {};
    var props = {}, required = [];
    props.product = { type: 'string', title: 'Product', 'x-cb-role': 'identity', 'x-cb-leg': 'cb' };
    if (c.product) required.push('product');
    if (c.baseUnit) props.unit = { type: 'string', title: 'Unit', default: c.baseUnit, 'x-cb-role': 'unit' };
    (c.fields || []).forEach(function (f) {
      var base = JSON.parse(JSON.stringify(TYPE_TO_JSONSCHEMA[f.type] || { type: 'string' }));
      base.title = f.name; base['x-cb-leg'] = f.leg;            // <-- the four-leg overlay: where this field comes from
      if (f.via) base['x-cb-via'] = f.via;
      if (f.leg === 'compute') base.readOnly = true;            // computed by a co-assist, then sealed
      props[_jkey(f.name)] = base;
    });
    (c.standards || []).forEach(function (s) { if (s.code || s.scheme) props[_jkey(s.scheme || 'std')] = { type: 'string', title: (s.scheme || 'Standard') + ' code', 'x-cb-role': 'standard-ref', 'x-cb-standard': s.scheme, 'x-cb-ref': true }; });
    var schema = { '$schema': 'https://json-schema.org/draft/2020-12/schema', title: c.product || 'Catalogue item', type: 'object', properties: props };
    if (required.length) schema.required = required;
    schema['x-cb-method'] = opts.method || 'cart';                // the whole-catalogue overlay
    schema['x-cb-currency'] = opts.currency || '(entity)';
    if (opts.facets) schema['x-cb-facets'] = Object.keys(opts.facets).filter(function (k) { return opts.facets[k]; });
    schema['x-cb-seal'] = 'content-hash on the chit';
    return schema;
  }

  // ---- completeness for a build-ready check (used later by the gated Build) ----
  function validate(c) {
    c = ensure(c);
    var issues = [];
    if (!c.product) issues.push('no product name');
    c.fields.forEach(function (f) { if (!f.name) issues.push('an unnamed requirement'); });
    var comp = c.fields.some(function (f) { return f.leg === 'compute'; });
    if (comp && !c.fields.some(function (f) { return f.leg === 'system'; })) issues.push('a computed field but nothing fed in to compute from');
    return { ok: issues.length === 0, issues: issues };
  }

  // ============================================================================
  // ADOPTED INDUSTRY STANDARDS  (named here so the whole thing is universal, not
  // bespoke — this list is what the in-app "Built on open standards" panel reads.)
  // We arrange these existing pieces our own way; the CB-unique layer (four-leg
  // provenance + chit/seal + per-copy + governance) rides ON TOP of them.
  // ============================================================================
  var STANDARDS = [
    { id: 'json-schema-2020-12', name: 'JSON Schema (draft 2020-12)', body: 'json-schema.org', role: 'Catalogue & item shape — LLMs emit it natively, so it doubles as the real-time build format.', status: 'in code', where: 'toJSONSchema()', spec: 'https://json-schema.org/draft/2020-12' },
    { id: 'rfc7386', name: 'JSON Merge Patch — IETF RFC 7386', body: 'IETF', role: 'Smooth partial modification: any source emits a patch, the record accumulates it (never a full rewrite).', status: 'in code', where: 'mergePatch()', spec: 'https://www.rfc-editor.org/rfc/rfc7386' },
    { id: 'mdm-golden-record', name: 'MDM golden record + survivorship', body: 'Master Data Management', role: 'One living item filled by many sources; per-field source-of-truth decides which source wins.', status: 'in code', where: 'upsertItem() · _lineage', spec: 'https://en.wikipedia.org/wiki/Master_data_management' },
    { id: 'gs1-gtin', name: 'GS1 GTIN / SKU', body: 'GS1', role: 'Used as the stable upsert key so re-importing a source updates, never duplicates. (SKU/GTIN taken as-is — no check-digit validation yet.)', status: 'in code', where: 'itemKey() · upsertItem()', spec: 'https://www.gs1.org/standards/id-keys/gtin' },
    { id: 'pim', name: 'PIM data model (attributes · families · completeness)', body: 'PIM discipline', role: 'Naming/shape alignment only — our fields/sections/facets mirror the standard PIM vocabulary so an export stays compatible. No PIM engine or vendor code is embedded.', status: 'vocabulary', where: 'fields · sections · facets', spec: 'https://en.wikipedia.org/wiki/Product_information_management' },
    { id: 'gs1-gpc', name: 'GS1 GPC classification', body: 'GS1', role: 'Product classification, held BY REFERENCE (link out, never mirror).', status: 'by reference', where: 'standards[]', spec: 'https://www.gs1.org/standards/gpc' },
    { id: 'schema-org-product', name: 'Schema.org / Product', body: 'schema.org', role: 'Web-standard product vocabulary for interop, held by reference.', status: 'by reference', where: 'standards[]', spec: 'https://schema.org/Product' },
    // Moved from "by reference" to IN CODE: the item lifecycle flag is schema.org's enumeration, not four words we
    // made up. CB is deliberately finer in one place — schema.org's single Discontinued conflates "stopped selling"
    // with "use that one instead", and only the second carries a successor worth acting on. Both export as
    // Discontinued, so we are finer than the standard without ever emitting a value it does not define.
    { id: 'schema-org-availability', name: 'Schema.org / ItemAvailability', body: 'schema.org', role: 'Item lifecycle flag (available · not available · redundant · retired) carries its InStock/OutOfStock/Discontinued equivalent, so a feed or storefront never learns our vocabulary.', status: 'in code', where: 'itemstatus.SCHEMA_ORG · item_data.status_schema_org', spec: 'https://schema.org/ItemAvailability' },
    // ── named in the one-pass audit of 2026-08-13 (schema.org + Medusa, field by field — see FIELD_STANDARDS) ──
    { id: 'schema-org-offer', name: 'Schema.org / Offer', body: 'schema.org', role: 'Price, currency, availability, eligible quantity and price VALIDITY belong to the offer, not the product — the same good sells at different prices to different buyers. Our per-copy model already agrees; the field placement does not yet.', status: 'vocabulary', where: 'price · currency · min_qty · status', spec: 'https://schema.org/Offer' },
    { id: 'wco-hs', name: 'WCO Harmonized System (HS/HSN)', body: 'World Customs Organization', role: 'Customs classification — what a good IS, for duty. schema.org has no equivalent at all; Medusa carries hs_code as first-class. It is the field that makes this a trade catalogue rather than a shop one.', status: 'by reference', where: 'hsn · hs_code · starter-fields', spec: 'https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition.aspx' },
    { id: 'unece-rec20', name: 'UN/CEFACT Recommendation 20 — units of measure', body: 'UNECE', role: 'The code list for units in international trade (KGM · LTR · TNE · MTQ · PCE). Neither schema.org nor Medusa models a unit of sale properly, which for a bulk-commodity rail is a real gap in both — and the reason we keep our own unit + conversions.', status: 'roadmap', where: 'unit · conversions (our own names today)', spec: 'https://unece.org/trade/uncefact/cl-recommendations' },
    { id: 'iso3166', name: 'ISO 3166-1 alpha-2', body: 'ISO', role: 'Country of origin — drives duty and preference, and feeds the trade-lane layer.', status: 'by reference', where: 'origin_country', spec: 'https://www.iso.org/iso-3166-country-codes.html' },
    { id: 'iso4217', name: 'ISO 4217 currency codes', body: 'ISO', role: 'Currency of a price, stamped from the ENTITY and never from the request.', status: 'in code', where: 'money.stampItem() · regional.currencyFor()', spec: 'https://www.iso.org/iso-4217-currency-codes.html' },
    { id: 'medusa-model', name: 'Medusa product model', body: 'Medusa (MIT)', role: 'Read field-by-field to name ours well: Product/ProductVariant confirmed hs_code, origin_country, sku, barcode, material, weight. NOT adopted: variant-as-its-own-record (a trader writes a flat price list), ProductStatus (a publication workflow, not orderability), is_giftcard/discountable (B2C checkout concerns). No Medusa code is embedded.', status: 'vocabulary', where: 'FIELD_STANDARDS', spec: 'https://docs.medusajs.com/resources/references/product/models/Product' },
    // ── the INSTANCE, as distinct from the product class (added 2026-08-13, batch/expiry pass) ─────────────────
    { id: 'gs1-ai', name: 'GS1 Application Identifiers — (10) batch · (17) expiry · (21) serial', body: 'GS1', role: '⭐ A GTIN identifies a product CLASS; a batch or serial identifies an INSTANCE of it. "Two or three of the same SKU" is therefore one product with three lots, not three products — and the lot travels on the MOVEMENT (the chit line), never on the catalogue item. Stored ISO, mapped to GS1 YYMMDD at the barcode boundary.', status: 'in code', where: 'gs1.AI · gs1.lotOf() · gs1.lotKey() · line.lot', spec: 'https://www.gs1.org/standards/barcodes/application-identifiers' },
    { id: 'gs1-epcis', name: 'GS1 EPCIS 2.0 + Core Business Vocabulary', body: 'GS1', role: 'The cross-company standard for what HAPPENED to a lot — what · when · where · why, with ObjectEvent and TransformationEvent (the only event that breaks a lot chain and creates new output lots from inputs). This is the vocabulary our traceability walk and mass-balance already implement under our own names; adopting the naming is what makes the graph exportable to anyone else.', status: 'roadmap', where: 'trace walk · by-batch · mass-balance', spec: 'https://www.gs1.org/standards/epcis' },
    { id: 'odoo-tracking', name: 'Lot/serial tracking (Odoo model)', body: 'Odoo (LGPL)', role: 'A lot is NOT a separate product — it is a record linked to one product, and the product merely declares whether it is tracked (none · lot · serial). Copied exactly, because the alternative (a catalogue row per lot) turns the catalogue into a lot ledger. Removal strategy FEFO — first-EXPIRY-first-out — is the one perishables need; FIFO ships the wrong box when a later delivery carries an older date. No Odoo code embedded.', status: 'vocabulary', where: 'starter-fields pharma `tracking` · gs1.expiryState()', spec: 'https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/lots.html' },
    { id: 'rfc6902', name: 'JSON Patch — IETF RFC 6902', body: 'IETF', role: 'Ordered, audited edit operations — for when a change history must be replayable.', status: 'roadmap', where: '—', spec: 'https://www.rfc-editor.org/rfc/rfc6902' },
    { id: 'gs1-gdsn', name: 'GS1 GDSN', body: 'GS1', role: 'Cross-company continuous catalogue sync (supplier → distributor).', status: 'roadmap', where: '—', spec: 'https://www.gs1.org/services/gdsn' },
  ];

  /* ============================================================================================================
   * FIELD-LEVEL STANDARD MAP — our key → what the rest of the world calls it.
   *
   * Athi, 2026-08-13: *"adopt all the standards in one pass so we can reference quickly … check medusa and org
   * standards."*
   *
   * The STANDARDS list above names the standards we build ON. This names them FIELD BY FIELD, because that is the
   * question anyone actually has: "we call it `hsn` — what does an integrator call it?" Without this the alignment
   * is a claim in a comment; with it, it is a lookup.
   *
   *   s — schema.org (Product properties, or Offer.* where the standard puts it on the offer, not the product)
   *   m — Medusa (MIT). Field names read from the Product / ProductVariant model references, 2026-08-13.
   *   o — the other governing standard, where one owns the field outright (WCO HS, ISO, UN/CEFACT, GS1)
   *   n — a note, and always the reason when we differ
   *
   * ⚠️ VOCABULARY ONLY — NO MEDUSA CODE IS EMBEDDED, exactly as the PIM entry above already states. Reading a
   * model to name our own fields well is not vendoring it.
   *
   * ⚠️ TWO THINGS THIS MAP MADE VISIBLE, both recorded in FIELD_GAPS/CONFLICTS below rather than silently fixed:
   * our `code` field is labelled "Code / HSN" and conflates a merchant SKU with a customs classification, and
   * Medusa's `status` is the same WORD as ours for a different QUESTION.
   * ========================================================================================================== */
  var FIELD_STANDARDS = {
    // ── identity ──────────────────────────────────────────────────────────────────────────────────────────────
    name:        { s: 'name',            m: 'Product.title',            n: '' },
    variant:     { s: '—',               m: 'ProductVariant.title',     n: 'Medusa makes a variant its OWN record keyed by option values; we keep it a field on the item. Ours is flatter and matches how a trader writes a price list.' },
    grade:       { s: '—',               m: 'ProductOptionValue',       n: 'a variant axis — same idea, named for the trade' },
    desc:        { s: 'description',     m: 'Product.description',      n: '' },
    description: { s: 'description',     m: 'Product.description',      n: 'alias of desc — both appear in real imports' },
    synonyms:    { s: 'alternateName',   m: '—',                        n: '⭐ carries far more weight here than anywhere else: multilingual trade names are the MATCHER INPUT, not decoration. Medusa has no equivalent.' },
    local_name:  { s: 'alternateName',   m: '—',                        n: '' },
    botanical:   { s: 'alternateName',   m: '—',                        n: 'the species name — an alternateName with a scheme' },
    brand:       { s: 'brand',           m: 'ProductCollection',        n: '' },
    category:    { s: 'category',        m: 'ProductCategory',          o: 'GS1 GPC · UNSPSC', n: 'classification held BY REFERENCE' },
    // ── canonical codes ───────────────────────────────────────────────────────────────────────────────────────
    sku:         { s: 'sku',             m: 'ProductVariant.sku',       n: 'merchant identifier — ours, not the world’s' },
    gtin:        { s: 'gtin',            m: 'ProductVariant.barcode',   o: 'GS1 GTIN-8/12/13/14', n: 'the world’s identifier. Medusa splits ean/upc/barcode; GS1 subsumes all three under GTIN.' },
    ean:         { s: 'gtin13',          m: 'ProductVariant.ean',       o: 'GS1', n: '' },
    barcode:     { s: 'gtin',            m: 'ProductVariant.barcode',   o: 'GS1', n: '' },
    mpn:         { s: 'mpn',             m: '—',                        n: 'manufacturer part number — spares and machinery' },
    code:        { s: 'sku | —',         m: 'sku | hs_code',            n: '⚠️ AMBIGUOUS IN OUR OWN STARTER SET, labelled "Code / HSN". A merchant SKU and a WCO customs classification are different standards with different owners; both schema.org and Medusa keep them apart. See CONFLICTS.' },
    // ── customs & trade — the fields that make this a TRADE catalogue rather than a shop one ───────────────────
    hsn:         { s: '—',               m: 'hs_code',                  o: 'WCO Harmonized System', n: '⭐ schema.org has NO customs classification. Medusa carries hs_code on both product and variant — worth knowing that a serious commerce model treats this as first-class.' },
    hs_code:     { s: '—',               m: 'hs_code',                  o: 'WCO Harmonized System', n: 'same field, the international spelling' },
    origin_country: { s: '—',            m: 'origin_country',           o: 'ISO 3166-1 alpha-2',    n: 'country of origin — drives duty and preference' },
    material:    { s: 'material',        m: 'material',                 n: '' },
    weight:      { s: 'weight',          m: 'weight',                   o: 'UN/CEFACT Rec 20 (unit code)', n: '' },
    // ── quantity & units ──────────────────────────────────────────────────────────────────────────────────────
    unit:        { s: '—',               m: '—',                        o: 'UN/CEFACT Rec 20', n: '⭐ THE code list for units in international trade (KGM · LTR · TNE · MTQ · PCE). Neither schema.org nor Medusa models a unit of sale properly — for a bulk-commodity rail this is a real gap in BOTH, and the reason we keep our own unit + conversions.' },
    unit_size:   { s: 'size',            m: '—',                        n: '' },
    conversions: { s: '—',               m: '—',                        o: 'UN/CEFACT Rec 20', n: 'integer factors between units — CB-specific, because a sack is 50 kg only in this catalogue' },
    min_qty:     { s: 'Offer.eligibleQuantity', m: '—',                 n: '' },
    // ── price ─────────────────────────────────────────────────────────────────────────────────────────────────
    price:       { s: 'Offer.price',     m: 'Price.amount',             n: '⚠️ schema.org puts price on the OFFER, not the product — the same thing sells at different prices to different people. Our per-copy model already agrees with that; the field placement does not yet.' },
    currency:    { s: 'Offer.priceCurrency', m: 'Price.currency_code',  o: 'ISO 4217', n: 'stamped from the ENTITY, never from the request' },
    mrp:         { s: 'Offer.priceSpecification', m: '—',               n: 'list price — a second price with a different role' },
    // ── lifecycle & stock ─────────────────────────────────────────────────────────────────────────────────────
    status:      { s: 'Offer.availability', m: '✗ NOT ProductStatus',   n: '⚠️ SAME WORD, DIFFERENT QUESTION. Medusa’s status (draft/proposed/published/rejected) is a PUBLICATION workflow — is this listing ready to show. Ours is schema.org ItemAvailability — can this be ordered at all. Mapping one to the other would be wrong in both directions.' },
    status_until:{ s: '—',               m: '—',                        n: 'CB-specific: what makes "temporarily" mean anything' },
    status_replaced_by: { s: 'isSimilarTo', m: '—',                     n: 'the successor that makes redundant ≠ retired' },
    avail:       { s: 'Offer.inventoryLevel', m: 'InventoryLevel',      n: 'the QUANTITY feed — how many are on the shelf. Not the lifecycle.' },
    // ── tax — jurisdictional, and deliberately not pretended to be universal ───────────────────────────────────
    gst_rate:    { s: '—',               m: 'TaxRate (Tax Module)',     n: 'no cross-border standard exists — the HS code drives the rate, and the rate is the jurisdiction’s' },
    gst:         { s: '—',               m: 'TaxRate (Tax Module)',     n: 'alias' },
    sac:         { s: '—',               m: '—',                        o: 'India SAC', n: 'services counterpart of HSN' },
    cess:        { s: '—',               m: '—',                        n: 'India-specific levy' },
    // ── media ─────────────────────────────────────────────────────────────────────────────────────────────────
    image:       { s: 'image',           m: 'Product.thumbnail/images', n: '' },
    // ── ⭐ THE INSTANCE — these are NOT catalogue fields, and that is the point ────────────────────────────────
    tracking:    { s: '—',               m: 'Product.tracking',         o: 'Odoo model', n: '⭐ ON THE PRODUCT: whether movements must carry a lot at all (none · lot · serial). True of every unit ever made, which is the test for belonging on the item.' },
    shelf_life_days: { s: '—',           m: '—',                        n: 'ON THE PRODUCT: how long it lasts. The expiry DATE this implies belongs to the LOT — confusing the two is how a batch ends up in a catalogue.' },
    'lot.batch': { s: '—',               m: 'stock.lot.name',           o: 'GS1 AI (10)', n: '⚠️ ON THE LINE, NEVER THE ITEM. `batch_no` used to sit on the pharma catalogue item, and the CSV importer allows it as the identity key — one declaration away from a new catalogue row per consignment, i.e. a lot ledger wearing a catalogue’s name.' },
    'lot.expiry':{ s: 'Offer.priceValidUntil ✗', m: 'lot expiration_date', o: 'GS1 AI (17)', n: '⚠️ NOT priceValidUntil — that is when an OFFER stops being valid. This is when the GOODS stop being safe. Two unrelated clocks that both look like "a date on a line".' },
    'lot.serial':{ s: '—',               m: 'stock.lot (serial)',       o: 'GS1 AI (21)', n: 'one individual unit rather than one consignment' },
  };

  /* Standard fields we do NOT carry. Named so the absence is a DECISION with a trigger, not an oversight — the
     list is as much a part of "we follow the standards" as the map above. */
  var FIELD_GAPS = [
    { key: 'priceValidUntil', from: 'schema.org Offer', why: '⭐ THE TIME ANGLE, and the standard answers it: price validity belongs on the OFFER, not the product. Our design model already has pricing[].validFrom/validTo — items do not. This is the gap to close first.' },
    { key: 'itemCondition',   from: 'schema.org Offer', why: 'new · used · refurbished · damaged. Matters the moment anyone trades machinery, scrap or seconds.' },
    { key: 'mid_code',        from: 'Medusa',           why: 'Manufacturer ID code — US customs. Needed only when a lane runs to the US; the trade-lane layer should ask for it, not the catalogue.' },
    { key: 'length/height/width', from: 'both',         why: 'dimensions — freight cost and container fill. We carry weight and not volume, which is half a shipping answer.' },
    { key: 'manage_inventory / allow_backorder', from: 'Medusa', why: 'whether stock is tracked at all, and whether you may oversell. We have an availability feed but nothing that says "this item is not stock-tracked", so an empty feed and an untracked item look identical.' },
    { key: 'handle',          from: 'Medusa',           why: 'URL slug. Only meaningful once a storefront is public.' },
    { key: 'variant_rank',    from: 'Medusa',           why: 'display order of variants. Cosmetic until a catalogue is large.' },
    { key: 'is_giftcard · discountable', from: 'Medusa', why: 'NOT adopted — checkout concerns for a B2C shop, not properties of a traded good.' },
  ];

  /* Where our model and a standard genuinely disagree. Recorded, not silently "fixed" — renaming a live field is a
     migration, and the decision is Athi's. */
  var FIELD_CONFLICTS = [
    { ours: 'code', issue: 'labelled "Code / HSN" in the starter set, so one column is asked to hold either a merchant SKU or a WCO customs code.', standard: 'schema.org (sku vs no HS at all) and Medusa (sku on the variant, hs_code on both) keep them apart.', cost: 'a catalogue exported for customs would carry SKUs in the HS column, and nothing would flag it.', fix: 'split into sku + hs_code in starter-fields; existing rows keep `code` until someone chooses.' },
    { ours: 'price on the item', issue: 'a single price lives on the product record.', standard: 'schema.org models price on the Offer — the same good sells at different prices to different buyers.', cost: 'per-buyer and time-boxed pricing have nowhere to live, which is the same reason validFrom/validTo never reached items.', fix: 'an offers[] layer over the item, keyed by counterparty and validity window.' },
    { ours: 'variant as a field', issue: 'name + variant on one flat row.', standard: 'Medusa makes the variant the purchasable record and the product a grouping.', cost: 'none today — flat matches how a trader writes a price list, and the matcher depends on it. Recorded so the difference is deliberate.', fix: 'none proposed.' },
  ];

  /* stdFor(key) — the one-line reference a UI can print beside a field. Returns null when nothing maps, so the
     caller can stay silent rather than print "—". */
  function stdFor(key) {
    var f = FIELD_STANDARDS[key];
    if (!f) return null;
    var bits = [];
    if (f.s && f.s !== '—') bits.push('schema.org ' + f.s);
    if (f.m && f.m !== '—') bits.push('Medusa ' + f.m);
    if (f.o) bits.push(f.o);
    return bits.length ? { label: bits.join(' · '), note: f.n || '' } : (f.n ? { label: '', note: f.n } : null);
  }

  // RFC 7386 — JSON Merge Patch. Pure, ~10 lines: null deletes a key, object recurses, scalar replaces.
  function mergePatch(target, patch) {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
    var out = (target && typeof target === 'object' && !Array.isArray(target)) ? Object.assign({}, target) : {};
    Object.keys(patch).forEach(function (k) {
      if (patch[k] === null) { delete out[k]; }
      else { out[k] = mergePatch(out[k], patch[k]); }
    });
    return out;
  }

  // GS1-style stable identity — first present of sku/gtin/code, else the name.
  function itemKey(it) { return (it && (it.sku || it.gtin || it.code || it.product || it.name)) || null; }

  // MDM source-priority — higher wins a field conflict; a source only overwrites a field a
  // stronger source already set if it is >= that strength (else it only fills empties).
  var SOURCE_PRIORITY = { manual: 5, csv: 4, erp: 3, blueprint: 2, reference: 2, value: 2, capture: 1 };

  // Upsert a source's contribution into the golden record set (MDM + RFC 7386).
  // Records per-field provenance in _lineage {field: {source, prio}} — that IS the four-leg made concrete.
  function upsertItem(items, incoming, opts) {
    opts = opts || {}; items = items || [];
    var source = opts.source || 'manual';
    var prio = (opts.priority != null) ? opts.priority : (SOURCE_PRIORITY[source] || 1);
    var key = itemKey(incoming);
    var existing = null;
    for (var i = 0; i < items.length; i++) { if (key && itemKey(items[i]) === key) { existing = items[i]; break; } }
    if (!existing) {
      var created = mergePatch({}, incoming);
      created._src = source; created._lineage = {};
      Object.keys(incoming).forEach(function (f) { if (f.charAt(0) !== '_') created._lineage[f] = { source: source, prio: prio }; });
      items.push(created);
      return { items: items, item: created, created: true };
    }
    var lin = existing._lineage || (existing._lineage = {});
    Object.keys(incoming).forEach(function (f) {
      if (f.charAt(0) === '_') return;
      var cur = lin[f];
      var empty = existing[f] == null || existing[f] === '';
      if (empty || !cur || prio >= cur.prio) {
        existing[f] = mergePatch(existing[f], incoming[f]);
        lin[f] = { source: source, prio: prio };
      }
    });
    // Carry display-only meta (e.g. _photo, _media) onto an existing record when it lacks it. These are not tracked in
    // _lineage (they are not four-leg fields), so the field loop above skips them — without this a second source hitting
    // the same SKU would silently lose the image.
    Object.keys(incoming).forEach(function (f) {
      if (f.charAt(0) === '_' && f !== '_lineage' && f !== '_src' && (existing[f] == null || existing[f] === '')) existing[f] = incoming[f];
    });
    return { items: items, item: existing, created: false, updated: true };
  }

  return {
    LEGS: LEGS, TYPES: TYPES, viaFor: viaFor, leg: leg,
    STD_SCHEMES: STD_SCHEMES, PRICE_BASIS: PRICE_BASIS, PRICE_BY: PRICE_BY,
    DATATYPES: DATATYPES, METHODS: METHODS, FACETS: FACETS, PRICING_MODELS: PRICING_MODELS, PALETTE: PALETTE,
    ensure: ensure, toBase: toBase, resolvePrice: resolvePrice, routeChain: routeChain,
    deriveComputeJob: deriveComputeJob, canonicalInputs: canonicalInputs, validate: validate,
    toJSONSchema: toJSONSchema,
    STANDARDS: STANDARDS, mergePatch: mergePatch, itemKey: itemKey, upsertItem: upsertItem, SOURCE_PRIORITY: SOURCE_PRIORITY,
    FIELD_STANDARDS: FIELD_STANDARDS, FIELD_GAPS: FIELD_GAPS, FIELD_CONFLICTS: FIELD_CONFLICTS, stdFor: stdFor,
  };
});
