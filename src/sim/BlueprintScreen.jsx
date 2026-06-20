import React, { useState } from 'react';
import { useSim } from './simStore';
import { ScenarioRunner } from './ScenarioRunner';
import { blueprintScenarios } from './blueprintScenarios';
import { driftOf } from '../governance/blueprint';

export function BlueprintScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const c = activeConstitution();
  const [bpName, setBpName] = useState('Pharma distributor BP');
  const [instName, setInstName] = useState('Acme Pharma');
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Blueprint ⧉ <small>template → instance</small></h2></div>
      <div className="grid">
        <div className="panel"><h4>1 · Save current stack as a Blueprint</h4>
          <div className="clone-row"><input value={bpName} onChange={e=>setBpName(e.target.value)} /><button onClick={() => dispatch({ type:'SAVE_BLUEPRINT', name:bpName })}>Save Blueprint</button></div>
          <div className="hint">A Blueprint is a pre-resolved template — no transactions. Clone it to get a running business.</div>
          {state.blueprints.map(bp => (
            <div className="card" key={bp.id}><b>{bp.name}</b> · v{bp.mintedVersion} · {bp.resolved.schema.length} fields
              <div className="clone-row"><input value={instName} onChange={e=>setInstName(e.target.value)} />
                <button onClick={() => dispatch({ type:'CLONE_INSTANCE', blueprintId:bp.id, name:instName, overlay:{ currency_code:'USD' } })}>Clone instance</button></div></div>
          ))}</div>
        <div className="panel"><h4>2 · Instances (your businesses)</h4>
          {state.instances.length===0 && <div className="hint">none yet — save a blueprint, then clone.</div>}
          {state.instances.map(inst => (
            <div className="card" key={inst.id}><b>{inst.name}</b> <span className="src-c">from {inst.blueprintName}</span>
              <div>currency: <span className="src-v">{inst.effective.currency_code}</span></div>
              {driftOf(inst, c) ? <button onClick={() => dispatch({ type:'APPLY_UPDATE', id:inst.id })}>drift → apply update</button> : <span className="pass">current with v{c.version}</span>}</div>
          ))}</div>
      </div>
      <ScenarioRunner scenarios={blueprintScenarios} />
    </div>
  );
}
