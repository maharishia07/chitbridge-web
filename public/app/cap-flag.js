/**
 * cap-flag.js — CMP066 the Saved chip and CMP067 the Saved sheet: a PRIVATE bookmark and note on a record (a Day book entry, a client), kept in the writer's OWN organisation.
 * A firm's bookmark is never in the client's books and the client never sees it; "My firm" is read by the colleagues of the person's organisation, "Only me" by the person alone. A flag is not a mark:
 * it never changes "Checked n of m" (cap-mark.js owns that) and never reaches the client.
 *
 * OWNS      the chip (star + open-note count) · the sheet (who sees it · Bookmark · Add note · each note: Resolve / Reopen / Share with my firm / Remove) · the one door to /api/flags (read: query · list · counts; write: add · resolve · reopen · share · remove)
 * CALLED BY books-grant-view.js (the auditor's and the adviser's Day book) · books-practice.js (the firm's client list and its Home count)
 * FLOW      use({ call, kind, entity }) → load(ids) ONE read per 200 records → chip(id, label) in each row → a press → sheet(id, { label }) → one write → every chip of that record repaints
 * CARD      PM/REQ-PRIVATE-NOTES-BOOKMARKS-2026-11-17.md (W0-W3)
 *
 * ⭐ NEVER X-Books-For. Under a grant the books are read with the client's header; a flag written under it would land in the client's organisation. Every call here goes through the page's own `call(method, path, body)` with NO headers:
 *   the caller's own binding. The server decides who may flag what and answers a refusal in words, which the sheet shows; this file decides nothing.
 * ⭐ A read that failed never says "none": the chips say nothing and the sheet says the read failed. A server that has not switched flags on (503) or does not give this person the right (404) draws no chips (off()).
 *
 *   CBFlag.use({ call, kind: 'posting' | 'client' | 'account', entity?: () => subject client id }) → { load(ids) · ingest(flags) · chip(id, label) · repaint(scope) · bookmarked(id) · noted(id) · any(id) · sheet(id, { label, opener }) · onChange(fn) · off() · destroy() }
 *   CBFlag.list(call, { page, limit }) → { flags, total } · CBFlag.counts(call) → { open, bookmarks, notes } · CBFlag.listAll(call) → every open flag, up to 3 pages · CBFlag.workList({ call, nameOf, onOpen, mountList }) → a sheet of every open flag
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var CHUNK = 200; /* the server's cap on records in one read */
  var NOTE_MAX = 1000; /* one number with the server (lib/review-mark.js NOTE_MAX) */

  var EPS = {
    flagsQuery: { m: 'POST', p: '/api/flags/query' } /* { subject_kind, subject_entity, ids } → { flags: { id: [flag] } } */,
    flagsList: { m: 'GET', p: '/api/flags' } /* ?page= &limit= &kind= &subject_entity= → { flags, total, page, limit } */,
    flagsCounts: { m: 'GET', p: '/api/flags/counts' } /* → { open, bookmarks, notes } */,
    flagsAdd: { m: 'POST', p: '/api/flags' } /* { kind, visibility, subject_kind, subject_entity, items: [{ id, label }], note? } */,
    flagsResolve: { m: 'POST', p: '/api/flags/:id/resolve' },
    flagsReopen: { m: 'POST', p: '/api/flags/:id/reopen' },
    flagsShare: { m: 'POST', p: '/api/flags/:id/share' },
    flagsRemove: { m: 'POST', p: '/api/flags/:id/remove' },
    flagsThread: { m: 'GET', p: '/api/flags/:id/messages' } /* → { flag, messages: [{ by_name, text, mine, at }], may: { reply: { ok, why } } } */,
    flagsReply: { m: 'POST', p: '/api/flags/:id/messages' } /* { message_text } → the thread as it reads now */
  };
  root.CB_FLAG_EP = EPS;

  var W = {
    saved: 'Saved',
    bookmark: 'Bookmark',
    bookmarked: 'Bookmarked',
    removeBookmark: 'Remove bookmark',
    notes: 'Notes',
    addNote: 'Add note',
    noteLabel: 'Your note',
    noteNeeded: 'Write the note first.',
    who: 'Who sees it',
    firm: 'My firm',
    me: 'Only me',
    shareFirm: 'Share with my firm',
    resolve: 'Resolve',
    reopen: 'Reopen',
    remove: 'Remove',
    sure: 'Remove? Press again',
    done: 'Done',
    close: 'Close',
    by: 'by',
    resolvedBy: 'Resolved by',
    failed: 'Not saved. Nothing was changed.',
    readFail: 'Could not read your bookmarks. This does not mean there are none.',
    none: 'Nothing saved on this yet.',
    privateNote: 'Your own bookmarks and notes. The client never sees them.',
    replies: 'Replies from your firm',
    replyLabel: 'Your reply',
    reply: 'Reply',
    replyNeeded: 'Write your reply first.',
    threadFail: 'Could not read the replies. This does not mean there are none.',
    me2: 'You',
    explain: 'Explain',
    explained: 'Explained',
    explainHelp: 'Your own note on why this account moved. The client never sees it.',
    saveExplain: 'Save explanation',
    workHead: 'Bookmarks and notes',
    workNone: 'You have no open bookmarks or notes.',
    colRecord: 'Record',
    colKind: 'Kind',
    colClient: 'Client',
    colBy: 'By',
    kindBookmark: 'Bookmark',
    kindNote: 'Note',
    open: 'Open',
    more: 'Showing the newest {n}.'
  };
  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var CSS =
    '.fl{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line,#DDD6C6);border-radius:99px;background:var(--card,#fff);color:var(--grey,#5E594D);font:inherit;font-size:var(--fs-1,12px);font-weight:700;padding:3px 9px;min-height:28px;cursor:pointer}' +
    '.fl-on{border-color:var(--ok,#2E8B57);color:var(--ok-3,#0F5132)}.fl-note{border-color:var(--warn,#B7791F);color:var(--warn-3,#7A4B00)}' +
    '.fl-thread{display:flex;flex-direction:column;gap:6px;border-inline-start:3px solid var(--line,#DDD6C6);padding-inline-start:10px}.fl-msg{display:flex;flex-direction:column;gap:2px}.fl-msg.mine .fl-sub{font-weight:700}.fl-reply{min-height:56px;width:100%;box-sizing:border-box}' +
    '.fl:focus-visible{outline:2px solid var(--blue,#1f5fa8);outline-offset:2px}' +
    'dialog.fl-sheet{border:1px solid var(--line,#DDD6C6);border-radius:14px;padding:0;width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);background:var(--card,#fff);color:var(--ink,#1D1B16)}dialog.fl-sheet::backdrop{background:color-mix(in srgb,var(--ink,#1D1B16) 40%,transparent)}' +
    '.fl-in{padding:14px 16px;display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 48px);overflow:auto;box-sizing:border-box}' +
    '.fl-hd{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.fl-hd h2{margin:0;font-size:var(--fs-3,17px)}' +
    '.fl-x{border:0;background:transparent;font:inherit;font-size:20px;line-height:1;min-width:44px;min-height:44px;cursor:pointer;color:var(--grey,#5E594D)}' +
    '.fl-sub{font-size:var(--fs-1,12px);color:var(--grey,#5E594D)}' +
    '.fl-who{display:flex;gap:14px;flex-wrap:wrap;border:0;margin:0;padding:0}.fl-who label{display:inline-flex;align-items:center;gap:6px;min-height:44px;font-size:var(--fs-2,14px)}' +
    '.fl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '.fl-btn{border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);color:inherit;font:inherit;font-size:var(--fs-2,14px);padding:6px 12px;min-height:44px;cursor:pointer}.fl-btn.pri{background:var(--ink,#1D1B16);color:var(--on-accent,#fff);border-color:var(--ink,#1D1B16)}' +
    '.fl-box{width:100%;box-sizing:border-box;font:inherit;border:1px solid var(--line,#DDD6C6);border-radius:8px;padding:8px;min-height:64px;background:var(--card,#fff);color:inherit}' +
    '.fl-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}.fl-item{border:1px solid var(--line,#DDD6C6);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}' +
    '.fl-item.gone{opacity:.8}.fl-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--fs-2,14px)}' +
    '.fl-out{font-size:var(--fs-1,12px);min-height:1em}.fl-out[data-tone=error]{color:var(--disp,#8E3517);font-weight:700}' +
    '@media (max-width:700px){.fl{min-height:44px;padding:3px 12px}}';
  var cssDone = false;
  function addCss() {
    if (cssDone || !doc) return;
    cssDone = true;
    var node = doc.createElement('style');
    node.setAttribute('data-cbflag', '1');
    node.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(node);
  }

  /** ONE door: the page's own call with NO headers (never X-Books-For) */
  function ask(call, key, o) {
    o = o || {};
    var path = EPS[key].p.replace(':id', encodeURIComponent(o.id == null ? '' : o.id));
    var q = Object.keys(o.query || {}).filter(function (k) { return o.query[k] !== '' && o.query[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o.query[k]); }).join('&');
    return call(EPS[key].m, path + (q ? '?' + q : ''), o.body);
  }
  var gone = function (failure) { return !!failure && (failure.status === 503 || failure.status === 404 || failure.status === 403); };

  /** a flag counts when it is still open or resolved (the server never sends a removed one); bookmark and note are its two kinds */
  function open(f) { return f.state === 'open'; }

  function use(cfg) {
    addCss();
    cfg = cfg || {};
    var kind = cfg.kind === 'client' ? 'client' : cfg.kind === 'account' ? 'account' : 'posting';
    var c = { by: {}, subs: [], off: false, failed: false, ready: false, label: {} };
    var ctl = {
      kind: kind,
      /** the flags of these records (ONE read per 200). A refusal that means "not for you / not switched on" switches the chips off; any other failure keeps what was known and says it failed. */
      load: function (ids) {
        var entity = typeof cfg.entity === 'function' ? cfg.entity() : null;
        var list = (ids || []).map(String), jobs = [];
        for (var i = 0; i < list.length; i += CHUNK) jobs.push(list.slice(i, i + CHUNK));
        c.failed = false;
        return Promise.all(jobs.map(function (part) {
          return ask(cfg.call, 'flagsQuery', { body: { subject_kind: kind, subject_entity: entity, ids: part } }).then(function (a) {
            part.forEach(function (id) { delete c.by[id]; });
            var flags = (a && a.flags) || {};
            Object.keys(flags).forEach(function (id) { c.by[id] = flags[id]; });
          });
        })).then(function () { c.off = false; c.ready = true; }, function (failure) {
          c.ready = true;
          if (gone(failure)) c.off = true; else c.failed = true;
        });
      },
      /** the client list: flags from one GET /api/flags, grouped by record (a client's own id) */
      ingest: function (flags) {
        c.by = {};
        (flags || []).forEach(function (f) {
          if (f.subject_kind !== kind) return;
          (c.by[f.subject_id] = c.by[f.subject_id] || []).push(f);
        });
        c.off = false;
        c.ready = true;
      },
      ready: function () { return c.ready; },
      off: function () { return c.off; },
      failed: function () { return c.failed; },
      flags: function (id) { return c.by[String(id)] || []; },
      bookmarked: function (id) { return ctl.flags(id).some(function (f) { return f.kind === 'bookmark' && open(f); }); },
      noted: function (id) { return ctl.flags(id).filter(function (f) { return f.kind === 'note' && open(f); }).length; },
      any: function (id) { return ctl.bookmarked(id) || ctl.noted(id) > 0; },
      /** the chip (html); nothing when the server does not offer flags to this person */
      chip: function (id, label) {
        if (c.off || !c.ready || id == null || id === '') return '';
        id = String(id);
        if (label) c.label[id] = String(label);
        if (kind === 'account') return explainChip(id, ctl.noted(id));
        var star = ctl.bookmarked(id), n = ctl.noted(id), word = star ? W.bookmarked : n ? W.notes : W.bookmark;
        return '<button type="button" class="fl' + (star ? ' fl-on' : n ? ' fl-note' : '') + '" data-cbsid="CMP066-B01" data-fl="' + esc(id) + '" data-fl-k="' + kind + '" aria-haspopup="dialog" aria-label="' + esc(T(W.saved) + ': ' + T(word)) + '" title="' + esc(T(word)) + '" data-testid="fl-chip-' + esc(id) + '">' +
          '<span aria-hidden="true">' + (star ? '★' : '☆') + '</span>' + (n ? '<span>' + n + '</span>' : '') + '</button>';
      },
      /** put every chip of this record (or every chip) under scope back as the control now says it */
      repaint: function (scope, id) {
        if (!doc) return;
        [].forEach.call((scope || doc).querySelectorAll(id == null ? '[data-fl]' : '[data-fl="' + String(id).replace(/"/g, '') + '"]'), function (node) {
          var key = node.getAttribute('data-fl'), html = ctl.chip(key), holder = doc.createElement('span');
          holder.innerHTML = html;
          if (holder.firstChild) node.parentNode.replaceChild(holder.firstChild, node); else if (node.parentNode) node.parentNode.removeChild(node);
        });
      },
      sheet: function (id, o) { return openSheet(cfg, c, ctl, String(id), o || {}, kind); },
      onChange: function (fn) { c.subs.push(fn); },
      changed: function (id) { c.subs.forEach(function (fn) { fn(id); }); ctl.repaint(doc, id); },
      destroy: function () { c.subs = []; c.by = {}; }
    };
    live[kind] = ctl; /* the press below finds the control that painted the chip */
    return ctl;
  }
  /** the P&L's Explain (kind 'account'): one button, "Explain" until a note is written, then "Explained"; it opens the same sheet, a note only (no bookmark) */
  function explainChip(id, n) {
    var word = n ? W.explained : W.explain;
    return '<button type="button" class="fl' + (n ? ' fl-note' : '') + '" data-cbsid="CMP066-B02" data-fl="' + esc(id) + '" data-fl-k="account" aria-haspopup="dialog" aria-label="' + esc(T(word)) + '" title="' + esc(T(word)) + '" data-testid="fl-explain-' + esc(id) + '"><span>' + esc(T(word)) + '</span></button>';
  }
  var live = {}; /* kind → the newest control of that kind on this page */
  /* a press on a chip, anywhere on the page: captured, so the row behind it does not also open (as cap-mark.js and cap-evidence.js do) */
  if (doc && !root.__cbFlagWired) {
    root.__cbFlagWired = true;
    doc.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-fl]') : null, ctl = b && live[b.getAttribute('data-fl-k')];
      if (!b || !ctl) return;
      e.preventDefault();
      e.stopPropagation();
      ctl.sheet(b.getAttribute('data-fl'), { opener: b });
    }, true);
    doc.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('button[data-fl]')) e.stopPropagation(); /* the chip's key is the chip's, not the row's */
    }, true);
  }

  /* ── CMP067 the Saved sheet ── */
  function openSheet(cfg, c, ctl, id, o, kind) {
    addCss();
    var title = o.label || c.label[id] || id, dlg = doc.createElement('dialog'), entity = kind === 'client' ? id : typeof cfg.entity === 'function' ? cfg.entity() : null;
    var armed = null, busy = false;
    dlg.className = 'fl-sheet';
    dlg.setAttribute('data-cbsid', 'CMP067-D01');
    dlg.setAttribute('data-testid', 'fl-sheet');
    dlg.setAttribute('aria-label', T(W.saved) + ': ' + title);
    function say(text, error) {
      var out = dlg.querySelector('.fl-out');
      if (out) { out.textContent = text || ''; if (error) out.setAttribute('data-tone', 'error'); else out.removeAttribute('data-tone'); }
    }
    function who() {
      var chosen = dlg.querySelector('input[name="fl_who"]:checked');
      return chosen && chosen.value === 'me' ? 'me' : 'org';
    }
    function flagLine(f) {
      var shared = f.visibility === 'org', mine = f.mine === true, noteKind = f.kind === 'note', done = f.state === 'resolved';
      return '<li class="fl-item' + (done ? ' gone' : '') + '" data-flag="' + esc(f.flag_id) + '">' +
        '<div class="fl-sub">' + esc(T(noteKind ? W.kindNote : W.kindBookmark)) + ' · ' + esc(T(shared ? W.firm : W.me)) + (f.by_name ? ' · ' + esc(T(W.by)) + ' ' + esc(f.by_name) : '') + (done ? ' · ' + esc(T(W.resolvedBy)) + ' ' + esc(f.resolved_by || '') : '') + '</div>' +
        (noteKind ? '<div class="fl-text">' + esc(f.note) + '</div>' : '') +
        (noteKind && shared ? '<div class="fl-thread" data-thread="' + esc(f.flag_id) + '" data-testid="fl-thread"></div>' : '') +
        '<div class="fl-row">' +
        (noteKind ? '<button type="button" class="fl-btn" data-cbsid="CMP067-B03" data-act="' + (done ? 'reopen' : 'resolve') + '" data-id="' + esc(f.flag_id) + '">' + esc(T(done ? W.reopen : W.resolve)) + '</button>' : '') +
        (!shared && mine ? '<button type="button" class="fl-btn" data-cbsid="CMP067-B04" data-act="share" data-id="' + esc(f.flag_id) + '">' + esc(T(W.shareFirm)) + '</button>' : '') +
        '<button type="button" class="fl-btn" data-cbsid="CMP067-B05" data-act="remove" data-id="' + esc(f.flag_id) + '">' + esc(T(armed === f.flag_id ? W.sure : W.remove)) + '</button></div></li>';
    }
    /** the replies of one shared note (the firm's own thread, never the client's): what the server says, its reply right with its sentence, and a reply box when it may */
    var threads = {};
    function threadHtml(flagId, a) {
      if (a === false) return '<div class="fl-sub" data-tone="error">' + esc(T(W.threadFail)) + '</div>';
      var msgs = (a.messages || []).map(function (m) {
        return '<div class="fl-msg' + (m.mine ? ' mine' : '') + '"><div class="fl-sub">' + esc(m.mine ? T(W.me2) : m.by_name || '') + '</div><div class="fl-text">' + esc(m.text) + '</div></div>';
      }).join('');
      var may = (a.may && a.may.reply) || { ok: false, why: '' };
      return (msgs ? '<div class="fl-sub">' + esc(T(W.replies)) + '</div>' + msgs : '') +
        (may.ok ? '<textarea class="fl-reply" maxlength="' + NOTE_MAX + '" data-reply="' + esc(flagId) + '" aria-label="' + esc(T(W.replyLabel)) + '" data-cbsid="CMP067-T02" data-testid="fl-reply"></textarea><div class="fl-row"><button type="button" class="fl-btn" data-cbsid="CMP067-B09" data-act="reply" data-id="' + esc(flagId) + '" data-testid="fl-send-reply">' + esc(T(W.reply)) + '</button></div>' : may.why && msgs ? '<div class="fl-sub">' + esc(may.why) + '</div>' : '');
    }
    function fillThread(flagId) {
      var node = dlg.querySelector('.fl-thread[data-thread="' + String(flagId).replace(/"/g, '') + '"]');
      if (node && threads[flagId] !== undefined) node.innerHTML = threadHtml(flagId, threads[flagId]);
    }
    function loadThreads() {
      [].forEach.call(dlg.querySelectorAll('.fl-thread[data-thread]'), function (node) {
        var flagId = node.getAttribute('data-thread');
        if (threads[flagId] !== undefined) return fillThread(flagId);
        ask(cfg.call, 'flagsThread', { id: flagId }).then(function (a) { threads[flagId] = a || false; fillThread(flagId); }, function () { threads[flagId] = false; fillThread(flagId); });
      });
    }
    function paint(keepNote) {
      var note = keepNote ? (dlg.querySelector('.fl-box') || {}).value || '' : '', flags = ctl.flags(id), mineBookmark = flags.filter(function (f) { return f.kind === 'bookmark' && open(f); })[0];
      dlg.innerHTML = '<div class="fl-in"><div class="fl-hd"><h2>' + esc(title) + '</h2><button type="button" class="fl-x" data-cbsid="CMP067-B01" data-act="close" aria-label="' + esc(T(W.close)) + '">✕</button></div>' +
        '<div class="fl-sub">' + esc(T(kind === 'account' ? W.explainHelp : W.privateNote)) + '</div>' +
        '<fieldset class="fl-who"><legend class="fl-sub">' + esc(T(W.who)) + '</legend>' +
        '<label><input type="radio" name="fl_who" value="org" checked data-cbsid="CMP067-R01"> ' + esc(T(W.firm)) + '</label><label><input type="radio" name="fl_who" value="me" data-cbsid="CMP067-R02"> ' + esc(T(W.me)) + '</label></fieldset>' +
        (mineBookmark || kind === 'account' ? '' : '<div class="fl-row"><button type="button" class="fl-btn pri" data-cbsid="CMP067-B02" data-act="bookmark" data-testid="fl-bookmark">☆ ' + esc(T(W.bookmark)) + '</button></div>') +
        '<textarea class="fl-box" maxlength="' + NOTE_MAX + '" aria-label="' + esc(T(W.noteLabel)) + '" data-cbsid="CMP067-T01" data-testid="fl-note"></textarea><div class="fl-row"><button type="button" class="fl-btn" data-cbsid="CMP067-B06" data-act="note" data-testid="fl-add-note">' + esc(T(kind === 'account' ? W.saveExplain : W.addNote)) + '</button></div>' +
        '<div class="fl-out" role="status" aria-live="polite"></div>' +
        (c.failed ? '<div class="fl-out" data-tone="error">' + esc(T(W.readFail)) + '</div>' : flags.length ? '<ul class="fl-list" data-testid="fl-list">' + flags.map(flagLine).join('') + '</ul>' : '<div class="fl-sub">' + esc(T(W.none)) + '</div>') +
        '</div>';
      if (mineBookmark) { var who0 = dlg.querySelector('input[name="fl_who"][value="' + (mineBookmark.visibility === 'me' ? 'me' : 'org') + '"]'); if (who0) who0.checked = true; }
      var box = dlg.querySelector('.fl-box');
      if (box && note) box.value = note;
      loadThreads();
    }
    /** write one change; on an answer re-read this record (the server's own view, including what a colleague did) and repaint */
    function write(key, body, flagId) {
      if (busy) return;
      busy = true;
      return ask(cfg.call, key, { id: flagId, body: body }).then(function () {
        return kind === 'client' ? refreshClient() : ctl.load([id]);
      }).then(function () {
        threads = {}; busy = false; armed = null; paint(false); say(T(W.done)); ctl.changed(id);
      }, function (failure) {
        busy = false; armed = null; say((failure && failure.message) || T(W.failed), true);
      });
    }
    function refreshClient() {
      return ask(cfg.call, 'flagsList', { query: { subject_entity: id, limit: CHUNK } }).then(function (a) {
        c.by[id] = ((a && a.flags) || []).filter(function (f) { return f.subject_kind === 'client' && f.subject_id === id; });
      });
    }
    function add(flagKind, noteText) {
      var body = { kind: flagKind, visibility: who(), subject_kind: kind, subject_entity: entity, items: [{ id: id, label: String(title).slice(0, 80) }] };
      if (flagKind === 'note') body.note = noteText;
      return write('flagsAdd', body);
    }
    dlg.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'close') return dlg.close();
      if (act === 'bookmark') return add('bookmark');
      if (act === 'note') {
        var text = (dlg.querySelector('.fl-box').value || '').trim();
        if (!text) return say(T(W.noteNeeded), true);
        return add('note', text);
      }
      var flagId = b.getAttribute('data-id');
      if (act === 'reply') {
        var box = dlg.querySelector('textarea[data-reply="' + String(flagId).replace(/"/g, '') + '"]'), words = box ? (box.value || '').trim() : '';
        if (!words) return say(T(W.replyNeeded), true);
        if (busy) return;
        busy = true;
        return ask(cfg.call, 'flagsReply', { id: flagId, body: { message_text: words } }).then(function (a) {
          busy = false; threads[flagId] = a || false; fillThread(flagId); say(T(W.done));
        }, function (failure) {
          busy = false; say((failure && failure.message) || T(W.failed), true);
        });
      }
      if (act === 'remove' && armed !== flagId) { armed = flagId; b.textContent = T(W.sure); return; } /* the second press commits: removing a note drops its words */
      return write({ resolve: 'flagsResolve', reopen: 'flagsReopen', share: 'flagsShare', remove: 'flagsRemove' }[act], null, flagId);
    });
    dlg.addEventListener('close', function () {
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      if (o.opener && o.opener.focus && o.opener.isConnected) o.opener.focus();
    });
    paint(false);
    doc.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var first = dlg.querySelector('[data-act="bookmark"]') || dlg.querySelector('.fl-box');
    if (first && first.focus) first.focus();
    return dlg;
  }

  /* ── the lists: for a firm's Home count and the client list ── */
  function list(call, o) { return ask(call, 'flagsList', { query: { page: (o && o.page) || 1, limit: (o && o.limit) || CHUNK, kind: o && o.kind } }); }
  function counts(call) { return ask(call, 'flagsCounts'); }
  /** every open flag, newest first, up to three pages of 200 (more says so: total is returned as it is) */
  function listAll(call) {
    return list(call, { page: 1 }).then(function (first) {
      var out = { flags: (first && first.flags) || [], total: (first && first.total) || 0 }, pages = Math.min(3, Math.ceil(out.total / CHUNK));
      if (pages < 2) return out;
      var more = [];
      for (var p = 2; p <= pages; p++) more.push(list(call, { page: p }));
      return Promise.all(more).then(function (rest) {
        rest.forEach(function (a) { out.flags = out.flags.concat((a && a.flags) || []); });
        return out;
      });
    });
  }

  /** the work list (CMP067): every open bookmark and note of this person's organisation they may read, on the one list control; a row opens the record's client */
  function workList(o) {
    addCss();
    var dlg = doc.createElement('dialog');
    dlg.className = 'fl-sheet';
    dlg.setAttribute('data-cbsid', 'CMP067-D02');
    dlg.setAttribute('data-testid', 'fl-worklist');
    dlg.setAttribute('aria-label', T(W.workHead));
    dlg.innerHTML = '<div class="fl-in" style="min-height:240px"><div class="fl-hd"><h2>' + esc(T(W.workHead)) + '</h2><button type="button" class="fl-x" data-cbsid="CMP067-B07" data-close="1" aria-label="' + esc(T(W.close)) + '">✕</button></div><div class="fl-out" role="status"></div><div class="fl-wl" data-testid="fl-wl" style="height:min(60vh,420px)"></div></div>';
    dlg.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('[data-close]')) dlg.close(); });
    dlg.addEventListener('close', function () { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); if (o.opener && o.opener.isConnected && o.opener.focus) o.opener.focus(); });
    doc.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var out = dlg.querySelector('.fl-out'), host = dlg.querySelector('.fl-wl');
    listAll(o.call).then(function (a) {
      if (!a.flags.length) { host.innerHTML = '<div class="fl-sub">' + esc(T(W.workNone)) + '</div>'; return; }
      if (a.total > a.flags.length) out.textContent = T(W.more).replace('{n}', a.flags.length);
      var rows = a.flags.map(function (f) { return Object.assign({ client: (o.nameOf && o.nameOf(f.subject_entity)) || '' }, f); });
      var clientCell = function (r) { return esc(r.client || String(r.subject_entity).slice(0, 8)); };
      if (!root.CBList) { host.innerHTML = '<ul class="fl-list">' + rows.map(function (r) { return '<li class="fl-item"><b>' + esc(r.label) + '</b> ' + clientCell(r) + '</li>'; }).join('') + '</ul>'; return; }
      root.CBList.mount(host, {
        key: 'flags-worklist', t: T, rows: function () { return rows; }, id: function (r) { return r.flag_id; }, rowTid: function (r) { return 'fl-row-' + r.flag_id; },
        defaultCols: ['label', 'client', 'kind', 'by'],
        columns: [
          { key: 'label', label: T(W.colRecord), prio: 1, w: 200, keep: true, stretch: true, html: true, cell: function (r) { return esc(r.label) + (r.note ? '<div class="fl-sub">' + esc(r.note) + '</div>' : ''); }, value: function (r) { return r.label; } },
          { key: 'client', label: T(W.colClient), prio: 1, w: 150, html: true, cell: clientCell, value: function (r) { return r.client; } },
          { key: 'kind', label: T(W.colKind), prio: 2, w: 110, cell: function (r) { return T(r.kind === 'note' ? W.kindNote : W.kindBookmark) + (r.visibility === 'me' ? ' · ' + T(W.me) : ''); }, value: function (r) { return r.kind; } },
          { key: 'by', label: T(W.colBy), prio: 3, w: 120, cell: function (r) { return r.by_name || ''; }, value: function (r) { return r.by_name || ''; } }
        ],
        search: function (r) { return [r.label, r.client, r.note].join(' '); },
        onOpen: function (r) { if (o.onOpen) o.onOpen(r); },
        empty: { title: T(W.workNone) }
      });
    }, function (failure) { out.setAttribute('data-tone', 'error'); out.textContent = gone(failure) ? T(W.workNone) : T(W.readFail); });
    return dlg;
  }

  root.CBFlag = { use: use, list: list, counts: counts, listAll: listAll, workList: workList, words: W, gone: gone };
})(typeof window !== 'undefined' ? window : globalThis);
