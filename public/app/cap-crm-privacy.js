/* cap-crm-privacy.js — CB CRM: a party's CONSENT (the record's Consent block) and the shop's PRIVACY REQUESTS register (#/privacy).
 * CARD 11-crm-and-marketing/crm-privacy
 * T3-P3-CONSENT (2026-10-14). Loaded by crm.html after cap-crm-record.js. Flow: CRM step 6 "consent & privacy requests" (docs/process/flows.json).
 *
 * ⭐ REUSE (rule 1): crmSec (the record's own section) · CBList (the history and the register) · modal/closeModal (crm.html's sheet) · crmBar ·
 *   crmViewOnlyBtn · crmErrWords · api() (core.js) · bkDate (cap-books.js) · the record's data-crm click door (crmRecordClick hands here).
 * ⭐ ONE CALCULATION (rule 2): nothing is decided here. The server's `may[channel][purpose].code` picks the chip and which button is drawn;
 *   `why` is only printed; `law` (the shop's country's words, lib/privacy.lawOf) is painted, never composed; `late`, `due_at` are the server's.
 * ⭐ NEW PATHS (rule 4): no screen held consent or the register (grep consent|contact-pref|privacy: only the Standards rows) — the api's
 *   GET/POST contact-prefs and the b307 register had no client since CO1 (13 Oct).
 * The server decides: a viewer's Yes/No is greyed with its sentence; before b306/b307 the block says so in words, never "nothing here". */
'use strict';
var PRV = {
  rows: [],
  total: 0,
  page: 1,
  limit: 50,
  open: 0,
  late: 0,
  state: 'idle',
  err: null,
  api: null,
  mayAnswer: false,
  why: null,
  migrated: true,
  params: {},
  busy: false
};
/* tones: green = agreed, amber = needs a hand (not asked · said no · withdrawn · stopped), plain = allowed by law. Red is for a stopped sale, not for consent (SYSTEM.md colour rule; rule 13: amber reads AA in both themes) */
var CRM_CONSENT_WORD = {
  CONSENT: ['Agreed', 'green'],
  LEGITIMATE_USE: ['Allowed', ''],
  NO_CONSENT: ['Not asked', 'amber'],
  CONSENT_WITHDRAWN: ['Withdrawn', 'amber'],
  SAID_NO: ['Said no', 'amber'],
  OPTED_OUT: ['Stopped', 'amber']
};
var CRM_REQ_KIND = { access: 'A copy', correct: 'Correct', erase: 'Erase', withdraw: 'Withdraw consent', nominate: 'Nominate', grievance: 'Grievance' };
var CRM_REQ_OUT = { done: 'Done', partly: 'Partly', refused: 'Refused' };
var CRM_CONSENT_CH = ['whatsapp', 'sms', 'email', 'phone', 'chitbridge'];

