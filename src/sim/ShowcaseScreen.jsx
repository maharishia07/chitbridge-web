import React, { useState } from 'react';
import { ScenarioRunner } from './ScenarioRunner';
import { showcaseScenarios } from './showcaseScenarios';
import { listRegulations, interpretRegulation, attest, toSourcePack } from '../governance/ingest';
import { runChitThroughGate } from '../governance/instructionPacks';

export function ShowcaseScreen() {
  const [regId, setRegId] = useState('gdp');
  const [pack, setPack] = useState(() => interpretRegulation('gdp'));
  const [registered, setRegistered] = useState(null);
  const [gate, setGate] = useState(null);
  const pick = (id) => { setRegId(id); setPack(interpretRegulation(id)); setRegistered(null); };
  const doAttest = () => setPack(p => attest(p, 'domain expert'));
  const doRegister = () => setRegistered(toSourcePack(pack));
  const runGate = (selfApprove, fail) => {
    const chit = { id:'c1', type:'goods_receipt', author:'alice', approver: selfApprove ? 'alice' : 'bob', checked:!fail, forceFail:fail };
    setGate(runChitThroughGate(chit, ['maker_checker','pdca','compensation']));
  };
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>★ Showcase <small>the whole story in three acts</small></h2></div>
      <div className="panel"><h4>Act 1 · Ingest a regulation → AI interprets it</h4>
        <div className="actions">{listRegulations().map(r => <button key={r.id} className={r.id===regId?'on':''} onClick={()=>pick(r.id)}>{r.label}</button>)}</div>
        <table className="prov"><tbody>{pack.requirements.map((req,i) => <tr key={i}><td>{req.field}</td><td className="src-v">{req.moscow}</td><td className="src-c">Class {req.klass} · {req.context}</td></tr>)}</tbody></table>
        <div className="hint">level: {pack.level} · AI proposes typed requirements + MoSCoW. Nothing is law until a human attests.</div></div>
      <div className="panel"><h4>Act 2 · Attest → register as a Source Pack</h4>
        <div className="actions">
          <button className={pack.attested?'on':''} onClick={doAttest}>{pack.attested?`✓ attested by ${pack.attestor}`:'Attest (sign off)'}</button>
          <button onClick={doRegister}>Register as source</button></div>
        {registered && (registered.ok
          ? <div className="pass">✓ registered '{registered.pack.label}' at level {registered.pack.layer} — {registered.pack.requires_fields.length} fields, {Object.keys(registered.pack.contributes).length} floor(s)</div>
          : <div className="reject">✗ {registered.reason}</div>)}
        <div className="hint">AI at the edge, human attests, engine disposes — the registered pack is deterministic from here.</div></div>
      <div className="panel"><h4>Act 3 · A chit runs the gate (completes or cleanly stops)</h4>
        <div className="actions">
          <button onClick={()=>runGate(false,false)}>Valid (different approver, check ok)</button>
          <button onClick={()=>runGate(true,false)}>Self-approve (should reject)</button>
          <button onClick={()=>runGate(false,true)}>Check fails (should compensate)</button></div>
        {gate && <div className={gate.completed?'pleasure-card':'pain-card'}>
          {gate.steps.map((s,i)=><div key={i}>{s.ok?'✓':'✗'} {s.pack}: {s.note}</div>)}
          {gate.completed ? <div className="pass">✓ fully completes</div> : <div className="reject">✗ stopped → {gate.remedy.action} {gate.remedy.clean?'(clean)':''}</div>}</div>}</div>
      <ScenarioRunner scenarios={showcaseScenarios} />
    </div>
  );
}
