import React from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { constitutionScenarios } from './constitutionScenarios';
import { resolve } from '../governance/resolver';

export function ConstitutionScreen() {
  const { state, dispatch, activeConstitution, viewEntity } = useSim();
  const c = activeConstitution();
  const r = resolve(c, state.draftOverride);
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>Constitution <small>the root rulebook</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> every business writes its own rules in code. Change a rule → a developer, a release, a migration. Nothing stops a tenant loosening a limit it shouldn't, and you can't say which rules a record was created under.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Constitution <small>v{c.version} active</small></h2><ModeToggle /></div>
      <div className="grid">
        <div className="panel">
          <h4>Your override <small>(tighten-only)</small></h4>
          <label>currency_code
            <input value={state.draftOverride.currency_code || ''} placeholder={c.params.currency_code.value}
              onChange={e => dispatch({ type:'SET_PARAM', key:'currency_code', value:e.target.value })} /></label>
          <label>language
            <select value={(state.draftOverride.allowed_languages||[''])[0] || ''}
              onChange={e => dispatch({ type:'SET_PARAM', key:'allowed_languages', value:[e.target.value] })}>
              <option value="">(default {c.params.allowed_languages.value.join(',')})</option>
              <option value="en">en</option><option value="ta">ta</option><option value="hi">hi</option></select></label>
          <label>catalogue_visibility
            <select value={state.draftOverride.catalogue_visibility || ''}
              onChange={e => dispatch({ type:'SET_PARAM', key:'catalogue_visibility', value:e.target.value })}>
              <option value="">(default {c.params.catalogue_visibility.value})</option>
              <option value="private">private</option><option value="restricted">restricted</option><option value="public">public</option></select></label>
          <div className="actions">
            <button onClick={() => dispatch({ type:'MINT_ENTITY', plan:'free' })}>Mint entity</button>
            <button onClick={() => dispatch({ type:'RESET_DRAFT' })}>Reset</button>
            <button onClick={() => dispatch({ type:'ACTIVATE_V02' })}>Activate v0.2</button>
          </div>
          {r.rejections.map((x,i) => <div className="reject" key={i}>✗ {x.key}: {x.reason}</div>)}
          {r.exceptions.map((x,i) => <div className="exception" key={i}>⚑ {x.key}: {x.reason}</div>)}
          {state.lastRejection && state.lastRejection.map((x,i)=><div className="reject" key={'m'+i}>✗ mint blocked — {x.reason}</div>)}
        </div>
        <div className="panel">
          <h4>Resolved (effective)</h4>
          <table className="prov"><tbody>
            {Object.entries(r.effective).map(([k,v]) => <tr key={k}><td>{k}</td><td className="src-v">{Array.isArray(v)?v.join(','):String(v)}</td></tr>)}
          </tbody></table>
          <h4>Entities ({state.entities.length})</h4>
          {state.entities.map(e => {
            const v = viewEntity(e, c);
            return <div className="entity-row" key={e.id}>
              <span>{e.id} · minted v{e.mintedVersion} · {v.effective.currency_code}/{(v.effective.allowed_languages||[]).join(',')}</span>
              {v.drift ? <button onClick={() => dispatch({ type:'REATTEST', id:e.id })}>drift → re-attest</button> : <span className="pass">current</span>}
            </div>;
          })}
        </div>
      </div>
      <ScenarioRunner scenarios={constitutionScenarios} />
    </div>
  );
}
