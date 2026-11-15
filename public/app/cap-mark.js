/**
 * cap-mark.js — CAP-25 / ACC-358: the MARK & QUERY capability's two library components. A reviewer puts a mark on a record somebody else owns;
 * the owner and the adviser see it at once; a Query is a conversation in the one message thread.
 *
 * OWNS      CMP058 the marker chip (Checked ✓ · Query ? · On hold ‖ · Changed after review ⚠) mounted on a row by `data-mark` · CMP059 the Query sheet (the question, the note box, the set buttons, the thread) ·
 *           the checked-n-of-m bar and the open-queries list with ageing · the one door to GET/POST /api/marks
 * CALLED BY books-grant-view.js (the auditor's and the adviser's books) · books-grant-drill.js (the entry sheet) · cap-books.js (the owner's Day book and ledger)
 * FLOW      use({ adopter, call }) → load(ids) ONE read for the page → chip(id) in each row → a press on a chip: Check = one write; a marked chip opens the sheet → set / reply → repaint every chip of that record
 * CARD      14-accounting/ACC-358-AUDIT-MARKERS-REQUIREMENT · capability/MARK-AND-QUERY-CAPABILITY §5.3
 *
 * ⭐ The server decides. Which marks exist, whether a record changed after its mark (`altered`), who may set (`actions.set`) and who may reply (`actions.reply`) with the sentence for a refusal
 * (`why`) all arrive in the answer; this file paints them and computes nothing. A Query is the question text in the mark's note; replies are CBThread (rail-thread.js, `subject` option): there is NO second composer here.
 * The core has no domain word: the adopter names the vocabulary, the host row names the record.
 *
 *   CBMark.use({ adopter, call?, transport?, title? }) → control
 *     call(key, { query, body })    the page's own api() (EP keys marksRead · marksSet), or
 *     transport(method, path, body) a host with its own headers (the auditor's books grant): the path is this file's own
 *   control.load(ids) → Promise · .chip(id) → html · .row(id) · .set(id, kind, note, button) · .sheet(id, { title }) · .summary() · .bar(host, { onFilter }) · .queries() · .onChange(fn)
 *   CBMark.paint(scope) repaints every `[data-mark]` host under scope from the control's rows.
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var CHUNK = 200; /* the server's cap on ids in one read */

  /* the marks' own two routes + the thread pair (rail-thread.js declares those): ONE name each (e2e/ep-aliases.cjs) */
  var EPS = {
    marksRead: { m: 'GET', p: '/api/marks' }, /* ?adopter= &ids=a,b  (a page) or ?adopter= &open=1 (the open list, with ageing and checked n of m) */
    marksSet: { m: 'POST', p: '/api/marks', idem: true } /* { adopter, subject_id, kind: checked|query|on_hold|removed, note } */
  };
  root.CB_MARK_EP = EPS;

  var CLASS = {
    clear: { sym: '✓', word: 'Checked', tone: 'ok' },
    open: { sym: '?', word: 'Query', tone: 'ask' },
    hold: { sym: '‖', word: 'On hold', tone: 'hold' },
    reject: { sym: '✕', word: 'Not accepted', tone: 'bad' }
  };
  var SEND = { clear: 'checked', open: 'query', hold: 'on_hold', removed: 'removed' }; /* the neutral class → the kind the server takes */
  var W = {
    check: 'Check',
    notChecked: 'Not checked',
    altered: 'Changed after review',
    recheck: 'Re-check needed',
    gone: 'Record not found',
    markChecked: 'Mark checked',
    askQuestion: 'Ask a question',
    putOnHold: 'Put on hold',
    takeOff: 'Take mark off',
    reasonLabel: 'Your question or reason',
    seenBy: 'The owner sees this.',
    needWords: 'Write your question first.',
    close: 'Close',
    saved: 'Saved.',
    failed: 'Not saved. Nothing was changed.',
    readFail: 'Could not read the marks. This does not mean there are none.',
    waiting: 'Waiting {n}',
    day1: '1 day',
    days: '{n} days',
    today: 'today',
    by: 'by {who}',
    changedNote: 'This entry changed after it was checked. Check it again.',
    questionHead: 'Question',
    threadHead: 'Replies',
    replyOff: 'Replies are closed.',
    checkedOf: 'Checked {n} of {m} entries this period',
    allQueries: 'All queries',
    allEntries: 'All entries',
    queryWord: 'Query',
    entryFallback: 'This entry',
    noQueries: 'No open queries.',
    openQueries: 'Open queries',
    everyone: 'Everyone who can see this record'
  };
  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function fill(s, v) {
    return String(T(s)).replace(/\{(\w+)\}/g, function (_, k) { return v[k] == null ? '' : v[k]; });
  }
  function when(ts) {
    if (!ts) return '';
    try {
      if (typeof root.shopDateTime === 'function') return root.shopDateTime(ts);
      if (root.CBLocale) return root.CBLocale.datetime(ts);
    } catch (_) { /* best effort: failing here changes nothing the user sees */ }
    return String(ts).replace('T', ' ').slice(0, 16);
  }

  /* ── look: theme tokens only, AA in light and dark (the same tokens rail-thread.js uses) ── */
  var CSS =
    '.mk{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line,#DDD6C6);border-radius:999px;background:var(--card,#fff);color:var(--ink,#1D1B16);font:inherit;font-size:var(--fs-1,12px);font-weight:700;padding:3px 10px;min-height:28px;cursor:pointer;white-space:nowrap;max-width:100%}' +
    '.mk:focus-visible{outline:2px solid var(--blue,#1f5fa8);outline-offset:2px}' +
    '.mk-s{font-size:var(--fs-2,14px);line-height:1}' +
    '.mk-ok{background:var(--ok-tint,#E6F3EA);border-color:var(--ok,#2E8B57);color:var(--ok-3,#0F5132)}' +
    '.mk-ask{background:var(--blue-tint-bg,#eef4fb);border-color:var(--blue,#1f5fa8);color:var(--blue,#1f5fa8)}' +
    '.mk-hold{background:var(--warn-tint,#FFF4D6);border-color:var(--warn,#B7791F);color:var(--warn-3,#7A4B00)}' +
    '.mk-bad{background:var(--danger-tint,#fbeeec);border-color:var(--disp,#8E3517);color:var(--disp,#8E3517)}' +
    '.mk-alt{background:var(--warn-tint,#FFF4D6);border-color:var(--warn,#B7791F);color:var(--warn-3,#7A4B00);border-style:dashed}' +
    '.mk-ghost{border-style:dashed;color:var(--grey,#5E594D);font-weight:600;background:transparent}' +
    '.mk-ghost:hover{border-color:var(--ok,#2E8B57);color:var(--ok-3,#0F5132)}' +
    '.mk-none{color:var(--grey,#5E594D)}' +
    '.mk-age{font-weight:600;opacity:.85}' +
    '.mk-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}' +
    '.mk-count{font-size:var(--fs-2,14px);font-weight:700;color:var(--ink,#1D1B16)}' +
    '.mk-meter{display:inline-block;width:90px;height:8px;border-radius:99px;background:var(--line,#DDD6C6);overflow:hidden;vertical-align:middle}' +
    '.mk-meter i{display:block;height:100%;background:var(--ok,#2E8B57)}' +
    '.mk-q{display:flex;flex-direction:column;gap:6px;margin:6px 0}' +
    '.mk-qi{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);padding:8px 10px;font:inherit;text-align:start;cursor:pointer;color:inherit;width:100%}' +
    '.mk-qi:focus-visible{outline:2px solid var(--blue,#1f5fa8)}' +
    '.mk-qi b{display:block;font-size:var(--fs-2,14px)}.mk-qi span.t{display:block;font-size:var(--fs-1,12px);color:var(--grey,#5E594D);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    'dialog.mk-sheet{border:1px solid var(--line,#DDD6C6);border-radius:14px;padding:0;width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);background:var(--card,#fff);color:var(--ink,#1D1B16);overflow:auto}' +
    'dialog.mk-sheet::backdrop{background:rgba(0,0,0,.4)}' +
    '.mk-in{padding:14px 16px;display:flex;flex-direction:column;gap:9px}' +
    '.mk-hd{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.mk-hd h2{margin:0;font-size:var(--fs-3,17px)}' +
    '.mk-x{border:0;background:transparent;font:inherit;font-size:20px;line-height:1;min-width:44px;min-height:44px;cursor:pointer;color:var(--grey,#5E594D)}' +
    '.mk-sub{font-size:var(--fs-1,12px);color:var(--grey,#5E594D)}' +
    '.mk-quote{border-inline-start:3px solid var(--blue,#1f5fa8);padding:6px 10px;background:var(--blue-tint-bg,#eef4fb);border-radius:0 8px 8px 0;white-space:pre-wrap;font-size:var(--fs-2,14px)}' +
    '.mk-warn{border:1px solid var(--warn,#B7791F);background:var(--warn-tint,#FFF4D6);color:var(--warn-3,#7A4B00);border-radius:8px;padding:7px 10px;font-size:var(--fs-2,14px);font-weight:700}' +
    '.mk-in textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#DDD6C6);border-radius:9px;padding:9px;font:inherit;font-size:var(--fs-2,14px);min-height:52px;resize:vertical;background:var(--card,#fff);color:inherit}' +
    '.mk-acts{display:flex;gap:8px;flex-wrap:wrap}' +
    '.mk-act{border:1px solid var(--line,#DDD6C6);border-radius:9px;background:var(--card,#fff);color:inherit;font:inherit;font-size:var(--fs-2,14px);font-weight:700;padding:8px 14px;min-height:44px;cursor:pointer}' +
    '.mk-act.ok{background:var(--ok-2,#16693F);border-color:var(--ok-2,#16693F);color:var(--on-accent,#fff)}.mk-act.ask{background:var(--blue,#1f5fa8);border-color:var(--blue,#1f5fa8);color:var(--on-accent,#fff)}' +
    '.mk-act[disabled],.mk-act[aria-disabled=true]{opacity:.55;cursor:not-allowed}' +
    '.mk-out{font-size:var(--fs-1,12px);min-height:1em}.mk-out[data-tone=error]{color:var(--disp,#8E3517);font-weight:700}.mk-out[data-tone=ok]{color:var(--ok-2,#16693F);font-weight:700}' +
    '.mk-why{font-size:var(--fs-1,12px);color:var(--grey,#5E594D)}' +
    '.mk-n{display:none}' +
    '@media (max-width:700px){.mk-ghost .mk-w{display:none}.mk-ghost .mk-n{display:inline}.mk{min-width:44px;min-height:44px;justify-content:center;padding:3px 8px}.mk-act{flex:1 1 40%}dialog.mk-sheet{margin:auto 0 0;width:100vw;max-width:100vw;border-radius:14px 14px 0 0}}';
  var cssDone = false;
  function addCss() {
    if (cssDone || !doc) return;
    cssDone = true;
    var node = doc.createElement('style');
    node.setAttribute('data-cbmark', '1');
    node.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(node);
  }

  var controls = []; /* every live control, so one repaint reaches every chip on the page */

  /* ── the one door to the server ── */
  function ensureEP() {
    if (typeof root.EP === 'undefined' || !root.EP) return false;
    for (var k in EPS) if (!root.EP[k]) root.EP[k] = EPS[k];
    return true;
  }
  function qs(query) {
    return Object.keys(query || {}).filter(function (n) { return query[n] !== '' && query[n] != null; }).map(function (n) { return encodeURIComponent(n) + '=' + encodeURIComponent(query[n]); }).join('&');
  }
  function ask(c, key, o) {
    o = o || {};
    if (c.cfg.transport) {
      var ep = EPS[key], q = qs(o.query);
      return c.cfg.transport(ep.m, ep.p + (q ? '?' + q : ''), o.body);
    }
    ensureEP();
    return (c.cfg.call || root.api)(key, o);
  }

  /** the row's class: the server's neutral class, else its kind word */
  function classOf(row) {
    var k = row && (row.class || row.kind || row.state);
    return CLASS[k] ? k : null;
  }
  function listOf(answer) {
    var l = answer && (answer.marks || answer.rows || answer.items || (Array.isArray(answer) ? answer : []));
    if (l && !Array.isArray(l)) l = Object.keys(l).map(function (id) { return Object.assign({ subject_id: id }, l[id]); });
    return l || [];
  }
  function idOf(row) {
    return String(row.subject_id != null ? row.subject_id : row.id);
  }

  function use(cfg) {
    addCss();
    var c = { cfg: cfg || {}, rows: {}, names: {}, may: null, on: false, sum: null, subs: [], failed: false };
    ensureEP();
    controls.push(c);
    var ctl = {
      /** ONE read for the whole page's ids (200 a call); then every chip repaints */
      load: function (ids) {
        var want = (ids || []).map(String).filter(function (id, n, all) { return id && all.indexOf(id) === n; }), parts = [];
        for (var i = 0; i < want.length; i += CHUNK) parts.push(want.slice(i, i + CHUNK));
        return Promise.all(parts.map(function (part) {
          return ask(c, 'marksRead', { query: { adopter: c.cfg.adopter, ids: part.join(',') } }).then(function (a) {
            c.failed = false;
            listOf(a).forEach(function (row) { c.rows[idOf(row)] = row; });
            if (a && a.actions) { c.may = a.actions; c.on = true; }
            part.forEach(function (id) { if (!c.rows[id]) c.rows[id] = null; }); /* null: read, and no mark */
          });
        })).then(function () { paint(root.document); }, function () { c.failed = true; paint(root.document); });
      },
      /** the books lists carry the mark on each row (no extra trip): take them in, with the root's `mark_actions` (absent = marking is not switched on: no chip is drawn) */
      ingest: function (list, answer, key) {
        if (!answer || !answer.mark_actions) { c.on = false; return; }
        c.on = true;
        c.may = answer.mark_actions;
        (list || []).forEach(function (e) {
          if (!e || e.entry_id == null) return;
          c.rows[String(e.entry_id)] = e.mark || null;
          var name = recordName(e, answer);
          if (name) c.names[String(e.entry_id)] = name;
        });
        paint(root.document);
      },
      row: function (id) { return c.rows[String(id)] || null; },
      /** the record in words ("JV-0002 · 12 Oct 2026 · A$880.00"), as the page last showed it; '' when the page never showed it */
      nameOf: function (id) { return c.names[String(id)] || ''; },
      mayCheck: function (id) {
        var r = c.rows[String(id)], a = (r && r.actions) || c.may || {};
        return !!(a.set && a.set.ok !== false && a.set.ok != null) || (a.set === true);
      },
      chip: function (id) {
        return '<span class="mk-host" data-mark=\'' + esc(JSON.stringify({ adopter: c.cfg.adopter, id: String(id) })) + '\'>' + chipHTML(c, String(id)) + '</span>';
      },
      /** the one write: Checked is one press; a Query needs its words, On hold takes a reason (the server says so too) */
      set: function (id, kind, note, button) {
        var body = { adopter: c.cfg.adopter, subject_id: String(id), kind: SEND[kind] || kind };
        if (note) body.note = note;
        var out = c.outEl || null;
        var run = root.CBAction && root.CBAction.run;
        var go = function () { return ask(c, 'marksSet', { body: body }); };
        var done = function (v) { merge(c, v, String(id)); paint(root.document); fire(c); return v; };
        if (!run) return go().then(done);
        return run(button || null, go, { key: 'mk:' + c.cfg.adopter + ':' + id, busy: T('Saving…'), out: out, done: T(W.saved), failed: T(W.failed), outcome: done });
      },
      /** the Query sheet for one record (CMP059) */
      sheet: function (id, o) { return openSheet(c, ctl, String(id), o || {}); },
      /** the open list + checked n of m, ONE read */
      summary: function () {
        var span = typeof c.cfg.period === 'function' ? c.cfg.period() : null; /* the period the screen shows: the count is of THAT period (the server's default is the current month) */
        return ask(c, 'marksRead', { query: Object.assign({ adopter: c.cfg.adopter, open: 1 }, span && span.from && span.to ? { from: span.from, to: span.to } : {}) }).then(function (a) {
          var list = (a && a.open) || [];
          c.sum = { open: list, checked: num(a && a.checked), total: num(a && a.of), why: null };
          if (a && a.actions) c.may = a.actions;
          return c.sum;
        }, function () { c.sum = null; return null; });
      },
      onChange: function (fn) { c.subs.push(fn); },
      state: function () { return { rows: c.rows, sum: c.sum, may: c.may, failed: c.failed }; },
      destroy: function () { controls = controls.filter(function (x) { return x !== c; }); }
    };
    c.ctl = ctl;
    return ctl;
  }
  /** the record's name for a sheet title: its number, its day (the shop's way) and its amount in its own currency; whatever the row does not carry is left out (never the record id) */
  function recordName(e, answer) {
    var no = e.entry_no || e.subject_label;
    if (!no) return '';
    var day = e.posting_date || e.date, minor = e.total_minor != null ? e.total_minor : e.amount_minor;
    if (minor == null) minor = Number(e.dr_minor) > 0 ? e.dr_minor : Number(e.cr_minor) > 0 ? e.cr_minor : null;
    var cur = e.currency || (answer && answer.currency) || '';
    var amount = '';
    if (minor != null && cur) amount = typeof root.fmtMoney === 'function' ? root.fmtMoney({ amount_minor: String(minor), currency: cur }) : String(minor) + ' ' + cur;
    return [no, day ? (typeof root.shopDay === 'function' ? root.shopDay(String(day).slice(0, 10)) : String(day).slice(0, 10)) : '', amount].filter(Boolean).join(' · ');
  }
  function num(n) { return n == null ? null : Number(n); }
  function fire(c) {
    c.subs.forEach(function (fn) { try { fn(); } catch (_) { /* best effort: failing here changes nothing the user sees */ } });
  }
  /** what a write answered becomes the row (the server's answer is the row; nothing is computed) */
  function merge(c, answer, id) {
    var list = listOf(answer && (answer.marks || answer.mark) ? { marks: [].concat(answer.marks || answer.mark) } : answer);
    if (!list.length && answer && classOf(answer)) list = [Object.assign({ subject_id: id }, answer)];
    if (!list.length) { c.rows[id] = undefined; return; }
    list.forEach(function (row) { c.rows[idOf(row)] = classOf(row) === 'removed' ? null : row; });
  }

  /* ── CMP058 the marker chip ── */
  function ageWords(n) {
    n = Number(n);
    if (!(n >= 0)) return '';
    return n < 1 ? T(W.today) : n === 1 ? T(W.day1) : fill(W.days, { n: n });
  }
  function chipHTML(c, id) {
    var r = c.rows[id];
    if (!c.on && !r) return '';
    if (r === undefined) return '<span class="mk-none" aria-hidden="true">…</span>';
    if (c.failed && !r) return '<span class="mk-none" role="img" aria-label="' + esc(T(W.readFail)) + '" title="' + esc(T(W.readFail)) + '">!</span>';
    var cls = classOf(r), alt = r && (r.altered || r.recheck_needed);
    if (!r || !cls) {
      if (!c.ctl.mayCheck(id)) return '<span class="mk-none" title="' + esc(T(W.notChecked)) + '">—</span>';
      return '<button type="button" class="mk mk-ghost" data-cbsid="CMP058-B01" data-mk="check" data-id="' + esc(id) + '" aria-label="' + esc(T(W.markChecked)) + '" title="' + esc(T(W.markChecked)) + '"><span class="mk-s" aria-hidden="true">○</span><span class="mk-w">' + esc(T(W.check)) + '</span><span class="mk-n">' + esc(T(W.notChecked)) + '</span></button>' +
        ' <button type="button" class="mk mk-ghost" data-cbsid="CMP058-B05" data-mk="ask" data-id="' + esc(id) + '" aria-label="' + esc(T(W.askQuestion)) + '" title="' + esc(T(W.askQuestion)) + '"><span class="mk-s" aria-hidden="true">?</span><span class="mk-n">' + esc(T(W.queryWord)) + '</span></button>';
    }
    var k = CLASS[cls], word = (r.label && !alt) ? r.label : T(k.word), tone = 'mk-' + k.tone, sym = k.sym;
    if (alt) { word = r.recheck_needed && !r.altered ? T(W.recheck) : T(W.altered); tone = 'mk-alt'; sym = '⚠'; }
    var age = (cls === 'open' || cls === 'hold') && r.age_days != null ? ' <span class="mk-age">· ' + esc(ageWords(r.age_days)) + '</span>' : '';
    return '<button type="button" class="mk ' + tone + '" data-cbsid="CMP058-B02" data-mk="open" data-id="' + esc(id) + '" data-class="' + esc(cls) + '"' + (alt ? ' data-altered="1"' : '') +
      ' aria-label="' + esc(word + (r.by_name ? ' ' + fill(W.by, { who: r.by_name }) : '')) + '" title="' + esc(word + (r.by_name ? ' ' + fill(W.by, { who: r.by_name }) : '')) + '"><span class="mk-s" aria-hidden="true">' + sym + '</span><span class="mk-w">' + esc(word) + age + '</span></button>';
  }
  /** repaint every host: a mark set in the sheet shows in the row behind it, in the drill and in the list, at once */
  function paint(scope) {
    var nodes = (scope || doc).querySelectorAll ? (scope || doc).querySelectorAll('[data-mark]') : [];
    Array.prototype.forEach.call(nodes, function (host) {
      var spec;
      try { spec = JSON.parse(host.getAttribute('data-mark')); } catch (_) { return; }
      for (var i = 0; i < controls.length; i++) {
        if (controls[i].cfg.adopter === spec.adopter) { host.innerHTML = chipHTML(controls[i], String(spec.id)); return; }
      }
    });
  }
  function controlOf(host) {
    var spec;
    try { spec = JSON.parse(host.getAttribute('data-mark')); } catch (_) { return null; }
    for (var i = 0; i < controls.length; i++) if (controls[i].cfg.adopter === spec.adopter) return controls[i];
    return null;
  }
  /* one delegated press for every chip (captured: a row's own open handler never sees it) */
  var wired = false;
  function wire() {
    if (wired || !doc) return;
    wired = true;
    function onPress(event) {
      var b = event.target.closest ? event.target.closest('button[data-mk]') : null;
      if (!b) return;
      var host = b.closest('[data-mark]'), c = host && controlOf(host);
      if (!c) return;
      event.stopPropagation();
      event.preventDefault();
      var id = b.getAttribute('data-id');
      if (b.getAttribute('data-mk') === 'check') c.ctl.set(id, 'clear', '', b);
      else c.ctl.sheet(id, { opener: b });
    }
    doc.addEventListener('click', onPress, true);
    doc.addEventListener('keydown', function (event) {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest && event.target.closest('button[data-mk]')) event.stopPropagation(); /* a chip's key is the chip's, not the row's */
    }, true);
  }

  /* ── the checked-n-of-m bar and the open-queries list ── */
  function barHTML(c, o) {
    var s = c.sum;
    if (!s) return '';
    var pct = s.total ? Math.round((100 * s.checked) / s.total) : 0;
    var n = (s.open || []).length;
    return '<div class="mk-bar" data-testid="mk-bar" role="group" aria-label="' + esc(T(W.openQueries)) + '">' +
      '<span class="mk-count" data-testid="mk-count">' + esc(fill(W.checkedOf, { n: s.checked, m: s.total })) + '</span>' +
      (s.total ? '<span class="mk-meter" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' : '') +
      '<button type="button" class="mk mk-ask" data-cbsid="CMP058-B03" data-mk-filter="1" aria-pressed="' + (o.on ? 'true' : 'false') + '" data-testid="mk-filter"><span class="mk-s" aria-hidden="true">?</span><span class="mk-w">' + esc(T(o.on ? W.allEntries : W.allQueries)) + ' · ' + n + '</span></button></div>';
  }
  function queryRows(c, titleOf) {
    var list = (c.sum && c.sum.open) || [];
    if (!list.length) return '<div class="mk-why" data-testid="mk-empty">' + esc(T(W.noQueries)) + '</div>';
    return '<div class="mk-q" data-testid="mk-queries">' + list.map(function (r) {
      var id = idOf(r), cls = classOf(r) || 'open', k = CLASS[cls];
      return '<button type="button" class="mk-qi" data-cbsid="CMP058-B04" data-mk-q="' + esc(id) + '" data-testid="mk-q-' + esc(id) + '"><span class="mk mk-' + k.tone + '" aria-hidden="true"><span class="mk-s">' + k.sym + '</span></span>' +
        '<span><b>' + esc((titleOf && titleOf(id, r)) || r.subject_label || id) + '</b><span class="t">' + esc(r.note || '') + '</span></span>' +
        '<span class="mk-age mk">' + esc(ageWords(r.age_days)) + '</span></button>';
    }).join('') + '</div>';
  }

  /* ── CMP059 the Query sheet ── */
  function openSheet(c, ctl, id, o) {
    addCss();
    var r = c.rows[id] || null, cls = classOf(r);
    var dlg = doc.createElement('dialog');
    dlg.className = 'mk-sheet';
    dlg.setAttribute('data-cbsid', 'CMP059-D01');
    dlg.setAttribute('data-pop', 'CMP059');
    dlg.setAttribute('data-testid', 'mk-sheet');
    dlg.setAttribute('aria-label', T(W.questionHead));
    var act = (r && r.actions) || c.may || {};
    var maySet = !!(act.set && act.set.ok !== false);
    var altered = r && (r.altered || r.recheck_needed);
    var word = cls ? (altered ? T(W.altered) : (r.label || T(CLASS[cls].word))) : T(W.notChecked);
    var thread = r && r.thread_id;
    var title = c.names[id] || o.title || (c.cfg.title && c.cfg.title(id)) || T(W.entryFallback);
    dlg.innerHTML =
      '<div class="mk-in"><div class="mk-hd"><div><h2 data-testid="mk-title">' + esc(title) + '</h2>' +
      '<div class="mk-sub" data-testid="mk-state">' + (cls ? '<span class="mk mk-' + (altered ? 'alt' : CLASS[cls].tone) + '" style="cursor:default"><span class="mk-s" aria-hidden="true">' + (altered ? '⚠' : CLASS[cls].sym) + '</span> ' + esc(word) + '</span> ' + (r.by_name ? esc(fill(W.by, { who: r.by_name })) : '') + ' ' + esc(when(r.at)) : esc(word)) + '</div></div>' +
      '<button type="button" class="mk-x" data-cbsid="CMP059-B01" data-mk-act="close" aria-label="' + esc(T(W.close)) + '">✕</button></div>' +
      (altered ? '<div class="mk-warn" data-testid="mk-altered">' + esc(T(W.changedNote)) + '</div>' : '') +
      (r && r.note ? '<div class="mk-quote" data-testid="mk-question">' + esc(r.note) + '</div>' : '') +
      (maySet
        ? '<label class="mk-sub" for="mk_note">' + esc(T(W.reasonLabel)) + ' · ' + esc(T(W.seenBy)) + '</label>' +
          '<textarea id="mk_note" data-cbsid="CMP059-T01" data-testid="mk-note" maxlength="1000"></textarea>' +
          '<div class="mk-acts"><button type="button" class="mk-act ok" data-cbsid="CMP059-B02" data-mk-act="clear" data-testid="mk-set-clear">✓ ' + esc(T(W.markChecked)) + '</button>' +
          '<button type="button" class="mk-act ask" data-cbsid="CMP059-B03" data-mk-act="open" data-testid="mk-set-open" aria-disabled="true">? ' + esc(T(W.askQuestion)) + '</button>' +
          '<button type="button" class="mk-act" data-cbsid="CMP059-B04" data-mk-act="hold" data-testid="mk-set-hold">‖ ' + esc(T(W.putOnHold)) + '</button>' +
          (cls ? '<button type="button" class="mk-act" data-cbsid="CMP059-B05" data-mk-act="removed" data-testid="mk-set-removed">' + esc(T(W.takeOff)) + '</button>' : '') + '</div>'
        : (act.set && act.set.why ? '<div class="mk-why" data-testid="mk-why">' + esc(act.set.why) + '</div>' : '')) +
      '<div class="mk-out" role="status" data-testid="mk-out" data-tone=""></div>' +
      (thread ? '<div class="mk-sub"><b>' + esc(T(W.threadHead)) + '</b></div><div id="mk_thread" data-testid="mk-thread"></div>' : '') + '</div>';
    doc.body.appendChild(dlg);
    var outEl = dlg.querySelector('[data-testid="mk-out"]'), note = dlg.querySelector('#mk_note');
    c.outEl = outEl;
    var close = function () {
      c.outEl = null;
      try { dlg.close(); } catch (_) { /* best effort: failing here changes nothing the user sees */ }
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      if (o.opener && o.opener.isConnected) { try { o.opener.focus(); } catch (_) { /* best effort */ } }
    };
    var askBtn = dlg.querySelector('[data-mk-act="open"]');
    function syncAsk() {
      if (askBtn) askBtn.setAttribute('aria-disabled', note && note.value.trim() ? 'false' : 'true');
    }
    if (note) note.addEventListener('input', syncAsk);
    dlg.addEventListener('click', function (event) {
      var b = event.target.closest ? event.target.closest('[data-mk-act]') : null;
      if (event.target === dlg) return close();
      if (!b) return;
      var a = b.getAttribute('data-mk-act');
      if (a === 'close') return close();
      var text = note ? note.value.trim() : '';
      if (a === 'open' && !text) {
        outEl.textContent = T(W.needWords);
        outEl.setAttribute('data-tone', 'error');
        if (note) note.focus();
        return;
      }
      ctl.set(id, a, a === 'clear' ? '' : text, b).then(function (v) { if (v && v.ok) close(); });
    });
    dlg.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (thread && root.CBThread) {
      var replyOk = !(act.reply && act.reply.ok === false) && (cls === 'open' || cls === 'hold' || !cls);
      root.CBThread.mount(dlg.querySelector('#mk_thread'), {
        subject: { type: 'mark', id: thread },
        transport: c.cfg.transport || null,
        actions: { message_external: replyOk ? { ok: true } : { ok: false, why: (act.reply && act.reply.why) || T(W.replyOff) } },
        party: T(W.everyone),
        readOnly: !replyOk && !(act.reply && act.reply.why),
        context: { host: 'cap-mark', source: 'CMP059' }
      });
    }
    (note || dlg.querySelector('[data-mk-act="close"]')).focus();
    return { close: close, el: dlg };
  }

  /** mount the bar for a host: [bar][the host's own list]; onFilter(on) flips the host's list to the open ones */
  function bar(c, host, o) {
    o = o || {};
    var state = { on: false };
    function show() {
      host.innerHTML = barHTML(c, state);
      var f = host.querySelector('[data-mk-filter]');
      if (f) f.onclick = function () { state.on = !state.on; show(); if (o.onFilter) o.onFilter(state.on); };
    }
    var handle = { repaint: show, on: function () { return state.on; }, refresh: function () { return c.ctl.summary().then(show); } };
    return handle.refresh().then(function () { return handle; });
  }

  wire();
  root.CBMark = {
    use: function (cfg) {
      var ctl = use(cfg), c = controls[controls.length - 1];
      ctl.bar = function (host, o) { return bar(c, host, o); };
      ctl.queries = function (titleOf) { return queryRows(c, titleOf); };
      return ctl;
    },
    paint: paint,
    ageWords: ageWords,
    CLASS: CLASS
  };
})(typeof window !== 'undefined' ? window : globalThis);
