/* app/cap-folders-rules.js — the Rules tab of the FOLDERS capability. PART OF cap-folders.js: plain globals, no module, no call site changed.
 * OWNS      the Rules tab: the rule list, ↑ ↓ reorder (ruleMove), the draft form, preview, save, toggle, delete, and the track-level all-rules read.
 * READS     from cap-folders.js: _FLD, _fldPaint, _fldTrack (at click time only; nothing here runs at load).
 * FLOW      loadFolderRules → _folderRulesPane → ruleDraftNew / ruleDraftSet → rulePreview → ruleSave · ruleMove · ruleToggle · ruleDelete
 * CARD      01-rail-core-the-chit/user-folders-and-auto-file-rules
 * CALLED BY public/accounts.html, public/crm.html, public/finance.html (a <script> tag each) · public/app.html (ensureCap('folders') loads it with this part through CAP_WITH)
 */
/* Every rule on a track, assembled from the per-folder endpoint. Used only when the single-call route is absent.
   ⚠️ `migrated` is ANDed, not taken from the last response: if any folder reports the rules table missing, the
   pane must say so rather than show a confidently short list. */
async function _allRulesPerFolder(track) {
  var mine = (UI.folders || []).filter(function (item) {
    return (item.scope || 'task') === track;
  });
  var out = [],
    migrated = true;
  for (var index = 0; index < mine.length; index++) {
    try {
      var reply = await api('folderRules', { params: { id: mine[index].folder_id } });
      if (reply && reply.migrated === false) migrated = false;
      ((reply && reply.rules) || []).forEach(function (x) {
        out.push(x);
      });
    } catch (e) {
      /* one unreadable folder must not blank the whole pane */
    }
  }
  out.sort(function (first, second) {
    return first.sort - second.sort || String(first.created_at).localeCompare(String(second.created_at));
  });
  return { rules: out, migrated: migrated };
}
/**
 * ⭐ EVERY RULE THE ENTITY HAS, ACROSS BOTH TRACKS — the list a reorder must be computed against.
 * ⚠️ NOT the same as _allRulesPerFolder(track), and the difference is the whole correctness argument: `sort` is
 * ENTITY-WIDE (one ORDER BY over every rule), while any view — a folder, a track — shows only a slice. Renumber
 * a slice 0..n-1 and you collide with the rules outside it, silently reshuffling folders the user was not even
 * looking at. So the move is decided in the visible list and APPLIED to the full one.
 */
async function _allRulesForSort() {
  var fs = UI.folders || [],
    out = [];
  for (var index = 0; index < fs.length; index++) {
    try {
      var reply = await api('folderRules', { params: { id: fs[index].folder_id } });
      ((reply && reply.rules) || []).forEach(function (x) {
        out.push(x);
      });
    } catch (e) {
      /* one unreadable folder must not scramble the rest — it simply keeps its place */
    }
  }
  out.sort(function (first, second) {
    return first.sort - second.sort || String(first.created_at).localeCompare(String(second.created_at));
  });
  return out;
}
/**
 * Move a rule one place earlier (dir -1) or later (dir +1) in the running order.
 * ⚠️ "One place" means one place IN THE LIST THE USER IS LOOKING AT. Inside a folder, moving up means beating the
 * rule above it in that folder — not landing between two rules of some other folder they cannot see. So the
 * neighbour is chosen from the visible list, then the moved rule is placed relative to that neighbour in the
 * full list. ⚠️ Only rows whose `sort` actually changes are written: the first move on legacy data renumbers
 * everything once (every row ships as 0), and after that a swap touches two.
 */
