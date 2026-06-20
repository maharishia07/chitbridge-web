// contentScenarios.js
import { V0_1, V0_2 } from '../governance/constitutions';
import { CONTENT_PACKS } from '../governance/content';
import { JURISDICTIONS } from '../governance/jurisdictions';
import { composeCascade, cContrib, jContrib } from '../governance/cascade';

export const contentScenarios = [
  { name:'Content references compose per pack', run() {
      const a = CONTENT_PACKS.own_only.references, b = CONTENT_PACKS.distributor_feed.references;
      const pass = a.length !== b.length;
      return { pass, detail: pass ? 'referenced packs differ per choice' : 'same refs' };
  }},
  { name:'Open marketplace visibility is capped by the constitution', run() {
      const r = composeCascade(V0_1, {}, [cContrib(CONTENT_PACKS.open_market)]); // cap = private under v0.1
      const pass = r.effective.catalogue_visibility !== 'public' && r.exceptions.some(x=>x.klass==='note');
      return { pass, detail: pass ? 'public capped, recorded' : 'expected a cap' };
  }},
  { name:'Cannot loosen past a region ceiling', run() {
      const r = composeCascade(V0_2, {}, [jContrib(JURISDICTIONS.eu), cContrib(CONTENT_PACKS.open_market)]); // eu→restricted, v0.2 cap restricted
      const pass = r.effective.catalogue_visibility === 'restricted';
      return { pass, detail: pass ? 'public capped to restricted by the stack above' : r.effective.catalogue_visibility };
  }},
];
