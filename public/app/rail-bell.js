/* rail-bell.js — CBBell.mount: THE BELL, mountable in any header (R06, 2026-10-09).
 *
 * DESIGN-rail-modules-2026-10-05 §2.1 (CBBell): "the dot + the list, mountable in any header." Before this file only app.html and the
 * counter listened for the server's push; accounts.html and crm.html had no bell, so a message or a dispute raised on a chit was
 * invisible there. Now any page mounts one.
 *
 * THE API IS CORRECT AND IS NOT REIMPLEMENTED HERE (routes/events.js · routes/notifications.js):
 *   POST /api/events/ticket          -> { ticket }        a one-time ticket, so the token never rides the URL
 *   GET  /api/events/stream?t=ticket -> SSE; `hello` once, then `cb` { kind, id, who } on every arrival (never your own action)
 *   GET  /api/notifications          -> { notifications[], count }   the Activity feed; `count` = what arrived since the last look
 *   POST /api/notifications/seen     -> moves the watermark (opening IS seeing)
 *   POST /api/notifications/dismiss  { log_ids[] | all:true }       clears this entity's view; the events are kept
 *
 * THE BELL NEVER POLLS. One read when it mounts, one on each `cb` arrival (SSE is live), one on opening, one after a clear. A dropped
 *   stream is re-ticketed with backoff — that is a reconnect, not a poll; nothing here sets an interval.
 * A NOTIFICATION IS SHOWN ONLY TO A SIGNED-IN PERSON OF THE SHOP: no token, or a customer login -> nothing is drawn, no stream opened.
 *   The server decides the rows (per-entity under RLS); this paints what it was handed, never more.
 *
 *   CBBell.mount(el, {
 *     onOpen?(chit_id),     // a row was pressed — the host opens the chit (default: openChitSheet, then openChit, when the page has one)
 *     person?,              // the host's signed-in person; passed as null = signed out → nothing drawn, nothing read
 *     apiBase?, token?,     // a page without core.js (the Home shell) hands these, as it does to CBAvatar; the call is then a plain bearer fetch
 *     context: { host }     // who mounted it
 *   }) -> { refresh(), destroy(), count(), el }      Emits `cb:rail` { module:'bell', result:{ count } } on el when the count changes.
 *
 * Reuse: api/EP (core.js) · CBAction (accounts-shell.js: the clear is a write) · CBLocale · the Activity wording of app.html's mapNotif.
 * ZERO app.html globals: no UI, paintDetail, modal. The app and the counter keep their own bell until R10 / M62 swap them for this.
 */
