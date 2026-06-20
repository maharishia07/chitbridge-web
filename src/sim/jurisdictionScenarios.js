import { V0_1 } from '../governance/constitutions';
import { JURISDICTIONS } from '../governance/jurisdictions';
import { composeCascade, jContrib } from '../governance/cascade';
export const jurisdictionScenarios = [
  { name:'India sets a data-residency floor', run() {
      const r = composeCascade(V0_1, {}, [jContrib(JURISDICTIONS.india)]);
      return { pass: r.effective.data_residency === 'in' && !!r.floors.data_residency, detail:`residency floored at ${r.effective.data_residency}` };
  }},
  { name:'EU proposes restricted visibility (capped by constitution)', run() {
      const r = composeCascade(V0_1, {}, [jContrib(JURISDICTIONS.eu)]);
      return { pass: r.effective.catalogue_visibility === 'private', detail:`visibility ${r.effective.catalogue_visibility}` };
  }},
  { name:'each jurisdiction carries its own retention floor', run() {
      const eu = composeCascade(V0_1, {}, [jContrib(JURISDICTIONS.eu)]).effective.retention_years;
      return { pass: eu === 10, detail:`EU retention ${eu}y` };
  }},
];
