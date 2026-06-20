// ERP / object source = governed membrane. ADDITIVE. Adds an object source + synced objects;
// everything passes conformance; it can NEVER override a floor set above.
export const ERP_SOURCES = {
  none:  { id:'none', label:'(no external system)', adds:{} },
  tally: { id:'tally', label:'Tally', adds:{ object_source:'tally', synced_objects:['ledger','stock','invoice'] } },
  sap:   { id:'sap', label:'SAP', adds:{ object_source:'sap', synced_objects:['material','vendor','po','gl'] } },
};
