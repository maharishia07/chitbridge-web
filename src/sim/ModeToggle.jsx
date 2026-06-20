import React from 'react';
import { useSim } from './simStore';
export function ModeToggle() {
  const { state, dispatch } = useSim();
  const flip = m => state.mode !== m && dispatch({ type:'TOGGLE_MODE' });
  return (
    <div className="mode-toggle">
      <button className={state.mode==='without'?'on':''} onClick={() => flip('without')}>Without CB</button>
      <button className={state.mode==='with'?'on':''} onClick={() => flip('with')}>With CB</button>
    </div>
  );
}
