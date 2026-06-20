import React from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { standardsScenarios } from './standardsScenarios';
import { STANDARDS } from '../governance/standards';

export function StandardsScreen() {
  const { state, dispatch } = useSim();
  const s = STANDARDS[state.selectedStandard];
  const missing = (s.requires_capabilities||[]).filter(c => !state.capabilities.includes(c));
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>Standards <small>certifications</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> certification requirements live in PDFs and auditors' heads — nothing in the system enforces that a certified process actually has the capability it claims.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Standards <small>{s.label}</small></h2><ModeToggle /></div>
      <div className="actions">
        {Object.values(STANDARDS).map(x => <button key={x.id} className={x.id===state.selectedStandard?'on':''} onClick={() => dispatch({ type:'SET_STANDARD', value:x.id })}>{x.label}</button>)}
      </div>
      <div className="grid">
        <div className="panel"><h4>Requires fields</h4><ul>{s.requires_fields.map(f=><li key={f}>{f}</li>)}</ul>
          <h4>Requires capabilities</h4>
          {(s.requires_capabilities||[]).map(cap => <label key={cap}><input type="checkbox" checked={state.capabilities.includes(cap)} onChange={() => dispatch({ type:'TOGGLE_CAPABILITY', cap })} /> {cap}</label>)}</div>
        <div className="panel"><h4>Conformance</h4>
          {s.id==='none' ? <div className="pass">no standard selected</div> :
            missing.length ? missing.map(m=><div className="reject" key={m}>✗ requires '{m}' (not granted) — HARD REJECT (Class B)</div>)
                           : <div className="pass">✓ all required capabilities granted</div>}
          {(s.advisories||[]).map(a=><div className="exception" key={a}>⚑ advisory: {a}</div>)}</div>
      </div>
      <ScenarioRunner scenarios={standardsScenarios} />
    </div>
  );
}