/* ═══ 1 · THE RECORD'S CONSENT BLOCK — painted from the record's own contact_prefs (no extra read); the history on open ═══ */
/** the verdict chip: the server's code → a word and a tone (the sentence sits in the title) */
function crmConsentChip(v, tid) {
  var w = CRM_CONSENT_WORD[(v || {}).code] || ['Unknown', ''];
  return (
    '<span class="tag' +
    (w[1] ? ' ' + w[1] : '') +
    '" title="' +
    esc((v || {}).why || '') +
    '" data-testid="' +
    tid +
    '" data-code="' +
    esc((v || {}).code || '') +
    '">' +
    esc(tx(w[0])) +
    '</span>'
  );
}
/** why a Yes/No may not be pressed now — '' when it may (the viewer's sentence; the not-migrated sentence) */
function crmConsentWhyNot(cp) {
  if (!crmEdit()) return crmViewWhy();
  if (!cp || !cp.migrated) return tx('Consent records start after an update.');
  return '';
}
function crmConsentBtn(ch, pu, allowed, label, why, tid) {
  return (
    '<button type="button" class="act sm' +
    (allowed && pu === 'marketing' ? '' : ' ghost') +
    '" data-crm="consent" data-ch="' +
    ch +
    '" data-pu="' +
    pu +
    '" data-v="' +
    (allowed ? '1' : '0') +
    '" data-testid="' +
    tid +
    '"' +
    (why ? ' disabled aria-disabled="true" title="' + esc(why) + '"' : '') +
    '>' +
    esc(tx(label)) +
    '</button>'
  );
}
/** the fact beside the section title: which channels may get offers, in words */
function crmConsentFact(cp) {
  if (!cp) return '';
  if (!cp.migrated) return esc(tx('Not set up yet'));
  var on = CRM_CONSENT_CH.filter(function (item) {
    return cp.may[item] && cp.may[item].marketing && cp.may[item].marketing.may;
  }).map(function (item) {
    return tx(CRM_CHAN[item]);
  });
  return esc(on.length ? tx('Offers') + ': ' + on.join(', ') : tx('No consent for offers'));
}
/** one row per channel: Offers (consent) and Messages (about their own orders) — the chip from the code; the button that CHANGES the state only */
function crmConsentRows(cp) {
  var why = crmConsentWhyNot(cp),
    may = (cp && cp.may) || {};
  return CRM_CONSENT_CH.map(function (item) {
    var m = (may[item] || {}).marketing || { code: 'NO_CONSENT' },
      s = (may[item] || {}).service || { code: 'LEGITIMATE_USE' };
    var offers =
      crmConsentChip(m, 'crm-consent-' + item + '-marketing') +
      ' ' +
      (m.may
        ? crmConsentBtn(item, 'marketing', false, 'No', why, 'crm-consent-no-' + item)
        : crmConsentBtn(item, 'marketing', true, 'Yes', why, 'crm-consent-yes-' + item));
    var msgs =
      crmConsentChip(s, 'crm-consent-' + item + '-service') +
      ' ' +
      (s.may
        ? crmConsentBtn(item, 'service', false, 'Stop', why, 'crm-consent-stop-' + item)
        : crmConsentBtn(item, 'service', true, 'Allow', why, 'crm-consent-allow-' + item));
    return (
      '<div class="kv" data-testid="crm-consent-row-' +
      item +
      '"><b>' +
      esc(tx(CRM_CHAN[item] || item)) +
      '</b><span class="consent-cells"><span class="cc"><i>' +
      esc(tx('Offers')) +
      '</i> ' +
      offers +
      '</span><span class="cc"><i>' +
      esc(tx('Their orders')) +
      '</i> ' +
      msgs +
      '</span></span></div>'
    );
  }).join('');
}
/** the section (crmSec): the rows now, the law line + the history when opened, a Privacy request door */
function crmConsentHTML(p, rec) {
  if (p.kind === 'walk-in') return '';
  var cp = rec.contact_prefs || null,
    why = crmConsentWhyNot(cp);
  var head =
    cp && !cp.migrated
      ? '<div class="hint" data-testid="crm-consent-notyet">' + esc(tx('Consent records start after an update. Nothing is lost.')) + '</div>'
      : '';
  var reqBtn = crmEdit()
    ? '<button type="button" class="act sm ghost" data-crm="privreq" data-testid="crm-consent-request">' + esc(tx('Privacy request')) + '</button>'
    : crmViewOnlyBtn('crm-consent-request', tx('Privacy request'), crmViewWhy());
  var body =
    head +
    '<div class="consent-rows" data-testid="crm-consent-rows">' +
    crmConsentRows(cp) +
    '</div>' +
    (why && cp && cp.migrated ? '<div class="why" data-testid="crm-consent-why">' + esc(why) + '</div>' : '') +
    '<div class="hint" id="crm_consent_law" data-testid="crm-consent-law"></div>' +
    '<div id="crm_consent_hist" data-testid="crm-consent-hist"></div>' +
    '<div class="supacts" style="margin-top:8px">' +
    reqBtn +
    '<a class="act sm ghost" href="#/privacy" data-testid="crm-consent-register">' +
    esc(tx('All requests')) +
    '</a></div>';
  return crmSec('consent', 'Consent', crmConsentFact(cp), body, false);
}
/** how one consent row was given - the person's own STOP reply (b777 source), withdrawn, by them online, by you, by the shop, or just noted */
function crmConsentHow(row, partyId) {
  if (row.source === 'reply') return tx('Withdrawn · replied STOP'); /* CON-2: the person's own STOP on WhatsApp, not staff or the web */
  if (row.withdrawn_at) return tx('Withdrawn');
  var me = (window.SESSION && (SESSION.actorId || SESSION.entityId)) || null;
  if (row.noted_by && row.noted_by === partyId) return tx('By them, online');
  if (row.noted_by && me && row.noted_by === me) return tx('Noted by you');
  return row.noted_by ? tx('Noted by the shop') : tx('Noted');
}
/** on open: the history (what · when · how given · withdrawn) and the law's words — one GET, a CBList mount; could-not-read in words */
async function crmConsentOpen(p) {
  var hist = document.getElementById('crm_consent_hist'),
    node = document.getElementById('crm_consent_law');
  if (!hist || hist.getAttribute('data-loaded')) return;
  hist.setAttribute('data-loaded', '1');
  var r;
  try {
    r = await api('crmPrefs', { params: { id: p.party_id } });
  } catch (e) {
    hist.removeAttribute('data-loaded');
    hist.innerHTML =
      '<div class="hint" data-testid="crm-consent-hist-err">' +
      esc(e && e.status === 503 ? tx('Consent records start after an update. Nothing is lost.') : tx("Couldn't read the consent history.")) +
      ' <button type="button" class="crm-mini" data-crm="consentretry">' +
      esc(tx('Try again')) +
      '</button></div>';
    return;
  }
  hist = document.getElementById('crm_consent_hist');
  node = document.getElementById('crm_consent_law');
  if (!hist) return;
  if (node && r.law) node.innerHTML = r.law.known ? '<b>' + esc(r.law.short || r.law.law) + '</b> · ' + esc(r.law.consent) : esc(r.law.note || '');
  var rows = (r.history || []).map(function (item, index) {
    return Object.assign({ _i: index }, item);
  });
  var how = function (h) {
    return crmConsentHow(h, p.party_id);
  };
  var what = function (h) {
    return (
      tx(CRM_CHAN[h.channel] || h.channel) +
      ' · ' +
      (h.purpose === 'marketing' ? tx('offers') : tx('their orders')) +
      ' · ' +
      (h.allowed ? tx('yes') : tx('no'))
    );
  };
  if (CRMR.consentApi) {
    try {
      CRMR.consentApi.destroy();
    } catch (_) {}
  }
  CRMR.consentApi = CBList.mount(hist, {
    key: 'crm-consent-hist',
    t: tx,
    fill: false,
    view: 'grid',
    tools: { search: false, csv: false, count: true },
    rows: function () {
      return rows;
    },
    id: function (h) {
      return h.pref_id || String(h._i);
    },
    rowTid: function (h) {
      return 'crm-consent-h-' + (h.pref_id || h._i);
    },
    columns: [
      {
        key: 'when',
        label: 'When',
        prio: 1,
        w: 150,
        cell: function (h) {
          return h.noted_at ? bkDate(h.noted_at) : '—';
        }
      },
      { key: 'what', label: 'What', prio: 2, w: 260, cell: what },
      { key: 'how', label: 'How given', prio: 3, w: 170, cell: how },
      {
        key: 'notice',
        label: 'Notice',
        prio: 4,
        w: 120,
        cell: function (h) {
          return h.notice_version || tx('None yet');
        }
      }
    ],
    defaultCols: ['when', 'what', 'how'],
    cardMax: 3,
    head: { title: tx('History') },
    empty: { title: tx('Nothing noted yet.'), sub: tx('Say yes or no above when they tell you.') }
  });
}
/** a Yes / No / Stop / Allow → ONE POST (the same route the shopper's own page writes through); the record re-reads */
async function crmConsentSet(p, ch, pu, allowed) {
  if (PRV.busy) return;
  PRV.busy = true;
  try {
    await api('crmPrefSet', { params: { id: p.party_id }, body: { channel: ch, purpose: pu, allowed: allowed } });
    toast(tx('Noted'));
    CRMR.keep.consentOpen = true;
    crmRecordOpen(CRM.route);
  } catch (e) {
    toast(
      e && e.status === 503
        ? tx('Consent records start after an update. Nothing is lost.')
        : e && e.status === 403
          ? crmViewWhy()
          : tx("Couldn't save that. Try again.")
    );
  } finally {
    PRV.busy = false;
  }
}
/** the click door the record hands here (crmRecordClick → crmPrivacyClick): true when handled */
function crmPrivacyClick(a, node) {
  var p = CRMR.p;
  if (a === 'consent' && p) {
    crmConsentSet(p, node.getAttribute('data-ch'), node.getAttribute('data-pu'), node.getAttribute('data-v') === '1');
    return true;
  }
  if (a === 'consentretry' && p) {
    crmConsentOpen(p);
    return true;
  }
  if (a === 'privreq' && p) {
    crmGo('#/privacy?party=' + encodeURIComponent(p.party_id) + '&who=' + encodeURIComponent(p.display_name || '') + '&add=1');
    return true;
  }
  if (a === 'prvadd') {
    crmPrivReqOpen(PRV.params);
    return true;
  }
  if (a === 'prvsave') {
    crmPrivReqSave();
    return true;
  }
  if (a === 'prvanswer') {
    crmPrivAnswerOpen(node.getAttribute('data-id'));
    return true;
  }
  if (a === 'prvanswersave') {
    crmPrivAnswerSave(node.getAttribute('data-id'));
    return true;
  }
  if (a === 'prvpage') {
    PRV.page = Math.max(1, Number(node.getAttribute('data-v')) || 1);
    crmPrivLoad();
    return true;
  }
  if (a === 'prvretry') {
    crmPrivLoad();
    return true;
  }
  return false;
}
/** wired by crmRecordPaint's mounts: the Consent <details> loads its history the first time it opens (and stays open after a Yes/No) */
function crmConsentMount(p) {
  var node = document.querySelector('[data-testid="crm-sec-consent"]');
  if (!node) return;
  node.addEventListener('toggle', function () {
    if (node.open) crmConsentOpen(p);
  });
  if (CRMR.keep.consentOpen) {
    CRMR.keep.consentOpen = false;
    node.open = true;
  }
}

