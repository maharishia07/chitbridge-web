// Conformance:
//   bound      -> platform-locked; any override attempt = Class A reject
//   bound_set  -> Class B capability set; value(s) must be IN the set
//   chosen     -> tighten-only within a ranked `cap`; loosening = Class A reject
//   advisory   -> Class C; allowed, but a mismatch is FLAGGED (never silent)

function tightenOnly(scale, cap, chosen) {
  const capIdx = scale.indexOf(cap);
  const idx = scale.indexOf(chosen);
  if (idx === -1) return { ok: false, reason: `unknown value '${chosen}'` };
  if (idx > capIdx) return { ok: false, reason: `'${chosen}' loosens past ceiling '${cap}'` };
  return { ok: true, value: chosen };
}

// constitution.params: { [key]: { klass, value, cap?, scale?, set? } }
// override:            { [key]: value }
export function resolve(constitution, override = {}) {
  const effective = {}, exceptions = [], rejections = [];
  for (const [key, p] of Object.entries(constitution.params)) {
    const chose = Object.prototype.hasOwnProperty.call(override, key) ? override[key] : undefined;
    switch (p.klass) {
      case 'bound':
        if (chose !== undefined && chose !== p.value)
          rejections.push({ key, klass: 'A', reason: `'${key}' is bound; cannot override`, attempted: chose });
        effective[key] = p.value; break;
      case 'bound_set': {
        const val = chose === undefined ? p.value : chose;
        const arr = Array.isArray(val) ? val : [val];
        const outside = arr.filter(v => !p.set.includes(v));
        if (outside.length) { rejections.push({ key, klass: 'B', reason: `${outside.join(', ')} not in allowed set`, allowed: p.set }); effective[key] = p.value; }
        else effective[key] = val;
        break;
      }
      case 'chosen':
        if (chose === undefined) { effective[key] = p.value; break; }
        { const r = tightenOnly(p.scale, p.cap, chose);
          if (!r.ok) { rejections.push({ key, klass: 'A', reason: r.reason, attempted: chose }); effective[key] = p.value; }
          else effective[key] = r.value; }
        break;
      case 'advisory': {
        const val = chose === undefined ? p.value : chose;
        effective[key] = val;
        if (chose !== undefined && chose !== p.value)
          exceptions.push({ key, klass: 'C', reason: `advisory mismatch: '${chose}' vs reference '${p.value}'` });
        break;
      }
      default: effective[key] = p.value;
    }
  }
  return { ok: rejections.length === 0, effective, exceptions, rejections };
}

// Entitlements — enforced at the action; null = unlimited
export const checkCount = (plan, current) =>
  plan.entities == null || current < plan.entities ? { ok: true } : { ok: false, reason: `entity quota ${plan.entities} reached` };
export const checkRate = (plan, todayCount) =>
  plan.chitsPerDay == null || todayCount < plan.chitsPerDay ? { ok: true } : { ok: false, reason: `rate ${plan.chitsPerDay}/day reached` };
export const checkCapability = (plan, cap) =>
  cap === 'public' ? (plan.public ? { ok: true } : { ok: false, reason: 'public-facing needs a higher plan' }) : { ok: true };

// Mint / drift / re-attest
let _seq = 1;
export function mint(activeConstitution, override = {}, plan) {
  const r = resolve(activeConstitution, override);
  if (!r.ok) return { ok: false, rejections: r.rejections };
  return { ok: true, effective: r.effective, exceptions: r.exceptions,
    entity: { id: `e${_seq++}`, mintedVersion: activeConstitution.version, mintedConstitution: activeConstitution, override, plan } };
}
// An entity resolves against the constitution it was MINTED under until re-attested.
export function viewEntity(entity, activeConstitution) {
  const r = resolve(entity.mintedConstitution, entity.override);
  return { effective: r.effective, exceptions: r.exceptions, drift: entity.mintedVersion !== activeConstitution.version, mintedVersion: entity.mintedVersion };
}
export function reattest(entity, activeConstitution) {
  const r = resolve(activeConstitution, entity.override);
  if (!r.ok) return { ok: false, rejections: r.rejections };
  // already-frozen chits keep their own frozen version — not touched here
  return { ok: true, entity: { ...entity, mintedVersion: activeConstitution.version, mintedConstitution: activeConstitution } };
}
