export const STANDARDS = {
  none:       { id:'none', label:'(none)', requires_fields:[], requires_capabilities:[], advisories:[] },
  gdp_pharma: { id:'gdp_pharma', label:'GDP (pharma distribution)',
                requires_fields:['cold_chain_log','batch_recall_ref'], requires_capabilities:['batch_recall'], advisories:['temperature_excursion_alert'] },
  iso27001:   { id:'iso27001', label:'ISO 27001 (infosec)',
                requires_fields:['access_log'], requires_capabilities:['audit_trail'], advisories:['mfa_recommended'] },
  haccp:      { id:'haccp', label:'HACCP (food safety)',
                requires_fields:['ccp_check'], requires_capabilities:['lot_traceability'], advisories:[] },
};
