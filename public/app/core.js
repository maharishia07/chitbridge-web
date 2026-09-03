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
  /**
   * ⚠️⚠️ `included` IS A SIBLING OF `entity`, AND THIS LINE WAS EATING IT — the fourth instance of the exact bug
   * the comments above describe, and the most expensive one, because nothing looked wrong.
   *
   * `/entities/me?include=readiness,channels,vault` returns `{entity, capabilities, governance, included}` and
   * the server gathers all three sub-reads in ONE transaction. `return j.entity` handed back the entity alone,
   * so `included` never reached a caller. `_profSeedIncluded(e)` read `e.included`, found nothing, and returned
   * without seeding — and the sub-loaders each went to the network exactly as if the bundle did not exist.
   *
   * ⭐ So the whole one-read optimisation has been dead since it was written: the server did the work and the
   * client discarded it, with no error and no visible symptom beyond a screen that felt slow. Measured
   * 2026-09-01 — a warm profile open still fetched governance/readiness and channels.
   *
   * ⚠️ ATTACHED TO THE ENTITY RATHER THAN RETURNING THE WHOLE OBJECT. Every caller of `api('me')` reads fields
   * off the flattened entity — `r.display_name`, `r.currency_code` — so returning `j` would change the shape
   * under all of them. Carrying one key across keeps both contracts true.
   */
  if(j.entity){ if(j.included && j.entity && typeof j.entity === "object"){ try{ j.entity.included = j.included; }catch(_){} } return j.entity; }
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
    b.innerHTML='<div id="netbusy-card"><span id="netbusy-ring"></span><span id="netbusy-txt">' + tx('Reading data…') + '</span></div>';
    const s=document.createElement('style');
    s.textContent='@keyframes nbspin{to{transform:rotate(360deg)}}'
      +'@keyframes nbin{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'
      +'#netbusy-card{display:inline-flex;align-items:center;gap:9px;background:var(--chrome);color:var(--chrome-on);'
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
      /**
       * ⚠️⚠️ CENTRING ON A PANE THAT RUNS OFF THE SCREEN PUTS THE MESSAGE OFF THE SCREEN. Athi, 2026-08-22:
       * *"I have reduced the size of the window much smaller… the messages were overlapping / going away from
       * the screen."* Measured: at a 700px window the detail pane's centre computes to **869→971** — the card
       * was painted entirely outside the viewport, so "Reading data…" simply never appeared.
       *
       * ⭐ THE HOST IS STILL THE RIGHT ANCHOR — the message belongs where the eye already is, which is why it
       * follows the detail pane rather than sitting in the chrome. What was missing is that a pane can be only
       * PARTLY on screen. Centre on the part you can actually see, and if almost none of it is visible, fall
       * back to the viewport rather than to a point beyond it.
       *
       * ⚠️ THEN CLAMP, using the card's own width. Centring the visible strip is not enough on its own: a
       * 102px card centred 20px from the edge still hangs half off. Measured after `display:block`, so the
       * number is the card's real width rather than a guess that rots when the text changes.
       */
      var vw = window.innerWidth || 0, vh = window.innerHeight || 0;
      var cx = vw / 2, cy = vh / 2;
      if (r && r.width > 40 && r.height > 40){
        var vl = Math.max(0, r.left),  vr = Math.min(vw, r.right);
        var vt = Math.max(0, r.top),   vb = Math.min(vh, r.bottom);
        if (vr - vl > 60) cx = (vl + vr) / 2;      /* enough of it is on screen to aim at */
        if (vb - vt > 60) cy = (vt + vb) / 2;
      }
      var hw = Math.min((b.offsetWidth || 120) / 2 + 8, vw / 2);
      var hh = Math.min((b.offsetHeight || 40) / 2 + 8, vh / 2);
      b.style.left = Math.round(Math.max(hw, Math.min(vw - hw, cx))) + 'px';
      b.style.top  = Math.round(Math.max(hh, Math.min(vh - hh, cy))) + 'px';
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

