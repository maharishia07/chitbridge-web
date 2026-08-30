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

/**
 * ⭐⭐ A REGISTER IS A TABLE, AND IT NEEDS THE ROOM — Athi, 2026-08-30: *"it is currently bringing the task
 * panel. what we need is a proper UI for RISK register with all the columns intact so it looks like a
 * register."*
 *
 * ⚠️ IT WAS RENDERING INTO `.notifpanel`, the message-centre shell — ~300px of stacked rows. That is the right
 * frame for notifications and the wrong one for a register: every standard here (PRINCE2, PMBOK, ISO 31000,
 * MIL-STD-882E) describes a row per risk with inherent score, treatment and residual score side by side, and
 * every tool that renders one — Excel included, which is what most people actually use — renders it wide.
 * Stacked into a narrow pane the columns cannot sit beside each other, so the comparison the register exists to
 * support cannot be made.
 *
 * ⭐ REUSES modal(html, true): 820px, movable and resizable via makeMovable, with its own close control. No new
 * frame, no new coordinates — see UI placement standards.
 */
function rgShell(body, right) {
  return '<div class="mhd" style="display:flex;align-items:center;gap:10px">'
    + '<div class="t" style="flex:1;padding-inline-end:30px">' + tx('📋 Register') + '</div>'
    + (right ? '<div style="font-size:var(--fs-1);color:var(--grey);white-space:nowrap">' + right + '</div>' : '')
    + '</div>'
    + '<div class="mbody" data-testid="register-panel" style="padding:12px 16px 16px">' + body + '</div>';
}

function rgTabs() {
  var T = [['live', tx('Register')], ['closure', tx('Closure')], ['impact', tx('Impact')]];
  return '<div class="raidtoggle" style="padding:0 0 10px">'
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
  if (!RG.report || force) {
    modal(rgShell('<div style="padding:14px 2px;color:var(--grey);font-size:var(--fs-2)">'
      + '<span class="spin"></span> ' + tx('reading every register…') + '</div>'), true);
    await rgLoad(force);
  }
  rgPaint();
}

