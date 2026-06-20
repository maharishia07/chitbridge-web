import { V0_1 } from '../governance/constitutions';
import { assembleBusiness } from '../governance/cascade';
export const erpScenarios = [
  { name:'Tally connector appears on the assembled business', run() {
      const r = assembleBusiness(V0_1, { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'tally', capabilities:[] });
      return { pass: r.connectors.includes('tally'), detail: r.connectors.join(',') || 'none' };
  }},
  { name:'ERP-provided fields enter the data definition (ext_)', run() {
      const r = assembleBusiness(V0_1, { vertical:'manufacturer', jurisdiction:'india', standard:'none', content:'own_only', erp:'sap', capabilities:[] });
      return { pass: r.schema.includes('ext_material_ref'), detail:'ext_material_ref present' };
  }},
];
