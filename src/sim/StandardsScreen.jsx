// StandardsScreen.jsx
import React from 'react';
import { useSim } from './simStore';
import { STANDARDS } from '../governance/standards';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { standardsScenarios } from './standardsScenarios';

const PAIN = `Certifications live in binders, not the system. Required fields and checks are remembered by people — so audits fail and recalls are slow.`;
const PLEASURE = `Attach a certification and its required fields and checks cascade into the model. A missing capability is a hard reject, not a surprise at audit time.`;

export function StandardsScreen() {
  const { state, dispatch } = useSim();
  const std = STANDARDS[state.selectedStandard] || STANDARDS.none;
  const granted = state.capabilities || [];
  const missing = (std.requires_capabilities || []).filter(c => !granted.includes(c));
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Standards</h2><ModeToggle /></div>
      {state.mode === 'without' ? <div className="pain-card">{PAIN}</div> : (
        <>
          <div className="grid">
            <div className="panel">
              <h4>Certification</h4>
              <select value={state.selectedStandard} onChange={e => dispatch({type:'SET_STANDARD', value:e.target.value})}>
                {Object.values(STANDARDS).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <h4 style={{marginTop:10}}>Granted capabilities</h4>
              {['batch_recall','audit_trail','lot_traceability'].map(cap => (
                <label key={cap} style={{display:'block'}}>
                  <input type="checkbox" checked={granted.includes(cap)} onChange={() => dispatch({type:'TOGGLE_CAPABILITY', cap})} /> {cap}
                </label>
              ))}
            </div>
            <div className="panel">
              <h4>Cascaded requirements</h4>
              <div><b>Required fields:</b> {std.requires_fields.join(', ') || '—'}</div>
              <div><b>Required capabilities (Class B):</b> {std.requires_capabilities.join(', ') || '—'}</div>
              <div><b>Advisories (Class C):</b> {std.advisories.join(', ') || '—'}</div>
              {missing.length > 0
                ? <div className="reject">REJECTED: missing capability {missing.join(', ')} — grant it to conform</div>
                : <div className="pass" style={{marginTop:8}}>✓ conformant</div>}
            </div>
          </div>
          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}
      <ScenarioRunner scenarios={standardsScenarios} />
    </div>
  );
}