function rgPaint() {
  var r = RG.report;
  var body;

  if (RG.err) {
    /* ⚠️ Say what is NOT known. "Nothing here" and "I could not look" are different answers. */
    body = '<div style="padding:14px 2px;color:var(--disp);font-size:var(--fs-2)">' + esc(RG.err)
      + '<br><span style="color:var(--grey)">'
      + tx('This does NOT mean there is nothing on the register.') + '</span></div>';
    modal(rgShell(body), true);
    return;
  }
  if (r && r.migrated === false) {
    modal(rgShell('<div style="padding:14px 2px;color:var(--grey);font-size:var(--fs-2)">'
      + tx('The register is not switched on for this environment yet (b182).') + '</div>'), true);
    return;
  }

  var head = (r ? (r.open + ' ' + tx('open') + ' · ' + r.closed + ' ' + tx('closed')
        + (r.closed_by_order ? ' · ' + r.closed_by_order + ' ' + tx('with the order') : '')) : '');
  body = RG.view === 'closure' ? rgClosure() : RG.view === 'impact' ? rgImpact() : rgLive();
  modal(rgShell(rgTabs() + body, head), true);
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
 * ⭐⭐ THE FOUR BANDS, WHICH IS HOW EVERY TOOL COLOURS A REGISTER. 5×5 gives 1–25; the split below is the common
 * one (low · medium · high · extreme). The band is what makes a register scannable — a column of bare integers
 * is a spreadsheet, not a risk view.
 *
 * ⚠️ NO BAND FOR AN UNRATED ENTRY. Colouring "nobody has assessed this" green is the single most misleading
 * thing a register can do.
 */
function rgBandOf(score) {
  if (!score) return null;
  if (score >= 15) return { key: 'extreme', label: tx('Extreme'), fg: 'var(--disp)' };
  if (score >= 10) return { key: 'high', label: tx('High'), fg: 'var(--disp)' };
  if (score >= 5) return { key: 'high', label: tx('Medium'), fg: 'var(--warn-2)' };
  return { key: 'low', label: tx('Low'), fg: 'var(--grey)' };
}

function rgCell(l, s, score) {
  if (!score) return '<span style="color:var(--grey)">—</span>';
  var b = rgBandOf(score);
  return '<span title="' + esc(tx('likelihood × severity')) + '" style="color:' + b.fg + ';font-weight:700;'
    + 'font-variant-numeric:tabular-nums">' + l + '×' + s + '</span> '
    + '<span style="color:' + b.fg + ';font-variant-numeric:tabular-nums">' + score + '</span>';
}

/**
 * ⭐⭐ THE HEAT MAP — likelihood against severity, counts in the cells. Every risk tool pairs the register with
 * one, and it answers the question the table cannot: not "what is on it" but "what shape is this".
 *
 * ⚠️ RESIDUAL WHERE THERE IS ONE, INHERENT OTHERWISE, and it says which. Plotting inherent scores next to
 * residual ones in the same grid would double-count treated risks and overstate the exposure.
 */
function rgHeat(entries) {
  var rated = entries.filter(function (e) { return e.open && e.severity && e.likelihood; });
  if (!rated.length) return '';
  var grid = {}, anyResidual = false;
  rated.forEach(function (e) {
    var l = e.residual_likelihood || e.likelihood, s = e.residual_severity || e.severity;
    if (e.residual_likelihood || e.residual_severity) anyResidual = true;
    grid[l + ':' + s] = (grid[l + ':' + s] || 0) + 1;
  });
  var rows = '';
  for (var l = 5; l >= 1; l--) {
    var cells = '';
    for (var s = 1; s <= 5; s++) {
      var n = grid[l + ':' + s] || 0;
      var b = rgBandOf(l * s);
      cells += '<td class="rg-hc" style="' + (n ? 'color:' + b.fg + ';font-weight:700' : 'color:var(--line)') + '">'
        + (n || '·') + '</td>';
    }
    rows += '<tr><th class="rg-hh">' + l + '</th>' + cells + '</tr>';
  }
  return '<div class="rg-heat"><table class="rg-heatt" aria-label="' + esc(tx('Likelihood against severity')) + '">'
    + '<caption>' + tx('Open, by likelihood × severity')
    + (anyResidual ? ' · <span style="color:var(--grey)">' + tx('residual where set') + '</span>' : '')
    + '</caption>'
    + rows
    + '<tr><th class="rg-hh"></th>'
    + [1, 2, 3, 4, 5].map(function (s) { return '<th class="rg-hh">' + s + '</th>'; }).join('')
    + '</tr></table>'
    + '<div class="rg-hax">' + tx('severity →') + '</div></div>';
}

/**
 * ⭐ THE REGISTERS THEMSELVES. One chip per subject with its open count, plus "All registers" — the roll-up
 * across every one of them, which is the view a governance question usually starts from.
 */
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
  return '<div class="raidtoggle" style="padding:0 0 8px">'
    + chip(null, tx('All registers'), es.filter(function (e) { return e.open; }).length, false)
    + subs.map(function (s) { return chip(s.subject_id, s.name, countFor(s.subject_id), !!s.closed_at); }).join('')
    + '<button onclick="rgNewAsk()" data-testid="register-new" title="' + esc(tx('Open a register on something else'))
    + '">＋ ' + tx('New') + '</button>'
    + '</div>';
}

function rgSel(id) { RG.sel = id; RG.walk = null; RG.walkFrom = null; rgPaint(); }

/* ── LIVE — the register itself ─────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐⭐ THE COLUMNS ARE NOT INVENTED. They are the set PRINCE2, PMBOK, ISO 31000 and MIL-STD-882E agree on:
 * an identifier · what it is · the description · who owns it · when it was raised · an INHERENT score ·
 * the treatment · a RESIDUAL score · dates · status. Two of them carry more weight than they look:
 *
 *   ⭐ INHERENT AND RESIDUAL SIT SIDE BY SIDE. A register that shows one number cannot show that anything was
 *     done — the whole argument of a treatment is the distance between the two.
 *   ⭐ VERIFY is ISO/IEC/IEEE 15288's four (test · analysis · inspection · demonstration). "How would we know"
 *     is the column that separates a register from a worry list.
 *
 * ⚠️ THE CHIT IS A LINK, NOT THE ROW. Making the whole row navigate is what made this feel like the task panel:
 * a register is read across, and a row that jumps away on any click cannot be read at all.
 */
