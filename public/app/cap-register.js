/* app/cap-register.js — THE REGISTER. Lazy (ensureCap('register')).
 *
 * Athi, 2026-08-30: *"complete the entire stuff and showcase the outcome"* — and, earlier, *"at the end of the
 * test, it has to clearly come out as actions? correct?"*
 *
 * ── ⭐⭐ THREE VIEWS, BECAUSE A REGISTER ANSWERS THREE DIFFERENT QUESTIONS ───────────────────────────────────
 *   LIVE     what is open, who has it, what is it worth watching — the working list
 *   CLOSURE  ⭐ THE OUTCOME. What happened to everything, named, and WHAT CAME OUT AS WORK
 *   IMPACT   what this breaks, or what broke it — the graph, walked from one entry
 *
 * ⚠️ THEY ARE NOT FILTERS OF ONE LIST. Closure is the view that must not be skimmed: it is the only place that
 * separates "resolved" from "the order closed and nobody ever answered it", and folding it into a status column
 * on the live list is exactly how a campaign gets reported clean while shipping four unfixed things.
 *
 * ⚠️ THE OLD REPORT WAS A FLAT LIST AND STAYS REACHABLE — Live IS that list, plus the registers down the side.
 * Nothing that worked before needs a new gesture to reach.
 */
var RG = { view: 'live', subjects: null, sel: null, report: null, attach: null,
           walk: null, walkFrom: null, walkBack: true,
           busy: false, err: null, adding: false, closing: null, opening: false };

/* ── the shell ──────────────────────────────────────────────────────────────────────────────────────────── */

function rgShell(body, right) {
  return '<div class="notifover" onclick="closeMsgCenter()">'
    + '<div class="notifpanel raid" onclick="event.stopPropagation()" data-testid="register-panel">'
    + '<div class="notifhd">' + tx('📋 Register')
    + (right ? '<span style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--grey)">' + right + '</span>' : '')
    + '</div>' + body + '</div></div>';
}

function rgTabs() {
  var T = [['live', tx('Live')], ['closure', tx('Closure')], ['impact', tx('Impact')]];
  return '<div class="raidtoggle" style="padding:6px 12px;border-bottom:1px solid var(--line)">'
    + T.map(function (t) {
        return '<button data-testid="register-tab-' + t[0] + '" class="' + (RG.view === t[0] ? 'on' : '') + '"'
          + ' onclick="rgGo(&quot;' + t[0] + '&quot;)">' + t[1] + '</button>';
      }).join('')
    + '</div>';
}

function rgGo(v) { RG.view = v; RG.err = null; rgPaint(); if (v === 'impact' && !RG.walk) rgWalkPick(); }

/* ── loading ────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ THE THREE VIEWS SHARE ONE LOAD. The report is every entry this entity holds; subjects are the registers
 * they hang off. Fetching per-view would make switching tabs a network round trip for data already in hand.
 */
async function rgLoad(force) {
  if (RG.busy) return;
  if (RG.report && !force) return;
  RG.busy = true; RG.err = null;
  try {
    var r = await api('raidaReport');
    RG.report = r || { entries: [] };
    /* Subjects only exist after b185. A phase-0 database answers the report and not this, which is not a fault. */
    if (r && r.full) {
      try { var s = await api('regSubjects'); RG.subjects = (s && s.subjects) || []; } catch (_) { RG.subjects = []; }
      try { var a = await api('regAttachables'); RG.attach = (a && a.attachables) || []; } catch (_) { RG.attach = []; }
    }
  } catch (e) {
    RG.err = (e && e.message) || tx('Could not read the register just now.');
  }
  RG.busy = false;
}

async function openRegister(force) {
  var host = document.getElementById('lbhost'); if (!host) return;
  UI.msgcOpen = false;
  if (!RG.report || force) {
    host.innerHTML = rgShell('<div class="raidbody"><div style="padding:14px 2px;color:var(--grey);font-size:var(--fs-2)">'
      + '<span class="spin"></span> ' + tx('reading every register…') + '</div></div>');
    await rgLoad(force);
  }
  rgPaint();
}

