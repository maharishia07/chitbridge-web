// Jurisdiction = legal regime. BOUND / install-pinned. Its contributions are FLOORS
// (Class A): nothing below may loosen them. Switching country snaps the legal envelope.
export const JURISDICTIONS = {
  india: { id:'india', label:'India',
    envelope:{ data_residency:'in', tax_scheme:'GST', invoice:'GST e-invoice', kyc:'PAN / GSTIN', retention_years:8 },
    contributes:{ data_residency:{value:'in',mode:'floor'}, tax_scheme:{value:'GST',mode:'floor'}, retention_years:{value:8,mode:'floor'} } },
  eu: { id:'eu', label:'European Union',
    envelope:{ data_residency:'eu', tax_scheme:'VAT', invoice:'EN 16931', kyc:'VAT ID', retention_years:10 },
    contributes:{ data_residency:{value:'eu',mode:'floor'}, tax_scheme:{value:'VAT',mode:'floor'}, retention_years:{value:10,mode:'floor'},
                  catalogue_visibility:{value:'restricted',mode:'tighten'} } },
  us: { id:'us', label:'United States',
    envelope:{ data_residency:'us', tax_scheme:'Sales Tax', invoice:'US invoice', kyc:'EIN / W-9', retention_years:7 },
    contributes:{ data_residency:{value:'us',mode:'floor'}, tax_scheme:{value:'Sales Tax',mode:'floor'}, retention_years:{value:7,mode:'floor'} } },
};
