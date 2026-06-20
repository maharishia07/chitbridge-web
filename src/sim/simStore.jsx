import React, { createContext, useContext, useReducer } from 'react';
import { V0_1, V0_2 } from '../governance/constitutions';
import { mint, viewEntity, reattest } from '../governance/resolver';
import { PRESETS } from '../governance/presets';
import { saveBlueprint, cloneInstance, applyUpdate } from '../governance/blueprint';

const initialState = {
  constitutionVersions: [V0_1], activeVersion: '0.1',
  draftOverride: {}, entities: [],
  selectedLayer: 'constitution',
  selectedVertical: 'pharmacy', selectedJurisdiction: 'india', selectedStandard: 'none',
  selectedContent: 'own_only', selectedErp: 'none', capabilities: [], selectedPreset: null,
  mode: 'with', lastRejection: null,
  blueprints: [], instances: [],
};
const activeOf = s => s.constitutionVersions.find(c => c.version === s.activeVersion);

function reducer(state, a) {
  switch (a.type) {
    case 'SELECT_LAYER':     return { ...state, selectedLayer: a.layer };
    case 'SET_VERTICAL':     return { ...state, selectedVertical: a.vertical };
    case 'SET_JURISDICTION': return { ...state, selectedJurisdiction: a.value };
    case 'SET_STANDARD':     return { ...state, selectedStandard: a.value };
    case 'SET_CONTENT':      return { ...state, selectedContent: a.value };
    case 'SET_ERP':          return { ...state, selectedErp: a.value };
    case 'TOGGLE_CAPABILITY': {
      const has = state.capabilities.includes(a.cap);
      return { ...state, capabilities: has ? state.capabilities.filter(c=>c!==a.cap) : [...state.capabilities, a.cap] };
    }
    case 'APPLY_PRESET': {
      const p = PRESETS[a.preset]; if (!p) return state;
      return { ...state, selectedPreset: a.preset, selectedVertical: p.vertical, selectedJurisdiction: p.jurisdiction,
        selectedStandard: p.standard, selectedContent: p.content, selectedErp: p.erp, capabilities: [...p.capabilities] };
    }
    case 'TOGGLE_MODE':      return { ...state, mode: state.mode === 'with' ? 'without' : 'with' };
    case 'SET_PARAM':        return { ...state, draftOverride: { ...state.draftOverride, [a.key]: a.value } };
    case 'RESET_DRAFT':      return { ...state, draftOverride: {}, lastRejection: null };
    case 'MINT_ENTITY': {
      const ac = activeOf(state);
      const r = mint(ac, state.draftOverride, ac.plan_menu[a.plan || 'free']);
      if (!r.ok) return { ...state, lastRejection: r.rejections };
      return { ...state, entities: [...state.entities, r.entity], lastRejection: null };
    }
    case 'ACTIVATE_V02': {
      const has = state.constitutionVersions.some(c => c.version === '0.2');
      return { ...state, activeVersion: '0.2', constitutionVersions: has ? state.constitutionVersions : [...state.constitutionVersions, V0_2] };
    }
    case 'REATTEST':
      return { ...state, entities: state.entities.map(e => { if (e.id !== a.id) return e; const r = reattest(e, activeOf(state)); return r.ok ? r.entity : e; }) };
    case 'SAVE_BLUEPRINT': {
      const sel = { vertical:state.selectedVertical, jurisdiction:state.selectedJurisdiction, standard:state.selectedStandard,
                    content:state.selectedContent, erp:state.selectedErp, capabilities:state.capabilities };
      return { ...state, blueprints: [...state.blueprints, saveBlueprint(activeOf(state), sel, a.name)] };
    }
    case 'CLONE_INSTANCE': {
      const bp = state.blueprints.find(b => b.id === a.blueprintId); if (!bp) return state;
      return { ...state, instances: [...state.instances, cloneInstance(bp, activeOf(state), a.overlay || {}, a.name)] };
    }
    case 'APPLY_UPDATE':
      return { ...state, instances: state.instances.map(inst => {
        if (inst.id !== a.id) return inst;
        const bp = state.blueprints.find(b => b.id === inst.blueprintId);
        return bp ? applyUpdate(inst, bp.selection, activeOf(state)) : inst;
      }) };
    default: return state;
  }
}

const Ctx = createContext(null);
export function SimProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <Ctx.Provider value={{ state, dispatch, activeConstitution: () => activeOf(state), viewEntity }}>{children}</Ctx.Provider>;
}
export const useSim = () => useContext(Ctx);