/**
 * ⭐ CBPrefs — ONE way to sync a person's own preferences to their identity row (b165 locale · b166 ui).
 *
 * ⚠️ SHARED RATHER THAN COPIED, and the reason is not tidiness. The localisation layer and the appearance
 * controls need exactly the same behaviour — debounce, fire-and-forget, queue when offline, stay silent before
 * the migration runs. Written twice, the second copy drifts the first time one of them gains a retry or a log
 * line, and the copy nobody remembered would be the one carrying somebody's accessibility setting.
 *
 * ⚠️ FIRE AND FORGET, ON PURPOSE. The setting has ALREADY applied locally and the screen has already
 * re-rendered; the person can see it worked. Surfacing a failure here would contradict what is on screen. It is
 * registered in OUTBOX_KEYS, so offline it queues and replays on reconnect — and before the migration the API
 * answers {pending:true}, which is equally nothing to report.
 *
 * ⚠️ DEBOUNCED PER KIND, not globally. Someone trying three themes to see which they like should cost one
 * write; but a theme change must never cancel a pending language change, which one shared timer would do.
 */
var CBPrefs = (function(){
  var timers = {};
  return {
    push: function(kind, obj){
      if (timers[kind]) { try { clearTimeout(timers[kind]); } catch(_){} }
      timers[kind] = setTimeout(function(){
        try {
          if (typeof api !== 'function' || !(typeof SESSION !== 'undefined' && SESSION && SESSION.token)) return;
          api('savePrefs', { params: { kind: kind }, body: obj || {} }).catch(function(){});
        } catch(_){}
      }, 400);
    }
  };
})();
try { if (typeof window !== 'undefined') window.CBPrefs = CBPrefs; } catch(_){}

const OUTBOX_KEYS = new Set([
  'advance','status','setPriority','custFlag','star','voidChit','markUnread','archive','unarchive','restore','delChit','purgeChit','assignBulk',
  'actorBreak','actorStatus','actorPinReset','actorDelegate','assign','unassign','actorEdit',
  'resolveDispute',
  'saveProfile','shopStatus','saveSettings','vaultSave','profileSave',
  'savePrefs',      // b165 — idempotent whole-object overwrite of one's own preferences; the caller ignores the body
  'connRespond','netApprove','netDecline','netSuspend','netResume','netDisconnect',
  'supDel','supPatch','prodDel','prodEdit','folderRename','folderDelete','folderMove',
  'connectorDelete','connectorConnToggle',
  'readinessGather','readinessVerify',
  'assistResolve','assistPublish',
  'netDesignPut',   // b111 — whole-document upsert, idempotent → safe to queue + replay offline
]);

/* ══ A PRODUCT'S CATEGORIES ══════════════════════════════════════════════════════════════════════════════════
 * ⭐⭐ A PRODUCT BELONGS TO MANY CATEGORIES (Athi, 2026-08-16: *"same product must be able to attach under
 * multiple category, and search should show the same"*). Rice is Grains AND Staples; a saree is Silk AND
 * Wedding. One slot was the wrong model and forced a false choice at the moment of authoring.
 *
 * ── ONE READER, BECAUSE THERE ARE TWO SHAPES IN THE DATA ───────────────────────────────────────────────────────
 * ⚠️ Products authored before this carry `category` (one id) + `category_name`. Products authored after carry
 * `categories` (ids) + `category_names`. BOTH EXIST IN LIVE DATA and always will — item_data is free-form jsonb,
 * so there is no migration that can sweep every historical row, and a counterparty's copy is not ours to edit.
 * Everything therefore reads through `catgIdsOf`, and NOTHING reads `d.category` directly. A second place that
 * knows the legacy shape is a second place that will forget it.
 *
 * ⚠️ WRITES ONLY EVER EMIT THE NEW SHAPE, and delete the old keys as they go — so a row upgrades the first time
 * it is saved, without a migration and without a moment where both shapes are true of the same product.
 */
