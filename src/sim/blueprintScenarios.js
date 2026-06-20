import { V0_1, V0_2 } from '../governance/constitutions';
import { saveBlueprint, cloneInstance, driftOf, applyUpdate } from '../governance/blueprint';
const sel = { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'none', capabilities:[] };
export const blueprintScenarios = [
  { name:'a Blueprint is a template (no transactions)', run() {
      const bp = saveBlueprint(V0_1, sel, 'BP');
      return { pass: bp.entity_kind==='template' && bp.transactions===null, detail:'template, no transactions' };
  }},
  { name:'an instance inherits the blueprint stack + its overlay', run() {
      const inst = cloneInstance(saveBlueprint(V0_1, sel, 'BP'), V0_1, { currency_code:'USD' }, 'Acme');
      return { pass: inst.entity_kind==='instance' && inst.effective.currency_code==='USD', detail:`instance currency ${inst.effective.currency_code}` };
  }},
  { name:'instance drifts on a constitution bump, re-aligns on update', run() {
      const bp = saveBlueprint(V0_1, sel, 'BP');
      const inst = cloneInstance(bp, V0_1, {}, 'Acme');
      const drift = driftOf(inst, V0_2);
      const updated = applyUpdate(inst, bp.selection, V0_2);
      return { pass: drift === true && updated.mintedVersion === '0.2', detail:'drift → updated to v0.2' };
  }},
];
