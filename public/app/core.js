/* app/core.js — shared client module for the Task Panel (module 1 of the app split).
 * Loaded by /app.html BEFORE its main inline script (classic script, shared global scope).
 * Exposes: fill(), unwrap() (the {ok,data,error} envelope), api() (auth + 401/422/500 branching).
 * Depends on host globals defined in app.html: EP, CFG, SESSION, demoApi, go.
 * Pattern for a NEW panel: add one EP row + one mapper, then a panel module that calls api(). */

function fill(path, params){ return path.replace(/:(\w+)/g, (_, k) => encodeURIComponent((params && params[k]) ?? "")); }

// Single response envelope. Accepts a real {ok,data,error} envelope, or normalises the legacy
// wrappers ({chits,…}, {entity}, {messages,…}, …) so feature code uses `data` directly.
function unwrap(j){
  if(j==null||typeof j!=="object"||Array.isArray(j)) return j;
  if("ok" in j && ("data" in j || "error" in j)){ if(j.ok===false) throw new Error(j.error||"Request failed"); return j.data; }
  /**
   * ⚠️ `has_catalogue` JOINS THIS LIST BECAUSE THE LINE BELOW WAS EATING THE ANSWER (found 2026-08-14, driving the
   * picker under Playwright after three failed attempts by hand).
   *
   * The catalogue-overlay response is a COMPOUND: {has_catalogue, items[], match, ambiguous, candidates[]}. The
   * array-collapse below sees `items` and returns ONLY that array — so `candidates`, `ambiguous` and `match` were
   * silently discarded before any caller saw them. The picker read `cat.candidates` on what was actually a bare
   * array, got undefined, and fell through to the quantity stepper with no error anywhere.
   *
   * ⚠️ AND IT HAD BEEN BREAKING THE OLDER FEATURE ALL ALONG: the "which item?" sheet reads `cat.items`, which on
   * an array is also undefined — so that list has been rendering "No catalogue yet" since the day it was written,
   * on entities with a full catalogue. One convention, applied to a response it was never designed for, quietly
   * disabled two features and produced not a single error message.
   */
  /**
   * ⚠️ `searched` JOINS THE LIST FOR THE THIRD INSTANCE OF THIS EXACT BUG (2026-08-16, found by Athi within
   * minutes of the deploy: *"find product is not finding the product"*).
   *
   * `/suppliers/availability` returns a COMPOUND — {q, results[], count, searched} — and the collapse below sees
   * `results` and returns ONLY that array. `r.results` was then undefined at every call site, so a working
   * endpoint answered "no supplier lists that" for every product on the shelf.
   *
   * ⭐ THE PATTERN IS NOW UNMISTAKABLE: a compound response whose array key happens to be on the collapse list
   * loses everything else, silently, with no error anywhere. It has now disabled the catalogue overlay, the
   * "which item?" sheet, and this. `supCatalogueFull` bypasses api() entirely for the same reason.
   * ⚠️ IF YOU ADD AN ENDPOINT THAT RETURNS AN ARRAY BESIDE ANY OTHER KEY, IT BELONGS ON THIS LINE.
   */
  if("token" in j || "my_disputes" in j || "header" in j || "has_catalogue" in j || "searched" in j) return j; // auth / structured / compound -> whole, untouched
  for(const k of ["chits","messages","connections","requests","suppliers","items","results","actors"]) if(Array.isArray(j[k])){ const a=j[k]; for(const mk of ["total","page","limit"]) if(mk in j){ try{ Object.defineProperty(a, mk, {value:j[mk], enumerable:false, configurable:true, writable:true}); }catch(_){ a[mk]=j[mk]; } } return a; }
  if(j.entity) return j.entity;
  if(j.settings) return j.settings;
  if(j.chit) return j.chit;
  return j;
}

// --- shared in-flight feedback (every panel goes through api(), so this is uniform) ---
let _inflight = 0;
const _lockKeys = new Set();
/**
 * ⭐ SAY IT IN WORDS (Athi, 2026-08-16: *"we have to show explicit inprogress bar while reading the data, what
 * you are showing as part of the browser is not good enough"*).
 *
 * There WAS a bar — a 3px gradient hairline pinned to the top of the window. Three things were wrong with it:
 * it sat at the extreme top of the WINDOW, where browser and dev chrome also live, it was thin enough to read as
 * decoration, and — the one that actually mattered — it carried NO WORDS, so it never actually
 * said that data was being read. A silent hairline is not feedback; it is an animation.
 *
 * Now it is a labelled pill — "Reading data…" plus the count when several reads are in flight — beside a thicker
 * sweep. Driven from the one place every panel already funnels through, so no screen has to remember to show it.
 *
 * ⚠️ A SHORT DELAY BEFORE IT APPEARS. A read that returns in 80ms should not flash a banner; a spinner that
 * blinks on every keystroke-driven fetch is worse than none. It waits ~180ms, so only reads a person can
 * actually perceive get announced.
 */
