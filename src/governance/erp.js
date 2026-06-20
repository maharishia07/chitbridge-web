export const ERP_SOURCES = {
  none:  { id:'none', label:'(no external system)', adds:{}, requires_fields:[] },
  tally: { id:'tally', label:'Tally', adds:{ object_source:'tally', synced_objects:['ledger','stock','invoice'] }, requires_fields:['ext_ledger_ref','ext_stock_ref'] },
  sap:   { id:'sap', label:'SAP', adds:{ object_source:'sap', synced_objects:['material','vendor','po','gl'] }, requires_fields:['ext_material_ref','ext_vendor_ref'] },
};
