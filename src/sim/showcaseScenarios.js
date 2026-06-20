import { interpretRegulation, attest, toSourcePack } from '../governance/ingest';
import { runChitThroughGate } from '../governance/instructionPacks';

export const showcaseScenarios = [
  { name:'AI interpretation yields MoSCoW-typed requirements', run() {
      const p = interpretRegulation('gdp');
      const pass = p.requirements.some(r => r.moscow==='Must') && p.requirements.some(r => r.field==='cold_chain_log');
      return { pass, detail: pass ? 'cold_chain_log = Must, etc.' : 'no MoSCoW output' };
  }},
  { name:'An un-attested interpretation cannot register', run() {
      const r = toSourcePack(interpretRegulation('gdp'));
      return { pass: r.ok===false, detail: r.ok===false ? 'blocked until attested' : 'should have blocked' };
  }},
  { name:'After attest, it registers with its fields', run() {
      const r = toSourcePack(attest(interpretRegulation('gdp'), 'expert'));
      const pass = r.ok && r.pack.requires_fields.includes('cold_chain_log');
      return { pass, detail: pass ? 'registered as a source' : 'register failed' };
  }},
  { name:'Maker-checker rejects self-approval', run() {
      const r = runChitThroughGate({ id:'c1', type:'order', author:'A', approver:'A' }, ['maker_checker']);
      return { pass: !r.completed, detail: !r.completed ? 'self-approval blocked' : 'should reject' };
  }},
  { name:'Compensation fires on failure (cleanly stops)', run() {
      const r = runChitThroughGate({ id:'c2', type:'order', author:'A', approver:'B', forceFail:true }, ['maker_checker','compensation']);
      const pass = !r.completed && r.remedy && r.remedy.clean === true;
      return { pass, detail: pass ? 'compensated — clean stop' : 'no clean remedy' };
  }},
];