let _netBusyT = null;
function _netBusy(on){
  let b = document.getElementById('netbusy');
  if(!b){
    b = document.createElement('div'); b.id='netbusy';
    b.style.cssText='position:fixed;z-index:9999;pointer-events:none;display:none';
    b.innerHTML='<div id="netbusy-card"><span id="netbusy-ring"></span><span id="netbusy-txt">Reading data…</span></div>';
    const s=document.createElement('style');
    s.textContent='@keyframes nbspin{to{transform:rotate(360deg)}}'
      +'@keyframes nbin{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'
      +'#netbusy-card{display:inline-flex;align-items:center;gap:9px;background:#0F2E3D;color:#fff;'
      +'font:600 12.5px/1 "Segoe UI",system-ui,sans-serif;padding:11px 16px;border-radius:22px;'
      +'box-shadow:0 6px 22px rgba(15,46,61,.30);animation:nbin .14s ease-out}'
      +'#netbusy-ring{width:14px;height:14px;border:2px solid rgba(255,255,255,.32);border-top-color:#fff;'
      +'border-radius:50%;animation:nbspin .7s linear infinite;flex:none}'
      +'@media (prefers-reduced-motion:reduce){#netbusy-ring,#netbusy-card{animation:none}}';
    (document.head||document.documentElement).appendChild(s); (document.body||document.documentElement).appendChild(b);
  }
  if(on){
    const paint = function(){
      const t = document.getElementById('netbusy-txt');
      if(t) t.textContent = _inflight > 1 ? ('Reading data… (' + _inflight + ')') : 'Reading data…';
      /**
       * ⚠️ CENTRED ON THE PANE BEING READ (Athi: *"it is coming somewhere in the screen, it has to be in the
       * center of the current panel"*). Pinned top-right it sat among the browser and dev chrome — technically
       * visible, nowhere near where the eye already is. Centre it on the working surface instead, preferring the
       * detail pane, then the panel, then the main body, and only falling back to the viewport when a screen has
       * none of those (login, onboarding).
       */
      const host = document.getElementById('detailpane') || document.getElementById('panel')
                || document.getElementById('mainbody') || null;
      const r = host && host.getBoundingClientRect();
      b.style.display = 'block';
      if (r && r.width > 40 && r.height > 40){
        b.style.left = Math.round(r.left + r.width / 2) + 'px';
        b.style.top  = Math.round(r.top + r.height / 2) + 'px';
      } else {
        b.style.left = '50%'; b.style.top = '50%';
      }
      b.style.transform = 'translate(-50%,-50%)';
    };
    if(b.style.display === 'block') paint();                    // already up — just refresh the count
    else if(!_netBusyT) _netBusyT = setTimeout(function(){ _netBusyT = null; if(_inflight > 0) paint(); }, 180);
  } else {
    if(_netBusyT){ clearTimeout(_netBusyT); _netBusyT = null; }
    b.style.display = 'none';
  }
}
// --- tester message/event log (in-memory ring buffer; surfaced by the in-app Message console) ---
const __cblog = [];
function cblog(level, text){ __cblog.push({ t: Date.now(), level: level || 'info', text: String(text) }); if (__cblog.length > 300) __cblog.shift(); }
if (typeof window !== 'undefined') { window.__cblog = __cblog; window.cblog = cblog; }

// OUTBOX-SAFE mutations (offline Phase 4.2): fire-and-forget state changes / idempotent overwrites / deletes whose
// callers ignore the response body. Offline, these are QUEUED (cb-offline.js) and replayed on reconnect — deduped by the
// server Idempotency-Key (b109), so a replay can't double-apply. CREATES + id-returning + content-returning mutations
// (createChit, sendMsg, dispute-raise, AI, auth, uploads) are deliberately NOT here — offline they fail gracefully and
// the Phase-4.1 draft protects the typed input. See C:\dev\SPEC-offline-coverage.md.
const OUTBOX_KEYS = new Set([
  'advance','status','setPriority','custFlag','star','voidChit','markUnread','archive','unarchive','restore','delChit','purgeChit','assignBulk',
  'actorBreak','actorStatus','actorPinReset','actorDelegate','assign','unassign','actorEdit',
  'resolveDispute',
  'saveProfile','shopStatus','saveSettings','vaultSave','profileSave',
  'connRespond','netApprove','netDecline','netSuspend','netResume','netDisconnect',
  'supDel','supPatch','prodDel','prodEdit','folderRename','folderDelete','folderMove',
  'connectorDelete','connectorConnToggle',
  'readinessGather','readinessVerify',
  'assistResolve','assistPublish',
  'netDesignPut',   // b111 — whole-document upsert, idempotent → safe to queue + replay offline
]);

/* ══ THE LIVE CATEGORY SHELF ═════════════════════════════════════════════════════════════════════════════════
 * ⚠️ IT LIVES IN core.js AND NOT IN cap-catalogue.js. Both compose (app.html, always loaded) and the item form
 * (cap-catalogue.js, lazy) need it, and a loader behind a lazy load is a loader half the callers cannot reach.
 * ONE owner, one cache — the alternative is compose fetching its own copy and the two drifting.
 */