function catgIdsOf(d){
  d = d || {};
  if (Array.isArray(d.categories)) return d.categories.map(String).filter(Boolean);
  if (d.category) return [String(d.category)];          // legacy single — read, never written again
  return [];
}
/** The travelling names, positionally aligned with catgIdsOf. Used only where an id cannot be resolved. */
function catgNamesOf(d){
  d = d || {};
  if (Array.isArray(d.category_names)) return d.category_names.map(String);
  if (d.category_name) return [String(d.category_name)];
  return [];
}
/**
 * Write `ids` onto an item_data object, in place, and return it.
 *
 * ⚠️ BOTH THE IDS AND THE NAMES, for the reason that has not changed: the id is MY reference (rename in the
 * Categories panel and every product of mine follows), the names are a VALUE copy for a counterparty who cannot
 * resolve my definition_ids and never will — [[reference-cb-core-principle]]. The copy is deliberately not kept
 * in step with a later rename.
 */
function catgSetOn(d, ids){
  d = d || {};
  var live = (typeof _CATG !== 'undefined' && _CATG) ? _CATG : [];
  /* ⚠️ SNAPSHOT BEFORE DELETING. My first cut deleted the legacy keys and then tried to read them for the
     unresolved-name fallback below — so the fallback silently found nothing and every unresolved id would have
     been relabelled as its own uuid. Read what is there, THEN clear it. */
  var wasIds = catgIdsOf(d), wasNames = catgNamesOf(d);
  var clean = [], seen = {};
  (ids || []).forEach(function(id){ id = String(id || '').trim(); if (id && !seen[id]) { seen[id] = 1; clean.push(id); } });
  delete d.category; delete d.category_name;            // the legacy pair never survives a save
  if (!clean.length) { delete d.categories; delete d.category_names; return d; }
  d.categories = clean;
  d.category_names = clean.map(function(id){
    var c = live.filter(function(x){ return x.id === id; })[0];
    /* ⚠️ An id we cannot resolve keeps whatever name it already travelled with, rather than being relabelled as
       its own uuid. Losing the word is worse than holding a slightly stale one. */
    if (c) return c.name;
    var i = wasIds.indexOf(id);
    return (i >= 0 && wasNames[i]) ? wasNames[i] : id;
  });
  return d;
}

/* ══ THE LIVE CATEGORY SHELF ═════════════════════════════════════════════════════════════════════════════════
 * ⚠️ IT LIVES IN core.js AND NOT IN cap-catalogue.js. Both compose (app.html, always loaded) and the item form
 * (cap-catalogue.js, lazy) need it, and a loader behind a lazy load is a loader half the callers cannot reach.
 * ONE owner, one cache — the alternative is compose fetching its own copy and the two drifting.
 */
/**
 * ⭐ ONE LIVE-DEFINITION LOADER, KEYED BY KIND — extracted 2026-08-17 when order models became the second
 * caller, which is exactly the case the note below anticipated. Categories and order models want the same
 * thing: the live definitions of one kind, cached, with one in-flight request no matter how many forms open.
 * ⚠️ Returns the RAW definitions. Each caller shapes what it needs — a category wants {id,name}, an order model
 * wants its sub-kind and rules — because a shared loader that also imposed a shape would just be two functions
 * with a shared cache and a lie in the middle.
 */
var _DEFS = {};            // kind → raw definitions, as last read
var _defsReq = {};         // kind → in-flight promise
function cbDefsLive(kind, force){
  if (!force && _DEFS[kind]) return Promise.resolve(_DEFS[kind]);
  if (!force && _defsReq[kind]) return _defsReq[kind];
  if (typeof api !== 'function') return Promise.resolve([]);
  /* ⚠️ `query`, not a fourth hardcoded alias. `defListLive` is pinned to kind=offer; copying it for categories
     and again for order models is how a list of aliases becomes a list of near-duplicates. */
  _defsReq[kind] = api('defList', { query: { kind: kind, status: 'live' } })
    .then(function(r){ _DEFS[kind] = (r && r.definitions) || []; _defsReq[kind] = null; return _DEFS[kind]; })
    .catch(function(){ _defsReq[kind] = null; return _DEFS[kind] || []; });
  return _defsReq[kind];
}
/** Synchronous read of whatever was last loaded — for render paths that cannot await. */
function cbDefsCached(kind){ return _DEFS[kind] || null; }

