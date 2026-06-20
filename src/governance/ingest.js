const REGULATIONS = {
  gdp:   { id:'gdp',   label:'GDP — Good Distribution Practice (pharma)', raw:'Distributors shall maintain temperature records throughout the cold chain, ensure batch traceability, and enable recall of any batch.' },
  gdpr:  { id:'gdpr',  label:'GDPR Art.5 — minimisation & residency',     raw:'Personal data shall be processed lawfully, kept no longer than necessary, and not transferred outside the permitted region.' },
  fssai: { id:'fssai', label:'FSSAI — food safety (India)',               raw:'Food businesses shall record critical control points, maintain lot traceability, and display licence on every consignment.' },
};
const INTERPRETATIONS = {
  gdp: { level:'standards', requirements:[
    { field:'cold_chain_log', moscow:'Must', klass:'A', context:'Temperature records throughout the cold chain.' },
    { field:'batch_recall_ref', moscow:'Must', klass:'B', context:'Recall capability for any batch.' },
    { field:'batch_no', moscow:'Should', klass:'C', context:'Batch traceability.' },
    { field:'temperature_excursion_alert', moscow:'Could', klass:'C', context:'Alert on excursion (optional).' } ]},
  gdpr: { level:'jurisdiction', requirements:[
    { field:'data_residency', moscow:'Must', klass:'A', context:'No transfer outside the permitted region.', floor:'eu' },
    { field:'retention_policy', moscow:'Must', klass:'A', context:'Kept no longer than necessary.' },
    { field:'consent_ref', moscow:'Should', klass:'C', context:'Lawful basis / consent on record.' } ]},
  fssai: { level:'standards', requirements:[
    { field:'ccp_check', moscow:'Must', klass:'A', context:'Critical control points recorded.' },
    { field:'lot_ref', moscow:'Must', klass:'B', context:'Lot traceability.' },
    { field:'licence_no', moscow:'Should', klass:'C', context:'Licence displayed on every consignment.' } ]},
};
export const listRegulations = () => Object.values(REGULATIONS);
export const getRegulation = (id) => REGULATIONS[id];
export function interpretRegulation(id) {
  const reg = REGULATIONS[id], interp = INTERPRETATIONS[id];
  if (!reg || !interp) return null;
  return { sourceId:id, label:reg.label, level:interp.level, requirements:interp.requirements, attested:false };
}
export const attest = (pack, attestor) => ({ ...pack, attested:true, attestor: attestor || 'domain expert' });
export function toSourcePack(pack) {
  if (!pack || !pack.attested) return { ok:false, reason:'cannot register an un-attested interpretation — Must / Class-A items need sign-off' };
  const requires_fields = pack.requirements.filter(r => r.moscow !== "Won't").map(r => r.field);
  const contributes = {};
  for (const r of pack.requirements) if (r.floor) contributes[r.field] = { value:r.floor, mode:'floor' };
  return { ok:true, pack:{ id:pack.sourceId, layer:pack.level, label:pack.label, requires_fields, contributes, requirements:pack.requirements } };
}
