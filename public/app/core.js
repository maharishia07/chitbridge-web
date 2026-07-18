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
  if("token" in j || "my_disputes" in j || "header" in j) return j; // auth (token) / structured / compound -> whole, untouched
  for(const k of ["chits","messages","connections","requests","suppliers","items","results","actors"]) if(Array.isArray(j[k])){ const a=j[k]; for(const mk of ["total","page","limit"]) if(mk in j){ try{ Object.defineProperty(a, mk, {value:j[mk], enumerable:false, configurable:true, writable:true}); }catch(_){ a[mk]=j[mk]; } } return a; }
  if(j.entity) return j.entity;
  if(j.settings) return j.settings;
  if(j.chit) return j.chit;
  return j;
}

// --- shared in-flight feedback (every panel goes through api(), so this is uniform) ---
let _inflight = 0;
const _lockKeys = new Set();
function _netBusy(on){
  let b = document.getElementById('netbusy');
  if(!b){
    b = document.createElement('div'); b.id='netbusy';
    b.style.cssText='position:fixed;top:0;left:0;height:3px;width:100%;z-index:9999;pointer-events:none;display:none;background:linear-gradient(90deg,transparent,#3F66A6,transparent);background-size:40% 100%;background-repeat:no-repeat;animation:netbusy 1.1s linear infinite';
    const s=document.createElement('style'); s.textContent='@keyframes netbusy{0%{background-position:-40% 0}100%{background-position:140% 0}}';
    (document.head||document.documentElement).appendChild(s); (document.body||document.documentElement).appendChild(b);
  }
  b.style.display = on ? 'block' : 'none';
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
]);

async function api(key, {params, query, body}={}){
  const ep = EP[key]; if(!ep) throw new Error("no endpoint "+key);
  cblog('debug', (CFG.MODE==='demo'?'(demo) ':'') + ep.m + ' ' + key);
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