var _CATG = null;          // [{id,name}] — the live shelf, as last read
var _catgReq = null;       // in-flight promise, so a form opening twice does not fetch twice
/**
 * ── ⭐⭐ CREATING A CATEGORY, BESIDE THE CACHE IT UPDATES ───────────────────────────────────────────────────────
 *
 * Moved here from cap-catalogue.js when the six-step wizard was deleted (Athi, 2026-09-03: "delete the old
 * wizard"). They were the only two things in that file the rest of the app still called.
 *
 * ⭐ AND THIS IS WHERE THEY BELONGED ALL ALONG. Both read and refresh `_CATG` / `cbCatgLive`, which live right
 * here — so sitting in a LAZY module meant the product form had to `ensureCap('catalogue')` before it could
 * offer "new category", and the old comment said exactly why that was dangerous: *"calling it directly works
 * only if you happened to open the wizard earlier in the session — the worst kind of bug, because it works when
 * you test it and not when someone else does."* core.js is eager, so the dance is gone with the wizard.
 */
async function cbCatgCreate(name){
  name = String(name || '').trim();
  if (name.length < 2) throw new Error('Give the category a name of at least 2 characters.');
  var dup = (_CATG || []).filter(function(c){ return c.name.toLowerCase() === name.toLowerCase(); })[0];
  if (dup) return dup;      // ⚠️ Silently reusing the existing one beats minting a second shelf with one name.
  var r = await api('defAdd', { body: { kind: 'category', sub_kind: null, name: name, note: '', rules: {} } });
  var id = r && (r.definition_id || (r.definition && r.definition.definition_id));
  if (!id) throw new Error('Created, but the server did not return an id.');
  await api('defSave', { params: { id: id }, body: { status: 'live' } });
  await cbCatgLive(true);
  return { id: id, name: name };
}

function cbCatgAskNew(onDone){
  if (typeof promptAsk !== 'function') return;
  promptAsk('New category', { label:'What is it called?', placeholder:'e.g. Fasteners', maxlength:60,
    okLabel:'Create',
    hint:'It goes on the shelf as <b>live</b>, so you can use it straight away. Rename it any time under '
       + 'Definitions — your products follow the rename.' },
    function(v){
      cbCatgCreate(v).then(function(c){ toast('“' + c.name + '” added ✓'); if (onDone) onDone(c); })
                     .catch(function(e){ toast((e && e.message) || 'Could not create that.'); });
    });
}

