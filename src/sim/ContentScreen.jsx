import React from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { contentScenarios } from './contentScenarios';
import { CONTENT_PACKS } from '../governance/content';

export function ContentScreen() {
  const { state, dispatch } = useSim();
  const c = CONTENT_PACKS[state.selectedContent];
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>Content <small>catalogue sources</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> catalogue data is copy-pasted between systems; no record of which source a listing came from, and visibility is set ad-hoc.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Content <small>{c.label}</small></h2><ModeToggle /></div>
      <div className="actions">
        {Object.values(CONTENT_PACKS).map(x => <button key={x.id} className={x.id===state.selectedContent?'on':''} onClick={() => dispatch({ type:'SET_CONTENT', value:x.id })}>{x.label}</button>)}
      </div>
      <div className="grid">
        <div className="panel"><h4>References</h4><ul>{c.references.map(r=><li key={r}>{r}</li>)}</ul>
          <h4>Requires fields</h4><ul>{c.requires_fields.map(f=><li key={f}>{f}</li>)}</ul></div>
        <div className="panel"><h4>Visibility it proposes</h4><div className="src-v">{c.visibility_contribution}</div>
          <div className="hint">A tighten proposal — the constitution's cap still wins if it's stricter.</div></div>
      </div>
      <ScenarioRunner scenarios={contentScenarios} />
    </div>
  );
}
