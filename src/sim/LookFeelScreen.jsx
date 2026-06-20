import React, { useState } from 'react';
import { useSim } from './simStore';
import { ModeToggle } from './ModeToggle';
import { ScenarioRunner } from './ScenarioRunner';
import { lookFeelScenarios } from './lookFeelScenarios';
import { resolveLens, label } from '../governance/lens';

export function LookFeelScreen() {
  const { state, activeConstitution } = useSim();
  const c = activeConstitution();
  const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction };
  const [language, setLanguage] = useState('en');
  const [vocabulary, setVocabulary] = useState('');
  const lens = resolveLens(c, sel, { language: language||undefined, vocabulary: vocabulary||undefined });
  if (state.mode === 'without') {
    return (<div className="layer-screen">
      <div className="layer-header"><h2>Look & feel <small>Stage 4 — the lens</small></h2><ModeToggle /></div>
      <div className="pain-card"><b>Without CB:</b> language and wording are hard-coded in the UI. Serving a new language means a new build, and nothing stops showing a language the entity isn't allowed to use.</div>
    </div>);
  }
  return (
    <div className="layer-screen">
      <div className="layer-header"><h2>Look & feel <small>vocab {lens.vocabulary} · {lens.language}</small></h2><ModeToggle /></div>
      <div className="actions">
        <span>Language:</span>{['en','ta','hi'].map(l => <button key={l} className={l===language?'on':''} onClick={()=>setLanguage(l)}>{l}</button>)}
        <span>Vocab:</span>{['formal','casual'].map(v => <button key={v} className={v===vocabulary?'on':''} onClick={()=>setVocabulary(v)}>{v}</button>)}
      </div>
      {lens.languageRejected && <div className="reject">✗ language '{language}' not in this constitution's allowed set ({lens.allowedLanguages.join(',')}) → fell back to {lens.language}. (Try Activate v0.2 on the Constitution screen.)</div>}
      <div className="grid">
        <div className="panel skin"><h4>Same chit, this lens</h4>
          <label>{label('counterparty', lens)}<input placeholder="…" /></label>
          <label>{label('amount', lens)}<input placeholder="…" /></label>
          <button className="on">{label('submit', lens)}</button></div>
        <div className="panel"><h4>What changed</h4>
          <div className="hint">Only labels/wording change — the field set and rules underneath are identical. The lens is presentation, never permission.</div></div>
      </div>
      <ScenarioRunner scenarios={lookFeelScenarios} />
    </div>
  );
}
