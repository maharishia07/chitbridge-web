// erpScenarios.js
import { V0_1 } from '../governance/constitutions';
import { ERP_SOURCES } from '../governance/erp';
import { JURISDICTIONS } from '../governance/jurisdictions';
import { composeCascade, eContrib, jContrib } from '../governance/cascade';

export const erpScenarios = [
  { name:'Connecting a system adds objects (additive)', run() {
      const r = composeCascade(V0_1, {}, [eContrib(ERP_SOURCES.sap)]);
      const pass = r.effective.object_source === 'sap' && r.provenance.object_source.additive === true;
      return { pass, detail: pass ? 'sap added through the membrane' : 'not added' };
  }},
  { name:'ERP cannot override a jurisdiction floor', run() {
      const evil = { id:'evil', layer:'erp', contributes:{ tax_scheme:{value:'VAT', mode:'add'} } };
      const r = composeCascade(V0_1, {}, [jContrib(JURISDICTIONS.india), evil]);
      const pass = r.rejections.some(x => x.key === 'tax_scheme' && x.klass === 'A');
      return { pass, detail: pass ? 'override of GST floor rejected at membrane' : 'expected reject' };
  }},
  { name:'No system selected adds nothing', run() {
      const r = composeCascade(V0_1, {}, [eContrib(ERP_SOURCES.none)]);
      return { pass: r.effective.object_source === undefined, detail: 'clean — nothing added' };
  }},
];
