import React from 'react';
import { useSim } from './simStore';
import { resolve } from '../governance/resolver';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { constitutionScenarios } from './constitutionScenarios';

const PAIN = `Without a shared constitution: anyone can quietly loosen a safety rule, every org reinvents the rulebook, and a cross-org deal half-completes with no one accountable.`;
const PLEASURE = `One sealed root everyone inherits. You can't loosen a ceiling. A rule change never rewrites a deal already in flight — it drifts and waits for re-attest.`;

export function ConstitutionScreen() {
  const { state, dispatch, activeConstitution, viewEntity } = useSim();
  const ac = activeConstitution();
  const live = resolve(ac, state.draftOverride);
  const set = (key, value) => dispatch({ type: 'SET_PARAM', key, value });

  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Constitution</h2><ModeToggle /></div>

      {state.mode === 'without' ? (
        <div className="pain-card">{PAIN}</div>
      ) : (
        <>
          <div className="grid">
            <div className="panel">
              <h4>Inputs (what a business chooses)</h4>
              <label>currency_code
                <select value={state.draftOverride.currency_code ?? ac.params.currency_code.value}
                        onChange={e => set('currency_code', e.target.value)}>
                  <option>INR</option><option>USD</option><option>EUR</option>
                </select>
              </label>
              <label>languages (ctrl/cmd-click)
                <select multiple value={state.draftOverride.allowed_languages ?? ['en']}
                        onChange={e => set('allowed_languages', Array.from(e.target.selectedOptions, o => o.value))}>
                  <option value="en">en</option><option value="ta">ta</option><option value="hi">hi</option>
                </select>
              </label>
              <label>catalogue_visibility
                <select value={state.draftOverride.catalogue_visibility ?? 'private'}
                        onChange={e => set('catalogue_visibility', e.target.value)}>
                  <option>private</option><option>restricted</option><option>public</option>
                </select>
              </label>
              <div className="actions">
                <button onClick={() => dispatch({ type: 'MINT_ENTITY', plan: 'free' })}>Mint entity</button>
                <button onClick={() => dispatch({ type: 'ACTIVATE_V02' })}>Activate v0.2 (USD; en/ta/hi)</button>
              </div>
            </div>

            <div className="panel">
              <h4>Resolved · active constitution v{ac.version}</h4>
              <pre>{JSON.stringify(live.effective, null, 2)}</pre>
              {live.rejections.length > 0 && <div className="reject">REJECTED: {live.rejections.map(r => r.reason).join('; ')}</div>}
              {live.exceptions.length > 0 && <div className="exception">FLAGGED (Class C): {live.exceptions.map(x => x.reason).join('; ')}</div>}
            </div>
          </div>

          <div className="pleasure-card">{PLEASURE}</div>

          {state.entities.length > 0 && (
            <div className="panel">
              <h4>Entities</h4>
              {state.entities.map(e => {
                const v = viewEntity(e, ac);
                return (
                  <div key={e.id} className="entity-row">
                    <span>{e.id} · minted v{e.mintedVersion} · currency {v.effective.currency_code} {v.drift ? '· DRIFT' : ''}</span>
                    {v.drift && <button onClick={() => dispatch({ type: 'REATTEST', id: e.id })}>re-attest</button>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ScenarioRunner scenarios={constitutionScenarios} />
    </div>
  );
}
