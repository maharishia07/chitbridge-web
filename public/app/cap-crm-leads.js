/* cap-crm-leads.js — CB CRM L1: LEADS AS PARTIES (+ L3: Import from a CSV, at the foot of this file). The Leads tab (a CBList mount, the Parties list's own look), Add lead, and the record's
 * CALLED BY crm.html (loaded after cap-crm.js): the Leads tab, Add lead, the stage chip and "Move to…", Import from a CSV.
 * FLOW  crmLeadsEnsure → GET /api/crm/parties?view=leads → the CBList mount paints → a stage move → CBAction → the server's answer repainted
 * CARD 11-crm-and-marketing/crm-leads
 * stage chip + "Move to…". A lead IS a party (the API's added_via 'lead'); its stage is the server's (memberships, b297) — this page only labels it.
 * ⚠️ BEFORE the API's b297 runs the writes answer 503 LEADS_NOT_MIGRATED: the page says "Lead stages arrive after the next update." — never silence,
 *   never the server's message. Every write goes through CBAction (M64). Needs cap-crm.js (CRM · crmLoad · crmNormalize · crmFuJoin · cells).
 * ⭐ NEW PATHS (rule 4): the Leads list is not a second contact list — it reads GET /api/crm/parties?view=leads (the same rows, leads only) and paints them
 *   with cap-crm.js's own cells; the sheets reuse modal() · CBAction. Nothing here decides a stage or a rule.
 */
'use strict';
var LEADS = { rows: [], state: 'loading', err: null, ready: true, loaded: false, gen: 0, api: null, busy: 0 };
var CRM_STAGE = { lead: 'New lead', demo: 'Demo', trial: 'Trial', parked: 'Not now', lost: 'Lost', customer: 'Customer' };
var CRM_LEADS_WAIT = 'Lead stages arrive after the next update.';

/** the stage, as a chip (the server's word, labelled here) */
function crmStageChip(lead) {
  if (!lead || !lead.stage) return '';
  return (
    '<span class="tag' +
    (lead.stage === 'lost' ? '' : lead.stage === 'parked' ? ' local' : ' on') +
    '" data-testid="crm-stage-chip" data-stage="' +
    esc(lead.stage) +
    '">' +
    esc(tx(CRM_STAGE[lead.stage] || lead.stage)) +
    '</span>'
  );
}
/** what a lead write's failure says, in the shop's words (the server's message is never shown) */
function crmLeadWords(e) {
  var code = e && e.data && e.data.code;
  if (e && e.status === 503) return tx(CRM_LEADS_WAIT);
  if (e && e.status === 403) return crmViewWhy(); /* the server's level gate (lib/access) — the sentence, never "Try again" (WX-L2C) */
  if (code === 'EXISTS') return tx('That name is already on your list.');
  if (code === 'BAD_PHONE') return tx('That phone number does not look right.');
  if (code === 'BAD_NAME') return tx('Give the lead a name.');
  if (code === 'IS_CUSTOMER') return tx('They are a customer now.');
  return tx("Couldn't save that. Try again.");
}

/* ═══ THE READ — leads only; kept beside CRM.rows, never inside it (the Parties list stays clean) ═══════════════════ */
async function crmLeadsLoad(quiet) {
  var g = ++LEADS.gen;
  if (!quiet || !LEADS.loaded) {
    LEADS.state = 'loading';
    crmLeadsRefresh();
  }
  try {
    var reply = await api('crmParties', { query: { view: 'leads' } });
    if (g !== LEADS.gen) return;
    LEADS.ready = !(reply && reply.leads_migrated === false);
    LEADS.rows = crmNormalize((reply && reply.parties) || []);
    await crmFuJoin(LEADS.rows, reply);
    if (g !== LEADS.gen) return;
    crmLeadsIndex();
    LEADS.state = 'ready';
    LEADS.loaded = true;
    LEADS.err = null;
  } catch (e) {
    if (g !== LEADS.gen) return;
    if (LEADS.loaded) LEADS.state = 'ready';
    else {
      LEADS.state = 'error';
      LEADS.err = e;
    }
  }
  crmNav(CRM.route && CRM.route.nav);
  crmLeadsRefresh();
  if (CRM.route && CRM.route.view === 'leads') crmLeadsBar(); /* Add lead · Import grey WITH the sentence once the read says b297 has not run */
}
function crmLeadsBar() {
  crmBar('<strong>' + esc(crmAppName()) + '</strong>', crmLeadAddBtn() + crmLeadImportBtn(), true);
}
function crmLeadsRefresh() {
  var a = LEADS.api;
  if (a && a.el && document.body.contains(a.el)) a.refresh();
}
/** a lead opens on the same record as any party: its key must resolve (crmIndex calls this after every Parties read too) */
function crmLeadsIndex() {
  LEADS.rows.forEach(function (item) {
    CRM.byKey[item.party_id] = item;
    if (item.party_no) CRM.byKey[item.party_no] = item;
  });
}
/** the record asks for this when a key is no row: a lead opened from a link before the Leads tab was read */
async function crmLeadsEnsure() {
  if (!LEADS.loaded) await crmLeadsLoad(true);
}

