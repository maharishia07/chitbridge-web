/* cap-crm-groups.js — CB CRM: GROUPS & SEGMENTS and the SHOP WINDOW (T3-P2-CRM, 2026-10-14; docs/design/crm/REQUIREMENT-segments.md).
 * The Groups screen (#/groups) is a CBList mount — the Task table's look — one row per SEGMENT (the api's one rule, lib/customer-groups
 * SEGMENT_SQL) and per named GROUP (customer_list.groups, b205): each with its members (the server's count), the offers that are only for it,
 * and who may be sent offers (the server's verdict per member, counted BY CODE — lib/privacy.mayAll). A row's ▸ is the mini-card: the
 * members (each opens the party record), the reach in words, the offers. The Shop window (#/showcase) picks a showcase template (the
 * policy flag `showcase_template`, the workshop's own chooser lifted into app/cap-showcase.js), previews the shop's OWN page, and shares
 * its link with a party or a group through the consented channel.
 * ⭐ REUSE: CBList (every list) · crmMiniBox/crmMiniRow/crmMiniKV (the mini-card) · modal()/closeModal() (the sheets) · CBAction (M64, every
 *   write) · CBConfirm (a delete asks first) · CRM.rows (the members: the Parties list already in memory, REQUIREMENT §9) · crmLog's own route
 *   for the share's out message (the server's gate) · CBShowcase + CBShowcasePick (the templates and the chooser) · policyGet/policySet.
 * ⭐ ONE CALCULATION: no segment, no count and no "may" is worked out here — GET /api/crm/segments answers them; a send asks the server
 *   twice (dry: who may; then the one sender). ⭐ The server's may/why on every action: New group · Send · Delete are SHOWN greyed with the
 *   sentence (`may.group/send/delete`), never hidden. "Make an offer" is greyed with its own sentence: Offer Lab cannot pick a group yet.
 * ⭐ NEW PATHS (rule 4): this module (no groups screen existed — the workshop has a per-customer chip row only); the three sheets (New group ·
 *   Send · Share) — each one field over the new routes; CRM_EP gained the four rows (cap-crm.js).
 * OWNS the Groups screen (#/groups: segment and group rows, mini-card, New group, Share with a group) and the page-wide click answer crmGroupsClick. Two PARTS (MNT-59, flat prefix, loaded right after this file): cap-crm-groups-send.js (the Send sheet) and cap-crm-groups-window.js (the Shop window, #/showcase).
 * CALLED BY crm.html only (<script src>, this file first, then its two parts; app.html names it in comments only); cap-crm.js routes into it (crmGroups on #/groups, GROUPS, crmGroupsClick); cap-marketing.js calls crmGroupsWhyNot, crmGroupsLoad and GROUPS
 * FLOW crm.html → cap-crm.js → this file paints Groups & segments → the server answers each write
 * CARD 11-crm-and-marketing/marketing-app
 * Needs cap-crm.js (CRM · crmNav · crmBar · crmGo · crmKey · crmEdit · crmOwner · crmIsLead · cells · modal · CBAction · tx/txf · esc · api). */
