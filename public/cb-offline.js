// cb-offline.js — Chit & Bridge offline-resilience primitive (dependency-free, drop-in).
// The product is online-first; this makes "the internet drops while half the work is happening" non-fatal WITHOUT
// weakening the governance model. It does NOT transact offline — nothing is committed on a disconnected device (the
// server still enforces RLS / freeze / verified rungs / definer guards at the real commit). It does two safe things:
//   1) DRAFTS — autosave/restore work-in-progress locally, so a drop/reload never loses a half-filled form.
//   2) OUTBOX — a mutation that can't reach the server is QUEUED and REPLAYS your real authenticated request on
//      reconnect (queue-and-replay), carrying an Idempotency-Key so a replay can never double-apply (needs the
//      server-side idempotency check — Phase 2; until then use submit() only for genuinely-offline captures).
// Storage is localStorage (small, synchronous, survives reload/crash). Swap to IndexedDB later for large payloads.
(function (root) {
  var LSK = 'cb.outbox.v1', DKP = 'cb.draft.';
  var ls = (function () { try { var t = '__cb'; root.localStorage.setItem(t, '1'); root.localStorage.removeItem(t); return root.localStorage; } catch (e) { return null; } })();
  var mem = {};   // fallback when localStorage is unavailable (private mode)
  function get(k) { try { return ls ? ls.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return mem[k] || null; } }
  function set(k, v) { try { if (ls) ls.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } }
  function del(k) { try { if (ls) ls.removeItem(k); else delete mem[k]; } catch (e) { delete mem[k]; } }
  function uuid() { return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }

  var cfg = { apiBase: '', token: function () { return null; }, onChange: function () {} };
  function online() { return !root.navigator || root.navigator.onLine !== false; }

  // ── drafts ──
  function saveDraft(key, data) { set(DKP + key, JSON.stringify({ at: Date.now(), data: data })); }
  function loadDraft(key) { var r = get(DKP + key); if (!r) return null; try { return JSON.parse(r).data; } catch (e) { return null; } }
  function draftAge(key) { var r = get(DKP + key); if (!r) return null; try { return Date.now() - JSON.parse(r).at; } catch (e) { return null; } }
  function clearDraft(key) { del(DKP + key); }

  // ── outbox ──
  function readQ() { var r = get(LSK); if (!r) return []; try { return JSON.parse(r); } catch (e) { return []; } }
  function writeQ(q) { set(LSK, JSON.stringify(q)); paint(); }
  function pending() { return readQ().length; }
  function enqueue(req) {
    var q = readQ();
    req.id = req.id || req.idem || uuid();
    if (q.some(function (x) { return x.id === req.id; })) return req.id;   // idempotent enqueue
    req.queued_at = Date.now(); req.tries = 0; q.push(req); writeQ(q); return req.id;
  }
  function rawSend(req) {
    var h = { 'Content-Type': 'application/json', 'Idempotency-Key': req.id };
    var tok = cfg.token && cfg.token(); if (tok) h.Authorization = 'Bearer ' + tok;
    return root.fetch(cfg.apiBase + req.path, { method: req.method || 'POST', headers: h, body: req.body ? JSON.stringify(req.body) : undefined });
  }
  // classify a response: done (drop), reject (drop + surface — a 4xx won't fix itself on retry), retry (keep)
  function classify(status) {
    if ((status >= 200 && status < 300) || status === 409) return 'done';   // 409 = server saw this Idempotency-Key already
    if (status >= 400 && status < 500) return 'reject';
    return 'retry';
  }
  var flushing = false;
  function flush() {
    if (flushing || !online()) return Promise.resolve({ sent: 0, pending: pending() });
    flushing = true;
    var q = readQ(), still = [], rejected = [], sent = 0;
    return q.reduce(function (p, req) {
      return p.then(function () {
        return rawSend(req).then(function (r) {
          var k = classify(r.status);
          if (k === 'done') { sent++; }
          else if (k === 'reject') { req.tries++; req.error = 'rejected ' + r.status; rejected.push(req); }
          else { req.tries++; still.push(req); }
        }).catch(function () { req.tries++; still.push(req); });   // network error → keep for next reconnect
      });
    }, Promise.resolve()).then(function () {
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
      return rawSend(req).then(function (r) {
        var k = classify(r.status);
        if (k === 'retry') { enqueue(req); return { ok: true, queued: true, online: false, id: req.id }; }
        return { ok: k === 'done', online: true, status: r.status, res: r, id: req.id };
      }).catch(function () { enqueue(req); return { ok: true, queued: true, online: false, id: req.id }; });
    }
    enqueue(req); return Promise.resolve({ ok: true, queued: true, online: false, id: req.id });
  }

  function paint() { try { cfg.onChange({ online: online(), pending: pending() }); } catch (e) {} }
  function configure(c) { for (var k in c) if (c.hasOwnProperty(k)) cfg[k] = c[k]; paint(); return API; }

  if (root.addEventListener) {
    root.addEventListener('online', function () { paint(); flush(); });
    root.addEventListener('offline', paint);
  }

  var API = { configure: configure, online: online, saveDraft: saveDraft, loadDraft: loadDraft, draftAge: draftAge,
    clearDraft: clearDraft, submit: submit, enqueue: enqueue, flush: flush, pending: pending, _classify: classify, _uuid: uuid };
  root.CBOffline = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
