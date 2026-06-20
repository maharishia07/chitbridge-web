import React from 'react';
import { useSim } from './simStore';
import { ScenarioRunner } from './ScenarioRunner';
import { payoffScenarios } from './payoffScenarios';
import { PRESETS } from '../governance/presets';
import { assembleBusiness } from '../governance/cascade';

export function PayoffScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction, standard:state.selectedStandard, content:state.selectedContent, erp:state.selectedErp, capabilities:state.capabilities };
  const biz = assembleBusiness(activeConstitution(), sel);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>▶ Spin a business <small>all six layers at once</small></h2></div>
      <div className="actions">{Object.entries(PRESETS).map(([k,p]) => <button key={k} className={state.selectedPreset===k?'on':''} onClick={() => dispatch({ type:'APPLY_PRESET', preset:k })}>{p.label}</button>)}</div>
      <div className="grid">
        <div className="panel"><h4>The business that falls out</h4>
          <div>Vertical: <b>{sel.vertical}</b> · Jurisdiction: <b>{sel.jurisdiction}</b> · Standard: <b>{sel.standard}</b></div>
          <div>Certifications: {biz.certifications.join(', ') || '—'}</div>
          <div>Catalogue: {biz.catalogue.join(', ')}</div>
          <div>Connectors: {biz.connectors.join(', ') || '—'}</div>
          <div>Chit types: {biz.chitTypes.join(', ')}</div>
          {biz.conformant ? <div className="pass">✓ conformant — ready to transact</div> : biz.rejections.map((x,i)=><div className="reject" key={i}>✗ {x.key}: {x.reason}</div>)}</div>
        <div className="panel"><h4>Data definition ({biz.schema.length} fields)</h4>
          <div className="hint">{biz.schema.join(' · ')}</div>
          <h4>Legal envelope</h4>
          <table className="prov"><tbody>{Object.entries(biz.envelope).map(([k,v])=><tr key={k}><td>{k}</td><td className="src-v">{String(v)}</td></tr>)}</tbody></table></div>
      </div>
      <div className="pleasure-card"><b>With CB:</b> pick six dropdowns → a compliant, certified, current, source-connected business definition appears, every field traced to the layer that required it. No code, no integration project, no audit binder.</div>
      <ScenarioRunner scenarios={payoffScenarios} />
    </div>
  );
}
