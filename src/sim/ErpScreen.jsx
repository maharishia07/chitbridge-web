// ErpScreen.jsx
import React from 'react';
import { useSim } from './simStore';
import { composeCascade, eContrib, jContrib } from '../governance/cascade';
import { ERP_SOURCES } from '../governance/erp';
import { JURISDICTIONS } from '../governance/jurisdictions';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { erpScenarios } from './erpScenarios';

const PAIN = `Connect an external system and it drags in its own rules — or quietly overrides yours. Integrations become the hole in the floor.`;
const PLEASURE = `Connect your system through a governed membrane: objects flow in and are added, but every one passes conformance. It can add, never override a floor.`;

export function ErpScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const ac = activeConstitution();
  const e = ERP_SOURCES[state.selectedErp] || ERP_SOURCES.none;
  const r = composeCascade(ac, state.draftOverride, [jContrib(JURISDICTIONS[state.selectedJurisdiction] || JURISDICTIONS.india), eContrib(e)]);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>ERP / connect your system</h2><ModeToggle /></div>
      {state.mode === 'without' ? <div className="pain-card">{PAIN}</div> : (
        <>
          <div className="grid">
            <div className="panel">
              <h4>External system</h4>
              <select value={state.selectedErp} onChange={ev => dispatch({type:'SET_ERP', value:ev.target.value})}>
                {Object.values(ERP_SOURCES).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <div className="panel">
              <h4>Governed membrane (additive)</h4>
              <div><b>Object source:</b> {e.adds.object_source || '—'}</div>
              <div><b>Synced objects:</b> {(e.adds.synced_objects||[]).join(', ') || '—'}</div>
              {r.rejections.length > 0 && <div className="reject">REJECTED: {r.rejections.map(x=>x.reason).join('; ')}</div>}
            </div>
          </div>
          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}
      <ScenarioRunner scenarios={erpScenarios} />
    </div>
  );
}
