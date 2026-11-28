/* cap-crm-add.js — CB CRM: the quick add's own parts (the phone and e-mail typed in it, the server's "Already your party" search, what happens after the add).
 * OWNS      crmAddField · crmAddEmailOk · crmAddBadEmail · crmAddContactRest · crmAddContact · crmAddDoneWords · crmAddDone · crmAddBody · crmAddAskServer (moved out of cap-crm.js so that file does not grow, CRM-259/260).
 * CALLED BY cap-crm.js (crmAddSearch · crmAddGo); crm.html loads it after cap-crm.js, before the others call it.
 * FLOW      crmAddSearch → crmAddAskServer → ADD.mine → crmAddResults · crmAddGo → crmAddContact → crmAddBody → api → crmAddDone → crmAddContactRest (the e-mail, a supplier's phone) → the new party opened.
 * CARD      11-crm-and-marketing/crm-parties
 * ID        CRM001
 * OWNER     cb-crm
 * RISK      plain
 */
'use strict';
/** the text of one of the quick add's own fields, trimmed ('' when the field is not open) */
function crmAddField(id) {
  var node = document.getElementById(id);
  return node ? String(node.value || '').trim() : '';
}
/** is the typed e-mail empty (optional) or shaped like an address; the server judges it again */
function crmAddEmailOk(email) {
  return !email || /^\S+@\S+\.\S+$/.test(email);
}
/** CRM-260: the contact the add door did not take (the e-mail; a supplier's phone), written once through the party's own edit route */
async function crmAddContactRest(first, made, phone, email) {
  var rest = {};
  if (email) rest.email = email;
  if (phone && first === 'supplier') rest.phone = phone;
  if (!Object.keys(rest).length) return;
  await api(first === 'supplier' ? 'supPatch' : 'custGroup', { params: { id: made.customer_list_id || made.supplier_list_id }, body: rest });
}
/** the phone and e-mail typed in the quick add: none for a party found on the network (it keeps its own) */
function crmAddContact(kind) {
  return kind === 'found' ? { phone: '', email: '' } : { phone: crmAddField('crm_addphone'), email: crmAddField('crm_addemail') };
}
/** the toast's first words for the role that was added */
function crmAddDoneWords(role) {
  return role === 'both' ? 'Customer and supplier added' : role === 'supplier' ? 'Supplier added' : 'Customer added';
}
/** after the add: the contact the add door did not take (through the party's own edit route), the sheet closed, the toast, the list loaded again and the new party opened */
async function crmAddDone(made, role, first, contact) {
  var id = made.customer_identity_id || made.supplier_entity_id;
  await crmAddContactRest(first, made, contact.phone, contact.email);
  closeModal();
  toast(tx(crmAddDoneWords(role)) + ': ' + (made.display_name || ADD.q));
  await crmLoad(true);
  var p = id && CRM.byKey[id];
  crmGo(p ? '#/party/' + encodeURIComponent(crmKey(p)) : '#/parties');
}
/** the body of one add call: a party found on the network by its handle, or a local one by name (and phone, for a customer) */
function crmAddBody(kind, rl, byHandle, name, phone) {
  if (kind === 'found') return rl === 'supplier' ? { supplier_bridge_id: byHandle.bridge_id } : { handle: byHandle.user_id };
  return rl === 'customer' && phone ? { name: name, phone: phone } : { name: name };
}
/** the quick add's e-mail was typed but is not an address: say so, free the sheet */
function crmAddBadEmail() {
  toast(tx('That e-mail does not look right.'));
  ADD.busy = false;
}
/** CRM-259: ask the server for the 4 parties that match the typed words; the answer is read only if the words are still the same */
function crmAddAskServer(typed) {
  api('crmParties', { query: { q: typed, limit: 4 } }).then(
    function (found) {
      if (ADD.q.trim() === typed) {
        ADD.mine = crmNormalize((found && found.parties) || []);
        crmAddResults();
      }
    },
    function () {} /* the loaded list keeps answering */
  );
}
