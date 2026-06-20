// ContentScreen.jsx
import React from 'react';
import { useSim } from './simStore';
import { composeCascade, cContrib } from '../governance/cascade';
import { CONTENT_PACKS } from '../governance/content';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { contentScenarios } from './contentScenarios';

const PAIN = `Catalogue data is copied, re-keyed and stale across partners — and someone always over-exposes a price list they shouldn't.`;
const PLEASURE = `Compose your catalogue from referenced packs. Visibility is bounded by the layers above — you can tighten, never loosen past the ceiling.`;

export function ContentScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const ac = activeConstitution();
  const c = CONTENT_PACKS[state.selectedContent] || CONTENT_PACKS.own_only;
  const r = composeCascade(ac, state.draftOverride, [cContrib(c)]);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Content</h2><ModeToggle /></div>
      {state.mode === 'without' ? <div className="pain-card">{PAIN}</div> : (
        <>
          <div className="grid">
            <div className="panel">
              <h4>Catalogue composition</h4>
              <select value={state.selectedContent} onChange={e => dispatch({type:'SET_CONTENT', value:e.target.value})}>
                {Object.values(CONTENT_PACKS).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <div className="panel">
              <h4>Resolved (content over constitution v{ac.version})</h4>
              <div><b>Referenced packs:</b> {c.references.join(', ')}</div>
              <div><b>Effective visibility:</b> {r.effective.catalogue_visibility}</div>
              {r.exceptions.filter(x=>x.klass==='note').map((x,i)=><div key={i} className="exception">{x.reason}</div>)}
            </div>
          </div>
          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}
      <ScenarioRunner scenarios={contentScenarios} />
    </div>
  );
}
