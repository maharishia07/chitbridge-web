// cb-offline.js — Chit & Bridge offline-resilience primitive (dependency-free, drop-in).
// The product is online-first; this makes "the internet drops while half the work is happening" non-fatal WITHOUT
// weakening the governance model. It does NOT transact offline — nothing is committed on a disconnected device (the
// server still enforces RLS / freeze / verified rungs / definer guards at the real commit). It does two safe things:
//   1) DRAFTS — autosave/restore work-in-progress locally, so a drop/reload never loses a half-filled form.
//   2) OUTBOX — a mutation that can't reach the server is QUEUED and REPLAYS your real authenticated request on
//      reconnect (queue-and-replay), carrying an Idempotency-Key so a replay can never double-apply (needs the
//      server-side idempotency check — Phase 2; until then use submit() only for genuinely-offline captures).
// Storage is localStorage (small, synchronous, survives reload/crash). Swap to IndexedDB later for large payloads.
// OWNS the drafts and the outbox · CALLED BY every page that saves work (app.html, till.html, the small apps) through CBOffline.
// FLOW  submit(req) → online? send → classify (done · reject · retry) → retry/offline: enqueue → 'online' event → flush() replays      CARD 28-platform-and-operations/offline
(function (root) {
  var LSK = 'cb.outbox.v1',
    DKP = 'cb.draft.';
  var ls = (function () {
    try {
      var t = '__cb';
      root.localStorage.setItem(t, '1');
      root.localStorage.removeItem(t);
      return root.localStorage;
    } catch (e) {
      return null;
    }
  })();
  var mem = {}; // fallback when localStorage is unavailable (private mode)
  function get(k) {
    try {
      return ls ? ls.getItem(k) : k in mem ? mem[k] : null;
    } catch (e) {
      return mem[k] || null;
    }
  }
  function set(k, v) {
    try {
      if (ls) ls.setItem(k, v);
      else mem[k] = v;
    } catch (e) {
      mem[k] = v;
    }
  }
  function del(k) {
    try {
      if (ls) ls.removeItem(k);
      else delete mem[k];
    } catch (e) {
      delete mem[k];
    }
  }
  function uuid() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  var cfg = {
    apiBase: '',
    token: function () {
      return null;
    },
    onChange: function () {}
  };
  function online() {
    return !root.navigator || root.navigator.onLine !== false;
  }

  // ── drafts ──
  function saveDraft(key, data) {
    set(DKP + key, JSON.stringify({ at: Date.now(), data: data }));
  }
  function loadDraft(key) {
    var r = get(DKP + key);
    if (!r) return null;
    try {
      return JSON.parse(r).data;
    } catch (e) {
      return null;
    }
  }
  function draftAge(key) {
    var r = get(DKP + key);
    if (!r) return null;
    try {
      return Date.now() - JSON.parse(r).at;
    } catch (e) {
      return null;
    }
  }
  function clearDraft(key) {
    del(DKP + key);
  }

  // ── outbox ──
  function readQ() {
    var r = get(LSK);
    if (!r) return [];
    try {
      return JSON.parse(r);
    } catch (e) {
      return [];
    }
  }
  function writeQ(q) {
    set(LSK, JSON.stringify(q));
    paint();
  }
  function pending() {
    return readQ().length;
  }
  function enqueue(req) {
    var list = readQ();
    req.id = req.id || req.idem || uuid();
    if (
      list.some(function (x) {
        return x.id === req.id;
      })
    )
      return req.id; // idempotent enqueue
    req.queued_at = Date.now();
    req.tries = 0;
    list.push(req);
    writeQ(list);
    return req.id;
  }
  function rawSend(req) {
    var h = { 'Content-Type': 'application/json', 'Idempotency-Key': req.id };
    var tok = cfg.token && cfg.token();
    if (tok) h.Authorization = 'Bearer ' + tok;
    return root.fetch(cfg.apiBase + req.path, { method: req.method || 'POST', headers: h, body: req.body ? JSON.stringify(req.body) : undefined });
  }
  // classify a response: done (drop), reject (drop + surface — a 4xx won't fix itself on retry), retry (keep)
  // PAY-FIX L3: a replayed key answers with the FIRST answer (2xx), so a 409 is never "done". IDEMPOTENCY_IN_PROGRESS means the
  // first try is still running (or died) — keep it and try again; any other 409 is the shop's own conflict — surface it.
  function classify(status, code) {
    if (status >= 200 && status < 300) return 'done';
    if (status === 409 && code === 'IDEMPOTENCY_IN_PROGRESS') return 'retry';
    if (status >= 400 && status < 500) return 'reject';
    return 'retry';
  }
  // the machine code of a 409 body (null when the body is not JSON) — read from a clone so the caller can still read the response
  function codeOf(response) {
    if (response.status !== 409 || !response.clone) return Promise.resolve(null);
    return response
      .clone()
      .json()
      .then(
        function (body) {
          return (body && body.code) || null;
        },
        function () {
          return null;
        }
      );
  }
  // send one request and classify its answer: → { response, kind } (kind: done · reject · retry); a network failure rejects
  function sendAndClassify(req) {
    return rawSend(req).then(function (response) {
      return codeOf(response).then(function (code) {
        return { response: response, kind: classify(response.status, code) };
      });
    });
  }
  var flushing = false;
  function flush() {
    if (flushing || !online()) return Promise.resolve({ sent: 0, pending: pending() });
    flushing = true;
    var list = readQ(),
      still = [],
      rejected = [],
      sent = 0;
    return list
      .reduce(function (total, req) {
        return total.then(function () {
          return sendAndClassify(req)
            .then(function (result) {
              if (result.kind === 'done') {
                sent++;
              } else if (result.kind === 'reject') {
                req.tries++;
                req.error = 'rejected ' + result.response.status;
                rejected.push(req);
              } else {
                req.tries++;
                still.push(req);
              }
            })
            .catch(function () {
              req.tries++;
              still.push(req);
            }); // network error → keep for next reconnect
        });
      }, Promise.resolve())
      .then(function () {
        writeQ(still);
        flushing = false;
        if (rejected.length && cfg.onReject) cfg.onReject(rejected);
        return { sent: sent, pending: still.length, rejected: rejected.length };
      });
  }
  // submit now if online (and return the live response so callers can use the server id); else capture to the outbox.
  function submit(req) {
    req.id = req.id || req.idem || uuid();
    if (online()) {
      return sendAndClassify(req)
        .then(function (result) {
          if (result.kind === 'retry') {
            enqueue(req);
            return { ok: true, queued: true, online: false, id: req.id };
          }
          return { ok: result.kind === 'done', online: true, status: result.response.status, res: result.response, id: req.id };
        })
        .catch(function () {
          enqueue(req);
          return { ok: true, queued: true, online: false, id: req.id };
        });
    }
    enqueue(req);
    return Promise.resolve({ ok: true, queued: true, online: false, id: req.id });
  }

  function paint() {
    try {
      cfg.onChange({ online: online(), pending: pending() });
    } catch (e) {}
  }
  function configure(c) {
    for (var k in c) if (c.hasOwnProperty(k)) cfg[k] = c[k];
    paint();
    return API;
  }

  if (root.addEventListener) {
    root.addEventListener('online', function () {
      paint();
      flush();
    });
    root.addEventListener('offline', paint);
  }

  // ── autodraft (Phase 4.1) — autosave EVERY field under a container to ONE draft key; restore on (re)render.
  // Call after the container is in the DOM; call clearDraft(key) when the form submits. Never persists secrets
  // (password/file/hidden/checkbox/radio, or ids that look like pin/otp/password/cvv/secret). Returns true if it
  // restored anything. opts.overwrite=true restores OVER prefilled values (for server-loaded forms like the vault).
  function autodraft(container, key, opts) {
    if (!container || !container.querySelectorAll) return false;
    opts = opts || {};
    var skip = /pin|otp|password|pwd|cvv|secret/i;
    var eligible = function (f) {
      var id = f.id || f.name;
      if (!id || skip.test(id)) return null;
      var t = (f.type || '').toLowerCase();
      if (t === 'password' || t === 'file' || t === 'hidden' || t === 'checkbox' || t === 'radio') return null;
      return id;
    };
    var collect = function () {
      var o = {},
        fs = container.querySelectorAll('input,textarea,select');
      for (var index = 0; index < fs.length; index++) {
        var id = eligible(fs[index]);
        if (id && fs[index].value != null && fs[index].value !== '') o[id] = fs[index].value;
      }
      return o;
    };
    var saved = loadDraft(key) || {},
      restored = false,
      fs = container.querySelectorAll('input,textarea,select');
    for (var index = 0; index < fs.length; index++) {
      var id = eligible(fs[index]);
      if (!id) continue;
      if (saved[id] != null && (opts.overwrite || fs[index].value === '' || fs[index].value == null)) {
        fs[index].value = saved[id];
        restored = true;
      }
      var h = function () {
        saveDraft(key, collect());
      };
      fs[index].addEventListener('input', h);
      fs[index].addEventListener('change', h);
    }
    return restored;
  }

  // ── service worker (Phase 3) — app opens offline + read-cache. Safe no-op where SW is unavailable. ──
  function registerSW(path) {
    try {
      if (root.navigator && 'serviceWorker' in root.navigator) root.navigator.serviceWorker.register(path || '/cb-sw.js').catch(function () {});
    } catch (e) {}
  }

  var API = {
    configure: configure,
    online: online,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    draftAge: draftAge,
    clearDraft: clearDraft,
    autodraft: autodraft,
    submit: submit,
    enqueue: enqueue,
    flush: flush,
    pending: pending,
    registerSW: registerSW,
    _classify: classify,
    _uuid: uuid
  };
  root.CBOffline = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