async function ruleMove(id, dir) {
  var vis = _FLD.rules || [];
  var count = -1;
  for (var index = 0; index < vis.length; index++) if (vis[index].rule_id === id) count = index;
  var ti = count + dir;
  if (count < 0 || ti < 0 || ti >= vis.length) return; // at the end — the button is disabled anyway
  var neighbour = vis[ti].rule_id;

  _FLD.busy = true;
  _FLD.err = '';
  _fldPaint();
  try {
    var all = await _allRulesForSort();
    var from = -1;
    for (var a = 0; a < all.length; a++) if (all[a].rule_id === id) from = a;
    if (from < 0) throw new Error('Could not find that rule to move it.');
    var moved = all.splice(from, 1)[0];
    /* ⚠️ Find the neighbour AFTER the removal. Splicing shifts every index past `from`, so a target computed
       before it lands one place off in exactly half the cases — the classic move-item-in-array bug. */
    var ni = -1;
    for (var b = 0; b < all.length; b++) if (all[b].rule_id === neighbour) ni = b;
    if (ni < 0) throw new Error('Could not place the rule.');
    all.splice(dir < 0 ? ni : ni + 1, 0, moved);

    var writes = [];
    all.forEach(function (item, position) {
      if (item.sort !== position) writes.push(api('folderRuleUpdate', { params: { rule_id: item.rule_id }, body: { sort: position } }));
    });
    await Promise.all(writes);
    _FLD.rules = null;
    await loadFolderRules();
  } catch (e) {
    _FLD.err = (e && e.message) || 'Could not change the order.';
    _FLD.busy = false;
    _fldPaint();
  }
}
/** the Rules tab: fetch this folder's rules (or every folder's) into _FLD.rules */
async function loadFolderRules() {
  _FLD.busy = true;
  _fldPaint();
  var track = _fldTrack();
  try {
    var r;
    if (track) {
      /* ⚠️ FALLS BACK TO PER-FOLDER READS. GET /api/folders/rules is new, and an API that has not been redeployed
         answers 404 — which would show as "could not read the rules" for a pane whose data is, in fact, entirely
         reachable through an endpoint that has shipped for months. One call when it exists, N when it does not.
         N is the number of folders on this track, fetched only when the pane is opened. */
      try {
        r = await api('folderAllRules');
      } catch (e) {
        r = await _allRulesPerFolder(track);
      }
    } else {
      r = await api('folderRules', { params: { id: UI.folderSel } });
    }
    _FLD.rules = (r && r.rules) || [];
    /* A rule surface that cannot store anything must SAY so rather than accept a rule it will lose. */
    _FLD.rulesNote =
      r && r.migrated === false ? 'Folder rules are not switched on for your shop yet. You can still try a rule; nothing will save.' : null;
  } catch (e) {
    _FLD.err = (e && e.message) || 'Could not read the rules.';
    _FLD.rules = [];
  }
  _FLD.busy = false;
  _fldPaint();
}
/**
 * ⚠️ DELEGATES NOW — this WAS the gold standard and the select bar had never been told about it. The rule
 * (side by side, never summed) and the rendering both live in `cbMoneyList` in helpers.js, which is loaded
 * eagerly and so is reachable from app.html too. Two renderings of one rule is how they drift.
 *
 * ⚠️ THE SERVER ALREADY GROUPS BY CURRENCY here, so the shape only needs renaming — `{currency, total}` is
 * exactly what cbSumByCurrency produces, which is why one renderer can serve both.
 */
/**
 * ⭐ ONE MOVE BUTTON — reordering folder rules (↑ ↓). It was shared with the column chooser's ← → until the chooser moved INTO CBList
 * (list-ctl.js owns its own); this is its only caller again. The judgment baked into it:
 *   ⚠️ DISABLED AT THE ENDS, NEVER HIDDEN. A control that vanishes at the boundary makes the row reflow under the cursor you were
 *   about to click again — so the first press moves the item and the second lands on whatever slid into its place.
 *   ⚠️ THE GLYPH MUST MATCH THE AXIS. Rules are a vertical list and take ↑ ↓ ("Run earlier").
 * `js` is the click handler body, so the caller keeps its own action and its own stopPropagation decision.
 */
