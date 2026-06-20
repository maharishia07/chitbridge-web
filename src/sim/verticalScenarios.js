import { V0_1 } from '../governance/constitutions';
import { VERTICALS } from '../governance/verticals';
import { composeVertical } from '../governance/cascade';
export const verticalScenarios = [
  { name:'marketplace proposes public but the constitution caps it', run() {
      const r = composeVertical(V0_1, {}, VERTICALS.marketplace);
      return { pass: r.effective.catalogue_visibility === 'private', detail:`visibility = ${r.effective.catalogue_visibility} (capped)` };
  }},
  { name:'pharmacy brings its schema fields', run() {
      const r = composeVertical(V0_1, {}, VERTICALS.pharmacy);
      return { pass: r.schema.includes('batch_no'), detail:'batch_no present' };
  }},
  { name:'each vertical yields its own chit types', run() {
      const t = composeVertical(V0_1, {}, VERTICALS.hospital).chitTypes;
      return { pass: t.includes('admission'), detail:t.join(',') };
  }},
];
