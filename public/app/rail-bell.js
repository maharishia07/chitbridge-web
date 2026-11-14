/* public/app/rail-bell.js — CBBell: the bell, mountable in any header
 * ID        CMP030 (the bell button; its rows are CMP038, its Clear CMP014)
 * OWNER     cb-ux-locale
 * OWNS      the bell's dot and list: one read on mount, one per arrival, the clear and the seen mark
 * CALLED BY app/shell.js (CBBell.mount into the bar slot, shell.js:1531) on the pages that load it by script tag: accounts, authority-forms, catalogue, crm, employees, finance, know-your-business, network, operations, settings, standards, tasks
 * CARD      01-rail-core-the-chit/rail-bell
 * RISK      personal-data
 * FLOW      POST /api/events/ticket -> SSE stream -> the dot and the list -> amounts through fmtMoney in the notice's currency
 *
 * rail-bell.js — CBBell.mount: THE BELL, mountable in any header.
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
  function row(method, path) {
    return { m: method, p: path, ok: 'y' };
  }
  var BELL_EP = {
    eventsTicket: row('POST', '/api/events/ticket'),
    notifications: row('GET', '/api/notifications'),
    notifSeen: row('POST', '/api/notifications/seen'),
    notifDismiss: row('POST', '/api/notifications/dismiss')
  };
  function ensureEP() {
    if (typeof EP === 'undefined' || !EP) return false;
    for (var k in BELL_EP) if (!EP[k]) EP[k] = BELL_EP[k];
    return true;
  }
  function T(words) {
    return typeof tx === 'function' ? tx(words) : words;
  }

  var W = {
    title: 'Activity',
    none: 'No activity yet',
    clear: 'Clear all',
    cleared: 'Activity cleared',
    forYou: 'For you',
    rest: 'Everything else',
    ask: 'Clear all activity?',
    askBody: 'This clears your Activity list. The events are kept — chits, statuses and disputes are unchanged.',
    readFail: 'Could not read your activity — try again',
    aria: 'Activity',
    chit: 'a chit',
    needs: 'Clearing needs the latest update on this system'
  };
  var KIND = {
    message_sent: ['💬', 'wrote about'],
    delivered_line: ['📦', 'recorded a delivery on'],
    assigned_line: ['👤', 'assigned a line on'],
    status_completed: ['✅', 'completed'],
    status_cancelled: ['🚫', 'cancelled'],
    accepted: ['✍️', 'accepted'],
    dispute_raised: ['⚑', 'raised a dispute on'],
    dispute_resolved: ['✅', 'resolved a dispute on'],
    voided: ['🚫', 'voided']
  };
  /** the moment a feed row happened, as the reader's LOCAL time: CBLocale first, then the browser's own format, then the raw text */
  function localMoment(createdAt) {
    var shape = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
    try {
      return root.CBLocale.datetime(createdAt, shape);
    } catch (_) {
      try {
        var date = new Date(createdAt);
        return isNaN(date) ? String(createdAt).replace('T', ' ').slice(0, 16) : date.toLocaleString(undefined, shape);
      } catch (_2) {
        return String(createdAt).slice(0, 16);
      }
    }
  }
  /** one row of the feed -> { i, mine, chit, who, say, subj, d, s, id } — plain text (painted through esc) */
  function line(item) {
    var kind = KIND[item.action],
      subj = item.manual_subject || item.auto_subject || T(W.chit),
      moment = '';
    /* O3: the time is the reader's LOCAL time (the feed's created_at is UTC) - never the raw string */
    if (item.created_at) moment = localMoment(item.created_at);
    /* O3: a NEW incoming order is not a "delivered" - it says what it is, who sent it and what it is worth */
    if (item.purpose === 'order' && item.action === 'delivered' && item.direction === 'received') {
      var amt = fmtMoney(item.total_value, item.currency_code, ''),
        list = [item.order_channel === 'online' ? '🌐 ' + T('Online') : '', item.order_fulfilment === 'delivery' ? T('Delivery') : ''].filter(Boolean).join(' · ');
      return {
        i: '🛍️',
        mine: !!(item.assigned_to_me || item.dispute_for_me),
        chit: item.chit_id || null,
        order: true,
        who: item.action_by_display_name || '',
        say: T('sent a new order'),
        subj: '',
        d: [amt, list].filter(Boolean).join(' · '),
        s: moment,
        id: item.log_id || null
      };
    }
    return {
      i: kind ? kind[0] : '•',
      mine: !!(item.assigned_to_me || item.dispute_for_me),
      chit: item.chit_id || null,
      who: item.action_by_display_name || '',
      say: kind ? kind[1] : String(item.action || 'updated').replace(/_/g, ' '),
      subj: subj,
      d: item.detail ? String(item.detail).slice(0, 90) : item.new_status || '',
      s: moment,
      id: item.log_id || null
    };
  }

  var CSS =
    '.cbb{position:relative;display:inline-block}' +
    '.cbb-btn{position:relative;border:1px solid var(--line,#DDD6C6);background:var(--card,#fff);color:var(--ink,#1D1B16);border-radius:9px;font:inherit;font-size:var(--fs-2,14px);min-width:36px;min-height:32px;padding:3px 9px;cursor:pointer}' +
    '@media (max-width:620px){.cbb-btn{min-width:28px;padding:2px 4px}}' /* a phone header holds the page action, the bell, Home and the avatar on one line */ +
    '.cbb-dot{position:absolute;top:-6px;inset-inline-end:-6px;min-width:18px;height:18px;border-radius:9px;background:var(--disp,#8E3517);color:var(--on-accent,#fff);font-size:var(--fs-1,12px);font-weight:800;line-height:18px;text-align:center;padding:0 4px;box-sizing:border-box}' +
    '.cbb-panel{position:absolute;inset-inline-end:0;top:calc(100% + 6px);z-index:60;width:min(360px,92vw);max-height:70vh;overflow:auto;border:1px solid var(--line,#DDD6C6);border-radius:12px;background:var(--card,#fff);color:var(--ink,#1D1B16);box-shadow:0 8px 24px var(--shadow,rgba(0,0,0,.14));font-size:var(--fs-2,14px);text-align:start}' +
    '.cbb-hd{padding:10px 12px;font-weight:800;border-bottom:1px solid var(--line,#DDD6C6)}' +
    '.cbb-sec{padding:8px 12px 3px;font-size:var(--fs-1,12px);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grey,#5E594D)}' +
    '.cbb-row{display:flex;gap:9px;padding:8px 12px;border:0;border-bottom:1px solid var(--line,#DDD6C6);cursor:pointer;background:none;width:100%;text-align:start;font:inherit;color:inherit}' +
    '.cbb-row:hover{background:var(--paper,#f4f1ea)}.cbb-row[disabled]{cursor:default}' +
    '.cbb-t{line-height:1.35}.cbb-d{font-size:var(--fs-1,12px);color:var(--grey,#5E594D);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cbb-s{font-size:var(--fs-1,12px);color:var(--grey,#5E594D)}' +
    '.cbb-none{padding:14px 12px;color:var(--grey,#5E594D)}.cbb-ft{display:flex;gap:8px;align-items:center;padding:8px 12px}' +
    '.cbb-clear{margin-inline-start:auto;border:1px solid var(--line,#DDD6C6);background:var(--card,#fff);color:inherit;border-radius:9px;font:inherit;font-size:var(--fs-1,12px);font-weight:700;padding:6px 12px;cursor:pointer;min-height:32px}' +
    '.cbb-clear[disabled]{opacity:.55;cursor:not-allowed}.cbb-out{font-size:var(--fs-1,12px)}.cbb-out[data-tone=error]{color:var(--disp,#8E3517);font-weight:700}';
  var cssDone = false;
  function addCss() {
    if (cssDone || !doc) return;
    cssDone = true;
    var node = doc.createElement('style');
    node.setAttribute('data-cbbell', '1');
    node.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(node);
  }

  /** the token of a signed-in person of the shop, or null (signed out, or a customer login) */
  /**
   * THE CALL. On a page with core.js (crm · accounts · the app) it is api() — the auth, the envelope, the 401 path, all of it. A page
   * without core.js (the Home shell, index.html) hands the shell's apiBase + token, the way CBAvatar is given them, and the call is a
   * plain fetch with the bearer that unwraps the same {ok,data,error} envelope.
   */
  function call(host, name, opts) {
    if (!host.apiBase && typeof api === 'function') return api(name, opts);
    var route = BELL_EP[name],
      tok = whoToken(host),
      base = host.apiBase || host.base || (typeof CFG !== 'undefined' && CFG && CFG.API_BASE) || '';
    return root
      .fetch(base + route.p, {
        method: route.m,
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: opts && opts.body ? JSON.stringify(opts.body) : undefined
      })
      .then(function (reply) {
        return reply
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            if (!reply.ok || (j && j.ok === false)) {
              var er = new Error((j && ((j.error && j.error.message) || j.error)) || 'HTTP ' + reply.status);
              er.status = reply.status;
              er.code = j && (j.code || (j.error && j.error.code));
              throw er;
            }
            return j && 'ok' in j && 'data' in j ? j.data : j;
          });
      });
  }
  /* every bell on the page; a bell whose element left the page (its header was redrawn) is closed, so a repaint never leaves a second stream open */
  var LIVE = [];
  function sweep() {
    LIVE.slice().forEach(function (item) {
      if (!item.el.isConnected) item.destroy();
    });
  }

  function whoToken(host) {
    if (Object.prototype.hasOwnProperty.call(host, 'person') && !host.person) return null; // the host says nobody is signed in (a token may still be saved)
    var tok = host.token || (typeof SESSION !== 'undefined' && SESSION && SESSION.token) || null;
    var role = (typeof SESSION !== 'undefined' && SESSION && SESSION.role) || '';
    return tok && role !== 'customer' ? tok : null;
  }

  /** the identity mount of a bell control (this screen's code + U1nn, the list control's rule); none until the page names its screen */
  function bellMount(component) {
    return root.CBScreenId && root.CBScreenId.mountAttr ? root.CBScreenId.mountAttr(component) : '';
  }

  /** the popup-code chip of this popover (a literal POP code, the one the register holds for it); nothing on a page without screen-id.js */
  function bellChip(code, place) {
    return root.CBScreenId && root.CBScreenId.popupChip ? root.CBScreenId.popupChip(code, place) : '';
  }

  /** the bell button with its count dot, as markup */
  function bellButtonHtml(bell) {
    var dot = bell.count > 0 ? '<span class="cbb-dot" data-testid="bell-dot" aria-hidden="true">' + (bell.count > 99 ? '99+' : bell.count) + '</span>' : '';
    return (
      '<button type="button" class="cbb-btn" data-cbsid="CMP030-B01"' + bellMount('CMP030') + ' data-testid="bell-btn" aria-haspopup="true" aria-expanded="' +
      (bell.open ? 'true' : 'false') +
      '" aria-label="' +
      esc(T(W.aria)) +
      (bell.count ? ' (' + bell.count + ')' : '') +
      '">🔔' +
      dot +
      '</button>'
    );
  }

  /** one notification row, as markup */
  function recordHtml(x) {
    return (
      '<button type="button" class="cbb-row" data-cbsid="CMP038-B01"' + bellMount('CMP038') + ' data-testid="bell-row"' +
      (x.chit ? ' data-chit="' + esc(x.chit) + '"' : ' disabled') +
      (x.order ? ' data-order="1"' : '') +
      '><span aria-hidden="true">' +
      x.i +
      '</span><span style="min-width:0">' +
      '<div class="cbb-t">' +
      (x.who ? '<b>' + esc(x.who) + '</b> ' : '') +
      esc(x.say) +
      ' <b>' +
      esc(x.subj) +
      '</b></div>' +
      (x.d ? '<div class="cbb-d">' + esc(x.d) + '</div>' : '') +
      '<div class="cbb-s">' +
      esc(x.s) +
      '</div></span></button>'
    );
  }

  /** the open panel: title, the rows (yours first) or the error / empty line, and the footer with Clear all */
  function panelHtml(bell) {
    var items = bell.rows.map(line),
      mine = items.filter(function (x) {
        return x.mine;
      }),
      rest = items.filter(function (x) {
        return !x.mine;
      });
    var body = bell.err
      ? '<div class="cbb-none" data-testid="bell-error">' + esc(T(W.readFail)) + '</div>'
      : items.length
        ? (mine.length ? '<div class="cbb-sec">' + esc(T(W.forYou)) + '</div>' + mine.map(recordHtml).join('') : '') +
          (rest.length ? (mine.length ? '<div class="cbb-sec">' + esc(T(W.rest)) + '</div>' : '') + rest.map(recordHtml).join('') : '')
        : '<div class="cbb-none" data-testid="bell-empty">' + esc(T(W.none)) + '</div>';
    return (
      '<div class="cbb-panel" data-testid="bell-panel" role="dialog" aria-label="' +
      esc(T(W.title)) +
      '"><div class="cbb-hd">' + bellChip('POP113', 'margin-inline-end:8px') +
      esc(T(W.title)) +
      '</div>' +
      body +
      '<div class="cbb-ft"><span class="cbb-out" data-testid="bell-out" data-tone="' +
      esc(bell.tone) +
      '">' +
      esc(bell.out) +
      '</span>' +
      '<button type="button" class="cbb-clear" data-cbsid="CMP014-B01"' + bellMount('CMP014') + ' data-testid="bell-clear"' +
      (items.length ? '' : ' disabled') +
      '>' +
      esc(T(W.clear)) +
      '</button></div></div>'
    );
  }

  function mount(el, opts) {
    el = typeof el === 'string' ? doc.getElementById(el) : el;
    if (!el) return null;
    opts = opts || {};
    if (el.__cbbell) el.__cbbell.destroy();
    sweep();
    addCss();
    ensureEP();
    var bell = { rows: [], count: 0, open: false, es: null, up: false, backoff: 5000, timer: null, dead: false, err: false, out: '', tone: '' };
    if (!el.getAttribute('data-testid')) el.setAttribute('data-testid', 'bell');
    /* a host's own slot keeps its name (the shell's is shell-bell) */ if (!/\bcbb\b/.test(el.className))
      el.className = (el.className ? el.className + ' ' : '') + 'cbb';

    function paint() {
      if (bell.dead) return;
      el.innerHTML = bellButtonHtml(bell) + (bell.open ? panelHtml(bell) : '');
    }
    function setCount(total) {
      total = Number(total) || 0;
      if (total === bell.count) return;
      bell.count = total;
      try {
        el.dispatchEvent(new CustomEvent('cb:rail', { bubbles: true, detail: { module: 'bell', result: { count: total } } }));
      } catch (_) { /* the repaint event is a courtesy to the host; its listener's fault must not stop the bell */ }
    }
    /** ONE read of the feed (never polled) */
    function read() {
      if (bell.dead || !whoToken(opts)) return Promise.resolve();
      return call(opts, 'notifications')
        .then(function (reply) {
          if (bell.dead) return;
          bell.err = false;
          bell.rows = (reply && reply.notifications) || [];
          setCount(reply && reply.count != null ? reply.count : bell.rows.length);
          paint();
        })
        .catch(function () {
          if (bell.dead) return;
          bell.err = true;
          paint();
        });
    }
    /* the stream: ticket -> EventSource; an arrival re-reads once; a drop re-tickets with backoff (a reconnect, not a poll) */
    function connect() {
      if (bell.dead || bell.es || !root.EventSource || !whoToken(opts)) return;
      call(opts, 'eventsTicket')
        .then(function (reply) {
          if (bell.dead || bell.es) return;
          if (!reply || !reply.ticket) {
            retry();
            return;
          }
          var base = opts.apiBase || opts.base || (typeof CFG !== 'undefined' && CFG && CFG.API_BASE) || '';
          var node = new root.EventSource(base + '/api/events/stream?t=' + encodeURIComponent(reply.ticket));
          bell.es = node;
          node.addEventListener('hello', function () {
            bell.up = true;
            bell.backoff = 5000;
          });
          node.addEventListener('cb', function () {
            read();
          });
          node.onerror = function () {
            try {
              node.close();
            } catch (_) { /* already closed by the browser: the retry below opens a fresh stream */ }
            bell.es = null;
            bell.up = false;
            retry();
          };
        })
        .catch(retry);
    }
    function retry() {
      if (bell.dead || !whoToken(opts)) return;
      clearTimeout(bell.timer);
      bell.timer = setTimeout(connect, bell.backoff);
      bell.backoff = Math.min(bell.backoff * 2, 60000);
    }

    function toggle() {
      bell.open = !bell.open;
      bell.out = '';
      bell.tone = '';
      paint();
      /* OPENING IS SEEING: looking moves the watermark, so the dot clears without a "mark all read" button */
      if (bell.open) {
        call(opts, 'notifSeen')
          .then(function () {
            setCount(0);
            paint();
          })
          .catch(function () { /* a failed clear leaves the list as it was; the next read says the truth */ });
        read();
      }
    }
    function onClick(ev) {
      ev.__cbbIn = true; /* this press was ours: its target is repainted away, so the document handler cannot tell by contains() */
      var node = ev.target;
      if (!node.closest) return;
      if (node.closest('[data-testid="bell-btn"]')) {
        toggle();
        return;
      }
      var r = node.closest('[data-testid="bell-row"]');
      if (r && r.getAttribute('data-chit')) {
        var id = r.getAttribute('data-chit');
        bell.open = false;
        paint();
        if (typeof opts.onOpen === 'function') opts.onOpen(id);
        else if (typeof root.openChitSheet === 'function') root.openChitSheet(id);
        else if (typeof root.openChit === 'function') root.openChit(id);
        /* O4: a page with no chit sheet (Home) sends the press to where the chit opens - never closes the list and does nothing.
         TO1b (REQUIREMENT §6): a NEW ORDER opens in Tasks & Orders — the shop's task — not the CRM's list; AX1: unless this edition leaves Tasks out (the CRM's chit, then) */
        else if (r.getAttribute('data-order') && !(root.CBEdition && root.CBEdition.hidesHref('/tasks.html')))
          root.location.href = '/tasks.html?open=' + encodeURIComponent(id);
        else root.location.href = '/crm.html#/chits?open=' + encodeURIComponent(id);
        return;
      }
      var c = node.closest('[data-testid="bell-clear"]');
      if (c && !c.disabled) clearAll(c);
    }
    function clearAll(btn) {
      if (typeof CBAction === 'undefined' || !CBAction || typeof CBAction.run !== 'function')
        throw new Error('CBBell needs CBAction (app/accounts-shell.js) on the page — a clear is a write');
      CBAction.run(
        btn,
        function () {
          return call(opts, 'notifDismiss', { body: { all: true } });
        },
        {
          key: 'bell:clear',
          confirm: { title: T(W.ask), body: esc(T(W.askBody)), yes: T(W.clear) },
          outcome: function () {
            bell.rows = [];
            bell.out = T(W.cleared);
            bell.tone = 'ok';
            setCount(0);
            paint();
          },
          onFail: function (w, e) {
            bell.out = e && e.code === 'NOTIF_DISMISS_NOT_MIGRATED' ? T(W.needs) : w;
            bell.tone = 'error';
            paint();
          }
        }
      );
    }
    /* a click in a dialog (the Clear all confirm) is not a click away: the panel stays to show what the clear did */
    function onDoc(ev) {
      if (bell.open && !ev.__cbbIn && !el.contains(ev.target) && !(ev.target.closest && ev.target.closest('dialog'))) {
        bell.open = false;
        paint();
      }
    }
    function onKey(ev) {
      if (bell.open && ev.key === 'Escape') {
        bell.open = false;
        paint();
      }
    }

    el.addEventListener('click', onClick);
    doc.addEventListener('click', onDoc);
    doc.addEventListener('keydown', onKey);
    var apiObj = {
      el: el,
      refresh: read,
      count: function () {
        return bell.count;
      },
      destroy: function () {
        bell.dead = true;
        clearTimeout(bell.timer);
        if (bell.es) {
          try {
            bell.es.close();
          } catch (_) { /* a stream that will not close is dropped with the bell anyway */ }
        }
        bell.es = null;
        el.removeEventListener('click', onClick);
        doc.removeEventListener('click', onDoc);
        doc.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        delete el.__cbbell;
        var i = LIVE.indexOf(apiObj);
        if (i >= 0) LIVE.splice(i, 1);
      }
    };
    el.__cbbell = apiObj;
    LIVE.push(apiObj);
    if (!whoToken(opts)) {
      el.innerHTML = '';
      return apiObj;
    } // signed out / a customer: no bell, no stream
    paint();
    read();
    connect();
    return apiObj;
  }

  root.CBBell = { mount: mount, line: line, EP: BELL_EP };
})(typeof window !== 'undefined' ? window : this);