function rgLinkTo(e) {
  if (!e.chit_id) return '<span style="color:var(--grey)">' + tx('standalone') + '</span>';
  var label = e.particulars || e.subject || tx('the order');
  return '<a href="#" class="rg-link" data-testid="raida-chit-link"'
    + ' onclick="event.preventDefault();event.stopPropagation();closeModal();openChit(&quot;' + e.chit_id + '&quot;);return false"'
    + ' title="' + esc(tx('Open the order')) + '">' + esc(label) + ' ↗</a>';
}

/**
 * ⭐⭐ THE APP'S OWN LIST, NOT A TABLE OF MY OWN — Athi: *"see how this can follow our standard design."*
 *
 * Every list in this product is `.lhead` + `.lrow` sharing one `grid-template-columns`, and that is what the
 * register is: records with columns. Adopting it brings the sticky header, the type scale, the hover state, the
 * borders and the spacing for free, and — more to the point — means the register cannot drift away from the
 * rest of the app the next time any of those change. A hand-rolled `<table>` had already reinvented all five.
 *
 * ⚠️ ONE DELIBERATE DEPARTURE: `.lrow` is `cursor:pointer` because rows in this app open things. A register row
 * does not — it is read ACROSS, and the chit is a link inside it. The cursor is reset for that reason alone.
 */
var RG_COLS = [
  { k: 'id',        w: '68px',              h: 'ID' },
  { k: 'type',      w: '112px',             h: 'Type' },
  { k: 'what',      w: 'minmax(220px,1.4fr)', h: 'What' },
  { k: 'register',  w: 'minmax(140px,1fr)', h: 'Register' },
  { k: 'where',     w: 'minmax(130px,1fr)', h: 'Where' },
  { k: 'owner',     w: '104px',             h: 'Owner' },
  { k: 'inherent',  w: '92px',              h: 'Inherent' },
  { k: 'treatment', w: 'minmax(150px,1fr)', h: 'Treatment' },
  { k: 'verify',    w: '96px',              h: 'Verify' },
  { k: 'residual',  w: '92px',              h: 'Residual' },
  { k: 'due',       w: '94px',              h: 'Due' },
  { k: 'review',    w: '94px',              h: 'Review' },
  { k: 'raised',    w: '94px',              h: 'Raised' },
  { k: 'status',    w: '104px',             h: 'Status' },
];
function rgTpl() { return RG_COLS.map(function (c) { return c.w; }).join(' '); }

function rgHead() {
  return '<div class="lhead" style="grid-template-columns:' + rgTpl() + '">'
    + RG_COLS.map(function (c) { return '<div>' + tx(c.h) + '</div>'; }).join('')
    + '</div>';
}

