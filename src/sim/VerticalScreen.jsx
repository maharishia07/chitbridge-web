import React from 'react';
import { useSim } from './simStore';
import { VERTICAL_LIST, VERTICALS } from '../governance/verticals';
import { cascade, layersFor } from '../governance/cascade';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { verticalScenarios } from './verticalScenarios';

const PAIN = `Without industry templates every business re-derives its sector's rules by hand — a pharma seller can list controlled goods as "public", a food seller can skip expiry, and the marketplace can't trust any listing because nothing enforces domain safety.`;
const PLEASURE = `Pick your industry and inherit its rulebook ON TOP of the constitution. A vertical can only TIGHTEN what the constitution already bounds — never loosen it — and every effective rule shows exactly which layer set it (provenance).`;

export function VerticalScreen() {
  const { state, dispatch, activeConstitution } = useSim();
  const ac = activeConstitution();
  const vid = state.selectedVertical || 'pharma';
  const vertical = VERTICALS[vid];
  const live = cascade(layersFor(ac, vertical), state.draftOverride);
  const set = (key, value) => dispatch({ type: 'SET_PARAM', key, value });

  const boundKeys = Object.entries(vertical.contributes)
    .filter(([, p]) => p.klass === 'bound').map(([k]) => k);

  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Vertical</h2><ModeToggle /></div>

      <div className="vertical-picker">
        {VERTICAL_LIST.map(v => (
          <button key={v.id} className={v.id === vid ? 'active' : ''}
                  title={v.blurb}
                  onClick={() => dispatch({ type: 'SELECT_VERTICAL', id: v.id })}>{v.label}</button>
        ))}
      </div>

      {state.mode === 'without' ? (
        <div className="pain-card">{PAIN}</div>
      ) : (
        <>
          <div className="grid">
            <div className="panel">
              <h4>Inputs · {vertical.label}</h4>
              <p className="muted">{vertical.blurb}</p>
              <label>catalogue_visibility (try to loosen it)
                <select value={state.draftOverride.catalogue_visibility ?? 'private'}
                        onChange={e => set('catalogue_visibility', e.target.value)}>
                  <option>private</option><option>restricted</option><option>public</option>
                </select>
              </label>
              <div className="actions">
                {boundKeys.map(k => (
                  <button key={k} onClick={() => set(k, false)}>Attempt: {k} = false</button>
                ))}
                <button onClick={() => dispatch({ type: 'RESET_DRAFT' })}>Reset</button>
              </div>
            </div>

            <div className="panel">
              <h4>Resolved · Constitution v{ac.version} → {vertical.label}</h4>
              <pre>{JSON.stringify(live.effective, null, 2)}</pre>
              {live.rejections.length > 0 && <div className="reject">REJECTED: {live.rejections.map(r => r.reason).join('; ')}</div>}
              {live.exceptions.length > 0 && <div className="exception">FLAGGED (Class C): {live.exceptions.map(x => x.reason).join('; ')}</div>}
            </div>
          </div>

          <div className="panel">
            <h4>Provenance · which layer set each rule</h4>
            <table className="prov-table">
              <thead><tr><th>parameter</th><th>effective</th><th>set by</th><th>class</th></tr></thead>
              <tbody>
                {Object.keys(live.effective).map(k => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{JSON.stringify(live.effective[k])}</td>
                    <td>{live.provenance[k]?.source}</td>
                    <td>{live.provenance[k]?.klass}{live.provenance[k]?.cap ? ` (≤ ${live.provenance[k].cap})` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pleasure-card">{PLEASURE}</div>
        </>
      )}

      <ScenarioRunner scenarios={verticalScenarios} />
    </div>
  );
}
