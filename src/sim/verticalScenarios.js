// verticalScenarios.js — reconciled to the general cascade (composeVertical + new VERTICALS).
import { V0_1, V0_2 } from '../governance/constitutions';
import { VERTICALS } from '../governance/verticals';
import { composeVertical } from '../governance/cascade';

export const verticalScenarios = [
  { name:'Marketplace visibility is capped by the constitution', run() {
      // Marketplace wants 'public'; Constitution v0.1 caps at 'private' → capped + flagged.
      const r = composeVertical(V0_1, {}, VERTICALS.marketplace);
      const pass = r.effective.catalogue_visibility !== 'public' && r.exceptions.some(x => x.klass === 'note');
      return { pass, detail: pass ? `marketplace 'public' capped to '${r.effective.catalogue_visibility}'` : 'expected a cap' };
  }},
  { name:'Vertical carries its schema and document types', run() {
      const r = composeVertical(V0_1, {}, VERTICALS.pharmacy);
      const pass = r.schema.includes('drug_name') && r.chitTypes.includes('purchase_order');
      return { pass, detail: pass ? 'pharmacy schema + document types present' : 'missing' };
  }},
  { name:'Within the ceiling, a vertical may set visibility', run() {
      // Constitution v0.2 caps 'restricted'; pharmacy proposes 'restricted' → allowed.
      const r = composeVertical(V0_2, {}, VERTICALS.pharmacy);
      const pass = r.effective.catalogue_visibility === 'restricted';
      return { pass, detail: pass ? "pharmacy set 'restricted' under v0.2" : r.effective.catalogue_visibility };
  }},
];
