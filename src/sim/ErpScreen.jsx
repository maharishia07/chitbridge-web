import React from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { erpScenarios } from './erpScenarios';
import { ERP_SOURCES } from '../governance/erp';

export function ErpScreen() {
  const { state, dispatch } = useSim();
  const e = ERP_SOURCES[state.selectedErp];
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>ERP / source <small>system of record</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> integrating an ERP is a bespoke project each time, and the external data lands ungoverned — no conformance check at the boundary.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>ERP / source <small>{e.label}</small></h2><ModeToggle /></div>
      <div className="actions">
        {Object.values(ERP_SOURCES).map(x => <button key={x.id} className={x.id===state.selectedErp?'on':''} onClick={() => dispatch({ type:'SET_ERP', value:x.id })}>{x.label}</button>)}
      </div>
      <div className="grid">
        <div className="panel"><h4>What it adds (additive)</h4>
          {e.adds.object_source ? <div className="src-v">object_source = {e.adds.object_source}</div> : <div className="hint">nothing — no external system</div>}
          {e.adds.synced_objects && <ul>{e.adds.synced_objects.map(o=><li key={o}>{o}</li>)}</ul>}</div>
        <div className="panel"><h4>Fields it makes available</h4>
          <ul>{e.requires_fields.map(f=><li key={f}>{f} <span className="hint">(from your system)</span></li>)}</ul>
          <div className="hint">Additive only — a source may add data, never loosen a floor.</div></div>
      </div>
      <ScenarioRunner scenarios={erpScenarios} />
    </div>
  );
}
