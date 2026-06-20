import { composeCascade, buildStack, assembleBusiness } from './cascade';

let _bp = 1, _inst = 1;

// Blueprint = a pre-resolved cascade frozen as a reusable TEMPLATE. No transactions. A clone source.
export function saveBlueprint(constitution, sel, name) {
  return {
    id: `bp${_bp++}`, entity_kind: 'template',
    name: name || 'Untitled Blueprint', version: '1.0',
    mintedVersion: constitution.version,     // stamped lineage = drift basis
    selection: { ...sel },
    resolved: assembleBusiness(constitution, sel), // schema, envelope, certs, catalogue, connectors, effective, provenance
    transactions: null,                      // templates never hold transactions
  };
}

// instance overlay = a lowest-precedence layer, so it's bounded by everything above (tighten-only).
const overlayLayer = (overlay) => ({
  id: 'instance', layer: 'instance',
  contributes: Object.fromEntries(Object.entries(overlay || {})
    .filter(([k]) => k !== 'name')
    .map(([k, v]) => [k, { value: v, mode: k === 'currency_code' ? 'advise' : 'tighten' }])),
});

// Your business = an INSTANCE cloned from a Blueprint + a bounded overlay.
export function cloneInstance(blueprint, constitution, overlay = {}, name) {
  const stack = buildStack(blueprint.selection);
  const r = composeCascade(constitution, {}, [...stack, overlayLayer(overlay)]);
  return {
    id: `inst${_inst++}`, entity_kind: 'instance',
    name: name || overlay.name || 'Your business',
    blueprintId: blueprint.id, blueprintName: blueprint.name,
    mintedVersion: constitution.version,
    overlay, effective: r.effective, provenance: r.provenance,
    rejections: r.rejections, exceptions: r.exceptions,
  };
}

// drift = minted under an older constitution than the active one ("update available")
export const driftOf = (entity, activeConstitution) => entity.mintedVersion !== activeConstitution.version;

// Apply update = re-attest the instance under the active constitution (clears drift).
export function applyUpdate(instance, blueprintSelection, constitution) {
  const stack = buildStack(blueprintSelection);
  const r = composeCascade(constitution, {}, [...stack, overlayLayer(instance.overlay)]);
  return { ...instance, mintedVersion: constitution.version, effective: r.effective,
    provenance: r.provenance, rejections: r.rejections, exceptions: r.exceptions };
}
