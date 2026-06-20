import React from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { verticalScenarios } from './verticalScenarios';
import { VERTICALS } from '../governance/verticals';
import { composeVertical } from '../governance/cascade';

export function VerticalScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const v = VERTICALS[state.selectedVertical];
  const r = composeVertical(activeConstitution(), {}, v);
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>Vertical <small>industry shape</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> each industry rebuilds the same scaffolding — fields, document types, visibility defaults — from scratch, and inconsistently.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Vertical <small>{v.label}</small></h2><ModeToggle /></div>
      <div className="actions">
        {Object.values(VERTICALS).map(x => <button key={x.id} className={x.id===state.selectedVertical?'on':''} onClick={() => dispatch({ type:'SET_VERTICAL', vertical:x.id })}>{x.label}</button>)}
      </div>
      <div className="grid">
        <div className="panel"><h4>Data fields it brings</h4><ul>{v.schema.map(f=><li key={f}>{f}</li>)}</ul>
          <h4>Chit types</h4><ul>{v.chit_types.map(t=><li key={t}>{t}</li>)}</ul></div>
        <div className="panel"><h4>Resolved with the constitution</h4>
          <table className="prov"><tbody>
            {Object.entries(r.provenance).map(([k,p]) => <tr key={k}><td>{k}</td><td className="src-v">{String(p.value)}</td><td className="src-c">{p.source_layer}</td></tr>)}
          </tbody></table>
          <div className="hint">Preset lenses: {Object.entries(v.preset_lenses).map(([k,val])=>`${k}=${val}`).join(' · ')}</div></div>
      </div>
      <ScenarioRunner scenarios={verticalScenarios} />
    </div>
  );
}
