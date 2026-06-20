export const INSTRUCTION_PACKS = {
  maker_checker: { id:'maker_checker', label:'Maker-checker (separation of duties)', primitives:['accountability','evidence'],
    gate:(chit) => (chit.approver && chit.approver !== chit.author)
      ? { ok:true,  note:`approved by ${chit.approver} (≠ author)` }
      : { ok:false, note:'self-approval rejected — needs a different approver' } },
  pdca: { id:'pdca', label:'PDCA (check & corrective act)', primitives:['control-loop'],
    gate:(chit) => chit.checked ? { ok:true, note:'Check passed' } : { ok:false, note:'Check failed → corrective Act before settle' } },
  compensation: { id:'compensation', label:'Compensation (cleanly stops)', primitives:['remedy'],
    onFailure:(chit) => ({ action:`compensate — reverse ${chit.type} ${chit.id}`, clean:true }) },
};
export function runChitThroughGate(chit, packIds = []) {
  const steps = []; let ok = true;
  for (const id of packIds) {
    const p = INSTRUCTION_PACKS[id];
    if (p?.gate) { const r = p.gate(chit); steps.push({ pack:p.label, ...r }); if (!r.ok) ok = false; }
  }
  let remedy = null;
  if (!ok || chit.forceFail) remedy = packIds.includes('compensation') ? INSTRUCTION_PACKS.compensation.onFailure(chit) : { action:'reject', clean:false };
  return { completed: ok && !chit.forceFail, steps, remedy };
}
