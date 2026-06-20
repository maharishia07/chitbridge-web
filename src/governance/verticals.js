// governance/verticals.js — PURE data. Industry profiles for the Vertical layer.
// Each vertical `contributes` parameters that layer ON TOP of the constitution.
// Conformance classes match the resolver/cascade:
//   bound      -> the vertical hard-sets it; cannot be overridden
//   bound_set  -> value(s) must stay within the vertical's allowed set
//   chosen     -> a tighten-only ceiling (`cap`) on a ranked `scale`
//   advisory   -> a reference value; a mismatch is flagged, never blocked
//
// A vertical may only TIGHTEN what the constitution already bounds (the cascade enforces
// this). It may also ADD new domain rules the constitution never spoke to.

const VIS = ['private', 'restricted', 'public']; // most-restrictive first

export const VERTICALS = {
  pharma: {
    id: 'pharma', label: 'Pharmaceuticals',
    blurb: 'Regulated goods — listings stay private, batch tracking is mandatory.',
    contributes: {
      catalogue_visibility: { klass: 'chosen', cap: 'private', scale: VIS }, // tighter than any constitution
      batch_tracking:       { klass: 'bound',  value: true },
      storage:              { klass: 'advisory', value: 'cold-chain' },
    },
  },
  food: {
    id: 'food', label: 'Food & Beverage',
    blurb: 'Perishables — expiry + FSSAI mandatory; listings at most restricted.',
    contributes: {
      catalogue_visibility: { klass: 'chosen', cap: 'restricted', scale: VIS },
      expiry_required:      { klass: 'bound',  value: true },
      fssai_required:       { klass: 'bound',  value: true },
    },
  },
  electronics: {
    id: 'electronics', label: 'Electronics',
    blurb: 'Serialised goods — public listings allowed; warranty is advisory.',
    contributes: {
      catalogue_visibility: { klass: 'chosen', cap: 'public', scale: VIS },
      serial_tracking:      { klass: 'bound',  value: true },
      warranty_months:      { klass: 'advisory', value: 12 },
    },
  },
  apparel: {
    id: 'apparel', label: 'Apparel',
    blurb: 'Open retail — public listings allowed; size chart advisory.',
    contributes: {
      catalogue_visibility: { klass: 'chosen', cap: 'public', scale: VIS },
      size_chart:           { klass: 'advisory', value: 'required' },
    },
  },
};

export const VERTICAL_LIST = Object.values(VERTICALS);
