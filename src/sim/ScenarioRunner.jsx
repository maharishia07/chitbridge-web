import React, { useState } from 'react';
export function ScenarioRunner({ scenarios }) {
  const [res, setRes] = useState({});
  return (
    <div className="scenarios">
      <h4>Test scenarios</h4>
      {scenarios.map((s, i) => (
        <div key={i} className="scenario-row">
          <button onClick={() => setRes(r => ({ ...r, [i]: s.run() }))}>▶ {s.name}</button>
          {res[i] && <span className={res[i].pass ? 'pass' : 'fail'}>{res[i].pass ? '✓ pass' : '✗ fail'} — {res[i].detail}</span>}
        </div>
      ))}
    </div>
  );
}