function rgPaint() {
  var host = document.getElementById('lbhost'); if (!host) return;
  var r = RG.report;

  if (RG.err) {
    /* ⚠️ Say what is NOT known. "Nothing here" and "I could not look" are different answers. */
    host.innerHTML = rgShell('<div class="raidbody"><div style="padding:14px 2px;color:var(--disp);font-size:var(--fs-2)">'
      + esc(RG.err) + '<br><span style="color:var(--grey)">'
      + tx('This does NOT mean there is nothing on the register.') + '</span></div></div>');
    return;
  }
  if (r && r.migrated === false) {
    host.innerHTML = rgShell('<div class="raidbody"><div style="padding:14px 2px;color:var(--grey);font-size:var(--fs-2)">'
      + tx('The register is not switched on for this environment yet (b182).') + '</div></div>');
    return;
  }

  var head = (r ? (r.open + ' ' + tx('open') + ' · ' + r.closed + ' ' + tx('closed')
        + (r.closed_by_order ? ' · ' + r.closed_by_order + ' ' + tx('with the order') : '')) : '');
  var body = RG.view === 'closure' ? rgClosure() : RG.view === 'impact' ? rgImpact() : rgLive();
  host.innerHTML = rgShell(rgTabs() + body, head);
  try { mvModal(host, true); } catch (_) {}
}

/* ── shared bits ────────────────────────────────────────────────────────────────────────────────────────── */

function rgIcon(k) { return (RAIDA_KINDS[k] && RAIDA_KINDS[k].icon) || '•'; }
function rgLabel(k) { return (RAIDA_KINDS[k] && RAIDA_KINDS[k].label) || k; }
function rgEnding(d) { return (RAIDA_ENDINGS[d] && RAIDA_ENDINGS[d].label) || d; }
function rgBand(t, n) {
  return '<div style="margin-top:12px;font-size:var(--fs-1);font-weight:800;letter-spacing:.06em;'
    + 'text-transform:uppercase;color:var(--grey)">' + t + (n != null ? ' · ' + n : '') + '</div>';
}
function rgEntries() { return (RG.report && RG.report.entries) || []; }

/* Entries on the selected register, or all of them when nothing is selected. */
function rgScoped() {
  var es = rgEntries();
  return RG.sel ? es.filter(function (e) { return e.subject_id === RG.sel; }) : es;
}
function rgSubjectName(id) {
  var s = (RG.subjects || []).find(function (x) { return x.subject_id === id; });
  return s ? s.name : null;
}

/**
 * ⭐ SCORE, SHOWN ONLY WHEN IT WAS RATED. likelihood × severity is the one number every standard here agrees
 * on (ISO 31000's matrix, MIL-STD-882E's RAC, FMEA's RPN without detectability). Printing a 0 or a dash for an
 * unrated entry would make "nobody has assessed this" look like "assessed as harmless".
 */
function rgScore(e) {
  if (!e.score) return '';
  var c = e.score >= 15 ? 'var(--disp)' : e.score >= 8 ? 'var(--warn-2)' : 'var(--grey)';
  return '<span title="' + esc(tx('likelihood × severity')) + '" style="color:' + c + ';font-weight:700">'
    + e.likelihood + '×' + e.severity + '=' + e.score + '</span>';
}

/* ── LIVE ───────────────────────────────────────────────────────────────────────────────────────────────── */

function rgRegisterRail() {
  var subs = RG.subjects;
  if (!subs) return '';
  var es = rgEntries();
  var countFor = function (id) {
    return es.filter(function (e) { return e.subject_id === id && e.open; }).length;
  };
  var chip = function (id, name, n, closed) {
    return '<button data-testid="register-subject" class="' + (RG.sel === id ? 'on' : '') + '"'
      + ' onclick="rgSel(' + (id ? '&quot;' + id + '&quot;' : 'null') + ')"'
      + ' title="' + esc(name) + '">' + esc(name)
      + (n ? ' <b>' + n + '</b>' : '')
      + (closed ? ' ✓' : '') + '</button>';
  };
  return '<div class="raidtoggle" style="padding:6px 12px;border-bottom:1px solid var(--line)">'
    + chip(null, tx('All registers'), es.filter(function (e) { return e.open; }).length, false)
    + subs.map(function (s) { return chip(s.subject_id, s.name, countFor(s.subject_id), !!s.closed_at); }).join('')
    + '<button onclick="rgNewAsk()" data-testid="register-new" title="' + esc(tx('Open a register on something else'))
    + '">＋ ' + tx('New') + '</button>'
    + '</div>';
}

