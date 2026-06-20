import React, { useState } from 'react';
import { listRegulations, interpretRegulation, attest, toSourcePack } from '../governance/ingest';
import { runChitThroughGate } from '../governance/instructionPacks';
import { ScenarioRunner } from './ScenarioRunner';
import { showcaseScenarios } from './showcaseScenarios';

export function ShowcaseScreen() {
  const [regId, setRegId] = useState('gdp');
  const [pack, setPack] = useState(null);
  const [attested, setAttested] = useState(false);
  const [registered, setRegistered] = useState(null);
  const [chit, setChit] = useState({ id:'c1', type:'order', author:'Asha', approver:'Asha', forceFail:false });
  const [gate, setGate] = useState(null);

  const reg = listRegulations().find(r => r.id === regId);
  const doInterpret = () => { setPack(interpretRegulation(regId)); setAttested(false); setRegistered(null); };
  const doRegister  = () => setRegistered(toSourcePack(attested ? attest(pack,'domain expert') : pack));

  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>★ Showcase — the whole story</h2></div>

      <div className="panel">
        <h4>Act 1 · Ingest a regulation <small>Source = input → process → output</small></h4>
        <select value={regId} onChange={e=>{ setRegId(e.target.value); setPack(null); setRegistered(null); }}>
          {listRegulations().map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <p className="hint">Raw law: “{reg.raw}”</p>
        <button onClick={doInterpret}>Interpret with AI →</button>
        {pack && (
          <table className="prov" style={{marginTop:8}}><tbody>
            <tr><td><b>field</b></td><td><b>MoSCoW</b></td><td><b>class</b></td><td><b>why</b></td></tr>
            {pack.requirements.map(r => (
              <tr key={r.field}><td>{r.field}</td><td>{r.moscow}</td><td>{r.klass}</td><td className="hint">{r.context}</td></tr>
            ))}
          </tbody></table>
        )}
        <p className="hint">The AI runs only at the <b>edge</b> to produce a typed, MoSCoW-prioritised pack. Everything downstream stays deterministic.</p>
      </div>

      {pack && (
        <div className="panel">
          <h4>Act 2 · Attest, then register <small>the trust gate</small></h4>
          {!attested
            ? <button onClick={()=>setAttested(true)}>Attest as domain expert</button>
            : <span className="pass">✓ attested by domain expert</span>}
          <button style={{marginLeft:8}} onClick={doRegister}>Register as source</button>
          {registered && (registered.ok
            ? <div className="pass" style={{marginTop:8}}>✓ registered · fields: {registered.pack.requires_fields.join(', ')}</div>
            : <div className="reject" style={{marginTop:8}}>{registered.reason}</div>)}
          <p className="hint">Register before attesting — it's blocked. <b>AI proposes · a human attests · the engine disposes.</b></p>
        </div>
      )}

      <div className="panel">
        <h4>Act 3 · Strengthen the gate <small>instruction packs: maker-checker + compensation</small></h4>
        <div className="clone-row">
          <label>author <input value={chit.author} onChange={e=>setChit({...chit, author:e.target.value})}/></label>
          <label>approver <input value={chit.approver} onChange={e=>setChit({...chit, approver:e.target.value})}/></label>
          <label><input type="checkbox" checked={chit.forceFail} onChange={e=>setChit({...chit, forceFail:e.target.checked})}/> force a failure</label>
          <button onClick={()=>setGate(runChitThroughGate(chit, ['maker_checker','compensation']))}>Run the chit through the gate</button>
        </div>
        {gate && (
          <div style={{marginTop:8}}>
            {gate.steps.map((s,i)=> <div key={i} className={s.ok?'pass':'reject'}>{s.ok?'✓':'✗'} {s.pack}: {s.note}</div>)}
            {gate.completed
              ? <div className="pass">✓ chit completed</div>
              : <div className="exception">cleanly stopped → {gate.remedy.action}{gate.remedy.clean?' (clean)':''}</div>}
          </div>
        )}
        <p className="hint">Same name for author &amp; approver → rejected. Different approver → passes. Force a failure → compensation unwinds it. <b>“Fully completes or cleanly stops.”</b></p>
      </div>

      <ScenarioRunner scenarios={showcaseScenarios} />
    </div>
  );
}