var _CATG = null;          // [{id,name}] — the live shelf, as last read
var _catgReq = null;       // in-flight promise, so a form opening twice does not fetch twice
function cbCatgLive(force){
  if (!force && _CATG) return Promise.resolve(_CATG);
  if (!force && _catgReq) return _catgReq;
  if (typeof api !== 'function') return Promise.resolve([]);
  /* ⚠️ `query`, not a fourth hardcoded alias. `defListLive` is pinned to kind=offer; copying it for categories
     and again for order models is how a list of aliases becomes a list of near-duplicates. */
  _catgReq = api('defList', { query: { kind: 'category', status: 'live' } })
    .then(function(r){
      _CATG = ((r && r.definitions) || []).map(function(d){ return { id: d.definition_id, name: d.name }; });
      _catgReq = null; return _CATG;
    })
    /**
     * ⚠️ FAILING SOFT IS CORRECT HERE, and it is worth saying why since the opposite rule applies at the mint.
     * A category is a way of FINDING a product; losing it costs a filter, not a fact. An item saved without one
     * is Uncategorised — visible, chip-counted, fixable. Refusing to let someone add an item because a
     * classification shelf could not be read would be the tail wagging the dog.
     */
    .catch(function(){ _catgReq = null; return _CATG || []; });
  return _catgReq;
}

async function api(key, {params, query, body}={}){
  const ep = EP[key]; if(!ep) throw new Error("no endpoint "+key);
  cblog('debug', ep.m + ' ' + key);
  // Double-fire guard: block a repeat of the SAME in-flight mutation (same endpoint+params). GETs are free.
  const lockKey = (ep.m!=='GET') ? (key+':'+JSON.stringify(params||{})) : null;
  if(lockKey){ if(_lockKeys.has(lockKey)) throw new Error("Already working on that — one moment."); _lockKeys.add(lockKey); }
  _inflight++; _netBusy(true);
  try{
    const CB = (typeof window!=='undefined') ? window.CBOffline : null;
    const outboxSafe = ep.m!=='GET' && OUTBOX_KEYS.has(key);
    const idemKey = (outboxSafe && CB) ? CB._uuid() : null;
    let pathQ = fill(ep.p, params);
    let url = CFG.API_BASE + pathQ;
    if(query){const q=new URLSearchParams(Object.entries(query).filter(([,v])=>v!=null&&v!=="")); if([...q].length){const qs="?"+q; url+=qs; pathQ+=qs;}}
    // Offline + queue-safe → capture to the outbox instead of a doomed request; replays (idempotently) on reconnect.
    if(outboxSafe && CB && !CB.online()){
      CB.enqueue({method:ep.m, path:pathQ, body, id:idemKey});
      cblog('warn', ep.m+' '+key+' → queued offline'); return {queued:true, offline:true};
    }
    let res;
    try{
      res = await fetch(url, {method:ep.m, cache:"no-store", headers:{"Content-Type":"application/json", ...(idemKey?{"Idempotency-Key":idemKey}:{}), ...(SESSION.token?{Authorization:"Bearer "+SESSION.token}:{})}, body: body?JSON.stringify(body):undefined});
    }catch(netErr){
      // network unreachable mid-request: queue if safe, else fail gracefully (the draft has the typed work)
      if(outboxSafe && CB){ CB.enqueue({method:ep.m, path:pathQ, body, id:idemKey}); cblog('warn', ep.m+' '+key+' → queued (net fail)'); return {queued:true, offline:true}; }
      cblog('error', ep.m+' '+key+' → network unreachable');
      throw new Error(ep.m==='GET' ? "You're offline — showing last-loaded data where available." : "You're offline — this needs a connection. Your typed work is saved.");
    }
    if(!res.ok){
      let msg="", j=null; try{ j=await res.json(); msg=j.message||j.error||""; }catch(_){}
      if(j && j.offline){ throw new Error(ep.m==='GET' ? "You're offline — showing last-loaded data where available." : "You're offline — your work is saved and will sync when you reconnect."); }
      cblog(res.status>=500?'error':'warn', ep.m+' '+key+' → '+res.status+(msg?' · '+msg:''));
      if(res.status===401){ SESSION={}; try{localStorage.removeItem("cb_token");localStorage.removeItem("cb_sess");}catch(_){} if(typeof go==="function") go("#/login"); throw new Error(msg||"Session expired — please sign in again."); }
      if(res.status===422){ throw new Error(msg||"Please check the form and try again."); }          // validation
      if(res.status>=500){ throw new Error(msg||"Server error — please try again."); }                 // generic
      throw new Error(msg||("API "+res.status+" "+ep.m+" "+ep.p));
    }
    return unwrap(res.status===204?null:await res.json());
  } finally {
    if(lockKey) _lockKeys.delete(lockKey);
    if(--_inflight<=0){ _inflight=0; _netBusy(false); }
  }
}