function cbCatgLive(force){
  if (!force && _CATG) return Promise.resolve(_CATG);
  if (!force && _catgReq) return _catgReq;
  if (typeof api !== 'function') return Promise.resolve([]);
  _catgReq = cbDefsLive('category', force)
    .then(function(defs){
      _CATG = (defs || []).map(function(d){ return { id: d.definition_id, name: d.name }; });
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

/* ══ ORDER MODELS, ADOPTED BY REFERENCE (backlog 17) ═════════════════════════════════════════════════════════
 * A definition wraps one of cart-ui's MODELS with a NAME — "Carton of 6" = `pack, step 6` — so a product adopts
 * the name instead of the rule being retyped on fifty items. The product stores `order = { ref:<definition_id> }`
 * and NEVER the values, so a correction to the definition reaches every product that adopted it.
 *
 * ⚠️⚠️ THAT PROPAGATION IS THE WHOLE RISK, AND IT IS WHY THE MINT FREEZES. Changing "Carton of 6" to 12 moves
 * every adopting product, which is either exactly what you want or a catastrophe. So the rule is two-speed:
 *   browsing / editing → resolve LIVE, so a correction propagates
 *   at the mint        → FREEZE the resolved values onto the chit, so a later change cannot rewrite what was
 *                        agreed (POST /api/definitions/freeze already returns exactly that snapshot)
 */
function cbOrderLive(force){ return cbDefsLive('ordermodel', force); }
/**
 * Resolve a stored `order` into the flat declaration cart-ui reads. Synchronous, because every render path that
 * needs it is synchronous; it reads the cache cbOrderLive() fills.
 *
 * ⚠️⚠️ AN UNRESOLVED REFERENCE MUST NOT QUIETLY BECOME `count`. cart-ui defaults an unknown model to `count`,
 * so returning a bare `{ref}` would silently turn "Carton of 6" into "6 each" — the same number, a different
 * promise, and no error anywhere. Instead the marker is carried out so callers can REFUSE to quantify and say
 * the model could not be read. Losing a category costs a filter; losing an order model would change what was
 * ordered, and those two failures do not deserve the same softness.
 */
function cbOrderDecl(order){
  var o = order || {};
  if (!o.ref) return o;                                  // inline declaration — unchanged, still supported
  var defs = cbDefsCached('ordermodel');
  if (!defs) { cbOrderLive(); return { ref: o.ref, unresolved: 'loading' }; }
  var d = null;
  for (var i = 0; i < defs.length; i++) if (defs[i].definition_id === o.ref) { d = defs[i]; break; }
  /* ⚠️ A RETIRED definition still resolves if the server returned it — "do not offer this any more" is not
     "this never happened". Only a genuinely missing one is unresolved. */
  if (!d) return { ref: o.ref, unresolved: 'missing' };
  var out = { ref: o.ref, model: d.sub, name: d.name };
  var rules = d.rules || {};
  for (var k in rules) if (Object.prototype.hasOwnProperty.call(rules, k) && out[k] === undefined) out[k] = rules[k];
  return out;
}

async function api(key, {params, query, body}={}){
  const ep = EP[key]; if(!ep) throw new Error("no endpoint "+key);
  cblog('debug', ep.m + ' ' + key);
  // Double-fire guard: block a repeat of the SAME in-flight mutation (same endpoint+params). GETs are free.
  const lockKey = (ep.m!=='GET') ? (key+':'+JSON.stringify(params||{})) : null;
  if(lockKey){ if(_lockKeys.has(lockKey)) throw new Error("Already working on that — one moment."); _lockKeys.add(lockKey); }
  _inflight++; _netBusy(true);
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();   /* for the spec call log */
  /**
   * ⭐⭐ THE CORRELATION ID, FROM THIS END. The server already mints one when the header is absent and echoes
   * it as `X-Request-Id` — but nothing on the client sent one or kept it, so a person reporting *"it failed
   * when I pressed Send"* could never be joined to the line that recorded why.
   *
   * ⭐ SENT RATHER THAN READ BACK, deliberately: the id then exists BEFORE the request leaves, so a failure
   * with no response at all — a timeout, a dead connection, a CORS refusal — still has an identity. Reading it
   * off the reply only works for requests that got one, which are the ones you least need to trace.
   *
   * ⚠️ NOT A UUID AND NOT A SECRET. Sixteen hex characters is plenty to join two logs, and it must carry no
   * meaning: an id built from the entity or the user would leak identity into every proxy log on the path.
   */
  const _rid = (function(){
    try {
      if (window.crypto && crypto.getRandomValues) {
        const a = new Uint8Array(8); crypto.getRandomValues(a);
        return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch(_) {}
    return String(Date.now().toString(16)) + Math.floor(Math.random() * 1e6).toString(16);
  })();
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
      cblog('warn', ep.m+' '+key+' → queued offline ['+_rid+']'); return {queued:true, offline:true};
    }
    let res;
    try{
      res = await fetch(url, {method:ep.m, cache:"no-store", headers:{"Content-Type":"application/json", "X-Request-Id": _rid, ...(idemKey?{"Idempotency-Key":idemKey}:{}), ...(SESSION.token?{Authorization:"Bearer "+SESSION.token}:{})}, body: body?JSON.stringify(body):undefined});
    }catch(netErr){
      // network unreachable mid-request: queue if safe, else fail gracefully (the draft has the typed work)
      if(outboxSafe && CB){ CB.enqueue({method:ep.m, path:pathQ, body, id:idemKey}); cblog('warn', ep.m+' '+key+' → queued, net fail ['+_rid+']'); return {queued:true, offline:true}; }
      cblog('error', ep.m+' '+key+' → network unreachable ['+_rid+']');
      throw new Error(ep.m==='GET' ? "You're offline — showing last-loaded data where available." : "You're offline — this needs a connection. Your typed work is saved.");
    }
    if(!res.ok){
      /**
       * ⚠️⚠️ THE SPECIFIC REASON WAS BEING THROWN AWAY. Athi, 2026-08-18: *"Trying to update the profile, it
       * says validation failed, not sure what it is. Need to have explanation so people understand and update
       * accordingly."* He was right, and the message he needed already existed.
       *
       * express-validator answers with `{ error:'Validation failed', details:[{field, message}] }`, and the
       * MESSAGES ARE GOOD — *"A User ID cannot contain spaces — try alpha-timers."* This line read `j.message ||
       * j.error` and never looked at `details`, so every one of them collapsed into the two useless words
       * "Validation failed". The product knew exactly what was wrong and refused to say.
       *
       * ⚠️ THE FIELD NAME IS PREFIXED, because "must be at least 8 characters" is unanswerable when a form has
       * six fields. Naming the field is the difference between a message and a hint.
       * ⚠️ AND ALL OF THEM ARE SHOWN, not just the first — fixing one error only to be told about the next is
       * the interaction people describe as "fighting the form".
       */
      let msg="", j=null;
      try{
        j=await res.json();
        if(j && Array.isArray(j.details) && j.details.length){
          msg = j.details.map(function(d){
            var f = d && d.field ? String(d.field).replace(/_/g,' ') : '';
            var m = (d && d.message) || '';
            /* "Invalid value" is express-validator's default and says nothing; name the field at least. */
            if(/^invalid value$/i.test(m)) m = 'is not valid';
            return f ? (f.charAt(0).toUpperCase()+f.slice(1)+': '+m) : m;
          }).filter(Boolean).join('  ·  ');
        }
        if(!msg) msg = j.message || j.error || "";
      }catch(_){}
      if(j && j.offline){ throw new Error(ep.m==='GET' ? "You're offline — showing last-loaded data where available." : "You're offline — your work is saved and will sync when you reconnect."); }
      cblog(res.status>=500?'error':'warn', ep.m+' '+key+' → '+res.status+(msg?' · '+msg:''));
      if(res.status===401){ SESSION={}; try{localStorage.removeItem("cb_token");localStorage.removeItem("cb_sess");}catch(_){} if(typeof go==="function") go("#/login"); throw new Error(msg||"Session expired — please sign in again."); }
      if(res.status===422){ throw new Error(msg||"Please check the form and try again."); }          // validation
      if(res.status>=500){ throw new Error(msg||"Server error — please try again."); }                 // generic
      throw new Error(msg||("API "+res.status+" "+ep.m+" "+ep.p));
    }
    /**
     * ⭐⭐ THE SPEC RECORDS WHAT ACTUALLY HAPPENED. Athi, 2026-08-22: *"possibly we can use spec mode to see
     * the actual specification, api calls, and any endpoints, output in json."*
     *
     * ⭐ RECORDED FROM THE REAL CALL, NOT DECLARED. A hand-written list of "endpoints this screen uses" is a
     * second source of truth that drifts the first time a screen gains a request. This is the request that
     * just went out: its name, method, resolved path, status and duration.
     *
     * ⚠️ ONLY WHILE SPEC IS ON. Off, this is one boolean check and nothing is kept — no memory held, and no
     * response body sitting around in a tab that is merely open. The body is also capped, because the point is
     * to see the SHAPE of the answer, not to build a network log.
     */
    const _out = unwrap(res.status===204?null:await res.json());
    try {
      if (typeof specOn === 'function' && specOn()) {
        window.CBCALLS = window.CBCALLS || [];
        CBCALLS.unshift({ key, m: ep.m, path: pathQ, status: res.status, rid: _rid,
          ms: Math.round((typeof performance!=='undefined'?performance.now():Date.now()) - _t0),
          body: JSON.stringify(_out === undefined ? null : _out).slice(0, 1200) });
        CBCALLS.length = Math.min(CBCALLS.length, 40);
      }
    } catch(_) {}
    return _out;
  } finally {
    if(lockKey) _lockKeys.delete(lockKey);
    if(--_inflight<=0){ _inflight=0; _netBusy(false); }
  }
}
