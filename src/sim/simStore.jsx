import React, { createContext, useContext, useReducer } from 'react';
import { V0_1, V0_2 } from '../governance/constitutions';
import { mint, viewEntity, reattest } from '../governance/resolver';

const initialState = {
  constitutionVersions: [V0_1], activeVersion: '0.1',
  draftOverride: {}, entities: [],
  selectedLayer: 'constitution', selectedVertical: 'pharma', mode: 'with',
  scenarioResults: {}, painLog: [], lastRejection: null,
};
const activeOf = s => s.constitutionVersions.find(c => c.version === s.activeVersion);

function reducer(state, a) {
  switch (a.type) {
    case 'SELECT_LAYER': return { ...state, selectedLayer: a.layer };
    case 'SELECT_VERTICAL': return { ...state, selectedVertical: a.id };
    case 'TOGGLE_MODE':  return { ...state, mode: state.mode === 'with' ? 'without' : 'with' };
    case 'SET_PARAM':    return { ...state, draftOverride: { ...state.draftOverride, [a.key]: a.value } };
    case 'RESET_DRAFT':  return { ...state, draftOverride: {}, lastRejection: null };
    case 'MINT_ENTITY': {
      const ac = activeOf(state);
      const r = mint(ac, state.draftOverride, ac.plan_menu[a.plan || 'free']);
      if (!r.ok) return { ...state, lastRejection: r.rejections };
      return { ...state, entities: [...state.entities, r.entity], lastRejection: null };
    }
    case 'ACTIVATE_V02': {
      const has = state.constitutionVersions.some(c => c.version === '0.2');
      return { ...state, activeVersion: '0.2',
        constitutionVersions: has ? state.constitutionVersions : [...state.constitutionVersions, V0_2] };
    }
    case 'REATTEST':
      return { ...state, entities: state.entities.map(e => {
        if (e.id !== a.id) return e; const r = reattest(e, activeOf(state)); return r.ok ? r.entity : e; }) };
    default: return state;
  }
}

const Ctx = createContext(null);
export function SimProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <Ctx.Provider value={{ state, dispatch, activeConstitution: () => activeOf(state), viewEntity }}>{children}</Ctx.Provider>;
}
export const useSim = () => useContext(Ctx);