/* ═══ THE LEADS TAB ═════════════════════════════════════════════════════════════════════════════════════════════ */
function crmLeadCols() {
  return [
    {
      key: 'party',
      label: 'Lead',
      prio: 1,
      w: 270,
      sort: 'name',
      html: true,
      cell: crmPartyCell,
      value: function (p) {
        return p.display_name;
      }
    },
    {
      key: 'stage',
      label: 'Stage',
      prio: 2,
      w: 150,
      sort: 'stage',
      hfilter: 'stage',
      html: true,
      cell: function (p) {
        return crmStageChip(p.lead) || '<span class="sub">—</span>';
      },
      tid: function (p) {
        return 'crm-lead-stage-' + crmKey(p);
      },
      value: function (p) {
        return p.lead ? p.lead.stage : '';
      }
    },
    {
      key: 'phone',
      label: 'Phone',
      prio: 3,
      w: 170,
      cell: function (p) {
        return p.phone || p.otp_contact || '—';
      }
    },
    {
      key: 'next',
      label: 'Next follow-up',
      prio: 4,
      w: 170,
      sort: 'next',
      html: true,
      cell: crmFuCell,
      value: function (p) {
        return p.next_followup_at || '9999';
      }
    },
    {
      key: 'last',
      label: 'Last activity',
      prio: 5,
      w: 190,
      html: true,
      cell: crmLastCell,
      value: function (p) {
        return p.last_at || '';
      }
    }
  ];
}
/** the "+ Add lead" button: greyed with the server's sentence when view-only, disabled until the lead stages are migrated */
function crmLeadAddBtn() {
  if (!crmEdit()) return crmViewOnlyBtn('crm-lead-add', '+ ' + tx('Add lead'), crmViewWhy()); /* shown, greyed, with the server's sentence (FX-L2C) */
  var off = LEADS.loaded && !LEADS.ready;
  return (
    '<button type="button" class="act sm' +
    (off ? ' ghost' : '') +
    '" data-testid="crm-lead-add" data-crm="leadadd"' +
    (off ? ' disabled title="' + esc(tx(CRM_LEADS_WAIT)) + '"' : '') +
    '>+ ' +
    esc(tx('Add lead')) +
    '</button>'
  );
}
/** paint the Leads tab: the bar, then a CBList mount of the lead rows (loaded once, repainted on a stage move) */
function crmLeads(frame) {
  crmLeadsBar();
  var node = document.getElementById('screen');
  node.className = 'screen flush';
  node.innerHTML = '<div id="crm_leads" data-testid="crm-leads"></div>';
  if (LEADS.api && LEADS.api.destroy) {
    try {
      LEADS.api.destroy();
    } catch (_) {}
  }
  LEADS.api = CBList.mount(document.getElementById('crm_leads'), {
    key: 'crm-leads',
    t: tx,
    rows: function () {
      return LEADS.rows;
    },
    id: function (p) {
      return p.party_id;
    },
    rowTid: function (p) {
      return 'crm-lead-' + crmKey(p);
    },
    columns: crmLeadCols,
    defaultCols: ['party', 'stage', 'phone', 'next'],
    cardMax: 3,
    fill: false,
    head: function () {
      return { title: tx('Leads'), notices: LEADS.state === 'ready' && !LEADS.ready ? [{ text: tx(CRM_LEADS_WAIT), cls: 'warn', tid: 'crm-leads-wait' }] : [] };
    },
    state: function () {
      return LEADS.state;
    },
    error: function () {
      return crmErrWords(LEADS.err, 'your leads');
    },
    onRetry: function () {
      crmLeadsLoad();
    },
    empty: {
      title: tx(LEADS.ready ? 'No leads yet' : CRM_LEADS_WAIT),
      sub: tx(LEADS.ready ? 'People you have not traded with yet. Use + Add lead.' : 'Nothing is lost.')
    },
    search: function (p) {
      return [p.display_name, p.party_no, p.phone, p.otp_contact].join(' ');
    },
    searchHint: tx('Name or phone'),
    filters: [
      {
        key: 'stage',
        label: tx('Stage'),
        all: tx('All stages'),
        options: ['lead', 'demo', 'trial', 'parked', 'lost'].map(function (item) {
          return { v: item, label: tx(CRM_STAGE[item]) };
        }),
        match: function (p, v) {
          return !!p.lead && p.lead.stage === v;
        }
      }
    ],
    sorts: [
      {
        key: 'name',
        label: tx('Name'),
        cmp: function (a, b) {
          return String(a.display_name).localeCompare(String(b.display_name), undefined, { sensitivity: 'base' });
        }
      },
      {
        key: 'next',
        label: tx('Next follow-up'),
        cmp: function (a, b) {
          return String(a.next_followup_at || '9999').localeCompare(String(b.next_followup_at || '9999'));
        }
      }
    ],
    onOpen: function (p) {
      crmGo('#/party/' + encodeURIComponent(crmKey(p)));
    }
  });
  if (frame) return;
  crmLeadsLoad(LEADS.loaded);
}

