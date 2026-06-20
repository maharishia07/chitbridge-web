import React from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { dataDefinitionScenarios } from './dataDefinitionScenarios';
import { gatherDataDefinition } from '../governance/cascade';

export function DataDefinitionScreen() {
  const { state, activeConstitution } = useSim();
  const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction, standard:state.selectedStandard, content:state.selectedContent, erp:state.selectedErp, capabilities:state.capabilities };
  const dd = gatherDataDefinition(activeConstitution(), sel);
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>Data definition <small>Stage 1 — the union</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> nobody can say what fields a record needs — each team guesses, and the list drifts apart across systems.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Data definition <small>{dd.fields.length} fields, unioned</small></h2><ModeToggle /></div>
      <div className="panel"><h4>Every field, traced to the layer(s) that required it</h4>
        <table className="prov"><tbody>{dd.fields.map(f => <tr key={f}><td>{f}</td><td className="src-c">{dd.provenance[f].join(' + ')}</td></tr>)}</tbody></table>
        <div className="hint">Data accumulates by <b>union</b> — every layer adds its fields. (Rules, by contrast, converge by restriction.)</div></div>
      <ScenarioRunner scenarios={dataDefinitionScenarios} />
    </div>
  );
}