function rgTr(e) {
  var end = e.ending === 'closed'
      ? '<span style="color:var(--grey)">' + esc(rgEnding(e.disposition)) + '</span>'
    : e.ending === 'closed_by_order'
      ? '<span style="color:var(--warn-2)">' + tx('with the order') + '</span>'
    : '<button class="rg-act" data-testid="raida-close" onclick="rgCloseAsk(&quot;' + e.raida_id + '&quot;)">'
      + tx('End →') + '</button>';
  var resid = (e.residual_likelihood && e.residual_severity)
    ? rgCell(e.residual_likelihood, e.residual_severity, e.residual_likelihood * e.residual_severity)
    : '<span style="color:var(--grey)">—</span>';
  var dash = '<span style="color:var(--grey)">—</span>';
  var d = function (v) { return v ? esc(String(v).slice(0, 10)) : ''; };
  return '<div class="lrow rg-row' + (e.open ? '' : ' rg-shut') + '" data-testid="raida-item"'
    + ' data-rid="' + e.raida_id + '" style="grid-template-columns:' + rgTpl() + '">'
    + '<div class="rg-id" title="' + esc(e.raida_id) + '">' + esc(String(e.raida_id).slice(0, 6)) + '</div>'
    + '<div><span class="mtype ' + e.kind + '">' + rgIcon(e.kind) + ' ' + esc(rgLabel(e.kind)) + '</span></div>'
    + '<div class="rg-what">' + esc(e.body) + '</div>'
    + '<div class="rg-clip">' + esc(e.subject || '') + '</div>'
    + '<div class="rg-clip">' + rgLinkTo(e) + '</div>'
    + '<div class="rg-clip">' + esc(e.owner || e.by || '') + '</div>'
    + '<div class="rg-num">' + rgCell(e.likelihood, e.severity, e.score) + '</div>'
    + '<div class="rg-what">' + (e.treatment ? esc(e.treatment) : dash) + '</div>'
    + '<div class="rg-clip">' + (e.verification_method ? esc(e.verification_method) : dash) + '</div>'
    + '<div class="rg-num">' + resid + '</div>'
    + '<div class="rg-dt">' + d(e.due_date) + '</div>'
    + '<div class="rg-dt">' + d(e.review_date) + '</div>'
    + '<div class="rg-dt">' + d(e.at) + '</div>'
    + '<div>' + end + '</div>'
    + '</div>';
}

function rgTable(es) {
  return '<div class="rg-wrap" data-testid="register-table">'
    + '<div class="rg-grid">' + rgHead() + es.map(rgTr).join('') + '</div></div>';
}

/**
 * ⚠️ ONLY WHAT THE STANDARD LIST DOES NOT ALREADY GIVE. `.lhead` and `.lrow` carry the header, the type scale,
 * the borders, the hover and the spacing; everything below is either the scroll frame they sit in or one of the
 * three deliberate departures. Restating what they already do is how two lists start to disagree.
 *
 * The styles travel with the capability because it is lazily loaded — putting them in the shell would ship a
 * register's worth of CSS to everyone who never opens one.
 */
function rgCss() {
  return '<style>'
    /* the scroll frame — a register is wider than any pane, and the page must never scroll sideways with it */
    + '.rg-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:8px}'
    + '.rg-grid{min-width:1520px}'
    + '.rg-wrap .lhead,.rg-wrap .lrow{display:grid;align-items:start}'
    /* ⚠️ departure 1 — a register row is READ, not opened. The chit inside it is the link. */
    + '.rg-row{cursor:default}'
    /* ⚠️ departure 2 — the description and the treatment wrap; everything else stays on one line so it scans */
    + '.rg-what{white-space:normal;overflow-wrap:anywhere;line-height:1.4}'
    + '.rg-clip{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    /* ⚠️ departure 3 — figures line up. Scores and dates are compared down the column, not read as words. */
    + '.rg-num,.rg-dt{font-variant-numeric:tabular-nums}'
    + '.rg-dt{color:var(--grey)}'
    + '.rg-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--grey);font-size:var(--fs-1)}'
    + '.rg-shut{opacity:.55}'
    + '.rg-link{color:var(--blue-2);text-decoration:none}'
    + '.rg-link:hover{text-decoration:underline}'
    + '.rg-act{background:none;border:1px solid var(--line);border-radius:7px;padding:2px 8px;cursor:pointer;'
    + 'color:var(--blue-2);font-size:var(--fs-1)}'
    + '.rg-act:hover{border-color:var(--blue-2)}'
    /* the heat map — its own small object, sized to sit beside the counts rather than compete with them */
    + '.rg-heat{display:inline-block;margin:8px 14px 4px 0;vertical-align:top}'
    + '.rg-heatt{border-collapse:collapse}'
    + '.rg-heatt caption{caption-side:top;text-align:start;font-size:var(--fs-1);color:var(--grey);'
    + 'padding-bottom:4px;white-space:nowrap}'
    + '.rg-hc{width:26px;height:22px;text-align:center;border:1px solid var(--line);'
    + 'font-size:var(--fs-1);font-variant-numeric:tabular-nums}'
    + '.rg-hh{width:22px;text-align:center;color:var(--grey);font-weight:600;font-size:var(--fs-1)}'
    + '.rg-hax{font-size:var(--fs-1);color:var(--grey);text-align:end;padding-top:2px}'
    + '.rg-editrow{padding:8px 12px;border-bottom:1px solid var(--line);background:var(--paper)}'
    + '</style>';
}

