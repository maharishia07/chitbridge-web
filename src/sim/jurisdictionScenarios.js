// jurisdictionScenarios.js
import { V0_1 } from '../governance/constitutions';
import { JURISDICTIONS } from '../governance/jurisdictions';
import { composeCascade, jContrib } from '../governance/cascade';

export const jurisdictionScenarios = [
  { name:'Switching region snaps the legal envelope', run() {
      const a = JURISDICTIONS.india.envelope, b = JURISDICTIONS.eu.envelope;
      const pass = a.data_residency !== b.data_residency && a.tax_scheme !== b.tax_scheme;
      return { pass, detail: pass ? 'residency + tax differ per region' : 'envelope did not change' };
  }},
  { name:'A lower layer cannot loosen a jurisdiction floor', run() {
      const evilErp = { id:'evil', layer:'erp', contributes:{ tax_scheme:{value:'VAT', mode:'add'} } };
      const r = composeCascade(V0_1, {}, [jContrib(JURISDICTIONS.india), evilErp]);
      const pass = r.rejections.some(x => x.key === 'tax_scheme' && x.klass === 'A');
      return { pass, detail: pass ? 'ERP override of GST floor rejected (Class A)' : 'expected a rejection' };
  }},
  { name:'Floor is provenance-tagged to the jurisdiction', run() {
      const r = composeCascade(V0_1, {}, [jContrib(JURISDICTIONS.india)]);
      const pr = r.provenance.data_residency;
      const pass = pr.source_layer === 'jurisdiction' && pr.floor === true;
      return { pass, detail: pass ? "data_residency floor, source='jurisdiction'" : JSON.stringify(pr) };
  }},
];