(function (root) {
'use strict';
var doc = root.document;

/* the four routes, ONE name each — the names app.html registers; a page without them gets them at mount (the attach-ui pattern) */
/* built by row() so a second literal of the same route is not declared: these are app.html's four names, registered only when the page has not (e2e/ep-aliases.cjs) */
function row(m, p) { return { m: m, p: p, ok: 'y' }; }
var BELL_EP = {
  eventsTicket: row('POST', '/api/events/ticket'), notifications: row('GET', '/api/notifications'),
  notifSeen: row('POST', '/api/notifications/seen'), notifDismiss: row('POST', '/api/notifications/dismiss')
};
function ensureEP() {
  if (typeof EP === 'undefined' || !EP) return false;
  for (var k in BELL_EP) if (!EP[k]) EP[k] = BELL_EP[k];
  return true;
}
function T(s) { return typeof tx === 'function' ? tx(s) : s; }
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

var W = { title: 'Activity', none: 'No activity yet', clear: 'Clear all', cleared: 'Activity cleared', forYou: 'For you', rest: 'Everything else',
  ask: 'Clear all activity?', askBody: 'This clears your Activity list. The events are kept — chits, statuses and disputes are unchanged.',
  readFail: 'Could not read your activity — try again', aria: 'Activity', chit: 'a chit', needs: 'Clearing needs the latest update on this system' };
var KIND = {
  message_sent: ['💬', 'wrote about'], delivered_line: ['📦', 'recorded a delivery on'], assigned_line: ['👤', 'assigned a line on'],
  status_completed: ['✅', 'completed'], status_cancelled: ['🚫', 'cancelled'], accepted: ['✍️', 'accepted'],
  dispute_raised: ['⚑', 'raised a dispute on'], dispute_resolved: ['✅', 'resolved a dispute on'], voided: ['🚫', 'voided']
};
/** one row of the feed -> { i, mine, chit, who, say, subj, d, s, id } — plain text (painted through esc) */
function line(n) {
  var k = KIND[n.action], subj = n.manual_subject || n.auto_subject || T(W.chit), s = '';
  if (n.created_at) { try { s = root.CBLocale.datetime(n.created_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { s = String(n.created_at).replace('T', ' ').slice(0, 16); } }
  return { i: k ? k[0] : '•', mine: !!(n.assigned_to_me || n.dispute_for_me), chit: n.chit_id || null, who: n.action_by_display_name || '',
    say: k ? k[1] : String(n.action || 'updated').replace(/_/g, ' '), subj: subj,
    d: n.detail ? String(n.detail).slice(0, 90) : (n.new_status || ''), s: s, id: n.log_id || null };
}

var CSS = '.cbb{position:relative;display:inline-block}'
  + '.cbb-btn{position:relative;border:1px solid var(--line,#DDD6C6);background:var(--card,#fff);color:var(--ink,#1D1B16);border-radius:9px;font:inherit;font-size:var(--fs-2,14px);min-width:36px;min-height:32px;padding:3px 9px;cursor:pointer}'
  + '@media (max-width:620px){.cbb-btn{min-width:28px;padding:2px 4px}}'   /* a phone header holds the page action, the bell, Home and the avatar on one line */
  + '.cbb-dot{position:absolute;top:-6px;inset-inline-end:-6px;min-width:18px;height:18px;border-radius:9px;background:var(--disp,#8E3517);color:var(--on-accent,#fff);font-size:var(--fs-1,12px);font-weight:800;line-height:18px;text-align:center;padding:0 4px;box-sizing:border-box}'
  + '.cbb-panel{position:absolute;inset-inline-end:0;top:calc(100% + 6px);z-index:60;width:min(360px,92vw);max-height:70vh;overflow:auto;border:1px solid var(--line,#DDD6C6);border-radius:12px;background:var(--card,#fff);color:var(--ink,#1D1B16);box-shadow:0 8px 24px var(--shadow,rgba(0,0,0,.14));font-size:var(--fs-2,14px);text-align:start}'
  + '.cbb-hd{padding:10px 12px;font-weight:800;border-bottom:1px solid var(--line,#DDD6C6)}'
  + '.cbb-sec{padding:8px 12px 3px;font-size:var(--fs-1,12px);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grey,#5E594D)}'
  + '.cbb-row{display:flex;gap:9px;padding:8px 12px;border:0;border-bottom:1px solid var(--line,#DDD6C6);cursor:pointer;background:none;width:100%;text-align:start;font:inherit;color:inherit}'
  + '.cbb-row:hover{background:var(--paper,#f4f1ea)}.cbb-row[disabled]{cursor:default}'
  + '.cbb-t{line-height:1.35}.cbb-d{font-size:var(--fs-1,12px);color:var(--grey,#5E594D);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cbb-s{font-size:var(--fs-1,12px);color:var(--grey,#5E594D)}'
  + '.cbb-none{padding:14px 12px;color:var(--grey,#5E594D)}.cbb-ft{display:flex;gap:8px;align-items:center;padding:8px 12px}'
  + '.cbb-clear{margin-inline-start:auto;border:1px solid var(--line,#DDD6C6);background:var(--card,#fff);color:inherit;border-radius:9px;font:inherit;font-size:var(--fs-1,12px);font-weight:700;padding:6px 12px;cursor:pointer;min-height:32px}'
  + '.cbb-clear[disabled]{opacity:.55;cursor:not-allowed}.cbb-out{font-size:var(--fs-1,12px)}.cbb-out[data-tone=error]{color:var(--disp,#8E3517);font-weight:700}';
var cssDone = false;
function addCss() { if (cssDone || !doc) return; cssDone = true; var s = doc.createElement('style'); s.setAttribute('data-cbbell', '1'); s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }

/** the token of a signed-in person of the shop, or null (signed out, or a customer login) */
/**
 * THE CALL. On a page with core.js (crm · accounts · the app) it is api() — the auth, the envelope, the 401 path, all of it. A page
 * without core.js (the Home shell, index.html) hands the shell's apiBase + token, the way CBAvatar is given them, and the call is a
 * plain fetch with the bearer that unwraps the same {ok,data,error} envelope.
 */
function call(o, name, opts) {
  if (!o.apiBase && typeof api === 'function') return api(name, opts);
  var e = BELL_EP[name], tok = whoToken(o), base = o.apiBase || o.base || (typeof CFG !== 'undefined' && CFG && CFG.API_BASE) || '';
  return root.fetch(base + e.p, { method: e.m, cache: 'no-store', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok || (j && j.ok === false)) { var er = new Error((j && (j.error && j.error.message || j.error)) || ('HTTP ' + r.status)); er.status = r.status; er.code = j && (j.code || (j.error && j.error.code)); throw er; }
      return (j && 'ok' in j && 'data' in j) ? j.data : j;
    });
  });
}
/* every bell on the page; a bell whose element left the page (its header was redrawn) is closed, so a repaint never leaves a second stream open */
var LIVE = [];
function sweep() { LIVE.slice().forEach(function (b) { if (!b.el.isConnected) b.destroy(); }); }

function whoToken(o) {
  if (Object.prototype.hasOwnProperty.call(o, 'person') && !o.person) return null;   // the host says nobody is signed in (a token may still be saved)
  var tok = o.token || (typeof SESSION !== 'undefined' && SESSION && SESSION.token) || null;
  var role = (typeof SESSION !== 'undefined' && SESSION && SESSION.role) || '';
  return tok && role !== 'customer' ? tok : null;
}

function mount(el, o) {
  el = typeof el === 'string' ? doc.getElementById(el) : el;
  if (!el) return null;
  o = o || {};
  if (el.__cbbell) el.__cbbell.destroy();
  sweep();
  addCss(); ensureEP();
  var m = { rows: [], count: 0, open: false, es: null, up: false, backoff: 5000, timer: null, dead: false, err: false, out: '', tone: '' };
  if (!el.getAttribute('data-testid')) el.setAttribute('data-testid', 'bell');   /* a host's own slot keeps its name (the shell's is shell-bell) */ if (!/\bcbb\b/.test(el.className)) el.className = (el.className ? el.className + ' ' : '') + 'cbb';

  function paint() {
    if (m.dead) return;
    var dot = m.count > 0 ? '<span class="cbb-dot" data-testid="bell-dot" aria-hidden="true">' + (m.count > 99 ? '99+' : m.count) + '</span>' : '';
    var html = '<button type="button" class="cbb-btn" data-testid="bell-btn" aria-haspopup="true" aria-expanded="' + (m.open ? 'true' : 'false') + '" aria-label="'
      + esc(T(W.aria)) + (m.count ? ' (' + m.count + ')' : '') + '">🔔' + dot + '</button>';
    if (m.open) {
      var items = m.rows.map(line), mine = items.filter(function (x) { return x.mine; }), rest = items.filter(function (x) { return !x.mine; });
      var row = function (x) {
        return '<button type="button" class="cbb-row" data-testid="bell-row"' + (x.chit ? ' data-chit="' + esc(x.chit) + '"' : ' disabled') + '><span aria-hidden="true">' + x.i + '</span><span style="min-width:0">'
          + '<div class="cbb-t">' + (x.who ? '<b>' + esc(x.who) + '</b> ' : '') + esc(x.say) + ' <b>' + esc(x.subj) + '</b></div>'
          + (x.d ? '<div class="cbb-d">' + esc(x.d) + '</div>' : '') + '<div class="cbb-s">' + esc(x.s) + '</div></span></button>';
      };
      var body = m.err ? '<div class="cbb-none" data-testid="bell-error">' + esc(T(W.readFail)) + '</div>'
        : items.length ? (mine.length ? '<div class="cbb-sec">' + esc(T(W.forYou)) + '</div>' + mine.map(row).join('') : '')
          + (rest.length ? (mine.length ? '<div class="cbb-sec">' + esc(T(W.rest)) + '</div>' : '') + rest.map(row).join('') : '')
        : '<div class="cbb-none" data-testid="bell-empty">' + esc(T(W.none)) + '</div>';
      html += '<div class="cbb-panel" data-testid="bell-panel" role="dialog" aria-label="' + esc(T(W.title)) + '"><div class="cbb-hd">' + esc(T(W.title)) + '</div>' + body
        + '<div class="cbb-ft"><span class="cbb-out" data-testid="bell-out" data-tone="' + esc(m.tone) + '">' + esc(m.out) + '</span>'
        + '<button type="button" class="cbb-clear" data-testid="bell-clear"' + (items.length ? '' : ' disabled') + '>' + esc(T(W.clear)) + '</button></div></div>';
    }
    el.innerHTML = html;
  }
  function setCount(n) {
    n = Number(n) || 0; if (n === m.count) return;
    m.count = n;
    try { el.dispatchEvent(new CustomEvent('cb:rail', { bubbles: true, detail: { module: 'bell', result: { count: n } } })); } catch (_) {}
  }
  /** ONE read of the feed (never polled) */
  function read() {
    if (m.dead || !whoToken(o)) return Promise.resolve();
    return call(o, 'notifications').then(function (r) {
      if (m.dead) return; m.err = false; m.rows = (r && r.notifications) || []; setCount(r && r.count != null ? r.count : m.rows.length); paint();
    }).catch(function () { if (m.dead) return; m.err = true; paint(); });
  }
  /* the stream: ticket -> EventSource; an arrival re-reads once; a drop re-tickets with backoff (a reconnect, not a poll) */
  function connect() {
    if (m.dead || m.es || !root.EventSource || !whoToken(o)) return;
    call(o, 'eventsTicket').then(function (t) {
      if (m.dead || m.es) return;
      if (!t || !t.ticket) { retry(); return; }
      var base = o.apiBase || o.base || (typeof CFG !== 'undefined' && CFG && CFG.API_BASE) || '';
      var es = new root.EventSource(base + '/api/events/stream?t=' + encodeURIComponent(t.ticket));
      m.es = es;
      es.addEventListener('hello', function () { m.up = true; m.backoff = 5000; });
      es.addEventListener('cb', function () { read(); });
      es.onerror = function () { try { es.close(); } catch (_) {} m.es = null; m.up = false; retry(); };
    }).catch(retry);
  }
  function retry() { if (m.dead || !whoToken(o)) return; clearTimeout(m.timer); m.timer = setTimeout(connect, m.backoff); m.backoff = Math.min(m.backoff * 2, 60000); }

  function toggle() {
    m.open = !m.open; m.out = ''; m.tone = '';
    paint();
    /* OPENING IS SEEING: looking moves the watermark, so the dot clears without a "mark all read" button */
    if (m.open) { call(o, 'notifSeen').then(function () { setCount(0); paint(); }).catch(function () {}); read(); }
  }
  function onClick(ev) {
    ev.__cbbIn = true;    /* this press was ours: its target is repainted away, so the document handler cannot tell by contains() */
    var t = ev.target; if (!t.closest) return;
    if (t.closest('[data-testid="bell-btn"]')) { toggle(); return; }
    var r = t.closest('[data-testid="bell-row"]');
    if (r && r.getAttribute('data-chit')) {
      var id = r.getAttribute('data-chit'); m.open = false; paint();
      if (typeof o.onOpen === 'function') o.onOpen(id);
      else if (typeof root.openChitSheet === 'function') root.openChitSheet(id);
      else if (typeof root.openChit === 'function') root.openChit(id);
      return;
    }
    var c = t.closest('[data-testid="bell-clear"]');
    if (c && !c.disabled) clearAll(c);
  }
  function clearAll(btn) {
    if (typeof CBAction === 'undefined' || !CBAction || typeof CBAction.run !== 'function') throw new Error('CBBell needs CBAction (app/accounts-shell.js) on the page — a clear is a write');
    CBAction.run(btn, function () { return call(o, 'notifDismiss', { body: { all: true } }); },
      { key: 'bell:clear', confirm: { title: T(W.ask), body: esc(T(W.askBody)), yes: T(W.clear) },
        outcome: function () { m.rows = []; m.out = T(W.cleared); m.tone = 'ok'; setCount(0); paint(); },
        onFail: function (w, e) { m.out = (e && e.code === 'NOTIF_DISMISS_NOT_MIGRATED') ? T(W.needs) : w; m.tone = 'error'; paint(); } });
  }
  /* a click in a dialog (the Clear all confirm) is not a click away: the panel stays to show what the clear did */
  function onDoc(ev) { if (m.open && !ev.__cbbIn && !el.contains(ev.target) && !(ev.target.closest && ev.target.closest('dialog'))) { m.open = false; paint(); } }
  function onKey(ev) { if (m.open && ev.key === 'Escape') { m.open = false; paint(); } }

  el.addEventListener('click', onClick);
  doc.addEventListener('click', onDoc); doc.addEventListener('keydown', onKey);
  var apiObj = {
    el: el, refresh: read, count: function () { return m.count; },
    destroy: function () { m.dead = true; clearTimeout(m.timer); if (m.es) { try { m.es.close(); } catch (_) {} } m.es = null;
      el.removeEventListener('click', onClick); doc.removeEventListener('click', onDoc); doc.removeEventListener('keydown', onKey); el.innerHTML = ''; delete el.__cbbell; var i = LIVE.indexOf(apiObj); if (i >= 0) LIVE.splice(i, 1); }
  };
  el.__cbbell = apiObj; LIVE.push(apiObj);
  if (!whoToken(o)) { el.innerHTML = ''; return apiObj; }     // signed out / a customer: no bell, no stream
  paint(); read(); connect();
  return apiObj;
}

root.CBBell = { mount: mount, line: line, EP: BELL_EP };
})(typeof window !== 'undefined' ? window : this);