function rgSel(id) { RG.sel = id; RG.walk = null; rgPaint(); }

function rgRow(e) {
  var where = e.particulars ? esc(e.particulars) : (e.chit_id ? tx('the whole order') : tx('the register'));
  var end = e.ending === 'closed'
      ? (rgEnding(e.disposition) + (e.closed_note ? ' — ' + esc(e.closed_note) : ''))
    : e.ending === 'closed_by_order'
      ? '<span style="color:var(--warn-2)">' + tx('closed with the order') + '</span>' : '';
  /* ⚠️ An entry on a standalone register has no chit to open. Offering the gesture anyway is the fake-button
     defect — it looks clickable and does nothing. */
  var opens = e.chit_id ? ' style="cursor:pointer' + (e.open ? '' : ';opacity:.6') + '"'
        + ' onclick="closeMsgCenter();openChit(&quot;' + e.chit_id + '&quot;)" title="' + esc(tx('Open the order')) + '"'
      : (e.open ? '' : ' style="opacity:.6"');
  return '<div class="raidrow" data-testid="raida-item"' + opens + '>'
    + '<div class="rl"><span class="mtype ' + e.kind + '">' + rgIcon(e.kind) + ' ' + esc(rgLabel(e.kind)) + '</span>'
    + (e.open && e.score ? ' ' + rgScore(e) : '') + '</div>'
    + '<div style="font-size:var(--fs-2);color:var(--on-card);line-height:1.5'
    + (e.open ? '' : ';text-decoration:line-through') + '">' + esc(e.body) + '</div>'
    + '<div class="rsamp">' + where
    + (e.subject ? ' · ' + esc(e.subject) : '')
    + (e.owner ? ' · ' + esc(e.owner) : (e.by ? ' · ' + esc(e.by) : ''))
    + (e.due_date ? ' · ' + tx('due') + ' ' + esc(String(e.due_date).slice(0, 10)) : '')
    + (e.visibility === 'shared' ? ' · <span style="color:var(--blue-2)">' + tx('shared') + '</span>' : '')
    + (end ? ' · ' + end : '')
    + '</div>'
    + (e.open && RG.report.full
        ? '<div style="margin-top:6px"><button class="msglink" data-testid="raida-close"'
          + ' onclick="event.stopPropagation();rgCloseAsk(&quot;' + e.raida_id + '&quot;)">'
          + tx('End this →') + '</button></div>'
        : '')
    + '</div>';
}

function rgLive() {
  var es = rgScoped();
  var open = es.filter(function (e) { return e.open; });
  var shut = es.filter(function (e) { return !e.open; });
  /* ⭐ Worst first. A register sorted by date buries the thing that should be read first under whatever was
     typed most recently. Unrated entries sort last rather than as zero — see rgScore. */
  open.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });

  return '<div class="raidbody">'
    + rgRegisterRail()
    + (RG.report.full ? rgAddBar() : '')
    + (es.length
        ? (open.length ? rgBand(tx('Open'), open.length) + open.map(rgRow).join('') : '')
          + (shut.length ? rgBand(tx('Closed'), shut.length) + shut.map(rgRow).join('') : '')
        : '<div class="msgempty">' + tx('Nothing recorded yet — which is usually the right answer.') + '</div>')
    + '</div>';
}

/* ── writing to it ──────────────────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️⚠️ INLINE FIELDS, NEVER window.prompt(). A prompt cannot be styled, cannot be tested, and blocks the
 * browser extension outright — it shipped once in this capability's close flow and had to come straight back
 * out. Everything that asks a question here asks it in the panel.
 */
