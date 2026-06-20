import { composeCascade, buildStack, assembleBusiness } from './cascade';
let _bp = 1, _inst = 1;
export function saveBlueprint(constitution, sel, name) {
  return { id:`bp${_bp++}`, entity_kind:'template', name: name || 'Untitled Blueprint', version:'1.0',
    mintedVersion: constitution.version, selection:{ ...sel }, resolved: assembleBusiness(constitution, sel), transactions:null };
}
const overlayLayer = (overlay) => ({ id:'instance', layer:'instance',
  contributes: Object.fromEntries(Object.entries(overlay || {}).filter(([k]) => k !== 'name')
    .map(([k, v]) => [k, { value:v, mode: k === 'currency_code' ? 'advise' : 'tighten' }])) });
export function cloneInstance(blueprint, constitution, overlay = {}, name) {
  const r = composeCascade(constitution, {}, [...buildStack(blueprint.selection), overlayLayer(overlay)]);
  return { id:`inst${_inst++}`, entity_kind:'instance', name: name || overlay.name || 'Your business',
    blueprintId: blueprint.id, blueprintName: blueprint.name, mintedVersion: constitution.version,
    overlay, effective:r.effective, provenance:r.provenance, rejections:r.rejections, exceptions:r.exceptions };
}
export const driftOf = (entity, activeConstitution) => entity.mintedVersion !== activeConstitution.version;
export function applyUpdate(instance, blueprintSelection, constitution) {
  const r = composeCascade(constitution, {}, [...buildStack(blueprintSelection), overlayLayer(instance.overlay)]);
  return { ...instance, mintedVersion: constitution.version, effective:r.effective, provenance:r.provenance, rejections:r.rejections, exceptions:r.exceptions };
}
