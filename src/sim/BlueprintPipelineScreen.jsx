import React, { useState } from 'react';
import { useSim } from './simStore';
import { ScenarioRunner } from './ScenarioRunner';
import { blueprintPipelineScenarios } from './blueprintPipelineScenarios';
import { assembleBusiness } from '../governance/cascade';
import { chitTypesFor, bornChit } from '../governance/chitBirth';

export function BlueprintPipelineScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const c = activeConstitution();
  const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction, standard:state.selectedStandard, content:state.selectedContent, erp:state.selectedErp, capabilities:state.capabilities };
  const biz = assembleBusiness(c, sel);
  const types = chitTypesFor(sel);
  const chit = bornChit(c, sel, types[0], 'chit author');
  const [frozen, setFrozen] = useState(null);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Blueprint pipeline <small>the four stages, end to end</small></h2></div>
      <div className="grid">
        <div className="panel"><h4>Stage 1-2 · Rulebook <small>converges by most-restrictive</small></h4>
          <table className="prov"><tbody>{Object.entries(biz.provenance).map(([k,p]) => <tr key={k}><td>{k}</td><td className="src-v">{String(p.value)}</td><td className="src-c">{p.source_layer}{p.floor?' (floor)':''}</td></tr>)}</tbody></table>
          {biz.conformant ? <div className="pass">✓ conformant</div> : biz.rejections.map((x,i)=><div className="reject" key={i}>✗ {x.reason}</div>)}</div>
        <div className="panel"><h4>Stage 1 · Data model <small>accumulates by union</small></h4>
          <div className="hint">{biz.schema.length} fields: {biz.schema.join(' · ')}</div></div>
      </div>
      <div className="grid">
        <div className="panel"><h4>Stage 3 · A chit is born</h4><div className="hint">{chit.chitType}: {chit.available.length} available + {chit.toAuthor.length} to author</div></div>
        <div className="panel"><h4>Stage 4 · Look & feel</h4><div className="hint">lens from the vertical preset — wording only, rules unchanged</div></div>
      </div>
      <div className="actions">
        <button onClick={() => setFrozen({ version:c.version, fields:biz.schema.length, at:new Date().toLocaleTimeString() })}>Freeze this Blueprint</button>
        <button onClick={() => dispatch({ type:'SAVE_BLUEPRINT', name:`${sel.vertical} BP` })}>Save to library</button>
      </div>
      {frozen && <div className="pleasure-card">Frozen under constitution v{frozen.version} · {frozen.fields} fields · {frozen.at}. Any chit minted from this carries that version forever.</div>}
      <ScenarioRunner scenarios={blueprintPipelineScenarios} />
    </div>
  );
}
