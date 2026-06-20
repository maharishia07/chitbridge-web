import React, { useState } from 'react';
import { PENDING_DECISIONS } from './pendingDecisions';
import { ScenarioRunner } from './ScenarioRunner';
import { pendingDecisionsScenarios } from './pendingDecisionsScenarios';

export function PendingDecisionsScreen() {
  const pending = PENDING_DECISIONS.filter(d => d.status === 'pending');
  const [open, setOpen] = useState(pending[0]?.id || null);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>⚠ Pending decisions <small>decide collectively</small></h2></div>
      <p className="hint">{pending.length} open. Each is tagged to a layer and shown with a concrete example — so the room can decide from something visible, not an abstraction.</p>
      {pending.map(d => (
        <div key={d.id} className="panel">
          <div className="entity-row" style={{cursor:'pointer'}} onClick={()=>setOpen(open===d.id?null:d.id)}>
            <span><b>{d.id}</b> · <span className="src-v">{d.layer}</span> · {d.title}</span>
            <span className="exception">decision pending</span></div>
          {open===d.id && (
            <div style={{marginTop:8}}>
              <div className="hint">{d.question}</div>
              {d.example && (
                <div className="skin" style={{marginTop:8}}>
                  <b>Example — {d.example.key}:</b>
                  <div>① {d.example.a.source} requires <b>{d.example.a.value}</b> (floor)</div>
                  <div>② {d.example.b.source} requires <b>{d.example.b.value}</b> (floor)</div>
                  <div className="reject">⚠ no common value → the engine has no defined answer yet</div></div>
              )}
              <h4 style={{marginTop:8}}>Options</h4>
              <ul>{d.options.map((o,i)=><li key={i}>{o}</li>)}</ul>
              <div className="pass">Recommended: {d.recommended}</div>
              <div className="hint">Gates: {d.gates}</div></div>
          )}
        </div>
      ))}
      <ScenarioRunner scenarios={pendingDecisionsScenarios} />
    </div>
  );
}
