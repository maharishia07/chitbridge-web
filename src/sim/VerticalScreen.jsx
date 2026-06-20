// VerticalScreen.jsx — reconciled to the general cascade (composeVertical + new VERTICALS).
import React from 'react';
import { useSim } from './simStore';
import { VERTICALS } from '../governance/verticals';
import { composeVertical } from '../governance/cascade';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { verticalScenarios } from './verticalScenarios';

const PAIN = `Without industry templates every business re-derives its sector's data model, document types and listing rules by hand — and nothing stops a seller over-exposing what the constitution meant to keep private.`;
const PLEASURE = `Pick an industry and inherit its schema, document types and listing rule on top of the constitution — tightening what's above, never loosening it.`;

export function VerticalScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const ac = activeConstitution();
  const v = VERTICALS[state.selectedVertical] || VERTICALS.pharmacy;
  const r = composeVertical(ac, state.draftOverride, v);
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Vertical</h2><ModeToggle /></div>

      <div className="vertical-picker">
        {Object.values(VERTICALS).map(x => (
          <button key={x.id} className={x.id === v.id ? 'active' : ''}
                  onClick={() => dispatch({ type: 'SET_VERTICAL', vertical: x.id })}>{x.label}</button>
        ))}
      </div>

      {state.mode === 'without' ? <div className="pain-card">{PAIN}</div> : (
        <>
          <div className="grid">
            <div className="panel">
              <h4>Industry profile · {v.label}</h4>
              <div><b>Schema:</b> {v.schema.join(', ')}</div>
              <div><b>Document types:</b> {v.chit_types.join(', ')}</div>
              <div><b>Listing rule:</b> catalogue_visibility ≤ {v.contributes.catalogue_visibility}</div>
            </div>
            <div className="panel">
              <h4>Resolved · constitution v{ac.version} → {v.label}</h4>
              <div><b>Effective visibility:</b> {r.effective.catalogue_visibility}</div>
              {r.exceptions.filter(x => x.klass === 'note').map((x, i) => <div key={i} className="exception">{x.reason}</div>)}
              {r.rejections.length > 0 && <div className="reject">REJECTED: {r.rejections.map(x => x.reason).join('; ')}</div>}
              <h4 style={{ marginTop: 10 }}>Provenance</h4>
              <table className="prov"><tbody>
                {Object.entries(r.provenance).map(([k, p]) => (
                  <tr key={k}><td>{k}</td><td>{JSON.stringify(p.value)}</td><td>{p.source_layer}</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}

      <ScenarioRunner scenarios={verticalScenarios} />
    </div>
  );
}
