import { V0_1 } from '../governance/constitutions';
import { assembleBusiness } from '../governance/cascade';
const base = { vertical:'pharmacy', jurisdiction:'india', content:'own_only', erp:'none' };
export const standardsScenarios = [
  { name:'GDP without batch_recall capability → hard reject', run() {
      const r = assembleBusiness(V0_1, { ...base, standard:'gdp_pharma', capabilities:[] });
      return { pass: !r.conformant && r.rejections.some(x=>x.key==='batch_recall'), detail:'rejected (missing batch_recall)' };
  }},
  { name:'GDP with batch_recall granted → conformant', run() {
      const r = assembleBusiness(V0_1, { ...base, standard:'gdp_pharma', capabilities:['batch_recall'] });
      return { pass: r.conformant, detail: r.conformant ? 'conformant' : 'still rejected' };
  }},
  { name:'standard injects its required field into the data definition', run() {
      const r = assembleBusiness(V0_1, { ...base, standard:'gdp_pharma', capabilities:['batch_recall'] });
      return { pass: r.schema.includes('cold_chain_log'), detail:'cold_chain_log in schema' };
  }},
];
