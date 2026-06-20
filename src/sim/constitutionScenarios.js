import { V0_1, V0_2 } from '../governance/constitutions';
import { resolve, mint, viewEntity, reattest } from '../governance/resolver';

export const constitutionScenarios = [
  { name: 'Loosening override is rejected', run() {
      const r = resolve(V0_1, { catalogue_visibility: 'public' });
      const pass = !r.ok && r.rejections.some(x => x.key === 'catalogue_visibility');
      return { pass, detail: pass ? 'public rejected (tighten-only)' : 'expected rejection' };
  }},
  { name: 'Upgrade leaves existing entity frozen (drift, not silent change)', run() {
      const m = mint(V0_1, {}, V0_1.plan_menu.free);
      const v = viewEntity(m.entity, V0_2);
      const pass = v.drift === true && v.effective.currency_code === 'INR';
      return { pass, detail: pass ? 'drift=true, still INR (stamped lineage held)' : JSON.stringify(v.effective) };
  }},
  { name: 'Re-attest clears drift and moves entity forward', run() {
      const m = mint(V0_1, {}, V0_1.plan_menu.free);
      const ra = reattest(m.entity, V0_2);
      const v = viewEntity(ra.entity, V0_2);
      const pass = ra.ok && v.drift === false && v.effective.currency_code === 'USD';
      return { pass, detail: pass ? 'drift cleared, now USD; frozen chits untouched' : 'unexpected' };
  }},
];