function rgAddBar() {
  if (!RG.adding) {
    return '<div style="padding:8px 0"><button class="msglink" data-testid="raida-add-open"'
      + ' onclick="rgAdd(true)">＋ ' + tx('Record something') + '</button></div>';
  }
  var kinds = Object.keys(RAIDA_KINDS).map(function (k) {
    return '<option value="' + k + '">' + rgIcon(k) + ' ' + esc(RAIDA_KINDS[k].label) + '</option>';
  }).join('');
  return '<div class="raidadd" style="padding:8px 0;border-bottom:1px solid var(--line)">'
    + '<select id="rgKind" class="inp" data-testid="raida-kind" style="width:100%;margin-bottom:6px">' + kinds + '</select>'
    + '<input id="rgBody" class="inp" data-testid="raida-body" style="width:100%;margin-bottom:6px"'
    + ' placeholder="' + esc(tx('What is it? Say it in one line.')) + '">'
    + '<div style="display:flex;gap:6px;margin-bottom:6px">'
    + '<input id="rgOwner" class="inp" style="flex:1" placeholder="' + esc(tx('Owner')) + '">'
    + '<input id="rgDue" class="inp" type="date" style="flex:1">'
    + '</div>'
    + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
    + '<span style="font-size:var(--fs-1);color:var(--grey)">' + tx('Likelihood') + '</span>'
    + '<input id="rgL" class="inp" type="number" min="1" max="5" style="width:64px">'
    + '<span style="font-size:var(--fs-1);color:var(--grey)">' + tx('Severity') + '</span>'
    + '<input id="rgS" class="inp" type="number" min="1" max="5" style="width:64px">'
    + '</div>'
    + '<div style="display:flex;gap:6px">'
    + '<button class="btn" data-testid="raida-save" style="flex:1" onclick="rgSave()">' + tx('Record it') + '</button>'
    + '<button class="btn ghost" style="flex:1" onclick="rgAdd(false)">' + tx('Cancel') + '</button>'
    + '</div></div>';
}

function rgAdd(on) { RG.adding = !!on; rgPaint(); }

function rgVal(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }

async function rgSave() {
  var body = rgVal('rgBody');
  if (!body) { toast(tx('It needs to say something.')); return; }
  if (!RG.sel) { toast(tx('Pick a register first — or open a new one.')); return; }
  var p = { kind: rgVal('rgKind') || 'risk', body: body };
  var o = rgVal('rgOwner'); if (o) p.owner_name = o;
  var d = rgVal('rgDue'); if (d) p.due_date = d;
  var l = rgVal('rgL'); if (l) p.likelihood = +l;
  var s = rgVal('rgS'); if (s) p.severity = +s;
  try {
    await api('regEntryAdd', { params: { sid: RG.sel }, body: p });
    RG.adding = false;
    toast(tx('Recorded.'));
    await openRegister(true);
  } catch (e) { toast(MSG.fail('record it', e)); }
}

function rgNewAsk() { RG.opening = !RG.opening; RG.adding = false; rgPaint(); if (RG.opening) rgNewPaint(); }

/* The kinds come from register_attachable — a ROW, not an enum, so a new one needs no deploy. */
function rgNewPaint() {
  var body = document.querySelector('.raidbody'); if (!body) return;
  var opts = (RG.attach || []).map(function (a) {
    return '<option value="' + a.type_key + '">' + esc(a.label) + '</option>';
  }).join('');
  var el = document.createElement('div');
  el.className = 'raidadd';
  el.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--line)';
  el.innerHTML = '<select id="rgNewType" class="inp" data-testid="register-new-type" style="width:100%;margin-bottom:6px">'
    + opts + '</select>'
    + '<input id="rgNewName" class="inp" data-testid="register-new-name" style="width:100%;margin-bottom:6px"'
    + ' placeholder="' + esc(tx('Name it')) + '">'
    + '<div style="display:flex;gap:6px">'
    + '<button class="btn" data-testid="register-new-save" style="flex:1" onclick="rgNewSave()">' + tx('Open it') + '</button>'
    + '<button class="btn ghost" style="flex:1" onclick="rgNewAsk()">' + tx('Cancel') + '</button></div>';
  body.insertBefore(el, body.children[1] || null);
}

