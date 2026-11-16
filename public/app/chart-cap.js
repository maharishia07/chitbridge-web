/* app/chart-cap.js — CBChartCap: THE CHART ENGINE'S TWO DOORS (chart engine, 16 Nov 2026 · REQ PM/REQ-CHART-ENGINE-2026-11-16.md, critic points 2 and 4).
 * CARD 26-reporting-mis-and-bi/charts
 * OWNER    cb-reports (palette and UI codes: cb-ux-locale; the pref keys: cb-settings)
 * RISK     a chart page that fails to load the engine shows one sentence and its table; a lost pref write is held pending and sent again, never lost
 * ID       CHT-CAP
 *
 * OWNS      ready() — the ONE loader: a page that draws no chart never fetches chart code; a page about to draw asks ready() and gets one promise
 *           (the files are injected once, in order, with the build query where the page has one). app.html's ensureCap('chart') is a call to it; finance
 *           and the Home card call it directly · the person's chart choices chart_theme · chart_read · chart_fav_<kind>: get · set · hydrate · retry.
 * CALLED BY app.html (ensureCap) · finance.html (Trend, Cash) · index.html (shell.js, the Till teaser) · app/avatar.js hydrate() hands it the server's ui_prefs.
 * FLOW      a choice → localStorage cb_<key> + a pending mark (cb_chart_pending) → PATCH /api/entities/me/prefs/ui with that ONE key → ok:true clears the mark.
 *
 * ⚠️ THE CHART KEYS NEVER RIDE avatar.js push()'s full body. push() sends all eight old keys, '' meaning "drop"; a device that has not hydrated yet (offline
 * start, a failed read) would send chart keys at their defaults and delete the favourite. chartSet sends ONLY the key just changed, in a body of its own, and
 * its pending mark lives in ITS OWN store, so avatar.js's pending push never carries a chart key either way.
 * (Not "CBChart": that global is the chart of ACCOUNTS, engine chart.js.) The shape is checked here; the kinds are CBDraw.KINDS and the server's closed lists
 * (api lib/chart-prefs.js) decide.
 */
(function (root) {
  'use strict';
  var doc = root.document,
    FILES = ['/engine/chart-draw.js', '/app/chart-bar.js'],
    PENDING = 'cb_chart_pending',
    KEY = /^chart_(theme|read|fav_[a-z]+)$/,
    VALUE = /^[A-Za-z0-9][A-Za-z0-9-]{0,34}$/,
    loading = null;

  function ready() {
    if (root.CBDraw && root.CBChartBar) return Promise.resolve();
    if (loading) return loading;
    var bust = typeof CB_BUILD !== 'undefined' && CB_BUILD ? '?v=' + CB_BUILD : '';
    loading = Promise.all(
      FILES.map(function (file) {
        return new Promise(function (resolve, reject) {
          var node = doc.createElement('script');
          node.src = file + bust;
          node.async = false;
          node.onload = resolve;
          node.onerror = function () {
            loading = null; /* a failed load may be tried again; the caller says one sentence and leaves the table */
            reject(new Error('chart engine'));
          };
          (doc.head || doc.documentElement).appendChild(node);
        });
      })
    );
    return loading;
  }

  function store(name, value) {
    try {
      if (value === undefined) return root.localStorage.getItem(name);
      if (value === null) root.localStorage.removeItem(name);
      else root.localStorage.setItem(name, value);
    } catch (error) {
      unsent(error);
    }
    return null;
  }
  function pendingGet() {
    try {
      var parsed = JSON.parse(store(PENDING) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      unsent(error);
      return {};
    }
  }
  function pendingPut(marks) {
    store(PENDING, Object.keys(marks).length ? JSON.stringify(marks) : null);
  }
  function chosen(key) {
    return KEY.test(key) ? store('cb_' + key) || '' : '';
  }
  /** a chart key that did not reach the server: its pending mark stays, so the next hydrate or the 'online' event sends it again */
  function unsent(error) {
    if (root.console) root.console.warn('chart-cap: chart pref not sent yet', error && error.message);
  }
  /** this device's chart keys: the ones the server sent plus any already held here */
  function held(server) {
    var found = {};
    Object.keys(server || {}).forEach(function (key) {
      if (KEY.test(key)) found[key] = 1;
    });
    try {
      for (var at = 0; at < root.localStorage.length; at++) {
        var name = String(root.localStorage.key(at) || '');
        if (name.indexOf('cb_chart_') === 0 && KEY.test(name.slice(3))) found[name.slice(3)] = 1;
      }
    } catch (error) {
      unsent(error);
    }
    return Object.keys(found);
  }
  /** the api's address: what the avatar was mounted with, else the page's own, else the one stored for it */
  function baseOf(host) {
    if (host.apiBase) return host.apiBase;
    return root.CB_API || store('cb_api_base') || '';
  }
  function doorOf() {
    var host = (root.CBAvatar && root.CBAvatar.host && root.CBAvatar.host()) || {},
      session = {};
    try {
      session = JSON.parse(root.localStorage.getItem('cb_sess') || '{}') || {};
    } catch (error) {
      unsent(error);
    }
    return { base: baseOf(host), token: host.token || session.token || '', off: host.sync === false };
  }
  /** one chart key to the server, alone ('' removes it); the pending mark goes when the server answers ok:true with that value */
  function push(key) {
    var door = doorOf();
    if (door.off || !door.token || !root.fetch) return;
    var body = {};
    body[key] = chosen(key);
    try {
      root
        .fetch(door.base + '/api/entities/me/prefs/ui', {
          method: 'PATCH',
          cache: 'no-store',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + door.token },
          body: JSON.stringify(body)
        })
        .then(function (reply) {
          return reply.ok ? reply.json() : null;
        })
        .then(function (reply) {
          if (!reply || reply.ok !== true || reply.pending) return;
          var marks = pendingGet();
          if (marks[key] === body[key]) delete marks[key];
          pendingPut(marks);
        })
        .catch(unsent);
    } catch (error) {
      unsent(error);
    }
  }
  function set(key, value) {
    var text = value == null ? '' : String(value);
    if (!KEY.test(key) || (text && !VALUE.test(text))) return false;
    store('cb_' + key, text || null);
    var marks = pendingGet();
    marks[key] = text; /* a removal is held as '' until the server has it */
    pendingPut(marks);
    push(key);
    return true;
  }
  /** the server's chart keys are the truth, like every other kind — except a key still pending here: kept, and sent again (alone) */
  function hydrate(prefs) {
    var changed = false;
    held(prefs).forEach(function (key) {
      var marks = pendingGet(),
        server = prefs[key] == null ? '' : String(prefs[key]);
      if (Object.prototype.hasOwnProperty.call(marks, key)) {
        if (server === marks[key]) {
          delete marks[key];
          pendingPut(marks);
        } else push(key);
        return;
      }
      if (server === chosen(key)) return;
      store('cb_' + key, server && VALUE.test(server) ? server : null);
      changed = true;
    });
    /* the bar of a chart already on screen reads the person's choices again (the server answered after the page drew) */
    if (changed && doc && root.CustomEvent) doc.dispatchEvent(new root.CustomEvent('cb:chartprefs'));
    return changed;
  }
  /** a choice made offline goes up when the connection is back: the chart keys alone, one at a time */
  function retry() {
    Object.keys(pendingGet()).forEach(push);
  }
  if (root.addEventListener) root.addEventListener('online', retry);

  root.CBChartCap = { ready: ready, chosen: chosen, set: set, hydrate: hydrate, pending: pendingGet };
})(typeof window !== 'undefined' ? window : this);
