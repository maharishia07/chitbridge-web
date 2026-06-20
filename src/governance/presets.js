// Model presets = headline demo. Each is a full set of layer choices.
export const PRESETS = {
  amazon:       { label:'Amazon-style marketplace', vertical:'marketplace',  jurisdiction:'india', standard:'iso27001',   content:'open_market',      erp:'none',  capabilities:['audit_trail'] },
  distributor:  { label:'Closed pharma distributor', vertical:'pharmacy',    jurisdiction:'india', standard:'gdp_pharma',  content:'distributor_feed', erp:'tally', capabilities:['batch_recall'] },
  manufacturer: { label:'Manufacturer chain',        vertical:'manufacturer',jurisdiction:'india', standard:'iso27001',   content:'distributor_feed', erp:'sap',   capabilities:['audit_trail'] },
  service:      { label:'Service network (hospital)',vertical:'hospital',    jurisdiction:'india', standard:'iso27001',   content:'own_only',         erp:'none',  capabilities:['audit_trail'] },
};