function mvBtn(glyph, ok, title, js) {
  return '<button data-cbsid="SCR004-B01" type="button" class="mv-btn" ' + (ok ? '' : 'disabled') + ' title="' + esc(title) + '"' + ' onclick="' + js + '">' + glyph + '</button>';
}
/* ── rules ────────────────────────────────────────────────────────────────────────────────────────────────────── */
var _RULE_HELP = {
  from: 'counterparty name contains',
  subject: 'subject contains',
  text: 'anywhere: subject, party, or the message',
  purpose: 'order · invoice · receipt · inquiry · delivery_note · general',
  direction: 'sent · received',
  status: 'current status',
  channel: 'whatsapp · email · sms · web',
  min_amount: 'value at least',
  max_amount: 'value at most',
  has_dispute: 'true / false',
  unread: 'true / false',
  older_than_days: 'older than N days'
};
function ruleDraftNew() {
  _FLD.draft = { name: '', term: 'from', val: '', enabled: true };
  _FLD.preview = null;
  _fldPaint();
}
function ruleDraftCancel() {
  _FLD.draft = null;
  _FLD.preview = null;
  _fldPaint();
}
function ruleDraftSet(k, v) {
  _FLD.draft = _FLD.draft || {};
  _FLD.draft[k] = v;
  if (k !== 'name') _FLD.preview = null;
}
/** turn the rule draft (term + value) into the rule's when-object; null until a value is filled in */
function _draftWhen() {
  var d = _FLD.draft || {};
  var w = {};
  if (!d.term || !String(d.val).trim()) return null;
  var t = d.term,
    v = String(d.val).trim();
  if (t === 'min_amount' || t === 'max_amount' || t === 'older_than_days') w[t] = Number(v);
  else if (t === 'has_dispute' || t === 'unread') w[t] = v === 'true' || v === '1' || v === 'yes';
  else w[t] = v;
  return w;
}
/**
 * ⚠️ PREVIEW BEFORE SAVE, AND IT IS THE POINT OF THIS SCREEN. A rule is a promise about the future written by
 * someone who cannot see it. Running it against chits that already exist turns "I think this catches Ramesh's
 * invoices" into a list you can read before committing to it.
 */
async function rulePreview() {
  var w = _draftWhen();
  if (!w) {
    _FLD.err = 'Fill in the value first.';
    _fldPaint();
    return;
  }
  _FLD.busy = true;
  _FLD.err = null;
  _fldPaint();
  try {
    _FLD.preview = await api('folderRulePreview', { body: { when: w } });
  } catch (e) {
    _FLD.err = (e && e.message) || 'Could not preview.';
  }
  _FLD.busy = false;
  _fldPaint();
}
/** save the drafted rule on this folder; says 'Fill in the value first' when it is empty */
async function ruleSave() {
  var w = _draftWhen();
  if (!w) {
    _FLD.err = 'Fill in the value first.';
    _fldPaint();
    return;
  }
  _FLD.busy = true;
  _FLD.err = null;
  _fldPaint();
  try {
    await api('folderRuleCreate', { params: { id: UI.folderSel }, body: { name: (_FLD.draft || {}).name || '', when: w } });
    _FLD.draft = null;
    _FLD.preview = null;
    _FLD.rules = null;
    await loadFolderRules();
    if (typeof toast === 'function') toast('Rule saved — it files new arrivals from now on');
  } catch (e) {
    _FLD.err = (e && e.message) || 'Could not save the rule.';
    _FLD.busy = false;
    _fldPaint();
  }
}
async function ruleToggle(id, on) {
  try {
    await api('folderRuleUpdate', { params: { rule_id: id }, body: { enabled: !!on } });
    _FLD.rules = null;
    await loadFolderRules();
  } catch (e) {
    _FLD.err = (e && e.message) || 'Could not change that.';
    _fldPaint();
  }
}
/** confirm, then delete a rule; chits it already filed stay where they are */
function ruleDelete(id) {
  confirmAsk(
    'Delete this rule?',
    'Chits already filed <b>stay where they are</b> — a rule only decides what happens next.',
    'Delete',
    function () {
      _ruleDelete(id);
    },
    true
  );
}
async function _ruleDelete(id) {
  try {
    await api('folderRuleDelete', { params: { rule_id: id } });
    _FLD.rules = null;
    await loadFolderRules();
  } catch (e) {
    _FLD.err = (e && e.message) || 'Could not delete it.';
    _fldPaint();
  }
}
function _fldFolderName(id) {
  var f = (UI.folders || []).find(function (x) {
    return x.folder_id === id;
  });
  return (f && f.name) || 'a folder';
}
/* ⚠️ THE ORDINAL IS NOT DECORATION. The pane promises "they run in order, and the first match wins" — a promise
   that is TRUE (the server reads ORDER BY sort, created_at and match.firstMatch stops at the first hit) but was
   invisible: a stack of identical cards gives the reader no way to tell WHICH rule wins when two overlap, which
   is the single question this list exists to answer. Numbering them makes the running order readable.
   The order is EDITABLE (DB-42): the ↑ ↓ buttons below call ruleMove(), which writes `sort` through folderRuleUpdate
   (PATCH /folders/rules/:rule_id accepts it). Showing the number as well means the reader can say which rule wins. */