async function rgNewSave() {
  var name = rgVal('rgNewName');
  if (!name) { toast(tx('Give it a name.')); return; }
  try {
    var r = await api('regSubjectNew', { body: { type_key: rgVal('rgNewType') || 'other', name: name } });
    RG.opening = false;
    RG.sel = r && r.subject_id;
    toast(tx('Register opened.'));
    await openRegister(true);
  } catch (e) { toast(MSG.fail('open the register', e)); }
}

/**
 * ⭐⭐ ENDING SOMETHING ASKS HOW, AND WILL NOT DEFAULT. Six endings, and only some are actions — `accepted` and
 * `constraint` produce nothing that will ever nag anyone again, so folding them into "closed" would let the
 * register report clean while carrying things nobody fixed.
 */
function rgCloseAsk(id) { RG.closing = (RG.closing === id ? null : id); rgPaint(); if (RG.closing) rgClosePaint(id); }

function rgClosePaint(id) {
  var rows = document.querySelectorAll('[data-testid="raida-item"]');
  var idx = -1;
  rgScoped().filter(function (e) { return e.open; })
    .sort(function (a, b) { return (b.score || 0) - (a.score || 0); })
    .forEach(function (e, i) { if (e.raida_id === id) idx = i; });
  if (idx < 0 || !rows[idx]) return;
  var opts = Object.keys(RAIDA_ENDINGS).map(function (k) {
    return '<option value="' + k + '">' + esc(RAIDA_ENDINGS[k].label) + ' — ' + esc(RAIDA_ENDINGS[k].hint) + '</option>';
  }).join('');
  var el = document.createElement('div');
  el.style.cssText = 'margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px';
  el.innerHTML = '<select id="rgDisp" class="inp" data-testid="raida-disposition" style="width:100%;margin-bottom:6px">'
    + opts + '</select>'
    + '<input id="rgNote" class="inp" data-testid="raida-close-note" style="width:100%;margin-bottom:6px"'
    + ' placeholder="' + esc(tx('What happened? One line.')) + '">'
    + '<div style="display:flex;gap:6px">'
    + '<button class="btn" data-testid="raida-close-save" style="flex:1"'
    + ' onclick="rgCloseSave(&quot;' + id + '&quot;)">' + tx('End it') + '</button>'
    + '<button class="btn ghost" style="flex:1" onclick="rgCloseAsk(&quot;' + id + '&quot;)">' + tx('Cancel') + '</button></div>';
  rows[idx].appendChild(el);
}

async function rgCloseSave(id) {
  var disp = rgVal('rgDisp');
  if (!disp) { toast(tx('Say how it ended.')); return; }
  try {
    await api('regEntryClose', { params: { rid: id }, body: { disposition: disp, body: rgVal('rgNote') } });
    RG.closing = null;
    toast(tx('Ended.'));
    await openRegister(true);
  } catch (e) { toast(MSG.fail('end it', e)); }
}

/* ── CLOSURE — the outcome ──────────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐⭐ THE VIEW THAT ANSWERS *"at the end of the test, it has to clearly come out as actions"*.
 *
 * A register is worth keeping only if closing it PRODUCES something. Three groups, and they are separated on
 * purpose because they land on different people:
 *
 *   WORK CAME OUT        action · carried_forward — somebody now owns something
 *   CARRIED KNOWINGLY    accepted · constraint · waived — ⚠️ nothing will EVER nag anyone about these again.
 *                        They are invisible by construction, so this list is the only place they exist.
 *   SETTLED              resolved — fixed, and the fix was verified
 *
 * ⚠️ AND WHAT NOBODY ANSWERED IS ITS OWN GROUP. An order that closes takes its entries with it; those are not
 * resolved, they are abandoned, and summing them into "closed" flatters the register at the one moment it must
 * not.
 */
var RG_OUTCOME = {
  work:    { keys: ['action', 'carried_forward'], label: 'Work came out of it', tone: 'var(--blue-2)' },
  carried: { keys: ['accepted', 'constraint', 'waived'], label: 'Carried knowingly', tone: 'var(--warn-2)' },
  settled: { keys: ['resolved'], label: 'Settled', tone: 'var(--grey)' },
};

