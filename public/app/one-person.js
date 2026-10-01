/* one-person.js — ONE BROWSER, ONE SHOP AT A TIME.
 *
 * Athi, 2026-10-01, testing live: *"the user ids are not matching. i have signed in as tallytest in one page, and in
 * the next page, i opened the index page and it says alpha timers, and when i clicked the till, it asked for the pin
 * and when i give it went to mayuri123."* And then the rule: *"the very first check is to see any fingerprint of any
 * other entity here. if so make sure that it logs out and very clear. do not allow the shop to open until the
 * browser or session is clear out of danger."*
 *
 * This file is the LOGIC of that check, shared by app.html (whose route() is the one gate a shop opens through) and
 * the index page. It paints nothing: each page paints the answer in its own way, from the same sentences.
 *
 * What counts as another shop's fingerprint in this browser (traces()):
 *   · cb_sess holding another shop's live session
 *   · another tab of the app, signed in as another shop (asked over a BroadcastChannel)
 *   · unsent work the last shop left here: CBOffline drafts (cb.draft.*) and its outbox (cb.outbox.v1). Neither is
 *     tagged with a shop, so cb_owner — written ONLY by claim(), when the gate opens a shop — says whose they are.
 *   · the browser counter paired to another shop — read from the counter's OWN keys, never written (till.html is
 *     the counter's; its sign-in is the only thing that may switch it — C:\dev\SPEC-counter-identity.md, G1).
 *
 * Who a shop IS = the signed id inside the token (parent_entity_id, else identity_id). Never a name: a co-assist and
 * the owner of ONE shop are one entity and pass each other cleanly; two shops called "Mayur" are two entities.
 *
 * ⚠️ NOTHING HERE DELETES UNSENT WORK THAT COULD STILL BE SENT. The outbox is flushed by the other shop's own tab
 *    (its token, its shop) or it stays, and the check keeps saying so. Drafts (half-typed forms, never sent) are
 *    removed by clearOut() — the screen says they will be before the button is pressed.
 * e2e/one-person.cjs proves every branch; e2e/one-person-breaks.cjs breaks each guard once.
 */
