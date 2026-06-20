import { V0_1 } from '../governance/constitutions';
import { gatherDataDefinition, BASE_IDENTITY_FIELDS } from '../governance/cascade';
export const dataDefinitionScenarios = [
  { name:'union always includes the base identity fields', run() {
      const dd = gatherDataDefinition(V0_1, { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'none' });
      return { pass: BASE_IDENTITY_FIELDS.every(f => dd.fields.includes(f)), detail: BASE_IDENTITY_FIELDS.join(',') };
  }},
  { name:'adding ERP grows the union (ext_ fields)', run() {
      const a = gatherDataDefinition(V0_1, { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'none' }).fields.length;
      const b = gatherDataDefinition(V0_1, { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'tally' }).fields.length;
      return { pass: b > a, detail:`${a} → ${b} fields` };
  }},
  { name:'a field required by two layers shows both (hsn ← vertical + jurisdiction)', run() {
      const dd = gatherDataDefinition(V0_1, { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'none' });
      const pass = dd.provenance['hsn'] && dd.provenance['hsn'].length >= 2;
      return { pass, detail: pass ? `hsn ← ${dd.provenance['hsn'].join('+')}` : 'no overlap' };
  }},
];
