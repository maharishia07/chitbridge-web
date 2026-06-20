import { V0_1, V0_2 } from '../governance/constitutions';
import { VERTICALS } from '../governance/verticals';
import { cascade, layersFor } from '../governance/cascade';

// These ARE the test harness for the Vertical layer — all must be green before merge.
export const verticalScenarios = [
  { name: 'Vertical may tighten but never loosen the Constitution ceiling', run() {
      // Apparel wants 'public'; Constitution v0.1 caps at 'private' → clamped + flagged.
      const r = cascade(layersFor(V0_1, VERTICALS.apparel), {});
      const clamped = r.effective.catalogue_visibility === 'private';
      const flagged = r.exceptions.some(x => x.key === 'catalogue_visibility');
      const pass = clamped && flagged;
      return { pass, detail: pass ? "apparel 'public' clamped to constitution 'private' (flagged Class C)" : JSON.stringify(r.effective) };
  }},
  { name: 'Vertical adds a bound domain rule that cannot be overridden', run() {
      // Pharma binds batch_tracking; a user tries to switch it off.
      const r = cascade(layersFor(V0_1, VERTICALS.pharma), { batch_tracking: false });
      const enforced = r.effective.batch_tracking === true;
      const rejected = r.rejections.some(x => x.key === 'batch_tracking');
      const sourced  = r.provenance.batch_tracking && r.provenance.batch_tracking.source === 'Pharmaceuticals';
      const pass = enforced && rejected && sourced;
      return { pass, detail: pass ? 'batch_tracking forced true by Pharmaceuticals; override rejected (Class A)' : JSON.stringify(r) };
  }},
  { name: 'A tighter vertical wins over a looser constitution', run() {
      // Constitution v0.2 caps 'restricted'; Pharma tightens the ceiling to 'private'.
      const r = cascade(layersFor(V0_2, VERTICALS.pharma), {});
      const ceiling = r.provenance.catalogue_visibility && r.provenance.catalogue_visibility.cap;
      const pass = ceiling === 'private' && r.effective.catalogue_visibility === 'private';
      return { pass, detail: pass ? "ceiling tightened 'restricted' → 'private' by Pharmaceuticals" : `ceiling=${ceiling}` };
  }},
];
