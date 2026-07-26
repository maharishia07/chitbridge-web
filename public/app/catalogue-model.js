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

  return {
    LEGS: LEGS, TYPES: TYPES, viaFor: viaFor, leg: leg,
    STD_SCHEMES: STD_SCHEMES, PRICE_BASIS: PRICE_BASIS, PRICE_BY: PRICE_BY,
    DATATYPES: DATATYPES, METHODS: METHODS, FACETS: FACETS, PRICING_MODELS: PRICING_MODELS, PALETTE: PALETTE,
    ensure: ensure, toBase: toBase, resolvePrice: resolvePrice, routeChain: routeChain,
    deriveComputeJob: deriveComputeJob, canonicalInputs: canonicalInputs, validate: validate,
  };
});
