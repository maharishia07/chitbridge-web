// payoffScenarios.js
import { V0_1 } from '../governance/constitutions';
import { PRESETS } from '../governance/presets';
import { assembleBusiness } from '../governance/cascade';

export const payoffScenarios = [
  { name:'Distributor preset spins a conformant business', run() {
      const r = assembleBusiness(V0_1, PRESETS.distributor);
      const pass = r.conformant && r.schema.includes('cold_chain_log') && r.connectors.includes('tally');
      return { pass, detail: pass ? 'GDP fields + tally + conformant' : JSON.stringify(r.rejections) };
  }},
  { name:'Amazon preset spins a marketplace', run() {
      const r = assembleBusiness(V0_1, PRESETS.amazon);
      const pass = r.conformant && r.schema.includes('title') && r.catalogue.includes('marketplace');
      return { pass, detail: pass ? 'marketplace schema + open catalogue + conformant' : 'unexpected' };
  }},
  { name:'Drop the required capability and it is not conformant', run() {
      const r = assembleBusiness(V0_1, { ...PRESETS.distributor, capabilities:[] });
      return { pass: !r.conformant, detail: !r.conformant ? 'GDP without batch_recall → not conformant' : 'should have failed' };
  }},
];