/* ═══ 2 · THE REGISTER — #/privacy: every request to see, correct, erase, withdraw, nominate or complain, on the law's clock ═══ */
function crmPrivacy(frame, params) {
  PRV.params = params || {};
  crmBar(
    '<a href="#/parties" data-testid="crm-back">‹ ' + esc(tx('Parties')) + '</a>',
    crmEdit()
      ? '<button type="button" class="act sm" data-crm="prvadd" data-testid="crm-prv-add">+ ' + esc(tx('Log a request')) + '</button>'
      : crmViewOnlyBtn('crm-prv-add', '+ ' + tx('Log a request'), crmViewWhy()),
    true
  );
  var node = document.getElementById('screen');
  node.className = 'screen flush';
  node.innerHTML = '<div id="crm_prv" data-testid="crm-prv-list"></div>';
  if (PRV.api && PRV.api.destroy) {
    try {
      PRV.api.destroy();
    } catch (_) {}
  }
  var el = document.getElementById('crm_prv');
  var due = function (r) {
    if (r.answered_at)
      return (
        '<span class="tag' +
        (r.answered_late ? ' amber' : ' green') +
        '">' +
        esc(tx(CRM_REQ_OUT[r.outcome] || 'Answered')) +
        (r.answered_late ? ' · ' + esc(tx('late')) : '') +
        '</span>'
      );
    return (
      '<span class="tag' +
      (r.late ? ' amber' : '') +
      '" data-testid="crm-prv-due-' +
      r.request_id +
      '">' +
      (r.late ? esc(tx('Late')) + ' · ' : '') +
      esc(bkDate(r.due_at)) +
      '</span>'
    ); /* amber: AA in both themes (rule 13); the word says late */
  };
  PRV.api = CBList.mount(el, {
    key: 'crm-privacy',
    t: tx,
    rows: function () {
      return PRV.state === 'ready' ? PRV.rows : [];
    },
    id: function (r) {
      return r.request_id;
    },
    rowTid: function (r) {
      return 'crm-prv-' + r.request_id;
    },
    columns: [
      {
        key: 'who',
        label: 'Who',
        prio: 1,
        w: 220,
        cell: function (r) {
          return r.who;
        }
      },
      {
        key: 'kind',
        label: 'Asked for',
        prio: 2,
        w: 160,
        cell: function (r) {
          return tx(CRM_REQ_KIND[r.kind] || r.kind);
        }
      },
      { key: 'due', label: 'Due', prio: 3, w: 170, html: true, cell: due },
      {
        key: 'received',
        label: 'Received',
        prio: 4,
        w: 130,
        cell: function (r) {
          return bkDate(r.received_at);
        }
      },
      {
        key: 'country',
        label: 'Law of',
        prio: 5,
        w: 90,
        cell: function (r) {
          return r.country || '—';
        }
      },
      {
        key: 'answer',
        label: 'Answer',
        prio: 6,
        w: 300,
        cell: function (r) {
          return r.answer || '—';
        }
      }
    ],
    defaultCols: ['who', 'kind', 'due'],
    cardMax: 3,
    fill: true,
    head: function () {
      var chips = [];
      if (PRV.state === 'ready' && PRV.late) chips.push({ text: crmPlural(PRV.late, 'late', 'late'), tid: 'crm-prv-late' });
      if (PRV.state === 'ready' && !PRV.open && PRV.total) chips.push({ text: tx('All answered'), tid: 'crm-prv-allanswered' });
      return { title: tx('Privacy requests'), chips: chips };
    },
    state: function () {
      return PRV.state === 'loading' ? 'loading' : PRV.state === 'error' ? 'error' : null;
    },
    error: function () {
      return crmErrWords(PRV.err, 'privacy requests');
    },
    onRetry: function () {
      crmPrivLoad();
    },
    empty: function () {
      return PRV.state === 'notyet'
        ? { title: tx('Privacy requests start after an update.'), sub: tx('Nothing is lost.') }
        : { title: tx('No privacy requests.'), sub: tx('Log one when a person asks to see, correct or erase their data.') };
    },
    filters: [
      {
        key: 'open',
        label: tx('State'),
        all: tx('All'),
        options: [{ v: '1', label: tx('Open') }],
        match: function () {
          return true;
        }
      }
    ],
    remote: {
      total: function () {
        return PRV.total;
      },
      onQuery: function (q) {
        PRV.openOnly = q.filt.open === '1';
        PRV.page = 1;
        crmPrivLoad();
      },
      foot: crmPrivFoot
    },
    actions: [
      {
        id: 'answer',
        label: tx('Answer'),
        icon: '✓',
        tid: 'crm-prv-answer',
        why: function (r) {
          return r.answered_at ? tx('Answered once') : PRV.mayAnswer ? '' : PRV.why || tx('Only the owner answers');
        },
        run: function (r) {
          crmPrivAnswerOpen(r.request_id);
        }
      }
    ]
  });
  if (!frame) {
    crmPrivLoad();
    if (PRV.params.add === '1' && crmEdit()) crmPrivReqOpen(PRV.params);
  }
}
/** the page's own pager under the rows (the unit's `foot`): the server's total · page · limit, two buttons */
function crmPrivFoot() {
  if (PRV.state !== 'ready' || !PRV.total) return '';
  var pages = Math.max(1, Math.ceil(PRV.total / PRV.limit));
  if (pages <= 1) return '';
  return (
    '<span data-testid="crm-prv-page">' +
    esc(txf('Page {p} of {n}', { p: PRV.page, n: pages })) +
    '</span> ' +
    '<button type="button" class="crm-mini" data-crm="prvpage" data-v="' +
    (PRV.page - 1) +
    '"' +
    (PRV.page <= 1 ? ' disabled' : '') +
    ' data-testid="crm-prv-prev">‹ ' +
    esc(tx('Previous')) +
    '</button> ' +
    '<button type="button" class="crm-mini" data-crm="prvpage" data-v="' +
    (PRV.page + 1) +
    '"' +
    (PRV.page >= pages ? ' disabled' : '') +
    ' data-testid="crm-prv-next">' +
    esc(tx('Next')) +
    ' ›</button>'
  );
}
async function crmPrivLoad() {
  PRV.state = 'loading';
  crmPrivRefresh();
  try {
    var q = { page: PRV.page, limit: PRV.limit };
    if (PRV.openOnly) q.open = '1';
    var reply = await api('crmPrivReqs', { query: q });
    /* core.js api() collapses { requests[], … } to the array and carries total · page · limit · open · late · may_answer · why on it (SIBS) */
    PRV.rows = Array.isArray(reply) ? reply : reply.requests || [];
    PRV.total = Number(reply.total) || PRV.rows.length;
    PRV.open = Number(reply.open) || 0;
    PRV.late = Number(reply.late) || 0;
    PRV.mayAnswer = !!reply.may_answer;
    PRV.why = reply.why || null;
    PRV.limit = Number(reply.limit) || PRV.limit;
    PRV.state = 'ready';
    PRV.err = null;
  } catch (e) {
    PRV.state = e && e.status === 503 ? 'notyet' : 'error';
    PRV.err = e;
  }
  crmPrivRefresh();
}
function crmPrivRefresh() {
  var a = PRV.api;
  if (a && document.getElementById('crm_prv')) a.refresh();
  if (CRM.route && CRM.route.view === 'privacy') crmNav('privacy');
} /* the nav's late count follows the load */

