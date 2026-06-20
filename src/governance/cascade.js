// governance/cascade.js — PURE. The left-fold that layers governance one layer onto the
// previous result, in precedence order:
//   Constitution → Jurisdiction → Vertical → Standards → Content → ERP
// Higher-precedence layers set FLOORS/CEILINGS that lower layers may only TIGHTEN, never
// loosen. It records provenance (which layer decided each value) and flags loosening.
//
//   cascade(layers, override) -> { ok, effective, provenance, exceptions, rejections }
//     layers: [{ name, params }]  in precedence order, highest authority first
//     params[key]: { klass, value?, cap?, scale?, set? }   (same shape as resolver/constitution)

const tighter = (scale, a, b) => (scale.indexOf(a) <= scale.indexOf(b) ? a : b);

export function cascade(layers, override = {}) {
  const effective = {};   // key -> resolved value
  const provenance = {};  // key -> { source, klass, cap?, set? }
  const exceptions = [];  // Class C — loosening clamped / advisory mismatch (allowed, flagged)
  const rejections = [];  // Class A/B — hard rejects (floor holds)

  for (const layer of layers) {
    for (const [key, p] of Object.entries(layer.params || {})) {
      const chose = Object.prototype.hasOwnProperty.call(override, key) ? override[key] : undefined;
      const prior = provenance[key]; // already set by a higher-precedence layer?

      switch (p.klass) {
        case 'bound': {
          // a lower layer cannot re-bind what a higher layer already bound
          if (prior && prior.klass === 'bound' && effective[key] !== p.value) {
            rejections.push({ key, klass: 'A', layer: layer.name,
              reason: `${layer.name} cannot rebind '${key}' — floored by ${prior.source} = ${JSON.stringify(effective[key])}` });
            break;
          }
          if (chose !== undefined && chose !== p.value)
            rejections.push({ key, klass: 'A', layer: layer.name,
              reason: `'${key}' is bound by ${layer.name}; cannot override`, attempted: chose });
          effective[key] = p.value;
          provenance[key] = { source: layer.name, klass: 'bound' };
          break;
        }
        case 'bound_set': {
          const floorSet = prior && prior.set ? prior.set : null;
          const mySet = floorSet ? p.set.filter(v => floorSet.includes(v)) : p.set.slice(); // intersect = tighten
          const want = chose === undefined ? (effective[key] !== undefined ? effective[key] : p.value) : chose;
          const arr = Array.isArray(want) ? want : [want];
          const outside = arr.filter(v => !mySet.includes(v));
          if (outside.length)
            rejections.push({ key, klass: 'B', layer: layer.name,
              reason: `${outside.join(', ')} not in ${layer.name} allowed set`, allowed: mySet });
          effective[key] = outside.length ? mySet.slice() : arr.slice();
          provenance[key] = { source: prior ? `${prior.source} → ${layer.name}` : layer.name, klass: 'bound_set', set: mySet };
          break;
        }
        case 'chosen': {
          // ceiling tightens across layers
          let cap = p.cap;
          if (prior && prior.cap) {
            cap = tighter(p.scale, prior.cap, p.cap);
            if (p.scale.indexOf(p.cap) > p.scale.indexOf(prior.cap))
              exceptions.push({ key, klass: 'C', layer: layer.name,
                reason: `${layer.name} ceiling '${p.cap}' loosens ${prior.source} '${prior.cap}' — clamped to '${cap}'` });
          }
          let value = chose !== undefined ? chose
                    : (effective[key] !== undefined ? effective[key] : (p.value !== undefined ? p.value : cap));
          if (p.scale.indexOf(value) > p.scale.indexOf(cap)) {
            rejections.push({ key, klass: 'A', layer: layer.name,
              reason: `'${value}' loosens past ceiling '${cap}'`, attempted: value });
            value = cap;
          }
          effective[key] = value;
          provenance[key] = { source: prior ? `${prior.source} → ${layer.name}` : layer.name, klass: 'chosen', cap };
          break;
        }
        case 'advisory': {
          const val = chose !== undefined ? chose : (effective[key] !== undefined ? effective[key] : p.value);
          if (chose !== undefined && chose !== p.value)
            exceptions.push({ key, klass: 'C', layer: layer.name,
              reason: `advisory '${chose}' vs ${layer.name} reference '${p.value}'` });
          effective[key] = val;
          provenance[key] = provenance[key] || { source: layer.name, klass: 'advisory' };
          break;
        }
        default:
          if (effective[key] === undefined) {
            effective[key] = p.value;
            provenance[key] = { source: layer.name, klass: 'default' };
          }
      }
    }
  }
  return { ok: rejections.length === 0, effective, provenance, exceptions, rejections };
}

// Build the ordered layer list from the active constitution + an optional vertical.
// (As more layers land, insert them here in precedence order.)
export function layersFor(constitution, vertical) {
  const layers = [{ name: 'Constitution', params: constitution.params }];
  if (vertical) layers.push({ name: vertical.label, params: vertical.contributes });
  return layers;
}
