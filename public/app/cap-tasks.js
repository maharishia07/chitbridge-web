/**
 * cap-tasks.js — TO1-UI: TASKS & ORDERS AS A STANDALONE APP (tasks.html; tasks.html?embed=1 is the same screen as a frame).
 * Owner decision 2026-10-10: Tasks & Orders is its own app, the API fully apart from the screen. Every request kind is a chit with lines;
 * the workflow (states, transitions), task-level and LINE-level assignment and per-line settings are the SERVER's answers — this file paints them.
 *
 * ONE list (CBList) — one line per order or task: what · where it stands · who has it · amount · age · lines; filters by kind · state · who;
 * the folders (Orders in · Orders out · Tasks · Done) are the engine's tabs (CBWorkflow.tabs, engines `workflow`) and the page's sidebar sections.
 * ONE sheet per row — the header, the next steps, the lines with their own state and assignee, the thread. Which steps are open is the SERVER's
 * answer (GET /api/work/:id → actions.<step> { ok, why, say }, per this login): a refused step is drawn greyed WITH its sentence; the writing
 * route refuses the same way (lib/workflow over lib/rail, both sides). This file decides nothing about who may do what.
 *
 * REUSE (named in the PR): CBList (list-ctl.js) · CBAction (accounts-shell.js, M64: one press one write · ask before an irreversible one · say
 * the outcome) · CBThread (rail-thread.js: the ONE composer + list for a chit's messages) · bkMoney (cap-books.js, M36: minor units → the
 * shop's figure, never arithmetic here) · api()/EP (core.js: the endpoint registry the round-trip budget reads) · CBWorkflow (app/workflow.js,
 * adopted: tabs · stages words) · CBEmbed's handshake (embed-host.js) · the routes that already do the work, none new:
 *   PUT  /api/chits/:id/status        (CB_SHEET_EP.status)  — moveStatus, the ONE status writer; a step = CBWorkflow.STEP_TO[action]
 *   POST /api/chits/:id/assign-lines  (CB_SHEET_EP.wlAssign)  — who holds a LINE and its state open · done (lib/assign, b143 + b153)
 *   POST /api/chits/:id/deliver-lines (CB_SHEET_EP.wlDeliver) — what has gone out on a line (lib/deliverline, b144); ONE name per endpoint
 *                                                               (e2e/ep-aliases.cjs): the worklist's rows, read here, never a third name
 *   PUT  /api/actors/assign/:id       (assign, as app.html) — who holds the whole task: push <person> · return
 *   GET  /api/work/list · /api/work/:id · GET /api/people  — the rows, the sheet, the people to pick from
 * Flow steps (docs/process/flows.json): O2C step 3 · order (tkList, tkOpen) · O2C step 4 · delivery (tkMove, tkAssignLine, tkDeliver).
 *
 * NEW PATHS (rule 4): CBTasks (this screen: nothing drew the work rows, the lines' state + assignee and the server's verdicts together) ·
 *   ageWord (age_days → "Today" / "3 d": cap-crm-chits.js chitsAge reads the same field but lives inside the CRM's screen file and its globals).
 *
 * EMBED (?embed=1[&view=orders_in|orders_out|tasks|done]): the same screen with no frame, for a host page to open in a dialog (embed-host.js).
 * The page tells its host what happened — docs/design/tasks-orders/EMBED.md:
 *   window.parent.postMessage({ cb: 'tasks', event: 'open' | 'moved' | 'assigned' | 'close', chit_id, ... }, location.origin)
 *
 *   CBTasks.mount(el, { token, base, embed, view, onEnded }) → { reload, show(view) }
 */
