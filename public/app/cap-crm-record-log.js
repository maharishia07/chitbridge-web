/* app/cap-crm-record-log.js — the LOG SHEET on a party's record: a call, a visit, a WhatsApp or a note, with the follow-up it may leave. Split out of cap-crm-record.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the log sheet: LOG (its draft) · crmLogOpen · crmLogSave
 * CALLED BY cap-crm-record.js (crmRecordClick opens it from the record's Log button and reads LOG for the kind, direction and follow-up toggles); loaded by crm.html before it
 * FLOW      crmLogOpen(p) → the sheet → the person fills it → crmLogSave → api (a timeline entry, optionally a follow-up) → the record repaints
 * CARD      11-crm-and-marketing/crm-record
 * OWNER     cb-crm
 * RISK      plain
 */
'use strict';
/* ═══ THE LOG SHEET — a call, a visit, a WhatsApp or a note; optionally the follow-up it leaves (F4) ═════════════════ */
var LOG = { kind: 'call', dir: 'out', fu: false, busy: false };
function crmLogOpen(p) {
  LOG.kind = 'call';
  LOG.dir = 'out';
  LOG.fu = false;
  LOG.busy = false;
  LOG.p = p;
  var seg = function (a, items, cur) {
    return (
      '<div class="seg2" role="group">' +
      items
        .map(function (x) {
          return (
            '<button data-cbsid="CRM006-B20" type="button" data-crm="' +
            a +
            '" data-v="' +
            x[0] +
            '" aria-pressed="' +
            (x[0] === cur) +
            '" data-testid="crm-' +
            a +
            '-' +
            x[0] +
            '">' +
            esc(tx(x[1])) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  };
  ui.dialog({
    mount: 'CRM006-U201',
    pop: 'POP101',
    titleText: tx('Log') + ' · ' + p.display_name,
    testid: 'crm-log-sheet',
    body:
      '<div class="supacts">' +
      seg(
        'logkind',
        [
          ['call', 'Call'],
          ['visit', 'Visit'],
          ['whatsapp', 'WhatsApp'],
          ['note', 'Note']
        ],
        'call'
      ) +
      '<span id="crm_logdir">' +
      seg(
        'logdir',
        [
          ['out', 'Out'],
          ['in', 'In']
        ],
        'out'
      ) +
      '</span></div>' +
      '<label>' +
      esc(tx('What happened?')) +
      '<textarea data-cbsid="CRM006-T01" class="inp" id="crm_log_body" data-testid="crm-log-body" rows="4" placeholder="' +
      esc(tx('Said, agreed, asked…')) +
      '"></textarea></label>' +
      '<label style="flex-direction:row;align-items:center;gap:8px;font-weight:600"><input data-cbsid="CRM006-I01" type="checkbox" id="crm_log_fu" data-crm="logfu" data-testid="crm-log-fu"> ' +
      esc(tx('Add a follow-up')) +
      '</label>' +
      '<div id="crm_log_fubox" hidden style="display:none;flex-direction:column;gap:8px"><input data-cbsid="CRM006-I02" class="inp" id="crm_log_fuwhat" data-testid="crm-log-fuwhat" placeholder="' +
      esc(tx('Call back about…')) +
      '"><div class="supacts"><input data-cbsid="CRM006-I03" class="inp" id="crm_log_fudue" data-testid="crm-log-fudue" type="date" style="width:auto">' +
      [
        ['tomorrow', 'Tomorrow'],
        ['week', 'Next week']
      ]
        .map(function (x) {
          return '<button data-cbsid="CRM006-B21" type="button" class="crm-mini" data-crm="logpreset" data-v="' + x[0] + '">' + esc(tx(x[1])) + '</button>';
        })
        .join('') +
      '</div></div>' +
      '<div id="crm_log_msg" class="hint" role="status"></div>',
    actions: [
      { name: 'cancel', options: { mount: 'CRM006-U201' } },
      { name: 'save', options: { mount: 'CRM006-U201', key: 'save', effect: 'preference', testid: 'crm-log-save', data: { crm: 'logsave' } } }
    ]
  });
  document.getElementById('crm_log_body').focus();
}
async function crmLogSave() {
  if (LOG.busy) return;
  var node = function (id) {
      return String((document.getElementById(id) || {}).value || '').trim();
    },
    msg = document.getElementById('crm_log_msg'),
    p = LOG.p;
  if (!node('crm_log_body')) {
    msg.textContent = tx('Say what happened.');
    return;
  }
  LOG.busy = true;
  try {
    await api('crmLog', {
      params: { id: p.party_id },
      body: { kind: LOG.kind === 'whatsapp' ? 'message' : LOG.kind, direction: LOG.kind === 'note' ? null : LOG.dir, body: node('crm_log_body') }
    });
    if (LOG.fu && node('crm_log_fuwhat') && node('crm_log_fudue'))
      await api('crmFollowAdd', {
        body: { party_id: p.party_id, what: node('crm_log_fuwhat'), due_at: new Date(node('crm_log_fudue') + 'T09:00:00').toISOString(), source: 'interaction' }
      });
    closeModal();
    toast(tx('Logged'));
    crmLoad(true);
    if (CRM.route && CRM.route.view === 'party') crmRecordOpen(CRM.route);
  } catch (e) {
    msg.textContent = e && e.status === 503 ? tx('Calls and follow-ups start after an update. Nothing is lost.') : tx("Couldn't save that. Try again.");
  }
  LOG.busy = false;
}
