import { interpretRegulation, attest, toSourcePack } from '../governance/ingest';
import { runChitThroughGate } from '../governance/instructionPacks';
export const showcaseScenarios = [
  { name:'un-attested interpretation cannot be registered', run() {
      const r = toSourcePack(interpretRegulation('gdp'));
      return { pass: !r.ok, detail: r.ok ? 'wrongly registered' : 'blocked until attested' };
  }},
  { name:'attested interpretation registers with floors', run() {
      const r = toSourcePack(attest(interpretRegulation('gdpr'), 'expert'));
      return { pass: r.ok && !!r.pack.contributes.data_residency, detail: r.ok ? 'registered with residency floor' : 'no floor' };
  }},
  { name:'self-approval is rejected then compensated (cleanly stops)', run() {
      const g = runChitThroughGate({ id:'c', type:'x', author:'a', approver:'a', checked:true }, ['maker_checker','compensation']);
      return { pass: !g.completed && !!g.remedy && g.remedy.clean === true, detail: !g.completed ? 'stopped + compensated' : 'unexpected' };
  }},
  { name:'valid chit completes', run() {
      const g = runChitThroughGate({ id:'c', type:'x', author:'a', approver:'b', checked:true }, ['maker_checker','pdca','compensation']);
      return { pass: g.completed, detail: g.completed ? 'completed' : 'blocked' };
  }},
];
