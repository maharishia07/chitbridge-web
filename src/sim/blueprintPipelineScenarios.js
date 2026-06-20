import { V0_1 } from '../governance/constitutions';
import { PRESETS } from '../governance/presets';
import { assembleBusiness } from '../governance/cascade';
export const blueprintPipelineScenarios = [
  { name:'rules converge (provenance shows the winning layer)', run() {
      const biz = assembleBusiness(V0_1, { ...PRESETS.distributor });
      const res = biz.provenance.data_residency;
      return { pass: !!res && res.floor === true && res.value === 'in', detail:'residency floored by jurisdiction' };
  }},
  { name:'data unions (more layers → more fields)', run() {
      const few = assembleBusiness(V0_1, { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'none', capabilities:[] }).schema.length;
      const many = assembleBusiness(V0_1, { ...PRESETS.distributor }).schema.length;
      return { pass: many > few, detail:`${few} → ${many}` };
  }},
  { name:'a conformant pipeline is ready to freeze', run() {
      const biz = assembleBusiness(V0_1, { ...PRESETS.distributor });
      return { pass: biz.conformant, detail: biz.conformant ? 'ready' : 'blocked' };
  }},
];
