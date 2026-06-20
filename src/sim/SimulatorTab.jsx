import React from 'react';
import { SimProvider, useSim } from './simStore';
import { ConstitutionScreen } from './ConstitutionScreen';
import { VerticalScreen } from './VerticalScreen';
import { JurisdictionScreen } from './JurisdictionScreen';
import { StandardsScreen } from './StandardsScreen';
import { ContentScreen } from './ContentScreen';
import { ErpScreen } from './ErpScreen';
import { PayoffScreen } from './PayoffScreen';
import { BlueprintScreen } from './BlueprintScreen';
import './simulator.css';

const LAYERS = [
  { id:'constitution', label:'Constitution' }, { id:'vertical', label:'Vertical' },
  { id:'jurisdiction', label:'Jurisdiction' }, { id:'standards', label:'Standards' },
  { id:'content', label:'Content' }, { id:'erp', label:'ERP' },
  { id:'payoff', label:'▶ Spin a business' },
  { id:'blueprint', label:'Blueprint ⧉' },
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
  switch (state.selectedLayer) {
    case 'constitution': return <ConstitutionScreen />;
    case 'vertical':     return <VerticalScreen />;
    case 'jurisdiction': return <JurisdictionScreen />;
    case 'standards':    return <StandardsScreen />;
    case 'content':      return <ContentScreen />;
    case 'erp':          return <ErpScreen />;
    case 'payoff':       return <PayoffScreen />;
    case 'blueprint':    return <BlueprintScreen />;
    default: return <div className="layer-screen placeholder">pick a layer</div>;
  }
}
export default function SimulatorTab() {
  return <SimProvider><div className="simulator"><LayerRail /><ScreenSwitch /></div></SimProvider>;
}
