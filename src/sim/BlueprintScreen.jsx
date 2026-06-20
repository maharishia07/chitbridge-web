import React, { useState } from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { blueprintScenarios } from './blueprintScenarios';
import { driftOf } from '../governance/blueprint';

const PAIN = `Every new business is rebuilt from zero — re-pick the industry, re-enter the rules, re-wire compliance. Nothing is reusable, and no two end up the same.`;
const PLEASURE = `Save a configured setup as a Blueprint once. Spin any number of businesses from it in seconds — each inherits the rules, each can tweak within them, none can break them.`;

export function BlueprintScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const ac = activeConstitution();
  const [bpName, setBpName] = useState('Pharma distributor');
  const [bizName, setBizName] = useState('Acme Pharma');
  const [vis, setVis] = useState('inherit');

  const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction, standard:state.selectedStandard,
                content:state.selectedContent, erp:state.selectedErp, capabilities:state.capabilities };

  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Blueprint <small>(the template you clone)</small></h2><ModeToggle /></div>
      {state.mode === 'without' ? <div className="pain-card">{PAIN}</div> : (
        <>
          <div className="panel">
            <h4>Save the current configuration as a Blueprint</h4>
            <p className="hint">Current: {sel.vertical} · {sel.jurisdiction} · {sel.standard} · {sel.content} · {sel.erp}
              &nbsp;— set these on the layer tabs or apply a preset on “Spin a business”.</p>
            <div className="clone-row">
              <input value={bpName} onChange={e=>setBpName(e.target.value)} placeholder="Blueprint name" />
              <button onClick={() => dispatch({ type:'SAVE_BLUEPRINT', name:bpName })}>Save as Blueprint</button>
            </div>
          </div>

          <div className="grid">
            <div className="panel">
              <h4>Blueprints <small>(templates · no transactions)</small></h4>
              {state.blueprints.length === 0 && <p className="hint">None yet — save one above.</p>}
              {state.blueprints.map(bp => (
                <div key={bp.id} className="card">
                  <div><b>{bp.name}</b> · template · minted v{bp.mintedVersion} {driftOf(bp, ac) && <span className="exception">update available</span>}</div>
                  <div className="hint">{bp.resolved.schema.length} schema fields · {bp.resolved.certifications.join(', ')||'no certs'} · {bp.resolved.connectors.join(', ')||'no connector'}</div>
                  <div className="clone-row">
                    <input value={bizName} onChange={e=>setBizName(e.target.value)} placeholder="Your business name" />
                    <select value={vis} onChange={e=>setVis(e.target.value)}>
                      <option value="inherit">visibility: inherit</option>
                      <option value="private">tighten: private</option>
                      <option value="public">try: public</option>
                    </select>
                    <button onClick={() => dispatch({ type:'CLONE_INSTANCE', blueprintId:bp.id, name:bizName,
                      overlay: vis==='inherit' ? {} : { catalogue_visibility:vis } })}>Clone → Your business</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel">
              <h4>Your businesses <small>(instances · where transactions live)</small></h4>
              {state.instances.length === 0 && <p className="hint">None yet — clone one from a Blueprint.</p>}
              {state.instances.map(inst => (
                <div key={inst.id} className="card">
                  <div><b>{inst.name}</b> · instance of {inst.blueprintName} · minted v{inst.mintedVersion}
                    {driftOf(inst, ac) && <button style={{marginLeft:8}} onClick={()=>dispatch({type:'APPLY_UPDATE', id:inst.id})}>Apply update</button>}</div>
                  <div className="hint">visibility {inst.effective.catalogue_visibility} · tax {inst.effective.tax_scheme} · currency {inst.effective.currency_code}</div>
                  {inst.exceptions.filter(x=>x.klass==='note').map((x,i)=><div key={i} className="exception">{x.reason}</div>)}
                </div>
              ))}
            </div>
          </div>
          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}
      <ScenarioRunner scenarios={blueprintScenarios} />
    </div>
  );
}
