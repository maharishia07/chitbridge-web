import { resolve } from './resolver';
import { VERTICALS } from './verticals';
import { JURISDICTIONS } from './jurisdictions';
import { STANDARDS } from './standards';
import { CONTENT_PACKS } from './content';
import { ERP_SOURCES } from './erp';

const SCALES = { catalogue_visibility: ['private','restricted','public'] };
const mapTighten = obj => Object.fromEntries(Object.entries(obj||{}).map(([k,v]) => [k,{value:v,mode:'tighten'}]));

// Generic fold: layers = contributors in PRECEDENCE order, each { id, layer, contributes:{key:{value,mode}} }
// modes: floor (bound/Class A), tighten (chosen, capped), advise (Class C), add (additive/ERP)
export function composeCascade(constitution, override, layers = []) {
  const base = resolve(constitution, override);
  const effective = { ...base.effective };
  const exceptions = [...base.exceptions];
  const rejections = [...base.rejections];
  const provenance = {};
  for (const k of Object.keys(base.effective))
    provenance[k] = { value: base.effective[k], source_layer:'constitution', source_version: constitution.version };
  const floors = {};

  for (const L of layers) {
    if (!L) continue;
    for (const [key, c] of Object.entries(L.contributes || {})) {
      const p = constitution.params[key];
      const scale = SCALES[key];
      if (c.mode === 'floor') {
        if (floors[key] && scale && scale.indexOf(c.value) > scale.indexOf(floors[key].value)) {
          rejections.push({ key, klass:'A', reason:`${L.layer} cannot loosen floor set by ${floors[key].by}` }); continue;
        }
        floors[key] = { value: c.value, by: L.layer };
        effective[key] = c.value;
        provenance[key] = { value:c.value, source_layer:L.layer, source_version:L.id, floor:true };
      } else if (c.mode === 'tighten') {
        let ceiling = (p && p.klass === 'chosen') ? p.cap : undefined;
        const floorV = floors[key]?.value;
        if (scale && floorV && (!ceiling || scale.indexOf(floorV) < scale.indexOf(ceiling))) ceiling = floorV;
        if (scale && ceiling && scale.indexOf(c.value) > scale.indexOf(ceiling)) {
          exceptions.push({ key, klass:'note', reason:`${L.layer} proposed '${c.value}', capped at '${ceiling}' — kept '${effective[key]}'` });
        } else {
          effective[key] = c.value;
          provenance[key] = { value:c.value, source_layer:L.layer, source_version:L.id };
        }
      } else if (c.mode === 'advise') {
        effective[key] = c.value;
        provenance[key] = { value:c.value, source_layer:L.layer, source_version:L.id };
      } else if (c.mode === 'add') {
        if (floors[key]) { rejections.push({ key, klass:'A', reason:`${L.layer} (additive) cannot override floor by ${floors[key].by}` }); continue; }
        effective[key] = c.value;
        provenance[key] = { value:c.value, source_layer:L.layer, source_version:L.id, additive:true };
      }
    }
  }
  return { effective, provenance, floors, exceptions, rejections };
}

// contributor builders
export const vContrib = v => v && ({ id:v.id, layer:'vertical', contributes: mapTighten(v.contributes) });
export const jContrib = j => j && ({ id:j.id, layer:'jurisdiction', contributes: j.contributes });
export const cContrib = c => c && ({ id:c.id, layer:'content', contributes: c.visibility_contribution ? { catalogue_visibility:{value:c.visibility_contribution, mode:'tighten'} } : {} });
export const eContrib = e => e && ({ id:e.id, layer:'erp', contributes: e.adds.object_source ? { object_source:{value:e.adds.object_source, mode:'add'} } : {} });

// back-compat for the Vertical slice
export function composeVertical(constitution, override, vertical) {
  const r = composeCascade(constitution, override, vertical ? [vContrib(vertical)] : []);
  return { ...r, schema: vertical?vertical.schema:[], chitTypes: vertical?vertical.chit_types:[], lenses: vertical?vertical.preset_lenses:{} };
}

// full stack in precedence order from a selection set
export function buildStack(sel) {
  const out = [];
  if (JURISDICTIONS[sel.jurisdiction]) out.push(jContrib(JURISDICTIONS[sel.jurisdiction]));
  if (VERTICALS[sel.vertical])         out.push(vContrib(VERTICALS[sel.vertical]));
  if (CONTENT_PACKS[sel.content])      out.push(cContrib(CONTENT_PACKS[sel.content]));
  if (ERP_SOURCES[sel.erp])            out.push(eContrib(ERP_SOURCES[sel.erp]));
  return out.filter(Boolean);
}

// assemble a whole "business" from all six layers (used by Payoff)
export function assembleBusiness(constitution, sel) {
  const cascade = composeCascade(constitution, {}, buildStack(sel));
  const v = VERTICALS[sel.vertical], j = JURISDICTIONS[sel.jurisdiction];
  const std = STANDARDS[sel.standard], c = CONTENT_PACKS[sel.content], e = ERP_SOURCES[sel.erp];
  const required = std?.requires_capabilities || [];
  const granted = sel.capabilities || [];
  const missing = required.filter(r => !granted.includes(r));
  const rejections = [...cascade.rejections, ...missing.map(m => ({ key:m, klass:'B', reason:`standard '${std.label}' requires '${m}' (not granted)` }))];
  return {
    ...cascade, rejections,
    schema: [...(v?.schema||[]), ...((std?.requires_fields)||[])],
    chitTypes: v?.chit_types || [],
    envelope: j?.envelope || {},
    certifications: std && std.id !== 'none' ? [std.label] : [],
    catalogue: c?.references || [],
    connectors: (e && e.adds.object_source) ? [e.adds.object_source] : [],
    conformant: rejections.length === 0,
  };
}