function rgClosure() {
  var es = rgScoped();
  if (!RG.report.full) {
    return '<div class="raidbody"><div class="msgempty">'
      + tx('Closure needs the full register (b185).') + '</div></div>';
  }
  if (!es.length) {
    return '<div class="raidbody">' + rgRegisterRail() + '<div class="msgempty">'
      + tx('Nothing recorded, so there is nothing to close out.') + '</div></div>';
  }

  var open = es.filter(function (e) { return e.open; });
  var abandoned = es.filter(function (e) { return e.ending === 'closed_by_order'; });
  var ended = es.filter(function (e) { return e.ending === 'closed'; });
  var name = RG.sel ? rgSubjectName(RG.sel) : tx('every register');

  var group = function (g) {
    var rows = ended.filter(function (e) { return g.keys.indexOf(e.disposition) >= 0; });
    if (!rows.length) return '';
    return rgBand(tx(g.label), rows.length)
      + rows.map(function (e) {
          return '<div class="raidrow" data-testid="closure-item"'
            + (e.chit_id ? ' style="cursor:pointer" onclick="closeMsgCenter();openChit(&quot;' + e.chit_id + '&quot;)"' : '')
            + '><div class="rl"><span class="mtype ' + e.kind + '">' + rgIcon(e.kind) + ' ' + esc(rgLabel(e.kind)) + '</span>'
            + ' <span style="color:' + g.tone + ';font-weight:700">' + esc(rgEnding(e.disposition)) + '</span></div>'
            + '<div style="font-size:var(--fs-2);color:var(--on-card);line-height:1.5">' + esc(e.body) + '</div>'
            + '<div class="rsamp">'
            + (e.closed_note ? esc(e.closed_note) : tx('no note'))
            + (e.closed_by ? ' · ' + esc(e.closed_by) : '')
            + (e.owner ? ' · ' + tx('owner') + ' ' + esc(e.owner) : '')
            + (e.evidence ? ' · ' + tx('evidence') + ' ' + esc(e.evidence.ref) : '')
            + '</div></div>';
        }).join('');
  };

  /* ⭐ THE GATE, stated before the button rather than discovered by pressing it. */
  var gate = open.length
    ? '<div style="margin-top:12px;padding:10px;border:1px solid var(--warn-2);border-radius:8px">'
      + '<b style="color:var(--warn-2)">' + open.length + ' ' + tx('still open') + '</b><br>'
      + '<span style="font-size:var(--fs-1);color:var(--grey)">'
      + tx('A register cannot be closed while anything is undispositioned. Each one needs an ending.') + '</span>'
      + '<div style="margin-top:6px">' + open.map(function (e) {
          return '<div style="font-size:var(--fs-2)">' + rgIcon(e.kind) + ' ' + esc(e.body) + '</div>';
        }).join('') + '</div></div>'
    : (RG.sel
        ? '<div style="margin-top:12px"><button class="btn" data-testid="register-close"'
          + ' onclick="rgSubjectClose()">' + tx('Close this register') + '</button></div>'
        : '');

  return '<div class="raidbody">'
    + rgRegisterRail()
    + '<div style="padding:8px 0;font-size:var(--fs-2);color:var(--grey)">'
    + tx('Closure statement for') + ' <b style="color:var(--on-card)">' + esc(name) + '</b> — '
    + es.length + ' ' + tx('recorded') + ', ' + ended.length + ' ' + tx('ended')
    + ', ' + open.length + ' ' + tx('open') + '.</div>'
    + group(RG_OUTCOME.work)
    + group(RG_OUTCOME.carried)
    + group(RG_OUTCOME.settled)
    + (abandoned.length
        ? rgBand('<span style="color:var(--disp)">' + tx('Nobody answered these') + '</span>', abandoned.length)
          + '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">'
          + tx('The order closed around them. Unresolved, not resolved.') + '</div>'
          + abandoned.map(function (e) {
              return '<div class="raidrow"><div class="rl"><span class="mtype ' + e.kind + '">'
                + rgIcon(e.kind) + ' ' + esc(rgLabel(e.kind)) + '</span></div>'
                + '<div style="font-size:var(--fs-2);color:var(--on-card)">' + esc(e.body) + '</div></div>';
            }).join('')
        : '')
    + gate
    + '</div>';
}