/* ═══ ADD LEAD — a name, a phone, a stage ═══════════════════════════════════════════════════════════════════════ */
function crmLeadAddOpen() {
  if (LEADS.loaded && !LEADS.ready) {
    toast(tx(CRM_LEADS_WAIT));
    return;
  }
  modal(
    '<div class="mhd"><div class="t">' +
      esc(tx('Add lead')) +
      '</div></div><div class="mbody" data-testid="crm-lead-sheet">' +
      '<label>' +
      esc(tx('Name')) +
      '<input class="inp" id="crm_lead_name" data-testid="crm-lead-name" autocomplete="off"></label>' +
      '<label>' +
      esc(tx('Phone')) +
      '<input class="inp" id="crm_lead_phone" data-testid="crm-lead-phone" type="tel" autocomplete="off"></label>' +
      '<label>' +
      esc(tx('Stage')) +
      '<select class="inp" id="crm_lead_stage" data-testid="crm-lead-stage">' +
      ['lead', 'demo', 'trial']
        .map(function (item) {
          return '<option value="' + item + '">' + esc(tx(CRM_STAGE[item])) + '</option>';
        })
        .join('') +
      '</select></label>' +
      '<div id="crm_lead_msg" class="hint" role="status" data-testid="crm-lead-msg"></div></div>' +
      '<div class="mfoot"><button type="button" onclick="closeModal()">' +
      esc(tx('Cancel')) +
      '</button><button type="button" class="pri" data-crm="leadsave" data-testid="crm-lead-save">' +
      esc(tx('Save')) +
      '</button></div>'
  );
  var node = document.getElementById('crm_lead_name');
  if (node) node.focus();
}
/** save the Add-lead sheet: needs a name, then POSTs through CBAction and refreshes the list */
function crmLeadSave(btn) {
  var node = function (id) {
      return String((document.getElementById(id) || {}).value || '').trim();
    },
    msg = document.getElementById('crm_lead_msg');
  if (!node('crm_lead_name')) {
    msg.textContent = tx('Give the lead a name.');
    return;
  }
  var body = { name: node('crm_lead_name'), stage: node('crm_lead_stage') || 'lead' };
  if (node('crm_lead_phone')) body.phone = node('crm_lead_phone');
  return CBAction.run(
    btn,
    async function () {
      return api('crmLeadAdd', { body: body });
    },
    {
      key: 'lead-add',
      busy: tx('Saving…'),
      onFail: function (words, e) {
        msg.textContent = crmLeadWords(e);
      },
      outcome: async function (r) {
        closeModal();
        toast(tx('Lead added'));
        await crmLeadsLoad(true);
        var id = r && r.party && r.party.party_id;
        if (id && CRM.byKey[id] && CRM.route && CRM.route.view === 'leads') crmLeadsRefresh();
      }
    }
  );
}

