import React from 'react';
import { SimProvider, useSim } from './simStore';
import './simulator.css';
import { PENDING_DECISIONS } from './pendingDecisions';
import { ShowcaseScreen } from './ShowcaseScreen';
import { PendingDecisionsScreen } from './PendingDecisionsScreen';
import { ConstitutionScreen } from './ConstitutionScreen';
import { VerticalScreen } from './VerticalScreen';
import { JurisdictionScreen } from './JurisdictionScreen';
import { StandardsScreen } from './StandardsScreen';
import { ContentScreen } from './ContentScreen';
import { ErpScreen } from './ErpScreen';
import { DataDefinitionScreen } from './DataDefinitionScreen';
import { ChitBirthScreen } from './ChitBirthScreen';
import { LookFeelScreen } from './LookFeelScreen';
import { BlueprintPipelineScreen } from './BlueprintPipelineScreen';
import { PayoffScreen } from './PayoffScreen';
import { BlueprintScreen } from './BlueprintScreen';

const LAYERS = [
  { id:'showcase', label:'★ Showcase' }, { id:'pending', label:'⚠ Pending decisions' },
  { id:'constitution', label:'Constitution' }, { id:'vertical', label:'Vertical' },
  { id:'jurisdiction', label:'Jurisdiction' }, { id:'standards', label:'Standards' },
  { id:'content', label:'Content' }, { id:'erp', label:'ERP' },
  { id:'datadef', label:'Data definition' }, { id:'chitbirth', label:'How a chit is born' },
  { id:'lookfeel', label:'Look & feel' }, { id:'pipeline', label:'Blueprint pipeline' },
  { id:'payoff', label:'▶ Spin a business' }, { id:'blueprint', label:'Blueprint ⧉' },
];

function LayerRail() {
  const { state, dispatch } = useSim();
  const pendingLayers = new Set(PENDING_DECISIONS.filter(d=>d.status==='pending').map(d=>d.layer));
  return (
    <nav className="layer-rail">
      {LAYERS.map(l => (
        <button key={l.id} className={state.selectedLayer===l.id?'active':''}
                onClick={() => dispatch({ type:'SELECT_LAYER', layer:l.id })}>
          {l.label}{pendingLayers.has(l.id) ? ' ⚠' : ''}
        </button>
      ))}
      <div className="rail-foot">Price today: — <em>(later)</em></div>
    </nav>
  );
}
function ScreenSwitch() {
  const { state } = useSim();
  switch (state.selectedLayer) {
    case 'showcase':     return <ShowcaseScreen />;
    case 'pending':      return <PendingDecisionsScreen />;
    case 'constitution': return <ConstitutionScreen />;
    case 'vertical':     return <VerticalScreen />;
    case 'jurisdiction': return <JurisdictionScreen />;
    case 'standards':    return <StandardsScreen />;
    case 'content':      return <ContentScreen />;
    case 'erp':          return <ErpScreen />;
    case 'datadef':      return <DataDefinitionScreen />;
    case 'chitbirth':    return <ChitBirthScreen />;
    case 'lookfeel':     return <LookFeelScreen />;
    case 'pipeline':     return <BlueprintPipelineScreen />;
    case 'payoff':       return <PayoffScreen />;
    case 'blueprint':    return <BlueprintScreen />;
    default: return <div className="layer-screen placeholder">pick a layer</div>;
  }
}
export default function SimulatorTab() {
  return <SimProvider><div className="simulator"><LayerRail /><ScreenSwitch /></div></SimProvider>;
}