async function rgSubjectClose() {
  if (!RG.sel) return;
  try {
    await api('regSubjectClose', { params: { sid: RG.sel }, body: {} });
    toast(tx('Register closed.'));
    await openRegister(true);
  } catch (e) {
    /* ⚠️ The 409 NAMES what is outstanding. Showing "could not close" would throw that away. */
    var out = (e && e.outstanding) || null;
    toast(out && out.length
      ? txf('{n} still need an ending.', { n: out.length })
      : MSG.fail('close the register', e));
    await openRegister(true);
  }
}

/* ── IMPACT — the graph ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐⭐ WHAT THIS BREAKS, OR WHAT BROKE IT. Every dependency that POINTS is an edge; the walk is the impact.
 *
 * ⚠️ BACKWARDS IS THE DEFAULT, deliberately. Forwards ("what waits on this") is the planning question and gets
 * asked occasionally. Backwards ("what is this waiting on") is the question asked after something has already
 * gone wrong, which is when anyone actually opens this.
 *
 * ⚠️ A DEPENDENCY THAT DOES NOT POINT IS A SENTENCE, NOT AN EDGE. "We need the crane" with no target cannot be
 * walked and must not be drawn as though it could — it is listed separately rather than silently dropped.
 */
function rgWalkPick() {
  var es = rgScoped().filter(function (e) { return e.edge; });
  if (es.length && !RG.walkFrom) {
    RG.walkFrom = es[0].line_id || es[0].subject_id;
    rgWalkLoad();
  }
}

async function rgWalkLoad() {
  if (!RG.walkFrom) return;
  try {
    RG.walk = await api('regWalk', { params: { from: RG.walkFrom },
                                     query: { backwards: RG.walkBack ? '1' : '0' } });
  } catch (e) { RG.walk = { hops: [], err: (e && e.message) || 'failed' }; }
  rgPaint();
}

function rgWalkDir() { RG.walkBack = !RG.walkBack; rgWalkLoad(); }
function rgWalkFrom(id) { RG.walkFrom = id; rgWalkLoad(); }

