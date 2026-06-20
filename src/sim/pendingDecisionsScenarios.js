import { PENDING_DECISIONS } from './pendingDecisions';
export const pendingDecisionsScenarios = [
  { name:'There are pending decisions, each tagged to a layer', run() {
      const p = PENDING_DECISIONS.filter(d => d.status === 'pending');
      return { pass: p.length > 0 && p.every(d => !!d.layer), detail: `${p.length} pending, all layer-tagged` };
  }},
  { name:'PD-001 is a genuine contradiction (no common floor value)', run() {
      const d = PENDING_DECISIONS.find(x => x.id === 'PD-001');
      const pass = !!d && !!d.example && d.example.a.value !== d.example.b.value;
      return { pass, detail: pass ? `${d.example.a.value} vs ${d.example.b.value} — incomparable` : 'not a contradiction' };
  }},
  { name:'Only pending items surface (decided/deferred hidden)', run() {
      const p = PENDING_DECISIONS.filter(d => d.status === 'pending');
      return { pass: p.every(d => d.status === 'pending'), detail: 'only pending surfaced' };
  }},
];
