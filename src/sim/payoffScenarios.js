import { V0_1 } from '../governance/constitutions';
import { PRESETS } from '../governance/presets';
import { assembleBusiness } from '../governance/cascade';
export const payoffScenarios = [
  { name:'distributor preset assembles a conformant business', run() {
      const r = assembleBusiness(V0_1, { ...PRESETS.distributor });
      return { pass: r.conformant, detail: r.conformant ? 'conformant' : r.rejections.map(x=>x.key).join(',') };
  }},
  { name:'the assembled schema unions every layer', run() {
      const r = assembleBusiness(V0_1, { ...PRESETS.distributor });
      const pass = ['batch_no','gstin','supplier_ref','ext_ledger_ref'].every(f => r.schema.includes(f));
      return { pass, detail:`${r.schema.length} fields` };
  }},
  { name:'amazon preset is public-market and ISO-conformant', run() {
      const r = assembleBusiness(V0_1, { ...PRESETS.amazon });
      return { pass: r.conformant && r.catalogue.includes('marketplace'), detail: r.conformant ? 'ok' : 'unexpected' };
  }},
];