(function (root) {
  'use strict';
  /* the registry rows this screen adds (the scanner tools/endpoint-usage.cjs reads this shape); status · chit · wlAssign · wlDeliver come from CB_SHEET_EP, messages · sendMsg from CB_THREAD_EP */
  var CB_WORK_EP = {
    workList:         { m: 'GET',  p: '/api/work/list',               ok: 'y' },   // ?view=&limit=
    workOne:          { m: 'GET',  p: '/api/work/:id',                ok: 'y' },
    assign:           { m: 'PUT',  p: '/api/actors/assign/:id',       ok: 'y' },   // { action: 'push', target_actor_id } · { action: 'return' }
    people:           { m: 'GET',  p: '/api/people',                  ok: 'y' },
  };
  root.CB_WORK_EP = CB_WORK_EP;

  var VIEWS = ['orders_in', 'orders_out', 'tasks', 'done'];   /* the views GET /api/work/list answers (drafts wait for the compose route) */
  var LIMIT = 100;                                            /* one read takes the first hundred rows of a folder (PAGE_MAX) */
  var K = { el: null, o: {}, view: 'orders_in', rows: [], counts: null, total: 0, truncated: false, list: null, people: null, open: null, thread: null };

  function T(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return root.document.getElementById(id); }
  function WF() { return root.CBWorkflow; }

  function ensureEP() {
    if (typeof EP === 'undefined' || !EP) return false;
    [root.CB_SHEET_EP, root.CB_THREAD_EP, CB_WORK_EP].forEach(function (set) { if (set) for (var k in set) if (!EP[k]) EP[k] = set[k]; });
    return true;
  }
  /** the one call: core.js api() (auth · the registry · a server refusal keeps its words and its status for CBAction.words) */
  function call(key, opts) { ensureEP(); return root.api(key, opts); }

  /** what a host page hears (embed only) */
  function tell(event, more) {
    if (!K.o.embed || !root.parent || root.parent === root) return;
    try { root.parent.postMessage(Object.assign({ cb: 'tasks', event: event }, more || {}), root.location.origin); } catch (_) {}
  }

  /* ── words ── */
  var KIND_WORD = { order_in: 'Order in', order_out: 'Order out', task: 'Task' };
  var STEP_LABEL = { accept: { order: 'Accept', task: 'Start' }, reject: { order: 'Reject', task: 'Reject' }, complete: { order: 'Complete', task: 'Done' }, cancel: { order: 'Cancel', task: 'Cancel' }, reopen: { order: 'Reopen', task: 'Reopen' } };
  var STEP_SAID = { accept: 'Accepted.', reject: 'Rejected.', complete: 'Completed.', cancel: 'Cancelled.', reopen: 'Reopened.' };
  var STEPS = ['accept', 'reject', 'complete', 'cancel', 'reopen'];
  function stepLabel(a, r) { return T(STEP_LABEL[a][r.kind === 'task' ? 'task' : 'order']); }
  function ageWord(d) { d = Math.floor(Number(d) || 0); return d <= 0 ? T('Today') : d + ' ' + T('d'); }
  function money(minor, cur) {
    if (minor == null) return '';
    try { return root.bkMoney(minor, cur || 'INR'); } catch (_) { return String(minor); }
  }
  function toneOf(r) { return r.stage === 'new' ? 'amber' : r.stage === 'closed' ? '' : 'green'; }
  function wordTag(r) { return '<span class="tag ' + toneOf(r) + '" data-testid="tk-word-' + esc(r.chit_id) + '">' + esc(T(r.word || '')) + '</span>'; }
  function whoWord(r) {
    if (r.lines_assigned_n) return r.lines_assigned_n + ' ' + T(r.lines_assigned_n === 1 ? 'line held' : 'lines held');
    return r.assignee && r.assignee.name ? r.assignee.name : T('No one');
  }
  function linesWord(r) {
    if (r.lines_n == null) return '';
    if (!r.lines_n) return T('No lines');
    return r.lines_open_n ? r.lines_open_n + ' ' + T('of') + ' ' + r.lines_n + ' ' + T('open') : r.lines_n + ' ' + T('delivered');
  }
  function sayOf(v) { return v ? (v.say || v.why || '') : ''; }
  function byId(id) { return K.rows.filter(function (r) { return r.chit_id === id; })[0] || null; }

  /* ── the read ── */
  function load() {
    return call('workList', { query: { view: K.view, limit: LIMIT } }).then(function (j) {
      j = j || {};
      K.rows = Array.isArray(j.rows) ? j.rows : []; K.counts = j.counts || null; K.total = j.total == null ? K.rows.length : j.total; K.truncated = !!j.truncated;
      return j;
    });
  }
  function reload() { return load().then(function () { paintBar(); mountList($('tk_list')); }, function (e) { paintFail(e); }); }
  function paintFail(e) {
    if (!K.el) return;
    var refused = e && e.status === 403;
    K.el.innerHTML = '<div class="empty" data-testid="tk-fail"><div class="t">' + esc(T(refused ? 'This sign-in cannot open this' : "Couldn't read your orders")) + '</div>'
      + '<button type="button" class="act" id="tk_retry" data-testid="tk-retry">' + esc(T('Try again')) + '</button></div>';
    $('tk_retry').onclick = function () { start(); };
  }

  /* ── an action drawn the one way: shown always; greyed with the server's sentence when it may not (as cap-employees) ── */
  function actRow(id, label, may, extra, cls) {
    var ok = !may || may.ok !== false;
    return '<div class="tk-act' + (ok ? '' : ' no') + '">'
      + '<button type="button" class="act ' + (cls || 'quiet') + '" id="' + id + '" data-testid="' + id + '"' + (ok ? '' : ' aria-disabled="true" disabled') + ' title="' + esc(ok ? label : sayOf(may)) + '">' + esc(label) + '</button>'
      + (ok ? (extra || '') : '<span class="why" data-testid="' + id + '-why">' + esc(sayOf(may)) + '</span>') + '</div>';
  }

  /* ── the list (O2C step 3 · order: the rows the seller works) ── */
  function tkList() { return K.rows; }
  function cols() {
    return [
      { key: 'what', label: T('What'), prio: 1, w: 260, sort: 'what', html: true, value: function (r) { return r.subject || ''; },
        cell: function (r) { return '<b>' + esc(r.subject || T('Untitled')) + '</b>' + (r.party ? ' <span class="sub">' + esc(r.party) + '</span>' : ''); } },
      { key: 'word', label: T('Where it is'), prio: 2, w: 140, sort: 'word', hfilter: 'state', html: true, cell: wordTag, value: function (r) { return r.word || ''; } },
      { key: 'who', label: T('Who has it'), prio: 3, w: 150, sort: 'who', hfilter: 'assignee', cell: whoWord, value: whoWord },
      { key: 'amount', label: T('Amount'), prio: 4, w: 130, num: true, sort: 'amount', cell: function (r) { return money(r.total_minor, r.currency); }, value: function (r) { return Number(r.total_minor) || 0; } },
      { key: 'age', label: T('Age'), prio: 5, w: 90, sort: 'age', cell: function (r) { return ageWord(r.age_days); }, value: function (r) { return Number(r.age_days) || 0; } },
      { key: 'lines', label: T('Lines'), prio: 6, w: 130, cell: linesWord },
      { key: 'kind', label: T('Kind'), prio: 7, w: 110, hfilter: 'kind', cell: function (r) { return T(KIND_WORD[r.kind] || r.kind); } },
      { key: 'channel', label: T('From'), prio: 8, w: 110, cell: function (r) { return r.channel ? T(r.channel) : ''; } }
    ];
  }
  function mountList(host) {
    if (!host) return;
    if (K.list) { try { K.list.destroy(); } catch (_) {} }
    var names = [];
    K.rows.forEach(function (r) { var n = r.assignee && r.assignee.name; if (n && names.indexOf(n) < 0) names.push(n); });
    var stages = (WF() ? WF().STAGES : ['new', 'accepted', 'delivered', 'closed']).filter(function (s) { return K.rows.some(function (r) { return r.stage === s; }); });
    var stageLabel = { new: 'New', accepted: 'Accepted', delivered: 'Delivered', closed: 'Closed' };
    var kinds = Object.keys(KIND_WORD).filter(function (k) { return K.rows.some(function (r) { return r.kind === k; }); });
    K.list = root.CBList.mount(host, {
      key: 'tasks-' + K.view, t: T, rows: tkList, id: function (r) { return r.chit_id; }, rowTid: function (r) { return 'tk-row-' + r.chit_id; },
      columns: cols(), defaultCols: ['what', 'word', 'who'],
      filters: [
        { key: 'kind', label: T('Kind'), all: T('Any kind'), options: kinds.map(function (k) { return { v: k, label: T(KIND_WORD[k]) }; }), match: function (r, v) { return r.kind === v; } },
        { key: 'state', label: T('Where it is'), all: T('Anywhere'), options: stages.map(function (s) { return { v: s, label: T(stageLabel[s] || s) }; }), match: function (r, v) { return r.stage === v; } },
        { key: 'assignee', label: T('Who has it'), all: T('Anyone'), options: [{ v: 'none', label: T('No one') }].concat(names.map(function (n) { return { v: n, label: n }; })),
          match: function (r, v) { return v === 'none' ? !(r.assignee && r.assignee.name) && !r.lines_assigned_n : !!(r.assignee && r.assignee.name === v); } }
      ],
      search: function (r) { return [r.subject, r.party, r.ref, r.word, r.assignee && r.assignee.name, r.remark].join(' '); },
      sorts: [{ key: 'age', label: T('Newest first'), cmp: function (a, b) { return (Number(a.age_days) || 0) - (Number(b.age_days) || 0); } },
              { key: 'amount', label: T('Amount'), cmp: function (a, b) { return (Number(b.total_minor) || 0) - (Number(a.total_minor) || 0); } },
              { key: 'what', label: T('Name'), cmp: function (a, b) { return String(a.subject || '').localeCompare(String(b.subject || '')); } }],
      onOpen: function (r) { tkOpen(r.chit_id); },
      empty: { title: T(K.view === 'done' ? 'Nothing closed yet' : K.view === 'tasks' ? 'No tasks waiting' : 'No orders here') }
    });
  }

  function viewLabel(v) {
    var t = WF() ? WF().tabs().filter(function (x) { return x.id === v; })[0] : null;
    return T(t ? t.label : v);
  }
  function paintBar() {
    var b = $('tk_bar'); if (!b) return;
    var n = K.total, more = K.rows.length < n ? ' · ' + T('first') + ' ' + K.rows.length + ' ' + T('shown') : '';
    var count = K.truncated ? T('Too many to count') : '<b>' + n + '</b> ' + esc(T(n === 1 ? 'row' : 'rows')) + esc(more);
    var pick = '';
    if (K.o.embed) {
      pick = '<select class="inp tk-pick" id="tk_view" data-testid="tk-view" aria-label="' + esc(T('Folder')) + '">' + VIEWS.map(function (v) {
        var c = K.counts && K.counts[v] != null ? ' (' + K.counts[v] + ')' : '';
        return '<option value="' + v + '"' + (v === K.view ? ' selected' : '') + '>' + esc(viewLabel(v) + c) + '</option>';
      }).join('') + '</select>';
    }
    b.innerHTML = '<span class="tk-count" data-testid="tk-count">' + count + '</span>' + pick;
    var sel = $('tk_view'); if (sel) sel.onchange = function () { show(sel.value); };
    if (typeof K.o.onCounts === 'function') { try { K.o.onCounts(K.counts); } catch (_) {} }
  }

  /* ── the sheet: header · next steps · who has it · the lines · the thread ── */
  function sheet(html) {
    var d = $('tk_sheet'); if (!d) return;
    d.innerHTML = '<button type="button" class="mx" id="tk_x" aria-label="' + esc(T('Close')) + '" title="' + esc(T('Close')) + '">✕</button>' + html;
    if (!d.open) { try { d.showModal(); } catch (_) { d.setAttribute('open', ''); } }
    $('tk_x').onclick = closeSheet;
  }
  function closeSheet() {
    var d = $('tk_sheet'); if (!d) return;
    if (K.thread) { try { K.thread.destroy(); } catch (_) {} K.thread = null; }
    try { d.close(); } catch (_) { d.removeAttribute('open'); } d.innerHTML = ''; K.open = null;
  }
  /** a row → its sheet, read fresh (the lines, the verdicts); the list row stays the row */
  function tkOpen(id) {
    var r0 = byId(id);
    sheet('<h2 data-testid="tk-subject">' + esc((r0 && r0.subject) || T('Order')) + '</h2><div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div>');
    return call('workOne', { params: { id: id } }).then(function (c) {
      K.open = c; paintSheet(c); tell('open', { chit_id: c.chit_id, kind: c.kind, stage: c.stage, word: c.word });
    }, function (e) {
      sheet('<h2>' + esc((r0 && r0.subject) || T('Order')) + '</h2><div class="empty" data-testid="tk-sheet-fail"><div class="t">' + esc(T("Couldn't read this one")) + '</div>'
        + '<button type="button" class="act" id="tk_sheet_retry">' + esc(T('Try again')) + '</button></div>');
      $('tk_sheet_retry').onclick = function () { tkOpen(id); };
    });
  }
  function headLine(c) {
    var bits = [];
    if (c.party) bits.push(esc(c.party));
    if (c.total_minor != null) bits.push('<span class="mono">' + esc(money(c.total_minor, c.currency)) + '</span>');
    bits.push(esc(ageWord(c.age_days)));
    if (c.channel) bits.push(esc(T(c.channel)) + (c.fulfilment ? ' · ' + esc(T(c.fulfilment)) : ''));
    if (c.requested_for) bits.push(esc(T('for')) + ' ' + esc(c.requested_for));
    return bits.join(' · ');
  }
  function lineHTML(l, c) {
    var a = l.assignment || {}, st = (l.settings && l.settings.state) || 'open', done = st === 'done';
    var who = a.assignee_name || T('No one');
    var k = esc(l.line_id);
    return '<div class="tk-line' + (done ? ' done' : '') + '" data-testid="tk-line-' + k + '">'
      + '<div class="tk-line-top"><b>' + esc(l.particulars || T('Line')) + '</b> <span class="mono">' + esc(l.qty) + ' ' + esc(l.unit || '') + '</span>'
      + '<span class="tag ' + (done ? '' : l.remaining > 0 ? 'amber' : 'green') + '" data-testid="tk-line-state-' + k + '">' + esc(T(done ? 'Done' : l.remaining > 0 ? 'Open' : 'Delivered')) + '</span>'
      + '<span class="sub" data-testid="tk-line-who-' + k + '">' + esc(who) + '</span>'
      + (l.price_minor != null ? '<span class="sub mono">' + esc(money(l.price_minor, c.currency)) + '</span>' : '') + '</div>'
      + '<div class="tk-line-sub sub">' + esc(T('Delivered')) + ' ' + esc(l.delivered) + ' · ' + esc(T('left')) + ' ' + esc(l.remaining)
      + (l.settings && l.settings.due ? ' · ' + esc(T('due')) + ' ' + esc(l.settings.due) : '') + (l.settings && l.settings.task ? ' · ' + esc(l.settings.task) : '') + '</div>'
      + '<div class="tk-line-acts">'
      + actRow('tk_la_' + k, T('Assign'), l.actions && l.actions.assign_line)
      + actRow('tk_ld_' + k, T(done ? 'Reopen' : 'Done'), l.actions && l.actions.assign_line)
      + actRow('tk_lv_' + k, T('Deliver'), l.remaining > 0 ? (l.actions && l.actions.deliver_line) : { ok: false, say: T('Nothing left to deliver') })
      + '</div><div id="tk_lmore_' + k + '"></div></div>';
  }
  function paintSheet(c) {
    var acts = c.actions || {};
    var keep = $('tk_out') ? $('tk_out').textContent : '';
    var steps = STEPS.map(function (a) { return actRow('tk_do_' + a, stepLabel(a, c), acts[a], '', a === 'accept' || a === 'complete' ? '' : 'quiet'); }).join('');
    /* the whole task's holder (the list column prefers the lines' summary, b143's rule; the sheet shows both: the task's, then the lines held) */
    var who = ((c.assignee && c.assignee.name) || T('No one')) + (c.lines_assigned_n ? ' · ' + c.lines_assigned_n + ' ' + T(c.lines_assigned_n === 1 ? 'line held' : 'lines held') : '');
    sheet('<h2 data-testid="tk-subject">' + esc(c.subject || T('Order')) + '</h2>'
      + '<div class="tk-sub">' + wordTag(c) + ' <span class="sub" data-testid="tk-head">' + headLine(c) + '</span></div>'
      + (c.remark ? '<div class="sub" data-testid="tk-remark">' + esc(c.remark) + '</div>' : '')
      + '<div id="tk_out" class="tk-out" role="status" data-testid="tk-out">' + esc(keep) + '</div>'
      + '<div class="tk-block"><div class="tk-h">' + esc(T('Next step')) + '</div><div class="tk-steps" data-testid="tk-steps">' + steps + '</div><div id="tk_more"></div></div>'
      + '<div class="tk-block"><div class="tk-h">' + esc(T('Who has it')) + '</div>' + actRow('tk_assign', T('Assign'), acts.assign_task, '<span class="sub" data-testid="tk-who">' + esc(who) + '</span>') + '<div id="tk_amore"></div></div>'
      + '<div class="tk-block"><div class="tk-h">' + esc(T('Lines')) + '</div><div class="tk-lines" data-testid="tk-lines">' + ((c.lines || []).length ? c.lines.map(function (l) { return lineHTML(l, c); }).join('') : '<div class="sub">' + esc(T('No lines on this one')) + '</div>') + '</div></div>'
      + '<div class="tk-block"><div class="tk-h">' + esc(T('Messages')) + '</div><div id="tk_thread" data-testid="tk-thread"></div></div>');
    STEPS.forEach(function (a) { var b = $('tk_do_' + a); if (b && acts[a] && acts[a].ok !== false) b.onclick = function () { tkMove(c, a, b); }; });
    if (acts.assign_task && acts.assign_task.ok !== false) $('tk_assign').onclick = function () { assignPanel(c, null); };
    (c.lines || []).forEach(function (l) {
      var k = l.line_id, la = $('tk_la_' + k), ld = $('tk_ld_' + k), lv = $('tk_lv_' + k);
      if (la && !la.disabled) la.onclick = function () { assignPanel(c, l); };
      if (ld && !ld.disabled) ld.onclick = function () { tkAssignLine(c, l, { state: (l.settings && l.settings.state) === 'done' ? 'open' : 'done' }, ld); };
      if (lv && !lv.disabled) lv.onclick = function () { deliverPanel(c, l); };
    });
    mountThread(c);
  }
  function mountThread(c) {
    var el = $('tk_thread'); if (!el || !root.CBThread) return;
    if (K.thread) { try { K.thread.destroy(); } catch (_) {} }
    K.thread = root.CBThread.mount(el, { chit_id: c.chit_id, party: c.party || undefined, kinds: ['info'], context: { host: 'tasks' },
      lines: (c.lines || []).map(function (l) { return { line_id: l.line_id, label: l.particulars }; }) });
  }

  /** after a write: re-read the one row's sheet and the folder (a step may move it to Done), repaint, tell the host */
  function changed(id, event, more) {
    return call('workOne', { params: { id: id } }).then(function (c) {
      K.open = c;
      if ($('tk_sheet') && $('tk_sheet').open) paintSheet(c);
      tell(event, Object.assign({ chit_id: c.chit_id, kind: c.kind, stage: c.stage, word: c.word, status: c.status }, more || {}));
      return load().then(function () { paintBar(); mountList($('tk_list')); });
    }, function () { return load().then(function () { paintBar(); mountList($('tk_list')); }); });
  }

  /* ── the writes (O2C step 4 · delivery: the seller's staff move the order and its lines) ── */
  /** a status step through the ONE status writer (PUT /chits/:id/status = moveStatus); the status is the engine's STEP_TO */
  function tkMove(c, action, btn) {
    var to = (WF() && WF().STEP_TO[action]) || { accept: 'accepted', reject: 'rejected', complete: 'completed', cancel: 'cancelled', reopen: 'in_progress' }[action];
    var needs = (c.actions && c.actions[action] && c.actions[action].needs) || [];
    var run = function (note) { return call('status', { params: { id: c.chit_id }, body: Object.assign({ status: to }, note ? { note: note } : {}) }); };
    var opts = { key: 'tk-' + action + '-' + c.chit_id, failed: T("That step didn't go through"), out: 'tk_out',
      outcome: function () { $('tk_out').textContent = T(STEP_SAID[action]); changed(c.chit_id, 'moved', { action: action }); } };
    if (needs.indexOf('reason') >= 0) {
      $('tk_more').innerHTML = '<div class="tk-panel"><label class="sub" for="tk_reason">' + esc(T(action === 'reject' ? 'Why is it refused?' : 'Lines are still open — why close it?')) + '</label>'
        + '<input class="inp" id="tk_reason" data-testid="tk-reason" maxlength="500" autocomplete="off">'
        + '<button type="button" class="act" id="tk_reason_go" data-testid="tk-reason-go">' + esc(stepLabel(action, c)) + '</button></div>';
      $('tk_reason').focus();
      $('tk_reason_go').onclick = function () {
        var why = $('tk_reason').value.trim();
        if (!why) { $('tk_out').textContent = T('Type the reason first.'); return; }
        root.CBAction.run($('tk_reason_go'), function () { return run(why); }, opts);
      };
      return;
    }
    if (action === 'cancel') {
      return root.CBAction.run(btn, function () { return run(''); }, Object.assign({ confirm: { title: T('Cancel this?'), body: esc(c.subject || '') + ' ' + esc(T('stops here. The other party is told.')), yes: T('Cancel it'), danger: true } }, opts));
    }
    return root.CBAction.run(btn, function () { return run(''); }, opts);
  }

  function loadPeople() {
    if (K.people) return Promise.resolve(K.people);
    return call('people').then(function (j) { K.people = ((j && j.people) || []).filter(function (p) { return p.state !== 'off'; }); return K.people; }, function () { K.people = []; return K.people; });
  }
  /** the picker, for the whole task (line null) or one line: the shop's people, "No one" to take it off someone */
  function assignPanel(c, line) {
    var host = line ? $('tk_lmore_' + line.line_id) : $('tk_amore'); if (!host) return;
    host.innerHTML = '<div class="tk-panel"><span class="sub">' + esc(T('Loading')) + '</span></div>';
    loadPeople().then(function (people) {
      var cur = line ? (line.assignment && line.assignment.assignee_actor_id) : (c.assignee && c.assignee.id);
      var opts = '<option value="">' + esc(T('No one')) + '</option>' + people.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
      var tid = line ? 'tk-line-pick' : 'tk-pick';
      host.innerHTML = '<div class="tk-panel"><label class="sub" for="tk_who_sel">' + esc(T('Who does this?')) + '</label>'
        + '<select id="tk_who_sel" class="inp" data-testid="' + tid + '">' + opts + '</select>'
        + '<button type="button" class="act" id="tk_who_go" data-testid="' + tid + '-go">' + esc(T('Save')) + '</button></div>';
      $('tk_who_go').onclick = function () {
        var v = $('tk_who_sel').value || null, p = people.filter(function (x) { return x.id === v; })[0] || null;
        if (line) return tkAssignLine(c, line, { who: v, name: p ? p.name : null }, $('tk_who_go'));
        return tkAssignTask(c, v, p ? p.name : null, $('tk_who_go'));
      };
    });
  }
  /** who holds the whole task: PUT /actors/assign/:id push · return (the route app.html's Assign uses) */
  function tkAssignTask(c, who, name, btn) {
    return root.CBAction.run(btn, function () { return call('assign', { params: { id: c.chit_id }, body: who ? { action: 'push', target_actor_id: who } : { action: 'return' } }); },
      { key: 'tk-assign-' + c.chit_id, failed: T("Couldn't assign it"), out: 'tk_out',
        outcome: function () { $('tk_out').textContent = who ? T('Assigned to') + ' ' + (name || '') + '.' : T('Taken off.'); changed(c.chit_id, 'assigned', { line_id: null, assignee: who ? { id: who, name: name } : null }); } });
  }
  /** a LINE's holder or state: ONE append on chit_line_assignment (lib/assign — reassign, re-date and mark done ride the same row) */
  function tkAssignLine(c, l, x, btn) {
    var a = l.assignment || {}, st = (l.settings && l.settings.state) || 'open';
    var who = 'who' in x ? x.who : (a.assignee_actor_id || null), name = 'who' in x ? x.name : (a.assignee_name || null), state = x.state || st;
    var edit = { line_id: l.line_id, assignee_actor_id: who, assignee_name: name, assignee_type: who ? 'human' : null, state: state };
    var said = x.state ? T(x.state === 'done' ? 'Line done.' : 'Line reopened.') : (who ? T('Line given to') + ' ' + (name || '') + '.' : T('Line taken off.'));
    return root.CBAction.run(btn, function () { return call('wlAssign', { params: { id: c.chit_id }, body: { edits: [edit] } }); },
      { key: 'tk-line-' + l.line_id + '-' + (x.state || 'who'), failed: T("Couldn't save the line"), out: 'tk_out',
        outcome: function () { $('tk_out').textContent = said; changed(c.chit_id, x.state ? 'moved' : 'assigned', { line_id: l.line_id, state: state, assignee: who ? { id: who, name: name } : null }); } });
  }
  function deliverPanel(c, l) {
    var host = $('tk_lmore_' + l.line_id); if (!host) return;
    host.innerHTML = '<div class="tk-panel"><label class="sub" for="tk_dq">' + esc(T('How much went out?')) + ' <span class="mono">' + esc(l.unit || '') + '</span></label>'
      + '<input class="inp mono" id="tk_dq" data-testid="tk-deliver-qty" inputmode="decimal" value="' + esc(l.remaining) + '" autocomplete="off">'
      + '<button type="button" class="act" id="tk_dq_go" data-testid="tk-deliver-go">' + esc(T('Record')) + '</button></div>';
    $('tk_dq').focus();
    $('tk_dq_go').onclick = function () {
      var q = parseFloat(String($('tk_dq').value).replace(/[^0-9.\-]/g, ''));
      if (!isFinite(q) || q === 0) { $('tk_out').textContent = T('Type a quantity first.'); return; }
      tkDeliver(c, l, q, $('tk_dq_go'));
    };
  }
  /** what went out on a line: POST /chits/:id/deliver-lines (lib/deliverline — events, never a stored total) */
  function tkDeliver(c, l, qty, btn) {
    return root.CBAction.run(btn, function () { return call('wlDeliver', { params: { id: c.chit_id }, body: { rows: [{ line_id: l.line_id, quantity: qty, unit: l.unit || undefined }] } }); },
      { key: 'tk-deliver-' + l.line_id, failed: T("Couldn't record it"), out: 'tk_out',
        outcome: function () { $('tk_out').textContent = T('Recorded') + ' ' + qty + ' ' + (l.unit || '') + '.'; changed(c.chit_id, 'moved', { line_id: l.line_id, delivered: qty }); } });
  }

  /* ── the screen ── */
  function show(view) {
    if (VIEWS.indexOf(view) < 0) view = 'orders_in';
    K.view = view;
    closeSheet();
    if (typeof K.o.onView === 'function') { try { K.o.onView(view); } catch (_) {} }
    return reload();
  }
  function start() {
    K.el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div>';
    return load().then(function () {
      K.el.innerHTML = '<div class="tk-top" id="tk_bar" data-testid="tk-bar"></div><div class="tk-list" id="tk_list" data-testid="tk-list"></div><dialog class="sheet tk-sheet" id="tk_sheet" data-testid="tk-sheet"></dialog>';
      var d = $('tk_sheet');
      d.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });
      d.addEventListener('click', function (e) { if (e.target === d) closeSheet(); });
      paintBar(); mountList($('tk_list'));
      /* a host may name the row to open (?open=<chit_id>): the sheet, over the list */
      if (K.o.open) { var id = K.o.open; K.o.open = null; tkOpen(id); }
    }, function (e) { paintFail(e); });
  }
  function mount(el, o) {
    K.el = el; K.o = o || {};
    if (VIEWS.indexOf(K.o.view) >= 0) K.view = K.o.view;
    ensureEP();
    start();
    return { reload: reload, show: show, open: tkOpen, close: closeSheet };
  }
  root.CBTasks = { mount: mount, VIEWS: VIEWS, EP: CB_WORK_EP };
})(typeof window !== 'undefined' ? window : globalThis);