function _ruleRow(r, i, n) {
  var terms = Object.keys(r.when || {})
    .map(function (item) {
      return '<span style="font-family:ui-monospace,Menlo,monospace;font-size:var(--fs-1)">' + esc(item) + '</span> <b>' + esc(String(r.when[item])) + '</b>';
    })
    .join(' <span style="color:var(--grey)">and</span> ');
  return (
    '<div style="border:1px solid var(--line);border-radius:9px;padding:11px 13px;margin-bottom:8px;background:var(--card);color:var(--on-card)">' +
    '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' +
    '<span title="Runs ' +
    (i === 0 ? 'first' : 'after the ' + i + ' above') +
    '" style="flex:0 0 auto;min-width:20px;height:20px;border-radius:5px;background:var(--paper);border:1px solid var(--line);color:var(--grey);font-size:var(--fs-1);font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums">' +
    (i + 1) +
    '</span>' +
    /* ⚠️ ↑ ↓, NOT ← →: this is a vertical list, and the glyph has to match the axis the thing actually moves on.
       Disabled at the ends rather than hidden — see mvBtn(). Only shown when there is somewhere to move TO: a
       single rule cannot be reordered, and two dead buttons beside it just invite a click that does nothing. */
    (n > 1
      ? '<span style="display:inline-flex;gap:3px;flex:0 0 auto">' +
        mvBtn('↑', i > 0, 'Run earlier — this rule will beat the one above it', "ruleMove('" + esc(r.rule_id) + "',-1)") +
        mvBtn('↓', i < n - 1, 'Run later — the rule below will beat this one', "ruleMove('" + esc(r.rule_id) + "',1)") +
        '</span>'
      : '') +
    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input data-cbsid="SCR004-I01" type="checkbox" data-testid="rule-enabled" ' +
    (r.enabled ? 'checked' : '') +
    ' onchange="ruleToggle(\'' +
    esc(r.rule_id) +
    '\',this.checked)"><span style="font-weight:700;font-size:var(--fs-2)">' +
    esc(r.name || 'Rule') +
    '</span></label>' +
    '<span data-cbsid="CMP011" style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--disp);cursor:pointer" onclick="ruleDelete(\'' +
    esc(r.rule_id) +
    '\')">' +
    tx('Delete') +
    '</span></div>' +
    /* ⚠️ AT TRACK LEVEL A RULE MUST NAME ITS DESTINATION. "file here" is only meaningful standing inside the
       folder; in the all-rules list it would read as if every rule filed into the same place, which is the exact
       confusion this list exists to remove. */
    '<div style="font-size:var(--fs-2);margin-top:6px">When ' +
    terms +
    ' <span class=arw>→</span> ' +
    (_fldTrack() ? 'file into <b>📁 ' + esc(_fldFolderName(r.folder_id)) + '</b>' : 'file here') +
    '</div>' +
    /* Observability: a rule that quietly stopped matching should be visible, not assumed to be working. */
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">' +
    (r.match_count
      ? txn('filed {count} chit', 'filed {count} chits', r.match_count) +
        (r.last_matched_at ? ' · ' + txf('last {date}', { date: esc(String(r.last_matched_at).slice(0, 10)) }) : '')
      : 'has not matched anything yet') +
    '</div></div>'
  );
}
/** the Rules tab body: the folder's rules, each with on/off and delete, and the draft form for a new one */
function _folderRulesPane() {
  if (_FLD.busy && _FLD.rules === null)
    return '<div style="padding:18px;color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> reading rules…</div>';
  var rules = _FLD.rules || [];
  var d = _FLD.draft;
  var out = '<div style="padding:14px 18px">';

  var _trk = _fldTrack();
  out +=
    '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55;margin-bottom:10px">' +
    (_trk
      ? 'Every rule on <b>' +
        (_trk === 'order' ? 'Order' : 'Task') +
        '</b>, in the order they run. ' +
        '⚠️ Rules only conflict with <b>each other</b> — two folders both claiming supplier invoices is invisible from inside either one, which is why they are listed together here.'
      : 'A rule files <b>new arrivals</b> into this folder automatically. ') +
    ' ⚠️ It only <b>files</b> — it never changes a chit’s status, value or counterparty. Filing is a view on your own copy; anything more belongs to a person.' +
    (rules.length > 1
      ? ' They run <b>in the numbered order</b> and the first one that matches wins — the rest never see that chit. Use ↑ ↓ to change which rule gets first refusal.'
      : '') +
    '</div>';

  if (_FLD.rulesNote)
    out +=
      '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:var(--fs-1);color:var(--warn-3);margin-bottom:9px">' +
      esc(_FLD.rulesNote) +
      '</div>';
  if (_FLD.err) out += '<div style="color:var(--disp);font-size:var(--fs-2);margin-bottom:8px">' + esc(_FLD.err) + '</div>';

  out += rules.length
    ? rules
        .map(function (item, index) {
          return _ruleRow(item, index, rules.length);
        })
        .join('')
    : '<div style="color:var(--grey);font-size:var(--fs-2);padding:6px 0 12px">No rules yet. Everything arrives unfiled until you add one.</div>';

  /* ⚠️ NO "ADD A RULE" AT TRACK LEVEL, and this is a real constraint rather than an omission: a rule's whole
     definition is "file into THIS folder", so from the track there is no destination to write down. Offering the
     button here would mean inventing a target folder on the user's behalf. Say where it lives instead. */
  if (_trk) {
    out +=
      '<div style="font-size:var(--fs-1);color:var(--grey);padding:4px 0 2px">To add one, open the folder it should file into — a rule is defined by its destination, so there is nothing to write down from here.</div>';
  } else if (!d) {
    out += '<button data-cbsid="SCR004-B02" class="composebtn" data-testid="rule-new" onclick="ruleDraftNew()">+ Add a rule</button>';
  } else {
    var opts = Object.keys(_RULE_HELP)
      .map(function (item) {
        return '<option value="' + item + '"' + (d.term === item ? ' selected' : '') + '>' + esc(item) + '</option>';
      })
      .join('');
    out +=
      '<div style="border:1px solid var(--line);border-radius:12px;padding:12px 13px;background:var(--paper);color:var(--on-bg)">' +
      '<div style="font-weight:700;font-size:var(--fs-2);margin-bottom:8px">' +
      tx('New rule') +
      '</div>' +
      '<input data-cbsid="SCR004-I02" class="inp" data-testid="rule-name" placeholder="Name it (optional) — e.g. Ramesh invoices" value="' +
      esc(d.name || '') +
      '" oninput="ruleDraftSet(\'name\',this.value)" style="margin-bottom:8px">' +
      '<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">' +
      '<span style="font-size:var(--fs-2)">' +
      tx('When') +
      '</span>' +
      '<select data-cbsid="SCR004-S01" class="inp" data-testid="rule-term" style="max-width:150px" onchange="ruleDraftSet(\'term\',this.value);_fldPaint()">' +
      opts +
      '</select>' +
      '<input data-cbsid="SCR004-I03" class="inp" data-testid="rule-value" style="flex:1;min-width:130px" placeholder="' +
      esc(_RULE_HELP[d.term] || '') +
      '" value="' +
      esc(d.val || '') +
      '" oninput="ruleDraftSet(\'val\',this.value)">' +
      '<span style="font-size:var(--fs-2)"><span class=arw>→</span> file here</span></div>' +
      '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px">' +
      esc(_RULE_HELP[d.term] || '') +
      '</div>' +
      /* ⚠️ ONE TERM PER RULE, ON PURPOSE. Mixed AND/OR is what makes Outlook rules unpredictable past a handful:
         nobody can hold the precedence in their head, so the rule that fires is not the rule that was meant.
         Two conditions = two rules, in order — which is legible. */
      '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">One condition per rule. Need two? Make two rules — they run in order, and the first match wins.</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button data-cbsid="SCR004-B03" data-testid="rule-preview" onclick="rulePreview()" style="border:1px solid var(--line);background:var(--card);border-radius:9px;padding:9px 15px;font-size:var(--fs-2);font-weight:700;cursor:pointer;color:var(--on-card)">🔎 What would this catch?</button>' +
      '<button data-cbsid="SCR004-B04" class="composebtn" data-testid="rule-save" onclick="ruleSave()">' +
      tx('Save rule') +
      '</button>' +
      '<button data-cbsid="CMP003" onclick="ruleDraftCancel()" style="border:1px solid var(--line);background:var(--card);border-radius:9px;padding:9px 15px;font-size:var(--fs-2);cursor:pointer;color:var(--grey)">' +
      tx('Cancel') +
      '</button></div>';

    if (_FLD.preview) {
      var p = _FLD.preview;
      out +=
        '<div style="margin-top:11px;border-top:1px dashed var(--line);padding-top:9px">' +
        '<div style="font-size:var(--fs-2);font-weight:700">' +
        p.matched +
        ' of your last ' +
        p.scanned +
        ' chits would have been filed here</div>' +
        (p.matched
          ? '<div style="margin-top:5px">' +
            p.sample
              .map(function (item) {
                return (
                  '<div style="font-size:var(--fs-1);padding:3px 0;border-top:1px solid #f0f2f4"><b>' +
                  esc(item.subject || '(no subject)') +
                  '</b> <span style="color:var(--grey)">· ' +
                  esc(item.counterparty || '—') +
                  ' · ' +
                  esc(String(item.created_at || '').slice(0, 10)) +
                  '</span></div>'
                );
              })
              .join('') +
            (p.matched > p.sample.length
              ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">…and ' + (p.matched - p.sample.length) + ' more</div>'
              : '') +
            '</div>'
          : '<div style="font-size:var(--fs-1);color:var(--warn-2);margin-top:4px">⚠️ Nothing matched. A rule that catches nothing looks enabled and does nothing — check the term before saving.</div>') +
        '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">' +
        txf('This is a preview only. Saving affects {new}; nothing already filed moves.', { new: '<b>' + tx('new arrivals') + '</b>' }) +
        '</div></div>';
    }
    out += '</div>';
  }
  return out + '</div>';
}
