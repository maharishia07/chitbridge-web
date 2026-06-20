import React from 'react';
import { SimProvider, useSim } from './simStore';
import { ConstitutionScreen } from './ConstitutionScreen';
import './simulator.css';

const LAYERS = [
  { id:'constitution', label:'Constitution' }, { id:'vertical', label:'Vertical' },
  { id:'jurisdiction', label:'Jurisdiction' }, { id:'standards', label:'Standards' },
  { id:'content', label:'Content' }, { id:'erp', label:'ERP' },
];

function LayerRail() {
  const { state, dispatch } = useSim();
  return (
    <nav className="layer-rail">
      {LAYERS.map(l => (
        <button key={l.id} className={state.selectedLayer===l.id?'active':''}
                onClick={() => dispatch({ type:'SELECT_LAYER', layer:l.id })}>{l.label}</button>
      ))}
      <div className="rail-foot">Price today: — <em>(later)</em></div>
    </nav>
  );
}
function ScreenSwitch() {
  const { state } = useSim();
  return state.selectedLayer === 'constitution'
    ? <ConstitutionScreen />
    : <div className="layer-screen placeholder">{state.selectedLayer} — coming next (same pattern)</div>;
}
export default function SimulatorTab() {
  return <SimProvider><div className="simulator"><LayerRail /><ScreenSwitch /></div></SimProvider>;
}
