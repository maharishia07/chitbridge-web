import { resolve } from '../governance/resolver';
import { V0_1, V0_2 } from '../governance/constitutions';
export const constitutionScenarios = [
  { name:'currency override is advisory (accepted, flagged)', run() {
      const r = resolve(V0_1, { currency_code:'USD' });
      const pass = r.effective.currency_code === 'USD' && r.exceptions.some(e=>e.key==='currency_code');
      return { pass, detail: pass ? 'USD accepted + flagged' : 'unexpected' };
  }},
  { name:'language ta rejected under v0.1 (Class B)', run() {
      const r = resolve(V0_1, { allowed_languages:['ta'] });
      return { pass: r.rejections.some(x=>x.key==='allowed_languages'), detail:'ta not in v0.1 set' };
  }},
  { name:'language ta accepted under v0.2', run() {
      const r = resolve(V0_2, { allowed_languages:['ta'] });
      return { pass: r.ok && r.effective.allowed_languages.includes('ta'), detail:'ta accepted' };
  }},
  { name:'visibility cannot loosen past cap (v0.1 private)', run() {
      const r = resolve(V0_1, { catalogue_visibility:'public' });
      return { pass: r.rejections.some(x=>x.key==='catalogue_visibility'), detail:'public rejected' };
  }},
];