/* One column per depth, one box per hop. Plain SVG — no library, and it scales with the panel. */
function rgGraph(hops) {
  var byDepth = {};
  hops.forEach(function (h) { (byDepth[h.depth] = byDepth[h.depth] || []).push(h); });
  var depths = Object.keys(byDepth).map(Number).sort(function (a, b) { return a - b; });
  var COL = 200, ROW = 62, PAD = 12;
  var maxRows = Math.max.apply(null, depths.map(function (d) { return byDepth[d].length; }).concat([1]));
  var W = PAD * 2 + (depths.length + 1) * COL, H = PAD * 2 + maxRows * ROW + 24;
  var parts = [];

  parts.push('<rect x="' + PAD + '" y="' + (PAD + 10) + '" width="150" height="40" rx="8" fill="none"'
    + ' stroke="currentColor" stroke-width="2"/>');
  parts.push('<text x="' + (PAD + 10) + '" y="' + (PAD + 35) + '" font-size="12" fill="currentColor"'
    + ' font-weight="700">' + esc(tx('this')) + '</text>');

  depths.forEach(function (d, di) {
    byDepth[d].forEach(function (h, ri) {
      var x = PAD + (di + 1) * COL, y = PAD + ri * ROW + 10;
      var sev = h.severity >= 4 ? 'var(--disp)' : 'currentColor';
      parts.push('<line x1="' + (x - COL + 150) + '" y1="' + (PAD + 30) + '" x2="' + x + '" y2="' + (y + 20)
        + '" stroke="currentColor" stroke-width="1.5" opacity=".55" marker-end="url(#rgarrow)"/>');
      parts.push('<text x="' + (x - COL + 158) + '" y="' + (PAD + 24) + '" font-size="10" fill="currentColor"'
        + ' opacity=".7">' + esc(String(h.rel_type || '').replace(/_/g, ' ')) + '</text>');
      parts.push('<rect x="' + x + '" y="' + y + '" width="176" height="40" rx="8" fill="none" stroke="' + sev
        + '" stroke-width="1.5"/>');
      var lab = String(h.to_label || h.body || '');
      parts.push('<text x="' + (x + 9) + '" y="' + (y + 18) + '" font-size="11" fill="currentColor">'
        + esc(lab.length > 24 ? lab.slice(0, 24) + '…' : lab) + '</text>');
      parts.push('<text x="' + (x + 9) + '" y="' + (y + 32) + '" font-size="10" fill="currentColor" opacity=".65">'
        + esc((h.owner || '') + (h.needed_by ? ' · ' + String(h.needed_by).slice(0, 10) : '')) + '</text>');
    });
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" style="max-width:100%;height:auto;color:var(--on-card)"'
    + ' aria-label="' + esc(tx('Impact walk')) + '">'
    + '<defs><marker id="rgarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6"'
    + ' orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>'
    + parts.join('') + '</svg>';
}

function rgDangling(list) {
  if (!list.length) return '';
  return rgBand(tx('Dependencies that name no target'), list.length)
    + '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">'
    + tx('These cannot be walked — they are sentences, not edges.') + '</div>'
    + list.map(function (e) {
        return '<div class="raidrow"><div style="font-size:var(--fs-2)">🔗 ' + esc(e.body) + '</div></div>';
      }).join('');
}

function rgImpact() {
  if (!RG.report.full) {
    return '<div class="raidbody"><div class="msgempty">'
      + tx('The impact walk needs the full register (b185).') + '</div></div>';
  }
  var es = rgScoped();
  var edges = es.filter(function (e) { return e.edge; });
  var dangling = es.filter(function (e) { return e.kind === 'dependency' && !e.edge; });

  if (!edges.length) {
    return '<div class="raidbody">' + rgRegisterRail()
      + '<div class="msgempty">' + tx('Nothing points anywhere yet, so there is no graph to walk.') + '<br>'
      + '<span style="font-size:var(--fs-1)">'
      + tx('A dependency becomes an edge when it names what it waits on.') + '</span></div>'
      + rgDangling(dangling) + '</div>';
  }

  var starts = [];
  edges.forEach(function (e) {
    var id = e.line_id || e.subject_id;
    if (id && !starts.some(function (s) { return s.id === id; })) {
      starts.push({ id: id, label: e.particulars || e.subject || tx('this register') });
    }
  });
  var hops = (RG.walk && RG.walk.hops) || [];

  return '<div class="raidbody">'
    + rgRegisterRail()
    + '<div class="raidtoggle" style="padding:6px 0">'
    + '<button class="' + (RG.walkBack ? 'on' : '') + '" data-testid="walk-back" onclick="rgWalkDir()">'
    + tx('What this waits on') + '</button>'
    + '<button class="' + (RG.walkBack ? '' : 'on') + '" onclick="rgWalkDir()">'
    + tx('What waits on this') + '</button></div>'
    + (starts.length > 1
        ? '<div class="raidtoggle" style="padding:6px 0">' + starts.map(function (s) {
            return '<button class="' + (RG.walkFrom === s.id ? 'on' : '') + '"'
              + ' onclick="rgWalkFrom(&quot;' + s.id + '&quot;)">' + esc(s.label) + '</button>';
          }).join('') + '</div>'
        : '')
    + (hops.length
        ? '<div style="overflow-x:auto" data-testid="walk-graph">' + rgGraph(hops) + '</div>'
          + '<div style="font-size:var(--fs-1);color:var(--grey);padding:6px 0">'
          + txf('{n} hops, {d} deep.', { n: hops.length, d: (RG.walk && RG.walk.depth_reached) || 0 })
          + (RG.walk && RG.walk.truncated ? ' ' + tx('Stopped at the depth limit — there is more.') : '')
          + '</div>'
        : '<div class="msgempty">' + tx('Nothing on this path.') + '</div>')
    + rgDangling(dangling)
    + '</div>';
}

/* ⚠️⚠️ NO openRaidReport() HERE, DELIBERATELY. Defining it in this file too would SHADOW the shim in app.html
 * — two declarations of one name across two files, which dead-surface.cjs flags and is right to: a reader
 * cannot tell which one runs, and the answer depends on load order. The shim is the single door. ensureCap is
 * memoised, so going through it every time costs nothing after the first open, and it re-reads on each open
 * on purpose: a stale governance number is worse than a spinner.
 */
