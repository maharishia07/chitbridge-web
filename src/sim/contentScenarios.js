import { V0_1 } from '../governance/constitutions';
import { assembleBusiness } from '../governance/cascade';
export const contentScenarios = [
  { name:'distributor feed adds supplier_ref to the data definition', run() {
      const r = assembleBusiness(V0_1, { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'distributor_feed', erp:'none', capabilities:[] });
      return { pass: r.schema.includes('supplier_ref'), detail:'supplier_ref present' };
  }},
  { name:'content references are carried onto the business', run() {
      const r = assembleBusiness(V0_1, { vertical:'marketplace', jurisdiction:'india', standard:'none', content:'open_market', erp:'none', capabilities:[] });
      return { pass: r.catalogue.includes('marketplace'), detail:r.catalogue.join(',') };
  }},
];