'use strict';
var GROUPS = {
  rows: [],
  state: 'loading',
  err: null,
  loaded: false,
  gen: 0,
  api: null,
  may: null,
  flags: {},
  channel: 'whatsapp',
  purpose: 'marketing',
  consent: true,
  migrated: true
};
var CRM_KIND_WORD = { segment: 'Segment', group: 'Group' };
/* the server's codes, in the shop's words (lib/privacy CODES — the screen branches on the code, never on the sentence) */
var CRM_CODE_WORD = {
  NO_CONSENT: 'no consent yet',
  SAID_NO: 'said no',
  CONSENT_WITHDRAWN: 'withdrew consent',
  OPTED_OUT: 'asked not to be messaged',
  CONSENT_UNREADABLE: 'consent could not be read'
};
var CRM_OFFER_WHY = 'Offer Lab cannot pick a group yet.';
/* ═══ THE READ — one answer: segments + groups, counts, offers, reach, may ═══════════════════════════════════════════ */
function crmGroupsRows(reply) {
  var segs = ((reply && reply.segments) || []).map(function (item) {
    return Object.assign({ kind: 'segment' }, item);
  });
  var groupRows = ((reply && reply.groups) || []).map(function (item) {
    return Object.assign({ kind: 'group' }, item);
  });
  return segs.concat(groupRows);
}
/** read the segments and named groups from the server (the latest call wins); quiet keeps the list on screen while it reloads */
async function crmGroupsLoad(quiet) {
  var generation = ++GROUPS.gen;
  if (!quiet || !GROUPS.loaded) {
    GROUPS.state = 'loading';
    crmGroupsRefresh();
  }
  try {
    var reply = await api('crmSegments');
    if (generation !== GROUPS.gen) return;
    GROUPS.rows = crmGroupsRows(reply);
    GROUPS.may = (reply && reply.may) || null;
    GROUPS.channel = (reply && reply.channel) || 'whatsapp';
    GROUPS.purpose = (reply && reply.purpose) || 'marketing';
    GROUPS.consent = !(reply && reply.consent_migrated === false);
    GROUPS.migrated = !(reply && reply.groups_migrated === false);
    GROUPS.state = 'ready';
    GROUPS.loaded = true;
    GROUPS.err = null;
  } catch (e) {
    if (generation !== GROUPS.gen) return;
    if (GROUPS.loaded) GROUPS.state = 'ready';
    else {
      GROUPS.state = 'error';
      GROUPS.err = e;
    }
  }
  if (CRM.route && CRM.route.view === 'groups') crmGroupsBar();
  crmGroupsRefresh();
}
function crmGroupsRefresh() {
  var listApi = GROUPS.api;
  if (listApi && listApi.el && document.body.contains(listApi.el)) listApi.refresh();
}
/** the server's may/why for an action; before the answer lands the login's level is the guess (the server refuses anyway) */
function crmGroupsMay(key) {
  var verdict = GROUPS.may && GROUPS.may[key];
  if (verdict) return verdict.may ? '' : verdict.why || tx('Not allowed');
  if (key === 'delete') return crmOwner() ? '' : tx('Only the owner deletes a group.');
  return crmEdit() ? '' : tx('Your login can only view.');
}
/** the members of a row, from the Parties list in memory (never a lead, never a walk-in — the same rule the server counts with) */
function crmGroupMembers(row) {
  return CRM.rows.filter(function (item) {
    if (item.kind === 'walk-in' || (item.roles || []).indexOf('customer') < 0 || crmIsLead(item)) return false;
    return row.kind === 'segment' ? item.segment === row.key : (item.groups || []).indexOf(row.name) >= 0;
  });
}
function crmReachWords(reach) {
  var figures = reach || { may: 0, not: 0, refused_by: [] };
  var refusals = (figures.refused_by || [])
    .map(function (x) {
      return x.n + ' ' + tx(CRM_CODE_WORD[x.code] || x.code.toLowerCase());
    })
    .join(' · ');
  return { may: txf('{n} may be sent offers', { n: figures.may }), not: figures.not ? txf('{n} not', { n: figures.not }) + (refusals ? ' — ' + refusals : '') : '' };
}
function crmGroupsParamsHref(row) {
  return row.kind === 'segment' ? '#/parties?seg=' + encodeURIComponent(row.key) : '#/parties?group=' + encodeURIComponent(row.name);
}
/* ═══ THE SCREEN — a CBList mount, grouped Segments · Groups ═══════════════════════════════════════════════════════ */
function crmGroupsCols() {
  return [
    {
      key: 'name',
      label: 'Segment or group',
      prio: 1,
      w: 260,
      sort: 'name',
      html: true,
      cell: function (group) {
        return '<b>' + esc(group.name) + '</b> <span class="tag' + (group.kind === 'segment' ? ' seg' : '') + '">' + esc(tx(CRM_KIND_WORD[group.kind])) + '</span>';
      },
      value: function (group) {
        return group.name;
      },
      tid: function (group) {
        return 'crm-grp-name-' + crmGroupTid(group);
      }
    },
    {
      key: 'count',
      label: 'Members',
      prio: 2,
      w: 110,
      num: true,
      sort: 'count',
      cell: function (group) {
        return String(group.count);
      },
      value: function (group) {
        return group.count;
      },
      tid: function (group) {
        return 'crm-grp-count-' + crmGroupTid(group);
      }
    },
    {
      key: 'reach',
      label: 'May be sent offers',
      prio: 3,
      w: 220,
      html: true,
      sort: 'reach',
      cell: function (group) {
        var words = crmReachWords(group.reach);
        return (
          '<span data-testid="crm-grp-reach-' +
          crmGroupTid(group) +
          '">' +
          esc(String((group.reach || {}).may || 0)) +
          '</span>' +
          (group.reach && group.reach.not ? ' <span class="sub">· ' + esc(words.not) + '</span>' : '')
        );
      },
      value: function (group) {
        return (group.reach || {}).may || 0;
      }
    },
    {
      key: 'offers',
      label: 'Offers only for them',
      prio: 4,
      w: 160,
      num: true,
      cell: function (group) {
        return String(group.offers || 0);
      },
      value: function (group) {
        return group.offers || 0;
      }
    },
    {
      key: 'rule',
      label: 'Rule',
      prio: 5,
      w: 280,
      cell: function (group) {
        return group.rule ? group.rule + (group.overrides ? ' · ' + txf('{n} set by you', { n: group.overrides }) : '') : tx('Named by you');
      }
    }
  ];
}
function crmGroupTid(group) {
  return String(group.key).replace(/[^A-Za-z0-9_-]/g, '_');
}
function crmGroupsBar() {
  var blocked = crmGroupsMay('group');
  var btn = blocked
    ? crmViewOnlyBtn('crm-grp-add', '+ ' + tx('New group'), blocked)
    : '<button data-cbsid="CRM008-B01" type="button" class="act sm" data-testid="crm-grp-add" data-crm="grpnew">+ ' + esc(tx('New group')) + '</button>';
  if (GROUPS.loaded && !GROUPS.migrated) btn = crmViewOnlyBtn('crm-grp-add', '+ ' + tx('New group'), tx('Groups are not switched on for your shop yet.'));
  crmBar('<strong>' + esc(crmAppName()) + '</strong>', btn, true);
}
function crmGroupsNotices() {
  var list = [];
  if (!GROUPS.migrated) list.push({ text: tx('Groups are not switched on for your shop yet. Segments still count.'), cls: 'warn', tid: 'crm-grp-nomig' });
  if (!GROUPS.consent)
    list.push({ text: tx('Consent records are not set up yet. Nobody can be sent offers until they are.'), cls: 'warn', tid: 'crm-grp-noconsent' });
  return list;
}
/** ▸ the mini-card: members · reach · offers — the same three-box shape as a party's */
function crmGroupMini(group) {
  var ms = crmGroupMembers(group),
    key = crmGroupTid(group),
    words = crmReachWords(group.reach);
  var names = ms
    .slice(0, 6)
    .map(function (item) {
      return crmMiniRow(
        'person',
        '<a href="#/party/' +
          esc(encodeURIComponent(crmKey(item))) +
          '" data-testid="crm-grp-member-' +
          esc(crmKey(item)) +
          '">' +
          esc(item.display_name) +
          '</a>'
      );
    })
    .join('');
  var more =
    ms.length > 6
      ? crmMiniRow(
          '',
          '<a href="' + crmGroupsParamsHref(group) + '" data-testid="crm-grp-seeall-' + key + '">' + esc(txf('See all {n} in Parties', { n: ms.length })) + '</a>'
        )
      : '';
  var members = ms.length
    ? names + more
    : '<div class="mc-r sub" style="white-space:normal">' +
      esc(group.kind === 'group' ? tx('Nobody is in this group yet. Use Members.') : tx('Nobody is in this segment right now.')) +
      '</div>';
  var reach = [
    crmMiniRow('msg', '<b data-testid="crm-grp-may-' + key + '">' + esc(words.may) + '</b>'),
    words.not ? '<div class="mc-r sub" style="white-space:normal;min-height:0" data-testid="crm-grp-not-' + key + '">' + esc(words.not) + '</div>' : '',
    crmMiniKV('Channel', esc(tx('WhatsApp')) + ' · ' + esc(tx('offers')))
  ];
  var offers = [
    crmMiniKV('Offers only for them', '<b>' + esc(String(group.offers || 0)) + '</b>'),
    '<div class="mc-r sub" style="white-space:normal;min-height:0">' +
      esc(tx('An offer "Only for" this set reaches its members in the app and at the counter.')) +
      '</div>'
  ];
  return (
    '<div class="mc" data-testid="crm-grp-mini-' +
    key +
    '">' +
    crmMiniBox('mc-what', 'Members', [members], 'crm-grp-mini-members-' + key) +
    crmMiniBox('mc-money', 'Reach', reach, 'crm-grp-mini-reach-' + key) +
    crmMiniBox('mc-last', 'Offers', offers, 'crm-grp-mini-offers-' + key) +
    '</div>'
  );
}
/** the sentence that greys a row action (send · members · delete) for this row, or "" when it is allowed */
function crmGroupsWhyNot(group, action) {
  if (action === 'send') {
    var words = crmGroupsMay('send');
    if (words) return words;
    return group.count ? '' : tx('Nobody to send to');
  }
  if (action === 'members') return GROUPS.migrated ? crmGroupsMay('group') : tx('Groups are not switched on for your shop yet.');
  if (action === 'delete') return crmGroupsMay('delete');
  if (action === 'offer') return tx(CRM_OFFER_WHY);
  return '';
}
/** the row actions of the Groups list (send, members, delete…), each with its test id and its why-not */
function crmGroupsActions() {
  return [
    {
      id: 'send',
      label: tx('Send offer message'),
      icon: '💬',
      tid: 'crm-grp-send',
      why: function (group) {
        return crmGroupsWhyNot(group, 'send');
      },
      run: function (group) {
        crmSendOpen(group);
      }
    },
    {
      id: 'offer',
      label: tx('Make an offer'),
      icon: '%',
      tid: 'crm-grp-offer',
      why: function (group) {
        return crmGroupsWhyNot(group, 'offer');
      },
      run: function () {
        toast(tx(CRM_OFFER_WHY));
      }
    },
    {
      id: 'members',
      label: tx('Members'),
      icon: '☑',
      tid: 'crm-grp-members',
      when: function (group) {
        return group.kind === 'group';
      },
      why: function (group) {
        return crmGroupsWhyNot(group, 'members');
      },
      run: function (group) {
        crmGroupOpen(group.name);
      }
    },
    {
      id: 'delete',
      label: tx('Delete group'),
      icon: '✕',
      tid: 'crm-grp-delete',
      when: function (group) {
        return group.kind === 'group';
      },
      why: function (group) {
        return crmGroupsWhyNot(group, 'delete');
      },
      run: function (group) {
        crmGroupDelete(group);
      }
    },
    {
      id: 'seeall',
      label: tx('Open in Parties'),
      icon: '↗',
      tid: 'crm-grp-open',
      run: function (group) {
        crmGo(crmGroupsParamsHref(group));
      }
    }
  ];
}
/** the groups list's orders */
function crmGroupSorts() {
  return [
    {
      key: 'name',
      label: tx('Name'),
      cmp: function (left, right) {
        return String(left.name).localeCompare(String(right.name), undefined, { sensitivity: 'base' });
      }
    },
    {
      key: 'count',
      label: tx('Members'),
      cmp: function (left, right) {
        return (right.count || 0) - (left.count || 0);
      }
    },
    {
      key: 'reach',
      label: tx('May be sent offers'),
      cmp: function (left, right) {
        return ((right.reach || {}).may || 0) - ((left.reach || {}).may || 0);
      }
    }
  ];
}
/** paint the Groups screen: the bar, then a CBList mount with one row per segment or named group */
function crmGroups(frame) {
  crmGroupsBar();
  var node = document.getElementById('screen');
  node.className = 'screen flush';
  node.innerHTML = '<div id="crm_groups" data-testid="crm-groups"></div>';
  if (GROUPS.api && GROUPS.api.destroy) {
    try {
      GROUPS.api.destroy();
    } catch (failure) {
      // the old list is replaced right below, so a failed tear-down only leaves stale listeners; say so and carry on
      if (typeof cblog === 'function') cblog('warn', 'crm groups: the old list could not be torn down — ' + ((failure && failure.message) || 'no answer'));
    }
  }
  GROUPS.api = CBList.mount(document.getElementById('crm_groups'), {
    key: 'crm-groups',
    t: tx,
    rows: function () {
      return GROUPS.rows;
    },
    id: function (group) {
      return group.key;
    },
    rowTid: function (group) {
      return 'crm-grp-' + crmGroupTid(group);
    },
    columns: crmGroupsCols,
    defaultCols: ['name', 'count', 'reach'],
    cardMax: 3,
    fill: false,
    head: function () {
      return { title: tx('Groups & segments'), notices: GROUPS.state === 'ready' ? crmGroupsNotices() : [] };
    },
    state: function () {
      return GROUPS.state;
    },
    error: function () {
      return crmErrWords(GROUPS.err, 'your groups');
    },
    onRetry: function () {
      crmGroupsLoad();
    },
    empty: { title: tx('No groups yet'), sub: tx('Name one to offer or message a set of customers together. Use + New group.') },
    search: function (group) {
      return [group.name, group.rule].join(' ');
    },
    searchHint: tx('Segment or group'),
    sorts: crmGroupSorts(),
    group: {
      options: [
        ['kind', 'Kind'],
        ['none', 'None']
      ],
      default: 'kind',
      tid: 'crm-groups',
      as: 'select',
      fig: function (rows) {
        return crmPlural(rows.length, 'row', 'rows');
      },
      by: function (group, mode) {
        return mode === 'kind' ? [tx(group.kind === 'segment' ? 'Segments' : 'Groups'), group.kind] : null;
      }
    },
    next: function (group) {
      return crmGroupMini(group);
    },
    actions: crmGroupsActions()
  });
  if (frame) return;
  if (!CRM.loaded) crmLoad(true); /* the members come from the Parties list in memory */
  crmGroupsLoad(GROUPS.loaded);
}
/* ═══ NEW GROUP · MEMBERS — one sheet: a name, then who is in it (the customers of the Parties list, ticked) ═══════ */
var GSHEET = { name: '', fixed: false, orig: {}, on: {}, q: '' };
/** open the New group / Edit members sheet; an existing name starts with its current members ticked */
function crmGroupOpen(name) {
  GSHEET = { name: name || '', fixed: !!name, orig: {}, on: {}, q: '' };
  if (name)
    CRM.rows.forEach(function (item) {
      if ((item.groups || []).indexOf(name) >= 0) {
        GSHEET.orig[item.party_id] = 1;
        GSHEET.on[item.party_id] = 1;
      }
    });
  ui.dialog({
    mount: 'CRM008-U201',
    pop: 'POP098',
    titleText: name ? txf('Members of {name}', { name: name }) : tx('New group'),
    testid: 'crm-grp-sheet',
    body:
      '<label>' +
      esc(tx('Name')) +
      '<input data-cbsid="CRM008-I01" class="inp" id="crm_grp_name" data-testid="crm-grp-name" maxlength="40" autocomplete="off" value="' +
      esc(name || '') +
      '"' +
      (name ? ' readonly' : '') +
      '></label>' +
      '<label>' +
      esc(tx('Find a customer')) +
      '<input data-cbsid="CRM008-I02" class="inp" id="crm_grp_q" data-testid="crm-grp-q" placeholder="' +
      esc(tx('Name, ID, phone')) +
      '" autocomplete="off" oninput="crmGroupPick(this.value)"></label>' +
      '<div id="crm_grp_list" class="grp-list" data-testid="crm-grp-list"></div>' +
      '<div id="crm_grp_msg" class="hint" role="status" data-testid="crm-grp-msg"></div>',
    footerHtml:
      '<span class="sub" id="crm_grp_n" data-testid="crm-grp-n" style="margin-right:auto;align-self:center"></span>' +
      ui.footerAction({ name: 'cancel', options: { mount: 'CRM008-U201' } }) +
      ui.footerAction({ name: 'save', options: { mount: 'CRM008-U201', key: 'save', effect: 'preference', testid: 'crm-grp-save', data: { crm: 'grpsave' } } })
  });
  crmGroupPick('');
  var node = document.getElementById(name ? 'crm_grp_q' : 'crm_grp_name');
  if (node) node.focus();
}
function crmGroupCands() {
  return CRM.rows.filter(function (item) {
    return item.kind !== 'walk-in' && (item.roles || []).indexOf('customer') >= 0 && !crmIsLead(item);
  });
}
/** filter the member picker of the group sheet by the typed text and repaint the list */
function crmGroupPick(query) {
  GSHEET.q = String(query || '')
    .trim()
    .toLowerCase();
  var box = document.getElementById('crm_grp_list');
  if (!box) return;
  var all = crmGroupCands(),
    matches = all.filter(function (item) {
      return !GSHEET.q || [item.display_name, item.nickname, item.party_no, item.phone, item.user_id].join(' ').toLowerCase().indexOf(GSHEET.q) >= 0;
    });
  var ticked = all.filter(function (item) {
    return GSHEET.on[item.party_id];
  });
  box.innerHTML = matches.length
    ? matches
        .slice(0, 60)
        .map(function (item) {
          return (
            '<label class="grp-row" data-testid="crm-grp-cand-' +
            esc(crmKey(item)) +
            '"><input data-cbsid="CRM008-I03" type="checkbox" data-crm="grptick" data-k="' +
            esc(item.party_id) +
            '"' +
            (GSHEET.on[item.party_id] ? ' checked' : '') +
            '><span class="nm">' +
            esc(item.display_name) +
            '</span><span class="sub">' +
            esc(item.party_no || item.phone || '') +
            '</span></label>'
          );
        })
        .join('') + (matches.length > 60 ? '<div class="hint">' + esc(txf('{n} more — type to narrow', { n: matches.length - 60 })) + '</div>' : '')
    : '<div class="hint">' + esc(all.length ? tx('Nobody matches.') : tx('No customers yet. They appear when you bill them.')) + '</div>';
  var node = document.getElementById('crm_grp_n');
  if (node) node.textContent = crmPlural(ticked.length, 'member', 'members');
}
function crmGroupTick(key, on) {
  if (on) GSHEET.on[key] = 1;
  else delete GSHEET.on[key];
  var node = document.getElementById('crm_grp_n');
  if (node) node.textContent = crmPlural(Object.keys(GSHEET.on).length, 'member', 'members');
}
function crmGroupWords(e) {
  var code = e && e.data && e.data.code;
  if (e && e.status === 403) return (e.data && (e.data.why || e.data.message)) || tx('Your login can only view.');
  if (code === 'GROUPS_NOT_MIGRATED') return tx('Groups are not switched on for your shop yet.');
  if (code === 'BAD_NAME') return tx('Name the group: up to 40 letters, digits, spaces, - & /.');
  if (code === 'TOO_MANY_GROUPS') return tx('A customer can be in at most 20 groups.');
  if (code === 'TOO_MANY') return tx('At most 500 at a time.');
  if (code === 'NOTHING_TO_DO') return tx('Tick at least one customer.');
  return tx("Couldn't save the group. Try again.");
}
/** save the group sheet (a name is required) through CBAction, then reload the groups */
function crmGroupSave(btn) {
  var name = String((document.getElementById('crm_grp_name') || {}).value || '')
      .replace(/\s+/g, ' ')
      .trim(),
    msg = document.getElementById('crm_grp_msg');
  if (!name) {
    msg.textContent = tx('Name the group.');
    return;
  }
  var toAdd = Object.keys(GSHEET.on).filter(function (item) {
      return !GSHEET.orig[item];
    }),
    remove = Object.keys(GSHEET.orig).filter(function (item) {
      return !GSHEET.on[item];
    });
  if (!toAdd.length && !remove.length) {
    msg.textContent = tx('Tick at least one customer.');
    return;
  }
  return CBAction.run(
    btn,
    async function () {
      return api('crmGroupSet', { body: { name: name, add: toAdd, remove: remove } });
    },
    {
      key: 'group-save',
      busy: tx('Saving…'),
      onFail: function (words, e) {
        msg.textContent = crmGroupWords(e);
      },
      outcome: async function (reply) {
        closeModal();
        toast(txf('{name}: {n}', { name: (reply && reply.name) || name, n: crmPlural((reply && reply.count) || 0, 'member', 'members') }));
        await crmLoad(true);
        crmGroupsLoad(true);
      }
    }
  );
}
/** a delete asks first — with the offers that name it (the server's count): they would reach no one */
function crmGroupDelete(group) {
  var body = group.offers
    ? txf('{n} only for this group. They will reach no one.', { n: crmPlural(group.offers, 'offer is', 'offers are') })
    : tx('Its members stay your customers; only the name goes.');
  CBAction.run(
    null,
    async function () {
      return api('crmGroupDel', { params: { name: group.name } });
    },
    {
      key: 'group-del',
      confirm: { title: txf('Delete group {name}?', { name: group.name }), body: esc(body), yes: group.offers ? tx('Delete anyway') : tx('Delete') },
      onFail: function (words, e) {
        toast(crmGroupWords(e));
      },
      outcome: async function () {
        toast(txf('{name} deleted', { name: group.name }));
        await crmLoad(true);
        crmGroupsLoad(true);
      }
    }
  );
}
/* ═══ the clicks this module answers (cap-crm.js's one listener asks) ═══════════════════════════════════════════════ */
function crmGroupsClick(action, node) {
  if (action === 'grpnew') {
    crmGroupOpen(null);
    return true;
  }
  if (action === 'grptick') {
    crmGroupTick(node.getAttribute('data-k'), node.checked);
    return true;
  }
  if (action === 'grpsave') {
    crmGroupSave(node);
    return true;
  }
  if (action === 'sendcheck') {
    crmSendCheck(node);
    return true;
  }
  if (action === 'sendgo') {
    crmSendGo(node);
    return true;
  }
  if (action === 'sccopy') {
    var shopUrl = crmShopUrl();
    (navigator.clipboard ? navigator.clipboard.writeText(shopUrl) : Promise.reject(new Error('no clipboard'))).then(
      function () {
        toast(tx('Link copied'));
      },
      function () {
        toast(shopUrl);
      }
    );
    return true;
  }
  if (action === 'scgroup') {
    crmShareGroup();
    return true;
  }
  if (action === 'scgrouppick') {
    var group = GROUPS.rows.filter(function (x) {
      return x.key === node.getAttribute('data-k');
    })[0];
    closeModal();
    if (group) crmSendOpen(group, { text: txf('Have a look at our shop window: {url}', { url: crmShopUrl() }) });
    return true;
  }
  if (action === 'scparty') {
    crmShareParty(node.getAttribute('data-k'));
    return true;
  }
  if (action === 'scshare') {
    crmShareGo(node);
    return true;
  }
  return false;
}
