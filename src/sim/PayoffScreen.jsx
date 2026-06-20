// PayoffScreen.jsx
import React from 'react';
import { useSim } from './simStore';
import { assembleBusiness } from '../governance/cascade';
import { PRESETS } from '../governance/presets';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { payoffScenarios } from './payoffScenarios';

const PAIN = `Standing up a compliant, certified, connected business the old way: months of integration, legal review and custom build — per industry, per region.`;
const PLEASURE = `Pick a model and spin a compliant, certified, current, connected business in minutes — all six layers folded into one, by the same engine.`;

export function PayoffScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const ac = activeConstitution();
  const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction,
    standard:state.selectedStandard, content:state.selectedContent, erp:state.selectedErp, capabilities:state.capabilities };
  const b = assembleBusiness(ac, sel);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Spin a business</h2><ModeToggle /></div>
      {state.mode === 'without' ? <div className="pain-card">{PAIN}</div> : (
        <>
          <div className="panel">
            <h4>Model preset</h4>
            <div className="actions">
              {Object.entries(PRESETS).map(([k,p]) => (
                <button key={k} className={state.selectedPreset===k?'on':''} onClick={() => dispatch({type:'APPLY_PRESET', preset:k})}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="grid">
            <div className="panel">
              <h4>The business that spun up</h4>
              <div><b>Schema:</b> {b.schema.join(', ')}</div>
              <div><b>Document types:</b> {b.chitTypes.join(', ')}</div>
              <div><b>Legal envelope:</b> {Object.entries(b.envelope).map(([k,v])=>`${k}=${v}`).join(' · ')}</div>
              <div><b>Certifications:</b> {b.certifications.join(', ') || '—'}</div>
              <div><b>Catalogue:</b> {b.catalogue.join(', ')}</div>
              <div><b>Connectors:</b> {b.connectors.join(', ') || '—'}</div>
            </div>
            <div className="panel">
              <h4>Conformance</h4>
              {b.conformant
                ? <div className="pass">✓ conformant — every layer satisfied</div>
                : <div className="reject">NOT conformant: {b.rejections.map(x=>x.reason).join('; ')}</div>}
              <h4 style={{marginTop:10}}>Where each value came from</h4>
              <table className="prov"><tbody>
                {Object.entries(b.provenance).map(([k,p]) => (
                  <tr key={k}><td>{k}</td><td>{String(p.value)}</td><td className={p.source_layer==='constitution'?'src-c':'src-v'}>{p.source_layer}{p.floor?' (floor)':''}{p.additive?' (added)':''}</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}
      <ScenarioRunner scenarios={payoffScenarios} />
    </div>
  );
}