function rgLive() {
  var es = rgScoped();
  var open = es.filter(function (e) { return e.open; });
  var shut = es.filter(function (e) { return !e.open; });
  /* ⭐ Worst first. Sorted by date, a register buries the thing that should be read first under whatever was
     typed most recently. Unrated entries sort last rather than as zero — an unassessed risk is not a low one. */
  open.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });

  return rgCss()
    + rgRegisterRail()
    + (RG.report.full ? rgAddBar() : '')
    + (es.length
        ? rgHeat(open)
          + (open.length ? rgBand(tx('Open'), open.length) + rgTable(open) : '')
          /* ⚠️ Closed entries stay, greyed — a register that hides what it settled cannot show it settled
             anything, and "what did we decide about that" is most of why anyone opens an old one. */
          + (shut.length ? rgBand(tx('Closed'), shut.length) + rgTable(shut) : '')
        : '<div class="msgempty">' + tx('Nothing recorded yet — which is usually the right answer.') + '</div>');
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
    + '<select id="rgKind" class="inp" data-testid="raida-kind" onchange="rgKindChanged()" style="width:100%;margin-bottom:6px">' + kinds + '</select>'
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
    + rgEdgeFields()
    + '<div style="display:flex;gap:6px">'
    + '<button class="btn" data-testid="raida-save" style="flex:1" onclick="rgSave()">' + tx('Record it') + '</button>'
    + '<button class="btn ghost" style="flex:1" onclick="rgAdd(false)">' + tx('Cancel') + '</button>'
    + '</div></div>';
}

/**
 * ⭐⭐ THE FIELDS THAT MAKE A DEPENDENCY AN EDGE — and without them the Impact view can never populate.
 *
 * ⚠️ THIS WAS THE HOLE. The register could record "we are waiting on the crane" all day, but nothing in the UI
 * ever set `to_id`, so every dependency stayed a sentence and the graph — the thing this capability exists to
 * produce — had no data by construction. It looked finished because the empty state was honest.
 *
 * ⚠️ SHOWN ONLY FOR A DEPENDENCY. The other five kinds do not point, and offering a target on a Decision would
 * invite an edge the walk would never traverse.
 */
function rgEdgeFields() {
  var subs = (RG.subjects || []).filter(function (s) { return s.subject_id !== RG.sel && !s.closed_at; });
  var rels = [['finish_to_start', tx('starts after')], ['start_to_start', tx('starts with')],
              ['finish_to_finish', tx('finishes with')], ['start_to_finish', tx('finishes after')]];
  return '<div id="rgEdge" style="display:none;border-top:1px dashed var(--line);margin-top:6px;padding-top:6px">'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:4px">'
    + tx('What does it wait on? Leave blank and it stays a note, not a link.') + '</div>'
    + '<select id="rgTo" class="inp" data-testid="raida-to" style="width:100%;margin-bottom:6px">'
    + '<option value="">' + esc(tx('— nothing named —')) + '</option>'
    + subs.map(function (s) {
        return '<option value="' + s.subject_id + '|' + s.type_key + '|' + esc(s.name) + '">'
          + esc(s.name) + '</option>';
      }).join('')
    + '</select>'
    + '<div style="display:flex;gap:6px">'
    + '<select id="rgRel" class="inp" style="flex:1">'
    + rels.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('')
    + '</select>'
    + '<input id="rgNeed" class="inp" type="date" style="flex:1" title="' + esc(tx('Needed by')) + '">'
    + '</div></div>';
}

