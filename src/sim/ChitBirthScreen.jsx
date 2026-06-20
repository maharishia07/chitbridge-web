import React, { useState } from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { chitBirthScenarios } from './chitBirthScenarios';
import { chitTypesFor, bornChit } from '../governance/chitBirth';

export function ChitBirthScreen() {
  const { state, activeConstitution } = useSim();
  const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction, standard:state.selectedStandard, content:state.selectedContent, erp:state.selectedErp, capabilities:state.capabilities };
  const types = chitTypesFor(sel);
  const [type, setType] = useState(types[0]);
  const chit = bornChit(activeConstitution(), sel, types.includes(type)?type:types[0], 'chit author');
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>How a chit is born <small>Stage 3</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> every document is a blank form. The sender re-keys everything, and nothing knows which fields are mandatory or already on file.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>How a chit is born <small>{chit.chitType}</small></h2><ModeToggle /></div>
      <div className="actions">{types.map(t => <button key={t} className={t===chit.chitType?'on':''} onClick={()=>setType(t)}>{t}</button>)}</div>
      <div className="grid">
        <div className="panel"><h4>Already available ({chit.available.length})</h4>
          <div className="hint">pulled from your system — no re-keying</div>
          <ul>{chit.available.map(f=><li key={f.field}>{f.field} <span className="src-c">[{f.moscow}]</span></li>)}</ul></div>
        <div className="panel"><h4>To author ({chit.toAuthor.length})</h4>
          <div className="hint">the gap = required − available</div>
          <ul>{chit.toAuthor.map(f=><li key={f.field}>{f.field} <span className="src-c">[{f.moscow}] ← {f.by.join('+')}</span></li>)}</ul></div>
      </div>
      <div className="hint">{chit.mustCount} Must-fields · born under constitution v{chit.mintedVersion} (frozen at send).</div>
      <ScenarioRunner scenarios={chitBirthScenarios} />
    </div>
  );
}