(function (root) {
  'use strict';
  var CHANNEL = 'cb-one-person', OWNER = 'cb_owner', SESS = 'cb_sess', DRAFT = 'cb.draft.', OUTBOX = 'cb.outbox.v1';
  var ASK_MS = 300;          /* how long a check listens for other tabs — a live tab answers in a few ms */
  var LEAVE_MS = 2500;       /* how long clearOut waits for the other tabs to say they have signed out */

  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (_) {} }
  function lsDel(k) { try { root.localStorage.removeItem(k); } catch (_) {} }
  function lsKeys() { var out = []; try { for (var i = 0; i < root.localStorage.length; i++) out.push(root.localStorage.key(i)); } catch (_) {} return out; }
  function json(k) { try { return JSON.parse(lsGet(k) || 'null'); } catch (_) { return null; } }
  function jwt(t) {
    try { return JSON.parse(root.atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (_) { return null; }
  }

  /** who a stored session is — { ent: the shop, uid: the person (uk()'s suffix), name } — or null when it is no
   *  one: missing, unreadable, or expired (an expired session is signed out, as restoreSession treats it) */
  function who(s) {
    if (!s || !s.token) return null;
    var p = jwt(s.token);
    if (!p) return null;
    if (p.exp && p.exp * 1000 < Date.now()) return null;
    var ent = p.parent_entity_id || p.identity_id;
    if (!ent) return null;
    return { ent: String(ent), uid: String(p.identity_id || ent),
             name: String(s.entity || p.parent_entity_name || s.name || p.display_name || '') };
  }
  function stored() { return who(json(SESS)); }

  /* ── the counter's pairing, read-only ──────────────────────────────────────────────────────────────────────── */
  function slot() { var s = lsGet('cb_till_lastslot') || ''; return /^cb-till-[A-Za-z0-9_-]+$/.test(s) ? s : ''; }
  /* the counter's own copy of the shop (S, as the server answered its key). ⚠️ indexedDB.open() on a name that does
     not exist CREATES it — an empty database the counter would then open at version 1 with no stores. So: only a
     name the browser already lists, and an upgrade (= it did not exist) is aborted. */
  /** the names of this origin's IndexedDB databases, or null where the browser cannot list them */
  function dbNames() {
    var idb = root.indexedDB;
    if (!idb || typeof idb.databases !== 'function') return Promise.resolve(null);
    return idb.databases().then(function (l) { return (l || []).map(function (d) { return d && d.name; }).filter(Boolean); },
                                function () { return null; });
  }
  /** read one store of a database that ALREADY exists: fn(store) → a request; resolves its result, or null */
  function readExisting(name, storeName, fn) {
    var idb = root.indexedDB;
    return dbNames().then(function (names) {
      if (!names || names.indexOf(name) < 0) return null;
      return new Promise(function (res) {
        var done = false, fin = function (v) { if (!done) { done = true; res(v); } };
        var rq; try { rq = idb.open(name); } catch (_) { return fin(null); }
        rq.onupgradeneeded = function () { try { rq.transaction.abort(); } catch (_) {} fin(null); };
        rq.onerror = function () { fin(null); };
        rq.onblocked = function () { fin(null); };
        rq.onsuccess = function () {
          var db = rq.result;
          try {
            if (!db.objectStoreNames.contains(storeName)) { db.close(); return fin(null); }
            var g = fn(db.transaction(storeName, 'readonly').objectStore(storeName));
            g.onsuccess = function () { db.close(); fin(g.result == null ? null : g.result); };
            g.onerror = function () { db.close(); fin(null); };
          } catch (_) { try { db.close(); } catch (_e) {} fin(null); }
        };
        setTimeout(function () { fin(null); }, 1500);
      });
    });
  }
  function snapshot(sl) {
    if (!sl) return Promise.resolve(null);
    var mem = json(sl + '-kv-snapshot');                  /* the counter's own fallback when IndexedDB refused */
    if (mem) return Promise.resolve(mem);
    return readExisting(sl, 'kv', function (st) { return st.get('snapshot'); }).catch(function () { return null; });
  }
  /** how many rows wait in the counter's queues — every counter copy in this browser, IndexedDB and its
   *  localStorage fallback (<slot>-queue-<no>). Read-only. A queued row is a sale not yet at the shop. */
  function counterUnsent() {
    var mem = lsKeys().filter(function (k) { return k && /^cb-till[A-Za-z0-9_-]*-queue-/.test(k); }).length;
    return dbNames().then(function (names) {
      var slots = (names || []).filter(function (n) { return /^cb-till/.test(n); });
      return Promise.all(slots.map(function (n) { return readExisting(n, 'queue', function (st) { return st.count(); }); }));
    }).then(function (counts) { return mem + counts.reduce(function (a, c) { return a + (Number(c) || 0); }, 0); },
            function () { return mem; });
  }
  /** saves the Labs could not send yet (the 'offerlab' database's outbox, drained by combo-lab.html) — read-only */
  function labUnsent() {
    return readExisting('offerlab', 'outbox', function (st) { return st.count(); }).then(function (n) { return Number(n) || 0; }, function () { return 0; });
  }
  /** { paired:false } or { paired:true, ent, name, counter } — the shop this browser's counter is paired to.
   *  The server's answer (the snapshot) first; then the shop the counter was opened for; then the id the app
   *  recorded when it minted the key. */
  function counterPair() {
    var sl = slot(), key = lsGet('cb_till_key');
    if (!sl && !key) return Promise.resolve({ paired: false });
    var sfx = sl ? sl.slice(8) : '';
    var out = { paired: true,
      ent: (sfx && lsGet('cb_till_shop@' + sfx)) || '',
      name: (sfx && lsGet('cb_till_shopname@' + sfx)) || '',
      counter: (sfx && lsGet('cb_till_counter_name@' + sfx)) || lsGet('cb_till_name') || 'Counter 1' };
    return snapshot(sl).then(function (S) {
      if (S && S.entity_id) { out.ent = String(S.entity_id); if (S.shop && S.shop.name) out.name = String(S.shop.name); }
      if (!out.ent) out.ent = lsGet('cb_till_entity') || '';
      return out;
    });
  }

  /* ── the other tabs ────────────────────────────────────────────────────────────────────────────────────────── */
  var bc = null; try { bc = new root.BroadcastChannel(CHANNEL); } catch (_) { bc = null; }
  var me = { tab: Math.random().toString(36).slice(2), who: null, onLeave: null, quiet: false, label: null, onWipe: null };
  var waits = {};
  if (bc) bc.onmessage = function (e) {
    var m = (e && e.data) || {};
    if (m.t === 'roll') {                              /* every ChitBridge page answers, by the name a person knows it by */
      bc.postMessage({ t: 'present', q: m.q, tab: me.tab, label: (me.label && me.label()) || 'A ChitBridge tab' });
    } else if (m.t === 'wipe') {
      Promise.resolve().then(function () { return me.onWipe && me.onWipe(); }).catch(function () {})
        .then(function () { bc.postMessage({ t: 'wiped', q: m.q, tab: me.tab }); });
    } else if (m.t === 'who') {
      var w = !me.quiet && me.who && me.who();
      if (w) bc.postMessage({ t: 'here', q: m.q, tab: me.tab, ent: w.ent, uid: w.uid, name: w.name });
    } else if (m.t === 'leave') {
      var mine = me.who && me.who();
      if (!mine || mine.ent !== m.ent || !me.onLeave) return;
      Promise.resolve().then(function () { return me.onLeave(m.by || ''); }).catch(function () {})
        .then(function () { bc.postMessage({ t: 'left', q: m.q, tab: me.tab }); });
    } else if (/^(here|left|present|wiped)$/.test(m.t) && waits[m.q]) waits[m.q](m);
  };
  function ask(msg, ms, enough) {
    return new Promise(function (res) {
      if (!bc) return res([]);
      var q = Math.random().toString(36).slice(2), got = [], t = null;
      var end = function () { if (!waits[q]) return; delete waits[q]; clearTimeout(t); res(got); };
      waits[q] = function (m) { got.push(m); if (enough && enough(got)) end(); };
      t = setTimeout(end, ms);
      msg.q = q; bc.postMessage(msg);
      if (enough && enough(got)) end();          /* nobody to wait for (no tab answered 'who') — the message still went */
    });
  }
  /** a page says who it holds and what to do when told to leave. quiet: it answers 'leave' but not 'who' (the
   *  index page holds no work, so it never stops a sign-in; it still signs out when its shop is cleared) */
  function attach(o) { me.who = o.who || null; me.onLeave = o.onLeave || null; me.quiet = !!o.quiet;
                       me.label = o.label || null; me.onWipe = o.onWipe || null; }

  /* ── the check ─────────────────────────────────────────────────────────────────────────────────────────────── */
  /** everything in this browser that belongs to a shop other than `mine` ({ent}). Resolves
   *  { clean, others:[{ent,name,tabs,sess,drafts,outbox,uids,counter}], counter, pair } */
  function traces(mine) {
    var ent = String((mine && mine.ent) || '');
    var by = {}, list = [];
    var of = function (e, name) {
      var o = by[e];
      if (!o) { o = by[e] = { ent: e, name: '', tabs: 0, sess: false, drafts: 0, outbox: 0, uids: [], counter: false }; list.push(o); }
      if (!o.name && name) o.name = name;
      return o;
    };
    var uid = function (o, u) { if (u && o.uids.indexOf(u) < 0) o.uids.push(u); };
    var s = stored();
    if (s && s.ent !== ent) { var a = of(s.ent, s.name); a.sess = true; uid(a, s.uid); }
    var own = json(OWNER);
    if (own && own.ent && String(own.ent) !== ent) {
      var drafts = lsKeys().filter(function (k) { return k && k.indexOf(DRAFT) === 0; }).length;
      var outbox = (json(OUTBOX) || []).length;
      if (drafts || outbox) {
        var b = of(String(own.ent), own.name); b.drafts = drafts; b.outbox = outbox;
        (own.ids || []).forEach(function (u) { uid(b, u); });
      }
    }
    return Promise.all([ask({ t: 'who' }, ASK_MS), counterPair()]).then(function (r) {
      r[0].forEach(function (m) { if (m && m.ent && m.ent !== ent) { var c = of(m.ent, m.name); c.tabs++; uid(c, m.uid); } });
      var pair = r[1], counter = (pair.paired && pair.ent && pair.ent !== ent) ? pair : null;
      if (counter && by[counter.ent]) { by[counter.ent].counter = true; if (!by[counter.ent].name) by[counter.ent].name = counter.name; }
      return { clean: !list.length && !counter, others: list, counter: counter, pair: pair };
    });
  }

  /* ── the words, one copy for every page ────────────────────────────────────────────────────────────────────── */
  function shopName(o) { return (o && o.name) || 'another shop'; }
  function sentence(o) {
    var bits = [];
    if (o.tabs) bits.push(o.tabs === 1 ? 'an app tab open' : o.tabs + ' app tabs open');
    else if (o.sess) bits.push('still signed in');
    if (o.outbox) bits.push(o.outbox === 1 ? '1 change not sent yet' : o.outbox + ' changes not sent yet');
    if (o.drafts) bits.push(o.drafts === 1 ? '1 unsent draft' : o.drafts + ' unsent drafts');
    if (o.counter) bits.push('a counter paired to it');
    return 'This browser still holds ' + shopName(o) + ': ' + bits.join(' · ') + '. Close it first.';
  }
  function counterSentence(c) {
    return 'The counter here is paired to ' + shopName(c) + '. Switch it on the counter itself — its sign-in sends any unsent bills first.';
  }
  function buttonLabel(o) { return 'Sync and sign ' + shopName(o) + ' out'; }

  /* ── the clear-out ─────────────────────────────────────────────────────────────────────────────────────────── */
  /** tell o's tabs to send what they hold and sign out, wait for them, then remove o's session, drafts and saved
   *  screen settings from this browser. The outbox is never removed here. Resolves when done; re-run traces(). */
  function clearOut(o, byName) {
    return ask({ t: 'leave', ent: o.ent, by: byName || '' }, LEAVE_MS, function (got) { return got.length >= (o.tabs || 0); })
      .then(function () {
        var raw = json(SESS), p = raw && raw.token ? jwt(raw.token) : null;
        if (p && String(p.parent_entity_id || p.identity_id || '') === o.ent) lsDel(SESS);
        var own = json(OWNER) || {}, owned = String(own.ent || '') === o.ent;
        var ids = (o.uids || []).concat(owned ? (own.ids || []) : []);
        lsKeys().forEach(function (k) {
          if (!k) return;
          if (owned && k.indexOf(DRAFT) === 0) return lsDel(k);
          for (var i = 0; i < ids.length; i++) if (ids[i] && k.slice(-(ids[i].length + 1)) === '@' + ids[i]) return lsDel(k);
        });
        if (owned && !(json(OUTBOX) || []).length) lsDel(OWNER);
      });
  }
  /** the gate opened a shop: this browser's unsent work is now that shop's */
  function claim(mine) {
    if (!mine || !mine.ent) return;
    var own = json(OWNER) || {}, same = String(own.ent || '') === mine.ent, ids = same ? (own.ids || []) : [];
    if (mine.uid && ids.indexOf(mine.uid) < 0) ids = ids.concat([mine.uid]);
    lsSet(OWNER, JSON.stringify({ ent: mine.ent, name: mine.name || (same && own.name) || '', ids: ids }));
  }

  /* ── ⭐⭐ START WITH A CLEAN BROWSER (Athi, 2026-10-01: *"offer to open a new browser with clean slate, so it has
     no session information held anywhere across the board."*) A page cannot open a private window; this is the
     same slate, made here. In this order, and it stops at the first thing that is not safe:
       1  the counter's queue holds unsent bills → refuse, and say how many. A counter key is the one thing never
          wiped with work behind it. (Checked FIRST, so nobody is signed out for a clean-up that cannot happen.)
       2  every ChitBridge tab is told to send what it holds and sign out; a tab that does not answer is NAMED,
          and nothing is wiped
       3  every database on this origin is deleted — a delete that stays blocked means a page still holds it open
          (the counter page cannot be told: it is the counter's own) → named, and the keys are left as they are
       4  every cb* key in localStorage and sessionStorage, every cache, every service worker
     Resolves { ok:true, counter:'Counter 1' | '' } or { ok:false, unsent:n | silent:[labels] | blocked:[labels] } */
  var CB_KEY = /^cb[_.\-]/;              /* cb_sess, cb_till_*, cb_nav@<id>, cb.draft.*, cb.outbox.v1, cb-till-*-queue-* … */
  function cbKeys(store) { var out = []; try { for (var i = 0; i < store.length; i++) { var k = store.key(i); if (k && CB_KEY.test(k)) out.push(k); } } catch (_) {} return out; }
  function dbLabel(n) { return /^cb-till/.test(n) ? 'the counter tab' : (n === 'offerlab' ? 'a Lab tab' : 'a tab using ' + n); }
  function dropDb(name) {
    return new Promise(function (res) {
      var done = false, fin = function (v) { if (!done) { done = true; res(v); } };
      var rq; try { rq = root.indexedDB.deleteDatabase(name); } catch (_) { return fin(''); }
      rq.onsuccess = rq.onerror = function () { fin(''); };
      rq.onblocked = function () { setTimeout(function () { fin(dbLabel(name)); }, 2000); };
    });
  }
  function startClean() {
    /* ⚠️ the pair is read UP FRONT so a refusal can say WHOSE bills these are (Athi, live, 2026-10-01: "it is
       not stating for which shop the bills are pending") — a count with no shop is a number nobody can act on */
    return Promise.all([counterUnsent(), labUnsent(), counterPair()]).then(function (u) {
      if (u[0]) return { ok: false, unsent: u[0], shop: (u[2] && u[2].paired && shopName(u[2])) || '' };
      if (u[1]) return { ok: false, labUnsent: u[1] };
      return ask({ t: 'roll' }, ASK_MS).then(function (tabs) {
        return ask({ t: 'wipe' }, LEAVE_MS, function (got) { return got.length >= tabs.length; }).then(function (got) {
          var silent = tabs.filter(function (t) { return !got.some(function (g) { return g.tab === t.tab; }); }).map(function (t) { return t.label; });
          if (silent.length) return { ok: false, silent: silent };
          return counterPair().then(function (pair) {
            var known = [slot(), 'offerlab'].filter(Boolean);
            return dbNames().then(function (names) { return Promise.all((names || known).map(dropDb)); }).then(function (blocked) {
              blocked = blocked.filter(Boolean).filter(function (b, i, a) { return a.indexOf(b) === i; });
              if (blocked.length) return { ok: false, blocked: blocked };
              cbKeys(root.localStorage).forEach(lsDel);
              try { cbKeys(root.sessionStorage).forEach(function (k) { root.sessionStorage.removeItem(k); }); } catch (_) {}
              var caches = root.caches ? root.caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return root.caches.delete(k); })); }).catch(function () {}) : null;
              var sw = (root.navigator && root.navigator.serviceWorker && root.navigator.serviceWorker.getRegistrations)
                ? root.navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }).catch(function () {}) : null;
              return Promise.all([caches, sw]).then(function () { return { ok: true, counter: pair.paired ? pair.counter : '' }; });
            });
          });
        });
      });
    });
  }
  function cleanSentence(r) {
    if (r.unsent) return 'The counter still holds ' + r.unsent + (r.unsent === 1 ? ' unsent bill' : ' unsent bills') + (r.shop ? ' for ' + r.shop : '') + '. Open the counter and let it send them first.';
    if (r.labUnsent) return 'The Labs still hold ' + r.labUnsent + (r.labUnsent === 1 ? ' unsent save' : ' unsent saves') + '. Open the Combo Lab while online and let it send them first.';
    if (r.silent) return 'No answer from: ' + r.silent.join(', ') + '. Close ' + (r.silent.length === 1 ? 'it' : 'them') + ', then press again.';
    if (r.blocked) return 'Still open: ' + r.blocked.join(', ') + '. Close ' + (r.blocked.length === 1 ? 'it' : 'them') + ', then press again.';
    return 'This browser is clean.' + (r.counter ? ' ' + r.counter + ' will need pairing again.' : '');
  }

  root.CBOnePerson = { who: who, stored: stored, counterPair: counterPair, traces: traces, clearOut: clearOut,
    claim: claim, attach: attach, sentence: sentence, counterSentence: counterSentence, buttonLabel: buttonLabel,
    shopName: shopName, counterUnsent: counterUnsent, startClean: startClean, cleanSentence: cleanSentence };
})(typeof window !== 'undefined' ? window : this);
