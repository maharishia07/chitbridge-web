import React from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { jurisdictionScenarios } from './jurisdictionScenarios';
import { JURISDICTIONS } from '../governance/jurisdictions';

export function JurisdictionScreen() {
  const { state, dispatch } = useSim();
  const j = JURISDICTIONS[state.selectedJurisdiction];
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>Jurisdiction <small>legal floor</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> tax, invoice format, data-residency and retention rules are wired by hand per country, and silently go stale when the law changes.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Jurisdiction <small>{j.label}</small></h2><ModeToggle /></div>
      <div className="actions">
        {Object.values(JURISDICTIONS).map(x => <button key={x.id} className={x.id===state.selectedJurisdiction?'on':''} onClick={() => dispatch({ type:'SET_JURISDICTION', value:x.id })}>{x.label}</button>)}
      </div>
      <div className="grid">
        <div className="panel"><h4>Legal envelope (floor)</h4>
          <table className="prov"><tbody>{Object.entries(j.envelope).map(([k,v]) => <tr key={k}><td>{k}</td><td className="src-v">{String(v)}</td></tr>)}</tbody></table></div>
        <div className="panel"><h4>Fields it requires</h4><ul>{j.requires_fields.map(f=><li key={f}>{f}</li>)}</ul>
          <div className="hint">These floors only tighten — a business can add stricter handling, never loosen below them.</div></div>
      </div>
      <ScenarioRunner scenarios={jurisdictionScenarios} />
    </div>
  );
}
