// JurisdictionScreen.jsx
import React from 'react';
import { useSim } from './simStore';
import { composeCascade, jContrib } from '../governance/cascade';
import { JURISDICTIONS } from '../governance/jurisdictions';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { jurisdictionScenarios } from './jurisdictionScenarios';

const PAIN = `Go cross-border and the legal floor moves under you — data residency, tax, invoice format, retention — and generic software just lets you break it silently.`;
const PLEASURE = `Pick a region and the legal envelope is pinned as a floor. Nothing below can loosen it; switch country and the whole envelope snaps to the new regime.`;

export function JurisdictionScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const ac = activeConstitution();
  const j = JURISDICTIONS[state.selectedJurisdiction] || JURISDICTIONS.india;
  const r = composeCascade(ac, state.draftOverride, [jContrib(j)]);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Jurisdiction</h2><ModeToggle /></div>
      {state.mode === 'without' ? <div className="pain-card">{PAIN}</div> : (
        <>
          <div className="grid">
            <div className="panel">
              <h4>Region & law (pinned at install)</h4>
              <select value={state.selectedJurisdiction} onChange={e => dispatch({type:'SET_JURISDICTION', value:e.target.value})}>
                {Object.values(JURISDICTIONS).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
              <p className="hint">Switch region → the legal envelope snaps. These are floors (Class A).</p>
            </div>
            <div className="panel">
              <h4>Legal envelope</h4>
              <table className="prov"><tbody>
                {Object.entries(j.envelope).map(([k,v]) => <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}
              </tbody></table>
              <h4 style={{marginTop:10}}>Floors (cannot be loosened below)</h4>
              <div>{Object.entries(r.floors).map(([k,f]) => `${k}=${f.value}`).join(' · ') || '—'}</div>
            </div>
          </div>
          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}
      <ScenarioRunner scenarios={jurisdictionScenarios} />
    </div>
  );
}
