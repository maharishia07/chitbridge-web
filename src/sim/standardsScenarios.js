// standardsScenarios.js
import { V0_1 } from '../governance/constitutions';
import { assembleBusiness } from '../governance/cascade';

const base = { vertical:'pharmacy', jurisdiction:'india', content:'distributor_feed', erp:'tally' };
export const standardsScenarios = [
  { name:'Missing capability is a hard reject (Class B)', run() {
      const r = assembleBusiness(V0_1, { ...base, standard:'gdp_pharma', capabilities:[] });
      const pass = !r.conformant && r.rejections.some(x => x.klass === 'B');
      return { pass, detail: pass ? 'GDP needs batch_recall — rejected' : 'expected a reject' };
  }},
  { name:'Granting the capability makes it conformant', run() {
      const r = assembleBusiness(V0_1, { ...base, standard:'gdp_pharma', capabilities:['batch_recall'] });
      return { pass: r.conformant, detail: r.conformant ? 'batch_recall granted — conformant' : 'still failing' };
  }},
  { name:'Standard cascades required fields into the schema', run() {
      const r = assembleBusiness(V0_1, { ...base, standard:'gdp_pharma', capabilities:['batch_recall'] });
      const pass = r.schema.includes('cold_chain_log') && r.schema.includes('batch_recall_ref');
      return { pass, detail: pass ? 'cold_chain_log + batch_recall_ref cascaded in' : 'fields missing' };
  }},
];
