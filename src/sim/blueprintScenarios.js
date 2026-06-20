import { V0_1, V0_2 } from '../governance/constitutions';
import { saveBlueprint, cloneInstance, driftOf } from '../governance/blueprint';

const sel = { vertical:'pharmacy', jurisdiction:'india', standard:'gdp_pharma', content:'distributor_feed', erp:'tally', capabilities:['batch_recall'] };

export const blueprintScenarios = [
  { name:'A Blueprint is a template — reusable, no transactions', run() {
      const bp = saveBlueprint(V0_1, sel, 'Pharma distributor');
      const pass = bp.entity_kind === 'template' && bp.transactions === null && bp.resolved.schema.length > 0;
      return { pass, detail: pass ? 'template, no transactions, carries the resolved shape' : 'unexpected' };
  }},
  { name:'Your business is an instance that inherits the Blueprint', run() {
      const bp = saveBlueprint(V0_1, sel, 'Pharma distributor');
      const inst = cloneInstance(bp, V0_1, { name:'Acme Pharma' });
      const pass = inst.entity_kind === 'instance' && inst.blueprintId === bp.id
                && inst.effective.tax_scheme === bp.resolved.effective.tax_scheme;
      return { pass, detail: pass ? 'cloned instance inherits the floors + shape' : 'did not inherit' };
  }},
  { name:'The overlay tweaks within the Blueprint but cannot loosen a floor', run() {
      const bp = saveBlueprint(V0_2, sel, 'Pharma distributor');           // v0.2 cap = restricted
      const inst = cloneInstance(bp, V0_2, { catalogue_visibility:'public' }); // try to loosen
      const pass = inst.effective.catalogue_visibility !== 'public';
      return { pass, detail: pass ? 'instance tweak capped by inherited governance' : 'overlay escaped bounds' };
  }},
  { name:'Change the constitution → business shows Update available (drift)', run() {
      const bp = saveBlueprint(V0_1, sel, 'Pharma distributor');
      const inst = cloneInstance(bp, V0_1, { name:'Acme' });
      const pass = driftOf(inst, V0_2) === true;
      return { pass, detail: pass ? 'minted v0.1, active v0.2 → update available' : 'no drift' };
  }},
];
