import { gatherDataDefinition } from './cascade';
import { VERTICALS } from './verticals';
import { ERP_SOURCES } from './erp';
import { STANDARDS } from './standards';
import { JURISDICTIONS } from './jurisdictions';
function moscowFor(field, sel) {
  const std = STANDARDS[sel.standard], jur = JURISDICTIONS[sel.jurisdiction], v = VERTICALS[sel.vertical];
  if (std && (std.requires_fields||[]).includes(field)) return 'Must';
  if (jur && (jur.requires_fields||[]).includes(field)) return 'Must';
  if (field === 'entity_id' || field === 'legal_name') return 'Must';
  if (v && (v.schema||[]).slice(0,3).includes(field)) return 'Should';
  return 'Could';
}
const isAvailable = (field, sel) => { const e = ERP_SOURCES[sel.erp]; return !!(e && (e.requires_fields||[]).includes(field)); };
export const chitTypesFor = (sel) => (VERTICALS[sel.vertical]?.chit_types) || [];
export function bornChit(constitution, sel, chitType, author) {
  const dd = gatherDataDefinition(constitution, sel);
  const fields = dd.fields.map(f => ({ field:f, by:dd.provenance[f], moscow:moscowFor(f, sel),
    source: isAvailable(f, sel) ? 'available (your system)' : 'authored' }));
  return { chitType, author: author || 'chit author', mintedVersion: constitution.version, fields,
    available: fields.filter(f => f.source !== 'authored'), toAuthor: fields.filter(f => f.source === 'authored'),
    mustCount: fields.filter(f => f.moscow === 'Must').length };
}
