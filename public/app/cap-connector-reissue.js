/* app/cap-connector-reissue.js — the connector REISSUE step-up: re-type the gateway name + a one-time code emailed to the entity, then a fresh package or key. Split out of cap-connector.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the destructive step-up: acReissueGate · acReissueSendCode · acReissueDevices · acReissueSubmit
 * CALLED BY cap-connector.js (acCreatePackage and the cockpit buttons call acReissueGate); loaded with it by ensureCap('connector') through CAP_WITH in app.html, so it is there before the cockpit paints
 * FLOW      acReissueGate (dialog) → acReissueSendCode (code to the account email) → acReissueDevices → acReissueSubmit (api connectorReissueCode / connectorRegen)
 * CARD      28-platform-and-operations/connector-cockpit
 * OWNER     cb-connect
 * RISK      plain
 */
'use strict';
// ── Reissue step-up (destructive): re-type the gateway name (the QUESTION) + a one-time code emailed to the ENTITY
//    (the PASSWORD). Only the entity or a manager delegate can reissue; the code always goes to the account email.
function acReissueGate(id, mode) {
  UI.acReissue = { id: id, mode: mode || 'package' };
  if (typeof modal !== 'function') {
    if (typeof toast === 'function') toast('Cannot open the reissue dialog.');
    return;
  }
  modal(
    '<div style="padding:2px 2px"><div style="font-weight:800;font-size:var(--fs-4);margin-bottom:4px">' +
      tx('⚠ Reissue device key') +
      '</div>' +
      '<div style="font-size:var(--fs-2);color:var(--grey-2);line-height:1.5;margin-bottom:12px">' +
      txf(
        'This issues a {newkey} — any device already running this gateway {stops} until you reflash it with the new installer. Only the owner or a manager may do this.',
        { newkey: '<b>' + tx('new key') + '</b>', stops: '<b>' + tx('stops') + '</b>' }
      ) +
      '</div>' +
      '<label class="fl">1 · Type the gateway\'s exact name</label><input data-cbsid="SCR002-I09" class="inp" id="rg_name" placeholder="gateway name" style="width:100%;margin-bottom:12px">' +
      '<label class="fl">' +
      tx('2 · One-time code (sent to the account email)') +
      '</label><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px"><input data-cbsid="SCR002-I10" class="inp" id="rg_otp" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="flex:1"><button data-cbsid="SCR002-B09" class="composebtn" onclick="acReissueSendCode()">' +
      tx('Send code') +
      '</button></div>' +
      '<div id="rg_msg" style="font-size:var(--fs-1);color:var(--blue-2);min-height:15px;margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:10px"><button data-cbsid="CMP003" class="composebtn" style="flex:1" onclick="closeModal()">' +
      tx('Cancel') +
      '</button><button data-cbsid="SCR002-B10" class="composebtn pri" style="flex:1" onclick="acReissueSubmit()">' +
      tx('Reissue') +
      '</button></div>' +
      '</div>',
    false
  );
}
async function acReissueSendCode() {
  var node = document.getElementById('rg_msg');
  if (node) node.textContent = 'Sending…';
  try {
    var reply = await api('connectorReissueCode', { body: {} });
    if (node)
      node.innerHTML =
        'Code sent to <b>' +
        esc((reply && reply.email) || 'the account email') +
        '</b>.' +
        (reply && reply.dev_otp ? ' <span style="color:var(--warn-2)">Dev code <b>' + esc(reply.dev_otp) + '</b></span>' : '');
  } catch (e) {
    if (node) node.textContent = (e && e.message) || 'Could not send the code.';
  }
}
/** the gateway's connected devices for the installer; null when they cannot be read (the old key is already dead: the new one is shown once, never lost with the closed sheet — GF-07 M4 / EL-07 M2) */
async function acReissueDevices(actorId) {
  try {
    var r = await api('connectorConns', { params: { actorId: actorId } });
    return (Array.isArray(r) ? r : (r && r.connections) || []) /* ⚠️ collapsed to the array — see acLoadDevices */
      .filter(function (item) {
        return item.enabled !== false;
      })
      .map(function (item) {
        var cf = item.conn_config || {};
        return { bridge_id: item.bridge_id, ref: item.ref, folder: cf.folder || null, classes: cf.classes || null };
      });
  } catch (failure) {
    if (typeof cbQuiet === 'function') cbQuiet('connector: the devices were not read, the key is shown instead', failure);
    return null;
  }
}
async function acReissueSubmit() {
  var g = UI.acReissue || {},
    id = g.id,
    mode = g.mode;
  var name = ((document.getElementById('rg_name') || {}).value || '').trim(),
    node = ((document.getElementById('rg_otp') || {}).value || '').trim();
  var m = document.getElementById('rg_msg');
  if (!name) {
    if (m) m.textContent = 'Type the gateway name.';
    return;
  }
  if (!/^[0-9]{6}$/.test(node)) {
    if (m) m.textContent = 'Enter the 6-digit code.';
    return;
  }
  if (m) m.textContent = 'Verifying…';
  try {
    var reply = await api('connectorRegen', { params: { actorId: id }, body: { name: name, otp: node } });
    var key = reply && reply.provision_key;
    if (!key) {
      if (m) m.textContent = 'No key issued.';
      return;
    }
    closeModal();
    var devs = mode === 'package' ? await acReissueDevices(id) : null;
    if (devs) {
      _download(
        'chitbridge-install.sh',
        _buildInstaller({
          endpoint: CFG.API_BASE /* HX1: the api this app talks to */,
          key: key,
          heartbeat_sec: 60,
          spool_dir: '/opt/chitbridge/spool',
          devices: devs
        })
      );
      UI.acFreshKey = null;
      if (typeof paintAcDetail === 'function') paintAcDetail(); // key is INSIDE the installer — never shown raw
      if (typeof toast === 'function') toast('Key reissued — installer downloaded (key is inside it). Reflash the Pi: sudo bash chitbridge-install.sh');
    } else {
      UI.acFreshKey = key;
      UI.acProvOpen = true;
      if (typeof paintAcDetail === 'function') paintAcDetail(); // direct-device path: the raw key IS the deliverable, shown once
      if (typeof toast === 'function') toast(mode === 'package' ? 'The installer could not be built. The old key is dead: copy the new one now.' : 'New ActorKey issued — copy it now.');
    }
  } catch (e) {
    if (m) m.textContent = (e && e.message) || 'Reissue failed.';
  }
}