/* ═══ THE RECORD — "Move to…" (the server says which moves, and may/why) ════════════════════════════════════════ */
function crmStageBtn(p) {
  if (!crmEdit() || !p.lead || p.lead.stage === 'customer') return '';
  var may = p.lead.may || { ok: true },
    off = may.ok === false;
  return (
    '<button type="button" class="act quiet' +
    (off ? ' ghost' : '') +
    '" data-crm="rstage" data-testid="crm-act-stage"' +
    (off ? ' disabled title="' + esc(tx(CRM_LEADS_WAIT)) + '"' : '') +
    '>' +
    esc(tx('Move to…')) +
    (off ? '<span class="why wide-only">' + esc(tx(CRM_LEADS_WAIT)) + '</span>' : '') +
    '</button>'
  );
}
/** the "Move to…" sheet: one button per stage the server allows this lead to move to */
function crmStageOpen(p, rec) {
  var lead = (rec && rec.lead) || p.lead;
  if (!lead) return;
  modal(
    '<div class="mhd"><div class="t">' +
      esc(tx('Move to…')) +
      '</div></div><div class="mbody" data-testid="crm-stage-sheet">' +
      '<div class="supacts">' +
      (lead.moves || [])
        .map(function (item) {
          return (
            '<button type="button" class="act ghost" data-crm="stagego" data-v="' +
            esc(item) +
            '" data-testid="crm-stage-' +
            esc(item) +
            '">' +
            esc(tx(CRM_STAGE[item] || item)) +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      '<div id="crm_stage_msg" class="hint" role="status" data-testid="crm-stage-msg"></div></div>' +
      '<div class="mfoot"><button type="button" onclick="closeModal()">' +
      esc(tx('Cancel')) +
      '</button></div>'
  );
}
/** move the open party to a stage through CBAction, then repaint the record */
function crmStageGo(stage, btn) {
  var p = CRMR.p,
    msg = document.getElementById('crm_stage_msg');
  return CBAction.run(
    btn,
    async function () {
      return api('crmStage', { params: { id: p.party_id }, body: { stage: stage } });
    },
    {
      key: 'lead-stage:' + p.party_id,
      onFail: function (words, e) {
        if (msg) msg.textContent = crmLeadWords(e);
      },
      outcome: async function () {
        closeModal();
        toast(tx('Moved'));
        if (LEADS.loaded) await crmLeadsLoad(true);
        await crmLoad(true);
        if (CRM.route && CRM.route.view === 'party') crmRecordOpen(CRM.route);
      }
    }
  );
}
/** route a data-crm click (leadadd · leadsave · leadimport · rstage · stagego) to its handler; true when it was ours */
function crmLeadClick(a, node) {
  if (a === 'leadadd') {
    crmLeadAddOpen();
    return true;
  }
  if (a === 'leadsave') {
    crmLeadSave(node);
    return true;
  }
  if (a === 'leadimport') {
    crmImportOpen();
    return true;
  }
  if (a === 'rstage') {
    crmStageOpen(CRMR.p, CRMR.rec);
    return true;
  }
  if (a === 'stagego') {
    crmStageGo(node.getAttribute('data-v'), node);
    return true;
  }
  return false;
}

/* ═══ IMPORT (L3) — the call desk's first list, from a CSV: File → Columns → Check → Import; the outcome shown where it happened ═══════════
 * ⭐ REUSE: the steps are CBSteps (step-flow.js); the preview and the skipped list are CBList mounts (its own ⬇ Download CSV IS "the skipped rows
 *   as CSV"); the write goes through CBAction (M64). ⭐ ONE CALCULATION: the SERVER plans (POST /api/crm/leads/import { dry: true }) and the Check
 *   step PAINTS that plan — this page normalises no phone and dedupes nothing; the only arithmetic here is reading a CSV into cells.
 * ⭐ NEW PATHS (rule 4): crmCsvRows — the api's lib/csv.js is server-side and the bank engine's splitter is private to its vendored copy;
 *   LIMP_GUESS — the catalogue preflight's synonyms name catalogue fields; these name a lead's seven, and the person confirms every guess on Columns.
 * ⚠️ Before the api's b297 runs the Import button is greyed with CRM_LEADS_WAIT (like Add lead); the server still refuses (503 → the same sentence). */
var LIMP = { name: '', rows: [], head: [], map: {}, plan: null, planErr: null, flow: null, prev: null, gen: 0 };
var LIMP_FIELDS = [
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['business', 'Business'],
  ['city', 'City'],
  ['source', 'Source'],
  ['note', 'Note']
];
var LIMP_GUESS = {
  name: ['name', 'lead', 'contact', 'person', 'customer', 'full name', 'contact name', 'lead name', 'customer name'],
  phone: ['phone', 'mobile', 'cell', 'whatsapp', 'tel', 'telephone', 'number', 'phone number', 'mobile number', 'contact number'],
  email: ['email', 'e mail', 'mail', 'email id', 'email address'],
  business: ['business', 'company', 'shop', 'firm', 'organisation', 'organization', 'org', 'store', 'business name', 'company name'],
  city: ['city', 'town', 'place', 'location', 'area'],
  source: ['source', 'from', 'campaign', 'channel', 'origin', 'lead source'],
  note: ['note', 'notes', 'remark', 'remarks', 'comment', 'comments']
};
var LIMP_WILL = { add: 'Will add', merge: 'Will merge', skip: 'Will skip' };
var LIMP_CAP = 'Import up to 500 leads at a time. Split the file.';

/** a CSV's cells (RFC 4180: quotes, doubled quotes, commas and newlines inside quotes, CRLF, a BOM) → rows of strings; blank lines dropped */
function crmCsvRows(text) {
  var rows = [],
    row = [],
    cell = '',
    q = false,
    s = String(text || '').replace(/^﻿/, '');
  var end = function () {
    row.push(cell);
    if (
      row.some(function (x) {
        return String(x).trim();
      })
    )
      rows.push(row);
    row = [];
    cell = '';
  };
  for (var index = 0; index < s.length; index++) {
    var c = s.charAt(index);
    if (q) {
      if (c === '"') {
        if (s.charAt(index + 1) === '"') {
          cell += '"';
          index++;
        } else q = false;
      } else cell += c;
      continue;
    }
    if (c === '"') {
      q = true;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      end();
      continue;
    }
    cell += c;
  }
  end();
  return rows;
}
/** the header each field is most likely under — a guess the person confirms on Columns */
function crmImportGuess(head) {
  var map = {},
    used = {},
    norm = function (h) {
      return String(h || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    };
  LIMP_FIELDS.forEach(function (item) {
    var k = item[0],
      words = LIMP_GUESS[k];
    for (var index = 0; index < head.length && map[k] == null; index++) {
      if (used[index]) continue;
      var h = norm(head[index]);
      if (
        words.indexOf(h) >= 0 ||
        words.some(function (entry) {
          return entry.length > 3 && h.indexOf(entry) >= 0;
        })
      ) {
        map[k] = index;
        used[index] = true;
      }
    }
  });
  return map;
}
/** the rows as the api takes them: only the mapped columns, trimmed, empty cells left out */
function crmImportBody() {
  var m = LIMP.map;
  return LIMP.rows.map(function (item) {
    var o = {};
    LIMP_FIELDS.forEach(function (f) {
      var i = m[f[0]];
      if (i != null && item[i] != null && String(item[i]).trim()) o[f[0]] = String(item[i]).trim();
    });
    return o;
  });
}
/** what an import failure says, in the shop's words (the server's message is never shown) */
function crmImportWords(e) {
  var code = e && e.data && e.data.code;
  if (e && e.status === 503) return tx(CRM_LEADS_WAIT);
  if (code === 'TOO_MANY') return tx(LIMP_CAP);
  if (code === 'NO_ROWS') return tx('Nothing to import.');
  if (code === 'VIEW_ONLY' || (e && e.status === 403)) return tx('Your login can only view.');
  if (e && e.status === 409) return tx('Could not add them. Try once more.');
  return tx("Couldn't import. Try again.");
}
function crmImportCounts(p) {
  return crmPlural(p.added, 'lead to add', 'leads to add') + ' · ' + p.merged + ' ' + tx('to merge') + ' · ' + p.skipped.length + ' ' + tx('to skip');
}

/** the "Import" button: greyed with the server's sentence when view-only, disabled until the lead stages are migrated */
function crmLeadImportBtn() {
  if (!crmEdit())
    return crmViewOnlyBtn(
      'crm-lead-import',
      tx('Import'),
      crmViewWhy()
    ); /* shown, greyed, with the server's sentence — never hidden (the show-action rule, FX-L2C) */
  var off = LEADS.loaded && !LEADS.ready;
  return (
    '<button type="button" class="act sm' +
    (off ? ' ghost' : '') +
    '" data-testid="crm-lead-import" data-crm="leadimport"' +
    (off ? ' disabled title="' + esc(tx(CRM_LEADS_WAIT)) + '"' : '') +
    '>' +
    esc(tx('Import')) +
    '</button>'
  );
}
/** open the Import-from-CSV flow (file → columns → check, then Import) as a stepped sheet */
function crmImportOpen() {
  if (LEADS.loaded && !LEADS.ready) {
    toast(tx(CRM_LEADS_WAIT));
    return;
  }
  LIMP = { name: '', rows: [], head: [], map: {}, plan: null, planErr: null, flow: null, prev: null, gen: 0 };
  modal(
    '<div class="mhd"><div class="t">' +
      esc(tx('Import leads')) +
      '</div><div class="sub" id="crm_imp_sub"></div></div>' +
      '<div class="mbody" data-testid="crm-import-sheet"><div id="crm_imp_rail"></div><div id="crm_imp_body"></div></div>' +
      '<div class="mfoot" id="crm_imp_foot"></div>'
  );
  LIMP.flow = CBSteps.create({
    steps: [
      { k: 'file', n: tx('File'), t: tx('A .csv with a header row') },
      { k: 'map', n: tx('Columns'), t: tx('Which column is which') },
      { k: 'check', n: tx('Check'), t: tx('What will happen') }
    ],
    railEl: 'crm_imp_rail',
    bodyEl: 'crm_imp_body',
    footEl: 'crm_imp_foot',
    subEl: 'crm_imp_sub',
    render: crmImportStep,
    guard: crmImportGuard,
    nextLabel: function (k) {
      return k === 'map' ? tx('Check →') : null;
    },
    sendLabel: function () {
      return tx('Import');
    },
    cancelLabel: tx('Cancel'),
    onCancel: closeModal,
    onSend: crmImportSend,
    onStep: function (k) {
      if (k === 'check') crmImportPlan();
    },
    nextTestid: 'crm-import-next',
    sendTestid: 'crm-import-go',
    backTestid: 'crm-import-back'
  });
  LIMP.flow.paint();
}
/** the HTML of one import step: file, map or check */
function crmImportStep(k) {
  if (k === 'file') {
    var n = LIMP.rows.length;
    return (
      '<label>' +
      esc(tx('CSV file')) +
      '<input class="inp" type="file" accept=".csv,text/csv" data-testid="crm-import-file" onchange="crmImportPick(this)"></label>' +
      '<div class="hint" role="status" data-testid="crm-import-filemsg">' +
      (LIMP.name
        ? esc(LIMP.name) + ' · ' + esc(crmPlural(n, 'row', 'rows')) + (n > 500 ? ' · ' + esc(tx(LIMP_CAP)) : '')
        : esc(tx('Name and phone columns, one lead per row.'))) +
      '</div>'
    );
  }
  if (k === 'map') {
    return LIMP_FIELDS.map(function (item) {
      var key = item[0],
        cur = LIMP.map[key];
      return (
        '<label>' +
        esc(tx(item[1])) +
        (key === 'name' ? ' *' : '') +
        '<select class="inp" data-testid="crm-import-map-' +
        key +
        '" onchange="crmImportMap(\'' +
        key +
        '\', this.value)"><option value="">' +
        esc(tx('Not in the file')) +
        '</option>' +
        LIMP.head
          .map(function (entry, index) {
            return '<option value="' + index + '"' + (cur === index ? ' selected' : '') + '>' + esc(entry || tx('Column') + ' ' + (index + 1)) + '</option>';
          })
          .join('') +
        '</select></label>'
      );
    }).join('');
  }
  if (k === 'check') return '<div id="crm_imp_prev" data-testid="crm-import-preview"></div>';
  return '';
}
/** why a step cannot be left — a sentence, or null (the server's refusal rides here too, so Import is greyed WITH its reason) */
function crmImportGuard(k) {
  if (k === 'file') {
    if (!LIMP.rows.length) return tx('Pick a CSV file first.');
    if (LIMP.rows.length > 500) return tx(LIMP_CAP);
    return null;
  }
  if (k === 'map') return LIMP.map.name == null ? tx('Say which column holds the name.') : null;
  if (k === 'check') {
    if (LIMP.planErr) return LIMP.planErr;
    if (!LIMP.plan) return tx('Checking…');
    return LIMP.plan.added + LIMP.plan.merged ? null : tx('Every row would be skipped.');
  }
  return null;
}
/** read the chosen CSV file into LIMP (head, rows, a guessed column map) and repaint; an unreadable file says so in words */
async function crmImportPick(inp) {
  var file = inp.files && inp.files[0];
  if (!file) return;
  var text;
  try {
    text = await file.text();
  } catch (_) {
    LIMP.rows = [];
    LIMP.name = '';
    var node = document.querySelector('[data-testid="crm-import-filemsg"]');
    if (node) node.textContent = tx('That file could not be read.');
    return;
  }
  var all = crmCsvRows(text);
  LIMP.name = file.name;
  LIMP.head = all.length
    ? all[0].map(function (item) {
        return String(item || '').trim();
      })
    : [];
  LIMP.rows = all.slice(1);
  LIMP.map = crmImportGuess(LIMP.head);
  LIMP.plan = null;
  LIMP.planErr = null;
  if (LIMP.flow) {
    LIMP.flow.paintBody();
    LIMP.flow.paintFoot();
  }
}
function crmImportMap(k, v) {
  if (v === '') delete LIMP.map[k];
  else LIMP.map[k] = Number(v);
  LIMP.plan = null;
  LIMP.planErr = null;
  if (LIMP.flow) LIMP.flow.paintFoot();
}
/** the Check step: the server's plan (a dry run), painted — never a second answer */
async function crmImportPlan() {
  var g = ++LIMP.gen,
    el = document.getElementById('crm_imp_prev');
  if (!el) return;
  LIMP.plan = null;
  LIMP.planErr = null;
  LIMP.flow.paintFoot();
  el.innerHTML = '<div class="loadwrap" role="status"><span class="spin"></span>' + esc(tx('Checking…')) + '</div>';
  try {
    var reply = await api('crmLeadImport', { body: { rows: crmImportBody(), dry: true } });
    if (g !== LIMP.gen) return;
    LIMP.plan = reply;
  } catch (e) {
    if (g !== LIMP.gen) return;
    LIMP.planErr = crmImportWords(e);
    el.innerHTML = '<div class="hint" role="alert" data-testid="crm-import-planerr">' + esc(LIMP.planErr) + '</div>';
    LIMP.flow.paintFoot();
    return;
  }
  crmImportList(el, 'crm-import-preview', LIMP.plan.rows || [], true);
  LIMP.flow.paintFoot();
}
/** the preview (will add · will merge · will skip + why) and the skipped list after the import: ONE list unit, CBList — its ⬇ is the CSV download */
function crmImportList(el, key, rows, preview) {
  if (LIMP.prev && LIMP.prev.destroy) {
    try {
      LIMP.prev.destroy();
    } catch (_) {}
  }
  /* in the sheet the list is a narrow card: the name, the verdict and its reason stay; the row number and the phone are named in the chooser */
  var cols = [
    {
      key: 'name',
      label: 'Name',
      prio: 1,
      w: 180,
      cell: function (r) {
        return r.name || '—';
      },
      value: function (r) {
        return r.name || '';
      }
    }
  ];
  if (preview)
    cols.push({
      key: 'will',
      label: 'Will',
      prio: 1,
      w: 110,
      html: true,
      hfilter: 'will',
      cell: function (r) {
        return (
          '<span class="tag' +
          (r.outcome === 'add' ? ' on' : r.outcome === 'merge' ? ' local' : '') +
          '" data-will="' +
          esc(r.outcome) +
          '">' +
          esc(tx(LIMP_WILL[r.outcome] || r.outcome)) +
          '</span>'
        );
      },
      value: function (r) {
        return r.outcome;
      }
    });
  cols.push({
    key: 'why',
    label: 'Why',
    prio: 1,
    w: 200,
    cell: function (r) {
      return r.why || '';
    }
  });
  cols.push({
    key: 'row',
    label: 'Row',
    prio: 3,
    w: 64,
    sort: 'row',
    cell: function (r) {
      return String(r.row);
    },
    value: function (r) {
      return r.row;
    }
  });
  cols.push({
    key: 'phone',
    label: 'Phone',
    prio: 4,
    w: 140,
    cell: function (r) {
      return r.phone || '—';
    }
  });
  var p = LIMP.plan,
    tid = preview ? 'crm-imp-prev-' : 'crm-imp-skip-';
  LIMP.prev = CBList.mount(el, {
    key: key,
    t: tx,
    rows: function () {
      return rows;
    },
    id: function (r) {
      return r.row;
    },
    rowTid: function (r) {
      return tid + r.row;
    },
    columns: function () {
      return cols;
    },
    defaultCols: cols.map(function (item) {
      return item.key;
    }),
    cardMax: preview ? 4 : 3,
    fill: false,
    /* the counts are a plain chip (a notice is amber — advisory — and these are facts); the step's own line already says "What will happen" */
    head: function () {
      return { title: preview ? '' : tx('Skipped rows'), chips: preview && p ? [{ text: crmImportCounts(p), tid: 'crm-import-counts' }] : [] };
    },
    state: function () {
      return 'ready';
    },
    empty: { title: preview ? tx('Nothing to check') : tx('Nothing skipped'), sub: '' },
    search: function (r) {
      return [r.name, r.phone, r.why].join(' ');
    },
    searchHint: tx('Name or phone'),
    filters: preview
      ? [
          {
            key: 'will',
            label: tx('Will'),
            all: tx('All rows'),
            options: ['add', 'merge', 'skip'].map(function (item) {
              return { v: item, label: tx(LIMP_WILL[item]) };
            }),
            match: function (r, v) {
              return r.outcome === v;
            }
          }
        ]
      : [],
    sorts: [
      {
        key: 'row',
        label: tx('Row'),
        cmp: function (a, b) {
          return a.row - b.row;
        }
      }
    ]
  });
}
/** send the mapped rows to the server in one CBAction and show the outcome */
function crmImportSend() {
  var btn = document.querySelector('[data-testid="crm-import-go"]');
  return CBAction.run(
    btn,
    async function () {
      return api('crmLeadImport', { body: { rows: crmImportBody() } });
    },
    {
      key: 'lead-import',
      busy: tx('Importing…'),
      onFail: function (words, e) {
        LIMP.planErr = crmImportWords(e);
        if (LIMP.flow) LIMP.flow.paintFoot();
      },
      outcome: async function (r) {
        crmImportDone(r || { added: 0, merged: 0, skipped: [] });
        await crmLeadsLoad(true);
      }
    }
  );
}
/** the outcome, where the action happened: the three numbers large, the skipped rows as a list (downloadable), Done */
function crmImportDone(r) {
  var node = document.getElementById('crm_imp_sub');
  if (node) node.textContent = tx('Imported');
  var rail = document.getElementById('crm_imp_rail');
  if (rail) rail.innerHTML = '';
  var body = document.getElementById('crm_imp_body');
  if (!body) return;
  var skipped = r.skipped || [];
  var big = function (n, w, tid) {
    return '<div data-testid="' + tid + '"><strong style="font-size:var(--fs-4,24px)">' + Number(n) + '</strong> <span class="sub">' + esc(w) + '</span></div>';
  };
  body.innerHTML =
    '<div data-testid="crm-import-outcome" style="display:flex;gap:22px;flex-wrap:wrap;padding:6px 0">' +
    big(r.added, tx('added'), 'crm-import-added') +
    big(r.merged, tx('merged'), 'crm-import-merged') +
    big(skipped.length, tx('skipped'), 'crm-import-skipped') +
    '</div>' +
    '<div id="crm_imp_skipped"></div>';
  if (skipped.length) crmImportList(document.getElementById('crm_imp_skipped'), 'crm-import-skipped', skipped, false);
  var foot = document.getElementById('crm_imp_foot');
  if (foot) foot.innerHTML = '<button type="button" class="pri" data-testid="crm-import-done" onclick="closeModal()">' + esc(tx('Done')) + '</button>';
  toast(crmPlural(Number(r.added) + Number(r.merged), 'lead imported', 'leads imported'));
}