/* Shown on 'dependency', hidden otherwise — one listener, set when the bar is painted. */
function rgKindChanged() {
  var el = document.getElementById('rgEdge');
  if (el) el.style.display = (rgVal('rgKind') === 'dependency') ? '' : 'none';
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
  /* ⭐ An edge only exists when a target is NAMED. Blank leaves it a note, which the Impact view then lists
     apart rather than pretending it can be walked. */
  if (p.kind === 'dependency') {
    var to = rgVal('rgTo');
    if (to) {
      var bits = to.split('|');
      p.to_id = bits[0]; p.to_type = bits[1]; p.to_label = bits.slice(2).join('|');
      p.rel_type = rgVal('rgRel') || 'finish_to_start';
      var nb = rgVal('rgNeed'); if (nb) p.needed_by = nb;
    }
  }
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
  /* ⚠️ The panel body, not the old .raidbody — that class went with the notification shell. */
  var body = document.querySelector('[data-testid="register-panel"]'); if (!body) return;
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

/**
 * ⚠️⚠️ ADDRESSED BY ID, NOT BY INDEX. An earlier version counted its way down the open entries and appended into
 * `rows[idx]` — which only ever worked because the open list happens to render before the closed one. A row
 * knows its own id; ask for it.
 *
 * ⚠️ AND IT IS A SIBLING, not a child. The row is a grid track: anything put inside it becomes a fourteenth
 * column and lands under one heading rather than across the row.
 */
function rgClosePaint(id) {
  var el = document.querySelector('[data-rid="' + id + '"]');
  if (!el) return;
  var moves = (RG.subjects || []).filter(function (s) { return s.subject_id !== RG.sel && !s.closed_at; });
  var opts = Object.keys(RAIDA_ENDINGS).map(function (k) {
    return '<option value="' + k + '">' + esc(RAIDA_ENDINGS[k].label) + ' — ' + esc(RAIDA_ENDINGS[k].hint) + '</option>';
  }).join('');
  var row = document.createElement('div');
  row.className = 'rg-editrow';
  row.innerHTML = ''
    + '<div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;padding:4px 0">'
    + '<select id="rgDisp" class="inp" data-testid="raida-disposition" onchange="rgDispChanged()"'
    + ' style="min-width:230px">' + opts + '</select>'
    /**
     * ⭐⭐ "CARRIED FORWARD" MUST NAME WHERE IT WENT, and the server refuses without it — *"we will deal with it
     * later" without a later is how a finding disappears while looking dispositioned*.
     */
    + '<select id="rgCarry" class="inp" data-testid="raida-carry" style="min-width:190px;display:none">'
    + '<option value="">' + esc(tx('— which register? —')) + '</option>'
    + moves.map(function (s) { return '<option value="' + s.subject_id + '">' + esc(s.name) + '</option>'; }).join('')
    + '</select>'
    + '<input id="rgNote" class="inp" data-testid="raida-close-note" style="flex:1;min-width:200px"'
    + ' placeholder="' + esc(tx('What happened? One line.')) + '">'
    + '<button class="btn" data-testid="raida-close-save"'
    + ' onclick="rgCloseSave(&quot;' + id + '&quot;)">' + tx('End it') + '</button>'
    + '<button class="btn ghost" onclick="rgCloseAsk(&quot;' + id + '&quot;)">' + tx('Cancel') + '</button>'
    + '</div>';
  el.parentNode.insertBefore(row, el.nextSibling);
}

/* Only "carried forward" needs somewhere to go. */
function rgDispChanged() {
  var el = document.getElementById('rgCarry');
  if (el) el.style.display = (rgVal('rgDisp') === 'carried_forward') ? '' : 'none';
}

async function rgCloseSave(id) {
  var disp = rgVal('rgDisp');
  if (!disp) { toast(tx('Say how it ended.')); return; }
  try {
    var payload = { disposition: disp, body: rgVal('rgNote') };
    if (disp === 'carried_forward') {
      var to = rgVal('rgCarry');
      if (!to) { toast(tx('Name the register it moves to.')); return; }
      payload.carried_to_subject_id = to;
    }
    await api('regEntryClose', { params: { rid: id }, body: payload });
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
    return '<div class="rg-body"><div class="msgempty">'
      + tx('Closure needs the full register (b185).') + '</div></div>';
  }
  if (!es.length) {
    return '<div class="rg-body">' + rgRegisterRail() + '<div class="msgempty">'
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
            + (e.chit_id ? ' style="cursor:pointer" onclick="closeModal();openChit(&quot;' + e.chit_id + '&quot;)"' : '')
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

  return '<div class="rg-body">'
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

/**
 * ⭐⭐ TOP-TO-BOTTOM, NOT LEFT-TO-RIGHT — because of the pane it lives in. A wide flow reads left-to-right, and
 * that is what this drew first: at 240px per column inside a ~300px panel it put the ONE box that carries the
 * answer off the right edge, every time. A layered stack in a narrow column reads downward.
 *
 * ⚠️ DEPTH IS THE INDENT, so a chain still reads as a chain rather than a flat list.
 */
/* The origin box. Names the register when one is selected — with the room the wide frame gives, "this" is a
   wasted label on the only box the reader already understands. */
function rgWalkLabel() {
  var n = RG.sel ? rgSubjectName(RG.sel) : null;
  if (!n) return tx("this");
  return n.length > 26 ? n.slice(0, 26) + "…" : n;
}
function rgGraph(hops) {
  var W = 300, PAD = 10, BOXH = 44, GAP = 30, INDENT = 14;
  var H = PAD * 2 + BOXH + hops.length * (BOXH + GAP);
  var parts = [];

  parts.push('<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - PAD * 2) + '" height="' + BOXH
    + '" rx="8" fill="none" stroke="currentColor" stroke-width="2"/>');
  parts.push('<text x="' + (PAD + 10) + '" y="' + (PAD + 27) + '" font-size="12" font-weight="700"'
    + ' fill="currentColor">' + esc(rgWalkLabel()) + '</text>');

  var y = PAD + BOXH;
  hops.forEach(function (h) {
    var x = PAD + Math.min(h.depth, 3) * INDENT;
    var sev = h.severity >= 4 ? 'var(--disp)' : 'currentColor';
    parts.push('<line x1="' + (x + 14) + '" y1="' + y + '" x2="' + (x + 14) + '" y2="' + (y + GAP)
      + '" stroke="currentColor" stroke-width="1.5" opacity=".55" marker-end="url(#rgarrow)"/>');
    parts.push('<text x="' + (x + 24) + '" y="' + (y + GAP - 10) + '" font-size="10" fill="currentColor"'
      + ' opacity=".7">' + esc(String(h.rel_type || '').replace(/_/g, ' ')) + '</text>');
    y += GAP;
    parts.push('<rect x="' + x + '" y="' + y + '" width="' + (W - x - PAD) + '" height="' + BOXH
      + '" rx="8" fill="none" stroke="' + sev + '" stroke-width="1.5"/>');
    var lab = String(h.to_label || h.body || '');
    parts.push('<text x="' + (x + 10) + '" y="' + (y + 19) + '" font-size="11" fill="currentColor">'
      + esc(lab.length > 30 ? lab.slice(0, 30) + '…' : lab) + '</text>');
    var sub = (h.owner || '') + (h.needed_by ? ' · ' + String(h.needed_by).slice(0, 10) : '');
    if (sub) {
      parts.push('<text x="' + (x + 10) + '" y="' + (y + 34) + '" font-size="10" fill="currentColor"'
        + ' opacity=".65">' + esc(sub) + '</text>');
    }
    y += BOXH;
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" style="width:' + W + 'px;max-width:100%;height:auto;'
    + 'color:var(--on-card)" aria-label="' + esc(tx('Impact walk')) + '">'
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
    return '<div class="rg-body"><div class="msgempty">'
      + tx('The impact walk needs the full register (b185).') + '</div></div>';
  }
  var es = rgScoped();
  var edges = es.filter(function (e) { return e.edge; });
  var dangling = es.filter(function (e) { return e.kind === 'dependency' && !e.edge; });

  if (!edges.length) {
    return '<div class="rg-body">' + rgRegisterRail()
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

  return '<div class="rg-body">'
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
          + (hops.length === 1 ? tx('1 hop') : txf('{n} hops', { n: hops.length }))
            + ' · ' + txf('{d} deep', { d: (RG.walk && RG.walk.depth_reached) || 0 })
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