/* ── Log a request (who · what · when · which law) — the owner or staff; the date the law sets is the SERVER's ── */
function crmPrivReqOpen(pre) {
  pre = pre || {};
  var kinds = Object.keys(CRM_REQ_KIND)
    .map(function (item) {
      return '<option value="' + item + '">' + esc(tx(CRM_REQ_KIND[item])) + '</option>';
    })
    .join('');
  modal(
    '<div class="mhd"><div class="t">' +
      esc(tx('Log a privacy request')) +
      '</div></div><div class="mbody" data-testid="crm-prv-sheet">' +
      '<label>' +
      esc(tx('Who asked?')) +
      '<input class="inp" id="crm_prv_who" data-testid="crm-prv-who" value="' +
      esc(pre.who || '') +
      '" placeholder="' +
      esc(tx('Name, phone or e-mail')) +
      '"></label>' +
      '<label>' +
      esc(tx('Asked for')) +
      '<select class="inp" id="crm_prv_kind" data-testid="crm-prv-kind">' +
      kinds +
      '</select></label>' +
      '<label>' +
      esc(tx('Received on')) +
      '<input class="inp" id="crm_prv_when" data-testid="crm-prv-when" type="date" value="' +
      esc(crmLocalISO(new Date())) +
      '" style="width:auto"></label>' +
      '<input type="hidden" id="crm_prv_party" value="' +
      esc(pre.party || '') +
      '">' +
      '<div class="hint">' +
      esc(tx('The answer date follows the shop’s country’s law.')) +
      '</div>' +
      '<div id="crm_prv_msg" class="hint" role="status" data-testid="crm-prv-msg"></div></div>' +
      '<div class="mfoot"><button type="button" onclick="closeModal()">' +
      esc(tx('Cancel')) +
      '</button><button type="button" class="pri" data-crm="prvsave" data-testid="crm-prv-save">' +
      esc(tx('Log')) +
      '</button></div>'
  );
  document.getElementById('crm_prv_who').focus();
}
async function crmPrivReqSave() {
  if (PRV.busy) return;
  var node = function (id) {
      return String((document.getElementById(id) || {}).value || '').trim();
    },
    msg = document.getElementById('crm_prv_msg');
  if (!node('crm_prv_who')) {
    msg.textContent = tx('Who asked? A name, phone or e-mail.');
    return;
  }
  PRV.busy = true;
  try {
    var body = { who: node('crm_prv_who'), kind: node('crm_prv_kind'), received_at: new Date(node('crm_prv_when') + 'T09:00:00').toISOString() };
    if (node('crm_prv_party')) body.party_id = node('crm_prv_party');
    await api('crmPrivReqAdd', { body: body });
    closeModal();
    toast(tx('Logged'));
    PRV.page = 1;
    crmPrivLoad();
  } catch (e) {
    msg.textContent = crmPrivWhy(e);
  } finally {
    PRV.busy = false;
  }
}
/* ── Answer: once, by the owner; what was done or why not ── */
function crmPrivAnswerOpen(id) {
  var r = PRV.rows.filter(function (x) {
    return x.request_id === id;
  })[0];
  if (!r) return;
  if (!PRV.mayAnswer) {
    toast(PRV.why || tx('Only the owner answers'));
    return;
  }
  modal(
    '<div class="mhd"><div class="t">' +
      esc(tx('Answer')) +
      ' · ' +
      esc(r.who) +
      '</div></div><div class="mbody" data-testid="crm-prv-answer-sheet">' +
      '<div class="kv"><b>' +
      esc(tx('Asked for')) +
      '</b><span>' +
      esc(tx(CRM_REQ_KIND[r.kind] || r.kind)) +
      ' · ' +
      esc(tx('due')) +
      ' ' +
      esc(bkDate(r.due_at)) +
      '</span></div>' +
      (r.kind === 'erase'
        ? '<div class="hint" data-testid="crm-prv-erase-note">' +
          esc(tx('Erasure runs through the platform’s lifecycle path. Record the outcome here.')) +
          '</div>'
        : '') +
      '<label>' +
      esc(tx('Outcome')) +
      '<select class="inp" id="crm_prv_out" data-testid="crm-prv-out">' +
      Object.keys(CRM_REQ_OUT)
        .map(function (item) {
          return '<option value="' + item + '">' + esc(tx(CRM_REQ_OUT[item])) + '</option>';
        })
        .join('') +
      '</select></label>' +
      '<label>' +
      esc(tx('What was done, or why not')) +
      '<textarea class="inp" id="crm_prv_ans" data-testid="crm-prv-ans" rows="3"></textarea></label>' +
      '<div id="crm_prv_amsg" class="hint" role="status" data-testid="crm-prv-amsg"></div></div>' +
      '<div class="mfoot"><button type="button" onclick="closeModal()">' +
      esc(tx('Cancel')) +
      '</button><button type="button" class="pri" data-crm="prvanswersave" data-id="' +
      esc(id) +
      '" data-testid="crm-prv-answer-save">' +
      esc(tx('Answer')) +
      '</button></div>'
  );
  document.getElementById('crm_prv_ans').focus();
}
async function crmPrivAnswerSave(id) {
  if (PRV.busy) return;
  var node = function (k) {
      return String((document.getElementById(k) || {}).value || '').trim();
    },
    msg = document.getElementById('crm_prv_amsg');
  if (!node('crm_prv_ans')) {
    msg.textContent = tx('Write what was done, or why not.');
    return;
  }
  PRV.busy = true;
  try {
    await api('crmPrivReqAnswer', { params: { id: id }, body: { outcome: node('crm_prv_out'), answer: node('crm_prv_ans') } });
    closeModal();
    toast(tx('Answered'));
    crmPrivLoad();
  } catch (e) {
    msg.textContent = crmPrivWhy(e);
  } finally {
    PRV.busy = false;
  }
}
/** the server's refusal in the shop's words (its `why` or `message` when it is a sentence; never a raw error) */
function crmPrivWhy(e) {
  if (e && e.status === 503) return tx('Privacy requests start after an update. Nothing is lost.');
  var m = e && e.data && (e.data.why || e.data.message); /* core.js api(): e.status + e.data = the answer's own body */
  return m && e.status < 500 ? String(m) : tx("Couldn't save that. Try again.");
}
